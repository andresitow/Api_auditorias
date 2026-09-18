export const NAV_ITEMS = [
  { href: "/monitoreo", label: "Monitoreo de Red" },
  { href: "/auditorias", label: "Auditorías" },
  { href: "/formularios", label: "Formularios" },
];

export function getActiveModule(pathname: string | null) {
  return NAV_ITEMS.find((item) => pathname?.startsWith(item.href));
}
