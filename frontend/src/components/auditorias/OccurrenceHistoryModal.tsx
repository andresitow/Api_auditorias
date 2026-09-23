"use client";

import { useEffect, useState } from "react";
import { getOccurrenceHistory } from "@/services/auditorias.service";
import type { ActivityHistoryEntry, ActivityOccurrence } from "@/types/auditorias";
import { Button } from "@/components/ui/button";
import { formatFechaHora } from "@/lib/dates";
import { ACTION_LABEL } from "@/lib/historyLabels";

export function OccurrenceHistoryModal({
  auditoriaId,
  occurrence,
  onClose,
}: {
  auditoriaId: string;
  occurrence: ActivityOccurrence;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<ActivityHistoryEntry[] | null>(null);

  useEffect(() => {
    getOccurrenceHistory(auditoriaId, occurrence.id)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [auditoriaId, occurrence.id]);

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[100] p-5" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-bg2 border border-border rounded-xl w-full max-w-[560px] max-h-[84vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[15px] font-semibold">Historial de trazabilidad</div>
            <div className="text-[12px] text-muted">{occurrence.activity?.nombre}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>
        <div className="overflow-y-auto px-5 py-3.5 flex-1">
          {entries === null ? (
            <div className="text-center py-9 text-muted text-[13px]">Cargando…</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-9 text-muted text-[13px]">Sin cambios registrados aún.</div>
          ) : (
            entries.map((h) => (
              <div key={h.id} className="flex items-start gap-3 py-2.5 border-b border-bg3 last:border-none">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 mt-px bg-blue-bg text-blue border-blue">
                  {ACTION_LABEL[h.action] ?? h.action}
                </span>
                <div className="flex-1">
                  <div className="font-mono text-[11px] text-muted mb-0.5">
                    {formatFechaHora(h.createdAt)} · {h.username ?? "sistema"}
                  </div>
                  {h.campo && (
                    <div className="text-[13px] text-text leading-snug">
                      <span className="text-muted">{h.campo}:</span> {h.valorAnterior ?? "—"} → {h.valorNuevo ?? "—"}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
