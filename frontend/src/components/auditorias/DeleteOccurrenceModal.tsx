"use client";

import { useForm } from "react-hook-form";
import { deleteOccurrence } from "@/services/auditorias.service";
import type { ActivityOccurrence } from "@/types/auditorias";
import { Button } from "@/components/ui/button";
import { inputCls, labelCls } from "@/lib/formStyles";
import { formatFecha } from "@/lib/dates";

interface FormValues {
  motivo: string;
}

/** Pide el motivo de eliminación antes de borrar una ocurrencia puntual. La ocurrencia
 * no se pierde: queda en "Actividades eliminadas" (papelera, 30 días) junto con este
 * motivo y su historial — ver DeletedActivitiesService en el backend. */
export function DeleteOccurrenceModal({
  auditoriaId,
  occurrence,
  onClose,
  onDeleted,
}: {
  auditoriaId: string;
  occurrence: ActivityOccurrence;
  onClose: () => void;
  onDeleted: (result: { actividadEliminada: boolean }) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({ defaultValues: { motivo: "" } });

  const onSubmit = handleSubmit(async (values) => {
    const result = await deleteOccurrence(auditoriaId, occurrence.id, values.motivo);
    onDeleted(result);
  });

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[100] p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={onSubmit} className="bg-bg2 border border-border rounded-xl w-full max-w-[440px] max-h-[84vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[15px] font-semibold">Eliminar fecha</div>
            <div className="text-[12px] text-muted">{occurrence.activity?.nombre}</div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1 flex flex-col gap-3.5">
          <div className="text-[12px] text-muted bg-bg3 rounded-md px-3 py-2">
            Se elimina solo la fecha <span className="font-mono text-text">{formatFecha(occurrence.fechaProgramada)}</span>; las demás
            ocurrencias de la actividad no se ven afectadas. Quedará disponible en &quot;Actividades eliminadas&quot; durante 30 días
            antes de borrarse en definitiva.
          </div>
          <div>
            <label className={labelCls}>Motivo de la eliminación (obligatorio)</label>
            <textarea className={`${inputCls} h-20 py-2`} maxLength={500} {...register("motivo", { required: true })} />
            {errors.motivo && <span className="text-red text-[11px]">El motivo es obligatorio</span>}
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-border flex justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="destructive" disabled={isSubmitting}>
            Eliminar
          </Button>
        </div>
      </form>
    </div>
  );
}
