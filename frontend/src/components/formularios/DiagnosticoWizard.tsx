"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { FormProvider, useForm } from "react-hook-form";
import type { DiagnosticoPayload, DiagnosticoResumen, FormOptionsResponse, Oficina } from "@/types/formularios";
import { createDiagnostico, getFormOptions } from "@/services/forms.service";
import { ANTIVIRUS_DEFAULT, FIREWALL_DEFAULT, ISP_DEFAULT } from "@/lib/diagnosticoTexts";
import { WizardProgress } from "./WizardProgress";
import { StepGeneral } from "./steps/StepGeneral";
import { StepSistemaOperativo } from "./steps/StepSistemaOperativo";
import { StepNavegadores } from "./steps/StepNavegadores";
import { StepAnchoBanda } from "./steps/StepAnchoBanda";
import { StepFirewall } from "./steps/StepFirewall";
import { StepAntivirus } from "./steps/StepAntivirus";
import { StepRevision } from "./steps/StepRevision";
import { DiagnosticoReport } from "./DiagnosticoReport";

const STEPS = ["general", "so", "navegadores", "ancho", "firewall", "antivirus", "revision"] as const;

const STEP_FIELDS: Record<(typeof STEPS)[number], (keyof DiagnosticoPayload)[]> = {
  general: ["sesionTipo", "motivo", "cliente", "nit", "urlProduccion", "fecha"],
  so: ["sistemaOperativo"],
  navegadores: ["navegadores", "navegadorOtro"],
  ancho: ["isp", "megas", "oficinas"],
  firewall: ["firewallTiene", "firewallNombre"],
  antivirus: ["antivirusNombre"],
  revision: [],
};

const DEFAULT_VALUES: DiagnosticoPayload = {
  sesionTipo: "Remoto",
  motivo: "Diagnóstico y Configuración",
  cliente: "",
  nit: "",
  urlProduccion: "",
  urlPruebas: "",
  urlPortalIt: "",
  fecha: new Date().toISOString().slice(0, 10),
  sistemaOperativo: "mixto",
  navegadores: [],
  navegadorOtro: "",
  isp: "",
  megas: 0,
  oficinas: [{ principal: true, nombre: "", une: {}, claro: {} }],
  firewallTiene: false,
  firewallNombre: undefined,
  antivirusNombre: "",
};

function mergeUnique(defaults: string[], extra: string[]): string[] {
  return Array.from(new Set([...defaults, ...extra]));
}

function sanitizeTest(t: Oficina["une"]) {
  const clean = (n?: number) => (n === undefined || Number.isNaN(n) ? undefined : n);
  return { descarga: clean(t.descarga), carga: clean(t.carga), ping: clean(t.ping) };
}

function sanitize(values: DiagnosticoPayload): DiagnosticoPayload {
  return {
    ...values,
    navegadorOtro: values.navegadores.includes("Otro") ? values.navegadorOtro : undefined,
    firewallNombre: values.firewallTiene ? values.firewallNombre : undefined,
    oficinas: values.oficinas.map((o) => ({ ...o, une: sanitizeTest(o.une), claro: sanitizeTest(o.claro) })),
  };
}

export function DiagnosticoWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const [options, setOptions] = useState<FormOptionsResponse>({ isp: [], firewall: [], antivirus: [] });
  const [submitted, setSubmitted] = useState<DiagnosticoResumen | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const methods = useForm<DiagnosticoPayload>({ defaultValues: DEFAULT_VALUES, mode: "onChange" });
  const { handleSubmit, trigger } = methods;

  useEffect(() => {
    getFormOptions()
      .then(setOptions)
      .catch(() => undefined);
  }, []);

  const ispOptions = mergeUnique(ISP_DEFAULT, options.isp);
  const firewallOptions = mergeUnique(FIREWALL_DEFAULT, options.firewall);
  const antivirusOptions = mergeUnique(ANTIVIRUS_DEFAULT, options.antivirus);

  const goNext = async () => {
    const step = STEPS[stepIndex];
    const ok = await trigger(STEP_FIELDS[step]);
    if (!ok) return;
    if (stepIndex < STEPS.length - 1) setStepIndex((s) => s + 1);
  };
  const goBack = () => setStepIndex((s) => Math.max(0, s - 1));

  const onFinish = handleSubmit(async (values) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const saved = await createDiagnostico(sanitize(values));
      setSubmitted(saved);
    } catch (err) {
      const detail = isAxiosError<{ message?: string | string[] }>(err) ? err.response?.data?.message : undefined;
      setSubmitError(Array.isArray(detail) ? detail.join(" ") : detail || "No se pudo guardar el diagnóstico. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  });

  if (submitted) {
    return <DiagnosticoReport data={submitted} onEdit={() => setSubmitted(null)} />;
  }

  const step = STEPS[stepIndex];

  return (
    <FormProvider {...methods}>
      <form onSubmit={(e) => e.preventDefault()}>
        <WizardProgress stepIndex={stepIndex} />

        {step === "general" && <StepGeneral />}
        {step === "so" && <StepSistemaOperativo />}
        {step === "navegadores" && <StepNavegadores />}
        {step === "ancho" && (
          <StepAnchoBanda
            ispOptions={ispOptions}
            onIspOptionAdded={(v) => setOptions((prev) => ({ ...prev, isp: [...prev.isp, v] }))}
          />
        )}
        {step === "firewall" && (
          <StepFirewall
            firewallOptions={firewallOptions}
            onOptionAdded={(v) => setOptions((prev) => ({ ...prev, firewall: [...prev.firewall, v] }))}
          />
        )}
        {step === "antivirus" && (
          <StepAntivirus
            antivirusOptions={antivirusOptions}
            onOptionAdded={(v) => setOptions((prev) => ({ ...prev, antivirus: [...prev.antivirus, v] }))}
          />
        )}
        {step === "revision" && <StepRevision />}

        {submitError && (
          <div className="bg-red-bg border border-red rounded-lg px-4 py-2.5 mt-4 text-red text-[13px]">{submitError}</div>
        )}

        <div className="flex justify-between mt-5">
          {stepIndex > 0 ? (
            <button type="button" onClick={goBack} className="text-muted hover:text-text text-sm px-3 py-2">
              ← Atrás
            </button>
          ) : (
            <span />
          )}
          {step === "revision" ? (
            <button
              type="button"
              disabled={submitting}
              onClick={onFinish}
              className="h-[38px] px-4 rounded-md border border-[#2ea043] bg-[#1a3a2a] text-green text-sm hover:bg-[#1f4a33] disabled:opacity-60"
            >
              {submitting ? "Generando…" : "Generar informe"}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="h-[38px] px-4 rounded-md border border-[#2ea043] bg-[#1a3a2a] text-green text-sm hover:bg-[#1f4a33]"
            >
              Siguiente
            </button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
