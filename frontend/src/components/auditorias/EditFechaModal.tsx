"use client";

import { useForm } from "react-hook-form";
import { editOccurrenceFecha } from "@/services/auditorias.service";
import type { ActivityOccurrence } from "@/types/auditorias";

interface FormValues {
  fechaProgramada: string;
}

const inputCls = "w-full bg-bg3 border border-border text-text rounded-md px-2.5 h-9 text-[13px] outline-none focus:border-blue";
const labelCls = "text-[11px] uppercase tracking-wide text-muted mb-1 block";

export function EditFechaModal({
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
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: { fechaProgramada: occurrence.fechaProgramada.slice(0, 10) } });

  const onSubmit = handleSubmit(async (values) => {
    await editOccurrenceFecha(auditoriaId, occurrence.id, values);
    onSaved();
  });

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[100] p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={onSubmit} className="bg-bg2 border border-border rounded-xl w-full max-w-[420px] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[15px] font-semibold">Editar fecha</div>
            <div className="text-[12px] text-muted">{occurrence.activity?.nombre}</div>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-text text-2xl leading-none">
            ✕
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3.5">
          <div className="text-[12px] text-muted bg-bg3 rounded-md px-3 py-2">
            Corrige la fecha programada directamente, sin marcar la ocurrencia como reprogramada ni pedir motivo. Úsalo
            para arreglar una fecha mal calculada o mal transcrita del plan original.
          </div>
          <div>
            <label className={labelCls}>Fecha programada</label>
            <input type="date" className={inputCls} {...register("fechaProgramada", { required: true })} />
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-border flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="text-muted hover:text-text text-sm px-3 py-2">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-[34px] px-4 rounded-md border border-blue bg-blue-bg text-blue text-[13px] hover:brightness-110 disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
