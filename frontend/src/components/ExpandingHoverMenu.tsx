"use client";

/**
 * ExpandingHoverMenu — "isla" de navegación flotante cuyos ítems son solo un
 * ícono en reposo y se expanden en hover/focus para revelar su etiqueta.
 *
 * Notas de accesibilidad:
 * - Cada ítem es un <Link> (si trae `href`) o un <button> real, así que es
 *   100% operable con teclado (Tab / Enter / Space) sin JS adicional.
 * - La expansión también ocurre en `:focus-visible` (no solo `:hover`), para
 *   que un usuario de teclado vea la etiqueta antes de activar el ítem.
 * - El contenedor es un <nav aria-label>, y el ítem activo se marca con
 *   `aria-current="page"` además de un resaltado visual.
 * - Las transiciones respetan `prefers-reduced-motion` (`motion-reduce:*`).
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { FolderKanban, LayoutDashboard, LogOut, MessageSquare, Settings } from "lucide-react";

export interface MenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
}

export interface ExpandingHoverMenuProps {
  items?: MenuItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  /** Clases del contenedor (fondo, borde, texto). Reemplaza el look por defecto en vez de sumarse a él. */
  className?: string;
}

const ICON_SIZE = 18;

/** Set de items de ejemplo para la demo standalone (Dashboard/Projects/Messages/Settings/Log out). */
export const DEFAULT_MENU_ITEMS: MenuItem[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={ICON_SIZE} aria-hidden /> },
  { id: "projects", label: "Projects", icon: <FolderKanban size={ICON_SIZE} aria-hidden /> },
  { id: "messages", label: "Messages", icon: <MessageSquare size={ICON_SIZE} aria-hidden /> },
  { id: "settings", label: "Settings", icon: <Settings size={ICON_SIZE} aria-hidden /> },
  { id: "logout", label: "Log out", icon: <LogOut size={ICON_SIZE} aria-hidden /> },
];

/** Look por defecto de la isla: fondo oscuro semi-transparente con blur, para la demo standalone. */
const DEFAULT_CONTAINER_CLASSES = "border border-white/10 bg-[#0b0d18]/80 text-white/90 shadow-lg backdrop-blur-md";

export function ExpandingHoverMenu({
  items = DEFAULT_MENU_ITEMS,
  activeId,
  onSelect,
  className = DEFAULT_CONTAINER_CLASSES,
}: ExpandingHoverMenuProps) {
  return (
    <nav aria-label="Navegación principal" className={`inline-flex items-center gap-1 rounded-full p-1.5 ${className}`}>
      {items.map((item) => (
        <MenuButton key={item.id} item={item} active={item.id === activeId} onSelect={onSelect} />
      ))}
    </nav>
  );
}

function MenuButton({ item, active, onSelect }: { item: MenuItem; active: boolean; onSelect?: (id: string) => void }) {
  const handleClick = () => {
    item.onClick?.();
    onSelect?.(item.id);
  };

  // `group` habilita que el <span> de la etiqueta reaccione al :hover/:focus-visible de ESTE botón
  // (cada ítem es su propio scope de "group": no se cruzan entre sí).
  //
  // El "ancho" que parece animarse en el botón no es más que consecuencia de que su padre es un
  // flex item: como CSS no puede transicionar hacia `width: auto`, la etiqueta interna transiciona
  // su propio `max-width` (0 -> 150px) y el botón simplemente se re-mide cada frame para envolver
  // su contenido — el mismo resultado visual ("el pill se expande"), logrado de forma animable.
  // Aun así declaramos `width` en la lista de `transition` del botón (spec original), por si algún
  // consumidor le fija un `width` explícito vía className.
  const containerTransition =
    "[transition:width_0.4s_cubic-bezier(0.22,1,0.36,1),background-color_0.3s_ease,box-shadow_0.3s_ease,color_0.3s_ease]";

  // `bg-current` toma el color de TEXTO del propio botón como color de fondo del overlay de hover.
  // Así, si el contenedor padre es oscuro con texto claro, el overlay se ve blanco translúcido
  // (calca el rgba(255,255,255,0.12) del spec); si el padre invierte a fondo claro/texto oscuro
  // (p. ej. al cambiar a tema oscuro en esta app, ver `--island-bg`), el overlay se adapta solo,
  // sin necesitar props extra ni lógica de tema dentro de este componente genérico.
  const sharedClassName = [
    "group relative flex h-11 shrink-0 items-center overflow-hidden rounded-full px-[11px] outline-none",
    containerTransition,
    "hover:bg-current/[0.12] hover:shadow-[0_4px_14px_rgba(0,0,0,0.25)]",
    "focus-visible:bg-current/[0.12] focus-visible:shadow-[0_4px_14px_rgba(0,0,0,0.25)] focus-visible:ring-2 focus-visible:ring-current/40",
    "motion-reduce:transition-none",
    active ? "bg-current/[0.1]" : "",
  ].join(" ");

  const content = (
    <>
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">{item.icon}</span>
      {/* Etiqueta: oculta por defecto (max-width 0 + opacity 0 + desplazada), revelada en hover/focus. */}
      <span
        className={[
          "max-w-0 -translate-x-2 overflow-hidden whitespace-nowrap text-[13.5px] font-medium opacity-0",
          "[transition:opacity_0.25s_ease,max-width_0.45s_ease,transform_0.35s_ease,margin-left_0.45s_ease]",
          "group-hover:ml-2 group-hover:max-w-[150px] group-hover:translate-x-0 group-hover:opacity-100",
          "group-focus-visible:ml-2 group-focus-visible:max-w-[150px] group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
          "motion-reduce:transition-none",
        ].join(" ")}
      >
        {item.label}
      </span>
      {/* Punto indicador del ítem activo (no participa en la animación de hover). */}
      {active && <span aria-hidden className="absolute -bottom-0.5 left-[18px] h-[3px] w-[3px] rounded-full bg-current" />}
    </>
  );

  if (item.href) {
    return (
      <Link href={item.href} onClick={handleClick} aria-current={active ? "page" : undefined} className={sharedClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={handleClick} aria-current={active ? "page" : undefined} className={sharedClassName}>
      {content}
    </button>
  );
}
