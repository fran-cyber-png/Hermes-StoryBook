import { personaEsTelefono } from './canal';
import { conversacionDeTelefono } from './conversacionNueva';
import type { Conversacion } from './conversaciones';
import type { LineaWhatsapp } from './lineas';

/**
 * ══ ¿POR QUÉ LÍNEA LE ESCRIBO? ═════════════════════════════════════════════
 *
 * El botón del Pipeline decía «Abrir en Mensajes» y elegía la línea SOLO: la de
 * la conversación si la había, y para un lead de formulario ninguna — o sea que
 * la tarjeta que existe justamente para *abrir* un chat en frío terminaba en el
 * hilo de solo lectura de Messenger, sin caja donde escribir.
 *
 * Acá vive la decisión, pura: dada una tarjeta y las líneas que el server
 * ofrece, ¿hay algo que elegir, y qué conversación se abre con cada opción?
 *
 * ── LA REGLA DEL SELECTOR, QUE ES LA MISMA DE SIEMPRE ──────────────────────
 * Con UNA sola forma de abrir el chat no se pregunta nada: un selector de un
 * solo elemento no es una elección, es un clic de más antes de cada
 * conversación. Es la misma regla del filtro de líneas de la cola
 * (`dominio/lineas.ts:hayVarias`) y la del chip que no se dibuja con conteo 0.
 *
 * ── QUÉ LÍNEAS SE OFRECEN, Y POR QUÉ NO SE COMPLETAN ACÁ ───────────────────
 * Las que devuelve `GET /api/whatsapp/lineas`, tal cual. Esa lista ya viene
 * recortada por el server con las dos reglas que importan: las que están VIVAS
 * en el gestor (una línea registrada que no arrancó no puede mandar nada) y la
 * frontera de campaña de ADR 0061, que **no es fail-open**. Agregarle acá una
 * línea que el server no ofreció sería reabrir esa frontera desde el navegador,
 * que es exactamente la forma en que se llegó a la auditoría del 17-ago.
 *
 * La ÚNICA entrada que este módulo agrega es «el chat que ya existe», y no
 * nombra ningún número: es la conversación que la vendedora ya tiene delante.
 */

/** Lo que se lee para seguir el hilo que ya existe. Nunca el número de esa línea. */
export const ETIQUETA_HILO_ACTUAL = 'El chat que ya existe';

export interface OpcionDeLinea {
  /**
   * La línea por la que se abriría. `null` sólo cuando el hilo que ya existe no
   * tiene ninguna registrada (la cola sirve `COALESCE(…,'')`, así que una clave
   * terminada en `:` es real).
   */
  numero: string | null;
  /** Lo que se lee en el menú. */
  etiqueta: string;
  /** El hilo YA vive acá: elegirlo es seguir la conversación, no empezar otra. */
  actual: boolean;
  /** Está entre las que el server ofrece — o sea, se puede mandar por ella. */
  viva: boolean;
}

/**
 * ¿ESTA TARJETA YA TIENE UN HILO DETRÁS?
 *
 * 🔴 Es una CUARTA pregunta, y no se contesta con `canal === 'whatsapp'`. Las
 * otras tres —¿el `persona_id` es un teléfono? ¿le pedimos la foto? ¿se le puede
 * mandar algo?— están separadas a propósito en `dominio/canal.ts`, y el docblock
 * de ahí cuenta lo que costó confundirlas. Ésta se contesta con el `tipo`, que es
 * el dato que lo dice: un `lead` entró por `cola/leadsCte.ts` —alguien llenó un
 * formulario y **nadie le escribió nunca**—, así que no hay clave con nada
 * colgando. Un `mensaje` sí, aunque su línea ya no esté corriendo.
 */
function yaHayHilo(c: Pick<Conversacion, 'tipo'>): boolean {
  return c.tipo !== 'lead';
}

/**
 * Las formas distintas de abrir el chat con esta persona. Vacío = ninguna: no es
 * alguien a quien se le pueda escribir por WhatsApp (un comentario de FB/IG, o
 * un chat identificado con un LID en vez de un número).
 */
export function opcionesParaAbrir(
  c: Pick<Conversacion, 'canal' | 'tipo' | 'persona_id' | 'numero_propio'>,
  lineas: LineaWhatsapp[],
): OpcionDeLinea[] {
  // Sin teléfono no hay a dónde mandar: un PSID de Messenger o un `lid-…` es una
  // cadena de dígitos que NO es un número, y armarle una conversación con él
  // abriría el chat de otra persona (`dominio/canal.ts`).
  if (!personaEsTelefono(c.canal, c.persona_id)) return [];

  const vivas: OpcionDeLinea[] = lineas.map((l) => ({
    numero: l.numero,
    etiqueta: l.etiqueta.trim() || l.numero,
    actual: Boolean(c.numero_propio) && l.numero === c.numero_propio,
    viva: true,
  }));

  // La línea del hilo puede no estar entre las ofrecidas —se retiró, no arrancó—
  // y ahí seguir la conversación tiene que seguir siendo posible: es lo que el
  // botón hacía ayer. Va PRIMERA porque es la que conserva el historial.
  if (yaHayHilo(c) && !vivas.some((o) => o.actual)) {
    return [
      { numero: c.numero_propio, etiqueta: ETIQUETA_HILO_ACTUAL, actual: true, viva: false },
      ...vivas,
    ];
  }
  return vivas;
}

