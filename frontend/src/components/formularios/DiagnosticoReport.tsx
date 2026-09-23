import type { ReactNode } from "react";
import type { DiagnosticoPayload } from "@/types/formularios";
import { Button } from "@/components/ui/button";
import {
  IPS_LISTA_BLANCA,
  esDefender,
  evaluarOficina,
  formatFecha,
  textoAntivirus,
  textoFirewall,
  textoNavegadores,
  textoSO,
} from "@/lib/diagnosticoTexts";

export function DiagnosticoReport({
  data,
  onEdit,
  onPrint,
}: {
  data: DiagnosticoPayload;
  onEdit?: () => void;
  onPrint?: () => void;
}) {
  const defender = esDefender(data.antivirusNombre);

  const meta: [string, string][] = [
    ["Cliente", data.cliente],
    ["Nit", data.nit],
    ["Url producción", data.urlProduccion],
    ["Url pruebas", data.urlPruebas || "—"],
    ["Url portal IT", data.urlPortalIt || "—"],
    ["Fecha de revisión", formatFecha(data.fecha)],
    ["Tipo de sesión", data.sesionTipo],
    ["Motivo de revisión", data.motivo],
    ["ISP contratado", `${data.isp} — ${data.megas} Mbps`],
  ];

  return (
    <div className="bg-bg2 border border-border rounded-xl p-7">
      <h1 className="text-xl font-semibold border-b-2 border-blue pb-3 mb-4">Diagnóstico y Configuración de Infraestructura</h1>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] bg-bg3 rounded-lg px-4 py-3.5 mb-6">
        {meta.map(([label, value]) => (
          <div key={label}>
            <div className="text-[10.5px] uppercase tracking-wide text-muted">{label}</div>
            <div className="text-text">{value}</div>
          </div>
        ))}
      </div>

      <Section n={1} title="Sistema operativo">
        <p>{textoSO(data.sistemaOperativo)}</p>
      </Section>

      <Section n={2} title="Navegadores">
        <p>{textoNavegadores(data.navegadores, data.navegadorOtro)}</p>
      </Section>

      <Section n={3} title="Ancho de banda — Pruebas de velocidad">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr className="bg-bg3 text-muted">
                <th className="border border-border px-2.5 py-1.5 text-left">Sede</th>
                <th className="border border-border px-2.5 py-1.5" colSpan={3}>
                  Test UNE
                </th>
                <th className="border border-border px-2.5 py-1.5" colSpan={3}>
                  Test Claro
                </th>
                <th className="border border-border px-2.5 py-1.5 text-left">Observaciones</th>
              </tr>
              <tr className="bg-bg3 text-muted">
                <th className="border border-border px-2.5 py-1"></th>
                <th className="border border-border px-2.5 py-1">Descarga</th>
                <th className="border border-border px-2.5 py-1">Carga</th>
                <th className="border border-border px-2.5 py-1">Ping</th>
                <th className="border border-border px-2.5 py-1">Descarga</th>
                <th className="border border-border px-2.5 py-1">Carga</th>
                <th className="border border-border px-2.5 py-1">Ping</th>
                <th className="border border-border px-2.5 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {data.oficinas.map((o, i) => (
                <tr key={i}>
                  <td className="border border-border px-2.5 py-1.5">
                    {o.nombre}
                    {o.principal ? " (principal)" : ""}
                  </td>
                  <td className="border border-border px-2.5 py-1.5">{o.une.descarga ?? "—"} Mbps</td>
                  <td className="border border-border px-2.5 py-1.5">{o.une.carga ?? "—"} Mbps</td>
                  <td className="border border-border px-2.5 py-1.5">{o.une.ping ?? "—"} ms</td>
                  <td className="border border-border px-2.5 py-1.5">{o.claro.descarga ?? "—"} Mbps</td>
                  <td className="border border-border px-2.5 py-1.5">{o.claro.carga ?? "—"} Mbps</td>
                  <td className="border border-border px-2.5 py-1.5">{o.claro.ping ?? "—"} ms</td>
                  <td className="border border-border px-2.5 py-1.5">{evaluarOficina(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n={4} title="Filtrado de contenido (Firewall)">
        <p>{textoFirewall(data.firewallTiene, data.firewallNombre)}</p>
        {data.firewallTiene && <UrlsYWhitelist data={data} />}
      </Section>

      <Section n={5} title="Antivirus">
        {!defender && <p className="font-bold mb-1">CONSOLA ANTIVIRUS</p>}
        <p>{textoAntivirus(data.antivirusNombre)}</p>
        {!defender && <UrlsYWhitelist data={data} />}
      </Section>

      <div className="flex justify-between mt-7 print:hidden">
        {onEdit ? (
          <Button variant="ghost" onClick={onEdit}>
            ← Editar respuestas
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={onPrint ?? (() => window.print())}>Descargar / Imprimir PDF</Button>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-blue border-l-[3px] border-orange pl-2.5 mb-2">
        {n}. {title}
      </h2>
      <div className="text-[13.5px] text-text leading-relaxed">{children}</div>
    </div>
  );
}

function UrlsYWhitelist({ data }: { data: DiagnosticoPayload }) {
  return (
    <div className="mt-3">
      <table className="w-full text-[12.5px] border-collapse mb-3">
        <tbody>
          <tr>
            <th className="border border-border px-2.5 py-1.5 bg-bg3 text-left w-[160px]">Url producción</th>
            <td className="border border-border px-2.5 py-1.5">{data.urlProduccion}</td>
          </tr>
          {data.urlPruebas && (
            <tr>
              <th className="border border-border px-2.5 py-1.5 bg-bg3 text-left">Url pruebas</th>
              <td className="border border-border px-2.5 py-1.5">{data.urlPruebas}</td>
            </tr>
          )}
        </tbody>
      </table>
      <table className="w-full text-[12.5px] border-collapse">
        <thead>
          <tr>
            <th className="border border-border px-2.5 py-1.5 bg-bg3 text-left">IP a incluir en lista blanca</th>
          </tr>
        </thead>
        <tbody>
          {IPS_LISTA_BLANCA.map((ip) => (
            <tr key={ip}>
              <td className="border border-border px-2.5 py-1.5 font-mono">{ip}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
