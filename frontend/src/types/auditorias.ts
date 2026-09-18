export type EstadoActividad = "PLANEADO" | "EJECUTADO" | "REPROGRAMADO" | "NO_REALIZADO";

export type Frecuencia =
  | "UNICA"
  | "DIARIO"
  | "MENSUAL"
  | "BIMENSUAL"
  | "TRIMESTRAL"
  | "SEMESTRAL"
  | "ANUAL"
  | "A_DEMANDA"
  | "CUANDO_SE_REQUIERA";

export interface Auditoria {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  totalActividades: number;
  totalOcurrencias: number;
  cumplimientoPct: number;
}

export interface CreateAuditoriaPayload {
  nombre: string;
  descripcion?: string;
}

export interface Activity {
  id: string;
  categoria: string;
  nombre: string;
  descripcionEvidencia: string | null;
  observacion: string | null;
  responsable: string;
  frecuencia: Frecuencia;
  activa: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  occurrences?: ActivityOccurrence[];
}

export interface OccurrenceEvidencia {
  id: string;
  occurrenceId: string;
  url: string;
  nombreOriginal: string;
  mimeType: string;
  tamano: number;
  createdBy: string | null;
  createdAt: string;
}

export interface ActivityOccurrence {
  id: string;
  activityId: string;
  activity?: Activity;
  periodo: string;
  fechaProgramada: string;
  fechaEjecucion: string | null;
  estado: EstadoActividad;
  observaciones: string | null;
  evidenciaUrl: string | null;
  evidenciaDescripcion: string | null;
  evidencias: OccurrenceEvidencia[];
  reprogramaciones: number;
  transcripcionRevisada: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityHistoryEntry {
  id: string;
  activityId: string | null;
  occurrenceId: string | null;
  action: string;
  campo: string | null;
  valorAnterior: string | null;
  valorNuevo: string | null;
  userId: string | null;
  username: string | null;
  createdAt: string;
}

export interface KpiSummary {
  anio: number;
  total: number;
  porEstado: Record<EstadoActividad, number>;
  vencidas: number;
  proximasAVencer: number;
  cumplimientoPct: number;
  semaforo: "verde" | "amarillo" | "rojo";
}

export interface SeriesPoint {
  periodo: string;
  programado: number;
  ejecutado: number;
  cumplimientoPct: number;
}

export interface CategoriaBreakdown {
  categoria: string;
  PLANEADO: number;
  EJECUTADO: number;
  REPROGRAMADO: number;
  NO_REALIZADO: number;
  cumplimientoPct: number;
}

export interface AlertasResponse {
  vencidas: ActivityOccurrence[];
  proximasAVencer: (ActivityOccurrence & { diasRestantes: number })[];
  sonidoActivo: boolean;
}

export interface AuditoriaConfig {
  id: number;
  diasAntes: number[];
  sonidoActivo: boolean;
  semaforoVerdePct: number;
  semaforoAmarilloPct: number;
  notificacionesActivas: boolean;
  teamsWebhookUrl: string | null;
  notifEmails: string | null;
  updatedAt: string;
}

export interface NotificationTestResult {
  teams?: "ok" | "error";
  email?: "ok" | "error";
}

export interface CreateActivityPayload {
  categoria: string;
  nombre: string;
  descripcionEvidencia?: string;
  observacion?: string;
  responsable: string;
  frecuencia: Frecuencia;
  fechaEspecifica?: string;
  fechaInicio?: string;
  activa?: boolean;
}

export type UpdateActivityPayload = Partial<CreateActivityPayload>;

export interface UpdateOccurrenceEstadoPayload {
  estado: EstadoActividad;
  fechaEjecucion?: string;
  observaciones?: string;
  evidenciaUrl?: string;
  evidenciaDescripcion?: string;
  eliminarEvidenciaIds?: string[];
}

export interface ReprogramOccurrencePayload {
  nuevaFecha: string;
  motivo: string;
}

export interface EditFechaOccurrencePayload {
  fechaProgramada: string;
}

export interface ImportPlanExcelError {
  fila: number;
  motivo: string;
}

export interface ImportPlanExcelResult {
  totalFilas: number;
  creadas: number;
  actualizadas: number;
  errores: ImportPlanExcelError[];
}

export interface GenerateYearResult {
  anio: number;
  actividadesProcesadas: number;
  periodosTotal: number;
  creadasTotal: number;
}

// --- Plan de acción del año siguiente (analytics-service) ---

export type PlanAccionPrioridad = "Alto" | "Medio" | "Bajo" | "Sin datos";

export type PlanAccionJobStatus =
  | "conectando"
  | "analizando"
  | "construyendo_plan"
  | "generando_excel"
  | "generando_pdf"
  | "listo"
  | "error";

export interface PlanAccionResumen {
  auditoriaId: string;
  auditoriaNombre: string;
  anioBase: number;
  anioPlan: number;
  totalActividades: number;
  cumplimientoGeneral: number;
  riesgoAlto: number;
  riesgoMedio: number;
  riesgoBajo: number;
  ocurrenciasPropuestas: number;
  generadoEn: string;
}

export interface PlanAccionProgressMessage {
  status: PlanAccionJobStatus;
  progress: number;
  mensaje: string;
  resumen?: PlanAccionResumen;
}

export interface PlanAccionCategoriaMetrica {
  categoria: string;
  total_actividades: number;
  cumplimiento_promedio: number;
  actividades_riesgo_alto: number;
  actividades_riesgo_medio: number;
}

export interface PlanAccionActividad {
  categoria: string;
  actividad: string;
  responsable: string;
  frecuencia: Frecuencia;
  frecuencia_propuesta: Frecuencia;
  cumplimiento_pct: number | null;
  prioridad: PlanAccionPrioridad;
  recomendacion: string;
  cronograma_propuesto: string;
  ocurrencias_propuestas: number;
}

export interface PlanAccionDetalle {
  resumen: PlanAccionResumen;
  categorias: PlanAccionCategoriaMetrica[];
  plan: PlanAccionActividad[];
}

export interface OccurrenceFilters {
  anio?: number;
  categoria?: string;
  responsable?: string;
  estado?: EstadoActividad;
  frecuencia?: Frecuencia;
  periodo?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  q?: string;
  overdue?: boolean;
  dueSoon?: boolean;
}
