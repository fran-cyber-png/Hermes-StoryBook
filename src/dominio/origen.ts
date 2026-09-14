/**
 * DE DÓNDE VINO ESTA PERSONA — y, cuando no se sabe, DECIRLO.
 *
 * ══ EL CASO QUE LO ORIGINA (6-sep-2026) ════════════════════════════════════
 *
 * «Ing. Mario Sánchez» (+52 55 2144 0000, línea Libros Mx) escribió *«si seguí
 * tu anuncio en Facebook deberías saber qué necesito»*. Recibió un saludo
 * genérico y quien atendía lo resolvió desde el celular con «es una persona
 * demasiado grosera». **En la pantalla no había nada que dijera de dónde
 * venía** — ni que viniera de un anuncio, ni que no se supiera.
 *
 * Medido en producción el 7-sep-2026, sobre `events.payload->'origen'`:
 *
 *   · 3.257 personas llegaron por un anuncio de Click-to-WhatsApp; de ésas,
 *     **1.954 (60 %) traen un `adId` que todavía nadie le preguntó a Meta**.
 *     Las 1.954 traen `titulo` — el 100 %.
 *   · 11.016 personas escribieron en 90 días, o sea que **la enorme mayoría no
 *     tiene origen registrado**: el estado que hoy simplemente no se dibuja.
 *   · `landing`: **0 filas en toda la historia**. El detector existe
 *     (`server/src/whatsapp/origen.ts`) y nunca disparó.
 *   · Los 8 mensajes de Mario: `origen` nulo en los ocho.
 *
 * ══ LA REGLA ═══════════════════════════════════════════════════════════════
 *
 * **Esta función es TOTAL: para toda fila devuelve algo que decir.** No hay
 * camino que devuelva «nada» para una conversación de chat — «no sabemos» es
 * una respuesta, y es la que faltaba. La diferencia que la vendedora necesita
 * no es «vino de pauta» contra «no vino»: es **«vino de pauta» contra «no
 * sabemos»**, y un hueco en blanco dice la segunda cosa con la cara de la
 * primera.
 *
 * ⚠️ **Un comentario de Facebook o Instagram NO pasa por acá** — devuelve
 * `null`, que es la única forma de no dibujar nada. El origen de un comentario
 * es su publicación, la fila ya la muestra (`contexto_texto`, «en “…”»), y
 * ponerle «sin origen» al lado sería afirmar que no se sabe algo que sí se
 * sabe.
 */

/**
 * LAS FUENTES QUE EL DETECTOR ESCRIBE, y sólo esas.
 *
 * 🔴 **Cerrada a propósito, y la regla es del repo, no mía**: «UNA sola palabra
 * para el origen… es un `switch` exhaustivo: el día que se agregue una fuente el
 * compilador obliga a decidir su palabra en vez de meterla de callado en el
 * `else`» (`docs/reglas/embudo-cola-y-radar.md`). Con `fuente: string`, una
 * fuente nueva caería sin ruido en «Sin origen» — o sea, Hermes volvería a
 * callarse justo sobre el hecho que este módulo existe para decir.
 *
 * ⚠️ El VALOR del contrato con el server sigue siendo el mismo (`whatsapp/origen.ts`).
 */
export type FuenteOrigen = 'anuncio' | 'landing';

/** El origen tal como viaja: el crudo del evento, más lo que Meta resolvió. */
export interface OrigenCrudo {
  fuente?: FuenteOrigen | null;
  /** El titular del creativo — lo que la persona LEYÓ antes de hacer clic. */
  titulo?: string | null;
  adId?: string | null;
  /** El código entre corchetes de la landing («Hola, me interesa [clandestinas]»). */
  ref?: string | null;
  /** El nombre del anuncio en Meta (`anuncio_resuelto.anuncio_nombre`). */
  anuncio?: string | null;
  /** El nombre de la campaña en Meta (`anuncio_resuelto.campana_nombre`). */
  campana?: string | null;
}

export interface EntradaOrigen {
  /** `mensaje` · `lead` · `comentario`. Un comentario no lleva etiqueta de origen. */
  tipo?: string | null;
  /**
   * POR DÓNDE ENTRÓ — y sirve para una sola cosa: **no explicar un motivo que en
   * ese canal no existe**. «Escribió antes de que su línea se enlazara (el
   * enlace por QR no trae el historial)» es cierto en WhatsApp y no significa
   * nada en un DM de Messenger o Instagram, que salen del mismo CTE con
   * `tipo = 'mensaje'` (`server/src/cola/consultarCola.ts`) y por lo tanto caen
   * en la misma rama.
   */
  canal?: string | null;
  /** El PRIMER anuncio de la conversación (`consultarCola.ts`). */
  origen_anuncio?: OrigenCrudo | null;
  /** El origen del ÚLTIMO mensaje. Solo lo trae quien escribió una vez. */
  ultima_origen?: OrigenCrudo | null;
  /**
   * Lo que la ficha ya resolvió contra Meta por
   * `GET /api/whatsapp/conversacion/:telefono` — el único de los tres que puede
   * traer `anuncio` y `campana`. Va primero por eso, no por ser más nuevo.
   */
  resuelto?: OrigenCrudo | null;
}

