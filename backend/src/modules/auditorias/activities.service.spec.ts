import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Frecuencia } from '@prisma/client';
import { ActivitiesService } from './activities.service';

function build() {
  const prisma = {
    activity: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
    activityOccurrence: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const generation = {
    generateForYear: jest.fn().mockResolvedValue({ periodos: 12, creadas: 12 }),
  };
  const history = {
    logActivity: jest.fn().mockResolvedValue(undefined),
    logFieldDiffs: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ActivitiesService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generation as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history as any,
  );
  return { service, prisma, generation, history };
}

const actor = { userId: 'u1', username: 'ana' };

const baseDto = {
  categoria: 'Servidores',
  nombre: 'Revisar backups',
  responsable: 'Ana',
  frecuencia: Frecuencia.MENSUAL,
};

describe('ActivitiesService.list', () => {
  it('filtra por auditoría y ordena por categoría y nombre', async () => {
    const { service, prisma } = build();
    await service.list('aud-1', {});
    expect(prisma.activity.findMany).toHaveBeenCalledWith({
      where: {
        auditoriaId: 'aud-1',
        categoria: undefined,
        responsable: undefined,
        frecuencia: undefined,
        activa: undefined,
      },
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });
  });

  it('responsable usa contains insensible a mayúsculas', async () => {
    const { service, prisma } = build();
    await service.list('aud-1', { responsable: 'ana' });
    expect(prisma.activity.findMany.mock.calls[0][0].where.responsable).toEqual({
      contains: 'ana',
      mode: 'insensitive',
    });
  });

  it('q busca en nombre, descripcionEvidencia y responsable (OR)', async () => {
    const { service, prisma } = build();
    await service.list('aud-1', { q: 'back' });
    const or = prisma.activity.findMany.mock.calls[0][0].where.OR;
    expect(or).toHaveLength(3);
    expect(or).toEqual(
      expect.arrayContaining([
        { nombre: { contains: 'back', mode: 'insensitive' } },
        { descripcionEvidencia: { contains: 'back', mode: 'insensitive' } },
        { responsable: { contains: 'back', mode: 'insensitive' } },
      ]),
    );
  });

  it('activa=false se respeta (no se confunde con "sin filtro")', async () => {
    const { service, prisma } = build();
    await service.list('aud-1', { activa: false });
    expect(prisma.activity.findMany.mock.calls[0][0].where.activa).toBe(false);
  });
});

describe('ActivitiesService.distinctCategorias', () => {
  it('une el catálogo con las categorías personalizadas, ordenadas y con "Otros" al final', async () => {
    const { service, prisma } = build();
    prisma.activity.findMany.mockResolvedValue([
      { categoria: 'Zeta personalizada' },
      { categoria: 'Servidores' },
    ]);
    const res = await service.distinctCategorias('aud-1');
    expect(res).toContain('Zeta personalizada');
    expect(res.filter((c) => c === 'Servidores')).toHaveLength(1); // sin duplicados
    expect(res[res.length - 1]).toBe('Otros');
    const sinOtros = res.filter((c) => c !== 'Otros');
    expect(sinOtros).toEqual([...sinOtros].sort((a, b) => a.localeCompare(b)));
  });
});

describe('ActivitiesService.getWithOccurrences', () => {
  it('lanza NotFound si no existe en esa auditoría', async () => {
    const { service, prisma } = build();
    prisma.activity.findFirst.mockResolvedValue(null);
    await expect(service.getWithOccurrences('aud-1', 'x')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.activity.findFirst.mock.calls[0][0].where).toEqual({
      id: 'x',
      auditoriaId: 'aud-1',
    });
  });

  it('devuelve la actividad con ocurrencias ordenadas por fecha', async () => {
    const { service, prisma } = build();
    prisma.activity.findFirst.mockResolvedValue({ id: 'a1', occurrences: [] });
    await service.getWithOccurrences('aud-1', 'a1');
    expect(prisma.activity.findFirst.mock.calls[0][0].include).toEqual({
      occurrences: { orderBy: { fechaProgramada: 'asc' } },
    });
  });
});

describe('ActivitiesService.create', () => {
  function setupCreate(frecuencia: Frecuencia) {
    const ctx = build();
    const created = {
      id: 'a1',
      frecuencia,
      observacion: 'obs',
    };
    ctx.prisma.activity.create.mockResolvedValue(created);
    ctx.prisma.activity.findFirst.mockResolvedValue({ ...created, occurrences: [] });
    return { ...ctx, created };
  }

  it('crea la actividad con activa=true por defecto y createdBy del actor', async () => {
    const { service, prisma } = setupCreate(Frecuencia.MENSUAL);
    await service.create('aud-1', baseDto, actor);
    expect(prisma.activity.create.mock.calls[0][0].data).toMatchObject({
      auditoriaId: 'aud-1',
      categoria: 'Servidores',
      nombre: 'Revisar backups',
      responsable: 'Ana',
      frecuencia: Frecuencia.MENSUAL,
      activa: true,
      createdBy: 'u1',
    });
  });

  it('respeta activa=false', async () => {
    const { service, prisma } = setupCreate(Frecuencia.MENSUAL);
    await service.create('aud-1', { ...baseDto, activa: false }, actor);
    expect(prisma.activity.create.mock.calls[0][0].data.activa).toBe(false);
  });

  it('registra el historial "creado"', async () => {
    const { service, history } = setupCreate(Frecuencia.MENSUAL);
    await service.create('aud-1', baseDto, actor);
    expect(history.logActivity).toHaveBeenCalledWith('a1', 'creado', actor);
  });

  it('frecuencia periódica: genera ocurrencias del año en curso', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00Z'));
    try {
      const { service, generation, created } = setupCreate(Frecuencia.MENSUAL);
      await service.create('aud-1', baseDto, actor);
      expect(generation.generateForYear).toHaveBeenCalledWith(
        created,
        2026,
        undefined,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('pasa fechaInicio como Date al generador', async () => {
    const { service, generation } = setupCreate(Frecuencia.MENSUAL);
    await service.create(
      'aud-1',
      { ...baseDto, fechaInicio: '2026-07-01' },
      actor,
    );
    expect(generation.generateForYear.mock.calls[0][2]).toEqual(
      new Date('2026-07-01'),
    );
  });

  it('UNICA: no usa el generador; hace upsert de una sola ocurrencia con periodo AAAA-MM-DD-unica', async () => {
    const { service, generation, prisma } = setupCreate(Frecuencia.UNICA);
    await service.create(
      'aud-1',
      { ...baseDto, frecuencia: Frecuencia.UNICA, fechaEspecifica: '2026-09-05' },
      actor,
    );
    expect(generation.generateForYear).not.toHaveBeenCalled();
    expect(prisma.activityOccurrence.upsert).toHaveBeenCalledWith({
      where: {
        activityId_periodo: { activityId: 'a1', periodo: '2026-09-05-unica' },
      },
      update: {},
      create: {
        activityId: 'a1',
        periodo: '2026-09-05-unica',
        fechaProgramada: new Date('2026-09-05'),
        observaciones: 'obs',
      },
    });
  });

  it('UNICA sin fechaEspecifica: no crea ocurrencia ni genera', async () => {
    const { service, generation, prisma } = setupCreate(Frecuencia.UNICA);
    await service.create('aud-1', { ...baseDto, frecuencia: Frecuencia.UNICA }, actor);
    expect(generation.generateForYear).not.toHaveBeenCalled();
    expect(prisma.activityOccurrence.upsert).not.toHaveBeenCalled();
  });

  it('devuelve la actividad recargada con sus ocurrencias', async () => {
    const { service } = setupCreate(Frecuencia.MENSUAL);
    const res = await service.create('aud-1', baseDto, actor);
    expect(res).toMatchObject({ id: 'a1', occurrences: [] });
  });
});

describe('ActivitiesService.update', () => {
  const before = {
    id: 'a1',
    auditoriaId: 'aud-1',
    frecuencia: Frecuencia.MENSUAL,
    activa: true,
    nombre: 'X',
    observacion: 'obs',
  };

  function setupUpdate(beforeOver: Record<string, unknown> = {}) {
    const ctx = build();
    const prev = { ...before, ...beforeOver };
    ctx.prisma.activity.findFirst
      .mockResolvedValueOnce(prev) // lectura de `before`
      .mockResolvedValue({ ...prev, occurrences: [] }); // getWithOccurrences
    ctx.prisma.activity.update.mockImplementation(async ({ data }) => ({
      ...prev,
      ...data,
    }));
    return ctx;
  }

  it('lanza NotFound si no existe', async () => {
    const { service, prisma } = build();
    prisma.activity.findFirst.mockResolvedValue(null);
    await expect(service.update('aud-1', 'x', {}, actor)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.activity.update).not.toHaveBeenCalled();
  });

  it('no envía fechaEspecifica/fechaInicio a Prisma (no son columnas)', async () => {
    const { service, prisma } = setupUpdate();
    await service.update(
      'aud-1',
      'a1',
      { nombre: 'Y', fechaEspecifica: '2026-01-01', fechaInicio: '2026-02-01' },
      actor,
    );
    expect(prisma.activity.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { nombre: 'Y' },
    });
  });

  it('registra el historial de diferencias contra el estado previo', async () => {
    const { service, history } = setupUpdate();
    const dto = { nombre: 'Y' };
    await service.update('aud-1', 'a1', dto, actor);
    expect(history.logFieldDiffs).toHaveBeenCalledWith(
      { activityId: 'a1' },
      'editado',
      actor,
      expect.objectContaining({ nombre: 'X' }),
      dto,
    );
  });

  it('cambio de frecuencia regenera ocurrencias', async () => {
    const { service, generation } = setupUpdate();
    await service.update(
      'aud-1',
      'a1',
      { frecuencia: Frecuencia.TRIMESTRAL },
      actor,
    );
    expect(generation.generateForYear).toHaveBeenCalledTimes(1);
  });

  it('misma frecuencia no regenera', async () => {
    const { service, generation } = setupUpdate();
    await service.update(
      'aud-1',
      'a1',
      { frecuencia: Frecuencia.MENSUAL, nombre: 'Z' },
      actor,
    );
    expect(generation.generateForYear).not.toHaveBeenCalled();
  });

  it('reactivar (activa false -> true) regenera ocurrencias', async () => {
    const { service, generation } = setupUpdate({ activa: false });
    await service.update('aud-1', 'a1', { activa: true }, actor);
    expect(generation.generateForYear).toHaveBeenCalledTimes(1);
  });

  it('activa=true sobre una ya activa no regenera', async () => {
    const { service, generation } = setupUpdate({ activa: true });
    await service.update('aud-1', 'a1', { activa: true }, actor);
    expect(generation.generateForYear).not.toHaveBeenCalled();
  });

  it('desactivar (activa=false) no regenera', async () => {
    const { service, generation } = setupUpdate({ activa: true });
    await service.update('aud-1', 'a1', { activa: false }, actor);
    expect(generation.generateForYear).not.toHaveBeenCalled();
  });

  it('cambiar frecuencia Y reactivar regenera dos veces (idempotente por diseño del generador)', async () => {
    // Caracterización: hoy ensureOccurrences se invoca una vez por cada condición.
    const { service, generation } = setupUpdate({ activa: false });
    await service.update(
      'aud-1',
      'a1',
      { frecuencia: Frecuencia.SEMESTRAL, activa: true },
      actor,
    );
    expect(generation.generateForYear).toHaveBeenCalledTimes(2);
  });

  it('cambiar a UNICA con fechaEspecifica crea la ocurrencia única', async () => {
    const { service, prisma } = setupUpdate();
    await service.update(
      'aud-1',
      'a1',
      { frecuencia: Frecuencia.UNICA, fechaEspecifica: '2026-11-20' },
      actor,
    );
    expect(prisma.activityOccurrence.upsert.mock.calls[0][0].create.periodo).toBe(
      '2026-11-20-unica',
    );
  });
});

describe('ActivitiesService.deactivate', () => {
  it('lanza NotFound si no existe', async () => {
    const { service, prisma } = build();
    prisma.activity.findFirst.mockResolvedValue(null);
    await expect(service.deactivate('aud-1', 'x', actor)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('sin ocurrencias: borra físicamente la actividad', async () => {
    const { service, prisma, history } = build();
    prisma.activity.findFirst.mockResolvedValue({
      id: 'a1',
      _count: { occurrences: 0 },
    });
    const res = await service.deactivate('aud-1', 'a1', actor);
    expect(res).toEqual({ ok: true, eliminada: true });
    expect(prisma.activity.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    expect(prisma.activity.update).not.toHaveBeenCalled();
    expect(history.logActivity).not.toHaveBeenCalled();
  });

  it('con ocurrencias: desactiva conservando historial y deja rastro', async () => {
    const { service, prisma, history } = build();
    prisma.activity.findFirst.mockResolvedValue({
      id: 'a1',
      _count: { occurrences: 4 },
    });
    const res = await service.deactivate('aud-1', 'a1', actor);
    expect(res).toEqual({ ok: true, eliminada: false });
    expect(prisma.activity.delete).not.toHaveBeenCalled();
    expect(prisma.activity.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { activa: false },
    });
    expect(history.logActivity).toHaveBeenCalledWith(
      'a1',
      'editado',
      actor,
      'activa',
      'true',
      'false',
    );
  });
});

describe('ActivitiesService.generateForYear', () => {
  it('lanza NotFound si la actividad no existe', async () => {
    const { service, prisma } = build();
    prisma.activity.findFirst.mockResolvedValue(null);
    await expect(service.generateForYear('aud-1', 'x', 2026)).rejects.toThrow(
      NotFoundException,
    );
  });

  it.each([1999, 2101, 0, -5])('rechaza el año %i', async (anio) => {
    const { service, prisma, generation } = build();
    prisma.activity.findFirst.mockResolvedValue({ id: 'a1' });
    await expect(service.generateForYear('aud-1', 'a1', anio)).rejects.toThrow(
      BadRequestException,
    );
    expect(generation.generateForYear).not.toHaveBeenCalled();
  });

  it.each([2000, 2026, 2100])('acepta el año %i (límites inclusivos)', async (anio) => {
    const { service, prisma, generation } = build();
    const activity = { id: 'a1' };
    prisma.activity.findFirst.mockResolvedValue(activity);
    await service.generateForYear('aud-1', 'a1', anio);
    expect(generation.generateForYear).toHaveBeenCalledWith(activity, anio);
  });
});
