-- CreateTable
CREATE TABLE "DeletedActivity" (
    "id" TEXT NOT NULL,
    "auditoriaId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "responsable" TEXT NOT NULL,
    "frecuencia" "Frecuencia" NOT NULL,
    "periodo" TEXT NOT NULL,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "historial" JSONB NOT NULL,
    "eliminadoPor" TEXT,
    "eliminadoPorUsername" TEXT,
    "eliminadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeletedActivity_auditoriaId_eliminadoEn_idx" ON "DeletedActivity"("auditoriaId", "eliminadoEn" DESC);

-- AddForeignKey
ALTER TABLE "DeletedActivity" ADD CONSTRAINT "DeletedActivity_auditoriaId_fkey" FOREIGN KEY ("auditoriaId") REFERENCES "Auditoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
