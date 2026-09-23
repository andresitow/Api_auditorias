import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstadoActividad, Frecuencia } from '@prisma/client';
import { unlink } from 'fs/promises';
import { OccurrencesService } from './occurrences.service';

jest.mock('fs/promises', () => ({ unlink: jest.fn() }));
// Evita los efectos de importación (mkdirSync de uploads/) y fija rutas conocidas.
jest.mock('./evidencia-upload.config', () => ({
  EVIDENCIA_IMAGENES_DIR: '/tmp/evidencias',
  EVIDENCIA_IMAGENES_URL_PREFIX: '/uploads/evidencias',
}));

const NOW = new Date('2026-06-15T12:00:00Z');
const DAY = 86_400_000;
const actor = { userId: 'u1', username: 'ana' };

function build() {
  const prisma = {
    activityOccurrence: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'o1', ...data })),
      create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'new', ...data })),
      delete: jest.fn().mockReturnValue('DELETE_OCC_OP'),
    },
    activity: { findFirst: jest.fn() },
    deletedActivity: { create: jest.fn().mockReturnValue('CREATE_DELETED_OP') },
    activityHistory: { create: jest.fn().mockReturnValue('CREATE_HISTORY_OP') },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const activitiesService = {
    deactivate: jest.fn().mockResolvedValue({ ok: true, eliminada: false }),
  };
  const history = {
    logFieldDiffs: jest.fn().mockResolvedValue(undefined),
    logOccurrence: jest.fn().mockResolvedValue(undefined),
    listForOccurrence: jest.fn().mockResolvedValue([]),
  };
  const service = new OccurrencesService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activitiesService as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history as any,
  );
  return { service, prisma, activitiesService, history };
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
  (unlink as jest.Mock).mockReset().mockResolvedValue(undefined);
});
afterEach(() => jest.useRealTimers());

describe('OccurrencesService.list', () => {
  const whereOf = (prisma: ReturnType<typeof build>['prisma']) =>
    prisma.activityOccurrence.findMany.mock.calls[0][0].where;

  it('por defecto filtra por el año en curso, auditoría y actividades activas', () => {
    const { service, prisma } = build();
    void service.list('aud-1', {});
    const where = whereOf(prisma);
    expect(where.periodo).toEqual({ startsWith: '2026' });
    expect(where.activity).toMatchObject({ auditoriaId: 'aud-1', activa: true });
  });

  it('usa filters.anio cuando se indica', () => {
    const { service, prisma } = build();
    void service.list('aud-1', { anio: 2025 });
    expect(whereOf(prisma).periodo).toEqual({ startsWith: '2025' });
  });

  it('periodo explícito tiene prioridad sobre el año', () => {
    const { service, prisma } = build();
    void service.list('aud-1', { anio: 2025, periodo: '2026-03' });
    expect(whereOf(prisma).periodo).toBe('2026-03');
  });

  it('ordena por fecha programada ascendente e incluye actividad y evidencias', () => {
    const { service, prisma } = build();
    void service.list('aud-1', {});
    const arg = prisma.activityOccurrence.findMany.mock.calls[0][0];
    expect(arg.orderBy).toEqual({ fechaProgramada: 'asc' });
    expect(arg.include).toEqual({ activity: true, evidencias: true });
  });

  it('filtros de actividad: categoría, frecuencia y responsable (insensible)', () => {
    const { service, prisma } = build();
    void service.list('aud-1', {
      categoria: 'Switches',
      frecuencia: Frecuencia.MENSUAL,
      responsable: 'ana',
      estado: EstadoActividad.EJECUTADO,
    });
    const where = whereOf(prisma);
    expect(where.estado).toBe(EstadoActividad.EJECUTADO);
    expect(where.activity).toMatchObject({
      categoria: 'Switches',
      frecuencia: Frecuencia.MENSUAL,
      responsable: { contains: 'ana', mode: 'insensitive' },
    });
  });

  it('q busca en nombre y responsable de la actividad', () => {
    const { service, prisma } = build();
    void service.list('aud-1', { q: 'zz' });
    expect(whereOf(prisma).activity.OR).toEqual([
      { nombre: { contains: 'zz', mode: 'insensitive' } },
      { responsable: { contains: 'zz', mode: 'insensitive' } },
    ]);
  });

  it('rango de fechas: gte/lte como Date', () => {
    const { service, prisma } = build();
    void service.list('aud-1', {
      fechaDesde: '2026-01-01',
      fechaHasta: '2026-03-31',
    });
    expect(whereOf(prisma).fechaProgramada).toEqual({
      gte: new Date('2026-01-01'),
      lte: new Date('2026-03-31'),
    });
  });

  it('solo fechaDesde deja lte undefined', () => {
    const { service, prisma } = build();
    void service.list('aud-1', { fechaDesde: '2026-01-01' });
    expect(whereOf(prisma).fechaProgramada).toEqual({
      gte: new Date('2026-01-01'),
      lte: undefined,
    });
  });

  it('overdue: PLANEADO con fecha anterior a ahora (sobrescribe estado)', () => {
    const { service, prisma } = build();
    void service.list('aud-1', { overdue: true, estado: EstadoActividad.EJECUTADO });
    const where = whereOf(prisma);
    expect(where.estado).toBe(EstadoActividad.PLANEADO);
    expect(where.fechaProgramada).toEqual({ lt: NOW });
  });

  it('dueSoon: PLANEADO entre ahora y ahora + 7 días', () => {
    const { service, prisma } = build();
    void service.list('aud-1', { dueSoon: true });
    const where = whereOf(prisma);
    expect(where.estado).toBe(EstadoActividad.PLANEADO);
    expect(where.fechaProgramada).toEqual({
      gte: NOW,
      lte: new Date(NOW.getTime() + 7 * DAY),
    });
  });
});

