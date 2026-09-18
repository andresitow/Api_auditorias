# Changelog

Registro de cambios del proyecto. Se actualiza a medida que se implementan cambios y mejoras.

## 2026-09-08

### Nuevo — Plan de acción del año siguiente (analytics-service, Python)
- Se agregó `analytics-service/`, un microservicio Python (FastAPI) aparte del backend NestJS, que genera una **propuesta de plan de acción para el año siguiente** a partir del desempeño histórico de una auditoría: analiza cumplimiento/reprogramación por actividad y categoría con **pandas/numpy**, clasifica prioridad (Alto/Medio/Bajo) usando los mismos umbrales de semáforo que el dashboard, y arma la propuesta de frecuencia/cronograma para el año siguiente (ver `analytics-service/app/analysis.py` y `plan_builder.py` para la heurística exacta).
- Genera dos archivos organizados en varias hojas/secciones: Excel con **openpyxl** (Resumen Ejecutivo, Análisis por Categoría, Plan de Acción) y PDF con **reportlab + matplotlib** (resumen, gráfico de cumplimiento por categoría, detalle por categoría).
- El progreso de la generación se transmite en vivo por **WebSocket** (`/ws/jobs/{jobId}`): `conectando → analizando → construyendo_plan → generando_excel → generando_pdf → listo`.
- Backend NestJS: nuevo módulo `plan-siguiente-anio` (`backend/src/modules/auditorias/plan-siguiente-anio.{controller,service}.ts`) que valida la auditoría y actúa de proxy autenticado hacia analytics-service (mismo JWT, sin login propio del microservicio).
- Frontend: botón "✨ Generar plan de acción {año siguiente}" en el dashboard de auditoría (`PlanAccionSiguienteAnio.tsx`), con barra de progreso en vivo (`usePlanAccionJob.ts`, WebSocket directo a analytics-service) y descarga de Excel/PDF una vez listo.
- `start-app.ps1` ahora también prepara (venv + `pip install`) y levanta analytics-service si hay `python` en el PATH (`-SkipAnalytics` para omitirlo).
- Probado en vivo end-to-end contra la base de datos real de desarrollo (auditoría "Plan de Trabajo Infraestructura y Ciberseguridad", 66 actividades activas del año base 2026): generación completa, descarga de Excel y PDF vía la UI en el navegador.

## 2026-08-31

### Frontend — Se quitó la opción "Carpeta de correos (opcional)" del formulario de actividades
- Se eliminó del modal de creación/edición de actividad (`frontend/src/components/auditorias/ActivityFormModal.tsx`) el bloque que permitía configurar una carpeta local de origen (vía File System Access API) para luego, en "Actualizar estado" (`OccurrenceStatusModal.tsx`), adjuntar con un clic el correo más reciente de esa carpeta como evidencia.
- Se quitó también el botón "🔍 Adjuntar correo más reciente" y su lógica asociada en `OccurrenceStatusModal.tsx`.
- Se limpiaron de `frontend/src/lib/evidenciaFolder.ts` las funciones que solo servían a esa carpeta de origen (`pickFolderHandle`, `saveFolderForActivity`, `pickFolderForActivity`, `getFolderForActivity`, `removeFolderForActivity`, `ensureReadPermission`, `findMostRecentFile`) y el object store `carpetas` de IndexedDB que las respaldaba.
- No afecta la carpeta destino (adjuntar/copiar el `.eml` al crear la actividad), que sigue funcionando igual.

