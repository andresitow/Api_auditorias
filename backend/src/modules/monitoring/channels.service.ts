import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { ChannelEventPayload, ChannelInfo } from './types';

@Injectable()
export class ChannelsService {
  readonly events$ = new Subject<MessageEvent>();
  private readonly channels = new Map<string, ChannelInfo>();

  constructor(private readonly prisma: PrismaService) {}

  getAll(): ChannelInfo[] {
    return [...this.channels.values()];
  }

  get(id: string): ChannelInfo | undefined {
    return this.channels.get(id);
  }

  registerInMemory(info: ChannelInfo) {
    this.channels.set(info.id, info);
  }

  removeInMemory(id: string) {
    this.channels.delete(id);
  }

  async createChannelRow(dto: CreateChannelDto): Promise<ChannelInfo> {
    const config = await this.prisma.monitorConfig.findUnique({
      where: { id: 1 },
    });
    const row = await this.prisma.channel.create({
      data: {
        name: dto.name,
        host: dto.host,
        umbralMs: config?.umbralMs ?? 100,
      },
    });
    return {
      id: row.id,
      nombre: row.name,
      host: row.host,
      umbral: row.umbralMs,
    };
  }

  async deleteChannelRow(id: string) {
    await this.prisma.channel.delete({ where: { id } }).catch(() => undefined);
  }

  async getConfig() {
    return this.prisma.monitorConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  }

  async updateConfig(dto: UpdateConfigDto) {
    return this.prisma.monitorConfig.upsert({
      where: { id: 1 },
      update: { ...dto },
      create: { id: 1, ...dto },
    });
  }

  async setUmbralOnAllChannels(umbralMs: number) {
    await this.prisma.channel.updateMany({ data: { umbralMs } });
    for (const info of this.channels.values()) info.umbral = umbralMs;
  }

  broadcast(payload: ChannelEventPayload) {
    this.events$.next({ data: payload });
  }

  broadcastRemoved(id: string) {
    this.events$.next({ data: { accion: 'quitar', id } });
  }

  async persistSample(
    channelId: string,
    latencyMs: number | null,
    lost: boolean,
    raw: string,
  ) {
    await this.prisma.pingSample
      .create({ data: { channelId, latencyMs, lost, rawOutput: raw } })
      .catch(() => undefined);
  }

  async persistAlert(
    channelId: string,
    type: string,
    severity: string,
    message: string,
    startedAt: Date,
    endedAt?: Date,
    durationSec?: number,
  ) {
    await this.prisma.alertEvent
      .create({
        data: {
          channelId,
          type,
          severity,
          message,
          startedAt,
          endedAt,
          durationSec,
        },
      })
      .catch(() => undefined);
  }

  listAlerts(channelId: string, limit = 300) {
    return this.prisma.alertEvent.findMany({
      where: { channelId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }
}
