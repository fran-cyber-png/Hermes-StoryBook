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
 * ══ 🔴 «LO TUYO» ES DEL ROL, NO DEL MAPA — LA CICATRIZ DEL 7-SEP-2026 ════
 *
 * Arriba dice «si `numero_vendedora` te asigna líneas, esas y nada más», y ese
 * «nada más» se escribió pensando en las cinco vendedoras nuevas. **Aplicado a
 * quien SUPERVISA es al revés de lo que el server hace.**
 *
 * `alex` es supervisor en la tabla `equipo` y tiene UNA línea en el mapa
 * (`51984429504`, Ventas Meta). Con la regla vieja: una opción → el selector no
 * se dibuja (`seDibujaElSelector`) → `lineaEfectiva` le clava esa línea → su
 * cola pedía siempre `?linea=51984429504` **y no había control con el que
 * salirse**. Su pantalla decía «2.346 en cola», que es exactamente el conteo de
 * Ventas Meta en la ventana: le faltaban luz (2.432), lo que no entró por
 * ninguna línea —formularios y comentarios— (2.155), Darian (830), Darwin (497)
 * y Libros Mx (198). Mientras tanto el server le servía las **7.178** de la
 * mesa entera, porque `fronteraDeAsignacionSql` no recorta a quien supervisa
 * (`npm run frontera:preflight`: `alex supervisor/tabla ve 7178`).
 *
 * O sea: **el recorte lo hacía el front y era ciego al rol**. Por eso la regla
 * ahora recibe `veTodo` y no lo deduce de nada — el rol lo resuelve el server
 * una vez (`equipo/cascada.ts`) y baja con las líneas (#37: una regla que vive
 * en dos lados diverge, y en una frontera divergir falla hacia el lado que no
 * se ve).
 *
 * ⚠️ **Le pega SÓLO a quien supervisa con exactamente una línea en el mapa.**
 * `alan` (admin) y `ventas10@grupogoberna.com` (supervisor) no tienen ninguna,
 * así que caían en la rama `hayMias === false` y veían «Todas» — por eso el
 * defecto vivió semanas con una sola persona sufriéndolo.
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
 * Cuatro formas según a quién le toque:
 *
 *   · **Ve todo** (supervisor o admin) → `Todas` + `Las mías` si el mapa le
 *     asigna alguna + cada línea viva. Se decide PRIMERO, antes de mirar el
 *     mapa: para quien supervisa, tener una línea asignada no es estar
 *     confinada a ella — es una más de las que puede mirar, y por eso «Las
 *     mías» sigue ahí como atajo a su propio trabajo.
 *   · **Sin líneas propias** → `Todas` + cada línea viva. El comportamiento de
 *     siempre, y el fail-open del mapa incompleto.
 *   · **Una línea propia** → **una sola opción**, que por la regla de abajo hace
 *     que el selector no se dibuje: no hay elección que tomar, y el chip diría lo
 *     mismo que ya dice la cola. Es el caso de las cinco vendedoras nuevas.
 *   · **Varias propias** → `Las mías` + cada una. Sin `Todas`: agregarla volvería
 *     a poner adelante las colas de los demás, que es justo lo que se saca.
 *
 * ⚠️ **El ORDEN de la primera opción es contrato**, no estética: `lineaEfectiva`
 * cae a `opciones[0]` cuando lo guardado ya no está, y esa primera tiene que ser
 * siempre la más amplia de las que le corresponden. Para quien ve todo, eso es
 * `Todas` — arrancar en «Las mías» reproduciría el defecto con otro nombre.
 */
export function opcionesDeLinea(
  lineas: readonly LineaWhatsapp[],
  hayMias: boolean,
  /**
   * ¿Manda sobre el trabajo de las demás? Llega RESUELTO del server, con las
   * líneas (`useLineas().veTodo` ← `GET /api/whatsapp/lineas`). Acá no se
   * deduce de nada: el rol vive en la tabla `equipo` y ya lo leyó `cargarRol`.
   *
   * ⚠️ **Default `false` a propósito**: quien no lo pasa se comporta como antes
   * de este arreglo. Las cuatro galerías y el server viejo entran por ahí.
   */
  veTodo = false,
): OpcionDeLinea[] {
  const deLinea = (l: LineaWhatsapp): OpcionDeLinea => ({
    numero: l.numero,
    etiqueta: l.etiqueta,
    titulo: `Ver solo lo que entró por ${l.etiqueta} (${l.numero})${rotuloDeTransporte(l.transporte)}`,
    transporte: l.transporte,
  });

  const todas: OpcionDeLinea = {
    numero: '',
    etiqueta: 'Todas',
    titulo: 'Ver todas las líneas juntas',
  };

  // QUIEN SUPERVISA NO ESTÁ CONFINADO, y por eso esto va antes que el mapa: la
  // cola ya le sirve la mesa entera, así que un selector que no le ofrezca
  // «Todas» le esconde filas que el server sí le manda — sin un solo síntoma.
  if (veTodo) {
    return [
      todas,
      ...(hayMias ? [{ numero: LINEA_MIAS, etiqueta: 'Las mías', titulo: 'Ver todas tus líneas juntas' }] : []),
      ...lineas.map(deLinea),
    ];
  }

  if (!hayMias) return [todas, ...lineas.map(deLinea)];

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
