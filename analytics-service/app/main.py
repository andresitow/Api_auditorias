"""Punto de entrada del microservicio de analítica. Expone:

- POST /jobs                    -> arranca la generación (auth por Bearer, mismo JWT del backend)
- GET  /jobs/{id}/resumen        -> KPIs del análisis en JSON (para mostrar en el frontend)
- GET  /jobs/{id}/excel|pdf      -> descarga del archivo generado
- WS   /ws/jobs/{id}?token=...   -> progreso en vivo (analizando -> generando_excel -> ... -> listo)
- GET  /auditorias/{id}/export/excel|pdf -> Excel/PDF del "Plan de Trabajo" del año en
  curso (sin job/WS: es una consulta+render directa, no un análisis pesado). El backend
  NestJS (export-bridge.service.ts) solo reenvía la petición con el Bearer del usuario.

El backend NestJS es quien decide qué auditoría existe y quién puede generarla
(ver backend/src/modules/auditorias/plan-siguiente-anio.* y export-bridge.service.ts);
este servicio solo valida que el token JWT sea válido, no vuelve a resolver permisos
de negocio."""

from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from . import db, jobs, plan_trabajo_report
from .config import CORS_ORIGINS
from .security import decode_token, require_auth
from .ws_manager import hub

app = FastAPI(title="Analytics Service — Plan de Acción")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerarPlanRequest(BaseModel):
    auditoriaId: str
    anio: int


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/jobs")
async def crear_job(body: GenerarPlanRequest, _user=Depends(require_auth)) -> dict:
    job_id = await jobs.start_job(body.auditoriaId, body.anio)
    return {"jobId": job_id}


@app.get("/jobs/{job_id}/resumen")
def get_resumen(job_id: str, _user=Depends(require_auth)) -> dict:
    result = jobs.get_result(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="El resumen no está disponible todavía")
    return {"resumen": result["resumen"], "categorias": result["categorias"], "plan": result["plan"]}


@app.get("/jobs/{job_id}/excel")
def get_excel(job_id: str, _user=Depends(require_auth)) -> Response:
    result = jobs.get_result(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="El archivo no está disponible todavía")
    anio = result["resumen"]["anioPlan"]
    return Response(
        content=result["files"]["excel"],
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="plan-accion-{anio}.xlsx"'},
    )


@app.get("/jobs/{job_id}/pdf")
def get_pdf(job_id: str, _user=Depends(require_auth)) -> Response:
    result = jobs.get_result(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="El archivo no está disponible todavía")
    anio = result["resumen"]["anioPlan"]
    return Response(
        content=result["files"]["pdf"],
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="plan-accion-{anio}.pdf"'},
    )


@app.get("/auditorias/{auditoria_id}/export/excel")
def get_plan_trabajo_excel(
    auditoria_id: str,
    anio: int,
    categoria: str | None = None,
    estado: str | None = None,
    _user=Depends(require_auth),
) -> Response:
    auditoria = db.fetch_auditoria(auditoria_id)
    if not auditoria:
        raise HTTPException(status_code=404, detail="La auditoría no existe")
    df = db.fetch_activities_for_export(auditoria_id, anio, categoria, estado)
    content = plan_trabajo_report.build_plan_trabajo_excel(auditoria["nombre"], anio, df)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="plan-trabajo-{anio}.xlsx"'},
    )


@app.get("/auditorias/{auditoria_id}/export/pdf")
def get_plan_trabajo_pdf(
    auditoria_id: str,
    anio: int,
    categoria: str | None = None,
    _user=Depends(require_auth),
) -> Response:
    auditoria = db.fetch_auditoria(auditoria_id)
    if not auditoria:
        raise HTTPException(status_code=404, detail="La auditoría no existe")
    df = db.fetch_activities_for_export(auditoria_id, anio, categoria, None)
    generado_en = datetime.now(timezone.utc).isoformat()
    content = plan_trabajo_report.build_plan_trabajo_pdf(auditoria["nombre"], anio, df, generado_en)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="resumen-auditoria-{anio}.pdf"'},
    )


@app.websocket("/ws/jobs/{job_id}")
async def ws_job(websocket: WebSocket, job_id: str) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return
    try:
        decode_token(token)
    except HTTPException:
        await websocket.close(code=4401)
        return

    await websocket.accept()
    await hub.register(job_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # el cliente no manda nada; solo detecta el disconnect
    except WebSocketDisconnect:
        pass
    finally:
        await hub.unregister(job_id, websocket)
