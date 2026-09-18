"use client";

import { useState } from "react";
import { exportExcel, exportPdf } from "@/services/auditorias.service";

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
      <button
        onClick={() => handle("excel")}
        disabled={loading !== null}
        className="h-9 px-3.5 rounded-md border border-border bg-bg3 text-text text-[13px] hover:border-green hover:text-green disabled:opacity-60"
      >
        {loading === "excel" ? "Generando…" : "Excel"}
      </button>
      <button
        onClick={() => handle("pdf")}
        disabled={loading !== null}
        className="h-9 px-3.5 rounded-md border border-border bg-bg3 text-text text-[13px] hover:border-red hover:text-red disabled:opacity-60"
      >
        {loading === "pdf" ? "Generando…" : "PDF"}
      </button>
    </div>
  );
}