/**
 * La conversación que se abre con una opción.
 *
 * ⚠️ Elegir OTRA línea NO mueve el hilo: la clave es
 * `conv:whatsapp:<tel>:<numeroPropio>` (la arma el SQL de la cola, y acá se
 * reusa `conversacionDeTelefono` para no tener una segunda copia — #37). O sea
 * que abre un chat DISTINTO con la misma persona, vacío hasta que alguien
 * escriba. Eso es correcto y es lo que la vendedora pidió: el menú lo dice.
 */
export function conversacionEnLinea(c: Conversacion, opcion: OpcionDeLinea): Conversacion {
  // La de siempre se devuelve TAL CUAL, no rearmada: trae la etapa, el curso, el
  // preview y las señales que la cola ya calculó, y rearmarla los perdería.
  if (opcion.actual) return c;
  return conversacionDeTelefono({
    telefono: c.persona_id ?? '',
    numeroPropio: opcion.numero,
    nombre: c.persona_nombre,
  });
}

/**
 * ══ EL CHAT NUEVO DE MENSAJES — LA MISMA PREGUNTA, SIN HILO DETRÁS ═══════════
 *
 * El panel de «chat nuevo» (`canales/ColaUnificada.tsx`) hacía
 * `const numeroPropio = sesion.telefono` y abría con ESA, sin preguntar: la que
 * el gestor devuelve primera. Es el mismo defecto que el botón del Pipeline
 * tenía antes de `queHacerAlAbrir` —una decisión tomada a espaldas de la
 * vendedora— y muerde igual de tarde: el lead recibe el primer mensaje de su
 * vida desde un número que no reconoce, o peor, desde la línea de una campaña.
 *
 * 🔴 **NO SE PUEDE REUSAR `opcionesParaAbrir` ACÁ, y el motivo importa.** Esa
 * función pregunta `yaHayHilo(c)` para ofrecer «El chat que ya existe» primero.
 * Un número que la vendedora acaba de tipear **no tiene hilo**: ofrecerle esa
 * entrada sería prometerle un historial que no existe, y elegirla abriría una
 * conversación con `numero_propio` vacío. Acá la lista es, siempre, sólo las
 * líneas vivas.
 *
 * ⚠️ **La regla del selector es LA MISMA**: con menos de dos no se pregunta
 * (`dominio/lineas.ts:hayVarias`, el chip que no se dibuja con conteo 0). Un
 * selector de un elemento no es una elección.
 */
export function lineasParaChatNuevo(lineas: LineaWhatsapp[]): OpcionDeLinea[] {
  return lineas.map((l) => ({
    numero: l.numero,
    etiqueta: l.etiqueta.trim() || l.numero,
    // Nada es «la actual»: no hay hilo del que distinguirse.
    actual: false,
    viva: true,
  }));
}


/**
 * POR QUÉ LÍNEA SALE EL CHAT NUEVO — la elegida, o la única, o la de la sesión.
 *
 * 🔴 **FAIL-OPEN, y por eso el último escalón es `deLaSesion`.** Si la lista de
 * líneas no se pudo traer (server viejo, la consulta falló, WhatsApp caído), esto
 * devuelve exactamente lo que el panel hacía ayer. Un selector que no se pudo
 * armar nunca puede dejar a la vendedora sin poder abrir un chat — es el mismo
 * criterio que `queHacerAlAbrir` documenta para «cero opciones».
 *
 * ⚠️ **`elegida` se ignora si ya no está entre las vivas.** El panel queda
 * abierto mientras la vendedora tipea el número, y en ese rato una línea se puede
 * caer: mandar por una que el gestor ya no tiene es un envío que rebota. Se cae a
 * la primera viva, que es lo que el selector va a estar mostrando.
 */
export function lineaDelChatNuevo(
  lineas: LineaWhatsapp[],
  elegida: string | null,
  deLaSesion: string | null,
): string | null {
  const opciones = lineasParaChatNuevo(lineas);
  if (elegida && opciones.some((o) => o.numero === elegida)) return elegida;
  return opciones[0]?.numero ?? deLaSesion;
}

export type QueHacerAlAbrir =
  | { tipo: 'abrir'; destino: Conversacion }
  | { tipo: 'elegir'; opciones: OpcionDeLinea[] };

/**
 * QUÉ PASA AL TOCAR EL BOTÓN. Con menos de dos formas de abrir no se pregunta:
 * se abre. Y «cero opciones» no es un error ni un bloqueo — es un comentario de
 * FB/IG, o WhatsApp caído: ahí se abre lo que la tarjeta ya es, que es
 * exactamente lo que hacía antes de que este menú existiera. **Fail-open**: un
 * selector que no se pudo armar nunca puede dejar a la vendedora sin abrir el
 * chat.
 */
export function queHacerAlAbrir(c: Conversacion, lineas: LineaWhatsapp[]): QueHacerAlAbrir {
  const opciones = opcionesParaAbrir(c, lineas);
  if (opciones.length >= 2) return { tipo: 'elegir', opciones };
  const unica = opciones[0];
  return { tipo: 'abrir', destino: unica ? conversacionEnLinea(c, unica) : c };
}
