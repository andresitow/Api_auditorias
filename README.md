# API Auditorías

Sistema con backend en NestJS + Prisma (PostgreSQL) y frontend en Next.js, para tres dominios de negocio:

- **Monitoreo de red**: canales de ping, muestras de latencia, alertas y un panel en vivo (streaming por SSE, `GET /channels/events`).
- **Auditorías**: actividades programadas, ocurrencias, historial de cambios, dashboard de cumplimiento, exportación a Excel/PDF, generación del **plan de acción del año siguiente** (análisis con pandas/numpy + Excel/PDF vía `analytics-service`) y notificaciones automáticas (Microsoft Teams / correo) antes de cada vencimiento.
- **Formularios de diagnóstico**: fichas de diagnóstico de clientes y catálogos de opciones configurables.

La API expone documentación interactiva en Swagger (`/docs`). El detalle técnico del backend (módulos, endpoints, modelo de datos, notificaciones) está en [`backend/README.md`](./backend/README.md). El microservicio Python que genera el plan de acción del año siguiente (pandas/numpy/openpyxl + WebSocket de progreso) está documentado en [`analytics-service/README.md`](./analytics-service/README.md).

## Requisitos previos

- **Node.js 20+** y **npm** (verificar con `node -v` y `npm -v`).
- **Docker Desktop** (para la base de datos PostgreSQL vía `docker-compose.yml`).
- Windows: si el proyecto vive dentro de una carpeta sincronizada por OneDrive, ver la nota en [Solución de problemas](#solución-de-problemas) antes de instalar dependencias.

## 1. Levantar la base de datos

Desde la raíz del proyecto:

```bash
docker compose up -d
```

Esto levanta PostgreSQL en el puerto `5432` (contenedor `auditorias-postgres`, base `infraestructura`, usuario/clave `postgres`/`postgres`). Verificar que quedó sano:

```bash
docker ps --filter "name=auditorias-postgres"
```

## 2. Backend (API — puerto 4000)

```bash
cd backend
npm install
```

Crear (o revisar) el archivo `backend/.env` con estas variables:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/infraestructura
JWT_SECRET=<un secreto cualquiera para desarrollo>
JWT_EXPIRES_IN=1d
PORT=4000
CORS_ORIGIN=http://localhost:3000
SEED_ADMIN_USERNAME=<usuario admin inicial>
SEED_ADMIN_PASSWORD=<contraseña admin inicial>

# Opcionales — solo si se quiere probar el canal de correo de las notificaciones
# automáticas de auditorías (ver backend/README.md#notificaciones-automáticas-teams--correo)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

Aplicar las migraciones de Prisma y generar el cliente:

```bash
npx prisma migrate deploy
npx prisma generate
```

Crear el usuario administrador inicial (usa `SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD` del `.env`):

```bash
npx prisma db seed
```

(Opcional) sembrar el plan de trabajo anual de ejemplo (auditoría, actividades y ocurrencias):

```bash
npx ts-node prisma/seed-auditorias.ts
```

Levantar el servidor en modo desarrollo (con recarga automática):

```bash
npm run start:dev
```

La API queda disponible en `http://localhost:4000` y la documentación Swagger en `http://localhost:4000/docs`.

## 3. Frontend (puerto 3000)

En otra terminal:

```bash
cd frontend
npm install
```

Verificar que `frontend/.env.local` apunte al backend:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Levantar el servidor de desarrollo:

```bash
npm run dev
```

## 4. Analytics service (plan de acción — puerto 4100, opcional)

Solo necesario para el botón "Generar plan de acción {año siguiente}" del dashboard de auditorías. En otra terminal:

```bash
cd analytics-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # completar con los MISMOS DATABASE_URL / JWT_SECRET de backend/.env
uvicorn app.main:app --reload --port 4100
```

Detalle completo en [`analytics-service/README.md`](./analytics-service/README.md).

## 5. Abrir en el navegador

Ir a **http://localhost:3000** e iniciar sesión con el usuario/contraseña definidos en `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`.

> `start-app.ps1` levanta los tres servicios (Postgres, backend, frontend y, si hay Python en el PATH, analytics-service) en un solo paso — ver `.\start-app.ps1 -SkipAnalytics` si no lo necesitás.

## Solución de problemas

### El dev server del frontend se cae con `EPIPE` / errores de workers

Si el proyecto está dentro de una carpeta sincronizada por OneDrive (u otro servicio de sincronización en la nube), su motor de sincronización puede interceptar la escritura/lectura intensiva de archivos que hace el dev server (HMR, cache de build) y tumbar el proceso.

Ya están aplicadas dos mitigaciones en este repo (ver `CHANGELOG.md`, entrada del 2026-08-25):
- `frontend/package.json` usa `next dev --webpack` (Webpack en vez de Turbopack, más estable en este escenario).
- `frontend/node_modules` y `frontend/.next` se movieron fuera del árbol sincronizado (`C:\dev-cache\api_auditorias\frontend\`) con *junctions* NTFS transparentes.

Si el problema reaparece tras un `npm install` limpio, revisar que los *junctions* sigan existiendo:

```powershell
Get-Item frontend\node_modules, frontend\.next | Select-Object Name, LinkType, Target
```

Si no son `Junction`, recrearlos apuntando a una carpeta fuera de OneDrive, o mover el proyecto completo fuera de OneDrive.

### El backend no conecta a la base de datos

Confirmar que el contenedor `auditorias-postgres` esté `healthy` (`docker ps`) y que `DATABASE_URL` en `backend/.env` coincida con las credenciales del `docker-compose.yml`.
