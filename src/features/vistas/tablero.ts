import { ETAPA_ROTULO, type Etapa } from '../../lib/etapas';
import type { FilaDesglose } from '../../dominio/desglose';

/**
 * EL TABLERO HONESTO (#90) — la lógica pura del Pipeline, sin DOM.
 *
 * Interesados dejó de ser columna: es la bandeja de arriba (un contador real y
 * el acceso a Mensajes, donde ese trabajo de verdad se hace). Las columnas de
 * trabajo cargan POR etapa efectiva (`?etapa=`, #89) y acá se decide dónde cae
 * cada tarjeta cuando hay movimientos optimistas en el medio. VistaEmbudo solo
 * ejecuta; la política se fija con tests sin DOM (mismo patrón que
 * `compuertas.ts`).
 */

/**
 * Las columnas del tablero, en el orden del embudo. Cada una lleva su `pista`
 * (qué significa estar acá) y su `vacio` (qué hacer para que deje de estar
 * vacía) — una columna en cero que no explica cómo se llena es la mitad del
 * problema de esta pantalla.
 *
 * ⚠️ **El ORDEN de acá no es la ESCALA de `etapaEfectivaSql`** y no tiene por
 * qué serlo: la escala existe para `max(manual, derivada)` —ahí
 * `sin_respuesta(0) < interesado(1)`— y esto es presentación. «Te esperan» va
 * primera porque es donde se empieza el día, no porque sea el peldaño más bajo.
 *
 * ⚠️ **«Nunca contestaron» SE SACÓ Y SE REPUSO** (ADR 0050 → ADR 0052): sacarla
 * hacía desaparecer de la mesa lo que la vendedora acababa de trabajar. Ver su
 * bloque, abajo.
 *
 * 🔴 **Y para que entrara salió «Dijeron que no», porque SEIS COLUMNAS NO ENTRAN
 * A 1280.** No es una opinión: se probó, y la captura mostró la última columna
 * cortada contra el borde con las tarjetas desbordadas. El intercambio se eligió
 * por el dato — `perdido` tiene **CERO filas en toda la historia** (nadie declara
 * una pérdida; en este negocio la gente se calla) y es archivo, no trabajo.
 * Sigue siendo etapa: se puede declarar desde el chat y se ve en Mensajes; lo
 * que no tiene es una columna vacía ocupando ancho que la mesa necesita.
 */
