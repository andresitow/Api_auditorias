import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PlanSiguienteAnioService } from './plan-siguiente-anio.service';

const BASE = 'http://analytics:8000';

function build() {
  const prisma = { auditoria: { findUnique: jest.fn() } };
  const config = { get: jest.fn().mockReturnValue(BASE) };
  const service = new PlanSiguienteAnioService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config as any,
  );
  return { service, prisma, config };
}

let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
  headers: { get: () => null },
});

describe('PlanSiguienteAnioService.crearJob', () => {
  it('lee la URL base de la configuración "analyticsServiceUrl"', () => {
    const { config } = build();
    expect(config.get).toHaveBeenCalledWith('analyticsServiceUrl');
  });

  it('lanza NotFound si la auditoría no existe y no llama a analytics-service', async () => {
    const { service, prisma } = build();
    prisma.auditoria.findUnique.mockResolvedValue(null);
    await expect(service.crearJob('aud-1', 2027, 'Bearer t')).rejects.toThrow(
      NotFoundException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reenvía POST /jobs con el Bearer del usuario y el cuerpo auditoriaId/anio', async () => {
    const { service, prisma } = build();
    prisma.auditoria.findUnique.mockResolvedValue({ id: 'aud-1' });
    fetchMock.mockResolvedValue(jsonResponse({ jobId: 'job-9' }));

    const res = await service.crearJob('aud-1', 2027, 'Bearer token-x');

    expect(res).toEqual({ jobId: 'job-9' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/jobs`);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-x',
    });
    expect(JSON.parse(init.body)).toEqual({ auditoriaId: 'aud-1', anio: 2027 });
  });

  it('error de red => InternalServerError con mensaje que menciona la URL', async () => {
    const { service, prisma } = build();
    prisma.auditoria.findUnique.mockResolvedValue({ id: 'aud-1' });
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(service.crearJob('aud-1', 2027, 'Bearer t')).rejects.toThrow(
      /analytics-service.*http:\/\/analytics:8000/,
    );
  });

  it('respuesta 404 => NotFound', async () => {
    const { service, prisma } = build();
    prisma.auditoria.findUnique.mockResolvedValue({ id: 'aud-1' });
    fetchMock.mockResolvedValue(jsonResponse({}, 404));
    await expect(service.crearJob('aud-1', 2027, 'Bearer t')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('respuesta 422/500 => InternalServerError con estado y detalle', async () => {
    const { service, prisma } = build();
    prisma.auditoria.findUnique.mockResolvedValue({ id: 'aud-1' });
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'mal' }, 422));
    const p = service.crearJob('aud-1', 2027, 'Bearer t');
    await expect(p).rejects.toThrow(InternalServerErrorException);
    await expect(p).rejects.toThrow(/422/);
  });
});

describe('PlanSiguienteAnioService.getResumen', () => {
  it('GET /jobs/:id/resumen con Authorization y devuelve el JSON', async () => {
    const { service } = build();
    fetchMock.mockResolvedValue(jsonResponse({ total: 3 }));
    const res = await service.getResumen('job-1', 'Bearer t');
    expect(res).toEqual({ total: 3 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/jobs/job-1/resumen`);
    expect(init.headers).toEqual({ Authorization: 'Bearer t' });
  });

  it('404 => NotFound ("el job ya no existe o todavía no termina")', async () => {
    const { service } = build();
    fetchMock.mockResolvedValue(jsonResponse({}, 404));
    await expect(service.getResumen('job-1', 'Bearer t')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('error de red => InternalServerError', async () => {
    const { service } = build();
    fetchMock.mockRejectedValue(new Error('x'));
    await expect(service.getResumen('job-1', 'Bearer t')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});

describe('PlanSiguienteAnioService.getArchivo', () => {
  it.each(['excel', 'pdf'] as const)('descarga /jobs/:id/%s como buffer con su content-type', async (tipo) => {
    const { service } = build();
    const bytes = new Uint8Array([1, 2, 3]);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (h: string) => (h === 'content-type' ? 'application/x-test' : null) },
      arrayBuffer: async () => bytes.buffer,
    });
    const res = await service.getArchivo('job-1', tipo, 'Bearer t');
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/jobs/job-1/${tipo}`);
    expect(res.contentType).toBe('application/x-test');
    expect(Buffer.isBuffer(res.buffer)).toBe(true);
    expect([...res.buffer]).toEqual([1, 2, 3]);
  });

  it('sin content-type usa application/octet-stream', async () => {
    const { service } = build();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    const res = await service.getArchivo('job-1', 'pdf', 'Bearer t');
    expect(res.contentType).toBe('application/octet-stream');
  });

  it('404 => NotFound', async () => {
    const { service } = build();
    fetchMock.mockResolvedValue(jsonResponse({}, 404));
    await expect(service.getArchivo('job-1', 'pdf', 'Bearer t')).rejects.toThrow(
      NotFoundException,
    );
  });
});
