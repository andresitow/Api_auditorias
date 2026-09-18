"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { logout } from "@/services/auth.service";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getActiveModule } from "@/lib/navigation";

export function DashboardHeader() {
  const pathname = usePathname();
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => {
    const tick = () => setClock(new Date().toTimeString().slice(0, 8));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const activeModule = getActiveModule(pathname);

  return (
    <header className="animate-shell-drop sticky top-[64px] z-10 mx-4 flex flex-wrap items-center gap-3.5 rounded-2xl border border-border bg-bg2 px-5 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-base font-semibold tracking-[-0.01em]">
        <span className="h-2.5 w-2.5 rounded-full bg-green pulse-dot" />
        {activeModule?.label ?? "Panel"}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="font-mono text-xs text-muted">{clock}</span>
        <ThemeToggle />
        <button
          onClick={logout}
          className="h-[34px] rounded-full border border-border bg-bg3 px-3.5 text-[13px] font-medium tracking-[-0.008em] text-text transition-colors hover:border-red hover:text-red"
        >
          ⎋ Salir
        </button>
      </div>
    </header>
  );
}
