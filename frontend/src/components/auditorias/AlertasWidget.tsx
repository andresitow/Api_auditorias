"use client";

import { useAuditoriaAlerts } from "@/hooks/useAuditoriaAlerts";
import { OccurrenceLinkList } from "./OccurrenceLinkList";

export function AlertasWidget({ auditoriaId }: { auditoriaId: string }) {
  const alertas = useAuditoriaAlerts(auditoriaId);
  if (!alertas) return null;

  const { vencidas, proximasAVencer } = alertas;
  if (vencidas.length === 0 && proximasAVencer.length === 0) {
    return (
      <div className="royal-card p-4 text-sm text-muted">
        ✓ No hay actividades vencidas ni próximas a vencer.
      </div>
    );
  }

  const items = [...vencidas, ...proximasAVencer].slice(0, 12);

  return (
    <div className="royal-card p-4 flex flex-col gap-3">
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
      <OccurrenceLinkList auditoriaId={auditoriaId} items={items} />
    </div>
  );
}
