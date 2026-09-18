const STEP_LABELS = [
  "Datos generales",
  "Sistema operativo",
  "Navegadores",
  "Ancho de banda",
  "Firewall",
  "Antivirus",
  "Revisión final",
];

export function WizardProgress({ stepIndex }: { stepIndex: number }) {
  return (
    <div className="mb-5 print:hidden">
      <div className="flex gap-1.5 mb-2">
        {STEP_LABELS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < stepIndex ? "bg-green" : i === stepIndex ? "bg-blue" : "bg-bg3"
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>
          Paso {stepIndex + 1} de {STEP_LABELS.length}
        </span>
        <span>{STEP_LABELS[stepIndex]}</span>
      </div>
    </div>
  );
}
