"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { ANALYTICS_WS_URL } from "@/services/api";
import type { PlanAccionJobStatus, PlanAccionProgressMessage } from "@/types/auditorias";

/** Se conecta directo al WebSocket de analytics-service (no pasa por el backend
 * NestJS) para recibir el progreso en vivo de la generación del plan de acción.
 * El job en sí lo dispara el caller vía generarPlanAccion() (services/auditorias.service.ts),
 * que sí pasa por el backend; acá solo escuchamos su avance. */
export function usePlanAccionJob(jobId: string | null) {
  const [status, setStatus] = useState<PlanAccionJobStatus | "idle">("idle");
  const [progress, setProgress] = useState(0);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reinicia el estado mostrado en cuanto cambia el jobId (nuevo job o vuelta a null),
  // calculado durante el render en vez de en el efecto de abajo, que solo debe manejar
  // la conexión del WebSocket (ver la guía de React sobre "adjusting state on prop change").
  const [trackedJobId, setTrackedJobId] = useState(jobId);
  if (jobId !== trackedJobId) {
    setTrackedJobId(jobId);
    setStatus("idle");
    setProgress(0);
    setMensaje("");
    setError(null);
  }

  useEffect(() => {
    if (!jobId) return;

    const token = Cookies.get("token");
    const socket = new WebSocket(`${ANALYTICS_WS_URL}/ws/jobs/${jobId}?token=${encodeURIComponent(token ?? "")}`);

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as PlanAccionProgressMessage;
        setStatus(payload.status);
        setProgress(payload.progress);
        setMensaje(payload.mensaje);
        if (payload.status === "error") setError(payload.mensaje);
      } catch {
        // mensaje no-JSON: se ignora
      }
    };
    socket.onerror = () => setError("Se perdió la conexión con el servicio de analítica");

    return () => socket.close();
  }, [jobId]);

  return { status, progress, mensaje, error, done: status === "listo" };
}
