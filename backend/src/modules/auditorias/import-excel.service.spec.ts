import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EstadoActividad, Frecuencia } from '@prisma/client';
import { Workbook } from 'exceljs';
import { ImportExcelService } from './import-excel.service';

const NOW = new Date('2026-06-15T12:00:00Z');
const actor = { userId: 'u1', username: 'ana' };
const BASE = 'http://analytics:8000';

function build() {
  const prisma = {
    activity: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    activityOccurrence: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'new-occ' }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const activitiesService = {
    create: jest.fn().mockResolvedValue({ id: 'created-1' }),
    update: jest.fn().mockResolvedValue({}),
    deactivate: jest.fn().mockResolvedValue({ ok: true, eliminada: false }),
  };
  const config = { get: jest.fn().mockReturnValue(BASE) };
  const history = { logOccurrence: jest.fn().mockResolvedValue(undefined) };
  const service = new ImportExcelService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activitiesService as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history as any,
  );
  return { service, prisma, activitiesService, history };
}

const fila = (over: Record<string, unknown> = {}) => ({
  fila: 2,
  categoria: 'Servidores',
  nombre: 'Backups',
  responsable: 'Ana',
  frecuencia: 'MENSUAL',
  descripcionEvidencia: null,
  observacion: null,
  activa: true,
  fechaEspecifica: null,
  periodos: [] as { periodo: string; estado: string; esAdHoc: boolean }[],
  ...over,
});

function mockParse(
  parsed: { anio?: number; filas?: unknown[]; errores?: unknown[]; formato?: string },
  status = 200,
) {
  const body = { formato: 'plantilla', anio: 2026, filas: [], errores: [], ...parsed };
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeEach(() => {
  // Solo se falsea la fecha (Date); exceljs/streams necesitan timers reales.
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'queueMicrotask',
    ],
  });
});
afterEach(() => jest.useRealTimers());

describe('ImportExcelService.buildTemplate', () => {
  it('genera un .xlsx válido con hoja "Plantilla" (8 columnas + fila de ejemplo) y hoja "Valores válidos"', async () => {
    const { service } = build();
    const buffer = await service.buildTemplate();
    expect(Buffer.isBuffer(buffer)).toBe(true);

    const wb = new Workbook();
    await wb.xlsx.load(buffer as never);
    const plantilla = wb.getWorksheet('Plantilla')!;
    expect(plantilla).toBeDefined();
    const header = plantilla.getRow(1).values as unknown[];
    expect(header.slice(1)).toEqual([
      'Categoría',
      'Actividad',
      'Responsable',
      'Frecuencia',
      'Descripción y/o evidencia',
      'Observación',
      'Activa (Sí/No)',
      'Fecha específica (solo si Frecuencia = UNICA)',
    ]);
    expect(plantilla.getRow(2).getCell(4).value).toBe('MENSUAL');

    const legend = wb.getWorksheet('Valores válidos')!;
    const valores: unknown[] = [];
    legend.eachRow((row, n) => {
      if (n > 1) valores.push(row.getCell(1).value);
    });
    expect(valores).toEqual(Object.values(Frecuencia));
  });
});

describe('ImportExcelService - llamada a analytics-service', () => {
  it('envía multipart POST a /plan-trabajo/parse-excel con el Bearer', async () => {
    const { service } = build();
    const fetchMock = mockParse({});
    await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer abc');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/plan-trabajo/parse-excel`);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer abc' });
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBeTruthy();
  });

  it('error de red => InternalServerError', async () => {
    const { service } = build();
    global.fetch = jest.fn().mockRejectedValue(new Error('down')) as never;
    await expect(
      service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t'),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('400 => BadRequest con el detalle del servicio', async () => {
    const { service } = build();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Archivo corrupto' }),
    }) as never;
    await expect(
      service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t'),
    ).rejects.toThrow(new BadRequestException('Archivo corrupto'));
  });

  it('400 sin JSON parseable => BadRequest con mensaje por defecto', async () => {
    const { service } = build();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => {
        throw new Error('no json');
      },
    }) as never;
    await expect(
      service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t'),
    ).rejects.toThrow('El archivo no es un .xlsx válido');
  });

  it('otro error HTTP => InternalServerError con estado', async () => {
    const { service } = build();
    mockParse({}, 500);
    await expect(
      service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t'),
    ).rejects.toThrow(/500/);
  });
});

