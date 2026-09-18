import type { KpiSummary } from "@/types/auditorias";
import type { KpiFilterKind } from "./KpiDetailPanel";

function Tile({
  label,
  value,
  accent,
  bar,
  onClick,
  selected,
}: {
  label: string;
  value: string | number;
  accent?: string;
  bar?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`relative bg-bg2 border rounded-lg p-4 flex flex-col gap-1.5 min-w-[130px] overflow-hidden text-left ${
        selected ? "border-blue" : "border-border"
      } ${onClick ? "cursor-pointer hover:bg-bg3 transition-colors" : ""}`}
    >
      {bar && <span className={`absolute top-0 left-0 right-0 h-[3px] ${bar}`} />}
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
      <Tile label="Total" value={kpis.total} bar="bg-border" />
      <Tile
        label="Planeadas"
        value={kpis.porEstado.PLANEADO}
        accent="text-blue"
        bar="bg-blue"
        selected={selected === "PLANEADO"}
        onClick={() => onSelect?.("PLANEADO")}
      />
      <Tile
        label="Ejecutadas"
        value={kpis.porEstado.EJECUTADO}
        accent="text-green"
        bar="bg-green"
        selected={selected === "EJECUTADO"}
        onClick={() => onSelect?.("EJECUTADO")}
      />
      <Tile
        label="Reprogramadas"
        value={kpis.porEstado.REPROGRAMADO}
        accent="text-orange"
        bar="bg-orange"
        selected={selected === "REPROGRAMADO"}
        onClick={() => onSelect?.("REPROGRAMADO")}
      />
      <Tile
        label="No realizadas"
        value={kpis.porEstado.NO_REALIZADO}
        accent="text-red"
        bar="bg-red"
        selected={selected === "NO_REALIZADO"}
        onClick={() => onSelect?.("NO_REALIZADO")}
      />
      <Tile
        label="Vencidas"
        value={kpis.vencidas}
        accent="text-red"
        bar="bg-red"
        selected={selected === "vencidas"}
        onClick={() => onSelect?.("vencidas")}
      />
      <Tile
        label="Próx. a vencer"
        value={kpis.proximasAVencer}
        accent="text-yellow"
        bar="bg-yellow"
        selected={selected === "proximas"}
        onClick={() => onSelect?.("proximas")}
      />
    </div>
  );
}
