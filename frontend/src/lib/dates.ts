/** Formatea una fecha ISO (`YYYY-MM-DD...`) como `DD/MM/YYYY` sin pasar por `Date`,
 * así no hay corrimiento por zona horaria. */
export function formatFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Formatea un instante ISO como fecha y hora local en es-CO. */
export function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
