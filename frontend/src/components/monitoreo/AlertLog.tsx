import { Button } from "@/components/ui/button";

export interface LogLine {
  hora: string;
  canal: string;
  msg: string;
  sev: "critica" | "informativa" | "recuperado" | "ok";
}

const PILLS: Record<LogLine["sev"], [string, string]> = {
  critica: ["bg-red-bg text-red", "CRIT"],
  informativa: ["bg-orange-bg text-orange", "AVISO"],
  recuperado: ["bg-green-bg text-green", "REC"],
  ok: ["bg-green-bg text-green", "OK"],
};

export function AlertLog({ lines, onClear }: { lines: LogLine[]; onClear: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted uppercase tracking-wide">Registro de alarmas</span>
        <Button variant="outline" size="sm" onClick={onClear} className="hover:border-red hover:text-red">
          Limpiar
        </Button>
      </div>
      <div className="bg-bg2 border border-border rounded-lg px-3.5 py-2.5 h-[380px] overflow-y-auto font-mono text-xs">
        {lines.length === 0 && <div className="text-muted py-2">Sin eventos todavía.</div>}
        {lines.map((l, i) => {
          const [cls, label] = PILLS[l.sev];
          return (
            <div key={i} className="py-1 border-b border-bg3 last:border-none flex gap-2 items-baseline">
              <span className="text-muted shrink-0">{l.hora}</span>
              <span className={`text-[10px] px-1.5 rounded-lg font-bold ${cls}`}>{label}</span>
              <span className="font-semibold text-muted min-w-[52px]">{l.canal}</span>
              <span className="text-muted">{l.msg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
