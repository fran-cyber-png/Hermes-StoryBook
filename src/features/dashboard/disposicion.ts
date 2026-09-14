/**
 * LA DISPOSICIÓN DEL DASHBOARD EN PANTALLA ANGOSTA (#968), EN UN SOLO LUGAR.
 *
 * Las tres lecturas se apilan igual. Si cada panel escribiera sus propias clases, al mover
 * el corte en una se olvidaría en las otras: la cicatriz de siempre de este repo (#37).
 * Desde `md` cada bloque conserva su grilla (`md:grid-cols-[…]`), que va escrita donde se
 * usa.
 */

/** Una grilla de tarjetas: una columna en el teléfono y dos en `sm`. */
export const tarjetasAngostas = 'grid shrink-0 grid-cols-1 gap-2.5 sm:grid-cols-2';

/** La tercera tarjeta de una grilla de tres: en `sm` ocupa entera la fila de abajo. */
export const terceraTarjetaAngosta = 'sm:col-span-2 md:col-span-1';

/**
 * La raíz de un panel. En pantalla angosta toma el alto de lo que tiene y la vista hace
 * scroll (`VistaDashboard`): con `flex-1 min-h-0`, lo de abajo quedaba aplastado debajo de
 * las tarjetas apiladas. Desde `md` llena la vista, como siempre.
 */
export const raizDePanel = 'flex flex-none flex-col gap-2.5 transition-opacity md:min-h-0 md:flex-1';

/** Los `<select>` de la banda (la dimensión en angosto y el número), con la misma píldora. */
export const selectDeBanda =
  'appearance-none rounded-full border border-border bg-card py-1 pl-3 pr-7 text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';
