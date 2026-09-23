"use client";

import { useEffect, useRef, useState } from "react";
import { generarPlanAccion, getPlanAccionResumen, exportPlanAccionExcel, exportPlanAccionPdf } from "@/services/auditorias.service";
import { usePlanAccionJob } from "@/hooks/usePlanAccionJob";
import type { PlanAccionDetalle, PlanAccionJobStatus } from "@/types/auditorias";
import { Button } from "@/components/ui/button";
import { FormatDropdown } from "@/components/ui/FormatDropdown";
import type { Formato } from "@/components/ui/FormatDropdown";

const ESTADO_LABEL: Record<PlanAccionJobStatus | "idle", string> = {
  idle: "",
  conectando: "Conectando a la base de datos…",
  analizando: "Analizando cumplimiento histórico (pandas / numpy)…",
  construyendo_plan: "Construyendo la propuesta del plan…",
  generando_excel: "Generando Excel (openpyxl)…",
  generando_pdf: "Generando PDF…",
  listo: "Plan de acción generado",
  error: "Ocurrió un error",
};

export function PlanAccionSiguienteAnio({ auditoriaId, anioBase }: { auditoriaId: string; anioBase: number }) {
  const anioPlan = anioBase + 1;
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<PlanAccionDetalle | null>(null);
  const [downloading, setDownloading] = useState<Formato | null>(null);
  // Formato elegido en el dropdown: se descarga solo cuando el job termina.
  const formatoElegido = useRef<Formato | null>(null);
  const { status, progress, mensaje, error, done } = usePlanAccionJob(jobId);

  const iniciar = async (formato: Formato) => {
    formatoElegido.current = formato;
    setOpen(true);
    setDetalle(null);
    setJobId(null);
    const { jobId: id } = await generarPlanAccion(auditoriaId, anioPlan);
    setJobId(id);
  };

  useEffect(() => {
    if (!done || !jobId) return;
    getPlanAccionResumen(auditoriaId, jobId).then(setDetalle).catch(() => undefined);
    const formato = formatoElegido.current;
    formatoElegido.current = null;
    if (!formato) return;
    setDownloading(formato);
    const descarga = formato === "excel" ? exportPlanAccionExcel : exportPlanAccionPdf;
    descarga(auditoriaId, jobId, anioPlan)
      .catch(() => undefined)
      .finally(() => setDownloading(null));
  }, [done, jobId, auditoriaId, anioPlan]);

  return (
    <>
      <FormatDropdown onSelect={iniciar}>Generar plan de acción {anioPlan}</FormatDropdown>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !jobId && setOpen(false)}>
          <div className="w-full max-w-lg bg-bg2 border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-text">Plan de acción {anioPlan}</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                ×
              </Button>
            </div>

            {!error && (
              <div className="mb-4">
                <div className="h-2 rounded-full bg-bg3 overflow-hidden">
                  <div className="h-full bg-blue transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[13px] text-muted mt-2">{mensaje || ESTADO_LABEL[status]}</p>
              </div>
            )}

            {error && (
              <div className="mb-4 text-[13px] text-red bg-red-bg rounded-md p-3">
                {error}
              </div>
            )}

            {detalle && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2 text-[13px]">
                  <Kpi label={`Cumplimiento ${detalle.resumen.anioBase}`} value={`${detalle.resumen.cumplimientoGeneral}%`} />
                  <Kpi label="Actividades analizadas" value={String(detalle.resumen.totalActividades)} />
                  <Kpi label="Prioridad alta" value={String(detalle.resumen.riesgoAlto)} tone="red" />
                  <Kpi label="Prioridad media" value={String(detalle.resumen.riesgoMedio)} tone="yellow" />
                  <Kpi label="Prioridad baja / sin cambios" value={String(detalle.resumen.riesgoBajo)} tone="green" />
                  <Kpi label={`Ocurrencias propuestas ${anioPlan}`} value={String(detalle.resumen.ocurrenciasPropuestas)} />
                </div>
                {downloading && <p className="text-[13px] text-muted">Descargando {downloading === "excel" ? "Excel" : "PDF"}…</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "red" | "yellow" | "green" }) {
  const toneClass = tone === "red" ? "text-red" : tone === "yellow" ? "text-yellow" : tone === "green" ? "text-green" : "text-text";
  return (
    <div className="bg-bg3 border border-border rounded-md px-3 py-2">
      <div className="text-muted text-[11px]">{label}</div>
      <div className={`text-[16px] font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
