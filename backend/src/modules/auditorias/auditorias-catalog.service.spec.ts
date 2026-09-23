import { NotFoundException } from '@nestjs/common';
import { EstadoActividad } from '@prisma/client';
import { AuditoriasCatalogService } from './auditorias-catalog.service';

function build() {
  const prisma = {
    auditoria: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'new' }),
      update: jest.fn().mockResolvedValue({ id: 'a1' }),
    },
    activity: { groupBy: jest.fn().mockResolvedValue([]) },
    activityOccurrence: { findMany: jest.fn().mockResolvedValue([]) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: new AuditoriasCatalogService(prisma as any), prisma };
}

describe('AuditoriasCatalogService.list', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00Z')));
  afterEach(() => jest.useRealTimers());

  it('devuelve totalActividades, totalOcurrencias y cumplimientoPct por auditoría con solo 3 consultas', async () => {
    const { service, prisma } = build();
    prisma.auditoria.findMany.mockResolvedValue([
      { id: 'a1', nombre: 'A' },
      { id: 'a2', nombre: 'B' },
      { id: 'a3', nombre: 'Vacía' },
    ]);
    prisma.activity.groupBy.mockResolvedValue([
      { auditoriaId: 'a1', _count: { _all: 5 } },
      { auditoriaId: 'a2', _count: { _all: 2 } },
    ]);
    prisma.activityOccurrence.findMany.mockResolvedValue([
      { estado: EstadoActividad.EJECUTADO, activity: { auditoriaId: 'a1' } },
      { estado: EstadoActividad.EJECUTADO, activity: { auditoriaId: 'a1' } },
      { estado: EstadoActividad.PLANEADO, activity: { auditoriaId: 'a1' } },
      { estado: EstadoActividad.NO_REALIZADO, activity: { auditoriaId: 'a2' } },
    ]);
    const res = await service.list();

    expect(res).toEqual([
      { id: 'a1', nombre: 'A', totalActividades: 5, totalOcurrencias: 3, cumplimientoPct: 67 },
      { id: 'a2', nombre: 'B', totalActividades: 2, totalOcurrencias: 1, cumplimientoPct: 0 },
      { id: 'a3', nombre: 'Vacía', totalActividades: 0, totalOcurrencias: 0, cumplimientoPct: 0 },
    ]);
    expect(prisma.auditoria.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.activity.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.activityOccurrence.findMany).toHaveBeenCalledTimes(1);
  });

  it('filtra ocurrencias por año en curso y actividades activas', async () => {
    const { service, prisma } = build();
    await service.list();
    expect(prisma.activityOccurrence.findMany.mock.calls[0][0].where).toEqual({
      periodo: { startsWith: '2026' },
      activity: { activa: true },
    });
    expect(prisma.activity.groupBy.mock.calls[0][0].where).toEqual({ activa: true });
  });
});

describe('AuditoriasCatalogService.get/create/update', () => {
  it('get lanza NotFound si no existe', async () => {
    const { service, prisma } = build();
    prisma.auditoria.findUnique.mockResolvedValue(null);
    await expect(service.get('x')).rejects.toThrow(NotFoundException);
  });

  it('create guarda createdBy del actor', async () => {
    const { service, prisma } = build();
    await service.create({ nombre: 'N', descripcion: 'D' }, { userId: 'u1', username: 'ana' });
    expect(prisma.auditoria.create).toHaveBeenCalledWith({
      data: { nombre: 'N', descripcion: 'D', createdBy: 'u1' },
    });
  });

  it('update valida existencia antes de actualizar', async () => {
    const { service, prisma } = build();
    prisma.auditoria.findUnique.mockResolvedValue(null);
    await expect(service.update('x', { nombre: 'Z' })).rejects.toThrow(NotFoundException);
    expect(prisma.auditoria.update).not.toHaveBeenCalled();
  });

  it('update aplica el dto', async () => {
    const { service, prisma } = build();
    prisma.auditoria.findUnique.mockResolvedValue({ id: 'a1' });
    await service.update('a1', { nombre: 'Z' });
    expect(prisma.auditoria.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { nombre: 'Z' },
    });
  });
});
