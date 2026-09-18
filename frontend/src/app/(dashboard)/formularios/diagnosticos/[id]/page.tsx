"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getDiagnostico } from "@/services/forms.service";
import { DiagnosticoReport } from "@/components/formularios/DiagnosticoReport";
import type { DiagnosticoResumen } from "@/types/formularios";

export default function DiagnosticoDetallePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<DiagnosticoResumen | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getDiagnostico(params.id)
      .then(setData)
      .catch(() => setError(true));
  }, [params.id]);

  if (error) {
    return <div className="text-center py-12 text-muted text-[13px]">No se encontró el diagnóstico.</div>;
  }
  if (!data) {
    return <div className="text-center py-12 text-muted text-[13px]">Cargando…</div>;
  }
  return <DiagnosticoReport data={data} />;
}
