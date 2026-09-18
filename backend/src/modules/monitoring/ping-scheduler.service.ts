import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChannelsService } from './channels.service';
import { hacerPing } from './ping.util';
import {
  AlarmEntry,
  ChannelEventPayload,
  ChannelInfo,
  ChannelRuntimeState,
  initRuntimeState,
} from './types';

const DEFAULT_CHANNELS = [
  { name: 'SINCO CLARO', host: 'claro.sincoerp.com' },
  { name: 'SINCO UNE', host: 'une.sincoerp.com' },
];

interface GlobalCfg {
  umbralMs: number;
  intervaloSeg: number;
  duracionPerdida: number;
  duracionLat: number;
}

@Injectable()
export class PingSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly state = new Map<string, ChannelRuntimeState>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private running = true;
  private cfg: GlobalCfg = { umbralMs: 100, intervaloSeg: 2, duracionPerdida: 30, duracionLat: 3 };

  constructor(
    private readonly prisma: PrismaService,
    private readonly channelsService: ChannelsService,
  ) {}

  async onModuleInit() {
    const cfgRow = await this.prisma.monitorConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    this.cfg = {
      umbralMs: cfgRow.umbralMs,
      intervaloSeg: cfgRow.intervaloSeg,
      duracionPerdida: cfgRow.duracionPerdida,
      duracionLat: cfgRow.duracionLat,
    };

    let channels = await this.prisma.channel.findMany({ where: { active: true } });
    if (channels.length === 0) {
      channels = await Promise.all(DEFAULT_CHANNELS.map((c) => this.prisma.channel.create({ data: c })));
    }

    for (const ch of channels) {
      const info: ChannelInfo = { id: ch.id, nombre: ch.name, host: ch.host, umbral: ch.umbralMs };
      this.channelsService.registerInMemory(info);
      this.startChannel(info);
    }
  }

  onModuleDestroy() {
    this.running = false;
    for (const timer of this.timers.values()) clearTimeout(timer);
  }

  getGlobalConfig(): GlobalCfg {
    return this.cfg;
  }

  applyConfigUpdate(partial: Partial<GlobalCfg>) {
    this.cfg = { ...this.cfg, ...partial };
    if (partial.umbralMs !== undefined) {
      for (const info of this.channelsService.getAll()) info.umbral = partial.umbralMs;
    }
  }

  startChannel(info: ChannelInfo) {
    this.state.set(info.id, initRuntimeState());
    void this.loop(info);
  }

  stopChannel(id: string) {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
    this.state.delete(id);
  }

  getSnapshot(info: ChannelInfo, tipo = 'snap'): ChannelEventPayload | null {
    const e = this.state.get(info.id);
    if (!e) return null;
    return this.buildPayload(info, e, tipo);
  }

  private async loop(info: ChannelInfo) {
    if (!this.running || !this.state.has(info.id)) return;
    const start = Date.now();
    await this.tick(info);
    const elapsed = Date.now() - start;
    const rest = Math.max(0, this.cfg.intervaloSeg * 1000 - elapsed);
    const timer = setTimeout(() => void this.loop(info), rest);
    this.timers.set(info.id, timer);
  }

  private async tick(info: ChannelInfo) {
    const e = this.state.get(info.id);
    if (!e) return;

    const { latencyMs, lost, raw } = await hacerPing(info.host);
    const ahora = new Date().toTimeString().slice(0, 8);
    const ts = Date.now();
    const u = info.umbral ?? this.cfg.umbralMs;
    const dp = this.cfg.duracionPerdida;
    const dl = this.cfg.duracionLat;
    const est = e.est;

    e.total += 1;
    e.pingRaw = raw;
    void this.channelsService.persistSample(info.id, latencyMs, lost, raw);

    if (lost) {
      e.perdidas += 1;
      e.actual = null;
      e.latencias.push(null);
    } else {
      e.actual = latencyMs;
      e.latencias.push(latencyMs);
    }
    if (e.latencias.length > 40) e.latencias.shift();
    if (e.alarmas.length > 300) e.alarmas.pop();

    const emit = (tipo: string, extra?: Partial<ChannelEventPayload>) =>
      this.channelsService.broadcast(this.buildPayload(info, e, tipo, extra));

    const registrar = async (
      motivo: string,
      tipo: string,
      severidad: AlarmEntry['severidad'],
      opts: { inicio?: string; fin?: string; segundos?: number } = {},
    ): Promise<AlarmEntry> => {
      const entry: AlarmEntry = { hora: ahora, motivo, tipo, severidad, ...opts };
      e.alarmas.unshift(entry);
      if (e.alarmas.length > 300) e.alarmas.pop();
      await this.channelsService.persistAlert(
        info.id,
        tipo,
        severidad,
        motivo,
        new Date(e.malDesde ?? ts),
        opts.fin ? new Date(ts) : undefined,
        opts.segundos,
      );
      return entry;
    };

    if (lost) {
      if (['estable', 'latencia_alta', 'alerta_lentitud', 'latencia_rec', 'canal_recuperado'].includes(est)) {
        e.est = 'perdida';
        e.malDesde = ts;
        e.horaIni = ahora;
        e.segs = 0;
        e.alarmaActiva = false;
        emit('perdida_inicio');
      } else if (est === 'perdida') {
        const s = Math.floor((ts - (e.malDesde ?? ts)) / 1000);
        e.segs = s;
        if (s >= dp) {
          e.est = 'alerta_critica';
          e.alarmaActiva = true;
          const a = await registrar(`Pérdida de paquetes ${s}s (desde ${e.horaIni})`, 'alerta_critica', 'critica', {
            inicio: e.horaIni ?? undefined,
          });
          emit('alerta_critica', { nueva_alarma: a });
        } else {
          emit('perdida_silenciosa');
        }
      } else if (est === 'alerta_critica') {
        e.segs = Math.floor((ts - (e.malDesde ?? ts)) / 1000);
        emit('alerta_critica_continua');
      }
    } else if (latencyMs !== null && latencyMs > u) {
      if (['estable', 'canal_recuperado', 'latencia_rec'].includes(est)) {
        e.est = 'latencia_alta';
        e.malDesde = ts;
        e.horaIni = ahora;
        e.segs = 0;
        emit('latencia_alta_inicio');
      } else if (est === 'latencia_alta') {
        const s = Math.floor((ts - (e.malDesde ?? ts)) / 1000);
        e.segs = s;
        if (s >= dl) {
          e.est = 'alerta_lentitud';
          const a = await registrar(
            `Latencia alta ${latencyMs.toFixed(1)}ms durante ${s}s (desde ${e.horaIni})`,
            'alerta_lentitud',
            'informativa',
            { inicio: e.horaIni ?? undefined },
          );
          emit('alerta_lentitud', { nueva_alarma: a });
        } else {
          emit('latencia_alta_silenciosa');
        }
      } else if (est === 'alerta_lentitud') {
        e.segs = Math.floor((ts - (e.malDesde ?? ts)) / 1000);
        emit('latencia_alta_silenciosa');
      } else if (est === 'perdida' || est === 'alerta_critica') {
        const s = Math.floor((ts - (e.malDesde ?? ts)) / 1000);
        if (e.alarmaActiva) {
          const a = await registrar(
            `Pérdida resuelta, latencia alta ${latencyMs.toFixed(1)}ms (caído ${s}s)`,
            'parcial',
            'informativa',
          );
          emit('parcial_recuperado', { nueva_alarma: a });
        }
        e.est = 'latencia_alta';
        e.malDesde = ts;
        e.horaIni = ahora;
        e.segs = 0;
        e.alarmaActiva = false;
      }
    } else {
      if (est === 'perdida' || est === 'alerta_critica') {
        const s = e.malDesde ? Math.floor((ts - e.malDesde) / 1000) : 0;
        const horaIni = e.horaIni;
        const a = await registrar(
          `Canal recuperado — pérdida resuelta en ${s}s (desde ${horaIni} hasta ${ahora})`,
          'canal_recuperado',
          'ok',
          { segundos: s, inicio: horaIni ?? undefined, fin: ahora },
        );
        e.est = 'canal_recuperado';
        e.malDesde = null;
        e.horaIni = null;
        e.segs = 0;
        e.alarmaActiva = false;
        emit('canal_recuperado', { nueva_alarma: a });
      } else if (est === 'latencia_alta' || est === 'alerta_lentitud') {
        const s = e.malDesde ? Math.floor((ts - e.malDesde) / 1000) : 0;
        const horaIni = e.horaIni;
        if (est === 'alerta_lentitud') {
          const a = await registrar(
            `Latencia recuperada en ${s}s (desde ${horaIni} hasta ${ahora})`,
            'latencia_rec',
            'ok',
            { segundos: s, inicio: horaIni ?? undefined, fin: ahora },
          );
          e.est = 'latencia_rec';
          emit('latencia_recuperada', { nueva_alarma: a });
        } else {
          e.est = 'estable';
          emit('estable');
        }
        e.malDesde = null;
        e.horaIni = null;
        e.segs = 0;
      } else if (est === 'latencia_rec' || est === 'canal_recuperado') {
        e.est = 'estable';
        emit('estable');
      } else {
        emit('estable');
      }
    }
  }

  private buildPayload(
    info: ChannelInfo,
    e: ChannelRuntimeState,
    tipo: string,
    extra?: Partial<ChannelEventPayload>,
  ): ChannelEventPayload {
    return {
      id: info.id,
      nombre: info.nombre,
      host: info.host,
      actual: e.actual,
      latencias: e.latencias,
      perdidas: e.perdidas,
      total: e.total,
      alarmas: e.alarmas,
      umbral: info.umbral,
      duracion_cfg: this.cfg.duracionPerdida,
      duracion_lat: this.cfg.duracionLat,
      segundos_malo: e.segs,
      hora_inicio_caida: e.horaIni,
      estado_actual: e.est,
      alarma_activa: e.alarmaActiva,
      ping_raw: e.pingRaw,
      tipo,
      ...extra,
    };
  }
}
