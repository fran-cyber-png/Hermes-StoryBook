/**
 * CÓMO SE DIBUJA LA VENTANA DE CONVERSACIÓN — puro, fuera del JSX.
 *
 * El server manda el INSTANTE del cierre (`ventana_cierra`, de `cola/ventana.ts`)
 * y acá se decide qué se lee. Vive afuera del componente por el motivo de
 * siempre: un `if` adentro del JSX no se puede interrogar sobre el caso que
 * todavía no pasó —el minuto antes del cierre, el server viejo que no manda el
 * campo— y esos son justo los que importan.
 *
 * ── LA SEÑAL ES POSITIVA, Y ESO DECIDE EL DISEÑO ──────────────────────────
 * Una ventana CERRADA no dibuja nada **en la cola**. No es un olvido: el plazo es
 * duro solo en la línea de la Cloud API, y en una línea whatsmeow Meta no rechaza
 * nada. Una píldora que dijera «cerrada» sería falsa ahí, y lo que se pierde con
 * esa mentira es una venta que nadie intenta. En la cola se dice a quién SÍ se le
 * puede hablar, nunca a quién no — **y eso no cambia** (ADR 0041).
 *
 * ── LA ENMIENDA, Y POR QUÉ NO CONTRADICE LO DE ARRIBA (ADR 0058) ──────────
 * Lo que la regla de arriba protege es no MENTIR sobre una línea donde el plazo
 * no existe. La fila de la cola no sabe por qué línea va a salir la respuesta;
 * **el composer sí** (`numeroPropio` → `transporte` de `/api/whatsapp/sesion`).
 * Donde se sabe que el plazo es duro, callarlo no es prudencia: es dejar que el
 * mensaje rebote. Por eso `avisoDeComposer` puede decir «cerrada» y
 * `lecturaDeVentana` sigue sin poder — no es la misma pregunta ni el mismo lugar.
 *
 * Lo que lo volvió urgente, medido el 17-ago-2026: los dos únicos envíos manuales
 * fallidos de dos semanas fueron ventana vencida, a 28,3 h y a **24,5 h** del
 * último entrante. El segundo se pasó **por media hora** y nadie tenía cómo
 * saberlo: el aviso no existía y el rechazo llegaba mudo.
 *
 * ── EL ORO, Y DÓNDE TODAVÍA VIVE ────────────────────────────────────────────
 * En esta app el oro significa **tiempo que se acaba** y nada más
 * (`src/index.css`). `UMBRAL_ORO_MS` sigue siendo ese umbral, pero desde el
 * 20-ago-2026 solo lo usa `avisoDeComposer` (el aviso arriba de la caja de
 * escribir): ahí sí importa el matiz fino de «quedan 3 h» porque es el momento
 * de escribir algo. La píldora de la cola/Pipeline (`urgente`, abajo) dejó de
 * usar oro — pasó a rojo, y con un umbral más ancho (ver `UMBRAL_ROJO_MS`).
 *
 * ── LOS TRES COLORES — decisión del dueño, 20-ago-2026 (enmienda del mismo
 * día que introdujo el rojo único) ──────────────────────────────────────────
 * La píldora de «se le puede escribir» pasó de un solo umbral (rojo bajo un
 * día) a una escala de tres: **verde** de 24 h a 12 h, **amarillo** de 11 h a
 * 6 h, **rojo** de 5 h a 1 min. Es la MISMA lectura de `falta` para cualquier
 * canal —WhatsApp (24 h) o un comentario de FB/IG (7 días)—: la función no
 * sabe de canales, solo de cuánto queda, así que un comentario recién llegado
 * (con casi 7 días por delante) se ve verde igual que un WhatsApp recién
 * escrito, y los dos convergen a la misma escala en sus últimas 24 h.
 */

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** Debajo de esto el AVISO DEL COMPOSER se dibuja en oro: queda menos de una mañana. */
export const UMBRAL_ORO_MS = 3 * HORA;

