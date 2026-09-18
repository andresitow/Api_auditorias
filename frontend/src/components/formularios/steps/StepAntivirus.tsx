"use client";

import { useState } from "react";
import { useController, useFormContext } from "react-hook-form";
import type { DiagnosticoPayload } from "@/types/formularios";
import { addFormOption } from "@/services/forms.service";

const inputCls = "w-full bg-bg3 border border-border text-text rounded-md px-3 h-10 text-sm outline-none focus:border-blue";
const labelCls = "block text-xs text-muted mb-1.5 font-medium";
const errCls = "text-red text-[11.5px] mt-1";

export function StepAntivirus({
  antivirusOptions,
  onOptionAdded,
}: {
  antivirusOptions: string[];
  onOptionAdded: (v: string) => void;
}) {
  const { control } = useFormContext<DiagnosticoPayload>();
  const {
    field: { value: nombre, onChange: setNombre },
    fieldState: { error },
  } = useController({ name: "antivirusNombre", control, rules: { required: true } });
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
    if (!antivirusOptions.includes(v)) {
      onOptionAdded(v);
      await addFormOption("antivirus", v).catch(() => undefined);
    }
  };

  return (
    <div className="bg-bg2 border border-border rounded-xl p-6">
      <h2 className="text-base font-semibold mb-4 text-blue">Antivirus</h2>
      <label className={labelCls}>
        ¿Qué antivirus utiliza la compañía? <span className="text-red">*</span>
      </label>
      <select className={inputCls} value={otroMode ? "__otro__" : nombre ?? ""} onChange={(e) => handleSelect(e.target.value)}>
        <option value="" disabled>
          Seleccione un antivirus
        </option>
        {antivirusOptions.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
        <option value="__otro__">Otro (agregar nuevo)</option>
      </select>
      {error && <div className={errCls}>Seleccione el antivirus.</div>}
      {otroMode && (
        <input className={`${inputCls} mt-2`} placeholder="Nombre del nuevo antivirus" onBlur={(e) => commitOtro(e.target.value)} />
      )}
      <div className="text-[12px] text-muted mt-3">
        Si el antivirus es Microsoft Defender, el informe incluirá un párrafo distinto al de otros antivirus.
      </div>
    </div>
  );
}
