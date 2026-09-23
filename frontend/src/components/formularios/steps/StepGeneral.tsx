"use client";

import { useController, useFormContext } from "react-hook-form";
import type { DiagnosticoPayload, SesionTipo } from "@/types/formularios";
import { stepInputCls as inputCls, stepLabelCls as labelCls } from "@/lib/formStyles";

const errCls = "text-red text-[11.5px] mt-1";

export function StepGeneral() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<DiagnosticoPayload>();
  const {
    field: sesionField,
    fieldState: { error: sesionError },
  } = useController({ name: "sesionTipo", control, rules: { required: true } });

  return (
    <div className="bg-bg2 border border-border rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-1">Diagnóstico y Configuración de Clientes</h2>
      <p className="text-muted text-[13px] mb-5">Diligencie la información básica de la visita.</p>

      <div className="mb-4">
        <div className={labelCls}>
          Tipo de sesión <span className="text-red">*</span>
        </div>
        <div className="flex gap-2.5">
          {(["Presencial", "Remoto"] as SesionTipo[]).map((opt) => (
            <button
              type="button"
              key={opt}
              onClick={() => sesionField.onChange(opt)}
              className={`flex-1 h-10 rounded-md border text-sm transition-colors ${
                sesionField.value === opt ? "border-blue bg-blue-bg text-blue" : "border-border bg-bg3 text-muted hover:border-muted"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {sesionError && <div className={errCls}>Seleccione el tipo de sesión.</div>}
      </div>

      <div className="mb-4">
        <label className={labelCls}>
          Motivo de revisión <span className="text-red">*</span>
        </label>
        <select className={inputCls} {...register("motivo", { required: true })}>
          <option value="Diagnóstico y Configuración">Diagnóstico y Configuración</option>
          <option value="Lentitud cliente">Lentitud cliente</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelCls}>
            Cliente <span className="text-red">*</span>
          </label>
          <input className={inputCls} placeholder="Razón social del cliente" {...register("cliente", { required: true })} />
          {errors.cliente && <div className={errCls}>Ingrese el nombre del cliente.</div>}
        </div>
        <div>
          <label className={labelCls}>
            Nit <span className="text-red">*</span>
          </label>
          <input className={inputCls} placeholder="Ej. 901652178-8" {...register("nit", { required: true })} />
          {errors.nit && <div className={errCls}>Ingrese el Nit.</div>}
        </div>
      </div>

      <div className="mb-4">
        <label className={labelCls}>
          Url producción <span className="text-red">*</span>
        </label>
        <input className={inputCls} placeholder="https://" {...register("urlProduccion", { required: true })} />
        {errors.urlProduccion && <div className={errCls}>Ingrese la url de producción.</div>}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelCls}>Url pruebas</label>
          <input className={inputCls} placeholder="https://" {...register("urlPruebas")} />
        </div>
        <div>
          <label className={labelCls}>Url portal IT</label>
          <input className={inputCls} placeholder="https://" {...register("urlPortalIt")} />
        </div>
      </div>

      <div>
        <label className={labelCls}>
          Fecha de revisión <span className="text-red">*</span>
        </label>
        <input type="date" className={inputCls} {...register("fecha", { required: true })} />
        {errors.fecha && <div className={errCls}>Seleccione la fecha.</div>}
      </div>
    </div>
  );
}
