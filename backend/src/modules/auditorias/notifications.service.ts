import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import {
  EstadoActividad,
  type ActivityOccurrence,
  type Activity,
  type Auditoria,
  type AuditoriaConfig,
} from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaConfigService } from './config.service';

const VENCIDA_MARKER = -1;

type OccurrenceConActividad = ActivityOccurrence & {
  activity: Activity & { auditoria: Auditoria };
};

export interface EnvioResultado {
  teams?: 'ok' | 'error';
  email?: 'ok' | 'error';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: AuditoriaConfigService,
    private readonly env: ConfigService,
  ) {}

  /** Cron diario: revisa ocurrencias planeadas próximas a vencer (según diasAntes) o
   * vencidas, y envía una notificación una sola vez por umbral cruzado (marcado en
   * notificadoDias) para no reenviar el mismo aviso todos los días. */
  @Cron('0 8 * * *')
  async checkAndNotify() {
    const cfg = await this.configService.get();
    if (!cfg.notificacionesActivas) return;
    if (!cfg.teamsWebhookUrl && !cfg.notifEmails) return;

    const now = new Date();
    const maxDias = cfg.diasAntes.length ? Math.max(...cfg.diasAntes) : 7;
    const horizon = new Date(now.getTime() + maxDias * 86_400_000);

    const candidatas = await this.prisma.activityOccurrence.findMany({
      where: {
        estado: EstadoActividad.PLANEADO,
        fechaProgramada: { lte: horizon },
      },
      include: { activity: { include: { auditoria: true } } },
      orderBy: { fechaProgramada: 'asc' },
    });

    const pendientes: {
      occ: OccurrenceConActividad;
      marcador: number;
      diasRestantes: number;
    }[] = [];
    for (const occ of candidatas) {
      const diasRestantes = Math.ceil(
        (occ.fechaProgramada.getTime() - now.getTime()) / 86_400_000,
      );
      const vencida = diasRestantes < 0;
      const marcador = vencida ? VENCIDA_MARKER : diasRestantes;
      const cruzaUmbral = vencida || cfg.diasAntes.includes(diasRestantes);
      if (!cruzaUmbral || occ.notificadoDias.includes(marcador)) continue;
      pendientes.push({ occ, marcador, diasRestantes });
    }

    if (pendientes.length === 0) return;

    const resultado = await this.enviar(cfg, this.construirMensaje(pendientes));
    if (!resultado.teams && !resultado.email) return; // ningún canal configurado, no marcar como enviado

    for (const { occ, marcador } of pendientes) {
      await this.prisma.activityOccurrence.update({
        where: { id: occ.id },
        data: { notificadoDias: { push: marcador } },
      });
    }
    this.logger.log(
      `Notificadas ${pendientes.length} ocurrencia(s): teams=${resultado.teams ?? '-'} email=${resultado.email ?? '-'}`,
    );
  }

  /** Envía un mensaje de prueba a los canales configurados, sin tocar datos de ocurrencias. */
  async enviarPrueba(cfg: AuditoriaConfig): Promise<EnvioResultado> {
    return this.enviar(cfg, {
      texto:
        'Mensaje de prueba del módulo de Auditorías: la configuración de notificaciones funciona correctamente.',
      html: '<p>Mensaje de prueba del módulo de <b>Auditorías</b>: la configuración de notificaciones funciona correctamente.</p>',
    });
  }

  private construirMensaje(
    pendientes: { occ: OccurrenceConActividad; diasRestantes: number }[],
  ) {
    const porAuditoria = new Map<string, typeof pendientes>();
    for (const p of pendientes) {
      const key = p.occ.activity.auditoria.nombre;
      porAuditoria.set(key, [...(porAuditoria.get(key) ?? []), p]);
    }

    const lineas: string[] = [];
    const filasHtml: string[] = [];
    for (const [auditoria, items] of porAuditoria) {
      lineas.push(`\n${auditoria}:`);
      for (const { occ, diasRestantes } of items) {
        const cuando =
          diasRestantes < 0
            ? `VENCIDA hace ${Math.abs(diasRestantes)} día(s)`
            : diasRestantes === 0
              ? 'vence HOY'
              : `vence en ${diasRestantes} día(s)`;
        const fecha = occ.fechaProgramada.toISOString().slice(0, 10);
        lineas.push(
          `  • [${occ.activity.categoria}] ${occ.activity.nombre} — ${occ.activity.responsable} — ${fecha} (${cuando})`,
        );
        filasHtml.push(
          `<tr><td>${auditoria}</td><td>${occ.activity.categoria}</td><td>${occ.activity.nombre}</td><td>${occ.activity.responsable}</td><td>${fecha}</td><td>${cuando}</td></tr>`,
        );
      }
    }

    const texto = `Actividades del plan de trabajo que requieren atención:\n${lineas.join('\n')}`;
    const html = `<p>Actividades del plan de trabajo que requieren atención:</p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:13px">
        <tr><th>Auditoría</th><th>Categoría</th><th>Actividad</th><th>Responsable</th><th>Fecha</th><th>Estado</th></tr>
        ${filasHtml.join('')}
      </table>`;
    return { texto, html };
  }

  private async enviar(
    cfg: AuditoriaConfig,
    mensaje: { texto: string; html: string },
  ): Promise<EnvioResultado> {
    const resultado: EnvioResultado = {};

    if (cfg.teamsWebhookUrl) {
      try {
        const res = await fetch(cfg.teamsWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: mensaje.texto }),
        });
        resultado.teams = res.ok ? 'ok' : 'error';
        if (!res.ok) this.logger.warn(`Teams webhook respondió ${res.status}`);
      } catch (err) {
        resultado.teams = 'error';
        this.logger.warn(`Error enviando a Teams: ${(err as Error).message}`);
      }
    }

    if (cfg.notifEmails) {
      try {
        await this.getTransporter().sendMail({
          from:
            this.env.get<string>('SMTP_FROM') ||
            this.env.get<string>('SMTP_USER'),
          to: cfg.notifEmails,
          subject: 'Auditorías — Actividades próximas a vencer',
          text: mensaje.texto,
          html: mensaje.html,
        });
        resultado.email = 'ok';
      } catch (err) {
        resultado.email = 'error';
        this.logger.warn(`Error enviando correo: ${(err as Error).message}`);
      }
    }

    return resultado;
  }

  private getTransporter() {
    const host = this.env.get<string>('SMTP_HOST');
    const port = Number(this.env.get<string>('SMTP_PORT') ?? 587);
    const user = this.env.get<string>('SMTP_USER');
    const pass = this.env.get<string>('SMTP_PASS');
    if (!host || !user || !pass) {
      throw new Error(
        'SMTP no configurado: define SMTP_HOST, SMTP_USER y SMTP_PASS en el .env del backend',
      );
    }
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
}