### Infraestructura — Regresión del dev server del frontend (caída)
- El aplicativo dejó de responder en `http://localhost:3000`. Causa: `frontend/node_modules` había vuelto a ser una carpeta real dentro de OneDrive (perdió la *junction* hacia `C:\dev-cache\api_auditorias\frontend\node_modules` aplicada el 2026-08-25) — probablemente por un `npm install` limpio ejecutado sin recrear la *junction* después. Esto reintroduce exactamente la causa raíz documentada abajo (OneDrive interceptando la E/S intensiva del dev server), y coincide con un evento de Windows Error Reporting (`RADAR_PRE_LEAK_64` sobre `node.exe`) registrado el 2026-08-28.
- Fix: se movió el `node_modules` vigente (instalado hoy) a `C:\dev-cache\api_auditorias\frontend\node_modules` y se recreó la *junction* NTFS en su lugar; `backend/node_modules` ya tenía su *junction* intacta, no requirió cambios. Se reinició el dev server y se verificó que responde 200/307 sin caerse, incluyendo las rutas dinámicas antes problemáticas (`/auditorias/[id]`, `/auditorias/[id]/configuracion`).
- Nota para el futuro: tras cualquier `npm install` limpio en `frontend/`, verificar que `node_modules` siga siendo `<JUNCTION>` (`cmd /c dir /AL frontend`) antes de asumir que el dev server quedará estable — ver [Solución de problemas](README.md#solución-de-problemas).

## 2026-08-25

### Frontend — Tabla de ocurrencias (`frontend/src/components/auditorias/OccurrencesTable.tsx`)
- Se agregó scroll horizontal funcional: la tabla ahora tiene `min-w-[1200px]` dentro del contenedor `overflow-x-auto`, de modo que en pantallas angostas las columnas ya no se comprimen sino que aparece la barra de desplazamiento.
- Se agregó la columna **Observación**, que muestra el campo `observaciones` de cada `ActivityOccurrence` (`—` cuando es `null`).

### Infraestructura — Dev server del frontend
- Se detectó que el servidor de desarrollo (`next dev`) se caía de forma intermitente al navegar a rutas dinámicas (`/auditorias/[id]` y `/auditorias/[id]/configuracion`), con errores `Jest worker encountered 2 child process exceptions` seguidos de una cascada de `EPIPE` que terminaba el proceso.
- Causa: inestabilidad de **Turbopack** (workers hijos) al correr sobre una carpeta sincronizada con OneDrive en Windows.
- Workaround aplicado: se inició el servidor con `next dev --webpack` (Webpack clásico) en lugar de Turbopack. Con este cambio las rutas antes problemáticas responden 200 sin errores.
- El problema volvió a ocurrir: alguien ejecutó `npm run dev` (que usaba Turbopack por defecto) y el servidor se cayó de nuevo, mientras que el proceso que seguía corriendo había sido iniciado manualmente con `--webpack`.
- Fix aplicado: se agregó `--webpack` de forma permanente al script `dev` en `frontend/package.json`, de modo que `npm run dev` use Webpack por defecto y no dependa de que alguien recuerde pasar la flag a mano.
- Causa raíz identificada: `frontend/node_modules` (21.355 archivos) y `frontend/.next` vivían dentro de la carpeta sincronizada por OneDrive, marcados como `ReparsePoint` (OneDrive Files On-Demand). El watcher del dev server (HMR, cache de build) genera escrituras/lecturas a alta frecuencia que OneDrive intercepta, produciendo bloqueos de archivo y las caídas (`EPIPE`, workers muertos) — independientemente de si se usa Webpack o Turbopack.
- Fix estructural aplicado:
  - `frontend/node_modules` y `frontend/.next` se movieron a `C:\dev-cache\api_auditorias\frontend\` (fuera del árbol sincronizado por OneDrive), dejando en su lugar *junctions* NTFS (`mklink /J`) para que las rutas sigan funcionando de forma transparente para npm/Next.js. Ambas carpetas son generadas/descartables (están en `.gitignore`), así que el cambio es completamente reversible.
  - En `frontend/next.config.ts` se agregó `webpack.watchOptions` con `poll: 1000` para el modo dev, como segunda capa de defensa: evita depender de eventos nativos de FS (que OneDrive puede perder o corromper) para el resto de `src/`, que sigue dentro de OneDrive.
- Validado: reinicio limpio (`Ready in 7.4s`) y las rutas dinámicas antes problemáticas (`/auditorias/[id]`, `/auditorias/[id]/configuracion`) compilan y responden 200 sin errores.
- Nota aparte (no corregida, solo detectada): Next.js 16 marca como deprecado el archivo `middleware` en favor de `proxy` (`https://nextjs.org/docs/messages/middleware-to-proxy`). No se tocó porque está fuera del alcance de esta tarea.
