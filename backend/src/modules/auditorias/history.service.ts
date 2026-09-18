import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface HistoryActor {
  userId?: string;
  username?: string;
}

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  logActivity(activityId: string, action: string, actor: HistoryActor, campo?: string, valorAnterior?: string, valorNuevo?: string) {
    return this.prisma.activityHistory.create({
      data: { activityId, action, campo, valorAnterior, valorNuevo, userId: actor.userId, username: actor.username },
    });
  }

  logOccurrence(occurrenceId: string, action: string, actor: HistoryActor, campo?: string, valorAnterior?: string, valorNuevo?: string) {
    return this.prisma.activityHistory.create({
      data: { occurrenceId, action, campo, valorAnterior, valorNuevo, userId: actor.userId, username: actor.username },
    });
  }

  /** Compara `before`/`after` campo a campo y registra una fila de historial por cada diferencia. */
  async logFieldDiffs(
    target: { activityId?: string; occurrenceId?: string },
    action: string,
    actor: HistoryActor,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ) {
    const rows: { activityId?: string; occurrenceId?: string; action: string; campo: string; valorAnterior: string | null; valorNuevo: string | null; userId?: string; username?: string }[] = [];
    for (const campo of Object.keys(after)) {
      if (after[campo] === undefined) continue;
      const prev = before[campo];
      const next = after[campo];
      if (String(prev ?? '') === String(next ?? '')) continue;
      rows.push({
        ...target,
        action,
        campo,
        valorAnterior: prev === null || prev === undefined ? null : String(prev),
        valorNuevo: next === null || next === undefined ? null : String(next),
        userId: actor.userId,
        username: actor.username,
      });
    }
    if (rows.length === 0) return;
    await this.prisma.activityHistory.createMany({ data: rows });
  }

  listForActivity(activityId: string) {
    return this.prisma.activityHistory.findMany({ where: { activityId }, orderBy: { createdAt: 'desc' } });
  }

  listForOccurrence(occurrenceId: string) {
    return this.prisma.activityHistory.findMany({ where: { occurrenceId }, orderBy: { createdAt: 'desc' } });
  }
}
