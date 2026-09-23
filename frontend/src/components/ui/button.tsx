"use client";

import { cloneElement, forwardRef, isValidElement } from "react";
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Botón único para todo el proyecto, con el diseño provisto por el usuario: fondo
 * #40B3A2, texto blanco en mayúsculas, sombra, esquinas redondeadas y un "ripple"
 * animado (`.animation`, ver globals.css) a cada lado del texto. No usa shadcn/ui real
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
  "inline-flex items-center cursor-pointer whitespace-nowrap transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[#40B3A2]/60 disabled:pointer-events-none disabled:opacity-60 hover:opacity-95";

// El diseño provisto: fondo teal sólido, blanco, mayúsculas, sombra suave, recorta el
// ripple que se sale del borde redondeado.
const SOLID =
  "bg-[#40B3A2] text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] font-semibold uppercase tracking-[1.2px] overflow-hidden";
// Variante liviana (sin relleno) para lo que no puede ser una píldora de 200px+: texto
// en el mismo teal, subrayado al pasar el mouse.
const TEAL_TEXT = "text-[#2f9484] hover:underline";

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

// La píldora (min-width 200px+, mucho padding) es del diseño sólido. Aplicarle esa
// misma caja a un "ghost" sin relleno (p.ej. "Cancelar" al lado de "Guardar") deja un
// rectángulo invisible enorme — así que ghost usa una caja compacta propia en
// default/sm/lg, y comparte el tamaño circular en icon/iconSm (para la × de cerrar).
const PILL_SIZES: Record<"default" | "sm" | "lg", string> = {
  default: "min-w-[200px] justify-between gap-3 rounded py-4 px-5 text-[12px]",
  sm: "justify-between gap-2.5 rounded py-2.5 px-4 text-[11px]",
  lg: "min-w-[220px] justify-between gap-3 rounded py-4 px-5 text-[13px]",
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
  if (size === "icon" || size === "iconSm") return ICON_SIZES[size];
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

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    const classes = cn(BASE, VARIANTS[variant], INLINE_VARIANTS.has(variant) ? undefined : sizeClasses(variant, size), className);
    // El ripple es parte del diseño sólido; en asChild no se inyecta (el hijo clonado
    // no tiene por qué aceptar más children propios, p.ej. un ícono de next/link).
    const showRipple = SOLID_VARIANTS.has(variant) && !asChild;

    if (asChild) {
      if (!isValidElement(children)) {
        throw new Error("Button: asChild requiere exactamente un elemento hijo (p.ej. <Link>).");
      }
      const child = children as ReactElement<{ className?: string }>;
      return cloneElement(child, {
        ...props,
        className: cn(classes, child.props.className),
      });
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {showRipple && <i className="animation" aria-hidden="true" />}
        {children}
        {showRipple && <i className="animation" aria-hidden="true" />}
      </button>
    );
  },
);
Button.displayName = "Button";
