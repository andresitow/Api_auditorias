const CFG = {
  verde: { dot: "bg-green", classes: "bg-green-bg text-green", label: "En cumplimiento" },
  amarillo: { dot: "bg-yellow", classes: "bg-yellow-bg text-yellow", label: "En riesgo" },
  rojo: { dot: "bg-red", classes: "bg-red-bg text-red", label: "Crítico" },
} as const;

export function Semaforo({ estado }: { estado: "verde" | "amarillo" | "rojo" }) {
  const cfg = CFG[estado];
  return (
    <span className={`inline-flex items-center gap-2 text-[13px] px-3 py-1.5 rounded-full font-medium ${cfg.classes}`}>
      <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} pulse-dot`} />
      {cfg.label}
    </span>
  );
}
