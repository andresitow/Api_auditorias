import type { KpiSummary } from "@/types/auditorias";
import type { KpiFilterKind } from "./KpiDetailPanel";

function Tile({
  label,
  value,
  accent,
  onClick,
  selected,
}: {
  label: string;
  value: string | number;
  accent?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`royal-card [--rc-radius:0.75rem] p-4 flex flex-col gap-1.5 min-w-[130px] text-left ${
        selected ? "outline-2 outline-offset-2 outline-[#3a63e8]" : ""
      } ${onClick ? "royal-card--interactive" : ""}`}
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <span className={`text-2xl font-semibold ${accent ?? "text-text"}`}>{value}</span>
    </Comp>
  );
}

export function KpiRow({
  kpis,
  selected,
  onSelect,
}: {
  kpis: KpiSummary;
  selected?: KpiFilterKind | null;
  onSelect?: (kind: KpiFilterKind) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      <Tile
        label="Total"
        value={kpis.total}
        selected={selected === "total"}
        onClick={() => onSelect?.("total")}
      />
      <Tile
        label="Planeadas"
        value={kpis.porEstado.PLANEADO}
        accent="text-blue"
        selected={selected === "PLANEADO"}
        onClick={() => onSelect?.("PLANEADO")}
      />
      <Tile
        label="Ejecutadas"
        value={kpis.porEstado.EJECUTADO}
        accent="text-green"
        selected={selected === "EJECUTADO"}
        onClick={() => onSelect?.("EJECUTADO")}
      />
      <Tile
        label="Reprogramadas"
        value={kpis.porEstado.REPROGRAMADO}
        accent="text-orange"
        selected={selected === "REPROGRAMADO"}
        onClick={() => onSelect?.("REPROGRAMADO")}
      />
      <Tile
        label="No realizadas"
        value={kpis.porEstado.NO_REALIZADO}
        accent="text-red"
        selected={selected === "NO_REALIZADO"}
        onClick={() => onSelect?.("NO_REALIZADO")}
      />
      <Tile
        label="Vencidas"
        value={kpis.vencidas}
        accent="text-red"
        selected={selected === "vencidas"}
        onClick={() => onSelect?.("vencidas")}
      />
      <Tile
        label="Próx. a vencer"
        value={kpis.proximasAVencer}
        accent="text-yellow"
        selected={selected === "proximas"}
        onClick={() => onSelect?.("proximas")}
      />
    </div>
  );
}
