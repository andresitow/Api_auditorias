import { Logger } from '@nestjs/common';
import {
  DeletedActivitiesService,
  RETENTION_DAYS,
} from './deleted-activities.service';

const NOW = new Date('2026-06-15T12:00:00Z');
const DAY = 86_400_000;

function build() {
  const prisma = {
    deletedActivity: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new DeletedActivitiesService(prisma as any);
  return { service, prisma };
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('DeletedActivitiesService', () => {
  it('la retención es de 30 días', () => {
    expect(RETENTION_DAYS).toBe(30);
  });

  describe('list', () => {
    it('purga primero lo vencido (eliminadoEn < ahora - 30 días) y después lista', async () => {
      const { service, prisma } = build();
      const order: string[] = [];
      prisma.deletedActivity.deleteMany.mockImplementation(async () => {
        order.push('purge');
        return { count: 0 };
      });
      prisma.deletedActivity.findMany.mockImplementation(async () => {
        order.push('find');
        return [];
      });

      await service.list('aud-1');

      expect(order).toEqual(['purge', 'find']);
      expect(prisma.deletedActivity.deleteMany).toHaveBeenCalledWith({
        where: { eliminadoEn: { lt: new Date(NOW.getTime() - 30 * DAY) } },
      });
      expect(prisma.deletedActivity.findMany).toHaveBeenCalledWith({
        where: { auditoriaId: 'aud-1' },
        orderBy: { eliminadoEn: 'desc' },
      });
    });

    it.each([
      [0, 30], // eliminada hoy
      [1, 29],
      [10, 20],
      [29, 1],
      [30, 0],
      [45, 0], // nunca negativo (cron aún no corrió)
    ])('eliminada hace %i días => diasRestantes %i', async (dias, esperado) => {
      const { service, prisma } = build();
      prisma.deletedActivity.findMany.mockResolvedValue([
        { id: 'd1', eliminadoEn: new Date(NOW.getTime() - dias * DAY) },
      ]);
      const [row] = await service.list('aud-1');
      expect(row.diasRestantes).toBe(esperado);
    });

    it('usa días completos transcurridos (Math.floor): 1.9 días => 29 restantes', async () => {
      const { service, prisma } = build();
      prisma.deletedActivity.findMany.mockResolvedValue([
        { id: 'd1', eliminadoEn: new Date(NOW.getTime() - 1.9 * DAY) },
      ]);
      const [row] = await service.list('aud-1');
      expect(row.diasRestantes).toBe(29);
    });

    it('conserva los demás campos de la fila', async () => {
      const { service, prisma } = build();
      const eliminadoEn = new Date(NOW.getTime() - 2 * DAY);
      prisma.deletedActivity.findMany.mockResolvedValue([
        { id: 'd1', nombre: 'X', motivo: 'm', eliminadoEn },
      ]);
      const [row] = await service.list('aud-1');
      expect(row).toMatchObject({ id: 'd1', nombre: 'X', motivo: 'm', eliminadoEn });
    });
  });

  describe('purgeOldDeletedActivities (cron)', () => {
    it('purga con el mismo corte de 30 días', async () => {
      const { service, prisma } = build();
      await service.purgeOldDeletedActivities();
      expect(prisma.deletedActivity.deleteMany).toHaveBeenCalledWith({
        where: { eliminadoEn: { lt: new Date(NOW.getTime() - 30 * DAY) } },
      });
    });

    it('loguea solo cuando purgó algo', async () => {
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      const { service, prisma } = build();

      await service.purgeOldDeletedActivities();
      expect(log).not.toHaveBeenCalled();

      prisma.deletedActivity.deleteMany.mockResolvedValue({ count: 3 });
      await service.purgeOldDeletedActivities();
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0][0]).toContain('3');
    });
  });
});