describe('ImportExcelService.importFromExcel - crear / actualizar', () => {
  it('crea la actividad cuando no existe (por categoría+nombre insensible a mayúsculas)', async () => {
    const { service, prisma, activitiesService } = build();
    mockParse({
      filas: [
        fila({
          descripcionEvidencia: 'captura',
          observacion: 'obs',
          activa: false,
        }),
      ],
    });
    const res = await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');

    expect(prisma.activity.findFirst.mock.calls[0][0].where).toEqual({
      auditoriaId: 'aud-1',
      categoria: { equals: 'Servidores', mode: 'insensitive' },
      nombre: { equals: 'Backups', mode: 'insensitive' },
    });
    expect(activitiesService.create).toHaveBeenCalledWith(
      'aud-1',
      {
        categoria: 'Servidores',
        nombre: 'Backups',
        responsable: 'Ana',
        frecuencia: 'MENSUAL',
        descripcionEvidencia: 'captura',
        observacion: 'obs',
        activa: false,
        fechaEspecifica: undefined,
      },
      actor,
    );
    expect(res).toMatchObject({ totalFilas: 1, creadas: 1, actualizadas: 0 });
  });

  it('actualiza cuando ya existe (reutiliza ActivitiesService.update)', async () => {
    const { service, prisma, activitiesService } = build();
    prisma.activity.findFirst.mockResolvedValue({ id: 'existente' });
    prisma.activity.findMany.mockResolvedValue([]);
    mockParse({ filas: [fila()] });
    const res = await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(activitiesService.update).toHaveBeenCalledWith(
      'aud-1',
      'existente',
      expect.objectContaining({ nombre: 'Backups', frecuencia: 'MENSUAL' }),
      actor,
    );
    expect(activitiesService.create).not.toHaveBeenCalled();
    expect(res).toMatchObject({ creadas: 0, actualizadas: 1 });
  });

  it('UNICA con fecha: el match incluye la fecha de la ocurrencia', async () => {
    const { service, prisma } = build();
    mockParse({
      filas: [fila({ frecuencia: 'UNICA', fechaEspecifica: '2026-10-05' })],
    });
    await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(prisma.activity.findFirst.mock.calls[0][0].where.occurrences).toEqual({
      some: { fechaProgramada: new Date('2026-10-05') },
    });
  });

  it('UNICA sin fecha o frecuencia periódica: el match NO incluye occurrences', async () => {
    const { service, prisma } = build();
    mockParse({
      filas: [
        fila({ frecuencia: 'UNICA', fechaEspecifica: null }),
        fila({ frecuencia: 'MENSUAL', fechaEspecifica: '2026-10-05' }),
      ],
    });
    await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    for (const call of prisma.activity.findFirst.mock.calls)
      expect(call[0].where.occurrences).toBeUndefined();
  });

  it('errores de análisis se propagan y cuentan en totalFilas', async () => {
    const { service } = build();
    mockParse({
      filas: [fila()],
      errores: [{ fila: 5, motivo: 'Frecuencia inválida' }],
    });
    const res = await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(res.totalFilas).toBe(2);
    expect(res.errores).toEqual([{ fila: 5, motivo: 'Frecuencia inválida' }]);
  });

  it('un fallo en una fila no aborta las demás y queda como error con su número de fila', async () => {
    const { service, activitiesService } = build();
    activitiesService.create
      .mockRejectedValueOnce(new Error('Validación falló'))
      .mockResolvedValueOnce({ id: 'ok-2' });
    mockParse({
      filas: [fila({ fila: 2, nombre: 'A' }), fila({ fila: 3, nombre: 'B' })],
    });
    const res = await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(res.creadas).toBe(1);
    expect(res.errores).toEqual([{ fila: 2, motivo: 'Validación falló' }]);
  });

  it('error no-Error se reporta como "Error desconocido"', async () => {
    const { service, activitiesService } = build();
    activitiesService.create.mockRejectedValueOnce('texto');
    mockParse({ filas: [fila()] });
    const res = await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(res.errores).toEqual([{ fila: 2, motivo: 'Error desconocido' }]);
  });
});

