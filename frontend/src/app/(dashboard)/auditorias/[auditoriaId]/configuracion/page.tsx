"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { getAuditoriaConfig, updateAuditoriaConfig, testAuditoriaNotification } from "@/services/auditorias.service";
import type { AuditoriaConfig, NotificationTestResult } from "@/types/auditorias";
import { Button } from "@/components/ui/button";

interface FormValues {
  notificacionesActivas: boolean;
  diasAntes: string;
  teamsWebhookUrl: string;
  notifEmails: string;
}

const inputCls = "w-full bg-bg3 border border-border text-text rounded-md px-2.5 h-9 text-[13px] outline-none focus:border-blue";
const labelCls = "text-[11px] uppercase tracking-wide text-muted mb-1 block";

function parseDiasAntes(value: string): number[] {
  const dias = value
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return dias.length ? [...new Set(dias)].sort((a, b) => a - b) : [1, 3, 7];
}

export default function NotificacionesConfigPage() {
  const [cfg, setCfg] = useState<AuditoriaConfig | null>(null);
  const [testResult, setTestResult] = useState<NotificationTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>();

  useEffect(() => {
    getAuditoriaConfig().then((data) => {
      setCfg(data);
      reset({
        notificacionesActivas: data.notificacionesActivas,
        diasAntes: data.diasAntes.join(", "),
        teamsWebhookUrl: data.teamsWebhookUrl ?? "",
        notifEmails: data.notifEmails ?? "",
      });
    });
  }, [reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSaved(false);
    const updated = await updateAuditoriaConfig({
      notificacionesActivas: values.notificacionesActivas,
      diasAntes: parseDiasAntes(values.diasAntes),
      teamsWebhookUrl: values.teamsWebhookUrl.trim(),
      notifEmails: values.notifEmails.trim(),
    });
    setCfg(updated);
    setSaved(true);
  });

  const onTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testAuditoriaNotification());
    } finally {
      setTesting(false);
    }
  };

  if (!cfg) return null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 max-w-[640px]">
      <div className="bg-bg2 border border-border rounded-lg p-4 text-[12.5px] text-muted">
        Esta configuración es global: aplica a todas las auditorías. Cuando una tarea planeada entra dentro de los
        días de anticipación configurados (por defecto una semana antes), o cuando queda vencida, se envía un aviso
        automático una sola vez por cada umbral, a los canales que actives abajo.
      </div>

      <div className="bg-bg2 border border-border rounded-lg p-4 flex flex-col gap-3.5">
        <label className="flex items-center gap-2.5 text-[13px]">
          <input type="checkbox" className="w-4 h-4" {...register("notificacionesActivas")} />
          Notificaciones automáticas activas
        </label>

        <div>
          <label className={labelCls}>Días de anticipación (separados por coma)</label>
          <input className={inputCls} placeholder="1, 3, 7" {...register("diasAntes")} />
        </div>
      </div>

      <div className="bg-bg2 border border-border rounded-lg p-4 flex flex-col gap-3.5">
        <div className="text-[13px] font-semibold">Microsoft Teams</div>
        <div>
          <label className={labelCls}>URL del Incoming Webhook del canal</label>
          <input className={inputCls} placeholder="https://outlook.office.com/webhook/..." {...register("teamsWebhookUrl")} />
        </div>
      </div>

      <div className="bg-bg2 border border-border rounded-lg p-4 flex flex-col gap-3.5">
        <div className="text-[13px] font-semibold">Correo (Outlook / SMTP)</div>
        <div>
          <label className={labelCls}>Destinatarios (separados por coma)</label>
          <input className={inputCls} placeholder="persona1@empresa.com, persona2@empresa.com" {...register("notifEmails")} />
          <p className="text-[11px] text-muted mt-1">
            Requiere configurar SMTP_HOST, SMTP_USER y SMTP_PASS en el .env del backend.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="info" size="lg" disabled={isSubmitting}>
          Guardar
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={onTest} disabled={testing}>
          {testing ? "Enviando…" : "Enviar prueba"}
        </Button>
        {saved && <span className="text-[12px] text-green">Guardado ✓</span>}
      </div>

      {testResult && (
        <div className="bg-bg2 border border-border rounded-lg p-3 text-[12.5px] flex flex-col gap-1">
          {testResult.teams && <div>Teams: {testResult.teams === "ok" ? "enviado" : "error (revisa la URL del webhook)"}</div>}
          {testResult.email && <div>Correo: {testResult.email === "ok" ? "enviado" : "error (revisa la configuración SMTP)"}</div>}
          {!testResult.teams && !testResult.email && <div className="text-muted">No hay ningún canal configurado todavía.</div>}
        </div>
      )}
    </form>
  );
}