export const COLUMNAS_TRABAJO = [
  /**
   * ══ TE ESPERAN — VUELVE A SER COLUMNA, Y VA PRIMERA ═══════════════════════
   *
   * Decisión del dueño del 10-ago-2026, que **revierte #87**: ahí `Interesados`
   * había dejado de ser columna porque «una pila que nunca se trabaja es ruido»,
   * y pasó a ser la tira de arriba con su botón a Mensajes.
   *
   * Lo que cambió desde entonces es que la pila **dejó de ser indistinta**: hoy
   * el tablero sabe separar «nunca contestaron» de «te contestaron», así que
   * esta columna ya no es el cajón de todo lo que no encajaba — es exactamente
   * *escribieron y la pelota es nuestra*. Y siendo eso, es lo más valioso del
   * tablero: va **primera**, a la izquierda de «Nunca contestaron».
   *
   * ⚠️ **La tira de arriba se fue con esto** (`BandejaDeuda` se borró). Lo que
   * ella mostraba no se pierde: el desglose «sin abrir · volvieron a escribir»
   * sigue en la `pista` que ven las demás columnas —`resumirBandeja` sigue
   * calculándolo—, pero esta columna ya no la pinta como texto fijo (por eso
   * queda vacía acá abajo). El botón «Responder en Mensajes» que vivió en su
   * cabecera se sacó el 27-ago-2026 (pedido del dueño, para todas las
   * vendedoras y campaña): en su lugar hay un ícono de información que cuenta
   * al pasar el mouse (`PISTA_TE_ESPERAN` en `VistaEmbudo.tsx`, porque acá no
   * hay texto que mostrar).
   *
   * ⚠️ **No se puede arrastrar acá**, por lo mismo que a «Nunca contestaron»
   * (`compuertas.ts`): se deriva de un hecho —escribieron y no les contestamos—
   * y deja de ser cierto solo, en cuanto la vendedora responde.
   */
  {
    id: 'interesado',
    titulo: ETAPA_ROTULO.interesado.varios,
    pista: '',
    vacio: 'Nadie esperando respuesta. Cuando alguien escriba, aparece acá.',
  },
  /**
   * ══ NUNCA CONTESTARON — VUELVE, Y ESTA VEZ CON EL PORQUÉ ══════════════════
   *
   * 🔴 **Se sacó el 10-ago (ADR 0050) y se repuso al día siguiente**, porque el
   * argumento para sacarla era cierto y la consecuencia no se vio: son 2.575
   * conversaciones que nadie trabaja *en conjunto*, sí — pero cada una fue, en
   * su momento, alguien a quien una vendedora le acababa de escribir.
   *
   * Sacarla hizo que **el trabajo del día desapareciera de la mesa**: la
   * vendedora manda la información, el lead todavía no contesta, y la tarjeta se
   * esfuma del tablero. Reportado por Luz el 11-ago: «se me están desapareciendo
   * los leads».
   *
   * La lección, que es la que hay que no volver a pagar: **una columna grande y
   * fría no es lo mismo que una columna inútil.** El tamaño medía el pasado
   * acumulado; lo que se rompió fue el presente — el eco de lo que la vendedora
   * acaba de hacer. Si vuelve a molestar, se recorta (el chip «Para seguir» ya
   * existe), no se esconde.
   */
  {
    id: 'sin_respuesta',
    titulo: ETAPA_ROTULO.sin_respuesta.varios,
    pista: 'Les escribiste y todavía no contestaron.',
    vacio: 'Acá caen las conversaciones que abriste tú y nadie respondió aún.',
  },
  {
    id: 'contactado',
    titulo: ETAPA_ROTULO.contactado.varios,
    pista: 'Te contestaron y todavía no les pasaste el precio. Se llena solo.',
    vacio: 'Cuando alguien te conteste, aparece acá.',
  },
  {
    id: 'cotizado',
    titulo: ETAPA_ROTULO.cotizado.varios,
    pista: 'Hablaron y ya les llegó el precio.',
    vacio: 'Manda el precio en una conversación con curso registrado, o arrástrala acá.',
  },
  {
    id: 'cierre',
    titulo: ETAPA_ROTULO.cierre.varios,
    pista: 'No se declara: se gana con la venta.',
    vacio: 'Registra la venta desde la ficha y la tarjeta llega sola.',
  },
] as const;

/**
 * ══ LAS COLUMNAS DE CAMPAÑA (ADR 0063) ══════════════════════════════════════
 *
 * Mismo arranque —«Te esperan» y «Contestaron» son igual de ciertos de los dos
 * lados— y otra cola: tres peldaños que **una persona AFIRMA**, porque un
 * votante no deja huellas verificables como las deja un comprador.
 *
 * 🔴 **SON CINCO, Y «NUNCA CONTESTARON» ES LA QUE SE CAE.** No es preferencia:
 * seis columnas **no entran a 1280** —se midió al armar ADR 0050, y la captura
 * mostró la última cortada contra el borde con las tarjetas desbordadas—, así
 * que había que elegir. Se saca ésa y no un peldaño de la escalera por dos
 * razones:
 *
 * · **Es la que menos se parece al trabajo del día en una campaña.** Un comando
 *   contacta gente en frío por definición: el silencio es el caso normal, no una
 *   venta que se está enfriando. La escalera —simpatiza → se comprometió → es
 *   voluntario— sí es lo que se trabaja.
 * · **Sacar un peldaño dejaría la escalera con un salto**, y una escalera con un
 *   escalón faltante no se puede subir: la vendedora tendría que declarar
 *   «comprometido» sobre alguien al que nunca pudo marcar como simpatizante.
 *
 * ⚠️ **Y LO QUE SE APRENDIÓ EN VENTAS APLICA IGUAL**: sacar «Nunca contestaron»
 * allá hizo que el trabajo del día desapareciera de la mesa («se me están
 * desapareciendo los leads», Luz, 11-ago) y hubo que reponerla. Acá la etapa
 * **sigue existiendo** —se deriva, se ve en Mensajes y se puede pedir con
 * `?etapa=sin_respuesta`—; lo que no tiene es columna. Si en campaña pasa lo
 * mismo que pasó allá, esto se revierte y lo que sale es otra.
 */
