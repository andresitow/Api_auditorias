-- CreateTable
CREATE TABLE "OccurrenceEvidencia" (
    "id" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "nombreOriginal" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OccurrenceEvidencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OccurrenceEvidencia_occurrenceId_idx" ON "OccurrenceEvidencia"("occurrenceId");

-- AddForeignKey
ALTER TABLE "OccurrenceEvidencia" ADD CONSTRAINT "OccurrenceEvidencia_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "ActivityOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: preserve existing single evidencia files as rows in the new table
INSERT INTO "OccurrenceEvidencia" ("id", "occurrenceId", "url", "nombreOriginal", "mimeType", "tamano", "createdBy", "createdAt")
SELECT
    md5(random()::text || clock_timestamp()::text || "id"),
    "id",
    "evidenciaImagenUrl",
    split_part("evidenciaImagenUrl", '/', -1),
    'application/octet-stream',
    0,
    "updatedBy",
    "updatedAt"
FROM "ActivityOccurrence"
WHERE "evidenciaImagenUrl" IS NOT NULL;

-- AlterTable
ALTER TABLE "ActivityOccurrence" DROP COLUMN "evidenciaImagenUrl";
