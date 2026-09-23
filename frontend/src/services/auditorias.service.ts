import { api } from "./api";
import type {
  Activity,
  ActivityHistoryEntry,
  ActivityOccurrence,
  AlertasResponse,
  Auditoria,
  AuditoriaConfig,
  CategoriaBreakdown,
  CreateActivityPayload,
  CreateAuditoriaPayload,
  DeletedActivity,
  EditFechaOccurrencePayload,
  GenerateYearResult,
  ImportPlanExcelResult,
  KpiSummary,
  NotificationTestResult,
  OccurrenceFilters,
  PlanAccionDetalle,
  ReprogramOccurrencePayload,
  SeriesPoint,
  UpdateActivityPayload,
  UpdateOccurrenceEstadoPayload,
} from "@/types/auditorias";

function toQuery<T extends object>(params: T) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// --- Catálogo de auditorías ---

export function listAuditorias() {
  return api.get<Auditoria[]>("/auditorias").then((r) => r.data);
}

export function getAuditoria(auditoriaId: string) {
  return api.get<Auditoria>(`/auditorias/${auditoriaId}`).then((r) => r.data);
}

export function createAuditoria(payload: CreateAuditoriaPayload) {
  return api.post<Auditoria>("/auditorias", payload).then((r) => r.data);
}

export function updateAuditoria(auditoriaId: string, payload: Partial<CreateAuditoriaPayload & { activa: boolean }>) {
  return api.patch<Auditoria>(`/auditorias/${auditoriaId}`, payload).then((r) => r.data);
}

// --- Actividades (dentro de una auditoría) ---

export function listActivities(
  auditoriaId: string,
  filters: { categoria?: string; responsable?: string; frecuencia?: string; activa?: boolean; q?: string } = {},
) {
  return api.get<Activity[]>(`/auditorias/${auditoriaId}/activities${toQuery(filters)}`).then((r) => r.data);
}

export function listCategorias(auditoriaId: string) {
  return api.get<string[]>(`/auditorias/${auditoriaId}/activities/categorias`).then((r) => r.data);
}

export function getActivity(auditoriaId: string, id: string) {
  return api.get<Activity>(`/auditorias/${auditoriaId}/activities/${id}`).then((r) => r.data);
}

export function createActivity(auditoriaId: string, payload: CreateActivityPayload) {
  return api.post<Activity>(`/auditorias/${auditoriaId}/activities`, payload).then((r) => r.data);
}

export function updateActivity(auditoriaId: string, id: string, payload: UpdateActivityPayload) {
  return api.patch<Activity>(`/auditorias/${auditoriaId}/activities/${id}`, payload).then((r) => r.data);
}

export function deactivateActivity(auditoriaId: string, id: string) {
  return api.delete<{ ok: boolean; eliminada: boolean }>(`/auditorias/${auditoriaId}/activities/${id}`).then((r) => r.data);
}