export type ClaseOrigen = 'anuncio' | 'landing' | 'formulario' | 'desconocido';

/**
 * ⚠️ **Se llama `Procedencia` y no `OrigenDelLead` a propósito.** Con ese nombre
 * quedaba a UNA LETRA de `origenDeLead` (`features/cerberus/leadForm.ts`), que
 * contesta otra pregunta —de qué FUENTE es el lead del formulario— y que además
 * también devuelve la palabra «Landing». Dos funciones casi homónimas que
 * devuelven la misma palabra sobre hechos distintos es una confusión servida.
 */
export interface Procedencia {
  clase: ClaseOrigen;
  /** LO CORTO — lo que entra en la fila de la cola. Dos palabras, nunca más. */
  etiqueta: string;
  /** EL `title`. Nunca vacío: siempre dice POR QUÉ la etiqueta dice lo que dice. */
  ayuda: string;
  /**
   * ══ LOS HECHOS SUELTOS, SIN JUNTAR — y por qué no viene una sola cadena ══
   *
   * 🔴 **Hubo una, y ROTULABA MAL.** La primera versión devolvía un `detalle`
   * ya armado —«nombre · campaña», con el titular como respaldo cuando Meta no
   * había resuelto el anuncio— y la ficha lo ponía bajo la etiqueta «CAMPAÑA».
   * En el 60 % de los casos, entonces, la ficha decía **CAMPAÑA: «La política
   * no se improvisa. Se planifica.»**, que no es ninguna campaña: es el titular
   * del creativo. El rótulo afirmaba algo falso sobre el valor que tenía
   * debajo, y lo hacía en la MAYORÍA de las fichas de pauta.
   *
   * Se vio en la galería, no razonándolo — que es exactamente para lo que la
   * regla dura #10 pide servir los valores REALES de producción.
   *
   * Por eso acá viajan los hechos separados y **quien dibuja elige el rótulo
   * que corresponde a lo que de verdad tiene**. Un módulo de dominio no sabe
   * cómo se llaman las celdas de una ficha, y no tiene por qué saberlo.
   */
  /** El nombre de la CAMPAÑA en Meta. `null` mientras nadie le preguntó. */
  campana: string | null;
  /** Qué identifica al anuncio: su nombre en Meta o, si falta, el titular que la persona leyó. */
  anuncio: string | null;
  /** El código de la landing («…[clandestinas]» → `clandestinas`). */
  ref: string | null;
  /** El `ad_id`, cuando lo hay. Con él se dispara la resolución contra Meta. */
  adId: string | null;
}

/** Un texto sirve solo si dice algo. Misma guarda que `dominio/curso.ts`. */
function util(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  return s.length > 0 ? s : null;
}

/**
 * LOS DOS MOTIVOS REALES por los que una conversación no tiene origen, dichos
 * como los diría alguien que atiende — no como los diría la base.
 *
 * 🔴 **Y ninguno de los dos es «no vino de pauta».** Ésa es la lectura que el
 * hueco en blanco invitaba a hacer, y es la que dejó a Mario sin respuesta: el
 * referral del Click-to-WhatsApp viaja UNA vez, y si en ese momento la línea
 * todavía no estaba enlazada, el dato no existe en ningún lado. El anuncio
 * existió; lo que falta es el registro.
 */
function ayudaSinOrigen(canal: string | null | undefined): string {
  /* En WhatsApp el motivo grande es el enlace por QR, que no arrastra historial.
     En un DM de Messenger o Instagram ese motivo NO EXISTE —no hay línea que
     enlazar— y explicarlo ahí sería inventar una causa. Los dos canales caen en
     esta misma rama porque salen del mismo CTE (`tipo = 'mensaje'`). */
  const motivos =
    canal === 'whatsapp' || canal == null
      ? 'escribió antes de que su línea se enlazara a Hermes (el enlace por QR no trae el ' +
        'historial), o entró sin referral — te escribió directo, o alguien le pasó el número'
      : 'te escribió directo a la Página, o el anuncio no dejó referral';
  return (
    `No sabemos por dónde llegó esta conversación. ${motivos}. ` +
    'No quiere decir que no haya visto un anuncio.'
  );
}

