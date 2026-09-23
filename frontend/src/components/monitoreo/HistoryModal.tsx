import type { AlarmEntry } from "@/types";
import { Button } from "@/components/ui/button";

export function HistoryModal({
  nombre,
  alarmas,
  onClose,
}: {
  nombre: string;
  alarmas: AlarmEntry[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-[100] p-5"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-bg2 border border-border rounded-xl w-full max-w-[580px] max-h-[84vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <span className="text-[15px] font-semibold">Historial — {nombre}</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>
        <div className="overflow-y-auto px-5 py-3.5 flex-1">
          {alarmas.length === 0 ? (
            <div className="text-center py-9 text-muted text-[13px]">Sin alarmas registradas ✓</div>
          ) : (
            <>
              <div className="flex gap-2.5 px-3 py-2 bg-bg3 rounded-md mb-3.5 flex-wrap text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red" /> Crítica
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange" /> Lentitud
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue" /> Recuperado
                </span>
              </div>
              {alarmas.map((a, i) => {
                const isRec = ["canal_recuperado", "latencia_rec", "parcial"].includes(a.tipo);
                const isCrit = a.severidad === "critica";
                const cls = isRec ? "bg-blue-bg text-blue border-blue" : isCrit ? "bg-red-bg text-red border-red" : "bg-orange-bg text-orange border-orange";
                const txt = isRec ? "✓ REC" : isCrit ? "CRÍTICA" : "INFO";
                const msgColor = isCrit ? "text-red" : isRec ? "text-blue" : "text-orange";
                return (
                  <div key={i} className="flex items-start gap-3 py-2.5 border-b border-bg3 last:border-none">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 mt-px ${cls}`}>{txt}</span>
                    <div>
                      <div className="font-mono text-[11px] text-muted mb-0.5">{a.hora}</div>
                      <div className={`text-[13px] leading-snug ${msgColor}`}>{a.motivo}</div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
