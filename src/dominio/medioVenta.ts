/**
 * EL MEDIO DE UNA VENTA — de dónde le llegó la plata a Cerberus, no de dónde
 * llegó la conversación (eso es el Origen, `dominio/origen.ts`).
 *
 * ══ EL BUG QUE ESTO CIERRA (reportado por Luz) ═══════════════════════════════
 *
 * `FormularioVenta` derivaba el medio de un binario —`pagado` si la
 * conversación traía un anuncio, si no `organico`— y Cerberus acepta CINCO
 * (`server/src/cerberus/venta.ts`: `organico` · `pagado` · `referente` ·
 * `remarketing` · `postventa`). Una venta a alguien que YA le había comprado a
 * Goberna antes salía `organico`, y si además vino de un anuncio salía
 * `pagado` — nunca `postventa`, porque el formulario no sabía que la persona
 * ya era cliente.
 *
 * ══ LA PRECEDENCIA (decisión del dueño, 8-sep-2026) ══════════════════════════
 *
 * **Postventa gana.** Si la persona ya compró antes, la venta es una recompra
 * sin importar si ESTA conversación vino de un anuncio: el anuncio no vuelve
 * nueva a una venta que no lo es. `yaCompro` le gana a `vinoDeAnuncio`.
 */

export type MedioVenta = 'organico' | 'pagado' | 'postventa';

export interface EntradaMedio {
  /** La conversación de origen trajo un anuncio (`origen.fuente === 'anuncio'`). */
  vinoDeAnuncio: boolean;
  /** La persona ya le compró a Goberna antes de esta venta. */
  yaCompro: boolean;
}

export function medioDeVenta({ vinoDeAnuncio, yaCompro }: EntradaMedio): MedioVenta {
  if (yaCompro) return 'postventa';
  return vinoDeAnuncio ? 'pagado' : 'organico';
}
