import { EstadoActividad } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { CATEGORIAS_AUDITORIA } from './dto/create-activity.dto';

const NOW = new Date('2026-06-15T12:00:00Z');
const DAY = 86_400_000;

const cfgBase = {
  diasAntes: [7, 3, 1],
  semaforoVerdePct: 90,
  semaforoAmarilloPct: 70,
  sonidoActivo: true,
};

function buildService(cfg: Record<string, unknown> = cfgBase) {
  const prisma = {
    activityOccurrence: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const configService = { get: jest.fn().mockResolvedValue({ ...cfgBase, ...cfg }) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new DashboardService(prisma as any, configService as any);
  return { service, prisma, configService };
}

const occ = (estado: EstadoActividad, fecha: Date | string | number) => ({
  estado,
  fechaProgramada: new Date(fecha),
});

/** Genera n ocurrencias con el estado dado (fecha lejana para no influir en vencidas). */
const many = (estado: EstadoActividad, n: number, fecha = '2026-12-31') =>
  Array.from({ length: n }, () => occ(estado, fecha));

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
});
afterEach(() => jest.useRealTimers());

describe('DashboardService.kpis', () => {
  it('sin ocurrencias: total 0, cumplimiento 0 y contadores en 0', async () => {
    const { service } = buildService();
    const res = await service.kpis('aud', 2026);
    expect(res).toMatchObject({
      anio: 2026,
      total: 0,
      cumplimientoPct: 0,
      vencidas: 0,
      proximasAVencer: 0,
      porEstado: { PLANEADO: 0, EJECUTADO: 0, REPROGRAMADO: 0, NO_REALIZADO: 0 },
    });
  });

  it('filtra por año (startsWith), auditoría, activas y categoría opcional', async () => {
    const { service, prisma } = buildService();
    await service.kpis('aud-9', 2026, 'Servidores');
    expect(prisma.activityOccurrence.findMany).toHaveBeenCalledWith({
      where: {
        periodo: { startsWith: '2026' },
        activity: {
          auditoriaId: 'aud-9',
          activa: true,
          categoria: 'Servidores',
        },
      },
      select: { estado: true, fechaProgramada: true },
    });
  });

  it('categoria vacía se trata como "sin filtro" (undefined)', async () => {
    const { service, prisma } = buildService();
    await service.kpis('aud', 2026, '');
    const where = prisma.activityOccurrence.findMany.mock.calls[0][0].where;
    expect(where.activity.categoria).toBeUndefined();
  });

  it('cuenta ocurrencias por estado', async () => {
    const { service, prisma } = buildService();
    prisma.activityOccurrence.findMany.mockResolvedValue([
      ...many(EstadoActividad.EJECUTADO, 3),
      ...many(EstadoActividad.PLANEADO, 2),
      ...many(EstadoActividad.REPROGRAMADO, 1),
      ...many(EstadoActividad.NO_REALIZADO, 4),
    ]);
    const res = await service.kpis('aud', 2026);
    expect(res.porEstado).toEqual({
      PLANEADO: 2,
      EJECUTADO: 3,
      REPROGRAMADO: 1,
      NO_REALIZADO: 4,
    });
    expect(res.total).toBe(10);
    expect(res.cumplimientoPct).toBe(30);
  });

  describe('cumplimientoPct', () => {
    it.each([
      [1, 3, 33], // 33.33 -> 33
      [2, 3, 67], // 66.67 -> 67
      [1, 8, 13], // 12.5 -> 13 (Math.round redondea .5 hacia arriba)
      [5, 5, 100],
      [0, 5, 0],
    ])('%i ejecutadas de %i => %i%%', async (ejec, total, esperado) => {
      const { service, prisma } = buildService();
      prisma.activityOccurrence.findMany.mockResolvedValue([
        ...many(EstadoActividad.EJECUTADO, ejec),
        ...many(EstadoActividad.PLANEADO, total - ejec),
      ]);
      expect((await service.kpis('aud', 2026)).cumplimientoPct).toBe(esperado);
    });

    it('REPROGRAMADO y NO_REALIZADO cuentan en el total pero no como cumplidas', async () => {
      const { service, prisma } = buildService();
      prisma.activityOccurrence.findMany.mockResolvedValue([
        ...many(EstadoActividad.EJECUTADO, 1),
        ...many(EstadoActividad.REPROGRAMADO, 1),
        ...many(EstadoActividad.NO_REALIZADO, 2),
      ]);
      expect((await service.kpis('aud', 2026)).cumplimientoPct).toBe(25);
    });
  });

  describe('semáforo', () => {
    async function semaforoPara(
      ejecutadas: number,
      total: number,
      cfg?: Record<string, unknown>,
    ) {
      const { service, prisma } = buildService(cfg);
      prisma.activityOccurrence.findMany.mockResolvedValue([
        ...many(EstadoActividad.EJECUTADO, ejecutadas),
        ...many(EstadoActividad.PLANEADO, total - ejecutadas),
      ]);
      return service.kpis('aud', 2026);
    }

    it('verde cuando cumplimiento >= umbral verde (límite inclusivo: 90%)', async () => {
      const res = await semaforoPara(9, 10);
      expect(res.cumplimientoPct).toBe(90);
      expect(res.semaforo).toBe('verde');
    });

    it('amarillo justo bajo el umbral verde (89%)', async () => {
      const res = await semaforoPara(89, 100);
      expect(res.semaforo).toBe('amarillo');
    });

    it('amarillo en el umbral amarillo exacto (70%, inclusivo)', async () => {
      const res = await semaforoPara(7, 10);
      expect(res.cumplimientoPct).toBe(70);
      expect(res.semaforo).toBe('amarillo');
    });

    it('rojo justo bajo el umbral amarillo (69%)', async () => {
      const res = await semaforoPara(69, 100);
      expect(res.semaforo).toBe('rojo');
    });

    it('100% es verde y 0% con datos es rojo', async () => {
      expect((await semaforoPara(4, 4)).semaforo).toBe('verde');
      expect((await semaforoPara(0, 4)).semaforo).toBe('rojo');
    });

    it('respeta umbrales configurados (verde 50 / amarillo 20)', async () => {
      const cfg = { semaforoVerdePct: 50, semaforoAmarilloPct: 20 };
      expect((await semaforoPara(5, 10, cfg)).semaforo).toBe('verde');
      expect((await semaforoPara(2, 10, cfg)).semaforo).toBe('amarillo');
      expect((await semaforoPara(1, 10, cfg)).semaforo).toBe('rojo');
    });

    it('el redondeo se aplica ANTES de comparar contra el umbral (89.5% => 90 => verde)', async () => {
      // 179/200 = 89.5 -> Math.round = 90 -> verde
      const res = await semaforoPara(179, 200);
      expect(res.cumplimientoPct).toBe(90);
      expect(res.semaforo).toBe('verde');
    });

    it('sin ocurrencias (0%) el semáforo depende del umbral amarillo configurado', async () => {
      // Caracterización: con umbral amarillo 0 un año sin datos sale "amarillo".
      const { service } = buildService({ semaforoAmarilloPct: 0 });
      expect((await service.kpis('aud', 2026)).semaforo).toBe('amarillo');
      const { service: s2 } = buildService();
      expect((await s2.kpis('aud', 2026)).semaforo).toBe('rojo');
    });
  });

  describe('vencidas y próximas a vencer', () => {
    it('vencida = PLANEADO con fecha anterior a ahora', async () => {
      const { service, prisma } = buildService();
      prisma.activityOccurrence.findMany.mockResolvedValue([
        occ(EstadoActividad.PLANEADO, NOW.getTime() - 1000),
        occ(EstadoActividad.PLANEADO, NOW.getTime() - 10 * DAY),
        occ(EstadoActividad.EJECUTADO, NOW.getTime() - 10 * DAY),
        occ(EstadoActividad.REPROGRAMADO, NOW.getTime() - 10 * DAY),
        occ(EstadoActividad.NO_REALIZADO, NOW.getTime() - 10 * DAY),
      ] as never);
      const res = await service.kpis('aud', 2026);
      expect(res.vencidas).toBe(2);
      expect(res.proximasAVencer).toBe(0);
    });

    it('exactamente "ahora" no es vencida sino próxima (límite inferior inclusivo)', async () => {
      const { service, prisma } = buildService();
      prisma.activityOccurrence.findMany.mockResolvedValue([
        occ(EstadoActividad.PLANEADO, NOW),
      ]);
      const res = await service.kpis('aud', 2026);
      expect(res.vencidas).toBe(0);
      expect(res.proximasAVencer).toBe(1);
    });

    it('el horizonte es el mayor de diasAntes (7 días, límite superior inclusivo)', async () => {
      const { service, prisma } = buildService({ diasAntes: [1, 7, 3] });
      prisma.activityOccurrence.findMany.mockResolvedValue([
        occ(EstadoActividad.PLANEADO, NOW.getTime() + 7 * DAY), // justo en el horizonte
        occ(EstadoActividad.PLANEADO, NOW.getTime() + 7 * DAY + 1), // fuera
        occ(EstadoActividad.PLANEADO, NOW.getTime() + 2 * DAY),
      ]);
      expect((await service.kpis('aud', 2026)).proximasAVencer).toBe(2);
    });

    it('con diasAntes vacío el horizonte por defecto es 7 días', async () => {
      const { service, prisma } = buildService({ diasAntes: [] });
      prisma.activityOccurrence.findMany.mockResolvedValue([
        occ(EstadoActividad.PLANEADO, NOW.getTime() + 6 * DAY),
        occ(EstadoActividad.PLANEADO, NOW.getTime() + 8 * DAY),
      ]);
      expect((await service.kpis('aud', 2026)).proximasAVencer).toBe(1);
    });

    it('solo PLANEADO cuenta como próxima a vencer', async () => {
      const { service, prisma } = buildService();
      prisma.activityOccurrence.findMany.mockResolvedValue([
        occ(EstadoActividad.EJECUTADO, NOW.getTime() + DAY),
        occ(EstadoActividad.REPROGRAMADO, NOW.getTime() + DAY),
      ]);
      expect((await service.kpis('aud', 2026)).proximasAVencer).toBe(0);
    });
  });
});

