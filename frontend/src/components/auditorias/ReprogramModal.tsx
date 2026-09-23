"use client";

import { useForm } from "react-hook-form";
import { reprogramOccurrence } from "@/services/auditorias.service";
import type { ActivityOccurrence } from "@/types/auditorias";
import { Button } from "@/components/ui/button";
import { SpaceStars } from "@/components/ui/SpaceStars";
import { inputCls, labelCls } from "@/lib/formStyles";

interface FormValues {
  nuevaFecha: string;
  motivo: string;
}

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
      <form onSubmit={onSubmit} className="space-form w-full max-w-[440px] max-h-[84vh] flex flex-col">
        <SpaceStars />
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="space-form__title text-[16px]"><span>Reprogramar</span></div>
            <div className="text-[12px] text-muted">{occurrence.activity?.nombre}</div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
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
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="warning" disabled={isSubmitting}>
            Reprogramar
          </Button>
        </div>
      </form>
    </div>
  );
}
