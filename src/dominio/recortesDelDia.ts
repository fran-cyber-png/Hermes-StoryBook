/**
 * LOS RECORTES DEL DÍA (#946) — «escribieron por primera vez hoy» y «sin respuesta
 * hace más de 24 h», escritos UNA vez.
 *
 * Los leen el pedido al server (`RecorteDeColumna`, `conversaciones.ts`) y la mesa
 * del Pipeline (`features/vistas/mesa.ts`). La primera versión de #956 los tenía en
 * las dos listas por separado: sumar un tercero en una sola dejaba a la otra
 * mandando, o dibujando, lo que la primera no sabía (revisión cruzada de #956).
 *
 * Al revés que las luces del semáforo, los aplica el SERVER (`etapa:escribioHoy`
 * en `?columnas=`), y sólo si los publica en `recortesDisponibles`.
 */
export const RECORTES_DEL_DIA = ['escribioHoy', 'sinRespuesta24h'] as const;

export type RecorteDelDia = (typeof RECORTES_DEL_DIA)[number];

/** Acepta cualquier cadena: la galería los lee de una URL, y la mesa de un `Recorte`. */
export function esRecorteDelDia(r: string | null | undefined): r is RecorteDelDia {
  return (RECORTES_DEL_DIA as readonly (string | null | undefined)[]).includes(r);
}