describe('DashboardService.series', () => {
  const o = (estado: EstadoActividad, fecha: string) => occ(estado, fecha);

  it('mes: devuelve siempre 12 buckets "01".."12" incluso sin datos', async () => {
    const { service } = buildService();
    const res = await service.series('aud', 2026, 'mes');
    expect(res).toHaveLength(12);
    expect(res[0]).toEqual({
      periodo: '01',
      programado: 0,
      ejecutado: 0,
      cumplimientoPct: 0,
    });
    expect(res[11].periodo).toBe('12');
  });

  it('trimestre: 4 buckets Q1..Q4', async () => {
    const { service } = buildService();
    const res = await service.series('aud', 2026, 'trimestre');
    expect(res.map((r) => r.periodo)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
  });

  it('bimestre: 6 buckets B1..B6', async () => {
    const { service } = buildService();
    const res = await service.series('aud', 2026, 'bimestre');
    expect(res.map((r) => r.periodo)).toEqual([
      'B1',
      'B2',
      'B3',
      'B4',
      'B5',
      'B6',
    ]);
  });

  it('agrupa por mes de fechaProgramada (UTC) y calcula cumplimiento', async () => {
    const { service, prisma } = buildService();
    prisma.activityOccurrence.findMany.mockResolvedValue([
      o(EstadoActividad.EJECUTADO, '2026-01-31'),
      o(EstadoActividad.PLANEADO, '2026-01-15'),
      o(EstadoActividad.EJECUTADO, '2026-03-31'),
    ]);
    const res = await service.series('aud', 2026, 'mes');
    expect(res[0]).toEqual({
      periodo: '01',
      programado: 2,
      ejecutado: 1,
      cumplimientoPct: 50,
    });
    expect(res[1].programado).toBe(0);
    expect(res[2]).toEqual({
      periodo: '03',
      programado: 1,
      ejecutado: 1,
      cumplimientoPct: 100,
    });
  });

  it('agrupa por trimestre: ene-mar Q1, abr-jun Q2, jul-sep Q3, oct-dic Q4', async () => {
    const { service, prisma } = buildService();
    prisma.activityOccurrence.findMany.mockResolvedValue([
      o(EstadoActividad.EJECUTADO, '2026-03-31'),
      o(EstadoActividad.PLANEADO, '2026-04-01'),
      o(EstadoActividad.PLANEADO, '2026-06-30'),
      o(EstadoActividad.PLANEADO, '2026-09-30'),
      o(EstadoActividad.EJECUTADO, '2026-12-31'),
    ]);
    const res = await service.series('aud', 2026, 'trimestre');
    expect(res.map((r) => r.programado)).toEqual([1, 2, 1, 1]);
    expect(res.map((r) => r.ejecutado)).toEqual([1, 0, 0, 1]);
  });

  it('agrupa por bimestre: feb -> B1, mar -> B2, dic -> B6', async () => {
    const { service, prisma } = buildService();
    prisma.activityOccurrence.findMany.mockResolvedValue([
      o(EstadoActividad.EJECUTADO, '2026-02-28'),
      o(EstadoActividad.PLANEADO, '2026-03-31'),
      o(EstadoActividad.EJECUTADO, '2026-12-31'),
    ]);
    const res = await service.series('aud', 2026, 'bimestre');
    expect(res[0].programado).toBe(1);
    expect(res[1].programado).toBe(1);
    expect(res[5]).toMatchObject({ programado: 1, ejecutado: 1 });
  });

  it('solo EJECUTADO cuenta como ejecutado', async () => {
    const { service, prisma } = buildService();
    prisma.activityOccurrence.findMany.mockResolvedValue([
      o(EstadoActividad.REPROGRAMADO, '2026-05-10'),
      o(EstadoActividad.NO_REALIZADO, '2026-05-11'),
    ]);
    const res = await service.series('aud', 2026, 'mes');
    expect(res[4]).toMatchObject({ programado: 2, ejecutado: 0, cumplimientoPct: 0 });
  });

  it('pasa el filtro de categoría a Prisma', async () => {
    const { service, prisma } = buildService();
    await service.series('aud', 2026, 'mes', 'Switches');
    expect(
      prisma.activityOccurrence.findMany.mock.calls[0][0].where.activity
        .categoria,
    ).toBe('Switches');
  });
});

describe('DashboardService.porCategoria', () => {
  const row = (categoria: string, estado: EstadoActividad) => ({
    estado,
    activity: { categoria },
  });

  it('incluye todas las categorías conocidas aunque no tengan datos, con "Otros" al final', async () => {
    const { service } = buildService();
    const res = await service.porCategoria('aud', 2026);
    expect(res.map((r) => r.categoria)).toHaveLength(CATEGORIAS_AUDITORIA.length);
    expect(res[res.length - 1].categoria).toBe('Otros');
    for (const r of res) {
      expect(r).toMatchObject({
        PLANEADO: 0,
        EJECUTADO: 0,
        REPROGRAMADO: 0,
        NO_REALIZADO: 0,
        cumplimientoPct: 0,
      });
    }
  });

  it('las categorías van en orden alfabético excepto "Otros"', async () => {
    const { service } = buildService();
    const res = await service.porCategoria('aud', 2026);
    const sinOtros = res.map((r) => r.categoria).filter((c) => c !== 'Otros');
    expect(sinOtros).toEqual([...sinOtros].sort((a, b) => a.localeCompare(b)));
  });

  it('cuenta por estado y calcula cumplimiento por categoría', async () => {
    const { service, prisma } = buildService();
    prisma.activityOccurrence.findMany.mockResolvedValue([
      row('Servidores', EstadoActividad.EJECUTADO),
      row('Servidores', EstadoActividad.EJECUTADO),
      row('Servidores', EstadoActividad.PLANEADO),
      row('Switches', EstadoActividad.NO_REALIZADO),
    ]);
    const res = await service.porCategoria('aud', 2026);
    const servidores = res.find((r) => r.categoria === 'Servidores')!;
    expect(servidores).toMatchObject({
      EJECUTADO: 2,
      PLANEADO: 1,
      cumplimientoPct: 67,
    });
    const switches = res.find((r) => r.categoria === 'Switches')!;
    expect(switches).toMatchObject({ NO_REALIZADO: 1, cumplimientoPct: 0 });
  });

  it('agrega categorías personalizadas (fuera del catálogo) sin perderlas', async () => {
    const { service, prisma } = buildService();
    prisma.activityOccurrence.findMany.mockResolvedValue([
      row('Categoría nueva', EstadoActividad.EJECUTADO),
    ]);
    const res = await service.porCategoria('aud', 2026);
    expect(res).toHaveLength(CATEGORIAS_AUDITORIA.length + 1);
    const nueva = res.find((r) => r.categoria === 'Categoría nueva')!;
    expect(nueva.cumplimientoPct).toBe(100);
    expect(res[res.length - 1].categoria).toBe('Otros');
  });
});

describe('DashboardService.alertas', () => {
  const cand = (id: string, dias: number) => ({
    id,
    estado: EstadoActividad.PLANEADO,
    fechaProgramada: new Date(NOW.getTime() + dias * DAY),
    activity: { nombre: id },
  });

  it('consulta PLANEADO hasta el horizonte, con actividad activa, ordenado por fecha', async () => {
    const { service, prisma } = buildService();
    await service.alertas('aud-1');
    const arg = prisma.activityOccurrence.findMany.mock.calls[0][0];
    expect(arg.where.estado).toBe(EstadoActividad.PLANEADO);
    expect(arg.where.fechaProgramada.lte).toEqual(new Date(NOW.getTime() + 7 * DAY));
    expect(arg.where.activity).toEqual({ auditoriaId: 'aud-1', activa: true });
    expect(arg.orderBy).toEqual({ fechaProgramada: 'asc' });
  });

  it('separa vencidas de próximas y devuelve sonidoActivo', async () => {
    const { service, prisma } = buildService({ sonidoActivo: false });
    prisma.activityOccurrence.findMany.mockResolvedValue([
      cand('vencida', -2),
      cand('en3', 3),
    ]);
    const res = await service.alertas('aud');
    expect(res.vencidas.map((v) => v.id)).toEqual(['vencida']);
    expect(res.proximasAVencer.map((p) => p.id)).toEqual(['en3']);
    expect(res.sonidoActivo).toBe(false);
  });

  it('solo alerta cuando diasRestantes coincide EXACTAMENTE con un umbral de diasAntes', async () => {
    const { service, prisma } = buildService({ diasAntes: [7, 3, 1] });
    prisma.activityOccurrence.findMany.mockResolvedValue([
      cand('en1', 1),
      cand('en2', 2), // 2 no es umbral -> no alerta
      cand('en3', 3),
      cand('en5', 5), // idem
      cand('en7', 7),
    ]);
    const res = await service.alertas('aud');
    expect(res.proximasAVencer.map((p) => p.id)).toEqual(['en1', 'en3', 'en7']);
    expect(res.proximasAVencer.map((p) => p.diasRestantes)).toEqual([1, 3, 7]);
  });

  it('diasRestantes usa Math.ceil (fracción de día cuenta como día completo)', async () => {
    const { service, prisma } = buildService({ diasAntes: [1, 2] });
    prisma.activityOccurrence.findMany.mockResolvedValue([
      {
        id: 'x',
        fechaProgramada: new Date(NOW.getTime() + 1.2 * DAY),
        activity: {},
      },
    ]);
    const res = await service.alertas('aud');
    expect(res.proximasAVencer[0].diasRestantes).toBe(2);
  });

  it('una ocurrencia que vence exactamente ahora tiene diasRestantes 0 (solo alerta si 0 está en diasAntes)', async () => {
    const { service, prisma } = buildService({ diasAntes: [0, 1] });
    prisma.activityOccurrence.findMany.mockResolvedValue([
      { id: 'hoy', fechaProgramada: NOW, activity: {} },
    ]);
    const res = await service.alertas('aud');
    expect(res.proximasAVencer.map((p) => p.diasRestantes)).toEqual([0]);
  });
});
