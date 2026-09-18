export interface PingLine {
  hora: string;
  cls: "ok" | "warn" | "err";
  msText: string;
  raw: string;
}

export function PingLogBox({
  nombre,
  host,
  lines,
  status,
}: {
  nombre: string;
  host: string;
  lines: PingLine[];
  status: "ok" | "warn" | "crit";
}) {
  const dotColor = status === "crit" ? "bg-red blink" : status === "warn" ? "bg-yellow blink" : "bg-green";

  return (
    <div className="bg-bg2 border border-border rounded-[10px] overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between border-b border-border bg-bg3">
        <span className="text-[13px] font-semibold flex items-center gap-1.5">
          <span className={`w-[9px] h-[9px] rounded-full ${dotColor}`} />
          {nombre}
        </span>
        <span className="font-mono text-[10px] text-muted">{host}</span>
      </div>
      <div className="h-[200px] overflow-y-auto py-1.5 font-mono text-xs">
        {lines.map((l, i) => (
          <div key={i} className="px-3 py-0.5 flex gap-2 items-baseline border-b border-[rgba(48,54,61,0.4)] last:border-none">
            <span className="text-muted shrink-0 text-[11px]">{l.hora}</span>
            <span
              className={`font-semibold min-w-[52px] shrink-0 ${
                l.cls === "ok" ? "text-green" : l.cls === "warn" ? "text-yellow" : "text-red"
              }`}
            >
              {l.msText}
            </span>
            <span className="text-muted text-[11px] truncate">{l.raw}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