/** A partir de acá (inclusive) la PÍLDORA de la cola/Pipeline se pinta VERDE. */
export const UMBRAL_VERDE_MS = 12 * HORA;

/** A partir de acá (inclusive) y debajo del verde, AMARILLO. Debajo de esto, ROJO. */
export const UMBRAL_AMARILLO_MS = 6 * HORA;

export type ColorVentana = 'verde' | 'amarillo' | 'rojo';

/** La escala de los tres colores, pura: 24h→12h verde · 11h→6h amarillo · 5h→1min rojo. */
export function colorDeVentana(faltaMs: number): ColorVentana {
  if (faltaMs >= UMBRAL_VERDE_MS) return 'verde';
  if (faltaMs >= UMBRAL_AMARILLO_MS) return 'amarillo';
  return 'rojo';
}

/**
 * ══ ¿EL PLAZO ES DURO EN ESTA LÍNEA? ════════════════════════════════════════
 *
 * 🔴 **La cuenta regresiva sólo significa algo donde hay algo que la haga
 * cumplir.** En la Cloud API, pasadas las 24 h del último entrante Meta
 * RECHAZA el mensaje (error 131047) — el plazo existe y se paga con un envío
 * que rebota. En whatsmeow no hay ningún rechazo: el riesgo de escribirle a
 * alguien que se enfrió es el BAN, que no tiene reloj. Una píldora que dice
 * «quedan 4 h» sobre una línea whatsmeow promete un vencimiento que no ocurre.
 *
 * ⚠️ ADR 0041 razonó exactamente esto y sacó media conclusión: prohibió decir
 * «cerrada» en la cola *porque sería falso en whatsmeow*, y dejó pasar el
 * «quedan 4 h», que es la misma falsedad dicha en positivo. Esto cierra ese
 * hueco. Reportado por el dueño el 22-ago-2026: «en wspp de whatsmeow no
 * importa lo de las 24 horas, no les debería salir».
 *
 * 🔴 **`undefined` es DURO, y ahí está todo el filo del fail-open.** Tres casos
 * reales caen en «no sé el transporte» y en los TRES el plazo sí existe:
 *
 *   1. **Los DM de Messenger y de Instagram.** Son `tipo = 'mensaje'` con
 *      `numero_propio` NULL (`server/src/cola/consultarCola.ts`, el comentario
 *      del brazo de mensajes lo dice), así que nunca van a encontrar línea — y
 *      su ventana de 24 h es la de Meta, dura de verdad. Con `undefined`
 *      cerrando, perderían la píldora justo donde importa.
 *   2. **El primer render de cada arranque.** `lineas-whatsapp` NO está en
 *      `PERSISTIBLES` (`lib/datos/persistencia.ts`), así que `useLineas`
 *      arranca en `[]` y el transporte de TODA fila es desconocido por un
 *      instante. Cerrando ahí, las píldoras parpadearían en cada apertura.
 *   3. **Una línea retirada del gestor.** `GET /api/whatsapp/lineas` sirve las
 *      VIVAS; una conversación de una línea apagada conserva su hilo y no
 *      encuentra su transporte.
 *
 * O sea: **se esconde sólo cuando sabemos que sobra**, nunca cuando no sabemos.
 * Equivocarse hacia «duro» repite lo de hoy; hacia «blando» borra un plazo real.
 *
 * ══ 🔴 POR QUÉ NO ES `avisoDeComposer` CON OTRO NOMBRE ══════════════════════
 *
 * Las dos preguntas se parecen y las dos comparaciones son distintas A
 * PROPÓSITO — colapsarlas rompe una de las dos:
 *
 *   · `avisoDeComposer` pregunta **¿AFIRMO que está cerrada?** y exige
 *     `transporte === 'cloud-api'`. Es una afirmación fuerte arriba de la caja
 *     de escribir: sólo se hace donde hay certeza, y un server viejo NO avisa.
 *   · `plazoDuro` pregunta **¿ESCONDO la cuenta regresiva?** y sólo dice que no
 *     con `transporte === 'whatsmeow'`. Es una resta: sólo se hace donde hay
 *     certeza de que sobra.
 *
 * Las dos son conservadoras, en direcciones OPUESTAS, porque el error caro es
 * distinto en cada una: allá es afirmar de más, acá es borrar de más. Con
 * `undefined` la primera calla y la segunda dibuja — y las dos aciertan.
 * `ventana.test.ts` fija esa asimetría; si alguien las unifica, se pone rojo.
 */
