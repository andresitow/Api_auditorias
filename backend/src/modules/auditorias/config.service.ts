import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAuditoriaConfigDto } from './dto/update-config.dto';

@Injectable()
export class AuditoriaConfigService {
  constructor(private readonly prisma: PrismaService) {}

  get() {
    return this.prisma.auditoriaConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  }

  update(dto: UpdateAuditoriaConfigDto) {
    return this.prisma.auditoriaConfig.upsert({
      where: { id: 1 },
      update: { ...dto },
      create: { id: 1, ...dto },
    });
  }
}
