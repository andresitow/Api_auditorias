/*
  Warnings:

  - Added the required column `auditoriaId` to the `Activity` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "auditoriaId" TEXT;

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Auditoria_activa_idx" ON "Auditoria"("activa");

-- CreateIndex
CREATE INDEX "Activity_auditoriaId_idx" ON "Activity"("auditoriaId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_auditoriaId_fkey" FOREIGN KEY ("auditoriaId") REFERENCES "Auditoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
