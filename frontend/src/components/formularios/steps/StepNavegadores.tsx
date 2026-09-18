"use client";

import { useController, useFormContext } from "react-hook-form";
import type { DiagnosticoPayload } from "@/types/formularios";

const OPCIONES = ["Chrome", "Edge", "Mozilla", "Opera", "Otro"];

export function StepNavegadores() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<DiagnosticoPayload>();
  const {
    field: { value: navegadoresValue, onChange },
    fieldState: { error: navegadoresError },
  } = useController({
    name: "navegadores",
    control,
    rules: { validate: (v) => (v && v.length > 0) || "Seleccione al menos un navegador." },
  });
  const navegadores = navegadoresValue || [];

  const toggle = (opt: string) => {
    const next = navegadores.includes(opt) ? navegadores.filter((n) => n !== opt) : [...navegadores, opt];
    onChange(next);
  };

  return (
    <div className="bg-bg2 border border-border rounded-xl p-6">
      <h2 className="text-base font-semibold mb-4 text-blue">Navegadores</h2>
      <div className="text-xs text-muted mb-2.5">
        ¿Qué navegadores utilizan los usuarios? <span className="text-red">*</span>
      </div>
      {OPCIONES.map((opt) => {
        const selected = navegadores.includes(opt);
        return (
          <button
            type="button"
            key={opt}
            onClick={() => toggle(opt)}
            className={`w-full text-left flex items-center gap-2.5 px-3.5 py-3 border rounded-md mb-2 text-sm transition-colors ${
              selected ? "border-blue bg-blue-bg text-blue" : "border-border bg-bg3 text-text hover:border-muted"
            }`}
          >
            <span
              className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center text-[10px] leading-none ${
                selected ? "border-blue bg-blue text-bg" : "border-muted"
              }`}
            >
              {selected && "✓"}
            </span>
            {opt}
          </button>
        );
      })}
      {navegadoresError && <div className="text-red text-[11.5px] mt-1">{navegadoresError.message}</div>}

      {navegadores.includes("Otro") && (
        <div className="mt-3">
          <label className="block text-xs text-muted mb-1.5 font-medium">
            Especifique cuál otro navegador <span className="text-red">*</span>
          </label>
          <input
            className="w-full bg-bg3 border border-border text-text rounded-md px-3 h-10 text-sm outline-none focus:border-blue"
            placeholder="Ej. Brave, Safari..."
            {...register("navegadorOtro", { required: navegadores.includes("Otro") })}
          />
          {errors.navegadorOtro && <div className="text-red text-[11.5px] mt-1">Especifique el navegador.</div>}
        </div>
      )}
    </div>
  );
}
