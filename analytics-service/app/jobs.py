"""Orquesta la generación del plan de acción: consulta la BD, corre el análisis
pandas/numpy, arma la propuesta, genera Excel/PDF y publica el progreso en vivo
por WebSocket (ws_manager.hub). Los resultados quedan en memoria de proceso
(job_id -> bytes) hasta que expiran (JOB_TTL_SECONDS) — no hay persistencia en
disco ni en BD: si el servicio se reinicia, los jobs en curso se pierden y hay
que volver a generar el plan desde el frontend."""

import asyncio
import time
import uuid
from datetime import datetime, timezone

from . import analysis, db, excel_report, pdf_report, plan_builder
from .config import JOB_TTL_SECONDS
from .ws_manager import hub

_results: dict[str, dict] = {}  # job_id -> {"resumen":..., "categorias":..., "plan":..., "files": {"excel":bytes,"pdf":bytes}, "createdAt": float}


def _prune_expired() -> None:
    now = time.time()
    expired = [jid for jid, data in _results.items() if now - data["createdAt"] > JOB_TTL_SECONDS]
    for jid in expired:
        _results.pop(jid, None)
        hub.forget(jid)


async def start_job(auditoria_id: str, anio_plan: int) -> str:
    _prune_expired()
    job_id = uuid.uuid4().hex
    hub.start(job_id)
    asyncio.create_task(_run(job_id, auditoria_id, anio_plan))
    return job_id


def get_result(job_id: str) -> dict | None:
    return _results.get(job_id)


async def _run(job_id: str, auditoria_id: str, anio_plan: int) -> None:
    anio_base = anio_plan - 1
    try:
        await hub.publish(job_id, {"status": "conectando", "progress": 5, "mensaje": "Conectando a la base de datos"})
        auditoria = await asyncio.to_thread(db.fetch_auditoria, auditoria_id)
        if not auditoria:
            await hub.publish(job_id, {"status": "error", "progress": 0, "mensaje": "La auditoría no existe"})
            return
        cfg = await asyncio.to_thread(db.fetch_config)

        await hub.publish(
            job_id,
            {"status": "analizando", "progress": 20, "mensaje": f"Analizando cumplimiento {anio_base} con pandas/numpy"},
        )
        df = await asyncio.to_thread(db.fetch_activities_with_occurrences, auditoria_id, anio_base)
        if df.empty:
            await hub.publish(
                job_id,
                {"status": "error", "progress": 0, "mensaje": f"No hay actividades activas para analizar en {anio_base}"},
            )
            return

        activity_metrics = analysis.compute_activity_metrics(df, cfg["semaforoVerdePct"], cfg["semaforoAmarilloPct"])
        cat_metrics = analysis.compute_categoria_metrics(activity_metrics)

        await hub.publish(
            job_id,
            {"status": "construyendo_plan", "progress": 45, "mensaje": f"Construyendo la propuesta de plan {anio_plan}"},
        )
        plan = plan_builder.build_plan(activity_metrics, anio_plan)

        total_programadas = int(activity_metrics["total_programadas"].sum())
        total_ejecutadas = int(activity_metrics["ejecutadas"].sum())
        resumen = {
            "auditoriaId": auditoria_id,
            "auditoriaNombre": auditoria["nombre"],
            "anioBase": anio_base,
            "anioPlan": anio_plan,
            "totalActividades": int(len(activity_metrics)),
            "cumplimientoGeneral": round((total_ejecutadas / total_programadas) * 100, 1) if total_programadas else 0.0,
            "riesgoAlto": int((activity_metrics["prioridad"] == "Alto").sum()),
            "riesgoMedio": int((activity_metrics["prioridad"] == "Medio").sum()),
            "riesgoBajo": int((activity_metrics["prioridad"].isin(["Bajo", "Sin datos"])).sum()),
            "ocurrenciasPropuestas": int(plan["ocurrencias_propuestas"].sum()),
            "generadoEn": datetime.now(timezone.utc).isoformat(),
        }

        await hub.publish(job_id, {"status": "generando_excel", "progress": 70, "mensaje": "Generando Excel con openpyxl"})
        excel_bytes = await asyncio.to_thread(excel_report.build_excel_report, auditoria["nombre"], resumen, cat_metrics, plan)

        await hub.publish(job_id, {"status": "generando_pdf", "progress": 90, "mensaje": "Generando PDF"})
        pdf_bytes = await asyncio.to_thread(pdf_report.build_pdf_report, auditoria["nombre"], resumen, cat_metrics, plan)

        _results[job_id] = {
            "resumen": resumen,
            "categorias": cat_metrics.to_dict("records"),
            "plan": plan.drop(columns=["activity_id"], errors="ignore").to_dict("records"),
            "files": {"excel": excel_bytes, "pdf": pdf_bytes},
            "createdAt": time.time(),
        }

        await hub.publish(job_id, {"status": "listo", "progress": 100, "mensaje": "Plan de acción generado", "resumen": resumen})
    except Exception as exc:  # noqa: BLE001 — cualquier falla debe llegar al cliente por WS, no solo a los logs
        await hub.publish(job_id, {"status": "error", "progress": 0, "mensaje": f"Error generando el plan: {exc}"})
