import { origenDeLead, type LeadForm } from '../cerberus/leadForm';
import type { Procedencia } from '../../dominio/origen';
import type { MetaContacto } from './EncabezadoTimeline';

/**
 * LOS TRES PARES DE LA CABECERA DE LA FICHA — Origen · Campaña · Primer contacto.
 *
 * ══ POR QUÉ ESTO ES UNA FUNCIÓN Y NO SEIS LÍNEAS ADENTRO DEL JSX ═══════════
 *
 * Porque lo miran DOS: `PanelDerecho` (la app) y `galeriaOrigen` (la evidencia).
 * Y una galería que arma el mismo dato por su cuenta no es evidencia de nada:
 * es una segunda implementación que puede estar bien mientras la app está mal —
 * exactamente el modo de fallar que la regla dura #10 nombra («una galería que
 * no sirve los valores REALES de producción no es evidencia»). Acá la galería y
 * la pantalla no pueden discrepar, porque llaman a lo mismo.
 *
 * ══ LA PRECEDENCIA ═════════════════════════════════════════════════════════
 *
 * **Un campo por hecho, resuelto por precedencia, con la fuente anotada** — la
 * regla que `identidad.ts` documenta para la identidad, aplicada al origen:
 *
 *   1. **el anuncio de Click-to-WhatsApp** — es lo más específico que hay: se
 *      sabe el creativo que la persona leyó y, cuando Meta ya lo resolvió, el
 *      nombre y la campaña;
 *   2. **el formulario web** — la persona declaró de dónde viene, pero en
 *      grueso («Landing», «Meta Ads»);
 *   3. **«Sin origen»** — que no es un hueco: es la tercera respuesta, y la más
 *      común. Su porqué viaja en `ayudaOrigen`.
 *
 * 🔴 **Devuelve `null` sólo cuando no hay NADA que decir** — un comentario de
 * Facebook sin formulario. Ahí el bloque no se dibuja, porque tres celdas con
 * «—» se leen como un dato que no cargó. Para todo lo demás hay bloque, y ésa
 * es la diferencia con la versión anterior: antes `null` era también la
 * respuesta para las 3.257 conversaciones que sí habían llegado por un anuncio.
 *
 * ══ 🔴 EL SEGUNDO PAR CAMBIA DE RÓTULO, Y ESO ES LO QUE ARREGLA ════════════
 *
 * Ese par decía «CAMPAÑA» pase lo que pase. Con el 60 % de los anuncios sin
 * resolver, lo que caía debajo era el TITULAR del creativo —«La política no se
 * improvisa. Se planifica.»— rotulado como si fuera el nombre de una campaña.
 * El rótulo mentía, en la mayoría de las fichas de pauta, y se descubrió
 * mirando la galería con los valores de producción, no razonándolo.
 *
 * Ahora el rótulo describe lo que hay: «Campaña» sólo cuando hay campaña de
 * verdad, «Anuncio» cuando lo único que se sabe es cuál fue el anuncio, y
 * «Enlace» cuando la persona vino de una landing con código. Un par con el
 * rótulo correcto y el valor corto es mejor que uno largo que afirma de más.
 */
export function metaDelContacto(origen: Procedencia | null, form: LeadForm | null | undefined): MetaContacto | null {
  if (!origen && !form) return null;
  /* «desconocido» no le gana al formulario: si la persona llenó un formulario,
     eso SÍ es saber de dónde vino. Lo que no se sabe es si además vio un anuncio. */
  const sabido = origen != null && origen.clase !== 'desconocido';
  const segundo = segundoPar(sabido ? origen : null, form);
  /**
   * 🔴 **LA AYUDA TIENE QUE HABLAR DEL VALOR QUE ESTÁ AL LADO, Y ESTUVO
   * DICIENDO OTRA COSA.** Cuando el formulario ganaba —conversación de WhatsApp
   * sin referral, pero la persona registrada en Cerberus— la celda decía
   * «Landing» y el `title` seguía siendo el de «Sin origen»: **«No sabemos de
   * dónde vino»** colgado de un rótulo que sí lo sabía. Es el mismo pecado que
   * la etiqueta «CAMPAÑA» sobre un titular, en la celda de al lado.
   *
   * Y las dos mitades son ciertas a la vez —sabemos que llenó un formulario, y
   * NO sabemos por dónde llegó este chat—, así que la ayuda las dice juntas en
   * vez de elegir una. Sin eso, la ficha y la fila se leen como si se
   * contradijeran: la fila dice «Sin origen» sobre la CONVERSACIÓN y la ficha
   * «Landing» sobre la PERSONA.
   */
  const ayudaOrigen = sabido
    ? origen.ayuda
    : form
      ? `Llenó el formulario web (${origenDeLead(form.fuente)}). De la conversación, en cambio, ` +
        'no tenemos el referral: no sabemos si además llegó por un anuncio.'
      : origen?.ayuda;
  return {
    origen: sabido ? origen.etiqueta : form ? origenDeLead(form.fuente) : (origen?.etiqueta ?? ''),
    ayudaOrigen: ayudaOrigen?.trim(),
    rotuloCampana: segundo.rotulo,
    campana: segundo.valor,
    /* Vacío = sin par. No existe una fecha de primer contacto fuera del
       formulario —la conversación no la manda—, y «PRIMER CONTACTO —» sobre las
       3.257 fichas de anuncio es la celda hueca que este mismo archivo declara
       peor que ninguna. Ver `armarCampos` en `EncabezadoTimeline.tsx`. */
    primerContacto: form?.fecha ?? '',
  };
}

/** Qué es lo más identificatorio que hay, y cómo se llama de verdad. */
function segundoPar(
  origen: Procedencia | null,
  form: LeadForm | null | undefined,
): { rotulo: string; valor: string } {
  if (origen?.campana) return { rotulo: 'Campaña', valor: origen.campana };
  if (origen?.anuncio) return { rotulo: 'Anuncio', valor: origen.anuncio };
  if (origen?.ref) return { rotulo: 'Enlace', valor: origen.ref };
  return { rotulo: 'Campaña', valor: form?.campana || form?.anuncio || '' };
}
