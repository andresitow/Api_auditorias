interface Props {
  latencias: (number | null)[];
  umbral: number;
}

export function Sparkline({ latencias, umbral }: Props) {
  const W = 278;
  const H = 44;
  const pad = 2;
  const valid = latencias.filter((v): v is number => v !== null);

  if (valid.length < 2) {
    return (
      <svg className="w-full h-11 block mb-2.5">
        <text x={4} y={26} fontSize={11} fill="var(--muted)">
          esperando…
        </text>
      </svg>
    );
  }

  const max = Math.max(...valid, umbral * 1.5);
  const points = latencias
    .map((v, i) => {
      const x = pad + (i / (latencias.length - 1)) * (W - pad * 2);
      const y = v === null ? H - pad : pad + (1 - v / max) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const thresholdY = (pad + (1 - umbral / max) * (H - pad * 2)).toFixed(1);

  return (
    <svg className="w-full h-11 block mb-2.5" viewBox={`0 0 ${W} ${H}`}>
      <line
        x1={pad}
        y1={thresholdY}
        x2={W - pad}
        y2={thresholdY}
        stroke="var(--red)"
        strokeWidth={0.8}
        strokeDasharray="3,3"
      />
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}
