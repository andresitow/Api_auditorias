# Analytics Service — Plan de acción del año siguiente

Microservicio Python (FastAPI) que genera, a partir del desempeño histórico de una
auditoría, una **propuesta de plan de acción para el año siguiente** y la exporta a
Excel (`openpyxl`) y PDF (`reportlab` + `matplotlib`), analizando los datos con
`pandas`/`numpy`. Publica el progreso de la generación en vivo por **WebSocket**.

Vive aparte del backend NestJS porque el resto del stack es Node/TypeScript y estas
librerías de análisis de datos son del ecosistema Python; el backend actúa como
puerta de entrada (valida la auditoría y el usuario) y este servicio hace el trabajo
pesado de análisis + generación de archivos.

## Cómo encaja con el resto del proyecto

```
Frontend (Next.js, :3000)
   │  1. POST /auditorias/:id/plan-siguiente-anio/generar   (JWT del login)
   ▼
Backend NestJS (:4000)
   │  2. reenvía el POST a este servicio con el mismo Bearer token
   ▼
Analytics Service (:4100, este directorio)
   │  3. consulta Postgres (misma BD que Prisma) con SQLAlchemy
   │  4. analiza con pandas/numpy, arma el plan con openpyxl/reportlab
   │  5. publica progreso por WS mientras trabaja
   ▲
Frontend ── WebSocket ws://.../ws/jobs/{jobId}?token=...  (conexión directa, en vivo)
```

Solo **lee** las tablas de Prisma (`Activity`, `ActivityOccurrence`, `Auditoria`,
`AuditoriaConfig`); nunca escribe en la base de datos.

## Configuración

```bash
cd analytics-service
python -m venv .venv
.venv\Scripts\activate   # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # y completar DATABASE_URL / JWT_SECRET con los MISMOS valores de backend/.env
```

`JWT_SECRET` debe ser idéntico al de `backend/.env`: este servicio no tiene login
propio, valida los tokens que ya emitió `POST /auth/login` del backend.

## Levantarlo

```bash
uvicorn app.main:app --reload --port 4100
```

Health check: `GET http://localhost:4100/health`.

## Endpoints

| Método | Ruta                          | Descripción                                              |
|--------|-------------------------------|-----------------------------------------------------------|
| POST   | `/jobs`                       | `{auditoriaId, anio}` → `{jobId}`, arranca la generación  |
| GET    | `/jobs/{jobId}/resumen`       | KPIs + plan propuesto en JSON                              |
| GET    | `/jobs/{jobId}/excel`         | Descarga el `.xlsx` generado                                |
| GET    | `/jobs/{jobId}/pdf`           | Descarga el `.pdf` generado                                 |
| WS     | `/ws/jobs/{jobId}?token=...`  | Progreso en vivo: `conectando → analizando → construyendo_plan → generando_excel → generando_pdf → listo` (o `error`) |
| POST   | `/plan-trabajo/parse-excel`   | Sube un `.xlsx` del plan de trabajo (multipart, campo `file`) y devuelve `{formato, filas, errores}` ya validado — el backend (`import-excel.service.ts`) lo usa para el botón "Reemplazar plan desde Excel" y hace el create/update/desactivar en Postgres a partir de esas filas. Ver `app/plan_trabajo_parser.py`. |

Todos los endpoints REST requieren `Authorization: Bearer <token>`; el WebSocket
recibe el mismo token como query param `token` (los navegadores no permiten headers
custom en el handshake de WebSocket).

## Lógica del análisis (`app/analysis.py`, `app/plan_builder.py`)

Por cada actividad activa se calcula, sobre las ocurrencias del año base:
cumplimiento %, % de reprogramación y un `riesgo_score` (pandas/numpy). Con los
umbrales de semáforo configurados en `AuditoriaConfig` (los mismos que usa el
dashboard) se clasifica en prioridad **Alto / Medio / Bajo**, y se arma la
recomendación de frecuencia para el año siguiente (ver el docstring de
`plan_builder.py` para la regla exacta). Es una heurística de negocio razonable,
no una que ya existiera en el proyecto — ajustarla en ese archivo si el criterio
real del equipo de auditoría es distinto.

## Resultados en memoria

Los jobs (Excel/PDF generados + resumen) se guardan en memoria del proceso, no en
disco ni en base de datos, y expiran a la hora (`JOB_TTL_SECONDS`). Si el proceso
se reinicia, hay que volver a generar el plan desde el frontend.
