import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoActividad, Frecuencia } from '@prisma/client';
import { Workbook } from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivitiesService } from './activities.service';
import { HistoryActor, HistoryService } from './history.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

/** Importa el plan de trabajo desde un .xlsx y lo deja sincronizado con el archivo.
 *
 * El análisis del Excel (detectar si es la plantilla simple o el plan nativo con
 * secciones de color, leer sus filas, validar cada una) vive en analytics-service
 * (Python/openpyxl — ver analytics-service/app/plan_trabajo_parser.py), que es más
 * idóneo para esto: entiende de forma nativa las fusiones de celda y el texto
 * enriquecido, sin necesidad de reconstruirlos a mano como exigía exceljs. Este
 * servicio solo reenvía el archivo (con el Bearer del usuario, igual que
 * plan-siguiente-anio.service.ts) y hace la parte que sí le corresponde al backend:
 * decidir qué actividad crear/actualizar en Postgres y qué queda fuera del plan.
 *
 * Por cada fila válida que devuelve el análisis se busca una actividad existente por
 * (categoría, nombre) dentro de la auditoría — si existe la actualiza (reutilizando
 * ActivitiesService.update, que ya maneja historial y regeneración de ocurrencias), si
 * no existe la crea. Al final, cualquier actividad de la auditoría que no haya
 * aparecido en el archivo se remueve (reutilizando ActivitiesService.deactivate: elimina
 * si no tiene ocurrencias registradas, o la desactiva conservando historial si ya las
 * tiene). Los errores de fila que reporta el análisis no abortan el resto del archivo.
 *
 * Además de la definición de la actividad, el plan nativo trae en sus columnas
 * semanales el estado real (P/E/R/N) de los meses ya transcurridos — analytics-service
 * lo traduce a `fila.periodos` con los mismos identificadores de periodo que genera
 * `periods.util.ts` (p.ej. "2026-03", "2026-Q1"). Después de crear/actualizar cada
 * actividad (lo que ya generó sus ocurrencias del año, todas en PLANEADO), se busca la
 * ocurrencia de cada periodo reportado y se le pone el estado real — si no, el
 * dashboard mostraría como "vencido" algo que el Excel ya marca como ejecutado. Solo se
 * aplica si el año detectado en el archivo coincide con el año actual: las ocurrencias
 * solo se pre-generan para el año en curso (ver ActivitiesService.ensureOccurrences),
 * así que para otro año simplemente no habría ninguna ocurrencia que actualizar.
 *
 * `buildTemplate()` es aparte: solo genera el .xlsx de ejemplo para descargar, no lee
 * nada, así que se queda con exceljs acá (no tiene sentido moverlo a Python). */

const TEMPLATE_HEADERS = [
  'Categoría',
  'Actividad',
  'Responsable',
  'Frecuencia',
  'Descripción y/o evidencia',
  'Observación',
  'Activa (Sí/No)',
  'Fecha específica (solo si Frecuencia = UNICA)',
];

interface PeriodoEstado {
  periodo: string;
  estado: string;
  esAdHoc: boolean;
}

interface FilaActividad {
  fila: number;
  categoria: string;
  nombre: string;
  responsable: string;
  frecuencia: string;
  descripcionEvidencia: string | null;
  observacion: string | null;
  activa: boolean;
  fechaEspecifica: string | null;
  periodos: PeriodoEstado[];
}

interface FilaError {
  fila: number;
  motivo: string;
}

interface ParseResponse {
  formato: 'plantilla' | 'nativo';
  anio: number;
  filas: FilaActividad[];
  errores: FilaError[];
}

export interface ImportRowError {
  fila: number;
  motivo: string;
}

export interface ImportResult {
  totalFilas: number;
  creadas: number;
  actualizadas: number;
  eliminadas: number;
  desactivadas: number;
  estadosSincronizados: number;
  errores: ImportRowError[];
}

