import type { EstadoActividad } from "@/types/auditorias";

const ESTADO_CFG: Record<EstadoActividad, { letra: string; label: string; classes: string }> = {
  PLANEADO: { letra: "P", label: "Planeado", classes: "bg-blue-bg text-blue" },
  EJECUTADO: { letra: "E", label: "Ejecutado", classes: "bg-green-bg text-green" },
  REPROGRAMADO: { letra: "R", label: "Reprogramado", classes: "bg-orange-bg text-orange" },
  NO_REALIZADO: { letra: "N", label: "No realizado", classes: "bg-red-bg text-red" },
};

export function EstadoBadge({ estado, compact = false }: { estado: EstadoActividad; compact?: boolean }) {
  const cfg = ESTADO_CFG[estado];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-medium ${cfg.classes}`}>
      <span className="font-bold">{cfg.letra}</span>
      {!compact && <span>{cfg.label}</span>}
    </span>
  );
}

export { ESTADO_CFG };
