import type { ChannelEventPayload, ChannelStatus } from "@/types";
import { Sparkline } from "./Sparkline";
import { Button } from "@/components/ui/button";

const STATUS_CFG: Record<
  ChannelStatus,
  { border: string; glow?: string; dot: string; badge: string; label: (p: ChannelEventPayload) => string }
> = {
  nuevo: { border: "border-border", dot: "bg-muted", badge: "bg-bg3 text-muted", label: () => "Iniciando…" },
  estable: { border: "border-green", dot: "bg-green", badge: "bg-green-bg text-green", label: () => "✓ Estable" },
  latencia_alta: {
    border: "border-yellow",
    dot: "bg-yellow blink",
    badge: "bg-yellow-bg text-yellow",
    label: (p) => `Latencia alta — alarma en ${Math.max(0, p.duracion_lat - p.segundos_malo)}s`,
  },
  alerta_lentitud: {
    border: "border-orange",
    glow: "shadow-[0_0_10px_rgba(224,123,58,0.25)]",
    dot: "bg-orange blink",
    badge: "bg-orange-bg text-orange",
    label: () => "Alerta lentitud",
  },
  latencia_rec: {
    border: "border-blue",
    glow: "shadow-[0_0_8px_rgba(88,166,255,0.2)]",
    dot: "bg-blue",
    badge: "bg-blue-bg text-blue",
    label: () => "↩ Latencia recuperada",
  },
  perdida: {
    border: "border-yellow",
    dot: "bg-yellow blink",
    badge: "bg-yellow-bg text-yellow",
    label: (p) => `Pérdida — alarma en ${Math.max(0, p.duracion_cfg - p.segundos_malo)}s`,
  },
  alerta_critica: {
    border: "border-red",
    glow: "shadow-[0_0_18px_rgba(248,81,73,0.5)]",
    dot: "bg-red blink",
    badge: "bg-red-bg text-red",
    label: () => "Caída crítica",
  },
  canal_recuperado: {
    border: "border-blue",
    glow: "shadow-[0_0_8px_rgba(88,166,255,0.2)]",
    dot: "bg-blue",
    badge: "bg-blue-bg text-blue",
    label: () => "Canal recuperado",
  },
};

export function ChannelCard({
  data,
  onRemove,
  onShowHistory,
}: {
  data: ChannelEventPayload;
  onRemove: (id: string) => void;
  onShowHistory: (id: string) => void;
}) {
  const est = data.estado_actual || "nuevo";
  const cfg = STATUS_CFG[est] ?? STATUS_CFG.nuevo;
  const secs = data.segundos_malo || 0;

  const latText = data.actual !== null ? `${data.actual.toFixed(1)} ms` : "— ms";
  const latColor =
    est === "alerta_critica" || est === "perdida" ? "text-red" : est === "latencia_alta" || est === "alerta_lentitud" ? "text-yellow" : "text-green";

  const valid = (data.latencias || []).filter((x): x is number => x !== null);
  const prom = valid.length ? `${(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1)} ms` : "—";
  const perd = data.total ? ((data.perdidas / data.total) * 100).toFixed(1) : "0.0";
  const perdColor = parseFloat(perd) > 5 ? "text-red" : parseFloat(perd) > 0 ? "text-yellow" : "text-green";
  const barW = data.actual !== null ? Math.min((data.actual / (data.umbral * 2)) * 100, 100) : 100;
  const barColor =
    est === "alerta_critica" || est === "perdida"
      ? "var(--red)"
      : est === "latencia_alta" || est === "alerta_lentitud"
        ? "var(--yellow)"
        : "var(--green)";

  const nA = (data.alarmas || []).length;
  const nC = (data.alarmas || []).filter((a) => a.severidad === "critica").length;

  return (
    <div
      className={`bg-bg2 border-[1.5px] rounded-[10px] p-4 transition-colors ${cfg.border} ${cfg.glow ?? ""} ${
        est === "alerta_critica" ? "card-critical" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
          {data.nombre}
        </span>
        <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${cfg.badge}`}>{cfg.label(data)}</span>
      </div>

      {secs > 0 && (est === "latencia_alta" || est === "perdida") && (
        <div className="text-xs font-mono bg-bg3 rounded-md px-2.5 py-1.5 mb-2.5 border-l-[3px] border-yellow text-yellow">
          {est === "perdida" ? "Sin respuesta" : "Latencia alta"} hace <strong>{secs}s</strong>
        </div>
      )}
      {est === "alerta_critica" && (
        <div className="text-xs font-mono bg-bg3 rounded-md px-2.5 py-1.5 mb-2.5 border-l-[3px] border-red text-red">
          Caída crítica — sin respuesta desde {data.hora_inicio_caida || "—"} (<strong>{secs}s</strong>)
        </div>
      )}
      {est === "alerta_lentitud" && (
        <div className="text-xs font-mono bg-bg3 rounded-md px-2.5 py-1.5 mb-2.5 border-l-[3px] border-orange text-orange">
          Latencia alta desde {data.hora_inicio_caida || "—"} (<strong>{secs}s</strong>)
        </div>
      )}
      {(est === "latencia_rec" || est === "canal_recuperado") && (
        <div className="text-xs font-mono bg-bg3 rounded-md px-2.5 py-1.5 mb-2.5 border-l-[3px] border-blue text-blue">
          {est === "latencia_rec" ? "Latencia normalizada" : "Canal recuperado"}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-bg3 rounded-md px-2.5 py-2">
          <div className="text-[10px] text-muted uppercase tracking-wide mb-0.5">Última</div>
          <div className={`text-[17px] font-semibold font-mono ${latColor}`}>{latText}</div>
        </div>
        <div className="bg-bg3 rounded-md px-2.5 py-2">
          <div className="text-[10px] text-muted uppercase tracking-wide mb-0.5">Promedio</div>
          <div className="text-[17px] font-semibold font-mono text-muted">{prom}</div>
        </div>
        <div className="bg-bg3 rounded-md px-2.5 py-2">
          <div className="text-[10px] text-muted uppercase tracking-wide mb-0.5">Pérdida</div>
          <div className={`text-[17px] font-semibold font-mono ${perdColor}`}>{perd}%</div>
        </div>
      </div>

      <div className="h-1 bg-bg3 rounded-full mb-3 overflow-hidden">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${barW}%`, background: barColor }} />
      </div>

      <Sparkline latencias={data.latencias || []} umbral={data.umbral || 100} />

      <div className="flex items-center justify-between pt-2.5 border-t border-border text-[11px] text-muted">
        <span className="font-mono truncate max-w-[150px]" title={data.host}>
          ⬡ {data.host}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onShowHistory(data.id)}
            className={`bg-bg3 border rounded-md text-muted text-xs px-2.5 py-1 flex items-center gap-1 ${
              nC > 0 ? "border-red text-red" : nA > 0 ? "border-orange text-orange" : "border-border"
            }`}
          >
            {nA} alarma{nA !== 1 ? "s" : ""}
            {nC > 0 && <span className="ml-0.5 text-[10px] bg-red-bg text-red rounded-md px-1.5">{nC}</span>}
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(data.id)}
            className="hover:border hover:border-red hover:bg-red-bg hover:text-red"
          >
            ✕ quitar
          </Button>
        </div>
      </div>
    </div>
  );
}
