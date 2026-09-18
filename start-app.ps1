<#
.SYNOPSIS
    Levanta la app completa (Postgres + backend NestJS + frontend Next.js).

.DESCRIPTION
    A diferencia de la versión anterior, este script es re-ejecutable de forma segura:
    antes de aplicar migraciones o de abrir cada servicio, libera el puerto correspondiente
    si quedó ocupado por una corrida anterior (por ejemplo, si cerraste mal las ventanas la
    última vez). Sin esto, `prisma generate` puede fallar con EPERM porque el backend viejo
    sigue con el motor de Prisma cargado, o el backend/frontend nuevos pueden arrancar
    "en silencio" contra un puerto que ya está tomado.

.PARAMETER SkipInstall
    No ejecuta `npm install` aunque falte node_modules.

.PARAMETER SkipMigrate
    No ejecuta `prisma migrate deploy` / `prisma generate`.

.PARAMETER SkipDb
    No toca Docker/Postgres (usar si ya está levantado o se maneja aparte).

.PARAMETER SkipAnalytics
    No levanta analytics-service (el microservicio Python del plan de acción del
    año siguiente). Usar si no tenés Python instalado o no lo necesitás ahora.

.EXAMPLE
    .\start-app.ps1
    .\start-app.ps1 -SkipInstall -SkipMigrate
#>

[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipMigrate,
    [switch]$SkipDb,
    [switch]$SkipAnalytics
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backendPath = Join-Path $root 'backend'
$frontendPath = Join-Path $root 'frontend'
$analyticsPath = Join-Path $root 'analytics-service'

function Write-Step($msg) {
    Write-Host "`n==> $msg" -ForegroundColor Cyan
}

function Assert-LastExitCode($msg) {
    if ($LASTEXITCODE -ne 0) {
        throw "$msg (exit code $LASTEXITCODE)"
    }
}

# Libera un puerto matando (si existe) al proceso que lo tiene escuchando. Necesario para
# poder re-correr el script sin cerrar a mano las ventanas de la corrida anterior: si no se
# libera el puerto del backend antes de `prisma generate`, falla con EPERM (DLL en uso); si
# no se libera antes de abrir la ventana nueva, el proceso nuevo puede arrancar "bien" en los
# logs pero nunca llegar a escuchar porque el puerto ya estaba tomado por el viejo.
function Stop-PortOwner {
    param(
        [Parameter(Mandatory)][int]$Port,
        [Parameter(Mandatory)][string]$Description
    )
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) { return }
    $procIds = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $procIds) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Warning "Puerto $Port ($Description) ocupado por una corrida anterior (PID $procId, $($proc.ProcessName)). Deteniéndolo..."
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Milliseconds 500
}

# Espera hasta que una URL responda (2xx-4xx) o se agote el tiempo. Devuelve $true/$false.
function Wait-ForHttp {
    param(
        [Parameter(Mandatory)][string]$Uri,
        [int]$MaxAttempts = 60,
        [int]$DelaySeconds = 2
    )
    for ($i = 0; $i -lt $MaxAttempts; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 2
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { return $true }
        } catch {
            # todavía no está arriba, seguir esperando
        }
        Start-Sleep -Seconds $DelaySeconds
    }
    return $false
}

# ---------------------------------------------------------------------------
# 1. Base de datos (Docker / Postgres)
# ---------------------------------------------------------------------------
if (-not $SkipDb) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "No se encontró 'docker' en el PATH. Instalá/iniciá Docker Desktop o usá -SkipDb si la base ya está corriendo."
    }

    Write-Step "Levantando PostgreSQL (docker compose)..."
    docker compose -f (Join-Path $root 'docker-compose.yml') up -d
    Assert-LastExitCode "Fallo 'docker compose up'"

    Write-Step "Esperando a que PostgreSQL esté healthy..."
    $maxAttempts = 30
    $attempt = 0
    $status = ''
    do {
        Start-Sleep -Seconds 2
        $status = docker inspect --format='{{.State.Health.Status}}' auditorias-postgres 2>$null
        $attempt++
    } while ($status -ne 'healthy' -and $attempt -lt $maxAttempts)

    if ($status -ne 'healthy') {
        Write-Warning "PostgreSQL no reportó 'healthy' tras $($attempt * 2)s (estado actual: '$status'). Continuo igual, pero revisá 'docker ps'."
    } else {
        Write-Host "PostgreSQL healthy." -ForegroundColor Green
    }
} else {
    Write-Step "Omitiendo arranque de base de datos (-SkipDb)."
}

# ---------------------------------------------------------------------------
# 2. Backend: dependencias + .env + migraciones
# ---------------------------------------------------------------------------
if (-not (Test-Path (Join-Path $backendPath '.env'))) {
    Write-Warning "No existe 'backend\.env'. Creá el archivo con las variables descritas en README.md antes de continuar (DATABASE_URL, JWT_SECRET, SEED_ADMIN_*, etc.)."
}

if (-not $SkipInstall -and -not (Test-Path (Join-Path $backendPath 'node_modules'))) {
    Write-Step "Instalando dependencias del backend..."
    Push-Location $backendPath
    npm install
    Assert-LastExitCode "Fallo 'npm install' en backend"
    Pop-Location
}

