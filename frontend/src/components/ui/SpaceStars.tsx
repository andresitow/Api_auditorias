/** Estrellas fugaces de fondo del estilo `.space-form` (ver globals.css). Va como primer
 * hijo del contenedor `.space-form`; es decorativo y no captura eventos. */
export function SpaceStars() {
  return (
    <div className="space-form__stars" aria-hidden="true">
      <span className="space-star" />
      <span className="space-star" />
      <span className="space-star" />
      <span className="space-star" />
    </div>
  );
}
