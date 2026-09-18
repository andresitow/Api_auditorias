"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getAuditoria } from "@/services/auditorias.service";
import type { Auditoria } from "@/types/auditorias";

export default function AuditoriaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ auditoriaId: string }>();
  const [auditoria, setAuditoria] = useState<Auditoria | null>(null);

  useEffect(() => {
    getAuditoria(params.auditoriaId).then(setAuditoria).catch(() => undefined);
  }, [params.auditoriaId]);

  const base = `/auditorias/${params.auditoriaId}`;
  const tabs = [
    { href: base, label: "Dashboard" },
    { href: `${base}/actividades`, label: "Actividades" },
    { href: `${base}/configuracion`, label: "Notificaciones" },
  ];

  return (
    <div>
      <Link href="/auditorias" className="text-[12px] text-muted hover:text-blue inline-flex items-center gap-1 mb-3">
        ← Todas las auditorías
      </Link>
      <h1 className="text-lg font-semibold mb-1">{auditoria?.nombre ?? "Cargando…"}</h1>
      {auditoria?.descripcion && <p className="text-[12.5px] text-muted mb-4 max-w-[760px]">{auditoria.descripcion}</p>}
      <nav className="flex gap-1 mb-5 border-b border-border">
        {tabs.map((tab) => {
          const active = tab.href === base ? pathname === base : pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2.5 text-[13px] border-b-2 -mb-px transition-colors ${
                active ? "border-blue text-blue" : "border-transparent text-muted hover:text-text"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