if (-not $SkipMigrate) {
    # Si el backend de una corrida anterior sigue vivo, tiene el motor de Prisma cargado en
    # memoria y `prisma generate` falla al intentar reemplazar el .dll/.node en uso.
    Stop-PortOwner -Port 4000 -Description 'backend'

    Write-Step "Aplicando migraciones de Prisma y generando cliente..."
    Push-Location $backendPath
    npx prisma migrate deploy
    Assert-LastExitCode "Fallo 'prisma migrate deploy'"
    npx prisma generate
    Assert-LastExitCode "Fallo 'prisma generate'"
    Pop-Location
}

# ---------------------------------------------------------------------------
# 3. Frontend: dependencias
# ---------------------------------------------------------------------------
if (-not (Test-Path (Join-Path $frontendPath '.env.local'))) {
    Write-Warning "No existe 'frontend\.env.local'. Debe apuntar a NEXT_PUBLIC_API_URL=http://localhost:4000."
}

if (-not $SkipInstall -and -not (Test-Path (Join-Path $frontendPath 'node_modules'))) {
    Write-Step "Instalando dependencias del frontend..."
    Push-Location $frontendPath
    npm install
    Assert-LastExitCode "Fallo 'npm install' en frontend"
    Pop-Location
}

# ---------------------------------------------------------------------------
# 3.5. analytics-service (Python): venv + dependencias del plan de acción
# ---------------------------------------------------------------------------
$analyticsReady = $false
if (-not $SkipAnalytics) {
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pythonCmd) {
        Write-Warning "No se encontró 'python' en el PATH. Omitiendo analytics-service (usar -SkipAnalytics para no ver este aviso, o instalar Python y volver a correr el script)."
    } else {
        if (-not (Test-Path (Join-Path $analyticsPath '.env'))) {
            Write-Warning "No existe 'analytics-service\.env'. Copiá '.env.example' y completá DATABASE_URL/JWT_SECRET con los MISMOS valores de backend\.env."
        }

        $venvPath = Join-Path $analyticsPath '.venv'
        if (-not $SkipInstall -and -not (Test-Path $venvPath)) {
            Write-Step "Creando venv e instalando dependencias de analytics-service..."
            Push-Location $analyticsPath
            python -m venv .venv
            Assert-LastExitCode "Fallo 'python -m venv' en analytics-service"
            & (Join-Path $venvPath 'Scripts\python.exe') -m pip install --quiet -r requirements.txt
            Assert-LastExitCode "Fallo 'pip install' en analytics-service"
            Pop-Location
        }

        $analyticsReady = Test-Path $venvPath
    }
}

# ---------------------------------------------------------------------------
# 4. Arrancar backend, frontend y analytics-service en ventanas separadas
# ---------------------------------------------------------------------------
$shell = if (Get-Command pwsh -ErrorAction SilentlyContinue) { 'pwsh' } else { 'powershell' }

Stop-PortOwner -Port 4000 -Description 'backend'
Write-Step "Iniciando backend (puerto 4000) en una nueva ventana..."
Start-Process $shell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$backendPath'; npm run start:dev"
)

Stop-PortOwner -Port 3000 -Description 'frontend'
Write-Step "Iniciando frontend (puerto 3000) en una nueva ventana..."
Start-Process $shell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$frontendPath'; npm run dev"
)

if ($analyticsReady) {
    Stop-PortOwner -Port 4100 -Description 'analytics-service'
    Write-Step "Iniciando analytics-service (puerto 4100) en una nueva ventana..."
    Start-Process $shell -ArgumentList @(
        '-NoExit', '-Command',
        "Set-Location '$analyticsPath'; .venv\Scripts\python.exe -m uvicorn app.main:app --port 4100"
    )
}

# ---------------------------------------------------------------------------
# 5. Esperar a que backend y frontend respondan, y abrir el navegador
# ---------------------------------------------------------------------------
Write-Step "Esperando a que el backend responda en http://localhost:4000..."
if (Wait-ForHttp -Uri 'http://localhost:4000/docs') {
    Write-Host "Backend listo." -ForegroundColor Green
} else {
    Write-Warning "El backend no respondió a tiempo. Revisá su ventana por errores."
}

Write-Step "Esperando a que el frontend responda en http://localhost:3000..."
$ready = Wait-ForHttp -Uri 'http://localhost:3000'

if ($ready) {
    Start-Process 'http://localhost:3000'
} else {
    Write-Warning "El frontend no respondió a tiempo. Revisá la ventana del frontend por errores. Podés abrir http://localhost:3000 manualmente."
}

Write-Host "`nListo." -ForegroundColor Green
Write-Host "  Backend:           http://localhost:4000  (docs: http://localhost:4000/docs)"
Write-Host "  Frontend:          http://localhost:3000"
if ($analyticsReady) {
    Write-Host "  Analytics service: http://localhost:4100  (docs: http://localhost:4100/docs)"
}
Write-Host "`nPara detener: cerrá las ventanas de PowerShell abiertas y corré 'docker compose down' si querés bajar la base de datos."
Write-Host "Podés volver a correr este script en cualquier momento: libera solo los puertos 4000/3000/4100 antes de reiniciar, no toca nada más."
