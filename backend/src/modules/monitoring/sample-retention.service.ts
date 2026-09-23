import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

const RETENTION_DAYS = 3;

@Injectable()
export class SampleRetentionService {
  private readonly logger = new Logger(SampleRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeOldSamples() {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.pingSample.deleteMany({
      where: { takenAt: { lt: cutoff } },
    });
    if (count > 0)
      this.logger.log(
        `Purgadas ${count} muestras de ping anteriores a ${cutoff.toISOString()}`,
      );
  }
}