export const COLUMNAS_CAMPANA = [
  {
    id: 'interesado',
    titulo: ETAPA_ROTULO.interesado.varios,
    pista: 'Escribieron y nadie les contestó todavía. La pelota es tuya.',
    vacio: 'Nadie esperando respuesta. Cuando alguien escriba, aparece acá.',
  },
  {
    id: 'contactado',
    titulo: ETAPA_ROTULO.contactado.varios,
    pista: 'Te contestaron. Todavía no sabes si te apoyan.',
    vacio: 'Cuando alguien te conteste, aparece acá.',
  },
  {
    id: 'simpatiza',
    titulo: ETAPA_ROTULO.simpatiza.varios,
    pista: 'Dijeron que les gusta la propuesta. Todavía no prometieron nada.',
    vacio: 'Arrastra acá a quien te haya dicho que apoya.',
  },
  {
    id: 'comprometido',
    titulo: ETAPA_ROTULO.comprometido.varios,
    pista: 'Dijeron que van a votar. Es lo que se cuenta el día de la elección.',
    vacio: 'Arrastra acá a quien te haya prometido su voto.',
  },
  {
    id: 'voluntario',
    titulo: ETAPA_ROTULO.voluntario.varios,
    pista: 'Aceptaron hacer algo: volantear, prestar un local, sumar contactos.',
    vacio: 'Arrastra acá a quien se haya ofrecido a ayudar.',
  },
] as const;

/**
 * QUÉ COLUMNAS DIBUJA EL TABLERO DE ESTA PERSONA.
 *
 * ⚠️ **Es una función y no un `if` en la vista**: el Pipeline usa la lista para
 * el GRID, para los recortes y para las compuertas del arrastre. Con la decisión
 * repartida, agregar una columna a un módulo dejaría a los otros dos lugares
 * dibujando el tablero viejo.
 */
export function columnasDe(modulo: 'ventas' | 'campana'): readonly ColumnaTablero[] {
  return modulo === 'campana' ? COLUMNAS_CAMPANA : COLUMNAS_TRABAJO;
}

/** Lo que una columna del tablero necesita decir de sí misma. */
export interface ColumnaTablero {
  id: EtapaTrabajo;
  titulo: string;
  pista: string;
  vacio: string;
}

/**
 * ══ COLUMNAS PAREJAS, Y COLAPSABLES (ADR 0089) ══════════════════════════════
 *
 * Hasta acá cada columna pesaba distinto a propósito —Contactados y Cotizados
 * se llevaban el ancho, Cierre era un cajón chico— porque el ancho decía dónde
 * está el trabajo. El dueño pidió lo contrario: **todas del mismo ancho**, y
 * la posibilidad de ocultar una que hoy no toca mirar (Cierre casi siempre
 * vacía, por ejemplo) sin perder de vista cuál es.
 *
 * `215` es el mínimo YA verificado en producción: era el de «Te esperan», la
 * columna más angosta del reparto viejo, y `TarjetaEmbudo` ya está probada
 * contra una de 225 (el chip «Formulario» se movió a un segundo renglón por
 * eso). No es un número nuevo sin probar.
 *
 * `44` es la franja colapsada: angosta para dejarle el ancho a las demás, con
 * lugar justo para el ícono de expandir, la cifra y el título rotado.
 *
 * Esto NO decide cuántas ni cuáles columnas dibuja cada tablero —eso lo sigue
 * fijando `COLUMNAS_TRABAJO`/`COLUMNAS_CAMPANA`, y la cuenta de que seis no
 * entran a 1280 sigue vigente—; solo cuánto ancho horizontal se le da a cada
 * una que SÍ se dibuja.
 */
