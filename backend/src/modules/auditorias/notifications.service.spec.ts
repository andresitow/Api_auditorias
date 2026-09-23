import { Logger } from '@nestjs/common';
import { EstadoActividad } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { NotificationsService } from './notifications.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const NOW = new Date('2026-06-15T12:00:00Z');
const DAY = 86_400_000;

const cfgBase = {
  notificacionesActivas: true,
  teamsWebhookUrl: 'https://teams.example/webhook' as string | null,
  notifEmails: 'a@x.com,b@x.com' as string | null,
  diasAntes: [7, 3, 1],
};

function build(cfg: Record<string, unknown> = {}, envVars: Record<string, string> = {}) {
  const prisma = {
    activityOccurrence: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const configService = { get: jest.fn().mockResolvedValue({ ...cfgBase, ...cfg }) };
  const env = { get: jest.fn((k: string) => envVars[k]) };
  const service = new NotificationsService(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configService as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    env as any,
  );
  return { service, prisma, configService, env };
}

const smtpEnv = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  SMTP_FROM: 'noreply@example.com',
};

const occ = (
  id: string,
  diasDesdeAhora: number,
  over: Record<string, unknown> = {},
) => ({
  id,
  estado: EstadoActividad.PLANEADO,
  fechaProgramada: new Date(NOW.getTime() + diasDesdeAhora * DAY),
  notificadoDias: [] as number[],
  activity: {
    nombre: `Actividad ${id}`,
    categoria: 'Servidores',
    responsable: 'Ana',
    auditoria: { nombre: 'Auditoría A' },
  },
  ...over,
});

