import { ChannelsService } from './channels.service';

function build() {
  const prisma = {
    monitorConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: 1 }),
    },
    channel: {
      create: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    pingSample: { create: jest.fn().mockResolvedValue({}) },
    alertEvent: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new ChannelsService(prisma as any);
  return { service, prisma };
}

const info = (id: string, umbral = 100) => ({
  id,
  nombre: `Canal ${id}`,
  host: `${id}.example.com`,
  umbral,
});

describe('ChannelsService - registro en memoria', () => {
  it('registra, obtiene, lista y quita canales', () => {
    const { service } = build();
    service.registerInMemory(info('a'));
    service.registerInMemory(info('b'));
    expect(service.get('a')?.host).toBe('a.example.com');
    expect(service.getAll().map((c) => c.id)).toEqual(['a', 'b']);
    service.removeInMemory('a');
    expect(service.get('a')).toBeUndefined();
    expect(service.getAll()).toHaveLength(1);
  });
});

describe('ChannelsService.createChannelRow', () => {
  it('usa el umbral de la configuración global', async () => {
    const { service, prisma } = build();
    prisma.monitorConfig.findUnique.mockResolvedValue({ umbralMs: 250 });
    prisma.channel.create.mockResolvedValue({
      id: 'c1',
      name: 'N',
      host: 'h',
      umbralMs: 250,
    });
    const res = await service.createChannelRow({ name: 'N', host: 'h' } as never);
    expect(prisma.channel.create).toHaveBeenCalledWith({
      data: { name: 'N', host: 'h', umbralMs: 250 },
    });
    expect(res).toEqual({ id: 'c1', nombre: 'N', host: 'h', umbral: 250 });
  });

  it('sin configuración usa 100 ms por defecto', async () => {
    const { service, prisma } = build();
    prisma.channel.create.mockResolvedValue({ id: 'c1', name: 'N', host: 'h', umbralMs: 100 });
    await service.createChannelRow({ name: 'N', host: 'h' } as never);
    expect(prisma.channel.create.mock.calls[0][0].data.umbralMs).toBe(100);
  });
});

describe('ChannelsService - persistencia tolerante a fallos', () => {
  it('deleteChannelRow ignora errores (canal inexistente)', async () => {
    const { service, prisma } = build();
    prisma.channel.delete.mockRejectedValue(new Error('not found'));
    await expect(service.deleteChannelRow('x')).resolves.toBeUndefined();
  });

  it('persistSample guarda la muestra y traga errores', async () => {
    const { service, prisma } = build();
    await service.persistSample('c1', 12.5, false, 'raw');
    expect(prisma.pingSample.create).toHaveBeenCalledWith({
      data: { channelId: 'c1', latencyMs: 12.5, lost: false, rawOutput: 'raw' },
    });
    prisma.pingSample.create.mockRejectedValue(new Error('db'));
    await expect(service.persistSample('c1', null, true, 'x')).resolves.toBeUndefined();
  });

  it('persistAlert guarda la alerta y traga errores', async () => {
    const { service, prisma } = build();
    const inicio = new Date('2026-01-01T00:00:00Z');
    const fin = new Date('2026-01-01T00:01:00Z');
    await service.persistAlert('c1', 'alerta_critica', 'critica', 'msg', inicio, fin, 60);
    expect(prisma.alertEvent.create).toHaveBeenCalledWith({
      data: {
        channelId: 'c1',
        type: 'alerta_critica',
        severity: 'critica',
        message: 'msg',
        startedAt: inicio,
        endedAt: fin,
        durationSec: 60,
      },
    });
    prisma.alertEvent.create.mockRejectedValue(new Error('db'));
    await expect(
      service.persistAlert('c1', 't', 's', 'm', inicio),
    ).resolves.toBeUndefined();
  });

  it('listAlerts: más recientes primero, límite 300 por defecto', async () => {
    const { service, prisma } = build();
    await service.listAlerts('c1');
    expect(prisma.alertEvent.findMany).toHaveBeenCalledWith({
      where: { channelId: 'c1' },
      orderBy: { startedAt: 'desc' },
      take: 300,
    });
    await service.listAlerts('c1', 10);
    expect(prisma.alertEvent.findMany.mock.calls[1][0].take).toBe(10);
  });
});

describe('ChannelsService - configuración', () => {
  it('getConfig hace upsert de la fila id=1', async () => {
    const { service, prisma } = build();
    await service.getConfig();
    expect(prisma.monitorConfig.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  });

  it('updateConfig aplica el dto en update y create', async () => {
    const { service, prisma } = build();
    await service.updateConfig({ umbralMs: 200 } as never);
    expect(prisma.monitorConfig.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: { umbralMs: 200 },
      create: { id: 1, umbralMs: 200 },
    });
  });

  it('setUmbralOnAllChannels actualiza BD y los canales en memoria', async () => {
    const { service, prisma } = build();
    service.registerInMemory(info('a', 100));
    service.registerInMemory(info('b', 50));
    await service.setUmbralOnAllChannels(300);
    expect(prisma.channel.updateMany).toHaveBeenCalledWith({ data: { umbralMs: 300 } });
    expect(service.getAll().map((c) => c.umbral)).toEqual([300, 300]);
  });
});

describe('ChannelsService - eventos SSE', () => {
  it('broadcast emite el payload como MessageEvent.data', () => {
    const { service } = build();
    const recibidos: unknown[] = [];
    service.events$.subscribe((e) => recibidos.push(e));
    service.broadcast({ id: 'a', tipo: 'estable' } as never);
    expect(recibidos).toEqual([{ data: { id: 'a', tipo: 'estable' } }]);
  });

  it('broadcastRemoved emite accion "quitar"', () => {
    const { service } = build();
    const recibidos: unknown[] = [];
    service.events$.subscribe((e) => recibidos.push(e));
    service.broadcastRemoved('a');
    expect(recibidos).toEqual([{ data: { accion: 'quitar', id: 'a' } }]);
  });
});
