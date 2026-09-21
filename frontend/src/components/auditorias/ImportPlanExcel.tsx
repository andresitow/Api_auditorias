"use client";

import { useRef, useState } from "react";
import { importPlanExcel, descargarPlantillaImportExcel } from "@/services/auditorias.service";
import type { ImportPlanExcelResult } from "@/types/auditorias";

/** Sube un .xlsx (misma plantilla que descargarPlantillaImportExcel) y sincroniza el
 * plan de trabajo con su contenido: por cada fila crea la actividad si no existe (match
 * por categoría + nombre dentro de la auditoría) o actualiza la existente, y al final
 * remueve (elimina o desactiva) las actividades de la auditoría que no aparecían en el
 * archivo. Si el archivo trae la grilla mensual de estados (formato nativo), también
 * sincroniza el % de cumplimiento real: pone en cada ocurrencia el estado (Ejecutado/
 * Reprogramado/No realizado) que ya estaba marcado en el Excel, en vez de dejarla en
 * Planeado. Ver backend import-excel.service.ts para la lógica de matching, validación
 * por fila y sincronización. */
export function ImportPlanExcel({ auditoriaId, onImported }: { auditoriaId: string; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportPlanExcelResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPick = () => inputRef.current?.click();

  const closeModal = () => {
    setResult(null);
    setError(null);
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo si se reintenta
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await importPlanExcel(auditoriaId, file);
      setResult(r);
      if (r.creadas > 0 || r.actualizadas > 0 || r.eliminadas > 0 || r.desactivadas > 0 || r.estadosSincronizados > 0)
        onImported();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo importar el archivo";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={onFileChange} />
      <button
        onClick={onPick}
        disabled={loading}
        className="h-9 px-3.5 rounded-md border border-border text-text text-[13px] hover:bg-bg3 disabled:opacity-60"
      >
        {loading ? "Sincronizando…" : "Actualizar plan desde el cargue de excel"}
      </button>

      {(result || error) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeModal}>
          <div className="w-full max-w-lg bg-bg2 border border-border rounded-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-text">Importar plan desde Excel</h2>
              <button onClick={closeModal} className="text-muted hover:text-text text-lg leading-none">
                ×
              </button>
            </div>

            {error && <div className="text-[13px] text-red bg-red-bg rounded-md p-3">{error}</div>}

            {result && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[13px]">
                  <Kpi label="Filas procesadas" value={String(result.totalFilas)} />
                  <Kpi label="Creadas" value={String(result.creadas)} tone="green" />
                  <Kpi label="Actualizadas" value={String(result.actualizadas)} tone="blue" />
                  <Kpi label="Desactivadas" value={String(result.desactivadas)} tone="orange" />
                  <Kpi label="Eliminadas" value={String(result.eliminadas)} tone="red" />
                  <Kpi label="Estados sincronizados" value={String(result.estadosSincronizados)} tone="blue" />
                </div>

                {result.errores.length > 0 && (
                  <div>
                    <div className="text-[12px] font-medium text-red mb-1.5">{result.errores.length} fila(s) con error</div>
                    <div className="max-h-[220px] overflow-y-auto flex flex-col gap-1">
                      {result.errores.map((e, i) => (
                        <div key={i} className="text-[12px] text-muted bg-bg3 rounded px-2.5 py-1.5">
                          Fila {e.fila}: {e.motivo}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => descargarPlantillaImportExcel(auditoriaId)}
              className="mt-4 text-[12px] text-blue hover:underline"
            >
              Descargar plantilla de ejemplo
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "green" | "blue" | "orange" | "red" }) {
  const toneClass =
    tone === "green"
      ? "text-green"
      : tone === "blue"
        ? "text-blue"
        : tone === "orange"
          ? "text-orange"
          : tone === "red"
            ? "text-red"
            : "text-text";
  return (
    <div className="bg-bg3 border border-border rounded-md px-3 py-2">
      <div className="text-muted text-[11px]">{label}</div>
      <div className={`text-[16px] font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