describe('ImportExcelService.importFromExcel - sincronización (sobrantes)', () => {
  it('remueve las actividades que no aparecen en el archivo, excluyendo las vistas', async () => {
    const { service, prisma, activitiesService } = build();
    prisma.activity.findFirst.mockResolvedValue({ id: 'existente' });
    prisma.activity.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
    activitiesService.deactivate
      .mockResolvedValueOnce({ ok: true, eliminada: true })
      .mockResolvedValueOnce({ ok: true, eliminada: false });
    mockParse({ filas: [fila()] });

    const res = await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');

    expect(prisma.activity.findMany).toHaveBeenCalledWith({
      where: { auditoriaId: 'aud-1', id: { notIn: ['existente'] } },
      select: { id: true },
    });
    expect(activitiesService.deactivate).toHaveBeenCalledTimes(2);
    expect(res).toMatchObject({ eliminadas: 1, desactivadas: 1 });
  });

  it('las actividades recién creadas también se protegen del barrido', async () => {
    const { service, prisma } = build();
    mockParse({ filas: [fila()] });
    await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(prisma.activity.findMany.mock.calls[0][0].where.id.notIn).toContain(
      'created-1',
    );
  });

  it('si la actualización de una existente falla, igual queda protegida del barrido', async () => {
    const { service, prisma, activitiesService } = build();
    prisma.activity.findFirst.mockResolvedValue({ id: 'existente' });
    activitiesService.update.mockRejectedValue(new Error('x'));
    mockParse({ filas: [fila()] });
    await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(prisma.activity.findMany.mock.calls[0][0].where.id.notIn).toEqual([
      'existente',
    ]);
  });

  it('archivo sin filas ni errores NO sincroniza (evita vaciar el plan por un archivo vacío)', async () => {
    const { service, prisma, activitiesService } = build();
    mockParse({ filas: [], errores: [] });
    const res = await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(res.totalFilas).toBe(0);
    expect(prisma.activity.findMany).not.toHaveBeenCalled();
    expect(activitiesService.deactivate).not.toHaveBeenCalled();
  });

  it('archivo solo con errores (sin filas válidas) SÍ sincroniza y remueve todo lo demás', async () => {
    // Caracterización: totalFilas > 0 por los errores, así que se procede al barrido.
    // Es el comportamiento actual (riesgo: un archivo totalmente inválido vacía el plan).
    const { service, prisma, activitiesService } = build();
    prisma.activity.findMany.mockResolvedValue([{ id: 's1' }]);
    mockParse({ filas: [], errores: [{ fila: 2, motivo: 'malo' }] });
    await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(activitiesService.deactivate).toHaveBeenCalledWith('aud-1', 's1', actor);
  });
});

