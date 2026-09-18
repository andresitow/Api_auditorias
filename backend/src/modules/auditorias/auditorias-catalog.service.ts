import { Injectable, NotFoundException } from '@nestjs/common';
import { EstadoActividad } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { HistoryActor } from './history.service';
import { CreateAuditoriaDto } from './dto/create-auditoria.dto';
import { UpdateAuditoriaDto } from './dto/update-auditoria.dto';

@Injectable()
export class AuditoriasCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** 3 consultas en total, sin importar cuántas auditorías existan (antes eran 1 + 2N:
   * una por auditoría para contar actividades y otra para traer sus ocurrencias). */
  async list() {
    const anio = new Date().getFullYear();

    const [auditorias, actividadesPorAuditoria, occurrences] = await Promise.all([
      this.prisma.auditoria.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.activity.groupBy({ by: ['auditoriaId'], where: { activa: true }, _count: { _all: true } }),
      this.prisma.activityOccurrence.findMany({
        where: { periodo: { startsWith: String(anio) } },
        select: { estado: true, activity: { select: { auditoriaId: true } } },
      }),
    ]);

    const totalActividadesMap = new Map(actividadesPorAuditoria.map((a) => [a.auditoriaId, a._count._all]));
    const statsMap = new Map<string, { total: number; ejecutadas: number }>();
    for (const o of occurrences) {
      const stat = statsMap.get(o.activity.auditoriaId) ?? { total: 0, ejecutadas: 0 };
      stat.total += 1;
      if (o.estado === EstadoActividad.EJECUTADO) stat.ejecutadas += 1;
      statsMap.set(o.activity.auditoriaId, stat);
    }

    return auditorias.map((auditoria) => {
      const stat = statsMap.get(auditoria.id) ?? { total: 0, ejecutadas: 0 };
      const cumplimientoPct = stat.total === 0 ? 0 : Math.round((stat.ejecutadas / stat.total) * 100);
      return { ...auditoria, totalActividades: totalActividadesMap.get(auditoria.id) ?? 0, totalOcurrencias: stat.total, cumplimientoPct };
    });
  }

  async get(id: string) {
    const auditoria = await this.prisma.auditoria.findUnique({ where: { id } });
    if (!auditoria) throw new NotFoundException('Auditoría no encontrada');
    return auditoria;
  }

  create(dto: CreateAuditoriaDto, actor: HistoryActor) {
    return this.prisma.auditoria.create({
      data: { nombre: dto.nombre, descripcion: dto.descripcion, createdBy: actor.userId },
    });
  }

  async update(id: string, dto: UpdateAuditoriaDto) {
    await this.get(id);
    return this.prisma.auditoria.update({ where: { id }, data: dto });
  }
}
