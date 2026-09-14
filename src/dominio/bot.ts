/**
 * «EL BOT DIJO ALGO DE ESTA CONVERSACIÓN» — el veredicto del bot, puro.
 *
 * ── Por qué vive en `dominio/` y no en `features/canales/` ──
 * Hasta el 7-sep-2026 vivía ahí, cuando su único lector era la fila de la cola.
 * Con la tarjeta del Pipeline y la ficha leyéndolo también son TRES features
 * pidiéndole el modelo a una cuarta — y esa cuarta es la VISTA de la cola, no el
 * modelo: exactamente el nudo que ADR 0057 midió y vino a deshacer. Se mudó con
 * `git mv`, así que su historia sigue entera.
 *
 * ── Por qué existe ──
 * El bot comercial escribe en `bot_calificaciones` desde el 1-ago-2026 y esa
 * tabla **no tenía un solo lector**. Ese mismo día escaló tres conversaciones de
 * leads que estaban por comprar: escalar lo silencia a propósito (dos horas de
 * gracia) y del otro lado no había nadie. Se salvaron porque el dueño estaba
 * mirando la sala a mano — o sea que el bot solo servía mientras alguien lo
 * vigilaba.
 *
 * ── Qué dice, y por qué así ──
 * Dos hechos distintos, que se atienden distinto:
 *
 *   · **escalada** — el bot SE FRENÓ y está esperando a una persona. Es el más
 *     caro: mientras nadie la toma, el lead no recibe nada. El chip dice el
 *     MOTIVO, porque «está por cerrar» y «preguntó si es un bot» no se atienden
 *     igual.
 *   · **caliente** — el bot la calificó caliente (pidió precio, cuotas o forma
 *     de pago) y sigue trabajándola. Es una oportunidad, no una deuda.
 *
 * `tibio` y `frio` NO se dibujan: en un día real fueron 50 de 66 conversaciones,
 * y un chip que aparece en tres de cada cuatro filas no ayuda a elegir a quién
 * atender — es la misma lección que dejó «Pide info» (#72).
 *
 * ── Lo que NO hace ──
 * No inventa. Sin el campo (el radar y la agenda arman `Conversacion` sin él, y
 * un server sin la migración del bot tampoco lo trae) devuelve `null`: la
 * ausencia de dato NO es «el bot la vio fría». Y un motivo que el front no
 * conoce —el enum de escaladas crece del lado del server— cae en la lectura
 * genérica, nunca en un throw y nunca en un motivo parecido.
 *
 * El color y la forma viven en el componente, igual que en `cliente.ts`: acá se
 * decide QUÉ se dice, no cómo se ve.
 */

export type TonoBot = 'escalada' | 'caliente';

/**
 * Los seis motivos de escalada del server (`bot/acciones.ts` · `EscaladaMotivo`),
 * dichos como los diría una persona. El `Record` es parcial a propósito: lo que
 * llega es texto de otro proceso, no un tipo compartido, y este archivo tiene que
 * poder leer una fila escrita por un server más nuevo que él.
 */
const LECTURA_ESCALADA: Record<string, string> = {
  por_cerrar: 'Listo para cerrar',
  pidio_humano: 'Pidió una persona',
  pregunto_si_es_bot: 'Preguntó si es un bot',
  sin_respuesta_en_catalogo: 'Preguntó algo que no sabe',
  frustrado: 'Se está molestando',
  error_bot: 'El bot falló',
};

export interface MarcaBot {
  tono: TonoBot;
  /** Lo que se lee en el chip. Corto: la fila mide 360 px y ya lleva mucho. */
  texto: string;
  /** El `title`, donde entra el detalle sin gastar ancho. */
  titulo: string;
}

/** Lo mínimo que la marca necesita de una fila de la cola. */
export interface FilaConBot {
  bot_escalada?: boolean | null;
  bot_temperatura?: string | null;
  bot_motivo?: string | null;
}