let fetchMock: jest.Mock;
let sendMail: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  global.fetch = fetchMock as unknown as typeof fetch;
  sendMail = jest.fn().mockResolvedValue({});
  (nodemailer.createTransport as jest.Mock).mockReset().mockReturnValue({ sendMail });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('NotificationsService.checkAndNotify - condiciones de salida', () => {
  it('no hace nada si las notificaciones están desactivadas', async () => {
    const { service, prisma } = build({ notificacionesActivas: false });
    await service.checkAndNotify();
    expect(prisma.activityOccurrence.findMany).not.toHaveBeenCalled();
  });

  it('no hace nada si no hay ni webhook de Teams ni correos', async () => {
    const { service, prisma } = build({ teamsWebhookUrl: null, notifEmails: null });
    await service.checkAndNotify();
    expect(prisma.activityOccurrence.findMany).not.toHaveBeenCalled();
  });

  it('busca solo PLANEADO hasta el horizonte (mayor de diasAntes)', async () => {
    const { service, prisma } = build();
    await service.checkAndNotify();
    const arg = prisma.activityOccurrence.findMany.mock.calls[0][0];
    expect(arg.where.estado).toBe(EstadoActividad.PLANEADO);
    expect(arg.where.fechaProgramada.lte).toEqual(new Date(NOW.getTime() + 7 * DAY));
    expect(arg.orderBy).toEqual({ fechaProgramada: 'asc' });
  });

  it('sin diasAntes el horizonte por defecto es 7 días', async () => {
    const { service, prisma } = build({ diasAntes: [] });
    await service.checkAndNotify();
    expect(
      prisma.activityOccurrence.findMany.mock.calls[0][0].where.fechaProgramada.lte,
    ).toEqual(new Date(NOW.getTime() + 7 * DAY));
  });

  it('sin candidatas no envía nada', async () => {
    const { service } = build({}, smtpEnv);
    await service.checkAndNotify();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('NotificationsService.checkAndNotify - umbrales', () => {
  it('notifica cuando diasRestantes coincide con un umbral, y no en otros días', async () => {
    const { service, prisma } = build({ notifEmails: null });
    prisma.activityOccurrence.findMany.mockResolvedValue([
      occ('en7', 7),
      occ('en5', 5), // no es umbral
      occ('en3', 3),
      occ('en2', 2), // no es umbral
      occ('en1', 1),
    ]);
    await service.checkAndNotify();
    const updated = prisma.activityOccurrence.update.mock.calls.map((c) => c[0].where.id);
    expect(updated).toEqual(['en7', 'en3', 'en1']);
  });

  it('marca el umbral cruzado con push en notificadoDias', async () => {
    const { service, prisma } = build({ notifEmails: null });
    prisma.activityOccurrence.findMany.mockResolvedValue([occ('en3', 3)]);
    await service.checkAndNotify();
    expect(prisma.activityOccurrence.update).toHaveBeenCalledWith({
      where: { id: 'en3' },
      data: { notificadoDias: { push: 3 } },
    });
  });

  it('no reenvía un umbral ya notificado', async () => {
    const { service, prisma } = build({ notifEmails: null });
    prisma.activityOccurrence.findMany.mockResolvedValue([
      occ('en3', 3, { notificadoDias: [3] }),
    ]);
    await service.checkAndNotify();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.activityOccurrence.update).not.toHaveBeenCalled();
  });

  it('sí notifica un umbral distinto aunque haya otros ya marcados', async () => {
    const { service, prisma } = build({ notifEmails: null });
    prisma.activityOccurrence.findMany.mockResolvedValue([
      occ('en1', 1, { notificadoDias: [7, 3] }),
    ]);
    await service.checkAndNotify();
    expect(prisma.activityOccurrence.update).toHaveBeenCalledTimes(1);
  });

  it('vencidas se notifican una sola vez con el marcador -1', async () => {
    const { service, prisma } = build({ notifEmails: null });
    prisma.activityOccurrence.findMany.mockResolvedValue([
      occ('vieja', -10),
      occ('vieja2', -3, { notificadoDias: [-1] }),
    ]);
    await service.checkAndNotify();
    expect(prisma.activityOccurrence.update).toHaveBeenCalledTimes(1);
    expect(prisma.activityOccurrence.update).toHaveBeenCalledWith({
      where: { id: 'vieja' },
      data: { notificadoDias: { push: -1 } },
    });
  });

  it('todo notificado => no se envía mensaje', async () => {
    const { service, prisma } = build({ notifEmails: null });
    prisma.activityOccurrence.findMany.mockResolvedValue([
      occ('a', -2, { notificadoDias: [-1] }),
      occ('b', 3, { notificadoDias: [3] }),
    ]);
    await service.checkAndNotify();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('NotificationsService.checkAndNotify - envío', () => {
  it('Teams: POST JSON con el texto agrupado por auditoría', async () => {
    const { service, prisma } = build({ notifEmails: null });
    prisma.activityOccurrence.findMany.mockResolvedValue([
      occ('x', 3),
      occ('y', -2),
    ]);
    await service.checkAndNotify();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://teams.example/webhook');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    const { text } = JSON.parse(init.body);
    expect(text).toContain('Auditoría A:');
    expect(text).toContain('[Servidores] Actividad x — Ana — 2026-06-18 (vence en 3 día(s))');
    expect(text).toContain('Actividad y');
    expect(text).toContain('VENCIDA hace 2 día(s)');
  });

  it('agrupa por nombre de auditoría (cada una con su encabezado)', async () => {
    const { service, prisma } = build({ notifEmails: null });
    const otra = occ('z', 1);
    otra.activity.auditoria.nombre = 'Auditoría B';
    prisma.activityOccurrence.findMany.mockResolvedValue([occ('x', 3), otra]);
    await service.checkAndNotify();
    const { text } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(text).toContain('Auditoría A:');
    expect(text).toContain('Auditoría B:');
  });

  it('correo: usa SMTP_FROM, destinatarios de notifEmails, asunto, texto y html', async () => {
    const { service, prisma } = build({ teamsWebhookUrl: null }, smtpEnv);
    prisma.activityOccurrence.findMany.mockResolvedValue([occ('x', 3)]);
    await service.checkAndNotify();

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'user', pass: 'pass' },
    });
    const mail = sendMail.mock.calls[0][0];
    expect(mail.from).toBe('noreply@example.com');
    expect(mail.to).toBe('a@x.com,b@x.com');
    expect(mail.subject).toBe('Auditorías — Actividades próximas a vencer');
    expect(mail.text).toContain('Actividad x');
    expect(mail.html).toContain('<td>Actividad x</td>');
  });

  it('SMTP_FROM ausente cae a SMTP_USER', async () => {
    const { SMTP_FROM: _omit, ...env } = smtpEnv;
    void _omit;
    const { service, prisma } = build({ teamsWebhookUrl: null }, env);
    prisma.activityOccurrence.findMany.mockResolvedValue([occ('x', 3)]);
    await service.checkAndNotify();
    expect(sendMail.mock.calls[0][0].from).toBe('user');
  });

  it('puerto 465 activa secure', async () => {
    const { service, prisma } = build(
      { teamsWebhookUrl: null },
      { ...smtpEnv, SMTP_PORT: '465' },
    );
    prisma.activityOccurrence.findMany.mockResolvedValue([occ('x', 3)]);
    await service.checkAndNotify();
    expect(
      (nodemailer.createTransport as jest.Mock).mock.calls[0][0],
    ).toMatchObject({ port: 465, secure: true });
  });

  it('sin puerto configurado usa 587', async () => {
    const { SMTP_PORT: _p, ...env } = smtpEnv;
    void _p;
    const { service, prisma } = build({ teamsWebhookUrl: null }, env);
    prisma.activityOccurrence.findMany.mockResolvedValue([occ('x', 3)]);
    await service.checkAndNotify();
    expect(
      (nodemailer.createTransport as jest.Mock).mock.calls[0][0].port,
    ).toBe(587);
  });

  it('SMTP incompleto: el error se captura y el cron no revienta', async () => {
    const { service, prisma } = build({ teamsWebhookUrl: null }, {
      SMTP_HOST: 'h',
    });
    prisma.activityOccurrence.findMany.mockResolvedValue([occ('x', 3)]);
    await expect(service.checkAndNotify()).resolves.toBeUndefined();
  });

  // BUG (reportado): el comentario del código dice "ningún canal configurado, no marcar
  // como enviado", pero la condición `!resultado.teams && !resultado.email` solo cubre
  // "ningún canal INTENTADO". Si el único canal configurado falla (SMTP mal configurado,
  // webhook de Teams caído / 500), resultado = { email: 'error' } es truthy y las
  // ocurrencias se marcan en notificadoDias => el aviso NUNCA se reintenta.
  it.skip('BUG: si todos los canales fallan NO debería marcar notificadoDias (esperado) - hoy sí marca (obtenido)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const { service, prisma } = build({ notifEmails: null });
    prisma.activityOccurrence.findMany.mockResolvedValue([occ('x', 3)]);
    await service.checkAndNotify();
    expect(prisma.activityOccurrence.update).not.toHaveBeenCalled();
  });

  it('[caracterización del BUG anterior] Teams responde 500 pero igual se marca como notificado', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const { service, prisma } = build({ notifEmails: null });
    prisma.activityOccurrence.findMany.mockResolvedValue([occ('x', 3)]);
    await service.checkAndNotify();
    expect(prisma.activityOccurrence.update).toHaveBeenCalledTimes(1);
  });

  it('[caracterización del BUG anterior] SMTP no configurado (error) igual marca como notificado', async () => {
    const { service, prisma } = build({ teamsWebhookUrl: null }, { SMTP_HOST: 'h' });
    prisma.activityOccurrence.findMany.mockResolvedValue([occ('x', 3)]);
    await service.checkAndNotify();
    expect(prisma.activityOccurrence.update).toHaveBeenCalledTimes(1);
  });

  it('fetch lanza excepción: no rompe el cron', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const { service, prisma } = build({ notifEmails: null });
    prisma.activityOccurrence.findMany.mockResolvedValue([occ('x', 3)]);
    await expect(service.checkAndNotify()).resolves.toBeUndefined();
  });

  it('envía por ambos canales cuando ambos están configurados', async () => {
    const { service, prisma } = build({}, smtpEnv);
    prisma.activityOccurrence.findMany.mockResolvedValue([occ('x', 3)]);
    await service.checkAndNotify();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('mensaje "vence HOY" cuando faltan 0 días', async () => {
    const { service, prisma } = build({ notifEmails: null, diasAntes: [0, 3] });
    prisma.activityOccurrence.findMany.mockResolvedValue([
      occ('hoy', 0),
    ]);
    await service.checkAndNotify();
    const { text } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(text).toContain('vence HOY');
  });
});

describe('NotificationsService.enviarPrueba', () => {
  it('devuelve el resultado por canal y no toca ocurrencias', async () => {
    const { service, prisma } = build({}, smtpEnv);
    const res = await service.enviarPrueba({ ...cfgBase } as never);
    expect(res).toEqual({ teams: 'ok', email: 'ok' });
    expect(prisma.activityOccurrence.update).not.toHaveBeenCalled();
    expect(prisma.activityOccurrence.findMany).not.toHaveBeenCalled();
  });

  it('reporta error por canal cuando falla', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 });
    sendMail.mockRejectedValue(new Error('boom'));
    const { service } = build({}, smtpEnv);
    const res = await service.enviarPrueba({ ...cfgBase } as never);
    expect(res).toEqual({ teams: 'error', email: 'error' });
  });

  it('solo reporta los canales configurados', async () => {
    const { service } = build({}, smtpEnv);
    const res = await service.enviarPrueba({
      ...cfgBase,
      teamsWebhookUrl: null,
    } as never);
    expect(res).toEqual({ email: 'ok' });
  });
});
