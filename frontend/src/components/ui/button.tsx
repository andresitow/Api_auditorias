"use client";

import { cloneElement, forwardRef, isValidElement } from "react";
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Botón único para todo el proyecto, con el diseño "Frutiger Aero" provisto por el
 * usuario (Uiverse.io): borde degradado azul rey, relleno con brillo animado y reflejo
 * superior (`.frutiger-*`, ver globals.css). No usa shadcn/ui real
 * (sin Radix ni class-variance-authority, por decisión explícita de no sumar
 * dependencias): `asChild` se resuelve clonando el único hijo con `cloneElement`.
 *
 * Los `variant` ya NO distinguen color — todos los "sólidos" (default/destructive/
 * warning/info/outline/secondary) se ven exactamente igual; se conservan como nombres
 * solo para no tener que retocar los ~55 lugares del proyecto que ya los usaban. Hay
 * dos excepciones deliberadas, no decorativas sino funcionales:
 *   - `ghost` y los `link*` quedan como texto teal sin relleno (Cancelar, cerrar ×,
 *     acciones en línea dentro de tablas): aplicar el diseño de píldora de 200px+ a los
 *     5 botones de acción de cada fila de una tabla, o a un simple "Cancelar" al lado
 *     de "Guardar", rompía el layout y quitaba toda jerarquía primario/secundario.
 *   - `link`/`linkDestructive`/`linkWarning`/`linkMuted` además ignoran `size`: son
 *     texto suelto en una celda de tabla, no un botón con caja.
 * Si se prefiere el diseño sólido también ahí, avisar y se ajusta. */

export type ButtonVariant =
  | "default"
  | "destructive"
  | "warning"
  | "info"
  | "outline"
  | "secondary"
  | "ghost"
  | "link"
  | "linkDestructive"
  | "linkWarning"
  | "linkMuted";

export type ButtonSize = "default" | "sm" | "lg" | "icon" | "iconSm";

const BASE =
  "cursor-pointer transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[#3a63e8]/60 disabled:pointer-events-none disabled:opacity-60";

// Diseño sólido: toda la caja (borde degradado, padding, sombra) sale de las clases
// `.frutiger-button` / `.fb-*` de globals.css; el contenido se envuelve en Frutiger().
const SOLID = "frutiger-button";
// Variante liviana (sin relleno) para lo que no puede ser un botón con caja: texto
// en teal, subrayado al pasar el mouse.
const TEAL_TEXT = "royal-link inline-flex items-center whitespace-nowrap text-[#2f9484] hover:underline";

const VARIANTS: Record<ButtonVariant, string> = {
  default: SOLID,
  destructive: SOLID,
  warning: SOLID,
  info: SOLID,
  outline: SOLID,
  secondary: SOLID,
  ghost: TEAL_TEXT,
  link: TEAL_TEXT,
  linkDestructive: TEAL_TEXT,
  linkWarning: TEAL_TEXT,
  linkMuted: TEAL_TEXT,
};

const SOLID_VARIANTS = new Set<ButtonVariant>(["default", "destructive", "warning", "info", "outline", "secondary"]);
// Estos cuatro son texto suelto dentro de una tabla (Estado/Reprogramar/Eliminar/...):
// ignoran `size` a propósito, ver docstring de arriba.
const INLINE_VARIANTS = new Set<ButtonVariant>(["link", "linkDestructive", "linkWarning", "linkMuted"]);

// Tamaños del botón sólido: modificadores de `.frutiger-button` (cambian --fb-pad y el
// font-size). "Cancelar" (ghost) usa una caja compacta propia, sin relleno.
const PILL_SIZES: Record<"default" | "sm" | "lg", string> = {
  default: "",
  sm: "fb-sm",
  lg: "fb-lg",
};
const COMPACT_SIZES: Record<"default" | "sm" | "lg", string> = {
  default: "gap-1.5 rounded px-3 py-2 text-[13px]",
  sm: "gap-1.5 rounded px-2.5 py-1.5 text-[12px]",
  lg: "gap-1.5 rounded px-3.5 py-2.5 text-[13px]",
};
const ICON_SIZES: Record<"icon" | "iconSm", string> = {
  icon: "h-8 w-8 justify-center rounded-full p-0 text-lg leading-none",
  iconSm: "h-5 w-5 justify-center rounded-full p-0 text-sm leading-none",
};

function sizeClasses(variant: ButtonVariant, size: ButtonSize): string {
  if (size === "icon" || size === "iconSm") return SOLID_VARIANTS.has(variant) ? "fb-icon" : ICON_SIZES[size];
  return (SOLID_VARIANTS.has(variant) ? PILL_SIZES : COMPACT_SIZES)[size];
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renderiza el único hijo (p.ej. `<Link>`) con las clases del botón en vez de
   * envolverlo en un `<button>` — evita anidar `<a>` dentro de `<button>`. */
  asChild?: boolean;
  children?: ReactNode;
}

/** Estructura interna del diseño Frutiger: relleno + brillo, reflejo superior y texto. */
function Frutiger({ children }: { children?: ReactNode }) {
  return (
    <span className="frutiger-inner">
      <span className="frutiger-top-white" aria-hidden="true" />
      <span className="frutiger-text">{children}</span>
    </span>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    const classes = cn(BASE, VARIANTS[variant], INLINE_VARIANTS.has(variant) ? undefined : sizeClasses(variant, size), className);
    const solid = SOLID_VARIANTS.has(variant);

    if (asChild) {
      if (!isValidElement(children)) {
        throw new Error("Button: asChild requiere exactamente un elemento hijo (p.ej. <Link>).");
      }
      const child = children as ReactElement<{ className?: string; children?: ReactNode }>;
      // En el diseño sólido se envuelve el contenido del hijo (el texto del <Link>) con
      // la estructura Frutiger; el hijo en sí conserva su etiqueta y sus props.
      return cloneElement(
        child,
        { ...props, className: cn(classes, child.props.className) },
        solid ? <Frutiger>{child.props.children}</Frutiger> : child.props.children,
      );
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {solid ? <Frutiger>{children}</Frutiger> : children}
      </button>
    );
  },
);
Button.displayName = "Button";
