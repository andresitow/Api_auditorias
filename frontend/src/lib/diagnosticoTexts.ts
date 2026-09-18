import type { Oficina, ProviderTest, SistemaOperativo } from "@/types/formularios";

export const ISP_DEFAULT = ["Claro", "Movistar", "Starlink"];
export const FIREWALL_DEFAULT = ["Fortinet", "Sophos", "Cisco", "Palo Alto", "Mikrotik", "pfSense", "Endian"];
export const ANTIVIRUS_DEFAULT = ["Fortinet Endpoint", "Microsoft Defender", "Avast", "ESET", "Kaspersky", "McAfee"];

export const IPS_LISTA_BLANCA = [
  "201.184.125.177", "201.184.90.72", "181.48.35.184", "186.154.145.128", "190.144.88.122",
  "177.253.66.218", "177.253.66.219", "177.253.66.220", "177.253.66.221", "177.253.66.222",
  "177.253.67.146", "177.253.67.147", "177.253.67.148", "177.253.67.149", "177.253.67.150",
];

export function formatFecha(d: string): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

export function textoSO(sistemaOperativo: SistemaOperativo): string {
  if (sistemaOperativo === "mixto") {
    return `La mayoría de los equipos que utilizarán la aplicación SincoERP operan actualmente con el sistema operativo Microsoft Windows 10. Sin embargo, desde el Departamento de Infraestructura se recomienda actualizar los equipos a Windows 11 y mantenerlos al día mediante Windows Update, con el fin de garantizar un entorno más seguro, estable y eficiente, así como acceder oportunamente a las últimas actualizaciones, parches de seguridad y mejoras de rendimiento. Asimismo, la aplicación SincoERP es compatible con equipos Mac, tanto de escritorio como portátiles, lo que facilita su uso en diferentes plataformas tecnológicas y entornos de trabajo.`;
  }
  return `La mayoría de los equipos que utilizarán la aplicación SincoERP operan actualmente con el sistema operativo Windows 11. Desde el Departamento de Infraestructura, se recomienda mantener los equipos actualizados mediante Windows Update, con el fin de garantizar un entorno más seguro, estable y eficiente, así como recibir oportunamente las últimas actualizaciones, parches de seguridad y mejoras de rendimiento. Asimismo, la aplicación SincoERP es compatible con equipos Mac, tanto de escritorio como portátiles, lo que facilita su implementación y uso en diferentes plataformas tecnológicas y entornos de trabajo.`;
}

export function textoNavegadores(navegadores: string[], navegadorOtro?: string): string {
  const soloChromeEdge = navegadores.every((n) => n === "Chrome" || n === "Edge");
  if (soloChromeEdge) {
    return `Los usuarios utilizan los navegadores Google Chrome y Microsoft Edge para acceder y ejecutar SincoERP. Como recomendación, se debe verificar que ambos navegadores se encuentren actualizados a su última versión y configurar adecuadamente el uso de la memoria caché para evitar inconvenientes en la visualización o carga de información. Estas medidas contribuyen a garantizar un funcionamiento óptimo de la aplicación, así como una experiencia de usuario más estable, segura y eficiente.`;
  }
  const otros = navegadores
    .filter((n) => n !== "Chrome" && n !== "Edge")
    .map((n) => (n === "Otro" ? navegadorOtro : n))
    .join(", ");
  return `Los usuarios acceden a SincoERP utilizando ${navegadores.join(", ")}${otros ? " (" + otros + ")" : ""}, además de Google Chrome y Microsoft Edge en algunos casos. Dado que la aplicación ofrece su mejor desempeño y compatibilidad en Chrome y Edge, desde el Departamento de Infraestructura se recomienda estandarizar el uso de estos dos navegadores, verificar que se encuentren actualizados a su última versión y configurar adecuadamente el uso de la memoria caché, con el fin de evitar inconvenientes en la visualización o carga de información y garantizar una experiencia más estable y segura.`;
}

export function textoFirewall(firewallTiene: boolean, firewallNombre?: string): string {
  if (firewallTiene) {
    return `La compañía cuenta con firewall ${firewallNombre} que regula el tráfico y filtrado de contenido de red de los usuarios. Se recomienda agregar a la lista blanca, desde la consola del firewall, las siguientes URL's y el listado de IP's:`;
  }
  return `La compañía no cuenta con ningún dispositivo físico o software para regular el tráfico y filtrado de contenido, se recomienda informar a SincoSoft en el caso de adquirir un dispositivo o software que regule el tráfico y filtre el contenido para brindar las pautas y configuraciones a realizar y no tener ningún inconveniente al momento de usar SINCOERP.`;
}

export function esDefender(antivirusNombre: string): boolean {
  return antivirusNombre === "Microsoft Defender";
}

export function textoAntivirus(antivirusNombre: string): string {
  if (esDefender(antivirusNombre)) {
    return `La compañía cuenta con el antivirus por default de Windows Defender, se recomienda informar a Sinco en el caso de adquirir un servicio de antivirus para brindar las pautas y configuraciones a realizar y no tener ningún inconveniente al momento de usar SincoERP.`;
  }
  return `La compañía actualmente cuenta con el antivirus ${antivirusNombre}, se recomienda agregar a la lista blanca de la consola del antivirus el listado de IP's y URL:`;
}

function evaluarTest(test: ProviderTest, providerLabel: string): string[] {
  const obs: string[] = [];
  const { descarga, carga, ping } = test;
  if (ping !== undefined && ping > 50) obs.push(`Latencia alta en ${providerLabel} (${ping} ms)`);
  if (descarga !== undefined && descarga < 10) {
    obs.push(`velocidad de descarga por debajo de lo recomendado en ${providerLabel} (${descarga} Mbps)`);
  }
  if (carga !== undefined && carga < 5) {
    obs.push(`velocidad de carga por debajo de lo recomendado en ${providerLabel} (${carga} Mbps)`);
  }
  return obs;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function evaluarOficina(o: Oficina): string {
  const issues = [...evaluarTest(o.une, "Test UNE"), ...evaluarTest(o.claro, "Test Claro")];
  if (issues.length === 0) return "Cumple con los parámetros recomendados.";
  return capitalize(issues.join("; ")) + ". Se recomienda validar estos resultados con su proveedor de internet (ISP).";
}
