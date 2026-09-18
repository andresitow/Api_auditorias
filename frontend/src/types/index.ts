export type ChannelStatus =
  | "nuevo"
  | "estable"
  | "latencia_alta"
  | "alerta_lentitud"
  | "latencia_rec"
  | "perdida"
  | "alerta_critica"
  | "canal_recuperado";

export interface AlarmEntry {
  hora: string;
  motivo: string;
  tipo: string;
  severidad: "critica" | "informativa" | "ok";
  inicio?: string;
  fin?: string;
  segundos?: number;
}

export interface ChannelEventPayload {
  id: string;
  nombre: string;
  host: string;
  actual: number | null;
  latencias: (number | null)[];
  perdidas: number;
  total: number;
  alarmas: AlarmEntry[];
  umbral: number;
  duracion_cfg: number;
  duracion_lat: number;
  segundos_malo: number;
  hora_inicio_caida: string | null;
  estado_actual: ChannelStatus;
  alarma_activa: boolean;
  ping_raw: string;
  tipo: string;
  nueva_alarma?: AlarmEntry;
}

export interface MonitorConfig {
  umbralMs: number;
  intervaloSeg: number;
  duracionPerdida: number;
  duracionLat: number;
}

export interface User {
  id: string;
  username: string;
}
