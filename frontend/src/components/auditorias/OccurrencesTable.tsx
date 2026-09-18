"use client";

import { useState } from "react";
import type { ActivityOccurrence } from "@/types/auditorias";
import { EstadoBadge } from "./EstadoBadge";

function formatFecha(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const FRECUENCIA_LABEL: Record<string, string> = {
  UNICA: "Fecha específica",
};

export function OccurrencesTable({
  occurrences,
  onChangeEstado,
  onReprogramar,
  onEditarFecha,
  onHistorial,
  onEliminarActividad,
  eliminando = false,
}: {
  occurrences: ActivityOccurrence[];
  onChangeEstado: (o: ActivityOccurrence) => void;
  onReprogramar: (o: ActivityOccurrence) => void;
  onEditarFecha: (o: ActivityOccurrence) => void;
  onHistorial: (o: ActivityOccurrence) => void;
  onEliminarActividad: (o: ActivityOccurrence) => void;
  eliminando?: boolean;
}) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  if (occurrences.length === 0) {
    return <div className="text-center py-12 text-muted text-sm">No hay ocurrencias que coincidan con los filtros.</div>;
  }

  return (
    <div className="overflow-x-auto bg-bg2 border border-border rounded-lg">
      <table className="w-full min-w-[1200px] text-[12.5px] border-collapse">
        <thead>
          <tr className="bg-bg3 text-muted text-left">
            <th className="border border-border px-2.5 py-1.5">Categoría</th>
            <th className="border border-border px-2.5 py-1.5">Actividad</th>
            <th className="border border-border px-2.5 py-1.5">Responsable</th>
            <th className="border border-border px-2.5 py-1.5">Frecuencia</th>
            <th className="border border-border px-2.5 py-1.5">Periodo</th>
            <th className="border border-border px-2.5 py-1.5">F. Programada</th>
            <th className="border border-border px-2.5 py-1.5">F. Ejecución</th>
            <th className="border border-border px-2.5 py-1.5">Estado</th>
            <th className="border border-border px-2.5 py-1.5">Observación</th>
            <th className="border border-border px-2.5 py-1.5">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {occurrences.map((o) => {
            const vencida = o.estado === "PLANEADO" && o.fechaProgramada.slice(0, 10) < today;
            return (
              <tr key={o.id} className={`hover:bg-bg3 ${vencida ? "bg-red-bg/40" : ""}`}>
                <td className="border border-border px-2.5 py-1.5 text-muted whitespace-nowrap">{o.activity?.categoria}</td>
                <td className="border border-border px-2.5 py-1.5 text-text max-w-[280px]">{o.activity?.nombre}</td>
                <td className="border border-border px-2.5 py-1.5 text-muted whitespace-nowrap">{o.activity?.responsable}</td>
                <td className="border border-border px-2.5 py-1.5 text-muted whitespace-nowrap">
                  {o.activity?.frecuencia ? (FRECUENCIA_LABEL[o.activity.frecuencia] ?? o.activity.frecuencia) : ""}
                </td>
                <td className="border border-border px-2.5 py-1.5 font-mono text-muted whitespace-nowrap">{o.periodo}</td>
                <td className="border border-border px-2.5 py-1.5 font-mono whitespace-nowrap">
                  {formatFecha(o.fechaProgramada)}
                  {vencida && (
                    <span className="ml-1.5 text-red" title="Vencida">
                      (vencida)
                    </span>
                  )}
                </td>
                <td className="border border-border px-2.5 py-1.5 font-mono text-muted whitespace-nowrap">
                  {o.fechaEjecucion ? formatFecha(o.fechaEjecucion) : "—"}
                </td>
                <td className="border border-border px-2.5 py-1.5 whitespace-nowrap">
                  <EstadoBadge estado={o.estado} compact />
                </td>
                <td className="border border-border px-2.5 py-1.5 text-muted max-w-[220px] whitespace-pre-wrap break-words">
                  {o.observaciones ?? "—"}
                </td>
                <td className="border border-border px-2.5 py-1.5 whitespace-nowrap">
                  <div className="flex gap-2.5">
                    <button onClick={() => onChangeEstado(o)} className="text-blue hover:underline">
                      Estado
                    </button>
                    <button onClick={() => onReprogramar(o)} className="text-orange hover:underline">
                      Reprogramar
                    </button>
                    <button onClick={() => onEditarFecha(o)} className="text-blue hover:underline">
                      Editar fecha
                    </button>
                    <button onClick={() => onHistorial(o)} className="text-muted hover:underline">
                      Historial
                    </button>
                    <button
                      onClick={() => onEliminarActividad(o)}
                      disabled={eliminando}
                      className="text-red hover:underline disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