export function marcaDelBot(fila: FilaConBot): MarcaBot | null {
  const motivo = (fila.bot_motivo ?? '').trim();

  if (fila.bot_escalada === true) {
    // La escalada gana siempre, incluso sobre «caliente»: una está esperando a
    // una persona y la otra no. Si el motivo no está en la tabla, el chip dice
    // el hecho que sí se sabe —que el bot se frenó— en vez de callarse.
    const lectura = LECTURA_ESCALADA[motivo];
    return {
      tono: 'escalada',
      texto: lectura ?? 'Pidió ayuda',
      titulo: lectura
        ? `El bot se frenó y espera a una persona: ${lectura.toLowerCase()}`
        : 'El bot se frenó y espera a una persona',
    };
  }

  if (fila.bot_temperatura === 'caliente') {
    return {
      tono: 'caliente',
      texto: 'Caliente',
      // El motivo de `calificar` lo escribe el modelo en texto libre: sirve como
      // detalle en el `title`, nunca como rótulo del chip (puede ser una frase).
      titulo: motivo ? `El bot la ve caliente: ${motivo}` : 'El bot la ve caliente',
    };
  }

  return null;
}

/** El vocabulario de temperaturas del server (`bot/acciones.ts`). */
export type Temperatura = 'caliente' | 'tibio' | 'frio';

const NOMBRE_TEMPERATURA: Record<Temperatura, string> = {
  caliente: 'Caliente',
  tibio: 'Tibio',
  frio: 'Frío',
};

function temperaturaDe(valor: string | null | undefined): Temperatura | null {
  return valor === 'caliente' || valor === 'tibio' || valor === 'frio' ? valor : null;
}

export interface LecturaBot {
  /** `null` = el bot escaló sin llegar a calificar, o calificó algo que este front no conoce. */
  temperatura: Temperatura | null;
  /** Cómo se dice la temperatura. Vacío cuando no hay ninguna. */
  texto: string;
  /**
   * El porqué, ya legible: la traducción del enum si escaló, el texto libre del
   * modelo si sólo calificó. `null` cuando no hay ninguno **o cuando el enum del
   * server creció y este front no conoce el motivo** — mostrarlo crudo
   * («sin_respuesta_en_catalogo») se lee como un error de la app.
   */
  motivo: string | null;
  /** El bot se frenó y espera a una persona. Es el hecho más caro de la tabla. */
  escalada: boolean;
}

/**
 * LO QUE EL BOT DIJO, ENTERO — para una superficie con lugar (la ficha).
 *
 * ══ POR QUÉ NO ALCANZA CON `marcaDelBot` ═════════════════════════════════════
 *
 * Aquélla es para una LISTA y elige uno solo de los hechos, porque en una fila
 * de 360 px entra uno. Y calla `tibio` y `frio` a propósito: fueron 50 de 66
 * conversaciones en un día real, y un chip que aparece en tres de cada cuatro
 * filas no ayuda a decidir a quién atender (la lección de «Pide info», #72).
 *
 * En la ficha la pregunta es otra —ya elegiste a quién mirar— y ahí callar la
 * temperatura tibia no ahorra nada: la esconde. De las 85 calificaciones que la
 * tabla tenía al 7-sep-2026, **34 eran tibias**: un tercio del dato no se veía
 * en ninguna parte de la app, ni abriendo la conversación.
 *
 * ══ LOS DOS HECHOS CONVIVEN, Y ACÁ NO HAY QUE ELEGIR ═════════════════════════
 *
 * `marcaDelBot` hace ganar la escalada sobre «caliente» porque tiene UN chip.
 * Acá se devuelven los dos: una conversación escalada por `por_cerrar` **es**
 * caliente, y perder eso en la ficha sería tirar la mitad del veredicto en el
 * único lugar donde entra completo.
 *
 * ══ LO QUE NO HACE ═══════════════════════════════════════════════════════════
 *
 * No inventa: sin fila devuelve `null`, y **la ausencia de dato no es «el bot la
 * vio fría»**. Un valor que este front no conoce tampoco se acerca al parecido:
 * el vocabulario lo fija el server y puede crecer.
 */
export function lecturaDelBot(fila: FilaConBot): LecturaBot | null {
  const escalada = fila.bot_escalada === true;
  const temperatura = temperaturaDe(fila.bot_temperatura);
  if (!escalada && !temperatura) return null;

  const crudo = (fila.bot_motivo ?? '').trim();
  // Cuando escaló, el motivo es uno de los seis `EscaladaMotivo` y se traduce;
  // cuando sólo calificó, es texto libre del modelo y va tal cual.
  const motivo = escalada ? (LECTURA_ESCALADA[crudo] ?? null) : crudo || null;

  return {
    temperatura,
    texto: temperatura ? NOMBRE_TEMPERATURA[temperatura] : '',
    motivo,
    escalada,
  };
}