export const ANCHO_MIN_COLUMNA = 215;
export const ANCHO_COLUMNA_COLAPSADA = 44;

/**
 * La plantilla de `grid-template-columns`: todas iguales y fluidas
 * (`minmax(215px, 1fr)`, así se reparten el ancho sobrante por parejo y se
 * achican juntas si la ventana achica), salvo las que están en `colapsadas`,
 * que pasan a la franja fija. Pura y con tests: es la política, no un detalle
 * de JSX.
 */
export function plantillaColumnas(
  columnas: readonly Pick<ColumnaTablero, 'id'>[],
  colapsadas: ReadonlySet<string>,
): string {
  // Sin espacio tras la coma a propósito: cada tramo tiene que ser UN token —
  // separarlos por espacio es como CSS ya acepta escribir `minmax()`, y así el
  // string entero se puede partir por espacio sin que el propio `minmax`
  // aporte uno de más (ver `tablero.test.ts`).
  return columnas
    .map((c) =>
      colapsadas.has(c.id)
        ? `${ANCHO_COLUMNA_COLAPSADA}px`
        : `minmax(${ANCHO_MIN_COLUMNA}px,1fr)`,
    )
    .join(' ');
}

/**
 * Una etapa que ALGÚN tablero dibuja como columna.
 *
 * ⚠️ **Es la unión de los dos módulos, no una por módulo** (mismo criterio que
 * `Etapa` en `lib/etapas.ts`): los componentes del Pipeline —la tarjeta, el
 * recorte, el arrastre— son los MISMOS en los dos tableros. Qué columnas ve cada
 * quien lo decide `columnasDe`, que es donde vive esa decisión.
 */
export type EtapaTrabajo =
  | (typeof COLUMNAS_TRABAJO)[number]['id']
  | (typeof COLUMNAS_CAMPANA)[number]['id'];

const ETAPAS_TRABAJO: readonly string[] = COLUMNAS_TRABAJO.map((c) => c.id);

/** Lo mínimo que el tablero necesita saber de una tarjeta. */
export interface TarjetaTablero {
  clave: string;
  /** La etapa dicha por el server (ADR 0013). Sin ella no se inventa nada. */
  etapa_efectiva?: string | null;
}

/**
 * La etapa ACTUAL de una tarjeta para las compuertas: el movimiento optimista
 * en vuelo (si hay) le gana a la del server. Sin dato del server, `null` —
 * jamás el fallback `'interesado'` que hacía mentir al tablero viejo.
 */
export function etapaDeTarjeta(
  c: TarjetaTablero,
  overrides: Record<string, Etapa>,
): Etapa | null {
  return overrides[c.clave] ?? ((c.etapa_efectiva as Etapa | undefined) || null);
}

/**
 * Reparte lo cargado por columna en lo que se PINTA por columna:
 *
 *   · manda la etapa efectiva de la propia tarjeta (si el refetch del origen
 *     viene atrasado, la tarjeta no se duplica: cada clave se pinta una vez);
 *   · un movimiento optimista la muda ya — entra ARRIBA del destino (es lo que
 *     la vendedora acaba de tocar) y sale del origen;
 *   · una etapa fuera del tablero (interesado) no se pinta en ninguna columna.
 */
