import { PingSchedulerService } from './ping-scheduler.service';
import { hacerPing } from './ping.util';
import { ChannelInfo, ChannelRuntimeState, initRuntimeState } from './types';

jest.mock('./ping.util', () => ({ hacerPing: jest.fn() }));

const T0 = new Date('2026-06-15T12:00:00Z');
const info: ChannelInfo = { id: 'c1', nombre: 'Canal 1', host: 'h', umbral: 100 };

const OK = (ms: number) => ({ latencyMs: ms, lost: false, raw: `time=${ms}ms` });
const LOST = { latencyMs: null, lost: true, raw: 'timeout' };

function build() {
  const prisma = {
    monitorConfig: {
      upsert: jest.fn().mockResolvedValue({
        umbralMs: 100,
        intervaloSeg: 2,
        duracionPerdida: 30,
        duracionLat: 3,
      }),
    },
    channel: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: `id-${data.name}`,
        name: data.name,
        host: data.host,
        umbralMs: 100,
      })),
    },
  };
  const channels = {
    persistSample: jest.fn().mockResolvedValue(undefined),
    persistAlert: jest.fn().mockResolvedValue(undefined),
    broadcast: jest.fn(),
    registerInMemory: jest.fn(),
    getAll: jest.fn().mockReturnValue([]),
  };
  const service = new PingSchedulerService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channels as any,
  );
  // Registra el canal en el estado interno sin arrancar el bucle real.
  const state = (service as unknown as { state: Map<string, ChannelRuntimeState> }).state;
  state.set(info.id, initRuntimeState());
  const tick = (i: ChannelInfo = info) =>
    (service as unknown as { tick: (i: ChannelInfo) => Promise<void> }).tick(i);
  const est = () => state.get(info.id)!;
  const tipos = () =>
    channels.broadcast.mock.calls.map((c) => (c[0] as { tipo: string }).tipo);
  return { service, prisma, channels, tick, est, tipos, state };
}

/** Avanza el reloj simulado y ejecuta un tick con el resultado de ping dado. */
async function pasoPing(
  ctx: ReturnType<typeof build>,
  resultado: unknown,
  avanzaSeg = 0,
) {
  jest.setSystemTime(Date.now() + avanzaSeg * 1000);
  (hacerPing as jest.Mock).mockResolvedValueOnce(resultado);
  await ctx.tick();
}

beforeEach(() => {
  jest.useFakeTimers({ now: T0 });
  (hacerPing as jest.Mock).mockReset();
});
afterEach(() => jest.useRealTimers());

describe('PingSchedulerService.tick - estado estable', () => {
  it('ping normal bajo el umbral: cuenta, guarda muestra y emite "estable"', async () => {
    const ctx = build();
    await pasoPing(ctx, OK(20));
    expect(ctx.est()).toMatchObject({ total: 1, perdidas: 0, actual: 20, est: 'estable' });
    expect(ctx.est().latencias).toEqual([20]);
    expect(ctx.channels.persistSample).toHaveBeenCalledWith('c1', 20, false, 'time=20ms');
    expect(ctx.tipos()).toEqual(['estable']);
  });

  it('latencia exactamente igual al umbral NO es alta (comparación estricta >)', async () => {
    const ctx = build();
    await pasoPing(ctx, OK(100));
    expect(ctx.est().est).toBe('estable');
  });

  it('usa el umbral del canal, no el global', async () => {
    const ctx = build();
    (ctx.service as unknown as { cfg: { umbralMs: number } }).cfg.umbralMs = 10;
    await pasoPing(ctx, OK(50)); // info.umbral = 100 => no es alta
    expect(ctx.est().est).toBe('estable');
  });

  it('canal desconocido (sin estado) no hace nada', async () => {
    const ctx = build();
    await (ctx.service as unknown as { tick: (i: ChannelInfo) => Promise<void> }).tick({
      ...info,
      id: 'otro',
    });
    expect(hacerPing).not.toHaveBeenCalled();
  });

  it('mantiene solo las últimas 40 latencias', async () => {
    const ctx = build();
    for (let i = 1; i <= 45; i++) await pasoPing(ctx, OK(i));
    expect(ctx.est().latencias).toHaveLength(40);
    expect(ctx.est().latencias[0]).toBe(6);
    expect(ctx.est().latencias[39]).toBe(45);
    expect(ctx.est().total).toBe(45);
  });
});