export function plazoDuro(transporte: string | null | undefined): boolean {
  return transporte !== 'whatsmeow';
}

export interface LecturaVentana {
  /** Lo que se lee en la píldora: «45 min», «6 h», «3 d». */
  texto: string;
  /** Verde 24h→12h · amarillo 11h→6h · rojo 5h→1min. */
  color: ColorVentana;
  /** El texto largo del `title`, que es donde se explica el plazo. */
  ayuda: string;
}

/**
 * Cuánto falta, en criollo. **Redondea para ABAJO** a propósito: con 6 h 50 min
 * dice «6 h». Un redondeo para arriba prometería tiempo que no hay, y el error
 * que importa acá es el que llega tarde. Nunca dice «0 min» — el último minuto
 * sigue siendo un minuto.
 */
export function cuantoFalta(ms: number): string {
  if (ms >= DIA) return `${Math.floor(ms / DIA)} d`;
  if (ms >= HORA) return `${Math.floor(ms / HORA)} h`;
  return `${Math.max(1, Math.floor(ms / MINUTO))} min`;
}

/**
 * QUÉ DICE LA PÍLDORA, o `null` si no se dibuja nada.
 *
 * `null` en los tres casos que se ven igual en pantalla y son distintos abajo, y
 * está bien que se vean igual: **la ausencia de señal no afirma nada**.
 *   · la ventana está cerrada (se dice a quién sí, no a quién no);
 *   · esta conversación no tiene ventana (un comentario de un canal sin plazo);
 *   · el server no manda el campo todavía (N4 va solo, N5 es un botón: hay una
 *     ventana de deploy donde el front nuevo habla con el server viejo).
 */
export function lecturaDeVentana(
  ventanaCierra: string | null | undefined,
  ahora: Date,
  /**
   * ¿Hay un plazo que se cumpla en la línea de esta conversación?
   * **El default es `true`** — ver `plazoDuro`: la ausencia de dato nunca
   * esconde una cuenta regresiva que podría ser cierta.
   */
  hayPlazo = true,
): LecturaVentana | null {
  if (!ventanaCierra) return null;
  /**
   * Sin plazo no hay cuenta regresiva que dibujar. Y no se pierde información:
   * «hace cuánto escribió» ya lo dice el otro reloj de la misma fila, en tinta
   * neutra y sin prometer ningún vencimiento. Lo único que se va es la promesa.
   */
  if (!hayPlazo) return null;

  const cierra = new Date(ventanaCierra).getTime();
  // Una fecha que no se puede leer no inventa una cuenta regresiva.
  if (Number.isNaN(cierra)) return null;

  const falta = cierra - ahora.getTime();
  if (falta <= 0) return null;

  return {
    texto: cuantoFalta(falta),
    color: colorDeVentana(falta),
    ayuda: `Se le puede escribir: la ventana cierra en ${cuantoFalta(falta)}`,
  };
}

/** Qué le decimos a quien está por escribir. `null` = nada, y es el default. */
export type AvisoDeComposer = {
  /** `cerrada` es un hecho consumado; `por-cerrar` todavía se puede aprovechar. */
  clase: 'cerrada' | 'por-cerrar';
  texto: string;
} | null;

