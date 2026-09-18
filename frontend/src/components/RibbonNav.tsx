"use client";

import { usePathname } from "next/navigation";
import { Activity, ClipboardCheck, FileText } from "lucide-react";
import { NAV_ITEMS } from "@/lib/navigation";
import { ExpandingHoverMenu, type MenuItem } from "./ExpandingHoverMenu";

const ICON_SIZE = 18;

/** Ícono por ruta: se resuelve acá (no en lib/navigation.ts) para mantener esa lista libre de JSX/React. */
const ICONS: Record<string, MenuItem["icon"]> = {
  "/monitoreo": <Activity size={ICON_SIZE} aria-hidden />,
  "/auditorias": <ClipboardCheck size={ICON_SIZE} aria-hidden />,
  "/formularios": <FileText size={ICON_SIZE} aria-hidden />,
};

/** La "isla" de navegación superior: wrapper del ExpandingHoverMenu con los módulos reales de la app. */
export function RibbonNav() {
  const pathname = usePathname();
  const active = NAV_ITEMS.find((item) => pathname?.startsWith(item.href));

  const items: MenuItem[] = NAV_ITEMS.map((item) => ({
    id: item.href,
    label: item.label,
    href: item.href,
    icon: ICONS[item.href],
  }));

  return (
    <div className="animate-shell-rise fixed left-1/2 top-3 z-30 -translate-x-1/2">
      <ExpandingHoverMenu items={items} activeId={active?.href} className="bg-island text-island-ink shadow-lg" />
    </div>
  );
}