describe('PingSchedulerService.tick - pérdida de paquetes', () => {
  it('primer paquete perdido: pasa a "perdida" y emite perdida_inicio (sin alarma)', async () => {
    const ctx = build();
    await pasoPing(ctx, LOST);
    expect(ctx.est()).toMatchObject({
      est: 'perdida',
      perdidas: 1,
      actual: null,
      alarmaActiva: false,
      segs: 0,
    });
    expect(ctx.est().malDesde).toBe(T0.getTime());
    expect(ctx.est().latencias).toEqual([null]);
    expect(ctx.tipos()).toEqual(['perdida_inicio']);
    expect(ctx.channels.persistAlert).not.toHaveBeenCalled();
  });

  it('pérdida sostenida por menos de duracionPerdida (30s): silenciosa, sin alarma', async () => {
    const ctx = build();
    await pasoPing(ctx, LOST);
    await pasoPing(ctx, LOST, 29);
    expect(ctx.est().est).toBe('perdida');
    expect(ctx.est().segs).toBe(29);
    expect(ctx.tipos()).toEqual(['perdida_inicio', 'perdida_silenciosa']);
    expect(ctx.channels.persistAlert).not.toHaveBeenCalled();
  });

  it('a los 30s escala a "alerta_critica" y registra alarma crítica persistida', async () => {
    const ctx = build();
    await pasoPing(ctx, LOST);
    await pasoPing(ctx, LOST, 30);
    expect(ctx.est()).toMatchObject({ est: 'alerta_critica', alarmaActiva: true });
    expect(ctx.est().alarmas).toHaveLength(1);
    expect(ctx.est().alarmas[0]).toMatchObject({
      tipo: 'alerta_critica',
      severidad: 'critica',
    });
    expect(ctx.est().alarmas[0].motivo).toContain('30s');
    expect(ctx.channels.persistAlert).toHaveBeenCalledWith(
      'c1',
      'alerta_critica',
      'critica',
      expect.stringContaining('Pérdida de paquetes 30s'),
      new Date(T0.getTime()), // startedAt = inicio de la caída
      undefined,
      undefined,
    );
    expect(ctx.tipos()).toEqual(['perdida_inicio', 'alerta_critica']);
    const payload = ctx.channels.broadcast.mock.calls[1][0];
    expect(payload.nueva_alarma).toBeDefined();
    expect(payload.alarma_activa).toBe(true);
  });

  it('en alerta crítica cada pérdida adicional emite "alerta_critica_continua" y NO duplica alarma', async () => {
    const ctx = build();
    await pasoPing(ctx, LOST);
    await pasoPing(ctx, LOST, 30);
    await pasoPing(ctx, LOST, 10);
    expect(ctx.est().segs).toBe(40);
    expect(ctx.est().alarmas).toHaveLength(1);
    expect(ctx.tipos()[2]).toBe('alerta_critica_continua');
  });

  it('respeta duracionPerdida configurada (p. ej. 5s)', async () => {
    const ctx = build();
    (ctx.service as unknown as { cfg: { duracionPerdida: number } }).cfg.duracionPerdida = 5;
    await pasoPing(ctx, LOST);
    await pasoPing(ctx, LOST, 5);
    expect(ctx.est().est).toBe('alerta_critica');
  });

  it('recuperación tras alerta crítica: alarma "canal_recuperado" (ok) con duración y limpia el estado', async () => {
    const ctx = build();
    await pasoPing(ctx, LOST);
    await pasoPing(ctx, LOST, 30);
    await pasoPing(ctx, OK(20), 15);
    expect(ctx.est()).toMatchObject({
      est: 'canal_recuperado',
      malDesde: null,
      horaIni: null,
      segs: 0,
      alarmaActiva: false,
    });
    const alarma = ctx.est().alarmas[0];
    expect(alarma).toMatchObject({
      tipo: 'canal_recuperado',
      severidad: 'ok',
      segundos: 45,
    });
    expect(alarma.fin).toBeDefined();
    expect(ctx.channels.persistAlert).toHaveBeenLastCalledWith(
      'c1',
      'canal_recuperado',
      'ok',
      expect.stringContaining('45s'),
      new Date(T0.getTime()),
      expect.any(Date), // endedAt (opts.fin presente)
      45,
    );
    expect(ctx.tipos().at(-1)).toBe('canal_recuperado');
  });

  it('recuperación tras pérdida corta (sin alerta crítica) TAMBIÉN registra "canal_recuperado"', async () => {
    const ctx = build();
    await pasoPing(ctx, LOST);
    await pasoPing(ctx, OK(20), 2);
    expect(ctx.est().est).toBe('canal_recuperado');
    expect(ctx.est().alarmas[0]).toMatchObject({ tipo: 'canal_recuperado', segundos: 2 });
  });

  it('tras canal_recuperado el siguiente ping bueno vuelve a "estable"', async () => {
    const ctx = build();
    await pasoPing(ctx, LOST);
    await pasoPing(ctx, OK(20), 1);
    await pasoPing(ctx, OK(20), 2);
    expect(ctx.est().est).toBe('estable');
    expect(ctx.tipos().at(-1)).toBe('estable');
  });

  it('pérdida desde canal_recuperado reinicia el ciclo de pérdida', async () => {
    const ctx = build();
    await pasoPing(ctx, LOST);
    await pasoPing(ctx, OK(20), 1);
    await pasoPing(ctx, LOST, 1);
    expect(ctx.est().est).toBe('perdida');
    expect(ctx.tipos().at(-1)).toBe('perdida_inicio');
  });

  it('cuenta perdidas y total acumulados', async () => {
    const ctx = build();
    await pasoPing(ctx, LOST);
    await pasoPing(ctx, OK(10), 1);
    await pasoPing(ctx, LOST, 1);
    expect(ctx.est()).toMatchObject({ total: 3, perdidas: 2 });
  });
});

