"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/components/Toast";
import { createActivity, updateActivity } from "@/services/auditorias.service";
import {
  copyFileToFolder,
  ensureWritePermission,
  getDestinationFolderForActivity,
  isFolderPickerSupported,
  pickDestinationFolderHandle,
  removeDestinationFolderForActivity,
  saveDestinationFolderForActivity,
} from "@/lib/evidenciaFolder";
import type { Activity, Frecuencia } from "@/types/auditorias";
import { Button } from "@/components/ui/button";
import { inputCls, labelCls } from "@/lib/formStyles";

const CATEGORIAS = [
  "Sensibilización y formación SI",
  "Riesgos y activos de la información",
  "Control de Accesos y contraseñas",
  "Seguimientos como puntos de control",
  "Mantenimiento de la infraestructura",
  "Switches",
  "Servidores",
  "Otros",
];

const FRECUENCIAS: { value: Exclude<Frecuencia, "UNICA">; label: string }[] = [
  { value: "DIARIO", label: "Diario" },
  { value: "MENSUAL", label: "Mensual" },
  { value: "BIMENSUAL", label: "Bimensual" },
  { value: "TRIMESTRAL", label: "Trimestral" },
  { value: "SEMESTRAL", label: "Semestral" },
  { value: "ANUAL", label: "Anual" },
  { value: "A_DEMANDA", label: "A demanda" },
  { value: "CUANDO_SE_REQUIERA", label: "Cuando se requiera" },
];

type Programacion = "fecha" | "frecuencia";

interface FormValues {
  categoria: string;
  nombre: string;
  descripcionEvidencia: string;
  observacion: string;
  responsable: string;
  programacion: Programacion;
  frecuencia: Exclude<Frecuencia, "UNICA">;
  fechaEspecifica: string;
  fechaInicio: string;
}