export function importPlanExcel(auditoriaId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return api
    .post<ImportPlanExcelResult>(`/auditorias/${auditoriaId}/activities/import-excel`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
}

// --- Ocurrencias ---

export function listOccurrences(auditoriaId: string, filters: OccurrenceFilters = {}) {
  return api.get<ActivityOccurrence[]>(`/auditorias/${auditoriaId}/occurrences${toQuery(filters)}`).then((r) => r.data);
}

export function getOccurrence(auditoriaId: string, id: string) {
  return api.get<ActivityOccurrence>(`/auditorias/${auditoriaId}/occurrences/${id}`).then((r) => r.data);
}

export function changeOccurrenceEstado(
  auditoriaId: string,
  id: string,
  payload: UpdateOccurrenceEstadoPayload,
  evidencias?: File[],
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    form.set(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
  }
  for (const file of evidencias ?? []) form.append("evidencias", file);
  return api.patch<ActivityOccurrence>(`/auditorias/${auditoriaId}/occurrences/${id}/estado`, form).then((r) => r.data);
}

export function reprogramOccurrence(auditoriaId: string, id: string, payload: ReprogramOccurrencePayload) {
  return api.patch<ActivityOccurrence>(`/auditorias/${auditoriaId}/occurrences/${id}/reprogramar`, payload).then((r) => r.data);
}

export function editOccurrenceFecha(auditoriaId: string, id: string, payload: EditFechaOccurrencePayload) {
  return api.patch<ActivityOccurrence>(`/auditorias/${auditoriaId}/occurrences/${id}/fecha`, payload).then((r) => r.data);
}

export function generateYear(auditoriaId: string, anio: number) {
  return api.post<GenerateYearResult>(`/auditorias/${auditoriaId}/generate-year${toQuery({ anio })}`).then((r) => r.data);
}

export function deleteOccurrence(auditoriaId: string, id: string, motivo: string) {
  return api
    .delete<{ ok: boolean; actividadEliminada: boolean }>(`/auditorias/${auditoriaId}/occurrences/${id}`, { data: { motivo } })
    .then((r) => r.data);
}

// --- Papelera de actividades eliminadas ---

export function listDeletedActivities(auditoriaId: string) {
  return api.get<DeletedActivity[]>(`/auditorias/${auditoriaId}/deleted-activities`).then((r) => r.data);
}

export function getOccurrenceHistory(auditoriaId: string, id: string) {
  return api.get<ActivityHistoryEntry[]>(`/auditorias/${auditoriaId}/occurrences/${id}/history`).then((r) => r.data);
}

// --- Dashboard ---

export function getKpis(auditoriaId: string, anio: number, categoria?: string) {
  return api.get<KpiSummary>(`/auditorias/${auditoriaId}/dashboard/kpis${toQuery({ anio, categoria })}`).then((r) => r.data);
}

export function getSeries(auditoriaId: string, anio: number, groupBy: "mes" | "bimestre" | "trimestre" = "mes", categoria?: string) {
  return api.get<SeriesPoint[]>(`/auditorias/${auditoriaId}/dashboard/series${toQuery({ anio, groupBy, categoria })}`).then((r) => r.data);
}

export function getPorCategoria(auditoriaId: string, anio: number) {
  return api.get<CategoriaBreakdown[]>(`/auditorias/${auditoriaId}/dashboard/por-categoria${toQuery({ anio })}`).then((r) => r.data);
}

export function getAlertas(auditoriaId: string) {
  return api.get<AlertasResponse>(`/auditorias/${auditoriaId}/dashboard/alertas`).then((r) => r.data);
}

// --- Configuración global de recordatorios ---

export function getAuditoriaConfig() {
  return api.get<AuditoriaConfig>("/auditoria-config").then((r) => r.data);
}

export function updateAuditoriaConfig(
  payload: Partial<
    Pick<
      AuditoriaConfig,
      "diasAntes" | "sonidoActivo" | "semaforoVerdePct" | "semaforoAmarilloPct" | "notificacionesActivas" | "teamsWebhookUrl" | "notifEmails"
    >
  >,
) {
  return api.patch<AuditoriaConfig>("/auditoria-config", payload).then((r) => r.data);
}

export function testAuditoriaNotification() {
  return api.post<NotificationTestResult>("/auditoria-config/test-notification").then((r) => r.data);
}

// --- Exportación ---

async function downloadBlob(url: string, filename: string) {
  const { data } = await api.get<Blob>(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function descargarPlantillaImportExcel(auditoriaId: string) {
  return downloadBlob(`/auditorias/${auditoriaId}/activities/import-excel/plantilla`, "plantilla-plan-trabajo.xlsx");
}

export function exportExcel(auditoriaId: string, anio: number, categoria?: string, estado?: string) {
  return downloadBlob(`/auditorias/${auditoriaId}/export/excel${toQuery({ anio, categoria, estado })}`, `plan-trabajo-${anio}.xlsx`);
}

export function exportPdf(auditoriaId: string, anio: number, categoria?: string) {
  return downloadBlob(`/auditorias/${auditoriaId}/export/pdf${toQuery({ anio, categoria })}`, `resumen-auditoria-${anio}.pdf`);
}

// --- Plan de acción del año siguiente (analytics-service, vía proxy del backend) ---

export function generarPlanAccion(auditoriaId: string, anio: number) {
  return api.post<{ jobId: string }>(`/auditorias/${auditoriaId}/plan-siguiente-anio/generar${toQuery({ anio })}`).then((r) => r.data);
}

export function getPlanAccionResumen(auditoriaId: string, jobId: string) {
  return api.get<PlanAccionDetalle>(`/auditorias/${auditoriaId}/plan-siguiente-anio/${jobId}/resumen`).then((r) => r.data);
}

export function exportPlanAccionExcel(auditoriaId: string, jobId: string, anio: number) {
  return downloadBlob(`/auditorias/${auditoriaId}/plan-siguiente-anio/${jobId}/excel`, `plan-accion-${anio}.xlsx`);
}

export function exportPlanAccionPdf(auditoriaId: string, jobId: string, anio: number) {
  return downloadBlob(`/auditorias/${auditoriaId}/plan-siguiente-anio/${jobId}/pdf`, `plan-accion-${anio}.pdf`);
}