@Injectable()
export class ImportExcelService {
  private readonly analyticsServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activitiesService: ActivitiesService,
    private readonly configService: ConfigService,
    private readonly history: HistoryService,
  ) {
    this.analyticsServiceUrl = this.configService.get<string>('analyticsServiceUrl')!;
  }

  async buildTemplate(): Promise<Buffer> {
    const wb = new Workbook();
    const sheet = wb.addWorksheet('Plantilla');
    sheet.columns = TEMPLATE_HEADERS.map((header, i) => ({
      header,
      key: `c${i}`,
      width: [22, 42, 24, 16, 36, 30, 14, 18][i],
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.addRow([
      'Seguimientos como puntos de control',
      'Revisar copias de seguridad',
      'Ana Ruiz',
      'MENSUAL',
      'Captura de pantalla del backup',
      '',
      'Sí',
      '',
    ]);

    const legend = wb.addWorksheet('Valores válidos');
    legend.columns = [{ header: 'Frecuencia', key: 'f', width: 24 }];
    legend.getRow(1).font = { bold: true };
    for (const f of Object.values(Frecuencia)) legend.addRow([f]);

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async parseWithAnalyticsService(
    buffer: Buffer,
    authHeader: string,
  ): Promise<ParseResponse> {
    const form = new FormData();
    // Buffer<ArrayBufferLike> no encaja con el BlobPart de lib.dom (choque de tipos
    // entre @types/node y las libs DOM que usa el fetch/FormData/Blob globales de
    // Node) — el valor en runtime sí es válido para Blob.
    form.append(
      'file',
      new Blob([buffer as unknown as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      'plan-trabajo.xlsx',
    );

    let response: Response;
    try {
      response = await fetch(`${this.analyticsServiceUrl}/plan-trabajo/parse-excel`, {
        method: 'POST',
        headers: { Authorization: authHeader },
        body: form,
      });
    } catch {
      throw new InternalServerErrorException(
        'No se pudo contactar el servicio de analítica (analytics-service) para leer el Excel. Verificar que esté corriendo en ' +
          this.analyticsServiceUrl,
      );
    }

    if (response.status === 400) {
      const detail = (await response.json().catch(() => null)) as { detail?: string } | null;
      throw new BadRequestException(detail?.detail ?? 'El archivo no es un .xlsx válido');
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new InternalServerErrorException(
        `analytics-service respondió ${response.status} al analizar el Excel: ${detail}`,
      );
    }
    return response.json() as Promise<ParseResponse>;
  }

  async importFromExcel(
    auditoriaId: string,
    buffer: Buffer,
    actor: HistoryActor,
    authHeader: string,
  ): Promise<ImportResult> {
    const parsed = await this.parseWithAnalyticsService(buffer, authHeader);

    const result: ImportResult = {
      totalFilas: parsed.filas.length + parsed.errores.length,
      creadas: 0,
      actualizadas: 0,
      eliminadas: 0,
      desactivadas: 0,
      estadosSincronizados: 0,
      errores: parsed.errores,
    };
    const vistas = new Set<string>();
    const aplicarEstados = parsed.anio === new Date().getFullYear();

    for (const fila of parsed.filas) {
      // Se protege ya con categoría+nombre antes de create/update: así, si el create o
      // el update fallan por algún motivo, la actividad existente igual queda fuera del
      // barrido de sincronización de más abajo, que solo remueve lo que no aparece en
      // el archivo.
      const existing = await this.prisma.activity.findFirst({
        where: {
          auditoriaId,
          categoria: { equals: fila.categoria, mode: 'insensitive' },
          nombre: { equals: fila.nombre, mode: 'insensitive' },
        },
      });
      if (existing) vistas.add(existing.id);

      try {
        let activityId: string;
        if (existing) {
          const dto: UpdateActivityDto = {
            categoria: fila.categoria,
            nombre: fila.nombre,
            responsable: fila.responsable,
            frecuencia: fila.frecuencia as Frecuencia,
            descripcionEvidencia: fila.descripcionEvidencia ?? undefined,
            observacion: fila.observacion ?? undefined,
            activa: fila.activa,
            fechaEspecifica: fila.fechaEspecifica ?? undefined,
          };
          await this.activitiesService.update(auditoriaId, existing.id, dto, actor);
          result.actualizadas += 1;
          activityId = existing.id;
        } else {
          const dto: CreateActivityDto = {
            categoria: fila.categoria,
            nombre: fila.nombre,
            responsable: fila.responsable,
            frecuencia: fila.frecuencia as Frecuencia,
            descripcionEvidencia: fila.descripcionEvidencia ?? undefined,
            observacion: fila.observacion ?? undefined,
            activa: fila.activa,
            fechaEspecifica: fila.fechaEspecifica ?? undefined,
          };
          const created = await this.activitiesService.create(auditoriaId, dto, actor);
          result.creadas += 1;
          vistas.add(created.id);
          activityId = created.id;
        }

        if (aplicarEstados && fila.periodos.length) {
          result.estadosSincronizados += await this.applyPeriodStatuses(
            activityId,
            fila.periodos,
            actor,
          );
        }
      } catch (err) {
        result.errores.push({
          fila: fila.fila,
          motivo: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    }

    // Si el archivo no traía ninguna fila con datos, no se sincroniza: evita vaciar
    // todo el plan por subir por error un archivo vacío o la plantilla en blanco.
    if (result.totalFilas === 0) return result;

    const sobrantes = await this.prisma.activity.findMany({
      where: { auditoriaId, id: { notIn: [...vistas] } },
      select: { id: true },
    });
    for (const { id } of sobrantes) {
      const { eliminada } = await this.activitiesService.deactivate(auditoriaId, id, actor);
      if (eliminada) result.eliminadas += 1;
      else result.desactivadas += 1;
    }

    return result;
  }

  /** Pone en cada ocurrencia el estado real (P/E/R/N) que ya traía el Excel para ese
   * periodo, en vez de dejarla en el PLANEADO por defecto que le puso
   * ActivitiesService.ensureOccurrences al generarla. No usa OccurrencesService.
   * changeEstado (pensado para el cambio de estado interactivo, con evidencias y
   * fechaEjecucion exacta) porque acá no hay ni evidencias ni una fecha de ejecución
   * real más precisa que la fecha programada del periodo — se actualiza directo y se
   * deja un registro de historial liviano por ocurrencia tocada.
   *
   * Para A_DEMANDA/CUANDO_SE_REQUIERA (`esAdHoc`) no hay ocurrencia pre-generada que
   * buscar (periodsForYear no genera nada para esas frecuencias): si el Excel trae una
   * marca real ahí, se crea la ocurrencia ad-hoc en vez de descartar la marca, con el
   * mismo periodo "AAAA-MM" (estable entre corridas, así una re-importación la
   * actualiza en vez de duplicarla — a diferencia del periodo con sufijo aleatorio que
   * genera OccurrencesService.createAdHoc para las que carga una persona a mano).
   *
   * Devuelve cuántas ocurrencias se crearon o cambiaron de estado. */
  private async applyPeriodStatuses(
    activityId: string,
    periodos: PeriodoEstado[],
    actor: HistoryActor,
  ): Promise<number> {
    let actualizadas = 0;
    for (const { periodo, estado, esAdHoc } of periodos) {
      const occurrence = await this.prisma.activityOccurrence.findUnique({
        where: { activityId_periodo: { activityId, periodo } },
      });

      if (!occurrence) {
        // No existe ocurrencia para ese periodo. Para las frecuencias que sí se
        // pre-generan, esto solo pasa si el año del archivo no coincide con el año
        // actual (ya filtrado antes de llamar acá) — no hay nada que crear. Para
        // A_DEMANDA/CUANDO_SE_REQUIERA sí corresponde crearla.
        if (!esAdHoc) continue;
        const fechaProgramada = this.lastDayOfPeriodoMensual(periodo);
        if (!fechaProgramada) continue;

        const created = await this.prisma.activityOccurrence.create({
          data: {
            activityId,
            periodo,
            fechaProgramada,
            estado: estado as EstadoActividad,
            fechaEjecucion: estado === EstadoActividad.EJECUTADO ? fechaProgramada : undefined,
            createdBy: actor.userId,
          },
        });
        await this.history.logOccurrence(created.id, 'creado_importado_excel', actor, 'estado', undefined, estado);
        actualizadas += 1;
        continue;
      }

      if (occurrence.estado === estado) continue;

      await this.prisma.activityOccurrence.update({
        where: { id: occurrence.id },
        data: {
          estado: estado as EstadoActividad,
          fechaEjecucion:
            estado === EstadoActividad.EJECUTADO ? occurrence.fechaProgramada : occurrence.fechaEjecucion,
          updatedBy: actor.userId,
        },
      });
      await this.history.logOccurrence(
        occurrence.id,
        'estado_importado_excel',
        actor,
        'estado',
        occurrence.estado,
        estado,
      );
      actualizadas += 1;
    }
    return actualizadas;
  }

  /** Último día del mes de un periodo "AAAA-MM" (mismo criterio que
   * periods.util.ts#lastDayOfMonth). null si `periodo` no tiene ese formato — no
   * debería pasar (lo genera el propio analytics-service), pero no vale la pena tirar
   * toda la importación por una fila si pasara. */
  private lastDayOfPeriodoMensual(periodo: string): Date | null {
    const match = /^(\d{4})-(\d{2})$/.exec(periodo);
    if (!match) return null;
    const anio = Number(match[1]);
    const mes = Number(match[2]); // 1-12: Date.UTC toma mes 0-indexado, así que day 0 del mes N (tal cual) cae en el último día del mes N-1+1 = N
    return new Date(Date.UTC(anio, mes, 0));
  }
}