describe('OccurrencesService.getDetail / getHistory', () => {
  it('getDetail lanza NotFound si no pertenece a la auditoría', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(null);
    await expect(service.getDetail('aud-1', 'o1')).rejects.toThrow(NotFoundException);
    expect(prisma.activityOccurrence.findFirst.mock.calls[0][0].where).toEqual({
      id: 'o1',
      activity: { auditoriaId: 'aud-1' },
    });
  });

  it('getHistory valida existencia y devuelve el historial', async () => {
    const { service, prisma, history } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue({ id: 'o1' });
    history.listForOccurrence.mockResolvedValue([{ id: 'h1' }]);
    expect(await service.getHistory('aud-1', 'o1')).toEqual([{ id: 'h1' }]);
  });

  it('getHistory no consulta historial si la ocurrencia no existe', async () => {
    const { service, prisma, history } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(null);
    await expect(service.getHistory('aud-1', 'o1')).rejects.toThrow(NotFoundException);
    expect(history.listForOccurrence).not.toHaveBeenCalled();
  });
});

describe('OccurrencesService.changeEstado', () => {
  const before = {
    id: 'o1',
    estado: EstadoActividad.PLANEADO,
    observaciones: 'previa',
    fechaEjecucion: null as Date | null,
    evidencias: [
      { id: 'e1', url: '/uploads/evidencias/a.png' },
      { id: 'e2', url: '/uploads/evidencias/b.png' },
    ],
  };

  it('lanza NotFound si la ocurrencia no existe', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(null);
    await expect(
      service.changeEstado('aud-1', 'o1', { estado: EstadoActividad.NO_REALIZADO }, actor),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.activityOccurrence.update).not.toHaveBeenCalled();
  });

  it('EJECUTADO: guarda fechaEjecucion del dto y updatedBy', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(before);
    await service.changeEstado(
      'aud-1',
      'o1',
      { estado: EstadoActividad.EJECUTADO, fechaEjecucion: '2026-06-10' },
      actor,
    );
    const data = prisma.activityOccurrence.update.mock.calls[0][0].data;
    expect(data.estado).toBe(EstadoActividad.EJECUTADO);
    expect(data.fechaEjecucion).toEqual(new Date('2026-06-10'));
    expect(data.updatedBy).toBe('u1');
  });

  it('estado distinto de EJECUTADO conserva la fechaEjecucion previa (ignora la del dto)', async () => {
    const { service, prisma } = build();
    const previa = new Date('2026-05-01');
    prisma.activityOccurrence.findFirst.mockResolvedValue({
      ...before,
      fechaEjecucion: previa,
    });
    await service.changeEstado(
      'aud-1',
      'o1',
      { estado: EstadoActividad.NO_REALIZADO, fechaEjecucion: '2026-06-10' },
      actor,
    );
    expect(prisma.activityOccurrence.update.mock.calls[0][0].data.fechaEjecucion).toEqual(
      previa,
    );
  });

  it('registra en historial solo lo que cambió, con la fechaEjecucion realmente escrita', async () => {
    const { service, prisma, history } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(before);
    await service.changeEstado(
      'aud-1',
      'o1',
      {
        estado: EstadoActividad.EJECUTADO,
        fechaEjecucion: '2026-06-10T00:00:00.000Z',
        observaciones: 'listo',
      },
      actor,
    );
    expect(history.logFieldDiffs).toHaveBeenCalledWith(
      { occurrenceId: 'o1' },
      'estado_cambiado',
      actor,
      { estado: 'PLANEADO', observaciones: 'previa', fechaEjecucion: null },
      {
        estado: 'EJECUTADO',
        observaciones: 'listo',
        fechaEjecucion: '2026-06-10T00:00:00.000Z',
      },
    );
  });

  it('no-EJECUTADO sin fecha previa: historial registra fechaEjecucion null en before y after', async () => {
    const { service, prisma, history } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(before);
    await service.changeEstado(
      'aud-1',
      'o1',
      { estado: EstadoActividad.NO_REALIZADO },
      actor,
    );
    const [, , , b, a] = history.logFieldDiffs.mock.calls[0];
    expect(b.fechaEjecucion).toBeNull();
    expect(a.fechaEjecucion).toBeNull();
  });

  it('elimina solo las evidencias solicitadas que pertenecen a la ocurrencia', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(before);
    await service.changeEstado(
      'aud-1',
      'o1',
      {
        estado: EstadoActividad.NO_REALIZADO,
        eliminarEvidenciaIds: ['e1', 'ajena'],
      },
      actor,
    );
    const data = prisma.activityOccurrence.update.mock.calls[0][0].data;
    expect(data.evidencias).toEqual({ deleteMany: { id: { in: ['e1'] } } });
    expect(unlink).toHaveBeenCalledTimes(1);
    expect((unlink as jest.Mock).mock.calls[0][0]).toMatch(/a\.png$/);
  });

  it('sin evidencias que eliminar ni subir no toca la relación evidencias', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(before);
    await service.changeEstado(
      'aud-1',
      'o1',
      { estado: EstadoActividad.NO_REALIZADO },
      actor,
    );
    expect(prisma.activityOccurrence.update.mock.calls[0][0].data.evidencias).toBeUndefined();
    expect(unlink).not.toHaveBeenCalled();
  });

  it('crea registros de evidencia para los archivos subidos', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(before);
    const file = {
      filename: 'uuid.png',
      originalname: 'captura.png',
      mimetype: 'image/png',
      size: 1234,
    } as Express.Multer.File;
    await service.changeEstado(
      'aud-1',
      'o1',
      { estado: EstadoActividad.NO_REALIZADO },
      actor,
      [file],
    );
    expect(prisma.activityOccurrence.update.mock.calls[0][0].data.evidencias).toEqual({
      create: [
        {
          url: '/uploads/evidencias/uuid.png',
          nombreOriginal: 'captura.png',
          mimeType: 'image/png',
          tamano: 1234,
          createdBy: 'u1',
        },
      ],
    });
  });

  it('puede eliminar y agregar evidencias a la vez', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(before);
    await service.changeEstado(
      'aud-1',
      'o1',
      { estado: EstadoActividad.NO_REALIZADO, eliminarEvidenciaIds: ['e2'] },
      actor,
      [{ filename: 'n.png', originalname: 'n.png', mimetype: 'image/png', size: 1 } as Express.Multer.File],
    );
    const ev = prisma.activityOccurrence.update.mock.calls[0][0].data.evidencias;
    expect(ev.deleteMany).toEqual({ id: { in: ['e2'] } });
    expect(ev.create).toHaveLength(1);
  });

  it('un fallo al borrar el archivo del disco no rompe la operación', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(before);
    (unlink as jest.Mock).mockRejectedValue(new Error('ENOENT'));
    await expect(
      service.changeEstado(
        'aud-1',
        'o1',
        { estado: EstadoActividad.NO_REALIZADO, eliminarEvidenciaIds: ['e1'] },
        actor,
      ),
    ).resolves.toBeDefined();
  });

  it('el borrado en disco ocurre DESPUÉS del update en base de datos', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(before);
    const order: string[] = [];
    prisma.activityOccurrence.update.mockImplementation(async () => {
      order.push('update');
      return { id: 'o1' };
    });
    (unlink as jest.Mock).mockImplementation(async () => {
      order.push('unlink');
    });
    await service.changeEstado(
      'aud-1',
      'o1',
      { estado: EstadoActividad.NO_REALIZADO, eliminarEvidenciaIds: ['e1'] },
      actor,
    );
    expect(order).toEqual(['update', 'unlink']);
  });

  // BUG POTENCIAL (defensa en profundidad): el DTO valida fechaEjecucion solo por
  // class-validator. Si el servicio se invoca sin pasar por el ValidationPipe con
  // estado EJECUTADO y sin fecha, `new Date(undefined)` produce "Invalid Date" y
  // `.toISOString()` lanza RangeError en el historial en lugar de un 400 claro.
  it.skip('EJECUTADO sin fechaEjecucion debería rechazarse con BadRequest (esperado) - hoy lanza RangeError/Prisma error (obtenido)', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(before);
    await expect(
      service.changeEstado('aud-1', 'o1', { estado: EstadoActividad.EJECUTADO }, actor),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('OccurrencesService.reprogram', () => {
  it('lanza NotFound si no existe', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(null);
    await expect(
      service.reprogram('aud-1', 'o1', { nuevaFecha: '2026-07-01', motivo: 'x' }, actor),
    ).rejects.toThrow(NotFoundException);
  });

  it('cambia fecha, estado REPROGRAMADO, incrementa contador y guarda motivo en historial', async () => {
    const { service, prisma, history } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue({
      id: 'o1',
      fechaProgramada: new Date('2026-06-30T00:00:00Z'),
    });
    await service.reprogram(
      'aud-1',
      'o1',
      { nuevaFecha: '2026-07-15', motivo: 'Falta de personal' },
      actor,
    );
    expect(prisma.activityOccurrence.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: {
        fechaProgramada: new Date('2026-07-15'),
        estado: EstadoActividad.REPROGRAMADO,
        reprogramaciones: { increment: 1 },
        updatedBy: 'u1',
      },
    });
    expect(history.logOccurrence).toHaveBeenCalledWith(
      'o1',
      'reprogramado',
      actor,
      'Falta de personal',
      '2026-06-30',
      '2026-07-15',
    );
  });
});

