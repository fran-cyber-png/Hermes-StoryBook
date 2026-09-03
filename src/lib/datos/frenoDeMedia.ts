/**
 * EL FRENO DE LA MEDIA — «¿se puede volver a pedir esta URL ahora mismo?».
 *
 * ══ QUÉ VINO A ARREGLAR, MEDIDO ═════════════════════════════════════════════
 *
 * De los 6.233 pedidos diarios a `/api/whatsapp/foto/:telefono` (18-ago-2026,
 * log de nginx de VPS1), **5.472 (88 %) fallan**: 3.581 son 404 y **1.891 son
 * 503**, todos los días, sobre el mismo puñado de números. El front no podía
 * hacer nada mejor porque `blobAutenticado.ts` colapsaba TODO fallo en un
 * `null` (`if (!res.ok) return null`): no había forma de distinguir «ya
 * sabíamos que no tiene foto» de «no se pudo preguntar», así que las dos cosas
 * se reintentaban igual y para siempre.
 *
 * Este módulo es la decisión, y nada más que la decisión: no baja, no toca el
 * DOM, no mira el reloj (el `ahora` se le pasa). El cableado vive en
 * `blobAutenticado.ts`, que es quien traduce el status HTTP a una etiqueta.
 *
 * ══ 🔴 EL 503 NO SE CACHEA, Y ESO ESTÁ BIEN ═════════════════════════════════
 *
 * El server devuelve 503 **a propósito sin guardar nada** (`routes/whatsapp.ts`,
 * el docblock de `/foto/:telefono`): un negativo ahí diría «no tiene foto»
 * durante 7 días sobre un contacto que ni siquiera llegamos a consultar — cada
 * restart del server envenenaría la caché de todo lo que se mirara en ese hueco
 * (hallazgo de la revisión del PR #75). Del lado del cliente vale lo mismo y por
 * el mismo motivo.
 *
 * O sea que el frente es **reintentar MENOS, no dejar de reintentar**. Entre
 * cachear el fallo y pedirlo 88 veces hay un backoff, y confundir las dos cosas
 * rompe la foto de un contacto real cuya línea vuelve a estar montada. Por eso
 * acá hay DOS mecanismos distintos y no uno:
 *
 *   · `no-hay` (404)      → memoria: es un HECHO, y no se vuelve a preguntar.
 *   · `no-se-pudo` (503…) → backoff: es un ESTADO, y se vuelve a preguntar,
 *                            cada vez más espaciado, con techo.
 *
 * ══ 🔴 UN SOLO `ok` SUELTA TODOS LOS FRENOS ═════════════════════════════════
 *
 * El backoff mide tiempo, y lo que arregla un 503 no es el tiempo: es que la
 * línea vuelva a estar montada. Ese hecho lo prueba **cualquier** foto que
 * entre, no la de este contacto — así que un `ok` en una URL borra los frenos de
 * todas. Se eligió hacia ese lado a propósito: con varias líneas, un `ok` en la
 * línea A no prueba que la B esté viva, y limpiar de más hace que se pida de
 * más, que es el lado seguro del error (la regla es reintentar menos, no dejar
 * de reintentar). Un freno que sobrevive a la recuperación sí sería un defecto:
 * dejaría avatares en blanco con la línea andando.
 *
 * ⚠️ Los `no-hay` NO se sueltan ahí: no son un freno, son un dato. Que una foto
 * cargue no dice nada sobre el contacto que no tiene ninguna.
 *
 * ══ ⚠️ EL 401 NO ENTRA, NI AL FRENO NI A LA MEMORIA ═════════════════════════
 *
 * Un 401 es la sesión muerta, y eso no lo arregla el paso del tiempo sino un
 * token nuevo: frenar media hora algo que se destraba en el instante en que la
 * vendedora vuelve a entrar dejaría los avatares en blanco sobre una app que ya
 * anda de nuevo. Y el bucle que el backoff viene a evitar acá no existe — la
 * foto se pide al ABRIR un contacto, no en un poll, y con la sesión muerta el
 * resto de la app ya está dando 401 y `useSesion` echa en la próxima validación
 * de `/api/auth/yo`. Lo que sí importa es que **no se recuerde como «no tiene
 * foto»**: ése era justamente el pecado del `null` único que esto reemplaza.
 *
 * ⚠️ El 400 y el 403 (la frontera de campaña, ADR 0061) sí entran al backoff
 * aunque nunca vayan a andar. Frenar algo permanente no miente: converge al
 * techo y sigue pidiendo de vez en cuando. Inventarles una tercera categoría
 * «esto no va a andar nunca» sería afirmar más de lo que el status dice.
 *
 * ⚠️ Vive en memoria y se pierde al recargar la app, a propósito: recargar es
 * una persona diciendo «prueba de nuevo». Y se limpia al cerrar sesión, como los
 * blobs — lo de una vendedora no lo hereda la siguiente.
 */

/** Cómo terminó una bajada. */
export type ResultadoDeMedia = 'ok' | 'no-hay' | 'no-se-pudo' | 'sin-sesion';

/**
 * De qué status HTTP sale cada etiqueta. Vive acá y no en el hook porque es la
 * mitad del vocabulario que se puede interrogar sin un `fetch` de por medio, y
 * porque es donde se lee al lado de lo que cada etiqueta después significa.
 *
 * ⚠️ **Todo lo que no es 404 ni 401 cae en `no-se-pudo`, incluido el 200 que no
 * llegó a leerse y la red caída.** Es el default correcto: `no-hay` afirma que
 * preguntamos y no hay, y eso solo lo dice el 404 del server —que a su vez solo
 * lo manda después de haberle preguntado a WhatsApp de verdad—. Cualquier otro
 * número es «no se pudo preguntar», que es un estado y no un hecho.
 */