/** El primero de los tres que traiga algo. El de la ficha manda: es el único con nombres. */
function crudoDe(c: EntradaOrigen): OrigenCrudo | null {
  for (const o of [c.resuelto, c.origen_anuncio, c.ultima_origen]) {
    if (o && util(o.fuente)) return o;
  }
  return null;
}

/**
 * ⚠️ **`null` SOLO para los comentarios.** Cualquier otro camino devuelve una
 * etiqueta: es lo que hace que la ausencia de origen sea imposible de confundir
 * con la ausencia de la etiqueta.
 */
export function deDondeVino(c: EntradaOrigen): Procedencia | null {
  if (c.tipo === 'comentario') return null;

  const o = crudoDe(c);
  const adId = util(o?.adId ?? null);

  /**
   * 🔴 **UN `switch` EXHAUSTIVO, NO UNA CASCADA DE `if`s** — la regla del repo
   * («UNA sola palabra para el origen», `docs/reglas/embudo-cola-y-radar.md`).
   * La rama `default` no puede compilar si mañana `FuenteOrigen` gana un valor:
   * el `never` obliga a decidir su palabra en vez de dejar que caiga de callado
   * en «Sin origen», que es precisamente el silencio que este módulo mata.
   * En tiempo de ejecución igual degrada a «Sin origen» —un server nuevo contra
   * un front viejo escribe una fuente que este build no conoce— y eso es
   * correcto: no sabemos qué es, así que no sabemos de dónde vino.
   */
  if (o) {
    switch (o.fuente) {
      case 'anuncio':
        return deAnuncio(o, adId);
      case 'landing':
        return deLanding(o, adId);
      case undefined:
      case null:
        break;
      default: {
        // `crudoDe` ya exigió que `fuente` diga algo, así que acá sólo se llega
        // con una fuente que este build no conoce. El `never` es el candado.
        const _exhaustiva: never = o.fuente;
        void _exhaustiva;
      }
    }
  }

  /**
   * EL LEAD DE FORMULARIO (ADR 0051) — su origen SÍ se sabe, y decirle «sin
   * origen» sería mentir sobre el único caso del repo donde la persona declaró
   * de dónde viene con su propia mano.
   */
  if (c.tipo === 'lead') {
    return {
      clase: 'formulario',
      etiqueta: 'Formulario',
      ayuda: 'Llenó el formulario de la web. Todavía no hay conversación abierta.',
      campana: null,
      anuncio: null,
      ref: null,
      adId: null,
    };
  }

  return {
    clase: 'desconocido',
    etiqueta: 'Sin origen',
    ayuda: ayudaSinOrigen(c.canal),
    campana: null,
    anuncio: null,
    ref: null,
    adId: null,
  };
}

function deAnuncio(o: OrigenCrudo, adId: string | null): Procedencia {
  const anuncio = util(o.anuncio);
  const campana = util(o.campana);
  const titular = util(o.titulo);
  /**
   * 🔴 **EL FALLBACK ES EL TITULAR, NUNCA EL `adId` PELADO.** Un número de 18
   * dígitos no es un nombre: no se lee, no se recuerda y no se le puede repetir
   * a la persona del otro lado. Y le tocaría al 60 % de los leads de pauta —los
   * que todavía no se resolvieron contra Meta—, teniendo titular el 100 % de
   * ellos (medido el 7-sep-2026). El `adId` va a la ayuda, que es donde sirve:
   * para auditar.
   */
  const partes = [
    anuncio ? `Vino del anuncio «${anuncio}»` : 'Vino de un anuncio de Facebook o Instagram',
    campana ? `campaña «${campana}»` : null,
    titular ? `decía «${titular}»` : null,
    anuncio ? null : 'todavía no se resolvió su nombre en Meta',
    adId ? `ID ${adId}` : null,
  ].filter((p): p is string => p !== null);
  return {
    clase: 'anuncio',
    etiqueta: 'Anuncio',
    ayuda: `${partes.join(' · ')}.`,
    campana,
    anuncio: anuncio ?? titular,
    ref: null,
    adId,
  };
}

/* El `ref` es el ÚNICO dato de una landing: `whatsapp/origen.ts` escribe
   `{fuente:'landing', ref}` y nada más — sin `titulo`. Caer al título era
   inventarle un respaldo a un contrato que no lo tiene. */
function deLanding(o: OrigenCrudo, adId: string | null): Procedencia {
  const ref = util(o.ref);
  return {
    clase: 'landing',
    etiqueta: 'Landing',
    ayuda: ref
      ? `Entró por el enlace de la landing «${ref}».`
      : 'Entró por un enlace de una landing, sin código que diga cuál.',
    campana: null,
    anuncio: null,
    ref,
    adId,
  };
}
