"use client";

import { useState } from "react";
import { useController, useFieldArray, useFormContext } from "react-hook-form";
import type { DiagnosticoPayload } from "@/types/formularios";
import { addFormOption } from "@/services/forms.service";

const inputCls = "w-full bg-bg3 border border-border text-text rounded-md px-3 h-10 text-sm outline-none focus:border-blue";
const labelCls = "block text-xs text-muted mb-1.5 font-medium";
const errCls = "text-red text-[11.5px] mt-1";
const PROVIDERS = ["une", "claro"] as const;
const METRICS = ["descarga", "carga", "ping"] as const;
const METRIC_LABEL: Record<(typeof METRICS)[number], string> = { descarga: "Descarga", carga: "Carga", ping: "Ping" };

export function StepAnchoBanda({
  ispOptions,
  onIspOptionAdded,
}: {
  ispOptions: string[];
  onIspOptionAdded: (v: string) => void;
}) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<DiagnosticoPayload>();
  const { fields, append, remove } = useFieldArray({ control, name: "oficinas" });
  const {
    field: { value: isp, onChange: setIsp },
    fieldState: { error: ispError },
  } = useController({ name: "isp", control, rules: { required: true } });
  const [ispOtro, setIspOtro] = useState(false);

  const handleIspChange = (value: string) => {
    if (value === "__otro__") {
      setIspOtro(true);
      setIsp("");
    } else {
      setIspOtro(false);
      setIsp(value);
    }
  };

  const commitIspOtro = async (value: string) => {
    const v = value.trim();
    if (!v) return;
    setIsp(v);
    if (!ispOptions.includes(v)) {
      onIspOptionAdded(v);
      await addFormOption("isp", v).catch(() => undefined);
    }
  };

  return (
    <>
      <div className="bg-bg2 border border-border rounded-xl p-6 mb-4">
        <h2 className="text-base font-semibold mb-4 text-blue">Ancho de banda</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              Proveedor de servicio de internet (ISP) <span className="text-red">*</span>
            </label>
            <select className={inputCls} value={ispOtro ? "__otro__" : isp || ""} onChange={(e) => handleIspChange(e.target.value)}>
              <option value="" disabled>
                Seleccione un proveedor
              </option>
              {ispOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              <option value="__otro__">Otro (agregar nuevo)</option>
            </select>
            {ispError && <div className={errCls}>Seleccione el proveedor.</div>}
            {ispOtro && (
              <input
                className={`${inputCls} mt-2`}
                placeholder="Nombre del nuevo proveedor"
                onBlur={(e) => commitIspOtro(e.target.value)}
              />
            )}
          </div>
          <div>
            <label className={labelCls}>
              Megas contratados con el proveedor <span className="text-red">*</span>
            </label>
            <input
              type="number"
              className={inputCls}
              placeholder="Ej. 100"
              {...register("megas", { required: true, valueAsNumber: true, min: 1 })}
            />
            {errors.megas && <div className={errCls}>Ingrese los megas contratados.</div>}
          </div>
        </div>
      </div>

      <div className="bg-bg2 border border-border rounded-xl p-6">
        <h2 className="text-base font-semibold mb-4 text-blue">Pruebas de velocidad por sede</h2>

        {fields.map((field, i) => (
          <div key={field.id} className="border border-border rounded-lg p-4 mb-4 relative">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wide text-blue bg-blue-bg px-2.5 py-1 rounded-full mb-3">
              {i === 0 ? "Oficina principal" : `Sede adicional ${i}`}
            </span>
            {i !== 0 && (
              <button type="button" onClick={() => remove(i)} className="absolute top-3 right-3 text-muted text-xs hover:text-red">
                Quitar ✕
              </button>
            )}
            <div className="mb-3">
              <label className={labelCls}>
                Nombre de la oficina, sucursal u obra <span className="text-red">*</span>
              </label>
              <input
                className={inputCls}
                placeholder="Ej. Sede Bogotá - Calle 100"
                {...register(`oficinas.${i}.nombre` as `oficinas.${number}.nombre`, { required: true })}
              />
              {errors.oficinas?.[i]?.nombre && <div className={errCls}>Ingrese el nombre de la sede.</div>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {PROVIDERS.map((provider) => (
                <div key={provider} className="border border-dashed border-border rounded-md p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted mb-2.5">
                    Test {provider === "une" ? "UNE" : "CLARO"}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {METRICS.map((metric) => (
                      <div key={metric}>
                        <input
                          type="number"
                          className="w-full bg-bg3 border border-border text-text rounded-md px-2 h-9 text-xs outline-none focus:border-blue"
                          placeholder={METRIC_LABEL[metric]}
                          {...register(`oficinas.${i}.${provider}.${metric}` as `oficinas.${number}.une.descarga`, {
                            valueAsNumber: true,
                          })}
                        />
                        <div className="text-[10px] text-muted mt-1">
                          {metric === "ping" ? "Ping (ms)" : `${METRIC_LABEL[metric]} (Mbps)`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {fields.length < 4 ? (
          <button
            type="button"
            onClick={() => append({ principal: false, nombre: "", une: {}, claro: {} })}
            className="h-9 px-3.5 rounded-md border border-orange bg-orange-bg text-orange text-[13px] hover:opacity-90"
          >
            + Agregar sede ({fields.length}/4)
          </button>
        ) : (
          <div className="text-[12px] text-muted">Límite de 4 sedes alcanzado.</div>
        )}
      </div>
    </>
  );
}