describe('OccurrencesService.editarFecha', () => {
  it('lanza NotFound si no existe', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(null);
    await expect(
      service.editarFecha('aud-1', 'o1', { fechaProgramada: '2026-07-01' }, actor),
    ).rejects.toThrow(NotFoundException);
  });

  it('cambia solo la fecha: no toca estado ni contador, y reinicia notificadoDias', async () => {
    const { service, prisma, history } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue({
      id: 'o1',
      fechaProgramada: new Date('2026-06-30T00:00:00Z'),
    });
    await service.editarFecha('aud-1', 'o1', { fechaProgramada: '2026-07-01' }, actor);
    const data = prisma.activityOccurrence.update.mock.calls[0][0].data;
    expect(data).toEqual({
      fechaProgramada: new Date('2026-07-01'),
      notificadoDias: [],
      updatedBy: 'u1',
    });
    expect(data).not.toHaveProperty('estado');
    expect(data).not.toHaveProperty('reprogramaciones');
    expect(history.logOccurrence).toHaveBeenCalledWith(
      'o1',
      'fecha_editada',
      actor,
      'fechaProgramada',
      '2026-06-30',
      '2026-07-01',
    );
  });
});

describe('OccurrencesService.createAdHoc', () => {
  it('lanza NotFound si la actividad no es de la auditoría', async () => {
    const { service, prisma } = build();
    prisma.activity.findFirst.mockResolvedValue(null);
    await expect(
      service.createAdHoc('aud-1', { activityId: 'a1', fechaProgramada: '2026-06-01' }, actor),
    ).rejects.toThrow(NotFoundException);
  });

  it.each([
    Frecuencia.MENSUAL,
    Frecuencia.UNICA,
    Frecuencia.ANUAL,
    Frecuencia.DIARIO,
  ])('rechaza actividades de frecuencia %s', async (frecuencia) => {
    const { service, prisma } = build();
    prisma.activity.findFirst.mockResolvedValue({ id: 'a1', frecuencia });
    await expect(
      service.createAdHoc('aud-1', { activityId: 'a1', fechaProgramada: '2026-06-01' }, actor),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.activityOccurrence.create).not.toHaveBeenCalled();
  });

  it.each([Frecuencia.A_DEMANDA, Frecuencia.CUANDO_SE_REQUIERA])(
    'acepta %s: crea ocurrencia con periodo AAAA-MM-<sufijo aleatorio> y registra historial',
    async (frecuencia) => {
      const { service, prisma, history } = build();
      prisma.activity.findFirst.mockResolvedValue({ id: 'a1', frecuencia });
      await service.createAdHoc(
        'aud-1',
        { activityId: 'a1', fechaProgramada: '2026-08-20', observaciones: 'obs' },
        actor,
      );
      const data = prisma.activityOccurrence.create.mock.calls[0][0].data;
      expect(data.periodo).toMatch(/^2026-08-[a-z0-9]{1,6}$/);
      expect(data).toMatchObject({
        activityId: 'a1',
        fechaProgramada: new Date('2026-08-20'),
        observaciones: 'obs',
        createdBy: 'u1',
      });
      expect(history.logOccurrence).toHaveBeenCalledWith('new', 'creado', actor);
    },
  );

  it('dos altas en la misma fecha generan periodos distintos (sufijo aleatorio)', async () => {
    const { service, prisma } = build();
    prisma.activity.findFirst.mockResolvedValue({
      id: 'a1',
      frecuencia: Frecuencia.A_DEMANDA,
    });
    const dto = { activityId: 'a1', fechaProgramada: '2026-08-20' };
    await service.createAdHoc('aud-1', dto, actor);
    await service.createAdHoc('aud-1', dto, actor);
    const [p1, p2] = prisma.activityOccurrence.create.mock.calls.map(
      (c) => c[0].data.periodo,
    );
    expect(p1).not.toBe(p2);
  });
});