describe('PingSchedulerService.tick - latencia alta', () => {
  it('primera medición sobre el umbral: "latencia_alta" (sin alarma)', async () => {
    const ctx = build();
    await pasoPing(ctx, OK(150));
    expect(ctx.est()).toMatchObject({ est: 'latencia_alta', segs: 0 });
    expect(ctx.tipos()).toEqual(['latencia_alta_inicio']);
    expect(ctx.channels.persistAlert).not.toHaveBeenCalled();
  });

  it('antes de duracionLat (3s): silenciosa', async () => {
    const ctx = build();
    await pasoPing(ctx, OK(150));
    await pasoPing(ctx, OK(150), 2);
    expect(ctx.est().est).toBe('latencia_alta');
    expect(ctx.tipos()).toEqual(['latencia_alta_inicio', 'latencia_alta_silenciosa']);
  });

  it('a los 3s escala a "alerta_lentitud" con alarma informativa', async () => {
    const ctx = build();
    await pasoPing(ctx, OK(150));
    await pasoPing(ctx, OK(180.44), 3);
    expect(ctx.est().est).toBe('alerta_lentitud');
    expect(ctx.est().alarmas[0]).toMatchObject({
      tipo: 'alerta_lentitud',
      severidad: 'informativa',
    });
    expect(ctx.est().alarmas[0].motivo).toContain('180.4ms');
    expect(ctx.channels.persistAlert).toHaveBeenCalledTimes(1);
    expect(ctx.tipos().at(-1)).toBe('alerta_lentitud');
  });

  it('en alerta_lentitud las siguientes lecturas altas no generan más alarmas', async () => {
    const ctx = build();
    await pasoPing(ctx, OK(150));
    await pasoPing(ctx, OK(150), 3);
    await pasoPing(ctx, OK(160), 5);
    expect(ctx.est().alarmas).toHaveLength(1);
    expect(ctx.est().segs).toBe(8);
    expect(ctx.tipos().at(-1)).toBe('latencia_alta_silenciosa');
  });

  it('la latencia se normaliza ANTES de la alerta: vuelve a estable sin alarma', async () => {
    const ctx = build();
    await pasoPing(ctx, OK(150));
    await pasoPing(ctx, OK(20), 1);
    expect(ctx.est()).toMatchObject({ est: 'estable', malDesde: null, horaIni: null });
    expect(ctx.est().alarmas).toHaveLength(0);
    expect(ctx.channels.persistAlert).not.toHaveBeenCalled();
  });

  it('la latencia se normaliza DESPUÉS de la alerta: alarma "latencia_rec" y luego estable', async () => {
    const ctx = build();
    await pasoPing(ctx, OK(150));
    await pasoPing(ctx, OK(150), 3);
    await pasoPing(ctx, OK(20), 4);
    expect(ctx.est().est).toBe('latencia_rec');
    expect(ctx.est().alarmas[0]).toMatchObject({
      tipo: 'latencia_rec',
      severidad: 'ok',
      segundos: 7,
    });
    expect(ctx.tipos().at(-1)).toBe('latencia_recuperada');
    await pasoPing(ctx, OK(20), 1);
    expect(ctx.est().est).toBe('estable');
  });

  it('latencia alta desde latencia_rec o canal_recuperado reinicia el ciclo', async () => {
    const ctx = build();
    await pasoPing(ctx, OK(150));
    await pasoPing(ctx, OK(150), 3);
    await pasoPing(ctx, OK(20), 1); // latencia_rec
    await pasoPing(ctx, OK(500), 1);
    expect(ctx.est().est).toBe('latencia_alta');
    expect(ctx.tipos().at(-1)).toBe('latencia_alta_inicio');
  });
});

