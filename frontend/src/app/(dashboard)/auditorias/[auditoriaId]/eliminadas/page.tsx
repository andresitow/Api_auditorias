"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { listDeletedActivities } from "@/services/auditorias.service";
import type { DeletedActivity } from "@/types/auditorias";
import { DeletedActivityHistoryModal } from "@/components/auditorias/DeletedActivityHistoryModal";
import { formatFecha, formatFechaHora } from "@/lib/dates";

export default function ActividadesEliminadasPage() {
  const { auditoriaId } = useParams<{ auditoriaId: string }>();
  const [rows, setRows] = useState<DeletedActivity[] | null>(null);
  const [historyTarget, setHistoryTarget] = useState<DeletedActivity | null>(null);

  useEffect(() => {
    listDeletedActivities(auditoriaId).then(setRows).catch(() => setRows([]));
  }, [auditoriaId]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold">Actividades eliminadas</h2>
        <p className="text-[12.5px] text-muted">
          Fechas puntuales borradas del plan de trabajo. Quedan disponibles acá 30 días con su motivo e historial, y después se borran en
          definitiva de forma automática.
        </p>
      </div>

      {rows === null ? (
        <div className="text-center py-12 text-muted text-sm">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted text-sm">No hay actividades eliminadas.</div>
      ) : (
        <div className="royal-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-[12.5px] border-collapse">
              <thead>
                <tr className="bg-bg3 text-muted text-left">
                  <th className="border border-border px-2.5 py-1.5">Categoría</th>
                  <th className="border border-border px-2.5 py-1.5">Actividad</th>
                  <th className="border border-border px-2.5 py-1.5">Responsable</th>
                  <th className="border border-border px-2.5 py-1.5">F. Programada</th>
                  <th className="border border-border px-2.5 py-1.5">Motivo</th>
                  <th className="border border-border px-2.5 py-1.5">Eliminado por</th>
                  <th className="border border-border px-2.5 py-1.5">Eliminado el</th>
                  <th className="border border-border px-2.5 py-1.5">Se borra en</th>
                  <th className="border border-border px-2.5 py-1.5">Historial</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-bg3">
                    <td className="border border-border px-2.5 py-1.5 text-muted whitespace-nowrap">{row.categoria}</td>
                    <td className="border border-border px-2.5 py-1.5 text-text max-w-[240px]">{row.nombre}</td>
                    <td className="border border-border px-2.5 py-1.5 text-muted whitespace-nowrap">{row.responsable}</td>
                    <td className="border border-border px-2.5 py-1.5 font-mono whitespace-nowrap">{formatFecha(row.fechaProgramada)}</td>
                    <td className="border border-border px-2.5 py-1.5 text-muted max-w-[240px] whitespace-pre-wrap break-words">{row.motivo}</td>
                    <td className="border border-border px-2.5 py-1.5 text-muted whitespace-nowrap">{row.eliminadoPorUsername ?? "—"}</td>
                    <td className="border border-border px-2.5 py-1.5 font-mono text-muted whitespace-nowrap">
                      {formatFechaHora(row.eliminadoEn)}
                    </td>
                    <td className="border border-border px-2.5 py-1.5 whitespace-nowrap">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          row.diasRestantes <= 5 ? "bg-red-bg text-red" : "bg-bg3 text-muted"
                        }`}
                      >
                        {row.diasRestantes} día{row.diasRestantes === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td className="border border-border px-2.5 py-1.5 whitespace-nowrap">
                      <button className="royal-link hover:underline text-[12px]" onClick={() => setHistoryTarget(row)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {historyTarget && <DeletedActivityHistoryModal deletedActivity={historyTarget} onClose={() => setHistoryTarget(null)} />}
    </div>
  );
}
