"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { changeOccurrenceEstado } from "@/services/auditorias.service";
import { API_URL } from "@/services/api";
import type { ActivityOccurrence, EstadoActividad, OccurrenceEvidencia } from "@/types/auditorias";
import { EstadoBadge } from "./EstadoBadge";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const MAX_EVIDENCIAS = 5;

function esImagen(nombre: string) {
  const ext = nombre.slice(nombre.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

const ESTADOS: EstadoActividad[] = ["PLANEADO", "EJECUTADO", "REPROGRAMADO", "NO_REALIZADO"];

interface FormValues {
  estado: EstadoActividad;
  fechaEjecucion: string;
  observaciones: string;
  evidenciaUrl: string;
  evidenciaDescripcion: string;
}

const inputCls = "w-full bg-bg3 border border-border text-text rounded-md px-2.5 h-9 text-[13px] outline-none focus:border-blue";
const labelCls = "text-[11px] uppercase tracking-wide text-muted mb-1 block";

export function OccurrenceStatusModal({
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
  const [nuevosArchivos, setNuevosArchivos] = useState<File[]>([]);
  const [idsAEliminar, setIdsAEliminar] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      estado: occurrence.estado,
      fechaEjecucion: occurrence.fechaEjecucion?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      observaciones: occurrence.observaciones ?? "",
      evidenciaUrl: occurrence.evidenciaUrl ?? "",
      evidenciaDescripcion: occurrence.evidenciaDescripcion ?? "",
    },
  });
  const estado = watch("estado");

  const evidenciasVisibles = (occurrence.evidencias ?? []).filter((ev) => !idsAEliminar.includes(ev.id));
  const totalArchivos = evidenciasVisibles.length + nuevosArchivos.length;

  function quitarExistente(ev: OccurrenceEvidencia) {
    setIdsAEliminar((prev) => [...prev, ev.id]);
  }

  function quitarNuevo(index: number) {
    setNuevosArchivos((prev) => prev.filter((_, i) => i !== index));
  }

  function onFilesSelected(files: FileList | null) {
    if (!files || !files.length) return;
    setError(null);
    const seleccionados = Array.from(files);
    const disponibles = MAX_EVIDENCIAS - totalArchivos;
    if (seleccionados.length > disponibles) {
      setError(`Solo puedes adjuntar hasta ${MAX_EVIDENCIAS} archivos en total.`);
    }
    setNuevosArchivos((prev) => [...prev, ...seleccionados.slice(0, Math.max(disponibles, 0))]);
  }

  const onSubmit = handleSubmit(async (values) => {
    await changeOccurrenceEstado(
      auditoriaId,
      occurrence.id,
      {
        estado: values.estado,
        fechaEjecucion: values.estado === "EJECUTADO" ? values.fechaEjecucion : undefined,
        observaciones: values.observaciones || undefined,
        evidenciaUrl: values.evidenciaUrl || undefined,
        evidenciaDescripcion: values.evidenciaDescripcion || undefined,
        eliminarEvidenciaIds: idsAEliminar.length ? idsAEliminar : undefined,
      },
      nuevosArchivos,
    );
    onSaved();
  });

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[100] p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={onSubmit} className="bg-bg2 border border-border rounded-xl w-full max-w-[480px] max-h-[84vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[15px] font-semibold">Actualizar estado</div>
            <div className="text-[12px] text-muted">{occurrence.activity?.nombre}</div>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-text text-2xl leading-none">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1 flex flex-col gap-3.5">
          <div>
            <label className={labelCls}>Estado</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {ESTADOS.map((e) => (
                <EstadoBadge key={e} estado={e} compact />
              ))}
            </div>
            <select className={inputCls} {...register("estado", { required: true })}>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          {estado === "EJECUTADO" && (
            <div>
              <label className={labelCls}>Fecha de ejecución</label>
              <input type="date" className={inputCls} {...register("fechaEjecucion", { required: true })} />
            </div>
          )}
          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea className={`${inputCls} h-20 py-2`} maxLength={1000} {...register("observaciones")} />
          </div>
          <div>
            <label className={labelCls}>Evidencia (URL / enlace)</label>
            <input className={inputCls} maxLength={500} placeholder="https://…" {...register("evidenciaUrl")} />
          </div>
          <div>
            <label className={labelCls}>Evidencia (descripción)</label>
            <input className={inputCls} maxLength={500} placeholder="Ej: Acta firmada, pantallazo…" {...register("evidenciaDescripcion")} />
          </div>
          <div>
            <label className={labelCls}>Evidencia (archivos)</label>

            {evidenciasVisibles.length > 0 && (
              <div className="mb-2 flex flex-col gap-1.5">
                {evidenciasVisibles.map((ev) =>
                  esImagen(ev.nombreOriginal) ? (
                    <div key={ev.id} className="flex items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${API_URL}${ev.url}`} alt={ev.nombreOriginal} className="max-h-28 rounded-md border border-border" />
                      <button type="button" onClick={() => quitarExistente(ev)} className="text-[12px] text-red hover:underline">
                        Quitar
                      </button>
                    </div>
                  ) : (
                    <div key={ev.id} className="flex items-center gap-2.5 text-[12.5px]">
                      <a href={`${API_URL}${ev.url}`} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-md border border-border bg-bg3 text-blue hover:underline">
                        {ev.nombreOriginal}
                      </a>
                      <button type="button" onClick={() => quitarExistente(ev)} className="text-[12px] text-red hover:underline">
                        Quitar
                      </button>
                    </div>
                  ),
                )}
              </div>
            )}

            {nuevosArchivos.length > 0 && (
              <div className="mb-2 flex flex-col gap-1.5">
                {nuevosArchivos.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="flex items-center gap-2.5 text-[12.5px]">
                    <span className="px-2.5 py-1.5 rounded-md border border-border bg-bg3">{file.name}</span>
                    <button type="button" onClick={() => quitarNuevo(i)} className="text-[12px] text-red hover:underline">
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.eml,.msg,.xls,.xlsx,.doc,.docx"
              disabled={totalArchivos >= MAX_EVIDENCIAS}
              className="w-full text-[12.5px] text-muted file:mr-3 file:h-8 file:px-3 file:rounded-md file:border file:border-border file:bg-bg3 file:text-text file:text-[12px] file:cursor-pointer disabled:opacity-50"
              onChange={(e) => {
                onFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="mt-1 text-[11px] text-muted">
              Puedes adjuntar hasta {MAX_EVIDENCIAS} archivos (imagen, PDF, correo EML/MSG, Excel o Word). {totalArchivos}/{MAX_EVIDENCIAS} usados.
            </div>
            {error && <div className="mt-1 text-[11.5px] text-red">{error}</div>}
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-border flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="text-muted hover:text-text text-sm px-3 py-2">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-[34px] px-4 rounded-md border border-[#2ea043] bg-[#1a3a2a] text-green text-[13px] hover:bg-[#1f4a33] disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
