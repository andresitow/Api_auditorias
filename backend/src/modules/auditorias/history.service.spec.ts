import { HistoryService } from './history.service';

function build() {
  const prisma = {
    activityHistory: {
      create: jest.fn().mockResolvedValue({ id: 'h1' }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new HistoryService(prisma as any);
  return { service, prisma };
}

const actor = { userId: 'u1', username: 'ana' };

describe('HistoryService.logActivity / logOccurrence', () => {
  it('logActivity crea una fila ligada a la actividad con actor', async () => {
    const { service, prisma } = build();
    await service.logActivity('a1', 'editado', actor, 'activa', 'true', 'false');
    expect(prisma.activityHistory.create).toHaveBeenCalledWith({
      data: {
        activityId: 'a1',
        action: 'editado',
        campo: 'activa',
        valorAnterior: 'true',
        valorNuevo: 'false',
        userId: 'u1',
        username: 'ana',
      },
    });
  });

  it('logOccurrence crea una fila ligada a la ocurrencia (sin activityId)', async () => {
    const { service, prisma } = build();
    await service.logOccurrence('o1', 'creado', actor);
    const data = prisma.activityHistory.create.mock.calls[0][0].data;
    expect(data.occurrenceId).toBe('o1');
    expect(data).not.toHaveProperty('activityId');
    expect(data.action).toBe('creado');
    expect(data.campo).toBeUndefined();
  });

  it('acepta un actor vacío', async () => {
    const { service, prisma } = build();
    await service.logActivity('a1', 'creado', {});
    const data = prisma.activityHistory.create.mock.calls[0][0].data;
    expect(data.userId).toBeUndefined();
    expect(data.username).toBeUndefined();
  });
});

describe('HistoryService.logFieldDiffs', () => {
  it('solo registra los campos que cambiaron', async () => {
    const { service, prisma } = build();
    await service.logFieldDiffs(
      { activityId: 'a1' },
      'editado',
      actor,
      { nombre: 'A', responsable: 'Ana', activa: true },
      { nombre: 'A', responsable: 'Luis', activa: true },
    );
    expect(prisma.activityHistory.createMany).toHaveBeenCalledTimes(1);
    const rows = prisma.activityHistory.createMany.mock.calls[0][0].data;
    expect(rows).toEqual([
      {
        activityId: 'a1',
        action: 'editado',
        campo: 'responsable',
        valorAnterior: 'Ana',
        valorNuevo: 'Luis',
        userId: 'u1',
        username: 'ana',
      },
    ]);
  });

  it('no escribe nada si no hay diferencias', async () => {
    const { service, prisma } = build();
    await service.logFieldDiffs(
      { activityId: 'a1' },
      'editado',
      actor,
      { a: 1, b: 'x' },
      { a: 1, b: 'x' },
    );
    expect(prisma.activityHistory.createMany).not.toHaveBeenCalled();
  });

  it('ignora campos undefined en `after` (no enviados)', async () => {
    const { service, prisma } = build();
    await service.logFieldDiffs(
      { activityId: 'a1' },
      'editado',
      actor,
      { nombre: 'A' },
      { nombre: undefined },
    );
    expect(prisma.activityHistory.createMany).not.toHaveBeenCalled();
  });

  it('null/undefined previos se guardan como null y se distinguen de un valor real', async () => {
    const { service, prisma } = build();
    await service.logFieldDiffs(
      { occurrenceId: 'o1' },
      'estado_cambiado',
      actor,
      { observaciones: null },
      { observaciones: 'nueva' },
    );
    const [row] = prisma.activityHistory.createMany.mock.calls[0][0].data;
    expect(row).toMatchObject({
      occurrenceId: 'o1',
      campo: 'observaciones',
      valorAnterior: null,
      valorNuevo: 'nueva',
    });
  });

  it('pasar de valor a null se registra con valorNuevo null', async () => {
    const { service, prisma } = build();
    await service.logFieldDiffs(
      { activityId: 'a1' },
      'editado',
      actor,
      { observacion: 'algo' },
      { observacion: null },
    );
    const [row] = prisma.activityHistory.createMany.mock.calls[0][0].data;
    expect(row.valorAnterior).toBe('algo');
    expect(row.valorNuevo).toBeNull();
  });

  it('null y undefined previos equivalen (ambos comparan como cadena vacía) => cambio null->undefined no genera fila', async () => {
    const { service, prisma } = build();
    await service.logFieldDiffs(
      { activityId: 'a1' },
      'editado',
      actor,
      { x: null },
      { x: null },
    );
    expect(prisma.activityHistory.createMany).not.toHaveBeenCalled();
  });

  it('comparación tipo-agnóstica: 1 (number) y "1" (string) se consideran iguales', async () => {
    // Caracterización: stringifyDiffValue normaliza a texto antes de comparar.
    const { service, prisma } = build();
    await service.logFieldDiffs(
      { activityId: 'a1' },
      'editado',
      actor,
      { n: 1, b: true },
      { n: '1', b: 'true' },
    );
    expect(prisma.activityHistory.createMany).not.toHaveBeenCalled();
  });

  it('Date se compara y guarda como ISO', async () => {
    const { service, prisma } = build();
    const antes = new Date('2026-01-01T00:00:00Z');
    const despues = new Date('2026-02-01T00:00:00Z');
    await service.logFieldDiffs(
      { activityId: 'a1' },
      'editado',
      actor,
      { f: antes, g: antes },
      { f: despues, g: new Date(antes) },
    );
    const rows = prisma.activityHistory.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      campo: 'f',
      valorAnterior: '2026-01-01T00:00:00.000Z',
      valorNuevo: '2026-02-01T00:00:00.000Z',
    });
  });

  it('objetos se serializan con JSON.stringify (no "[object Object]")', async () => {
    const { service, prisma } = build();
    await service.logFieldDiffs(
      { activityId: 'a1' },
      'editado',
      actor,
      { o: { a: 1 } },
      { o: { a: 2 } },
    );
    const [row] = prisma.activityHistory.createMany.mock.calls[0][0].data;
    expect(row.valorAnterior).toBe('{"a":1}');
    expect(row.valorNuevo).toBe('{"a":2}');
  });

  it('booleanos y números se guardan como texto', async () => {
    const { service, prisma } = build();
    await service.logFieldDiffs(
      { activityId: 'a1' },
      'editado',
      actor,
      { activa: true, n: 1 },
      { activa: false, n: 2 },
    );
    const rows = prisma.activityHistory.createMany.mock.calls[0][0].data;
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ campo: 'activa', valorAnterior: 'true', valorNuevo: 'false' }),
        expect.objectContaining({ campo: 'n', valorAnterior: '1', valorNuevo: '2' }),
      ]),
    );
  });

  it('un campo que solo existe en `after` cuenta como cambio desde null', async () => {
    const { service, prisma } = build();
    await service.logFieldDiffs({ activityId: 'a1' }, 'editado', actor, {}, {
      responsable: 'Ana',
    });
    const [row] = prisma.activityHistory.createMany.mock.calls[0][0].data;
    expect(row.valorAnterior).toBeNull();
    expect(row.valorNuevo).toBe('Ana');
  });

  it('solo itera las llaves de `after` (campos borrados de `before` no aparecen)', async () => {
    const { service, prisma } = build();
    await service.logFieldDiffs(
      { activityId: 'a1' },
      'editado',
      actor,
      { a: 1, b: 2 },
      { a: 1 },
    );
    expect(prisma.activityHistory.createMany).not.toHaveBeenCalled();
  });
});

describe('HistoryService.listForActivity / listForOccurrence', () => {
  it('lista por actividad, más reciente primero', async () => {
    const { service, prisma } = build();
    await service.listForActivity('a1');
    expect(prisma.activityHistory.findMany).toHaveBeenCalledWith({
      where: { activityId: 'a1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('lista por ocurrencia, más reciente primero', async () => {
    const { service, prisma } = build();
    await service.listForOccurrence('o1');
    expect(prisma.activityHistory.findMany).toHaveBeenCalledWith({
      where: { occurrenceId: 'o1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
