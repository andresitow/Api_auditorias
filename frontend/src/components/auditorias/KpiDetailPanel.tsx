"use client";

import { useEffect, useState } from "react";
import { listOccurrences } from "@/services/auditorias.service";
import type { ActivityOccurrence, EstadoActividad } from "@/types/auditorias";
import { OccurrenceLinkList } from "./OccurrenceLinkList";
import { Button } from "@/components/ui/button";

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
    <div className="royal-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full font-medium ${filter.badgeClass}`}>
          {items ? items.length : "…"} {filter.label}
        </span>
        <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
          Cerrar ✕
        </Button>
      </div>
      {items === null ? (
        <div className="text-[12.5px] text-muted py-2">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="text-[12.5px] text-muted py-2">No hay actividades {filter.label}.</div>
      ) : (
        <OccurrenceLinkList auditoriaId={auditoriaId} items={items} />
      )}
    </div>
  );
}