export function repartirColumnas<C extends TarjetaTablero>(
  cargadas: ReadonlyArray<readonly [EtapaTrabajo, readonly C[]]>,
  overrides: Record<string, Etapa>,
): Map<EtapaTrabajo, C[]> {
  const mapa = new Map<EtapaTrabajo, C[]>(COLUMNAS_TRABAJO.map((c) => [c.id, []]));
  const movidas = new Map<EtapaTrabajo, C[]>(COLUMNAS_TRABAJO.map((c) => [c.id, []]));
  const vistas = new Set<string>();

  for (const [columna, items] of cargadas) {
    for (const c of items) {
      if (vistas.has(c.clave)) continue;
      vistas.add(c.clave);
      const propia = ETAPAS_TRABAJO.includes(c.etapa_efectiva ?? '')
        ? (c.etapa_efectiva as EtapaTrabajo)
        : c.etapa_efectiva == null
          ? columna // server viejo sin la columna: se respeta la etapa pedida
          : null; // interesado u otra: fuera del tablero
      const destino = overrides[c.clave] ?? propia;
      if (destino == null || !ETAPAS_TRABAJO.includes(destino)) continue;
      (destino === propia ? mapa : movidas).get(destino as EtapaTrabajo)!.push(c);
    }
  }

  for (const [columna, items] of movidas) {
    if (items.length) mapa.get(columna)!.unshift(...items);
  }
  return mapa;
}

/** El «Ver más» honesto: cuántas faltan de ESTA columna. Nunca negativo, nunca inventado. */
export function quedanPorTraer(total: number | undefined, cargadas: number): number {
  if (total == null) return 0;
  return Math.max(total - cargadas, 0);
}

// `FilaDesglose` se mudó a `dominio/desglose.ts`: la necesitan esta vista Y el
// modelo del front, y mientras vivía acá `conversaciones.ts` tenía que importar
// una PANTALLA para tipar la respuesta de la cola. Se re-exporta para no romperle
// el import a quien ya la pedía de este archivo.
export type { FilaDesglose };

/**
 * LA BANDEJA, DICHA COMO ES. Hasta acá era un número gris con un rótulo que
 * mentía: «Levantaron la mano y nadie les respondió aún» — falso para la mitad.
 * Medido en producción el 2026-07-25, la bandeja son **476 conversaciones donde
 * la pelota es nuestra**, y son dos trabajos distintos:
 *
 *   · `nuevas` — nadie les contestó nunca. Se abren.
 *   · `retomadas` — ya les hablamos y volvieron a escribir. Se siguen.
 *
 * `vivas` es el número que decide el día: cuántas están escribiendo AHORA
 * (nivel 0, menos de 24 h). La mediana de primera respuesta es de 39 minutos;
 * ese número tiene que estar a la vista, no enterrado en una pila.
 */
export function resumirBandeja(
  desglose: readonly FilaDesglose[] | undefined,
  /**
   * Los conteos por etapa de siempre (#89). El front sale a producción SIN
   * reinicio del server (N4) y el server recién en el botón (N5): entre uno y
   * otro no hay desglose. Ahí la bandeja cuenta con lo que hay y CALLA el
   * detalle, en vez de mostrar un cero que no es cierto.
   */
  conteos?: Record<string, number>,
): { total: number; nuevas: number; retomadas: number; vivas: number; hayDetalle: boolean } {
  const r = { total: 0, nuevas: 0, retomadas: 0, vivas: 0, hayDetalle: false };
  if (!desglose) return { ...r, total: conteos?.interesado ?? 0 };
  r.hayDetalle = true;
  for (const fila of desglose) {
    if (fila.etapa !== 'interesado') continue;
    r.total += fila.n;
    if (fila.yaLeHablamos) r.retomadas += fila.n;
    else r.nuevas += fila.n;
    if (fila.viva) r.vivas += fila.n;
  }
  return r;
}

/**
 * El tamaño real de una columna y el de su recorte útil: cuántas de esas
 * conversaciones ya tienen un precio encima. Con 611 precios enviados y la
 * columna Cotizados en cero, ese subconjunto ES el trabajo del día.
 */