export function ActivityFormModal({
  auditoriaId,
  activity,
  onClose,
  onSaved,
}: {
  auditoriaId: string;
  activity?: Activity | null;
  onClose: () => void;
  onSaved: (saved: Activity) => void;
}) {
  const isUnica = activity?.frecuencia === "UNICA";
  const toast = useToast();

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    defaultValues: activity
      ? {
          categoria: activity.categoria,
          nombre: activity.nombre,
          descripcionEvidencia: activity.descripcionEvidencia ?? "",
          observacion: activity.observacion ?? "",
          responsable: activity.responsable,
          programacion: isUnica ? "fecha" : "frecuencia",
          frecuencia: isUnica ? "MENSUAL" : (activity.frecuencia as Exclude<Frecuencia, "UNICA">),
          fechaEspecifica: activity.occurrences?.[0]?.fechaProgramada.slice(0, 10) ?? "",
          fechaInicio: "",
        }
      : {
          categoria: CATEGORIAS[0],
          programacion: "frecuencia",
          frecuencia: "MENSUAL",
          // Actividad nueva: arranca hoy, no el 1 de enero. Sin esto, una actividad
          // creada en septiembre generaba de entrada ocurrencias "Planeado" de
          // enero a agosto, todas ya vencidas sin que nadie las hubiera programado
          // realmente — quedaban huérfanas. El usuario puede igual borrar la fecha
          // o elegir una anterior si de verdad quiere cubrir el año completo.
          fechaInicio: new Date().toISOString().slice(0, 10),
        },
  });
  const programacion = watch("programacion");

  const [correoFile, setCorreoFile] = useState<File | null>(null);
  const [carpetaDestinoNombre, setCarpetaDestinoNombre] = useState<string | null>(null);
  const [carpetaDestinoHandle, setCarpetaDestinoHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [copiaError, setCopiaError] = useState<string | null>(null);

  useEffect(() => {
    if (!activity) return;
    getDestinationFolderForActivity(activity.id).then((f) => {
      setCarpetaDestinoNombre(f?.nombre ?? null);
      setCarpetaDestinoHandle(f?.handle ?? null);
    });
  }, [activity]);

  const handleSeleccionarCarpetaDestino = async () => {
    try {
      const picked = await pickDestinationFolderHandle();
      if (!picked) return;
      if (activity) await saveDestinationFolderForActivity(activity.id, picked.handle, picked.nombre);
      setCarpetaDestinoHandle(picked.handle);
      setCarpetaDestinoNombre(picked.nombre);
    } catch {
      // el usuario canceló el selector de carpeta: no es un error a mostrar
    }
  };

  const handleQuitarCarpetaDestino = async () => {
    if (activity) await removeDestinationFolderForActivity(activity.id);
    setCarpetaDestinoHandle(null);
    setCarpetaDestinoNombre(null);
  };

  const onSubmit = handleSubmit(async (values) => {
    setCopiaError(null);
    if (correoFile && !carpetaDestinoHandle) {
      setCopiaError("Selecciona la carpeta destino para poder copiar el correo adjuntado.");
      return;
    }

    const payload = {
      categoria: values.categoria,
      nombre: values.nombre,
      descripcionEvidencia: values.descripcionEvidencia,
      observacion: values.observacion,
      responsable: values.responsable,
      frecuencia: values.programacion === "fecha" ? ("UNICA" as const) : values.frecuencia,
      fechaEspecifica: values.programacion === "fecha" ? values.fechaEspecifica : undefined,
      fechaInicio: values.programacion === "frecuencia" ? values.fechaInicio || undefined : undefined,
    };
    const saved = activity ? await updateActivity(auditoriaId, activity.id, payload) : await createActivity(auditoriaId, payload);

    if (correoFile && carpetaDestinoHandle) {
      try {
        const permitido = await ensureWritePermission(carpetaDestinoHandle);
        if (!permitido) throw new Error("Permiso denegado para escribir en la carpeta destino.");
        await copyFileToFolder(carpetaDestinoHandle, correoFile);
      } catch {
        toast.warning(`La actividad se guardó, pero no se pudo copiar "${correoFile.name}" a la carpeta destino.`);
        onSaved(saved);
        return;
      }
    }

    if (!activity) toast.success(`Actividad "${saved.nombre}" creada correctamente.`);
    onSaved(saved);
  });

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[100] p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={onSubmit} className="space-form w-full max-w-[520px] max-h-[84vh] flex flex-col">
        <div className="space-form__stars" aria-hidden="true">
          <span className="space-star" />
          <span className="space-star" />
          <span className="space-star" />
          <span className="space-star" />
        </div>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <span className="space-form__title text-[16px]">
            <span>{activity ? "Editar actividad" : "+ Nueva actividad"}</span>
          </span>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1 flex flex-col gap-3.5">
          <div>
            <label className={labelCls}>Categoría</label>
            <select className={inputCls} {...register("categoria", { required: true })}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Actividad</label>
            <input className={inputCls} maxLength={300} {...register("nombre", { required: true })} />
            {errors.nombre && <span className="text-red text-[11px]">Requerido</span>}
          </div>
          <div>
            <label className={labelCls}>Descripción / Evidencia esperada</label>
            <input className={inputCls} maxLength={500} placeholder="Ej: Informe, Acta o correo…" {...register("descripcionEvidencia")} />
          </div>
          <div>
            <label className={labelCls}>Observación</label>
            <textarea
              className={`${inputCls} h-20 py-2`}
              maxLength={1000}
              placeholder="Notas adicionales sobre esta actividad…"
              {...register("observacion")}
            />
          </div>
          <div>
            <label className={labelCls}>Responsable</label>
            <input className={inputCls} maxLength={200} {...register("responsable", { required: true })} />
          </div>

          <div>
            <label className={labelCls}>Programación</label>
            <div className="flex gap-2 mb-2.5">
              <label
                className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md border text-[13px] cursor-pointer transition-colors ${
                  programacion === "fecha" ? "border-blue bg-blue-bg text-blue" : "border-border text-muted hover:text-text"
                }`}
              >
                <input type="radio" value="fecha" className="sr-only" {...register("programacion", { required: true })} />
                Fecha específica
              </label>
              <label
                className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md border text-[13px] cursor-pointer transition-colors ${
                  programacion === "frecuencia" ? "border-blue bg-blue-bg text-blue" : "border-border text-muted hover:text-text"
                }`}
              >
                <input type="radio" value="frecuencia" className="sr-only" {...register("programacion", { required: true })} />
                Frecuencia
              </label>
            </div>

            {programacion === "fecha" ? (
              <div>
                <input type="date" className={inputCls} {...register("fechaEspecifica", { required: programacion === "fecha" })} />
                {errors.fechaEspecifica && <span className="text-red text-[11px]">La fecha es obligatoria</span>}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <select className={inputCls} {...register("frecuencia", { required: programacion === "frecuencia" })}>
                  {FRECUENCIAS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {errors.frecuencia && <span className="text-red text-[11px]">La frecuencia es obligatoria</span>}
                <div>
                  <label className={labelCls}>Fecha de inicio (opcional)</label>
                  <input type="date" className={inputCls} {...register("fechaInicio")} />
                  <p className="text-[11px] text-muted mt-1">
                    Las ocurrencias empiezan a generarse desde esta fecha (por defecto, hoy). Si la borras, se generan todos los periodos del año en curso, incluidos los ya pasados.
                  </p>
                </div>
              </div>
            )}
          </div>

          {activity && isFolderPickerSupported() && (
            <div>
              <label className={labelCls}>Adjuntar correo (.eml, opcional)</label>
              <p className="text-[11px] text-muted mb-2">
                Al guardar, el correo se copia automáticamente a la carpeta destino que elijas. Solo queda en tu PC/red: no se sube al
                servidor.
              </p>
              <input
                type="file"
                accept=".eml,.msg"
                className="w-full text-[12.5px] text-muted file:mr-3 file:h-8 file:px-3 file:rounded-md file:border file:border-border file:bg-bg3 file:text-text file:text-[12px] file:cursor-pointer mb-2.5"
                onChange={(e) => setCorreoFile(e.target.files?.[0] ?? null)}
              />
              {carpetaDestinoNombre ? (
                <div className="flex items-center gap-2.5 text-[13px]">
                  <span className="text-text">{carpetaDestinoNombre}</span>
                  <Button type="button" variant="link" onClick={handleSeleccionarCarpetaDestino}>
                    Cambiar
                  </Button>
                  <Button type="button" variant="linkDestructive" onClick={handleQuitarCarpetaDestino}>
                    Quitar
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" onClick={handleSeleccionarCarpetaDestino}>
                  Seleccionar carpeta destino…
                </Button>
              )}
              {copiaError && <div className="text-red text-[11px] mt-1.5">{copiaError}</div>}
            </div>
          )}
        </div>
        <div className="px-5 py-3.5 border-t border-border flex justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando…" : activity ? "Guardar cambios" : "Crear actividad"}
          </Button>
        </div>
      </form>
    </div>
  );
}
