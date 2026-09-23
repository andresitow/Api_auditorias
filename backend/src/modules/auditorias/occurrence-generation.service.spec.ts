import { Logger } from '@nestjs/common';
import { Frecuencia } from '@prisma/client';
import { OccurrenceGenerationService } from './occurrence-generation.service';

function buildPrisma() {
  return {
    activityOccurrence: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    activity: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

type PrismaMock = ReturnType<typeof buildPrisma>;

function buildService(prisma: PrismaMock) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new OccurrenceGenerationService(prisma as any);
}

const activity = (over: Record<string, unknown> = {}) => ({
  id: 'act-1',
  frecuencia: Frecuencia.MENSUAL,
  observacion: 'obs' as string | null,
  ...over,
});

describe('OccurrenceGenerationService.generateForYear', () => {
  let prisma: PrismaMock;
  let service: OccurrenceGenerationService;

  beforeEach(() => {
    prisma = buildPrisma();
    service = buildService(prisma);
  });

  it.each([
    Frecuencia.UNICA,
    Frecuencia.A_DEMANDA,
    Frecuencia.CUANDO_SE_REQUIERA,
  ])('%s no consulta ni crea nada', async (frecuencia) => {
    const res = await service.generateForYear(activity({ frecuencia }), 2026);
    expect(res).toEqual({ periodos: 0, creadas: 0 });
    expect(prisma.activityOccurrence.findMany).not.toHaveBeenCalled();
    expect(prisma.activityOccurrence.createMany).not.toHaveBeenCalled();
  });

  it('crea los 12 periodos mensuales cuando no hay ninguno existente', async () => {
    const res = await service.generateForYear(activity(), 2026);

    expect(res).toEqual({ periodos: 12, creadas: 12 });
    const call = prisma.activityOccurrence.createMany.mock.calls[0][0];
    expect(call.skipDuplicates).toBe(true);
    expect(call.data).toHaveLength(12);
    expect(call.data[0]).toEqual({
      activityId: 'act-1',
      periodo: '2026-01',
      fechaProgramada: new Date(Date.UTC(2026, 0, 31)),
      observaciones: 'obs',
    });
  });

  it('consulta solo periodos de esa actividad', async () => {
    await service.generateForYear(activity(), 2026);
    const where = prisma.activityOccurrence.findMany.mock.calls[0][0].where;
    expect(where.activityId).toBe('act-1');
    expect(where.periodo.in).toHaveLength(12);
  });

  it('es idempotente: solo inserta los periodos faltantes', async () => {
    prisma.activityOccurrence.findMany.mockResolvedValue([
      { periodo: '2026-01' },
      { periodo: '2026-02' },
      { periodo: '2026-03' },
    ]);
    const res = await service.generateForYear(activity(), 2026);

    expect(res).toEqual({ periodos: 12, creadas: 9 });
    const data = prisma.activityOccurrence.createMany.mock.calls[0][0].data;
    expect(data.map((d: { periodo: string }) => d.periodo)).not.toEqual(
      expect.arrayContaining(['2026-01', '2026-02', '2026-03']),
    );
  });

  it('no llama createMany si todos los periodos ya existen', async () => {
    prisma.activityOccurrence.findMany.mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => ({ periodo: `2026-Q${i + 1}` })),
    );
    const res = await service.generateForYear(
      activity({ frecuencia: Frecuencia.TRIMESTRAL }),
      2026,
    );
    expect(res).toEqual({ periodos: 4, creadas: 0 });
    expect(prisma.activityOccurrence.createMany).not.toHaveBeenCalled();
  });

  it('nunca pisa la fecha de una ocurrencia existente (no hace update)', async () => {
    // El servicio ni siquiera expone update: solo createMany con skipDuplicates.
    prisma.activityOccurrence.findMany.mockResolvedValue([
      { periodo: '2026-06' },
    ]);
    await service.generateForYear(activity(), 2026);
    expect(Object.keys(prisma.activityOccurrence)).toEqual([
      'findMany',
      'createMany',
    ]);
  });

  describe('fechaInicio', () => {
    it('descarta periodos con fecha programada anterior a fechaInicio', async () => {
      const res = await service.generateForYear(
        activity(),
        2026,
        new Date('2026-07-01T00:00:00Z'),
      );
      // Jul..Dic = 6 periodos (jun 30 < jul 1)
      expect(res).toEqual({ periodos: 6, creadas: 6 });
      const periodos = prisma.activityOccurrence.createMany.mock.calls[0][0].data.map(
        (d: { periodo: string }) => d.periodo,
      );
      expect(periodos).toEqual([
        '2026-07',
        '2026-08',
        '2026-09',
        '2026-10',
        '2026-11',
        '2026-12',
      ]);
    });

    it('incluye el periodo cuya fecha programada es exactamente fechaInicio', async () => {
      const res = await service.generateForYear(
        activity(),
        2026,
        new Date(Date.UTC(2026, 5, 30)),
      );
      expect(res.periodos).toBe(7); // jun 30 incluido
    });

    it('si fechaInicio es posterior a todo el año no crea nada', async () => {
      const res = await service.generateForYear(
        activity(),
        2026,
        new Date('2027-01-01T00:00:00Z'),
      );
      expect(res).toEqual({ periodos: 0, creadas: 0 });
      expect(prisma.activityOccurrence.findMany).not.toHaveBeenCalled();
    });
  });

  it('propaga observacion nula de la actividad a las ocurrencias', async () => {
    await service.generateForYear(
      activity({ frecuencia: Frecuencia.ANUAL, observacion: null }),
      2026,
    );
    const data = prisma.activityOccurrence.createMany.mock.calls[0][0].data;
    expect(data).toEqual([
      {
        activityId: 'act-1',
        periodo: '2026',
        fechaProgramada: new Date(Date.UTC(2026, 11, 31)),
        observaciones: null,
      },
    ]);
  });
});

