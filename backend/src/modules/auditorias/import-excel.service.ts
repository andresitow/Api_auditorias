import { BadRequestException, Injectable } from '@nestjs/common';
import { CellValue, Workbook } from 'exceljs';
import { Frecuencia } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivitiesService } from './activities.service';
import { HistoryActor } from './history.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

/** Importa/actualiza el plan de trabajo desde un .xlsx (contraparte de la plantilla
 * que descarga buildTemplate()). No reemplaza el plan: por cada fila busca una
 * actividad existente por (categoría, nombre) dentro de la auditoría — si existe la
 * actualiza (reutilizando ActivitiesService.update, que ya maneja historial y
 * regeneración de ocurrencias), si no existe la crea. Los errores son por fila: una
 * fila mala no aborta el resto del archivo. */

const FRECUENCIA_ALIASES: Record<string, Frecuencia> = {
  DIARIO: Frecuencia.DIARIO,
  DIARIA: Frecuencia.DIARIO,
  MENSUAL: Frecuencia.MENSUAL,
  BIMENSUAL: Frecuencia.BIMENSUAL,
  TRIMESTRAL: Frecuencia.TRIMESTRAL,
  SEMESTRAL: Frecuencia.SEMESTRAL,
  ANUAL: Frecuencia.ANUAL,
  UNICA: Frecuencia.UNICA,
  ÚNICA: Frecuencia.UNICA,
  A_DEMANDA: Frecuencia.A_DEMANDA,
  'A DEMANDA': Frecuencia.A_DEMANDA,
  CUANDO_SE_REQUIERA: Frecuencia.CUANDO_SE_REQUIERA,
  'CUANDO SE REQUIERA': Frecuencia.CUANDO_SE_REQUIERA,
};

function parseFrecuencia(raw: string): Frecuencia | null {
  return FRECUENCIA_ALIASES[raw.trim().toUpperCase()] ?? null;
}

function parseActiva(raw: string): boolean {
  if (!raw) return true;
  const s = raw.trim().toLowerCase();
  return !['no', 'false', '0', 'inactiva', 'inactivo'].includes(s);
}

/** exceljs puede devolver el valor de una celda como string, número, Date, o un
 * objeto rich-text/hyperlink (`{ text: ... }` / `{ text, hyperlink }`) — normalizamos
 * todo a texto plano recortado. */
function cellText(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return String(value).trim();
  if (
    typeof value === 'object' &&
    'text' in value &&
    typeof value.text === 'string'
  )
    return value.text.trim();
  return '';
}

export interface ImportRowError {
  fila: number;
  motivo: string;
}

export interface ImportResult {
  totalFilas: number;
  creadas: number;
  actualizadas: number;
  errores: ImportRowError[];
}

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

@Injectable()
export class ImportExcelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activitiesService: ActivitiesService,
  ) {}

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

  async importFromExcel(
    auditoriaId: string,
    buffer: Buffer,
    actor: HistoryActor,
  ): Promise<ImportResult> {
    const wb = new Workbook();
    try {
      // exceljs declara su propio `interface Buffer extends ArrayBuffer` global (index.d.ts)
      // que choca con el Buffer real de @types/node 24 — es un problema de tipos, no de
      // runtime (el valor sí es un Buffer normal), así que se desactiva el chequeo acá.
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException('El archivo no es un .xlsx válido');
    }
    const sheet = wb.worksheets[0];
    if (!sheet) throw new BadRequestException('El archivo no tiene hojas');

    const result: ImportResult = {
      totalFilas: 0,
      creadas: 0,
      actualizadas: 0,
      errores: [],
    };

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const categoria = cellText(row.getCell(1).value);
      const nombre = cellText(row.getCell(2).value);
      const responsable = cellText(row.getCell(3).value);
      const frecuenciaRaw = cellText(row.getCell(4).value);
      const descripcionEvidencia = cellText(row.getCell(5).value) || undefined;
      const observacion = cellText(row.getCell(6).value) || undefined;
      const activaRaw = cellText(row.getCell(7).value);
      const fechaEspecificaRaw = cellText(row.getCell(8).value);

      if (!categoria && !nombre && !responsable && !frecuenciaRaw) continue; // fila vacía

      result.totalFilas += 1;

      if (!categoria) {
        result.errores.push({ fila: rowNumber, motivo: 'Falta la categoría' });
        continue;
      }
      if (!nombre) {
        result.errores.push({
          fila: rowNumber,
          motivo: 'Falta el nombre de la actividad',
        });
        continue;
      }
      if (!responsable) {
        result.errores.push({
          fila: rowNumber,
          motivo: 'Falta el responsable',
        });
        continue;
      }
      const frecuencia = parseFrecuencia(frecuenciaRaw);
      if (!frecuencia) {
        result.errores.push({
          fila: rowNumber,
          motivo: `Frecuencia inválida: "${frecuenciaRaw}"`,
        });
        continue;
      }
      if (frecuencia === Frecuencia.UNICA && !fechaEspecificaRaw) {
        result.errores.push({
          fila: rowNumber,
          motivo: 'La frecuencia UNICA requiere fecha específica',
        });
        continue;
      }

      try {
        const existing = await this.prisma.activity.findFirst({
          where: {
            auditoriaId,
            categoria: { equals: categoria, mode: 'insensitive' },
            nombre: { equals: nombre, mode: 'insensitive' },
          },
        });

        if (existing) {
          const dto: UpdateActivityDto = {
            categoria,
            nombre,
            responsable,
            frecuencia,
            descripcionEvidencia,
            observacion,
            activa: parseActiva(activaRaw),
            fechaEspecifica: fechaEspecificaRaw || undefined,
          };
          await this.activitiesService.update(
            auditoriaId,
            existing.id,
            dto,
            actor,
          );
          result.actualizadas += 1;
        } else {
          const dto: CreateActivityDto = {
            categoria,
            nombre,
            responsable,
            frecuencia,
            descripcionEvidencia,
            observacion,
            activa: parseActiva(activaRaw),
            fechaEspecifica: fechaEspecificaRaw || undefined,
          };
          await this.activitiesService.create(auditoriaId, dto, actor);
          result.creadas += 1;
        }
      } catch (err) {
        result.errores.push({
          fila: rowNumber,
          motivo: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    }

    return result;
  }
}
