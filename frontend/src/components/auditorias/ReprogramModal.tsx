"use client";

import { useForm } from "react-hook-form";
import { reprogramOccurrence } from "@/services/auditorias.service";
import type { ActivityOccurrence } from "@/types/auditorias";

interface FormValues {
  nuevaFecha: string;
  motivo: string;
}

const inputCls = "w-full bg-bg3 border border-border text-text rounded-md px-2.5 h-9 text-[13px] outline-none focus:border-blue";
const labelCls = "text-[11px] uppercase tracking-wide text-muted mb-1 block";

export function ReprogramModal({
  auditoriaId,
  occurrence,
  onClose,
  onSaved,
}: {
  auditoriaId: string;
  occurrence: ActivityOccurrence;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({ defaultValues: { nuevaFecha: occurrence.fechaProgramada.slice(0, 10), motivo: "" } });

  const onSubmit = handleSubmit(async (values) => {
    await reprogramOccurrence(auditoriaId, occurrence.id, values);
    onSaved();
  });

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[100] p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={onSubmit} className="bg-bg2 border border-border rounded-xl w-full max-w-[440px] max-h-[84vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[15px] font-semibold">Reprogramar</div>
            <div className="text-[12px] text-muted">{occurrence.activity?.nombre}</div>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-text text-2xl leading-none">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1 flex flex-col gap-3.5">
          <div className="text-[12px] text-muted bg-bg3 rounded-md px-3 py-2">
            Fecha programada actual: <span className="font-mono text-text">{occurrence.fechaProgramada.slice(0, 10)}</span>
            <br />
            Reprogramaciones previas: <span className="text-text">{occurrence.reprogramaciones}</span>
          </div>
          <div>
            <label className={labelCls}>Nueva fecha</label>
            <input type="date" className={inputCls} {...register("nuevaFecha", { required: true })} />
          </div>
          <div>
            <label className={labelCls}>Motivo (obligatorio)</label>
            <textarea className={`${inputCls} h-20 py-2`} maxLength={500} {...register("motivo", { required: true })} />
            {errors.motivo && <span className="text-red text-[11px]">El motivo es obligatorio</span>}
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-border flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="text-muted hover:text-text text-sm px-3 py-2">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-[34px] px-4 rounded-md border border-[#c9820a] bg-orange-bg text-orange text-[13px] hover:brightness-110 disabled:opacity-60"
          >
            Reprogramar
          </button>
        </div>
      </form>
    </div>
  );
}
