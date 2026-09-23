import {
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  Param,
  Patch,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { concat, from, Observable } from 'rxjs';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { ChannelsService } from './channels.service';
import { PingSchedulerService } from './ping-scheduler.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateConfigDto } from './dto/update-config.dto';

@ApiTags('monitoreo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly scheduler: PingSchedulerService,
  ) {}

  @Get()
  list() {
    return this.channelsService.getAll();
  }

  @Get('config')
  getConfig() {
    return this.channelsService.getConfig();
  }

  @Patch('config')
  async updateConfig(@Body() dto: UpdateConfigDto) {
    const cfg = await this.channelsService.updateConfig(dto);
    this.scheduler.applyConfigUpdate(dto);
    if (dto.umbralMs !== undefined)
      await this.channelsService.setUmbralOnAllChannels(dto.umbralMs);
    for (const info of this.channelsService.getAll()) {
      const snap = this.scheduler.getSnapshot(info, 'config_update');
      if (snap) this.channelsService.broadcast(snap);
    }
    return cfg;
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.channelsService.listAlerts(id);
  }

  @Post()
  async create(@Body() dto: CreateChannelDto) {
    const info = await this.channelsService.createChannelRow(dto);
    this.channelsService.registerInMemory(info);
    this.scheduler.startChannel(info);
    this.channelsService.broadcast({
      id: info.id,
      nombre: info.nombre,
      host: info.host,
      actual: null,
      latencias: [],
      perdidas: 0,
      total: 0,
      alarmas: [],
      umbral: info.umbral,
      duracion_cfg: this.scheduler.getGlobalConfig().duracionPerdida,
      duracion_lat: this.scheduler.getGlobalConfig().duracionLat,
      segundos_malo: 0,
      hora_inicio_caida: null,
      estado_actual: 'estable',
      alarma_activa: false,
      ping_raw: '',
      tipo: 'nuevo_canal',
    });
    return info;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    this.scheduler.stopChannel(id);
    this.channelsService.removeInMemory(id);
    await this.channelsService.deleteChannelRow(id);
    this.channelsService.broadcastRemoved(id);
    return { ok: true };
  }

  @Sse('events')
  events(): Observable<MessageEvent> {
    const snapshots = this.channelsService
      .getAll()
      .map((info) => this.scheduler.getSnapshot(info, 'snap'))
      .filter((snap): snap is NonNullable<typeof snap> => snap !== null)
      .map((data) => ({ data }));

    return concat(from(snapshots), this.channelsService.events$);
  }
}