describe('PingSchedulerService.tick - transición pérdida -> latencia alta', () => {
  it('con alarma crítica activa: registra "parcial" y pasa a latencia_alta', async () => {
    const ctx = build();
    await pasoPing(ctx, LOST);
    await pasoPing(ctx, LOST, 30); // alerta crítica
    await pasoPing(ctx, OK(300), 10);
    expect(ctx.est()).toMatchObject({
      est: 'latencia_alta',
      alarmaActiva: false,
      segs: 0,
    });
    expect(ctx.est().alarmas[0]).toMatchObject({ tipo: 'parcial', severidad: 'informativa' });
    expect(ctx.est().alarmas[0].motivo).toContain('caído 40s');
    expect(ctx.tipos().at(-1)).toBe('parcial_recuperado');
  });

  it('sin alarma activa (pérdida corta): pasa a latencia_alta sin registrar alarma', async () => {
    const ctx = build();
    await pasoPing(ctx, LOST);
    await pasoPing(ctx, OK(300), 2);
    expect(ctx.est().est).toBe('latencia_alta');
    expect(ctx.est().alarmas).toHaveLength(0);
    expect(ctx.channels.persistAlert).not.toHaveBeenCalled();
  });
});

describe('PingSchedulerService.tick - límites de memoria', () => {
  it('mantiene como máximo ~300 alarmas', async () => {
    const ctx = build();
    // Genera muchas alarmas alternando pérdida/recuperación.
    for (let i = 0; i < 320; i++) {
      await pasoPing(ctx, LOST, 1);
      await pasoPing(ctx, OK(10), 1); // canal_recuperado => alarma
      await pasoPing(ctx, OK(10), 1); // estable
    }
    expect(ctx.est().alarmas.length).toBeLessThanOrEqual(301);
    expect(ctx.est().alarmas.length).toBeGreaterThan(290);
  });
});

