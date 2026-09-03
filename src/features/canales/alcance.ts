import { LINEA_MIAS } from '../../dominio/cola';
import type { LineaWhatsapp } from '../../dominio/lineas';

/**
 * QUÉ LÍNEAS OFRECE EL SELECTOR — la regla, pura.
 *
 * ══ POR QUÉ EXISTE ═══════════════════════════════════════════════════════
 *
 * El selector listaba **todas las líneas vivas** y le ofrecía a cualquiera la
 * cola de cualquiera. Cuando había una línea eso no era una decisión; con cinco
 * vendedoras nuevas que atienden UNA sola, el selector les pone adelante tres
 * colas que no son suyas —«Ventas Perú», «Walter Ventas», «Venta Peru»— y encima
 * dos de esos rótulos se distinguen por una `s` y una tilde.
 *
 * Acá el selector pasa a ofrecer **lo tuyo**: si `numero_vendedora` te asigna
 * líneas, esas y nada más. Es la misma regla que ya gobierna este control («un
 * selector de un solo elemento no es una elección, es ruido»), aplicada a quién
 * mira en vez de a cuántas líneas existen.
 *
 * ══ FAIL-OPEN, IGUAL QUE SIEMPRE ═════════════════════════════════════════
 *
 * Sin líneas asignadas se ofrecen TODAS, como hoy. El mapa lo puebla Cerberus y
 * puede estar incompleto en cualquier momento: un mapa incompleto tiene que
 * degradar en «ves de más», nunca en «no ves nada» (`cola/lineas.ts`).
 *
 * ══ NO ES UN PERMISO, Y ESTO NO LO CAMBIA ════════════════════════════════
 *
 * ⚠️ Achicar lo que el selector OFRECE no achica lo que la API SIRVE. El hilo, la
 * ficha y el envío siguen respondiendo cualquier conversación a cualquier token
 * —Hermes no tiene modelo de permisos— y `/api/conversaciones?linea=` sigue
 * aceptando cualquier número. Lo que cambia es la mesa de trabajo, no la frontera.
 * Presentar esto como frontera sería una frontera imaginaria: peor que ninguna,
 * porque se le cree.
 */

/** Una opción del segmentado de línea, ya con su rótulo y su ayuda. */
export interface OpcionDeLinea {
  /** `''` = todas · `LINEA_MIAS` = las asignadas · o el número propio. */
  numero: string;
  etiqueta: string;
  titulo: string;
  /**
   * Por dónde sale ESA línea, para rotularla en el selector. Ausente en las dos
   * opciones sintéticas —«Todas» y «Las mías»— y eso NO es un olvido: agrupan
   * líneas que pueden tener transportes distintos, y un tag ahí afirmaría de una
   * lo que le toca a la otra. Un hueco es la respuesta correcta.
   */
  transporte?: LineaWhatsapp['transporte'];
}

/**
 * Las opciones del selector, en el orden en que se leen.
 *
 * Tres formas según a quién le toque:
 *
 *   · **Sin líneas propias** → `Todas` + cada línea viva. El comportamiento de
 *     siempre, y el fail-open del mapa incompleto.
 *   · **Una línea propia** → **una sola opción**, que por la regla de abajo hace
 *     que el selector no se dibuje: no hay elección que tomar, y el chip diría lo
 *     mismo que ya dice la cola. Es el caso de las cinco vendedoras nuevas.
 *   · **Varias propias** → `Las mías` + cada una. Sin `Todas`: agregarla volvería
 *     a poner adelante las colas de los demás, que es justo lo que se saca.
 */
export function opcionesDeLinea(
  lineas: readonly LineaWhatsapp[],
  hayMias: boolean,
): OpcionDeLinea[] {
  const deLinea = (l: LineaWhatsapp): OpcionDeLinea => ({
    numero: l.numero,
    etiqueta: l.etiqueta,
    titulo: `Ver solo lo que entró por ${l.etiqueta} (${l.numero})${rotuloDeTransporte(l.transporte)}`,
    transporte: l.transporte,
  });

  if (!hayMias) {
    return [
      { numero: '', etiqueta: 'Todas', titulo: 'Ver todas las líneas juntas' },
      ...lineas.map(deLinea),
    ];
  }

  const propias = lineas.filter((l) => l.mias === true);
  if (propias.length <= 1) return propias.map(deLinea);

  return [
    { numero: LINEA_MIAS, etiqueta: 'Las mías', titulo: 'Ver todas tus líneas juntas' },
    ...propias.map(deLinea),
  ];
}

/** Con una sola opción no hay elección: es ruido en una barra que ya está llena. */
export function seDibujaElSelector(opciones: readonly OpcionDeLinea[]): boolean {
  return opciones.length > 1;
}

/**
 * QUÉ LÍNEA SE ESTÁ MIRANDO DE VERDAD, dada la guardada.
 *
 * Existe por una razón que no es cosmética: cuando el selector deja de dibujarse
 * —una sola línea propia— **ya no hay control para corregir un valor guardado
 * malo**. Sin esto, una vendedora que ayer eligió «Todas» quedaría viendo las
 * cuatro líneas para siempre, sin nada en pantalla que lo explique ni que lo
 * apague.
 *
 * El fallback NO es `''` (todas): es lo suyo. Ahí está la diferencia con la
 * versión vieja de esta regla, que caía a «todas» porque «todas» era lo correcto
 * cuando el mapa no decía nada. Con el mapa poblado, caer a «todas» es caer a la
 * cola de otra persona.
 */
export function lineaEfectiva(guardada: string, opciones: readonly OpcionDeLinea[]): string {
  if (opciones.some((o) => o.numero === guardada)) return guardada;
  // Sin coincidencia manda la primera opción, que por el orden de arriba es
  // siempre la más amplia de las que le corresponden: `Todas` si no tiene mapa,
  // `Las mías` si tiene varias, su única línea si tiene una.
  return opciones[0]?.numero ?? '';
}

/**
 * CÓMO SE ROTULA UN TRANSPORTE, en dos letras y una explicación.
 *
 * 🔴 El tag NO dice una capacidad, dice POR DÓNDE SALE. Quien necesite saber si
 * se puede editar un enviado o mandar una plantilla lee `puedeEditar` /
 * `puedeMandarPlantilla`, que están feature-detectados (ADR 0056 y 0072).
 * Derivarlas de acá sería la segunda implementación de una regla que ya vive del
 * lado del server — #37, y con un tercer transporte se notaría tarde.
 *
 * ⚠️ `falso` no lleva tag: es el transporte de desarrollo y no existe en
 * producción. Un tag ahí sería vocabulario nuevo para algo que nadie va a ver.
 */
export function tagDeTransporte(t: LineaWhatsapp['transporte']): string | null {
  if (t === 'cloud-api') return 'API';
  if (t === 'whatsmeow') return 'QR';
  return null;
}

/** La frase larga del `title`, que es donde entra el porqué. */
export function rotuloDeTransporte(t: LineaWhatsapp['transporte']): string {
  if (t === 'cloud-api') return ' · Cloud API: el plazo de 24 h es duro y no se puede editar lo enviado';
  if (t === 'whatsmeow') return ' · sesión propia por QR: se puede editar lo enviado y no hay plazo duro';
  return '';
}
