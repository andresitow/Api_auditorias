"use client";

import Link from "next/link";
import { useAuditoriaAlerts } from "@/hooks/useAuditoriaAlerts";
import { EstadoBadge } from "./EstadoBadge";

export function AlertasWidget({ auditoriaId }: { auditoriaId: string }) {
  const alertas = useAuditoriaAlerts(auditoriaId);
  if (!alertas) return null;

  const { vencidas, proximasAVencer } = alertas;
  if (vencidas.length === 0 && proximasAVencer.length === 0) {
    return (
      <div className="bg-bg2 border border-border rounded-lg p-4 text-sm text-muted">
        ✓ No hay actividades vencidas ni próximas a vencer.
      </div>
    );
  }

  const items = [...vencidas, ...proximasAVencer].slice(0, 12);

  return (
    <div className="bg-bg2 border border-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        {vencidas.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full bg-red-bg text-red font-medium">
            {vencidas.length} vencida{vencidas.length === 1 ? "" : "s"}
          </span>
        )}
        {proximasAVencer.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full bg-yellow-bg text-yellow font-medium">
            {proximasAVencer.length} próxima{proximasAVencer.length === 1 ? "" : "s"} a vencer
          </span>
        )}
      </div>
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
    </div>
  );
}