describe('ImportExcelService.importFromExcel - sincronización de estados por periodo', () => {
  const occExistente = (over: Record<string, unknown> = {}) => ({
    id: 'occ-1',
    estado: EstadoActividad.PLANEADO,
    fechaProgramada: new Date('2026-03-31T00:00:00Z'),
    fechaEjecucion: null,
    ...over,
  });

  it('cambia el estado de la ocurrencia del periodo y deja historial', async () => {
    const { service, prisma, history } = build();
    prisma.activityOccurrence.findUnique.mockResolvedValue(occExistente());
    mockParse({
      anio: 2026,
      filas: [fila({ periodos: [{ periodo: '2026-03', estado: 'NO_REALIZADO', esAdHoc: false }] })],
    });
    const res = await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');

    expect(prisma.activityOccurrence.findUnique).toHaveBeenCalledWith({
      where: { activityId_periodo: { activityId: 'created-1', periodo: '2026-03' } },
    });
    expect(prisma.activityOccurrence.update).toHaveBeenCalledWith({
      where: { id: 'occ-1' },
      data: { estado: 'NO_REALIZADO', fechaEjecucion: null, updatedBy: 'u1' },
    });
    expect(history.logOccurrence).toHaveBeenCalledWith(
      'occ-1',
      'estado_importado_excel',
      actor,
      'estado',
      'PLANEADO',
      'NO_REALIZADO',
    );
    expect(res.estadosSincronizados).toBe(1);
  });

  it('EJECUTADO fija fechaEjecucion = fechaProgramada de la ocurrencia', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findUnique.mockResolvedValue(occExistente());
    mockParse({
      filas: [fila({ periodos: [{ periodo: '2026-03', estado: 'EJECUTADO', esAdHoc: false }] })],
    });
    await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(prisma.activityOccurrence.update.mock.calls[0][0].data.fechaEjecucion).toEqual(
      new Date('2026-03-31T00:00:00Z'),
    );
  });

  it('si ya tiene el mismo estado no hace nada', async () => {
    const { service, prisma, history } = build();
    prisma.activityOccurrence.findUnique.mockResolvedValue(
      occExistente({ estado: EstadoActividad.EJECUTADO }),
    );
    mockParse({
      filas: [fila({ periodos: [{ periodo: '2026-03', estado: 'EJECUTADO', esAdHoc: false }] })],
    });
    const res = await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(prisma.activityOccurrence.update).not.toHaveBeenCalled();
    expect(history.logOccurrence).not.toHaveBeenCalled();
    expect(res.estadosSincronizados).toBe(0);
  });

  it('periodo sin ocurrencia (no ad-hoc) se ignora', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findUnique.mockResolvedValue(null);
    mockParse({
      filas: [fila({ periodos: [{ periodo: '2026-03', estado: 'EJECUTADO', esAdHoc: false }] })],
    });
    const res = await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(prisma.activityOccurrence.create).not.toHaveBeenCalled();
    expect(res.estadosSincronizados).toBe(0);
  });

  it('ad-hoc sin ocurrencia: la crea con último día del mes, estado y fechaEjecucion si EJECUTADO', async () => {
    const { service, prisma, history } = build();
    prisma.activityOccurrence.findUnique.mockResolvedValue(null);
    mockParse({
      filas: [
        fila({
          frecuencia: 'A_DEMANDA',
          periodos: [{ periodo: '2026-02', estado: 'EJECUTADO', esAdHoc: true }],
        }),
      ],
    });
    const res = await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    const fecha = new Date(Date.UTC(2026, 1, 28));
    expect(prisma.activityOccurrence.create).toHaveBeenCalledWith({
      data: {
        activityId: 'created-1',
        periodo: '2026-02',
        fechaProgramada: fecha,
        estado: 'EJECUTADO',
        fechaEjecucion: fecha,
        createdBy: 'u1',
      },
    });
    expect(history.logOccurrence).toHaveBeenCalledWith(
      'new-occ',
      'creado_importado_excel',
      actor,
      'estado',
      undefined,
      'EJECUTADO',
    );
    expect(res.estadosSincronizados).toBe(1);
  });

  it('ad-hoc no EJECUTADO: fechaEjecucion queda undefined', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findUnique.mockResolvedValue(null);
    mockParse({
      filas: [
        fila({
          periodos: [{ periodo: '2026-04', estado: 'NO_REALIZADO', esAdHoc: true }],
        }),
      ],
    });
    await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(
      prisma.activityOccurrence.create.mock.calls[0][0].data.fechaEjecucion,
    ).toBeUndefined();
  });

  it('ad-hoc: febrero 2026 (no bisiesto) termina el 28', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findUnique.mockResolvedValue(null);
    mockParse({
      anio: 2026,
      filas: [
        fila({
          periodos: [{ periodo: '2026-02', estado: 'PLANEADO', esAdHoc: true }],
        }),
      ],
    });
    await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(
      prisma.activityOccurrence.create.mock.calls[0][0].data.fechaProgramada,
    ).toEqual(new Date(Date.UTC(2026, 1, 28)));
  });

  it('ad-hoc con formato de periodo inválido se ignora sin romper', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findUnique.mockResolvedValue(null);
    mockParse({
      filas: [
        fila({
          periodos: [{ periodo: '2026-Q1', estado: 'EJECUTADO', esAdHoc: true }],
        }),
      ],
    });
    const res = await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(prisma.activityOccurrence.create).not.toHaveBeenCalled();
    expect(res.errores).toEqual([]);
  });

  it('NO aplica estados si el año del archivo no es el año en curso', async () => {
    const { service, prisma } = build();
    mockParse({
      anio: 2025,
      filas: [fila({ periodos: [{ periodo: '2025-03', estado: 'EJECUTADO', esAdHoc: false }] })],
    });
    const res = await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(prisma.activityOccurrence.findUnique).not.toHaveBeenCalled();
    expect(res.estadosSincronizados).toBe(0);
  });

  it('suma estadosSincronizados de varios periodos y filas', async () => {
    const { service, prisma } = build();
    prisma.activityOccurrence.findUnique.mockResolvedValue(occExistente());
    mockParse({
      filas: [
        fila({
          nombre: 'A',
          periodos: [
            { periodo: '2026-01', estado: 'EJECUTADO', esAdHoc: false },
            { periodo: '2026-02', estado: 'EJECUTADO', esAdHoc: false },
          ],
        }),
        fila({
          nombre: 'B',
          periodos: [{ periodo: '2026-01', estado: 'EJECUTADO', esAdHoc: false }],
        }),
      ],
    });
    const res = await service.importFromExcel('aud-1', Buffer.from('x'), actor, 'Bearer t');
    expect(res.estadosSincronizados).toBe(3);
  });
});
