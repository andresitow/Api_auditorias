import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/** Cuántos días queda visible una actividad eliminada en la papelera antes de purgarse
 * en definitiva (ver DeletedActivity en schema.prisma). */
export const RETENTION_DAYS = 30;

@Injectable()
export class DeletedActivitiesService {
  private readonly logger = new Logger(DeletedActivitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Lista la papelera de una auditoría. Purga primero lo vencido (misma estrategia
   * perezosa que el cron de abajo, para que quede consistente aunque el cron todavía
   * no haya corrido) y calcula cuántos días le quedan a cada fila antes de esa purga. */
  async list(auditoriaId: string) {
    await this.purgeVencidas();

    const rows = await this.prisma.deletedActivity.findMany({
      where: { auditoriaId },
      orderBy: { eliminadoEn: 'desc' },
    });

    return rows.map((row) => ({
      ...row,
      diasRestantes: Math.max(
        0,
        RETENTION_DAYS -
          Math.floor(
            (Date.now() - row.eliminadoEn.getTime()) / (24 * 60 * 60 * 1000),
          ),
      ),
    }));
  }

  private purgeVencidas() {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    return this.prisma.deletedActivity.deleteMany({
      where: { eliminadoEn: { lt: cutoff } },
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeOldDeletedActivities() {
    const { count } = await this.purgeVencidas();
    if (count > 0)
      this.logger.log(
        `Purgadas ${count} actividades de la papelera con más de ${RETENTION_DAYS} días`,
      );
  }
}
