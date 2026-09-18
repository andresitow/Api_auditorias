-- AlterTable
ALTER TABLE "ActivityOccurrence" ADD COLUMN     "notificadoDias" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "AuditoriaConfig" ADD COLUMN     "notifEmails" TEXT,
ADD COLUMN     "notificacionesActivas" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "teamsWebhookUrl" TEXT;
