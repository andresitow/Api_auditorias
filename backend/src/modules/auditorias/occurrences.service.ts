import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoActividad, Frecuencia, Prisma } from '@prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { HistoryService, HistoryActor } from './history.service';
import { FilterOccurrencesDto } from './dto/filter-occurrences.dto';
import { UpdateOccurrenceEstadoDto } from './dto/update-occurrence-estado.dto';
import { ReprogramOccurrenceDto } from './dto/reprogram-occurrence.dto';
import { EditFechaOccurrenceDto } from './dto/edit-fecha-occurrence.dto';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { EVIDENCIA_IMAGENES_DIR, EVIDENCIA_IMAGENES_URL_PREFIX } from './evidencia-upload.config';

const DUE_SOON_HORIZON_DAYS = 7;

@Injectable()
export class OccurrencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: HistoryService,
  ) {}

  list(auditoriaId: string, filters: FilterOccurrencesDto) {
    const anio = filters.anio ?? new Date().getFullYear();
    const now = new Date();
    const dueSoonLimit = new Date(now.getTime() + DUE_SOON_HORIZON_DAYS * 86_400_000);

    const where: Prisma.ActivityOccurrenceWhereInput = {
      periodo: filters.periodo ? filters.periodo : { startsWith: String(anio) },
      estado: filters.estado || undefined,
      activity: {
        auditoriaId,
        activa: true,
        categoria: filters.categoria || undefined,
        frecuencia: filters.frecuencia || undefined,
        responsable: filters.responsable ? { contains: filters.responsable, mode: 'insensitive' } : undefined,
        ...(filters.q
          ? { OR: [{ nombre: { contains: filters.q, mode: 'insensitive' } }, { responsable: { contains: filters.q, mode: 'insensitive' } }] }
          : {}),
      },
      ...(filters.fechaDesde || filters.fechaHasta
        ? {
            fechaProgramada: {
              gte: filters.fechaDesde ? new Date(filters.fechaDesde) : undefined,
              lte: filters.fechaHasta ? new Date(filters.fechaHasta) : undefined,
            },
          }
        : {}),
      ...(filters.overdue ? { estado: EstadoActividad.PLANEADO, fechaProgramada: { lt: now } } : {}),
      ...(filters.dueSoon ? { estado: EstadoActividad.PLANEADO, fechaProgramada: { gte: now, lte: dueSoonLimit } } : {}),
    };

    return this.prisma.activityOccurrence.findMany({
      where,
      include: { activity: true, evidencias: true },
      orderBy: { fechaProgramada: 'asc' },
    });
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

    const idsAEliminar = dto.eliminarEvidenciaIds?.filter((evId) => before.evidencias.some((ev) => ev.id === evId)) ?? [];

    const data: Prisma.ActivityOccurrenceUpdateInput = {
      estado: dto.estado,
      observaciones: dto.observaciones,
      evidenciaUrl: dto.evidenciaUrl,
      evidenciaDescripcion: dto.evidenciaDescripcion,
      updatedBy: actor.userId,
      fechaEjecucion: dto.estado === EstadoActividad.EJECUTADO ? new Date(dto.fechaEjecucion!) : before.fechaEjecucion,
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

    const occurrence = await this.prisma.activityOccurrence.update({ where: { id }, data, include: { evidencias: true } });

    if (idsAEliminar.length) {
      const borrados = before.evidencias.filter((ev) => idsAEliminar.includes(ev.id));
      await Promise.all(borrados.map((ev) => this.deleteEvidenciaImagenFile(ev.url)));
    }

    await this.history.logFieldDiffs(
      { occurrenceId: id },
      'estado_cambiado',
      actor,
      { estado: before.estado, observaciones: before.observaciones, fechaEjecucion: before.fechaEjecucion?.toISOString() ?? null },
      { estado: dto.estado, observaciones: dto.observaciones, fechaEjecucion: dto.fechaEjecucion ?? null },
    );
    return occurrence;
  }

  async reprogram(auditoriaId: string, id: string, dto: ReprogramOccurrenceDto, actor: HistoryActor) {
    const before = await this.prisma.activityOccurrence.findFirst({ where: { id, activity: { auditoriaId } } });
    if (!before) throw new NotFoundException('Ocurrencia no encontrada');

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
  async editarFecha(auditoriaId: string, id: string, dto: EditFechaOccurrenceDto, actor: HistoryActor) {
    const before = await this.prisma.activityOccurrence.findFirst({ where: { id, activity: { auditoriaId } } });
    if (!before) throw new NotFoundException('Ocurrencia no encontrada');

    const occurrence = await this.prisma.activityOccurrence.update({
      where: { id },
      data: { fechaProgramada: new Date(dto.fechaProgramada), notificadoDias: [], updatedBy: actor.userId },
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

  async createAdHoc(auditoriaId: string, dto: CreateOccurrenceDto, actor: HistoryActor) {
    const activity = await this.prisma.activity.findFirst({ where: { id: dto.activityId, auditoriaId } });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    if (activity.frecuencia !== Frecuencia.A_DEMANDA && activity.frecuencia !== Frecuencia.CUANDO_SE_REQUIERA) {
      throw new BadRequestException('Solo se pueden registrar ocurrencias manuales para actividades A demanda o Cuando se requiera');
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