describe('PingSchedulerService - configuración y ciclo de vida', () => {
  it('getGlobalConfig devuelve los valores por defecto', () => {
    const { service } = build();
    expect(service.getGlobalConfig()).toEqual({
      umbralMs: 100,
      intervaloSeg: 2,
      duracionPerdida: 30,
      duracionLat: 3,
    });
  });

  it('applyConfigUpdate mezcla parcialmente y propaga umbralMs a los canales en memoria', () => {
    const { service, channels } = build();
    const enMemoria = [{ ...info }, { ...info, id: 'c2' }];
    channels.getAll.mockReturnValue(enMemoria);
    service.applyConfigUpdate({ umbralMs: 250, duracionLat: 9 });
    expect(service.getGlobalConfig()).toMatchObject({
      umbralMs: 250,
      duracionLat: 9,
      intervaloSeg: 2,
    });
    expect(enMemoria.map((c) => c.umbral)).toEqual([250, 250]);
  });

  it('applyConfigUpdate sin umbralMs no toca los umbrales de los canales', () => {
    const { service, channels } = build();
    const enMemoria = [{ ...info }];
    channels.getAll.mockReturnValue(enMemoria);
    service.applyConfigUpdate({ intervaloSeg: 5 });
    expect(enMemoria[0].umbral).toBe(100);
  });

  it('getSnapshot devuelve null si el canal no tiene estado y un payload si lo tiene', async () => {
    const ctx = build();
    expect(ctx.service.getSnapshot({ ...info, id: 'nope' })).toBeNull();
    await pasoPing(ctx, OK(20));
    const snap = ctx.service.getSnapshot(info)!;
    expect(snap).toMatchObject({
      id: 'c1',
      nombre: 'Canal 1',
      host: 'h',
      actual: 20,
      total: 1,
      estado_actual: 'estable',
      tipo: 'snap',
      duracion_cfg: 30,
      duracion_lat: 3,
    });
  });

  it('stopChannel elimina el estado del canal', () => {
    const ctx = build();
    ctx.service.stopChannel('c1');
    expect(ctx.service.getSnapshot(info)).toBeNull();
  });

  it('onModuleInit carga la configuración de BD y arranca los canales activos', async () => {
    const ctx = build();
    ctx.prisma.monitorConfig.upsert.mockResolvedValue({
      umbralMs: 80,
      intervaloSeg: 1,
      duracionPerdida: 10,
      duracionLat: 2,
    });
    ctx.prisma.channel.findMany.mockResolvedValue([
      { id: 'x', name: 'X', host: 'x.com', umbralMs: 90 },
    ]);
    const start = jest
      .spyOn(ctx.service, 'startChannel')
      .mockImplementation(() => undefined);
    await ctx.service.onModuleInit();
    expect(ctx.service.getGlobalConfig()).toEqual({
      umbralMs: 80,
      intervaloSeg: 1,
      duracionPerdida: 10,
      duracionLat: 2,
    });
    expect(ctx.channels.registerInMemory).toHaveBeenCalledWith({
      id: 'x',
      nombre: 'X',
      host: 'x.com',
      umbral: 90,
    });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('onModuleInit crea los 2 canales por defecto si no hay ninguno activo', async () => {
    const ctx = build();
    const start = jest
      .spyOn(ctx.service, 'startChannel')
      .mockImplementation(() => undefined);
    await ctx.service.onModuleInit();
    expect(ctx.prisma.channel.create).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledTimes(2);
    const nombres = ctx.channels.registerInMemory.mock.calls.map((c) => c[0].nombre);
    expect(nombres).toEqual(['SINCO CLARO', 'SINCO UNE']);
  });
});