export function etiquetaDeStatus(status: number): Exclude<ResultadoDeMedia, 'ok'> {
  if (status === 404) return 'no-hay';
  if (status === 401) return 'sin-sesion';
  return 'no-se-pudo';
}

/**
 * Qué hacer con una URL ahora mismo.
 *
 * `no-hay` y `esperando` se separan porque significan cosas distintas para
 * quien las lee: el primero es definitivo (ya preguntamos), el segundo es «te
 * digo que no todavía». Colapsarlos en un booleano es exactamente el error que
 * este módulo vino a deshacer.
 */
export type Veredicto = 'pedir' | 'no-hay' | 'esperando';

/**
 * La primera espera tras un fallo. 30 s corta la ráfaga —que es la forma real
 * del problema: el avatar se re-pide en cada montaje del panel, no cada tanto—
 * sin volverse una eternidad para la vendedora que abrió el contacto justo
 * cuando la línea estaba reconectando.
 */
export const ESPERA_BASE_MS = 30_000;

/**
 * El techo. Una hora es el plazo más largo que se puede prometer sin que la
 * foto de un contacto real quede rota toda la tarde: pasado el techo se sigue
 * preguntando, una vez por hora, hasta que la línea vuelva. Y si vuelve antes,
 * el `ok` de cualquier otra foto suelta el freno enseguida.
 */
export const ESPERA_TOPE_MS = 60 * 60_000;

/**
 * Cuánto esperar tras `fallos` fallos seguidos. Duplica desde `ESPERA_BASE_MS`
 * y se planta en `ESPERA_TOPE_MS`: 30 s · 1 m · 2 m · 4 m · 8 m · 16 m · 32 m ·
 * 1 h · 1 h · …
 *
 * Pura y exportada para poder interrogarla sin armar un freno entero — es la
 * única aritmética del módulo y es la que decide si el arreglo alcanza.
 */
export function esperaTrasFallos(fallos: number): number {
  if (fallos <= 0) return 0;
  // Un contador absurdo desborda a Infinity y `Math.min` lo resuelve solo: da el
  // techo. La guarda explícita que había acá era código muerto — lo mostró la
  // verificación en rojo, que no pudo romper el test tocándola.
  return Math.min(ESPERA_BASE_MS * 2 ** (fallos - 1), ESPERA_TOPE_MS);
}

export interface FrenoDeMedia {
  /** ¿Se puede pedir `clave` en `ahora`? */
  consultar(clave: string, ahora: number): Veredicto;
  /** Anotar cómo terminó una bajada de `clave`. */
  anotar(clave: string, resultado: ResultadoDeMedia, ahora: number): void;
  /**
   * Cuántos ms faltan para poder volver a pedir `clave`. 0 si se puede ya.
   * Para diagnóstico y para los tests: la app no necesita el número.
   */
  esperaDe(clave: string, ahora: number): number;
  /**
   * Borra todo lo que se sepa de `clave` — freno y memoria.
   *
   * 🔴 **Es lo que hace que un clic humano le gane al freno.** `useBlobAutenticado`
   * lo llama desde `pedir()`: el botón «reintentar» de un adjunto pesado es un
   * reintento que alguien PIDIÓ, y el freno existe para los que nadie pidió. Sin
   * esto, el arreglo de rendimiento le rompería el botón a la vendedora.
   */
  olvidar(clave: string): void;
  /** Todo a cero. Cierre de sesión. */
  limpiar(): void;
}

export function crearFrenoDeMedia(): FrenoDeMedia {
  /** URLs que ya sabemos que no tienen nada. Es un hecho, no un freno. */
  const sinNada = new Set<string>();
  /** URLs frenadas: cuántas veces falló y desde cuándo corre la espera. */
  const frenadas = new Map<string, { fallos: number; desde: number }>();

  function esperaDe(clave: string, ahora: number): number {
    const freno = frenadas.get(clave);
    if (!freno) return 0;
    const falta = freno.desde + esperaTrasFallos(freno.fallos) - ahora;
    return falta > 0 ? falta : 0;
  }

  function consultar(clave: string, ahora: number): Veredicto {
    if (sinNada.has(clave)) return 'no-hay';
    return esperaDe(clave, ahora) > 0 ? 'esperando' : 'pedir';
  }

  function anotar(clave: string, resultado: ResultadoDeMedia, ahora: number): void {
    if (resultado === 'sin-sesion') return; // ni freno ni memoria: lo arregla el auth
    if (resultado === 'ok') {
      // Un solo ok prueba que se puede preguntar: se sueltan TODOS los frenos.
      // Los `sinNada` no se tocan — eso es un dato, no un freno.
      frenadas.clear();
      return;
    }
    if (resultado === 'no-hay') {
      frenadas.delete(clave); // la pregunta se contestó: ya no hay nada que frenar
      sinNada.add(clave);
      return;
    }
    const previo = frenadas.get(clave);
    frenadas.set(clave, { fallos: (previo?.fallos ?? 0) + 1, desde: ahora });
  }

  function olvidar(clave: string): void {
    sinNada.delete(clave);
    frenadas.delete(clave);
  }

  function limpiar(): void {
    sinNada.clear();
    frenadas.clear();
  }

  return { consultar, anotar, esperaDe, olvidar, limpiar };
}
