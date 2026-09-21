"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listOccurrences } from "@/services/auditorias.service";
import type { ActivityOccurrence, EstadoActividad } from "@/types/auditorias";
import { EstadoBadge } from "./EstadoBadge";

export type KpiFilterKind = "total" | "PLANEADO" | "EJECUTADO" | "REPROGRAMADO" | "NO_REALIZADO" | "vencidas" | "proximas";

interface KpiFilterDef {
  label: string;
  estado?: EstadoActividad;
  overdue?: boolean;
  dueSoon?: boolean;
  badgeClass: string;
}

export const KPI_FILTERS: Record<KpiFilterKind, KpiFilterDef> = {
  total: { label: "actividades en total", badgeClass: "bg-bg3 text-text" },
  PLANEADO: { label: "planeadas", estado: "PLANEADO", badgeClass: "bg-blue-bg text-blue" },
  EJECUTADO: { label: "ejecutadas", estado: "EJECUTADO", badgeClass: "bg-green-bg text-green" },
  REPROGRAMADO: { label: "reprogramadas", estado: "REPROGRAMADO", badgeClass: "bg-orange-bg text-orange" },
  NO_REALIZADO: { label: "no realizadas", estado: "NO_REALIZADO", badgeClass: "bg-red-bg text-red" },
  vencidas: { label: "vencidas", overdue: true, badgeClass: "bg-red-bg text-red" },
  proximas: { label: "próximas a vencer", dueSoon: true, badgeClass: "bg-yellow-bg text-yellow" },
};

export function KpiDetailPanel({
  auditoriaId,
  anio,
  kind,
  onClose,
}: {
  auditoriaId: string;
  anio: number;
  kind: KpiFilterKind;
  onClose: () => void;
}) {
  const filter = KPI_FILTERS[kind];
  const [items, setItems] = useState<ActivityOccurrence[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listOccurrences(auditoriaId, { anio, estado: filter.estado, overdue: filter.overdue, dueSoon: filter.dueSoon })
      .then((data) => !cancelled && setItems(data))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [auditoriaId, anio, filter.estado, filter.overdue, filter.dueSoon]);

  return (
    <div className="bg-bg2 border border-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full font-medium ${filter.badgeClass}`}>
          {items ? items.length : "…"} {filter.label}
        </span>
        <button onClick={onClose} className="text-muted hover:text-text text-[12px] shrink-0">
          Cerrar ✕
        </button>
      </div>
      {items === null ? (
        <div className="text-[12.5px] text-muted py-2">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="text-[12.5px] text-muted py-2">No hay actividades {filter.label}.</div>
      ) : (
        <div className="flex flex-col divide-y divide-border max-h-[260px] overflow-y-auto">
          {items.map((o) => (
            <Link
              key={o.id}
              href={`/auditorias/${auditoriaId}/actividades?q=${encodeURIComponent(o.activity?.nombre ?? "")}`}
              className="flex items-center justify-between gap-3 py-2 text-[12.5px] hover:bg-bg3 px-1 rounded"
            >
              <div className="truncate">
                <span className="text-text">{o.activity?.nombre}</span>
                <span className="text-muted"> · {o.activity?.responsable}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-muted font-mono text-[11px]">{o.fechaProgramada.slice(0, 10)}</span>
                <EstadoBadge estado={o.estado} compact />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
