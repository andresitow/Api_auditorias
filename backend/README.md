# Backend – Infraestructura API

API REST construida con [NestJS](https://nestjs.com/) + [Prisma](https://www.prisma.io/) (PostgreSQL) para tres dominios de negocio:

- **Monitoreo de red**: canales de ping, muestras de latencia y alertas.
- **Auditorías**: actividades programadas, ocurrencias, historial y reportes (Excel/PDF).
- **Formularios de diagnóstico**: fichas de diagnóstico de clientes y catálogos de opciones.

Expone documentación interactiva vía Swagger en `/docs`.

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | NestJS 11 (Express) |
| ORM / DB | Prisma 6 + PostgreSQL |
| Auth | JWT (`@nestjs/jwt`, `passport-jwt`), bcrypt |
| Validación | `class-validator` / `class-transformer` |
| Seguridad | `helmet`, `@nestjs/throttler` (rate limiting) |
| Tareas programadas | `@nestjs/schedule` |
| Reportes | `exceljs` (Excel), `pdfkit` (PDF) |
| Notificaciones | Webhook de Microsoft Teams (`fetch`) + correo SMTP (`nodemailer`) |
| Docs API | `@nestjs/swagger` |
| Testing | Jest + Supertest |
| Compilador en dev | SWC (`nest-cli.json` → `builder: "swc"`, sin type-check en watch mode; el chequeo de tipos completo se corre aparte con `tsc --noEmit`) |

## Estructura del proyecto

```
src/
├── main.ts                 # Bootstrap: helmet, CORS, ValidationPipe, filtros, Swagger
├── app.module.ts            # Módulo raíz, wiring de todos los módulos
├── config/                  # Configuración tipada + validación de variables de entorno
├── filters/                 # HttpExceptionFilter global
├── interceptors/            # LoggingInterceptor global
├── guards/                  # JwtAuthGuard
├── prisma/                  # PrismaService / PrismaModule (cliente de Prisma)
├── auth/                    # Login JWT (usuario único admin)
├── users/                   # Gestión de usuarios
└── modules/
    ├── monitoring/          # Canales de red, ping scheduler, retención de muestras
    ├── forms/                # Formularios de diagnóstico y catálogo de opciones
    └── auditorias/           # Auditorías, actividades, ocurrencias, dashboard, exportación
prisma/
├── schema.prisma            # Modelos de datos
├── migrations/               # Historial de migraciones
├── seed.ts                   # Seed de usuario admin
└── seed-auditorias.ts        # Seed de datos de auditorías
```

## Módulos y endpoints principales

| Módulo | Prefijo de ruta | Responsabilidad |
|---|---|---|
| `AuthModule` | `POST /auth/login` | Autenticación JWT, throttling de intentos de login |
| `UsersModule` | `/users` | CRUD de usuarios |
| `MonitoringModule` | `/channels` | CRUD de canales, ping periódico (`PingSchedulerService`), retención de muestras (`SampleRetentionService`) |
| `FormsModule` | `/forms` | Formularios de diagnóstico y opciones de catálogo |
| `AuditoriasModule` | `/auditorias`, `/auditoria-config` | Catálogo de auditorías, actividades (`/auditorias/:id/activities`), ocurrencias (`/auditorias/:id/occurrences`), dashboard (`/auditorias/:id/dashboard`), exportación Excel/PDF (`/auditorias/:id/export`), configuración global y notificaciones (`/auditoria-config`, `POST /auditoria-config/test-notification`) |

Todas las rutas están protegidas globalmente por `ThrottlerGuard` (30 req/min por defecto) y usan `JwtAuthGuard` donde corresponde.

## Modelo de datos (Prisma)

- **User** – usuario administrador único (login por username/password).
- **Monitoreo**: `Channel` → `PingSample` / `AlertEvent`; `MonitorConfig` (umbrales globales).
- **Formularios**: `DiagnosticForm`, `FormOption`.
- **Auditorías**: `Auditoria` → `Activity` → `ActivityOccurrence` (con `notificadoDias`, para no reenviar el mismo aviso) → `ActivityHistory` (trazabilidad de cambios); `AuditoriaConfig` (alertas, semáforo de cumplimiento y canales de notificación — ver más abajo).

Enums: `EstadoActividad` (PLANEADO, EJECUTADO, REPROGRAMADO, NO_REALIZADO) y `Frecuencia` (UNICA, DIARIO, MENSUAL, BIMENSUAL, TRIMESTRAL, SEMESTRAL, ANUAL, A_DEMANDA, CUANDO_SE_REQUIERA).

## Notificaciones automáticas (Teams / correo)

`NotificationsService` corre un cron diario (`0 8 * * *`) que revisa las ocurrencias `PLANEADO`: cuando los días
restantes hasta `fechaProgramada` coinciden con `AuditoriaConfig.diasAntes` (por defecto `[1, 3, 7]`, es decir
también avisa una semana antes) o cuando la ocurrencia ya está vencida, se envía un aviso agrupado por auditoría.
Cada umbral se notifica **una sola vez** por ocurrencia (se registra en `ActivityOccurrence.notificadoDias`), para
no reenviar el mismo aviso todos los días.

Canales, configurables en `AuditoriaConfig` (editable desde la pestaña **Notificaciones** de cada auditoría en el
frontend, o vía `PATCH /auditoria-config`):

| Campo | Descripción |
|---|---|
| `notificacionesActivas` | Apaga/enciende el envío sin perder la configuración |
| `teamsWebhookUrl` | URL del *Incoming Webhook* del canal de Teams (se envía un `POST` con `{ "text": "..." }`) |
| `notifEmails` | Destinatarios de correo, separados por coma (requiere SMTP configurado — ver variables de entorno) |

`POST /auditoria-config/test-notification` envía un mensaje de prueba a los canales configurados sin tocar el
estado de ninguna ocurrencia; devuelve `{ teams?: "ok" | "error", email?: "ok" | "error" }` (clave ausente = canal
no configurado).

## Variables de entorno

Definidas y validadas en `src/config/configuration.ts` (`.env`):

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión PostgreSQL |
| `JWT_SECRET` | Sí | Secreto para firmar tokens JWT |
| `JWT_EXPIRES_IN` | No (default `8h`) | Expiración del token |
| `PORT` | No (default `4000`) | Puerto HTTP |
| `CORS_ORIGIN` | No (default `http://localhost:3000`) | Origen permitido por CORS |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | No | Credenciales usadas por `prisma/seed.ts` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | No | Servidor SMTP para el canal de correo de notificaciones (ej. `smtp.office365.com`, puerto `587`). Sin estas variables, ese canal queda inactivo aunque se configuren destinatarios. |
| `SMTP_FROM` | No (default `SMTP_USER`) | Remitente que se muestra en los correos de notificación |

## Puesta en marcha

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar .env (ver tabla anterior)

# 3. Levantar PostgreSQL (docker-compose.yml en la raíz del repo, con límites de recursos
#    y flags livianos para desarrollo — ver docker-compose.yml)
docker compose -f ../docker-compose.yml up -d

# 4. Aplicar migraciones y generar cliente Prisma
npx prisma migrate deploy
npx prisma generate

# 5. Sembrar el usuario admin
npx prisma db seed

# 6. (Opcional) sembrar el plan de trabajo anual completo (auditoría, actividades y
#    ocurrencias transcritas del documento origen)
npx ts-node prisma/seed-auditorias.ts

# 7. Levantar en modo desarrollo (SWC, sin type-check — build ~0.3-0.5s)
npm run start:dev
```

La API queda disponible en `http://localhost:4000` y la documentación Swagger en `http://localhost:4000/docs`.

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run start:dev` | Desarrollo con watch mode |
| `npm run start:prod` | Ejecuta el build (`dist/main`) |
| `npm run build` | Compila con `nest build` |
| `npm run lint` | ESLint con autofix |
| `npm run format` | Prettier sobre `src` y `test` |
| `npm run test` | Tests unitarios (Jest) |
| `npm run test:e2e` | Tests end-to-end |
| `npm run test:cov` | Cobertura de tests |

## Licencia

`UNLICENSED` (proyecto privado).
