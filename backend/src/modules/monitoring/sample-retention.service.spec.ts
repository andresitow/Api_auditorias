import { Logger } from '@nestjs/common';
import { SampleRetentionService } from './sample-retention.service';

const NOW = new Date('2026-06-15T03:00:00Z');
const DAY = 86_400_000;

function build(count = 0) {
  const prisma = {
    pingSample: { deleteMany: jest.fn().mockResolvedValue({ count }) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: new SampleRetentionService(prisma as any), prisma };
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('SampleRetentionService.purgeOldSamples', () => {
  it('borra las muestras con takenAt anterior a 3 días', async () => {
    const { service, prisma } = build();
    await service.purgeOldSamples();
    expect(prisma.pingSample.deleteMany).toHaveBeenCalledWith({
      where: { takenAt: { lt: new Date(NOW.getTime() - 3 * DAY) } },
    });
  });

  it('loguea solo si borró algo', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const vacio = build(0);
    await vacio.service.purgeOldSamples();
    expect(log).not.toHaveBeenCalled();

    const conDatos = build(42);
    await conDatos.service.purgeOldSamples();
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain('42');
  });
});
