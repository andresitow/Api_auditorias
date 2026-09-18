-- CreateTable
CREATE TABLE "DiagnosticForm" (
    "id" TEXT NOT NULL,
    "sesionTipo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "urlProduccion" TEXT NOT NULL,
    "urlPruebas" TEXT,
    "urlPortalIt" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "sistemaOperativo" TEXT NOT NULL,
    "navegadores" TEXT[],
    "navegadorOtro" TEXT,
    "isp" TEXT NOT NULL,
    "megas" INTEGER NOT NULL,
    "oficinas" JSONB NOT NULL,
    "firewallTiene" BOOLEAN NOT NULL,
    "firewallNombre" TEXT,
    "antivirusNombre" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormOption" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "FormOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiagnosticForm_createdAt_idx" ON "DiagnosticForm"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "FormOption_category_value_key" ON "FormOption"("category", "value");
