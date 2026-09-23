import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityHistory,
  EstadoActividad,
  Frecuencia,
  Prisma,
} from '@prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivitiesService } from './activities.service';
import { HistoryService, HistoryActor } from './history.service';
import { FilterOccurrencesDto } from './dto/filter-occurrences.dto';
import { UpdateOccurrenceEstadoDto } from './dto/update-occurrence-estado.dto';
import { ReprogramOccurrenceDto } from './dto/reprogram-occurrence.dto';
import { EditFechaOccurrenceDto } from './dto/edit-fecha-occurrence.dto';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { DeleteOccurrenceDto } from './dto/delete-occurrence.dto';
import {
  EVIDENCIA_IMAGENES_DIR,
  EVIDENCIA_IMAGENES_URL_PREFIX,
} from './evidencia-upload.config';

const DUE_SOON_HORIZON_DAYS = 7;

@Injectable()
export class OccurrencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activitiesService: ActivitiesService,
    private readonly history: HistoryService,
  ) {}

  list(auditoriaId: string, filters: FilterOccurrencesDto) {
    return this.prisma.activityOccurrence.findMany({
      where: this.buildListWhere(auditoriaId, filters),
      include: { activity: true, evidencias: true },
      orderBy: { fechaProgramada: 'asc' },
    });
  }

  /** Traduce los filtros del listado a un `where` de Prisma (sin acceso a base de datos). */
  private buildListWhere(
    auditoriaId: string,
    filters: FilterOccurrencesDto,
  ): Prisma.ActivityOccurrenceWhereInput {
    const anio = filters.anio ?? new Date().getFullYear();
    const now = new Date();
    const dueSoonLimit = new Date(
      now.getTime() + DUE_SOON_HORIZON_DAYS * 86_400_000,
    );

    return {
      periodo: filters.periodo ? filters.periodo : { startsWith: String(anio) },
      estado: filters.estado || undefined,
      activity: {
        auditoriaId,
        activa: true,
        categoria: filters.categoria || undefined,
        frecuencia: filters.frecuencia || undefined,
        responsable: filters.responsable
          ? { contains: filters.responsable, mode: 'insensitive' }
          : undefined,
        ...(filters.q
          ? {
              OR: [
                { nombre: { contains: filters.q, mode: 'insensitive' } },
                { responsable: { contains: filters.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      ...(filters.fechaDesde || filters.fechaHasta
        ? {
            fechaProgramada: {
              gte: filters.fechaDesde
                ? new Date(filters.fechaDesde)
                : undefined,
              lte: filters.fechaHasta
                ? new Date(filters.fechaHasta)
                : undefined,
            },
          }
        : {}),
      ...(filters.overdue
        ? { estado: EstadoActividad.PLANEADO, fechaProgramada: { lt: now } }
        : {}),
      ...(filters.dueSoon
        ? {
            estado: EstadoActividad.PLANEADO,
            fechaProgramada: { gte: now, lte: dueSoonLimit },
          }
        : {}),
    };
  }

  async getDetail(auditoriaId: string, id: string) {
    const occurrence = await this.prisma.activityOccurrence.findFirst({
      where: { id, activity: { auditoriaId } },
      include: { activity: true, evidencias: true },
    });
    if (!occurrence) throw new NotFoundException('Ocurrencia no encontrada');
    return occurrence;
  }

  async changeEstado(
    auditoriaId: string,
    id: string,
    dto: UpdateOccurrenceEstadoDto,
    actor: HistoryActor,
    evidencias?: Express.Multer.File[],
  ) {
    const before = await this.prisma.activityOccurrence.findFirst({
      where: { id, activity: { auditoriaId } },
      include: { evidencias: true },
    });
    if (!before) throw new NotFoundException('Ocurrencia no encontrada');

    const idsAEliminar =
      dto.eliminarEvidenciaIds?.filter((evId) =>
        before.evidencias.some((ev) => ev.id === evId),
      ) ?? [];

    // Si el nuevo estado no es EJECUTADO, fechaEjecucion no cambia (antes se le
    // pasaba `dto.fechaEjecucion ?? null` al historial en ese caso, que es distinto
    // de `before.fechaEjecucion`: registraba un cambio a fechaEjecucion que en
    // realidad nunca se escribió en la ocurrencia).
    if (dto.estado === EstadoActividad.EJECUTADO && !dto.fechaEjecucion) {
      throw new BadRequestException(
        'fechaEjecucion es obligatoria cuando el estado es EJECUTADO',
      );
    }
    const nuevaFechaEjecucion =
      dto.estado === EstadoActividad.EJECUTADO
        ? new Date(dto.fechaEjecucion!)
        : before.fechaEjecucion;

    const data: Prisma.ActivityOccurrenceUpdateInput = {
      estado: dto.estado,
      observaciones: dto.observaciones,
      evidenciaUrl: dto.evidenciaUrl,
      evidenciaDescripcion: dto.evidenciaDescripcion,
      updatedBy: actor.userId,
      fechaEjecucion: nuevaFechaEjecucion,
    };

    if (idsAEliminar.length) {
      data.evidencias = { deleteMany: { id: { in: idsAEliminar } } };
    }
    if (evidencias?.length) {
      data.evidencias = {
        ...(data.evidencias as object),
        create: evidencias.map((file) => ({
          url: `${EVIDENCIA_IMAGENES_URL_PREFIX}/${file.filename}`,
          nombreOriginal: file.originalname,
          mimeType: file.mimetype,
          tamano: file.size,
          createdBy: actor.userId,
        })),
      };
    }

    const occurrence = await this.prisma.activityOccurrence.update({
      where: { id },
      data,
      include: { evidencias: true },
    });

    if (idsAEliminar.length) {
      const borrados = before.evidencias.filter((ev) =>
        idsAEliminar.includes(ev.id),
      );
      await Promise.all(
        borrados.map((ev) => this.deleteEvidenciaImagenFile(ev.url)),
      );
    }

    await this.history.logFieldDiffs(
      { occurrenceId: id },
      'estado_cambiado',
      actor,
      {
        estado: before.estado,
        observaciones: before.observaciones,
        fechaEjecucion: before.fechaEjecucion?.toISOString() ?? null,
      },
      {
        estado: dto.estado,
        observaciones: dto.observaciones,
        fechaEjecucion: nuevaFechaEjecucion?.toISOString() ?? null,
      },
    );
    return occurrence;
  }

  async reprogram(
    auditoriaId: string,
    id: string,
    dto: ReprogramOccurrenceDto,
    actor: HistoryActor,
  ) {
    const before = await this.findOccurrenceOrThrow(auditoriaId, id);

    const nuevaFecha = new Date(dto.nuevaFecha);
    const occurrence = await this.prisma.activityOccurrence.update({
      where: { id },
      data: {
        fechaProgramada: nuevaFecha,
        estado: EstadoActividad.REPROGRAMADO,
        reprogramaciones: { increment: 1 },
        updatedBy: actor.userId,
      },
    });
    await this.history.logOccurrence(
      id,
      'reprogramado',
      actor,
      dto.motivo,
      before.fechaProgramada.toISOString().slice(0, 10),
      dto.nuevaFecha,
    );
    return occurrence;
  }

  /** Corrige la fecha programada de una ocurrencia sin la formalidad de "reprogramar"
   * (no exige motivo, no cambia el estado ni incrementa el contador de reprogramaciones):
   * pensado para arreglar fechas mal calculadas o mal transcritas, no para registrar un
   * evento de negocio. Reinicia `notificadoDias` para que las notificaciones recalculen
   * los umbrales de anticipación sobre la nueva fecha. */
  async editarFecha(
    auditoriaId: string,
    id: string,
    dto: EditFechaOccurrenceDto,
    actor: HistoryActor,
  ) {
    const before = await this.findOccurrenceOrThrow(auditoriaId, id);

    const occurrence = await this.prisma.activityOccurrence.update({
      where: { id },
      data: {
        fechaProgramada: new Date(dto.fechaProgramada),
        notificadoDias: [],
        updatedBy: actor.userId,
      },
    });
    await this.history.logOccurrence(
      id,
      'fecha_editada',
      actor,
      'fechaProgramada',
      before.fechaProgramada.toISOString().slice(0, 10),
      dto.fechaProgramada,
    );
    return occurrence;
  }

  async getHistory(auditoriaId: string, id: string) {
    await this.getDetail(auditoriaId, id);
    return this.history.listForOccurrence(id);
  }

  /** Borra una única ocurrencia (una fecha/periodo puntual), sin tocar el resto de
   * ocurrencias de la misma actividad ni la actividad en sí — a diferencia de
   * ActivitiesService.deactivate, que elimina/desactiva la actividad completa. Esto
   * es lo que corresponde cuando varias ocurrencias comparten nombre de actividad
   * (p.ej. una recurrente con una fila por mes, o una A_DEMANDA con varios eventos
   * en el año) y el usuario solo quiere sacar una fecha puntual, no todas.
   *
   * Antes de borrar de verdad se guarda una foto en DeletedActivity (motivo dado por
   * el usuario + el historial de la ocurrencia ya congelado en JSON, porque
   * ActivityHistory.occurrenceId tiene onDelete: Cascade y desaparecería junto con la
   * ocurrencia) — es lo que alimenta "Actividades eliminadas" en el submenú, con
   * purga automática pasados 30 días (ver DeletedActivitiesService).
   *
   * El historial de la ocurrencia también se registra contra la actividad (no la
   * ocurrencia) para que quede en la línea de tiempo de la actividad aunque siga viva.
   *
   * Si esta era la última ocurrencia que le quedaba a la actividad, se delega en
   * ActivitiesService.deactivate para que la actividad no quede huérfana sin
   * ninguna ocurrencia (misma regla: se borra si nunca tuvo seguimiento, o se
   * desactiva conservando historial si ya lo tuvo).
   *
   * La foto en DeletedActivity, el registro de auditoría y el borrado real van en un
   * único `$transaction`: hacerlos como tres escrituras sueltas dejaba una ventana
   * donde, si el borrado fallaba después de crear la foto (o al revés), la ocurrencia
   * quedaba fantasma — visible en la papelera y en el plan de trabajo a la vez, o
   * borrada sin haber quedado nunca archivada. */
  async remove(
    auditoriaId: string,
    id: string,
    dto: DeleteOccurrenceDto,
    actor: HistoryActor,
  ) {
    const occurrence = await this.prisma.activityOccurrence.findFirst({
      where: { id, activity: { auditoriaId } },
      include: {
        evidencias: true,
        activity: { include: { _count: { select: { occurrences: true } } } },
      },
    });
    if (!occurrence) throw new NotFoundException('Ocurrencia no encontrada');

    const esUltimaOcurrencia = occurrence.activity._count.occurrences === 1;
    const historialPrevio = await this.history.listForOccurrence(id);

    await this.prisma.$transaction([
      this.prisma.deletedActivity.create({
        data: this.buildDeletedActivityData(
          auditoriaId,
          occurrence,
          dto.motivo,
          historialPrevio,
          actor,
        ),
      }),
      this.prisma.activityHistory.create({
        data: {
          activityId: occurrence.activityId,
          action: 'ocurrencia_eliminada',
          campo: 'periodo',
          valorAnterior: occurrence.periodo,
          userId: actor.userId,
          username: actor.username,
        },
      }),
      this.prisma.activityOccurrence.delete({ where: { id } }),
    ]);

    await Promise.all(
      occurrence.evidencias.map((ev) => this.deleteEvidenciaImagenFile(ev.url)),
    );

    if (!esUltimaOcurrencia) return { ok: true, actividadEliminada: false };

    const { eliminada } = await this.activitiesService.deactivate(
      auditoriaId,
      occurrence.activityId,
      actor,
    );
    return { ok: true, actividadEliminada: eliminada };
  }

  /** Arma los datos de la foto para DeletedActivity — puro, sin acceso a base de
   * datos, para poder incluirlo tal cual dentro del `$transaction` de `remove()`. */
  private buildDeletedActivityData(
    auditoriaId: string,
    occurrence: Prisma.ActivityOccurrenceGetPayload<{
      include: { activity: true };
    }>,
    motivo: string,
    historial: ActivityHistory[],
    actor: HistoryActor,
  ): Prisma.DeletedActivityUncheckedCreateInput {
    return {
      auditoriaId,
      categoria: occurrence.activity.categoria,
      nombre: occurrence.activity.nombre,
      responsable: occurrence.activity.responsable,
      frecuencia: occurrence.activity.frecuencia,
      periodo: occurrence.periodo,
      fechaProgramada: occurrence.fechaProgramada,
      motivo,
      historial: historial.map((h) => ({
        action: h.action,
        campo: h.campo,
        valorAnterior: h.valorAnterior,
        valorNuevo: h.valorNuevo,
        username: h.username,
        createdAt: h.createdAt.toISOString(),
      })),
      eliminadoPor: actor.userId,
      eliminadoPorUsername: actor.username,
    };
  }

  async createAdHoc(
    auditoriaId: string,
    dto: CreateOccurrenceDto,
    actor: HistoryActor,
  ) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: dto.activityId, auditoriaId },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    if (
      activity.frecuencia !== Frecuencia.A_DEMANDA &&
      activity.frecuencia !== Frecuencia.CUANDO_SE_REQUIERA
    ) {
      throw new BadRequestException(
        'Solo se pueden registrar ocurrencias manuales para actividades A demanda o Cuando se requiera',
      );
    }
    const fecha = new Date(dto.fechaProgramada);
    const periodo = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}-${Math.random().toString(36).slice(2, 8)}`;
    const occurrence = await this.prisma.activityOccurrence.create({
      data: {
        activityId: dto.activityId,
        periodo,
        fechaProgramada: fecha,
        observaciones: dto.observaciones,
        createdBy: actor.userId,
      },
    });
    await this.history.logOccurrence(occurrence.id, 'creado', actor);
    return occurrence;
  }

  /** Busca una ocurrencia dentro de la auditoría dada, sin relaciones adicionales
   * (usado por los endpoints que solo necesitan sus propios campos: reprogramar,
   * corregir fecha). Los que sí necesitan `include` (evidencias, actividad) lo piden
   * inline porque cada uno varía. */
  private async findOccurrenceOrThrow(auditoriaId: string, id: string) {
    const occurrence = await this.prisma.activityOccurrence.findFirst({
      where: { id, activity: { auditoriaId } },
    });
    if (!occurrence) throw new NotFoundException('Ocurrencia no encontrada');
    return occurrence;
  }

  /** Borra del disco una imagen de evidencia ya reemplazada o eliminada; ignora si el archivo no existe. */
  private async deleteEvidenciaImagenFile(evidenciaImagenUrl: string) {
    const filename = evidenciaImagenUrl.split('/').pop();
    if (!filename) return;
    try {
      await unlink(join(EVIDENCIA_IMAGENES_DIR, filename));
    } catch {
      // el archivo ya no existe o no se pudo borrar: no es crítico para la operación
    }
  }
}
