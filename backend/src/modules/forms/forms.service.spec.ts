import { FormsService } from './forms.service';

function build() {
  const prisma = {
    diagnosticForm: {
      create: jest.fn().mockResolvedValue({ id: 'f1' }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    formOption: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: new FormsService(prisma as any), prisma };
}

describe('FormsService.createDiagnostic', () => {
  const dto = {
    sesionTipo: 'Remota',
    motivo: 'Lentitud',
    cliente: 'ACME',
    nit: '900123',
    urlProduccion: 'https://prod',
    urlPruebas: 'https://pruebas',
    urlPortalIt: 'https://portal',
    fecha: '2026-06-15',
    sistemaOperativo: 'Windows 11',
    navegadores: ['Chrome'],
    navegadorOtro: undefined,
    isp: 'Claro',
    megas: 100,
    oficinas: [{ nombre: 'Sede', ciudad: 'Bogotá' }],
    firewallTiene: true,
    firewallNombre: 'Fortinet',
    antivirusNombre: 'ESET',
  };

  it('mapea el dto, convierte la fecha a Date y guarda createdBy', async () => {
    const { service, prisma } = build();
    await service.createDiagnostic(dto as never, 'user-1');
    const data = prisma.diagnosticForm.create.mock.calls[0][0].data;
    expect(data.fecha).toEqual(new Date('2026-06-15'));
    expect(data.createdBy).toBe('user-1');
    expect(data).toMatchObject({
      cliente: 'ACME',
      nit: '900123',
      navegadores: ['Chrome'],
      isp: 'Claro',
      megas: 100,
      oficinas: [{ nombre: 'Sede', ciudad: 'Bogotá' }],
      firewallTiene: true,
    });
  });

  it('createdBy es opcional', async () => {
    const { service, prisma } = build();
    await service.createDiagnostic(dto as never);
    expect(prisma.diagnosticForm.create.mock.calls[0][0].data.createdBy).toBeUndefined();
  });
});

describe('FormsService - consultas', () => {
  it('listDiagnostics ordena por más reciente', async () => {
    const { service, prisma } = build();
    await service.listDiagnostics();
    expect(prisma.diagnosticForm.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });

  it('getDiagnostic busca por id', async () => {
    const { service, prisma } = build();
    await service.getDiagnostic('f1');
    expect(prisma.diagnosticForm.findUnique).toHaveBeenCalledWith({ where: { id: 'f1' } });
  });
});

describe('FormsService.listOptions', () => {
  it('agrupa por categoría, con las tres categorías siempre presentes', async () => {
    const { service } = build();
    expect(await service.listOptions()).toEqual({ isp: [], firewall: [], antivirus: [] });
  });

  it('agrupa valores por categoría y descarta categorías desconocidas', async () => {
    const { service, prisma } = build();
    prisma.formOption.findMany.mockResolvedValue([
      { category: 'isp', value: 'Claro' },
      { category: 'isp', value: 'Movistar' },
      { category: 'firewall', value: 'Fortinet' },
      { category: 'antivirus', value: 'ESET' },
      { category: 'otra', value: 'ignorada' },
    ]);
    expect(await service.listOptions()).toEqual({
      isp: ['Claro', 'Movistar'],
      firewall: ['Fortinet'],
      antivirus: ['ESET'],
    });
  });
});

describe('FormsService.addOption', () => {
  it('crea la opción', async () => {
    const { service, prisma } = build();
    await service.addOption({ category: 'isp', value: 'Tigo' });
    expect(prisma.formOption.create).toHaveBeenCalledWith({
      data: { category: 'isp', value: 'Tigo' },
    });
  });

  it('un duplicado (violación de unicidad) se ignora y devuelve undefined', async () => {
    const { service, prisma } = build();
    prisma.formOption.create.mockRejectedValue(new Error('Unique constraint'));
    await expect(service.addOption({ category: 'isp', value: 'Tigo' })).resolves.toBeUndefined();
  });
});
