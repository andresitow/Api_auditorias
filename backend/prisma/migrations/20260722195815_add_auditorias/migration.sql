-- CreateEnum
CREATE TYPE "EstadoActividad" AS ENUM ('PLANEADO', 'EJECUTADO', 'REPROGRAMADO', 'NO_REALIZADO');

-- CreateEnum
CREATE TYPE "Frecuencia" AS ENUM ('DIARIO', 'MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'A_DEMANDA', 'CUANDO_SE_REQUIERA');

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcionEvidencia" TEXT,
    "responsable" TEXT NOT NULL,
    "frecuencia" "Frecuencia" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityOccurrence" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "fechaEjecucion" TIMESTAMP(3),
    "estado" "EstadoActividad" NOT NULL DEFAULT 'PLANEADO',
    "observaciones" TEXT,
    "evidenciaUrl" TEXT,
    "evidenciaDescripcion" TEXT,
    "reprogramaciones" INTEGER NOT NULL DEFAULT 0,
    "transcripcionRevisada" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityHistory" (
    "id" TEXT NOT NULL,
    "activityId" TEXT,
    "occurrenceId" TEXT,
    "action" TEXT NOT NULL,
    "campo" TEXT,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT,
    "userId" TEXT,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditoriaConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "diasAntes" INTEGER[] DEFAULT ARRAY[1, 3, 7]::INTEGER[],
    "sonidoActivo" BOOLEAN NOT NULL DEFAULT true,
    "semaforoVerdePct" INTEGER NOT NULL DEFAULT 90,
    "semaforoAmarilloPct" INTEGER NOT NULL DEFAULT 70,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditoriaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_categoria_idx" ON "Activity"("categoria");

-- CreateIndex
CREATE INDEX "ActivityOccurrence_estado_fechaProgramada_idx" ON "ActivityOccurrence"("estado", "fechaProgramada");

-- CreateIndex
CREATE INDEX "ActivityOccurrence_periodo_idx" ON "ActivityOccurrence"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityOccurrence_activityId_periodo_key" ON "ActivityOccurrence"("activityId", "periodo");

-- CreateIndex
CREATE INDEX "ActivityHistory_activityId_createdAt_idx" ON "ActivityHistory"("activityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActivityHistory_occurrenceId_createdAt_idx" ON "ActivityHistory"("occurrenceId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ActivityOccurrence" ADD CONSTRAINT "ActivityOccurrence_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityHistory" ADD CONSTRAINT "ActivityHistory_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityHistory" ADD CONSTRAINT "ActivityHistory_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "ActivityOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