describe('OccurrenceGenerationService.generateYearForAuditoria', () => {
  it('consulta solo actividades activas de la auditoría y acumula totales', async () => {
    const prisma = buildPrisma();
    prisma.activity.findMany.mockResolvedValue([
      activity({ id: 'a1', frecuencia: Frecuencia.MENSUAL }),
      activity({ id: 'a2', frecuencia: Frecuencia.TRIMESTRAL }),
      activity({ id: 'a3', frecuencia: Frecuencia.A_DEMANDA }),
    ]);
    const service = buildService(prisma);

    const res = await service.generateYearForAuditoria('aud-1', 2026);

    expect(prisma.activity.findMany).toHaveBeenCalledWith({
      where: { auditoriaId: 'aud-1', activa: true },
    });
    expect(res).toEqual({
      anio: 2026,
      actividadesProcesadas: 3,
      periodosTotal: 16,
      creadasTotal: 16,
    });
  });

  it('sin actividades devuelve ceros', async () => {
    const service = buildService(buildPrisma());
    expect(await service.generateYearForAuditoria('aud-1', 2026)).toEqual({
      anio: 2026,
      actividadesProcesadas: 0,
      periodosTotal: 0,
      creadasTotal: 0,
    });
  });
});

describe('OccurrenceGenerationService.generateNextYearForAllActive (cron)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('genera el año siguiente al actual para todas las actividades activas', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-12-15T10:00:00Z'));
    const prisma = buildPrisma();
    prisma.activity.findMany.mockResolvedValue([
      activity({ id: 'a1', frecuencia: Frecuencia.ANUAL }),
    ]);
    const service = buildService(prisma);

    await service.generateNextYearForAllActive();

    expect(prisma.activity.findMany).toHaveBeenCalledWith({
      where: { activa: true },
    });
    const data = prisma.activityOccurrence.createMany.mock.calls[0][0].data;
    expect(data[0].periodo).toBe('2027');
  });
});
