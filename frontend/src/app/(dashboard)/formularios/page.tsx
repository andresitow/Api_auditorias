"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listDiagnosticos } from "@/services/forms.service";
import type { DiagnosticoResumen } from "@/types/formularios";

const FORM_TYPES = [
  {
    href: "/formularios/diagnostico",
    title: "Diagnóstico y Configuración de Clientes",
    description: "Levantamiento de infraestructura, ancho de banda, firewall y antivirus para un cliente.",
  },
];

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function FormulariosPage() {
  const [recientes, setRecientes] = useState<DiagnosticoResumen[]>([]);

  useEffect(() => {
    listDiagnosticos()
      .then(setRecientes)
      .catch(() => undefined);
  }, []);

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5 mb-6">
        {FORM_TYPES.map((f) => (
          <Link key={f.href} href={f.href} className="bg-bg2 border border-border rounded-xl p-5 hover:border-blue transition-colors">
            <div className="text-[15px] font-semibold mb-1.5">{f.title}</div>
            <div className="text-[12.5px] text-muted leading-snug">{f.description}</div>
          </Link>
        ))}
      </div>

      <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2.5">Diagnósticos recientes</div>
      <div className="bg-bg2 border border-border rounded-lg overflow-hidden">
        {recientes.length === 0 ? (
          <div className="text-center py-9 text-muted text-[13px]">Aún no se han generado diagnósticos.</div>
        ) : (
          recientes.map((d) => (
            <Link
              key={d.id}
              href={`/formularios/diagnosticos/${d.id}`}
              className="flex items-center justify-between px-4 py-3 border-b border-border last:border-none hover:bg-bg3 transition-colors"
            >
              <div>
                <div className="text-sm font-medium">{d.cliente}</div>
                <div className="text-[11.5px] text-muted">
                  Nit {d.nit} · {d.sesionTipo}
                </div>
              </div>
              <div className="text-[11.5px] text-muted font-mono">{formatFecha(d.createdAt)}</div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
