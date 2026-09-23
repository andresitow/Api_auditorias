"use client";

import { useState } from "react";
import { exportExcel, exportPdf } from "@/services/auditorias.service";
import { FormatDropdown } from "@/components/ui/FormatDropdown";
import type { Formato } from "@/components/ui/FormatDropdown";

/** Dropdown "Plan de trabajo año actual": descarga el plan de trabajo del año
 * seleccionado en Excel o PDF (respeta los filtros de categoría/estado si vienen). */
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
  const [loading, setLoading] = useState(false);

  const handle = async (kind: Formato) => {
    setLoading(true);
    try {
      if (kind === "excel") await exportExcel(auditoriaId, anio, categoria, estado);
      else await exportPdf(auditoriaId, anio, categoria);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormatDropdown
      onSelect={handle}
      disabled={loading}
      itemLabels={{
        excel: `Descargar plan de trabajo ${anio} en Excel (.xlsx)`,
        pdf: `Descargar plan de trabajo ${anio} en PDF (.pdf)`,
      }}
    >
      {loading ? "Generando…" : "Plan de trabajo año actual"}
    </FormatDropdown>
  );
}
