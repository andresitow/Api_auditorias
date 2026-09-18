import { api } from "./api";
import type {
  DiagnosticoPayload,
  DiagnosticoResumen,
  FormOptionCategory,
  FormOptionsResponse,
} from "@/types/formularios";

export function createDiagnostico(payload: DiagnosticoPayload) {
  return api.post<DiagnosticoResumen>("/forms/diagnosticos", payload).then((r) => r.data);
}

export function listDiagnosticos() {
  return api.get<DiagnosticoResumen[]>("/forms/diagnosticos").then((r) => r.data);
}

export function getDiagnostico(id: string) {
  return api.get<DiagnosticoResumen>(`/forms/diagnosticos/${id}`).then((r) => r.data);
}

export function getFormOptions() {
  return api.get<FormOptionsResponse>("/forms/opciones").then((r) => r.data);
}

export function addFormOption(category: FormOptionCategory, value: string) {
  return api.post("/forms/opciones", { category, value });
}
