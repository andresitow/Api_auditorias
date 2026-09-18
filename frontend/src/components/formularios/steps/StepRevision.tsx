"use client";

import { useFormContext } from "react-hook-form";
import type { DiagnosticoPayload } from "@/types/formularios";
import { formatFecha } from "@/lib/diagnosticoTexts";

export function StepRevision() {
  const { watch } = useFormContext<DiagnosticoPayload>();
  const data = watch();

  const rows: [string, string][] = [
    ["Cliente", data.cliente || "—"],
    ["Nit", data.nit || "—"],
    ["Url producción", data.urlProduccion || "—"],
    ["Url pruebas", data.urlPruebas || "—"],
    ["Url portal IT", data.urlPortalIt || "—"],
    ["Fecha", formatFecha(data.fecha)],
    ["Tipo de sesión", data.sesionTipo],
    ["Motivo", data.motivo],
    ["Sistema operativo", data.sistemaOperativo === "mixto" ? "Windows 10 y 11" : "Windows 11"],
    [
      "Navegadores",
      `${data.navegadores?.join(", ") ?? ""}${data.navegadores?.includes("Otro") ? ` (${data.navegadorOtro})` : ""}`,
    ],
    ["ISP / Megas", `${data.isp || "—"} — ${data.megas || 0} Mbps contratados`],
    ["Sedes registradas", data.oficinas?.map((o) => o.nombre || "(sin nombre)").join(", ") ?? ""],
    ["Firewall", data.firewallTiene ? data.firewallNombre || "—" : "No cuenta con firewall"],
    ["Antivirus", data.antivirusNombre || "—"],
  ];

  return (
    <div className="bg-bg2 border border-border rounded-xl p-6">
      <h2 className="text-base font-semibold mb-1 text-blue">Revisión final</h2>
      <p className="text-muted text-[13px] mb-4">
        Verifique los datos antes de generar el informe. Puede volver atrás para corregir cualquier campo.
      </p>
      <div className="border border-border rounded-lg overflow-hidden">
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={`grid grid-cols-[180px_1fr] text-sm ${i !== rows.length - 1 ? "border-b border-border" : ""}`}
          >
            <div className="bg-bg3 text-muted px-3 py-2.5 font-medium">{label}</div>
            <div className="px-3 py-2.5">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
