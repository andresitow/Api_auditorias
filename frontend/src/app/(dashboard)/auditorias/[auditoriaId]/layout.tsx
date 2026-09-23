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
    { href: `${base}/eliminadas`, label: "Actividades eliminadas" },
  ];

  return (
    <div>
      <Link href="/auditorias" className="text-[12px] text-muted hover:text-blue inline-flex items-center gap-1 mb-3">
        ← Todas las auditorías
      </Link>
      <h1 className="text-lg font-semibold mb-1">{auditoria?.nombre ?? "Cargando…"}</h1>
      {auditoria?.descripcion && <p className="text-[12.5px] text-muted mb-4 max-w-[760px]">{auditoria.descripcion}</p>}
      <nav className="auditoria-drawer flex items-center gap-1 mb-5 pb-3 border-b border-border" key={pathname}>
        <input type="checkbox" id="auditoria-drawer-toggle" className="label-check" />
        <label htmlFor="auditoria-drawer-toggle" className="hamburger-label mr-1.5" aria-label="Abrir menú de la auditoría">
          <span className="line line1" />
          <span className="line line2" />
          <span className="line line3" />
        </label>
        <label htmlFor="auditoria-drawer-toggle" className="auditoria-drawer-overlay" aria-hidden="true" />
        <div className="auditoria-drawer-panel">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-muted">Menú</span>
            <label htmlFor="auditoria-drawer-toggle" className="cursor-pointer text-lg leading-none text-muted hover:text-text" aria-label="Cerrar menú">
              ×
            </label>
          </div>
          {tabs.map((tab) => {
            const active = tab.href === base ? pathname === base : pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-md px-3 py-2.5 text-[13px] transition-colors ${
                  active ? "bg-bg3 font-medium text-blue" : "text-muted hover:bg-bg3 hover:text-text"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}
