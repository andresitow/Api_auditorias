export type SesionTipo = "Presencial" | "Remoto";
export type SistemaOperativo = "mixto" | "w11";
export type FormOptionCategory = "isp" | "firewall" | "antivirus";

export interface ProviderTest {
  descarga?: number;
  carga?: number;
  ping?: number;
}

export interface Oficina {
  principal: boolean;
  nombre: string;
  une: ProviderTest;
  claro: ProviderTest;
}

export interface DiagnosticoPayload {
  sesionTipo: SesionTipo;
  motivo: string;
  cliente: string;
  nit: string;
  urlProduccion: string;
  urlPruebas?: string;
  urlPortalIt?: string;
  fecha: string;
  sistemaOperativo: SistemaOperativo;
  navegadores: string[];
  navegadorOtro?: string;
  isp: string;
  megas: number;
  oficinas: Oficina[];
  firewallTiene: boolean;
  firewallNombre?: string;
  antivirusNombre: string;
}

export interface DiagnosticoResumen extends DiagnosticoPayload {
  id: string;
  createdAt: string;
  createdBy?: string | null;
}

export type FormOptionsResponse = Record<FormOptionCategory, string[]>;
