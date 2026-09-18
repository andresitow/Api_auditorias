"use client";

import { useController, useFormContext } from "react-hook-form";
import type { DiagnosticoPayload, SistemaOperativo } from "@/types/formularios";

const OPTIONS: { value: SistemaOperativo; label: string }[] = [
  { value: "mixto", label: "Windows 10 y 11 (entorno mixto)" },
  { value: "w11", label: "Windows 11 (parque ya actualizado)" },
];

export function StepSistemaOperativo() {
  const { control } = useFormContext<DiagnosticoPayload>();
  const {
    field: { value, onChange },
    fieldState: { error },
  } = useController({ name: "sistemaOperativo", control, rules: { required: true } });

  return (
    <div className="bg-bg2 border border-border rounded-xl p-6">
      <h2 className="text-base font-semibold mb-4 text-blue">Sistema operativo</h2>
      <div className="text-xs text-muted mb-2.5">
        ¿Qué sistemas operativos usan los equipos del cliente? <span className="text-red">*</span>
      </div>
      {OPTIONS.map((opt) => (
        <button
          type="button"
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`w-full text-left flex items-center gap-2.5 px-3.5 py-3 border rounded-md mb-2 text-sm transition-colors ${
            value === opt.value ? "border-blue bg-blue-bg text-blue" : "border-border bg-bg3 text-text hover:border-muted"
          }`}
        >
          <span
            className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${value === opt.value ? "border-blue bg-blue" : "border-muted"}`}
          />
          {opt.label}
        </button>
      ))}
      {error && <div className="text-red text-[11.5px] mt-1">Seleccione una opción.</div>}
      <div className="text-[12px] text-muted mt-3">
        Este dato determina el párrafo de recomendación que se incluirá en el informe.
      </div>
    </div>
  );
}
