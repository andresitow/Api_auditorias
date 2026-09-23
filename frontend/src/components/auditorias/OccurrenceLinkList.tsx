"use client";

import Link from "next/link";
import type { ActivityOccurrence } from "@/types/auditorias";
import { EstadoBadge } from "./EstadoBadge";

/** Lista compacta de ocurrencias (actividad, responsable, fecha y estado); cada fila
 * lleva a la vista de actividades filtrada por el nombre. La comparten AlertasWidget
 * y KpiDetailPanel. */
export function OccurrenceLinkList({ auditoriaId, items }: { auditoriaId: string; items: ActivityOccurrence[] }) {
  return (
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
  );
}
