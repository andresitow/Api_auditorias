"use client";

import { useState } from "react";
import { exportExcel, exportPdf } from "@/services/auditorias.service";
import { Button } from "@/components/ui/button";

export function ExportButtons({
  auditoriaId,
  anio,
  categoria,
  estado,
}: {
  auditoriaId: string;
  anio: number;
  categoria?: string;
  estado?: string;
}) {
  const [loading, setLoading] = useState<"excel" | "pdf" | null>(null);

  const handle = async (kind: "excel" | "pdf") => {
    setLoading(kind);
    try {
      if (kind === "excel") await exportExcel(auditoriaId, anio, categoria, estado);
      else await exportPdf(auditoriaId, anio, categoria);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => handle("excel")} disabled={loading !== null} className="hover:border-green hover:text-green">
        {loading === "excel" ? "Generando…" : "Excel"}
      </Button>
      <Button variant="outline" onClick={() => handle("pdf")} disabled={loading !== null} className="hover:border-red hover:text-red">
        {loading === "pdf" ? "Generando…" : "PDF"}
      </Button>
    </div>
  );
}