export function resumirColumna(
  desglose: readonly FilaDesglose[] | undefined,
  etapa: string,
  /** El conteo de siempre, para el rato en que el front va adelante del server. */
  conteos?: Record<string, number>,
): ResumenColumna {
  if (!desglose)
    return { total: conteos?.[etapa] ?? 0, conPrecio: 0, enVentana: 0, paraSeguir: 0, seCallo: 0 };
  const r = { total: 0, conPrecio: 0, enVentana: 0, paraSeguir: 0, seCallo: 0 };
  for (const fila of desglose) {
    if (fila.etapa !== etapa) continue;
    r.total += fila.n;
    if (fila.precio) r.conPrecio += fila.n;
    // `ventana` ausente (server viejo) NO suma: el chip se esconde en cero, que
    // es preferible a ofrecer un recorte que el server no sabe aplicar.
    if (fila.ventana) r.enVentana += fila.n;
    if (fila.paraSeguir) r.paraSeguir += fila.n;
    if (fila.seCallo) r.seCallo += fila.n;
  }
  return r;
}

export interface ResumenColumna {
  total: number;
  conPrecio: number;
  enVentana: number;
  paraSeguir: number;
  seCallo: number;
}

/**
 * ══ EL RECORTE ES POR COLUMNA, Y ESO ES EL CAMBIO ══════════════════════════
 *
 * Hasta acá el recorte era **uno solo y global a la vista**, y solo se dibujaba
 * arriba de Contactados. Eso alcanzaba mientras Contactados era la única columna
 * con tarjetas; desde que el embudo se DERIVA (8-ago-2026), la pila se mudó a
 * Cotizados —3.064 tarjetas— y la única columna con recorte quedó con 534.
 *
 * El plan lo dice mejor que cualquier comentario
 * (`docs/plan-pipeline-funcional.md` §3.1): *una columna con 3.064 tarjetas no
 * es una lista de trabajo, es la misma pila con otro rótulo*. Y el número grande
 * («cuántos hay») no responde ninguna pregunta que alguien se haga: la pregunta
 * es **cuántos de esos son trabajo de hoy**.
 *
 * ── POR QUÉ NO SE OFRECEN LOS MISMOS EJES EN LAS CUATRO ──────────────────
 * `cierre` y `perdido` no llevan recorte, y no es que dieran cero:
 *   · **Perdidos es ARCHIVO, no trabajo** (§3.1, la fila que dice «nada»).
 *     Un «Para seguir» ahí contradiría que `perdido` es terminal humano.
 *   · **Cierre** sí tiene un recorte que vale —«vendido y todavía sin registrar
 *     en Cerberus»— pero ese depende del lazo de ventas, que es otro frente
 *     (§3.3). Ofrecer el eje equivocado ahora costaría más que no ofrecer nada.
 *
 * ── LA REGLA DEL CERO, Y SU OTRA MITAD ───────────────────────────────────
 * Un recorte que daría CERO no se ofrece. Es la regla de los chips del bot en la
 * barra de la cola, y es la que hace que «Con precio» desaparezca solo de
 * Contactados: con la derivación, esas conversaciones ya viven en Cotizados.
 *
 * 🔴 **Y uno que daría EL TOTAL tampoco**, que es la mitad que faltaba y que la
 * primera captura de evidencia dejó a la vista: en Cotizados, «Con precio 3.051»
 * sobre una columna de 3.051 no recorta nada —toda esa columna tiene precio, es
 * lo que la derivó— y encima empujaba los chips a un segundo renglón. Los dos
 * casos son el mismo defecto dicho de dos formas: **un botón que no cambia lo
 * que se ve**. Y los dos tienen la misma excepción: el chip ACTIVO se ofrece
 * siempre, o la vendedora se queda sin el botón que lo apaga.
 */
export type Recorte = 'todas' | 'precio' | 'ventana' | 'seguir' | 'seCallo';

