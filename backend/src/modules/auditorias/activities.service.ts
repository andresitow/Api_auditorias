import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Activity, Frecuencia, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OccurrenceGenerationService } from './occurrence-generation.service';
import { HistoryService, HistoryActor } from './history.service';
import { CATEGORIAS_AUDITORIA, CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { FilterActivitiesDto } from './dto/filter-activities.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generation: OccurrenceGenerationService,
    private readonly history: HistoryService,
  ) {}

  list(auditoriaId: string, filters: FilterActivitiesDto) {
    const where: Prisma.ActivityWhereInput = {
      auditoriaId,
      categoria: filters.categoria || undefined,
      responsable: filters.responsable ? { contains: filters.responsable, mode: 'insensitive' } : undefined,
      frecuencia: filters.frecuencia || undefined,
      activa: filters.activa ?? undefined,
      ...(filters.q
        ? {
            OR: [
              { nombre: { contains: filters.q, mode: 'insensitive' } },
              { descripcionEvidencia: { contains: filters.q, mode: 'insensitive' } },
              { responsable: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.activity.findMany({ where, orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }] });
  }

  async distinctCategorias(auditoriaId: string) {
    const rows = await this.prisma.activity.findMany({
      where: { auditoriaId },
      distinct: ['categoria'],
      select: { categoria: true },
      orderBy: { categoria: 'asc' },
    });
    const categorias = new Set<string>(CATEGORIAS_AUDITORIA);
    for (const r of rows) categorias.add(r.categoria);
    return [...categorias].sort((a, b) => a.localeCompare(b));
  }

  async getWithOccurrences(auditoriaId: string, id: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id, auditoriaId },
      include: { occurrences: { orderBy: { fechaProgramada: 'asc' } } },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    return activity;
  }

  /** UNICA no se genera por año calendario (periodsForYear devuelve []): se crea una
   * sola ocurrencia con la fecha específica indicada por el usuario. Para el resto de
   * frecuencias, `fechaInicio` (opcional) evita generar de entrada periodos anteriores
   * a esa fecha (ver `OccurrenceGenerationService.generateForYear`). */
  private async ensureOccurrences(activity: Activity, fechaEspecifica?: string, fechaInicio?: string) {
    if (activity.frecuencia !== Frecuencia.UNICA) {
      await this.generation.generateForYear(activity, new Date().getFullYear(), fechaInicio ? new Date(fechaInicio) : undefined);
      return;
    }
    if (!fechaEspecifica) return;
    const fecha = new Date(fechaEspecifica);
    const periodo = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}-${String(fecha.getUTCDate()).padStart(2, '0')}-unica`;
    await this.prisma.activityOccurrence.upsert({
      where: { activityId_periodo: { activityId: activity.id, periodo } },
      update: {},
      create: { activityId: activity.id, periodo, fechaProgramada: fecha, observaciones: activity.observacion },
    });
  }

  async create(auditoriaId: string, dto: CreateActivityDto, actor: HistoryActor) {
    const activity = await this.prisma.activity.create({
      data: {
        auditoriaId,
        categoria: dto.categoria,
        nombre: dto.nombre,
        descripcionEvidencia: dto.descripcionEvidencia,
        observacion: dto.observacion,
        responsable: dto.responsable,
        frecuencia: dto.frecuencia,
        activa: dto.activa ?? true,
        createdBy: actor.userId,
      },
    });
    await this.history.logActivity(activity.id, 'creado', actor);
    await this.ensureOccurrences(activity, dto.fechaEspecifica, dto.fechaInicio);
    return this.getWithOccurrences(auditoriaId, activity.id);
  }

  async update(auditoriaId: string, id: string, dto: UpdateActivityDto, actor: HistoryActor) {
    const before = await this.prisma.activity.findFirst({ where: { id, auditoriaId } });
    if (!before) throw new NotFoundException('Actividad no encontrada');

    const { fechaEspecifica, fechaInicio, ...data } = dto;
    const activity = await this.prisma.activity.update({ where: { id }, data });
    await this.history.logFieldDiffs({ activityId: id }, 'editado', actor, before, dto as Record<string, unknown>);

    if (dto.frecuencia && dto.frecuencia !== before.frecuencia) {
      await this.ensureOccurrences(activity, fechaEspecifica, fechaInicio);
    }
    if (dto.activa === true && before.activa === false) {
      await this.ensureOccurrences(activity, fechaEspecifica, fechaInicio);
    }
    return this.getWithOccurrences(auditoriaId, id);
  }

  async deactivate(auditoriaId: string, id: string, actor: HistoryActor) {
    const activity = await this.prisma.activity.findFirst({
      where: { id, auditoriaId },
      include: { _count: { select: { occurrences: true } } },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');

    if (activity._count.occurrences === 0) {
      await this.prisma.activity.delete({ where: { id } });
      return { ok: true, eliminada: true };
    }
    await this.prisma.activity.update({ where: { id }, data: { activa: false } });
    await this.history.logActivity(id, 'editado', actor, 'activa', 'true', 'false');
    return { ok: true, eliminada: false };
  }

  async generateForYear(auditoriaId: string, id: string, anio: number) {
    const activity = await this.prisma.activity.findFirst({ where: { id, auditoriaId } });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    if (anio < 2000 || anio > 2100) throw new BadRequestException('Año inválido');
    return this.generation.generateForYear(activity, anio);
  }
}