/**
 * EL AVISO ARRIBA DE LA CAJA DE ESCRIBIR (ADR 0058).
 *
 * ── AVISA, NO BLOQUEA — y la razón no es estilo ──────────────────────────
 * El cierre se calcula sobre el último entrante que Hermes CONOCE. Si la ingesta
 * se perdió un mensaje —ya pasó—, Hermes cree cerrada una ventana que está
 * abierta, y un bloqueo le impediría contestar a alguien que sí podía recibir.
 * Un aviso que a veces sobra cuesta una línea de más; un bloqueo que a veces
 * sobra cuesta la venta. **La garantía nunca es el front**: quien rechaza es
 * Meta, y ahora eso se lee en la burbuja (`whatsapp/motivoEntrega.ts`).
 *
 * ── SOLO EN LA LÍNEA DONDE EL PLAZO ES DURO ──────────────────────────────
 * `cloud-api` y nada más. En `whatsmeow` Meta no rechaza por ventana (el riesgo
 * ahí es el ban, que es otra conversación) y en `falso` no se manda a nadie.
 * ⚠️ **Un `transporte` ausente es un server viejo y NO avisa**: es preferible
 * quedarse como antes del frente a inventar una prohibición que quizá no rige.
 */
export function avisoDeComposer(
  ventanaCierra: string | null | undefined,
  transporte: 'whatsmeow' | 'cloud-api' | 'falso' | undefined,
  ahora: Date,
): AvisoDeComposer {
  if (transporte !== 'cloud-api') return null;
  if (!ventanaCierra) return null;

  const cierra = new Date(ventanaCierra).getTime();
  // Una fecha ilegible no autoriza a afirmar nada, en ninguno de los dos sentidos.
  if (Number.isNaN(cierra)) return null;

  const falta = cierra - ahora.getTime();
  if (falta <= 0) {
    return {
      clase: 'cerrada',
      texto:
        'Pasaron más de 24 h desde su último mensaje: WhatsApp va a rechazar lo que escribas acá. Solo entra una plantilla aprobada.',
    };
  }
  if (falta < UMBRAL_ORO_MS) {
    // Se nombra el plazo, no solo el reloj: «queda 1 h» no dice qué se cierra ni
    // qué pasa después, y eso es justo lo que nadie sabía.
    return {
      clase: 'por-cerrar',
      texto: `Queda ${cuantoFalta(falta)} de la ventana de 24 h. Después solo entra una plantilla aprobada.`,
    };
  }
  return null;
}

/**
 * ══ QUÉ MIDE EL «HACE N HORAS» DE LA FILA — y por qué hay que decirlo ══════
 *
 * 🔴 La fila de la cola dibuja DOS RELOJES pegados y los dos hablan en horas:
 * la píldora de la ventana («34 min») y este «hace 23 horas». El dueño los
 * reportó el 22-ago-2026 como datos desincronizados. **No lo están** — suman
 * ~24 h por construcción, porque la píldora cuenta lo que FALTA para que se
 * cierre la ventana y esto cuenta lo que PASÓ desde la referencia. Pero que
 * hagan falta dos párrafos para explicarlo ES el defecto.
 *
 * Y hay una segunda vuelta que nadie puede adivinar mirando: **la referencia
 * cambia de significado según si le contestamos** (`cola/urgenciaSql.ts`,
 * `referenciaSql`):
 *
 *   · sin responder → el último mensaje de ELLOS. Ahí los dos relojes suman
 *     exactamente 24 h, y por eso «12 h» + «hace 12 horas» se ve prolijo.
 *   · respondida    → NUESTRO último mensaje. Ahí suman menos de 24 h, y por
 *     eso «11 h» + «hace 12 horas» da 23 y parece un error de un hora.
 *
 * Se dice en el `title` y no en la fila: es la explicación de un dato, no un
 * dato más — meterla en el renglón le sacaría ancho al nombre, que es lo que
 * este mismo rediseño acaba de recuperar abreviando el canal.
 */
export function ayudaDeAntiguedad(respondida: boolean | undefined): string {
  return respondida
    ? 'Hace cuánto le contestaste tú (no desde que escribió esta persona)'
    : 'Hace cuánto te escribieron y todavía no contestas';
}