/**
 * Las columnas donde recortar tiene sentido. Ver el porqué de Cierre y Perdidos
 * arriba. **«Te esperan» hereda el lugar de «Nunca contestaron»** desde que esa
 * dejó de ser columna: con 377 tarjetas es la segunda más grande y la única
 * donde la vendedora tiene la pelota, así que es donde más vale poder recortar.
 *
 * ⚠️ No se eligió a mano qué ejes se le ofrecen: los cuatro se le pasan y decide
 * `recortesDeColumna` con la regla del cero. Ahí está el detalle que importa —
 * casi todos los que te escribieron están **en ventana** (te escribieron recién),
 * así que ese chip va a dar el TOTAL y **la regla lo esconde sola**, sin que nadie
 * tenga que acordarse de excluirlo.
 */
export const COLUMNAS_CON_RECORTE: readonly EtapaTrabajo[] = [
  'interesado',
  'sin_respuesta',
  'contactado',
  'cotizado',
];

/**
 * ══ LA COLUMNA QUE OFRECE FILTRAR POR TIEMPO ════════════════════════════════
 *
 * Una sola, y a propósito: **es la única donde el tiempo es TODO el criterio**.
 * En «Nunca contestaron» nadie dijo una palabra —no hay texto que leer, ni
 * precio, ni turno— así que lo único que separa a una tarjeta de otra es cuándo
 * le escribimos. En las demás columnas la pregunta ya tiene chips que la
 * contestan mejor («En ventana», «Para seguir», «Se callaron»).
 *
 * ⚠️ **El server acepta UNA franja por pedido** (`?franjaEn=` nombra la columna),
 * así que esto no es una lista por casualidad: ofrecerla en dos columnas a la vez
 * necesita abrir el contrato de los dos lados.
 */
export const COLUMNA_CON_FRANJA: EtapaTrabajo = 'sin_respuesta';

export interface OpcionRecorte {
  id: Recorte;
  label: string;
  /** `null` en «Todas»: es el universo, no un subconjunto que se pueda contar aparte. */
  n: number | null;
  ayuda?: string;
}

/**
 * Los chips que se dibujan arriba de una columna, ya filtrados por la regla del
 * cero. Puro y con tests: qué se ofrece es una política, no un detalle de JSX —
 * y el caso que importa (el chip activo que se queda sin conteo y desaparecería,
 * dejando el recorte encendido sin forma de apagarlo) no se ve en una captura.
 */
export function recortesDeColumna(
  etapa: EtapaTrabajo,
  resumen: ResumenColumna,
  activo: Recorte,
): OpcionRecorte[] {
  if (!COLUMNAS_CON_RECORTE.includes(etapa)) return [];
  const todos: OpcionRecorte[] = [
    { id: 'todas', label: 'Todas', n: null },
    {
      id: 'ventana',
      label: 'En ventana',
      n: resumen.enVentana,
      /* ⚠️ Este texto decía «sin pagar una plantilla» y «gratis», y los dos son
         conceptos de la CLOUD API: ahí, fuera de la ventana solo entra una
         plantilla aprobada y esa se cobra. En una línea whatsmeow no hay
         plantilla ni cobro — el operador de campaña, cuya única línea es
         whatsmeow, leía una promesa de precio sobre un producto que no existe
         de su lado. El recorte SIGUE siendo útil ahí (escribió hace poco), así
         que se corrige el texto y no el filtro. Ver `dominio/ventana.ts:plazoDuro`. */
      ayuda:
        'Escribieron hace menos de 24 h (o comentaron hace menos de 7 días), así que la conversación sigue abierta',
    },
    {
      id: 'seguir',
      label: 'Para seguir',
      n: resumen.paraSeguir,
      ayuda:
        'Les hablaste y no contestaron, y hace entre 3 y 14 días que están en esta columna: es a quienes toca insistirles hoy',
    },
    {
      id: 'seCallo',
      label: 'Se callaron',
      n: resumen.seCallo,
      /* La objeción #1 del negocio, sin declarar: conversaban y dejaron de
         hacerlo en el momento exacto en que vieron el número. Es el público de
         «se puede pagar en 2 cuotas», dicha 2 veces en 1.876 conversaciones. */
      ayuda:
        'Venían conversando y no volvieron a escribir después de que les pasaras el precio — a estos les toca ofrecerles cuotas o preguntarles qué pasó',
    },
    {
      id: 'precio',
      label: 'Con precio',
      n: resumen.conPrecio,
      ayuda: 'Ya les mandaste el precio o la forma de pagar: están cotizadas de hecho',
    },
  ];
  return todos.filter((r) => {
    if (r.id === 'todas' || r.id === activo) return true;
    const n = r.n ?? 0;
    // Ni vacío ni completo: las dos puntas son un botón que no cambia nada.
    return n > 0 && n < resumen.total;
  });
}

