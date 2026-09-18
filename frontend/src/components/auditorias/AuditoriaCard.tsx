import Link from "next/link";
import type { Auditoria } from "@/types/auditorias";

function semaforoColor(pct: number) {
  if (pct >= 90) return { bar: "bg-green", text: "text-green" };
  if (pct >= 70) return { bar: "bg-yellow", text: "text-yellow" };
  return { bar: "bg-red", text: "text-red" };
}

export function AuditoriaCard({ auditoria }: { auditoria: Auditoria }) {
  const sem = semaforoColor(auditoria.cumplimientoPct);

  return (
    <Link
      href={`/auditorias/${auditoria.id}`}
      className="group bg-bg2 border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-blue hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[15px] font-semibold text-text leading-tight group-hover:text-blue transition-colors line-clamp-2">
            {auditoria.nombre}
          </span>
        </div>
        {!auditoria.activa && (
          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-bg3 text-muted">Inactiva</span>
        )}
      </div>

      {auditoria.descripcion && <p className="text-[12.5px] text-muted leading-snug line-clamp-2">{auditoria.descripcion}</p>}

      <div className="flex items-end justify-between gap-3 mt-auto">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase tracking-wide text-muted">Actividades</span>
          <span className="text-lg font-semibold text-text">{auditoria.totalActividades}</span>
        </div>
        <div className="flex flex-col gap-0.5 items-end">
          <span className="text-[11px] uppercase tracking-wide text-muted">Cumplimiento {new Date().getFullYear()}</span>
          <span className={`text-lg font-semibold ${sem.text}`}>{auditoria.cumplimientoPct}%</span>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-bg3 overflow-hidden">
        <div className={`h-full rounded-full ${sem.bar}`} style={{ width: `${auditoria.cumplimientoPct}%` }} />
      </div>
    </Link>
  );
}