describe('OccurrencesService.remove', () => {
  const occurrence = (over: Record<string, unknown> = {}) => ({
    id: 'o1',
    activityId: 'a1',
    periodo: '2026-03',
    fechaProgramada: new Date('2026-03-31T00:00:00Z'),
    evidencias: [{ id: 'e1', url: '/uploads/evidencias/x.pdf' }],
    activity: {
      categoria: 'Servidores',
      nombre: 'Backups',
      responsable: 'Ana',
      frecuencia: Frecuencia.MENSUAL,
      _count: { occurrences: 12 },
    },
    ...over,
  });

  it('lanza NotFound si la ocurrencia no es de la auditoría', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(null);
    await expect(
      service.remove('aud-1', 'o1', { motivo: 'x' }, actor),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('archiva, registra y borra en una única transacción, en ese orden', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(occurrence());
    await service.remove('aud-1', 'o1', { motivo: 'Duplicada' }, actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toEqual([
      'CREATE_DELETED_OP',
      'CREATE_HISTORY_OP',
      'DELETE_OCC_OP',
    ]);
  });

  it('la foto de DeletedActivity congela datos de la actividad, motivo, actor e historial', async () => {
    const { service, prisma, history } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(occurrence());
    history.listForOccurrence.mockResolvedValue([
      {
        action: 'creado',
        campo: null,
        valorAnterior: null,
        valorNuevo: null,
        username: 'ana',
        createdAt: new Date('2026-01-02T03:04:05Z'),
      },
    ]);
    await service.remove('aud-1', 'o1', { motivo: 'Duplicada' }, actor);
    expect(prisma.deletedActivity.create).toHaveBeenCalledWith({
      data: {
        auditoriaId: 'aud-1',
        categoria: 'Servidores',
        nombre: 'Backups',
        responsable: 'Ana',
        frecuencia: Frecuencia.MENSUAL,
        periodo: '2026-03',
        fechaProgramada: new Date('2026-03-31T00:00:00Z'),
        motivo: 'Duplicada',
        historial: [
          {
            action: 'creado',
            campo: null,
            valorAnterior: null,
            valorNuevo: null,
            username: 'ana',
            createdAt: '2026-01-02T03:04:05.000Z',
          },
        ],
        eliminadoPor: 'u1',
        eliminadoPorUsername: 'ana',
      },
    });
  });

  it('deja rastro en el historial de la actividad (no de la ocurrencia)', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(occurrence());
    await service.remove('aud-1', 'o1', { motivo: 'x' }, actor);
    expect(prisma.activityHistory.create).toHaveBeenCalledWith({
      data: {
        activityId: 'a1',
        action: 'ocurrencia_eliminada',
        campo: 'periodo',
        valorAnterior: '2026-03',
        userId: 'u1',
        username: 'ana',
      },
    });
  });

  it('borra del disco las evidencias de la ocurrencia', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(occurrence());
    await service.remove('aud-1', 'o1', { motivo: 'x' }, actor);
    expect(unlink).toHaveBeenCalledTimes(1);
    expect((unlink as jest.Mock).mock.calls[0][0]).toMatch(/x\.pdf$/);
  });

  it('si quedan otras ocurrencias no toca la actividad', async () => {
    const { service, prisma, activitiesService } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(occurrence());
    const res = await service.remove('aud-1', 'o1', { motivo: 'x' }, actor);
    expect(res).toEqual({ ok: true, actividadEliminada: false });
    expect(activitiesService.deactivate).not.toHaveBeenCalled();
  });

  it('si era la última ocurrencia delega en ActivitiesService.deactivate', async () => {
    const { service, prisma, activitiesService } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(
      occurrence({
        activity: {
          categoria: 'c',
          nombre: 'n',
          responsable: 'r',
          frecuencia: Frecuencia.A_DEMANDA,
          _count: { occurrences: 1 },
        },
      }),
    );
    activitiesService.deactivate.mockResolvedValue({ ok: true, eliminada: true });
    const res = await service.remove('aud-1', 'o1', { motivo: 'x' }, actor);
    expect(activitiesService.deactivate).toHaveBeenCalledWith('aud-1', 'a1', actor);
    expect(res).toEqual({ ok: true, actividadEliminada: true });
  });

  it('si la transacción falla no se borran archivos ni se desactiva la actividad', async () => {
    const { service, prisma, activitiesService } = build();
    prisma.activityOccurrence.findFirst.mockResolvedValue(
      occurrence({
        activity: {
          categoria: 'c',
          nombre: 'n',
          responsable: 'r',
          frecuencia: Frecuencia.MENSUAL,
          _count: { occurrences: 1 },
        },
      }),
    );
    prisma.$transaction.mockRejectedValue(new Error('db down'));
    await expect(
      service.remove('aud-1', 'o1', { motivo: 'x' }, actor),
    ).rejects.toThrow('db down');
    expect(unlink).not.toHaveBeenCalled();
    expect(activitiesService.deactivate).not.toHaveBeenCalled();
  });
});