/**
 * CUÁNTO MIDE LA COLUMNA Y CUÁNTO SU RECORTE — las dos cifras, nunca una sola.
 *
 * Con un recorte puesto, el número grande es el del RECORTE (es la lista que se
 * está mirando) y el total viaja al lado como «de 3.064». Mostrar solo el
 * recortado escondería el tamaño real del montón; mostrar solo el total haría
 * que el número no describa lo que hay abajo.
 *
 * `total` sale del recorte servido (`columna.total`) porque el desglose cuenta el
 * universo entero de la etapa: con el recorte puesto son dos cifras distintas y
 * hay que tomar cada una de donde es verdadera.
 */
/**
 * QUÉ SE LEE EN UNA COLUMNA VACÍA. Con un recorte puesto, el vacío de la etapa
 * («Cuando le respondas a alguien, aparece acá») es FALSO: hay conversaciones, lo
 * que no hay es ninguna que pase el recorte. Decir el vacío equivocado hace creer
 * que la columna está vacía de verdad, y el chip «Todas» —que es la salida— queda
 * a la vista sin que nadie entienda para qué.
 */
export function vacioDeColumna(recorte: Recorte, vacioDeEtapa: string, conFranja = false): string {
  /**
   * La franja gana al vacío de la etapa por lo mismo que el recorte: con ella
   * puesta, «Acá caen las que abriste tú y nadie respondió» es falso — hay 4.491,
   * lo que no hay es ninguna en esa franja. Y va ANTES del switch porque franja y
   * recorte son excluyentes (`VistaEmbudo`): si hay franja, el recorte es «todas».
   */
  if (conFranja) return 'Nadie en esa franja. Toca «Todas las fechas» para ver la columna entera.';
  switch (recorte) {
    case 'precio':
      return 'Ninguna con el precio ya enviado. Toca «Todas» para ver la columna entera.';
    case 'ventana':
      return 'A ninguna se le puede escribir gratis ahora mismo. Toca «Todas» para ver la columna entera.';
    case 'seguir':
      return 'Nada que seguir hoy: ninguna lleva entre 3 y 14 días esperando respuesta. Toca «Todas» para ver la columna entera.';
    case 'seCallo':
      return 'Ninguna se quedó callada tras el precio. Toca «Todas» para ver la columna entera.';
    default:
      return vacioDeEtapa;
  }
}

export function cifrasDeColumna(
  resumen: ResumenColumna,
  recorte: Recorte,
  /** El total que devolvió la consulta de ESTA columna, ya recortada. */
  totalServido: number | undefined,
  /** Cuántas tarjetas hay pintadas — el respaldo cuando el server no dio total. */
  cargadas: number,
  /**
   * ¿Hay una franja de tiempo puesta (`vistas/franja.ts`)? Achica la columna
   * igual que un recorte, y por eso manda las MISMAS dos cifras: sin esto, el
   * número grande saldría del desglose —que no sabe de franjas— y la cabecera
   * diría «4.491» encima de una lista de doce.
   */
  conFranja = false,
): { principal: number; de: number | null } {
  const universo = resumen.total || totalServido || cargadas;
  if (recorte === 'todas' && !conFranja) return { principal: universo, de: null };
  const recortado = totalServido ?? cargadas;
  // Si el recorte no achica nada, decir «de N» dos veces con el mismo número es
  // ruido: se muestra una sola cifra.
  return { principal: recortado, de: recortado === universo ? null : universo };
}
