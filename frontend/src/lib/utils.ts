type ClassValue = string | number | false | null | undefined;

/** Concatena clases condicionales, ignorando falsy. Versión liviana del `cn()` de
 * shadcn/ui sin la dependencia `clsx`/`tailwind-merge` — no resuelve conflictos entre
 * utilidades de Tailwind (ver Button: por eso ahí se evita combinar clases de tamaño
 * con variantes que ya traen su propio tamaño, en vez de confiar en que la última gane). */
export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(" ");
}
