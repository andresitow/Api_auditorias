export type ChannelStatus =
  | 'nuevo'
  | 'estable'
  | 'latencia_alta'
  | 'alerta_lentitud'
  | 'latencia_rec'
  | 'perdida'
  | 'alerta_critica'
  | 'canal_recuperado';

export type AlarmSeverity = 'critica' | 'informativa' | 'ok';

export interface AlarmEntry {
  hora: string;
  motivo: string;
  tipo: string;
  severidad: AlarmSeverity;
  inicio?: string;
  fin?: string;
  segundos?: number;
}

export interface ChannelRuntimeState {
  latencias: (number | null)[];
  perdidas: number;
  total: number;
  actual: number | null;
  alarmas: AlarmEntry[];
  est: ChannelStatus;
  malDesde: number | null;
  horaIni: string | null;
  segs: number;
  alarmaActiva: boolean;
  pingRaw: string;
}

export interface ChannelInfo {
  id: string;
  nombre: string;
  host: string;
  umbral: number;
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
  accion?: string;
}

export function initRuntimeState(): ChannelRuntimeState {
  return {
    latencias: [],
    perdidas: 0,
    total: 0,
    actual: null,
    alarmas: [],
    est: 'estable',
    malDesde: null,
    horaIni: null,
    segs: 0,
    alarmaActiva: false,
    pingRaw: '',
  };
}
