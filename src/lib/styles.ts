/**
 * Clases compartidas entre features — la fábrica canónica.
 * Regla dura: sombra O borde, nunca ambos. cardClass lleva borde (la elección
 * institucional sobre #F5F7FB); quien necesite flotar usa shadow-panel SIN borde.
 * El kicker uppercase NO es el default: sectionLabel es sentence-case; `kicker`
 * existe aparte y se usa como máximo UNA vez por vista (cintillo ganado).
 */
export const sectionLabel = 'text-xs font-semibold text-muted-foreground';
export const kicker = 'text-[11px] font-bold uppercase tracking-wide text-muted-foreground';
export const fieldClass = 'rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground';
export const cardClass = 'rounded-2xl border border-border bg-card overflow-hidden';
export const cardHeaderClass = 'flex items-center justify-between border-b border-border px-5 py-3 font-heading text-sm font-bold text-navy-ink';

/**
 * EL BOTÓN AZUL DE ACCIÓN — círculo sólido, `bg-primary`, con peso propio en
 * la fila (08-sep-2026, pedido del dueño: «que tengan los mismos efectos»).
 *
 * Nació en la cabecera de Mensajes (el filtro de canal, «chat nuevo») y de
 * ahí saltó al trigger que abre/cierra el panel de la ficha — los tres
 * comparten esta MISMA cadena, en vez de className sueltos que un cambio
 * futuro puede desalinear sin que nadie lo note (#37, la cicatriz de siempre
 * de este repo). Quien necesite un botón redondo con presencia usa esto, no
 * inventa uno parecido.
 *
 * `max-md:size-10`: en el celular se toca con el dedo, y a 28 px se erra. Va
 * ACÁ y no concatenado en cada uso, por la misma razón de arriba. En escritorio
 * no cambia nada.
 */
export const botonAzulClass =
  'flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_2px_10px_-2px_rgba(37,99,235,0.5)] transition-[background-color,transform,box-shadow] hover:bg-primary-hover active:scale-[0.95] disabled:opacity-40 disabled:shadow-none max-md:size-10';

/**
 * UN CONTROL DE LA BARRA DE UNA TABLA — la vista, «Filtros», el orden (ADR 0102).
 * Todos del mismo alto y con el mismo borde: la referencia del dueño es UNA fila
 * de controles parejos, y el azul lleno queda sólo para la acción. Lo usan el
 * padrón y, cuando entre, la barra de la Lista del Pipeline.
 */
export const controlDeBarraClass =
  'flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
