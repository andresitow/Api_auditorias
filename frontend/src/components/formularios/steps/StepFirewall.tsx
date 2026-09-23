"use client";

import { useState } from "react";
import { useController, useFormContext } from "react-hook-form";
import type { DiagnosticoPayload } from "@/types/formularios";
import { addFormOption } from "@/services/forms.service";
import { stepInputCls as inputCls, stepLabelCls as labelCls } from "@/lib/formStyles";

const errCls = "text-red text-[11.5px] mt-1";

export function StepFirewall({
  firewallOptions,
  onOptionAdded,
}: {
  firewallOptions: string[];
  onOptionAdded: (v: string) => void;
}) {
  const { control } = useFormContext<DiagnosticoPayload>();
  const {
    field: { value: tiene, onChange: setTiene },
  } = useController({ name: "firewallTiene", control });
  const {
    field: { value: nombre, onChange: setNombre },
    fieldState: { error: nombreError },
  } = useController({
    name: "firewallNombre",
    control,
    rules: { validate: (v, formValues) => !formValues.firewallTiene || !!v || "Seleccione el firewall." },
  });
  const [otroMode, setOtroMode] = useState(false);

  const handleSelect = (value: string) => {
    if (value === "__otro__") {
      setOtroMode(true);
      setNombre("");
    } else {
      setOtroMode(false);
      setNombre(value);
    }
  };

  const commitOtro = async (value: string) => {
    const v = value.trim();
    if (!v) return;
    setNombre(v);
    if (!firewallOptions.includes(v)) {
      onOptionAdded(v);
      await addFormOption("firewall", v).catch(() => undefined);
    }
  };

  return (
    <div className="bg-bg2 border border-border rounded-xl p-6">
      <h2 className="text-base font-semibold mb-4 text-blue">Filtrado de contenido</h2>
      <div className="text-xs text-muted mb-2.5">
        ¿Cuenta con filtrado de contenido (firewall)? <span className="text-red">*</span>
      </div>
      <div className="flex gap-2.5">
        {[
          { label: "Sí", value: true },
          { label: "No", value: false },
        ].map((opt) => (
          <button
            type="button"
            key={opt.label}
            onClick={() => {
              setTiene(opt.value);
              if (!opt.value) {
                setNombre(undefined);
                setOtroMode(false);
              }
            }}
            className={`flex-1 h-10 rounded-md border text-sm transition-colors ${
              tiene === opt.value ? "border-blue bg-blue-bg text-blue" : "border-border bg-bg3 text-muted hover:border-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {tiene && (
        <div className="mt-4">
          <label className={labelCls}>
            Nombre del firewall <span className="text-red">*</span>
          </label>
          <select className={inputCls} value={otroMode ? "__otro__" : nombre ?? ""} onChange={(e) => handleSelect(e.target.value)}>
            <option value="" disabled>
              Seleccione un firewall
            </option>
            {firewallOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
            <option value="__otro__">Otro (agregar nuevo)</option>
          </select>
          {nombreError && <div className={errCls}>{nombreError.message}</div>}
          {otroMode && (
            <input
              className={`${inputCls} mt-2`}
              placeholder="Nombre del nuevo firewall"
              onBlur={(e) => commitOtro(e.target.value)}
            />
          )}
        </div>
      )}
    </div>
  );
}
