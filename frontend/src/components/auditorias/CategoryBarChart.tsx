"use client";

import { useState } from "react";
import type { CategoriaBreakdown } from "@/types/auditorias";

const SEGMENTS: { key: keyof Pick<CategoriaBreakdown, "PLANEADO" | "EJECUTADO" | "REPROGRAMADO" | "NO_REALIZADO">; color: string; label: string }[] = [
  { key: "EJECUTADO", color: "#3fb950", label: "Ejecutado" },
  { key: "PLANEADO", color: "#58a6ff", label: "Planeado" },
  { key: "REPROGRAMADO", color: "#e07b3a", label: "Reprogramado" },
  { key: "NO_REALIZADO", color: "#f85149", label: "No realizado" },
];

export function CategoryBarChart({ data }: { data: CategoriaBreakdown[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (data.length === 0) return <div className="text-sm text-muted">Sin datos para el año seleccionado.</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {SEGMENTS.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {data.map((cat) => {
          const total = cat.PLANEADO + cat.EJECUTADO + cat.REPROGRAMADO + cat.NO_REALIZADO;
          const isExpanded = expanded === cat.categoria;
          return (
            <div key={cat.categoria} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <div className="w-[220px] shrink-0 text-[12px] text-text truncate" title={cat.categoria}>
                  {cat.categoria}
                </div>
                <svg
                  viewBox="0 0 300 14"
                  className="flex-1 h-3.5 block rounded overflow-hidden bg-bg3 cursor-pointer"
                  role="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpanded(isExpanded ? null : cat.categoria)}
                >
                  {(() => {
                    let x = 0;
                    return SEGMENTS.map((s) => {
                      const value = cat[s.key];
                      const width = total === 0 ? 0 : (value / total) * 300;
                      const rect = (
                        <rect key={s.key} x={x} y={0} width={width} height={14} fill={s.color}>
                          <title>{`${s.label}: ${value} (${total === 0 ? 0 : Math.round((value / total) * 100)}%)`}</title>
                        </rect>
                      );
                      x += width;
                      return rect;
                    });
                  })()}
                </svg>
                <div className="w-12 shrink-0 text-right text-[12px] font-medium text-text">{cat.cumplimientoPct}%</div>
              </div>
              {isExpanded && (
                <div className="ml-[232px] flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted bg-bg3 rounded px-2.5 py-1.5">
                  {SEGMENTS.map((s) => {
                    const value = cat[s.key];
                    const pct = total === 0 ? 0 : Math.round((value / total) * 100);
                    return (
                      <div key={s.key} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
                        <span className="text-text">{pct}%</span>
                        <span>
                          {s.label} ({value})
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
