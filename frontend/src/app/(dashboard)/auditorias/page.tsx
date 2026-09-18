"use client";

import { useEffect, useState } from "react";
import { listAuditorias } from "@/services/auditorias.service";
import type { Auditoria } from "@/types/auditorias";
import { AuditoriaCard } from "@/components/auditorias/AuditoriaCard";

export default function AuditoriasCatalogPage() {
  const [auditorias, setAuditorias] = useState<Auditoria[] | null>(null);

  useEffect(() => {
    listAuditorias().then(setAuditorias).catch(() => undefined);
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold">Auditorías</h1>
        <p className="text-[12.5px] text-muted">Planes de trabajo y auditorías de infraestructura y ciberseguridad</p>
      </div>

      {auditorias === null ? (
        <div className="text-center py-16 text-muted text-sm">Cargando…</div>
      ) : auditorias.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted bg-bg2 border border-border rounded-xl">
          <div className="text-text font-medium">Todavía no hay auditorías</div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {auditorias.map((a) => (
            <AuditoriaCard key={a.id} auditoria={a} />
          ))}
        </div>
      )}
    </div>
  );
}
