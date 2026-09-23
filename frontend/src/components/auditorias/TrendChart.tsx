"use client";

import { useState } from "react";
import type { SeriesPoint } from "@/types/auditorias";

const MES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatPeriodo(periodo: string): string {
  if (/^\d{1,2}$/.test(periodo)) return MES_CORTO[Number(periodo) - 1] ?? periodo;
  if (periodo.startsWith("B")) {
    const n = Number(periodo.slice(1));
    const startMonth = (n - 1) * 2;
    return `${MES_CORTO[startMonth]}-${MES_CORTO[startMonth + 1]}`;
  }
  if (periodo.startsWith("Q")) {
    const n = Number(periodo.slice(1));
    const startMonth = (n - 1) * 3;
    return `${MES_CORTO[startMonth]}-${MES_CORTO[startMonth + 2]}`;
  }
  return periodo;
}

export function TrendChart({ series }: { series: SeriesPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 180;
  const pad = 28;

  if (series.length === 0) return null;

  const max = 100;
  const stepX = (W - pad * 2) / Math.max(series.length - 1, 1);
  const points = series.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - p.cumplimientoPct / max) * (H - pad * 2);
    return { x, y, p };
  });
  const linePoints = points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[180px] block">
        {gridLines.map((g) => {
          const y = pad + (1 - g / max) * (H - pad * 2);
          return (
            <g key={g}>
              <line x1={pad} y1={y} x2={W - pad} y2={y} stroke="rgba(255,255,255,0.22)" strokeWidth={0.6} />
              <text x={2} y={y + 3} fontSize={9} fill="#c5d0ee">
                {g}%
              </text>
            </g>
          );
        })}
        <polyline points={linePoints} fill="none" stroke="#58a6ff" strokeWidth={2} strokeLinejoin="round" />
        {points.map((pt, i) => (
          <g key={i}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={hover === i ? 4 : 2.5}
              fill="#58a6ff"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            <rect
              x={pt.x - stepX / 2}
              y={pad}
              width={stepX}
              height={H - pad * 2}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            <text x={pt.x} y={H - 6} fontSize={9} fill="#c5d0ee" textAnchor="middle">
              {formatPeriodo(pt.p.periodo)}
            </text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div
          className="absolute top-0 -translate-x-1/2 bg-[#12246b] border border-white/20 rounded-md px-2.5 py-1.5 text-[11px] pointer-events-none"
          style={{ left: `${(points[hover].x / W) * 100}%` }}
        >
          <div className="text-text font-medium">{formatPeriodo(points[hover].p.periodo)}</div>
          <div className="text-muted">
            {points[hover].p.ejecutado}/{points[hover].p.programado} · {points[hover].p.cumplimientoPct}%
          </div>
        </div>
      )}
    </div>
  );
}
