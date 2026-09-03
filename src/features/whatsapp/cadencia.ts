// `intervaloConStream` es tan pura como este módulo —cero imports en
// `lib/datos/latido.ts`—, así que traerla no arrastra `cliente.ts` ni el
// token (ver el docblock de `esLineaQueNoCorre`, más abajo).
import { intervaloConStream } from '../../lib/datos/latido';

/**
 * CADA CUÁNTO SE VUELVE A PEDIR EL HILO — y por qué el poll ya no es la fuente.
 *
 * ══ LO QUE ESTABA MAL, MEDIDO EN PRODUCCIÓN EL 19-AGO-2026 ═════════════════
 *
 * `useConversacionWa` pedía el hilo cada **5 s fijos** mientras hubiera una
 * conversación abierta. El 18-ago eso fueron **41.973 pedidos**, de los cuales
 * **41.429 (98,8 %) contestaron 304**. Y un 304 no es gratis: el ETag es el
 * hash del cuerpo, así que la consulta corre entera y recién al final se
 * descubre que no cambió nada.
 *
 * Peor: **19.234 de esos pedidos (46 %) son cinco conversaciones de líneas
 * apagadas con DIEZ mensajes entre todas**. El campeón, `989270836`, se pidió
 * **6.644 veces para un solo mensaje**, en una línea muerta hacía 28 días.
 *
 * ══ POR QUÉ SE PUEDE BAJAR: EL SSE ES LA FUENTE ════════════════════════════
 *
 * Verificado el 19-ago-2026 leyendo el código: `whatsapp/repositorioDrizzle.ts`
 * emite al bus de tiempo real por **cualquier** mensaje nuevo —entrante,
 * saliente o simulado— y es el ÚNICO punto donde se guarda uno; los dos
 * transportes pasan por ahí. `lib/datos/tiempoReal.ts` traduce ese evento a una
 * invalidación del hilo abierto. **Para los mensajes, el poll es la red, no la
 * fuente.**
 *
 * ══ 🔴 Y DESDE EL 22-AGO-2026, EL ESCALÓN FRÍO YA ES STREAM-AWARE ═══════════
 *
 * Hasta acá el SSE **no cubría los ✓✓ de la Cloud API**: whatsmeow sí los emite
 * (`server/src/whatsapp/wiring.ts`, `if (filas > 0) emitirRT(...)`), pero el
 * webhook de la Cloud API aplicaba el recibo y no avisaba a nadie, así que en
 * `51984429504` —la única línea que trae leads— el único que hacía aparecer
 * el ✓✓ era este poll, y 60 s era un TECHO y no una preferencia.
 *
 * `server/src/entrega/avisoDebounced.ts` cierra ese hueco (docs/plan-borrar-
 * -el-polling.md §6 PR 4): el webhook ahora avisa por el bus, agrupado por
 * conversación para que sent→delivered→read no tripliquen el fan-out. Con el
 * push cubriendo también los ✓✓, el escalón frío se espacia a 5 min con el
 * stream vivo — la MISMA red que el resto de los polls de la raíz — y se
 * queda en 60 s sin stream, el ritmo de siempre.
 *
 * ══ ⚠️ LOS ESCALONES VIVO Y TIBIO NO CAMBIAN ════════════════════════════════
 *
 * Son baratos (5 s y 15 s) y son lo que hace que un chat que está pasando
 * AHORA no dependa de nada — ni del push, ni de si alguien más lo está
 * mirando. Sólo el frío, que es la red de lo que ya no se mueve, se beneficia
 * de espaciarse cuando hay algo mejor cubriendo el hueco.
 *
 * ══ ⚠️ Y DEGRADA HACIA MÁS FRECUENTE, NUNCA HACIA MENOS ════════════════════
 *
 * Sin `data`, con una fecha que no se entiende o con una fecha del futuro, el
 * intervalo es el más corto de los tres. Un hilo que se refresca de más cuesta
 * un pedido de 21 ms; uno que se refresca de menos le esconde a la vendedora el
 * mensaje que está esperando.
 */

/** Recién escrito: la conversación está pasando AHORA. */
export const CADENCIA_HILO_VIVO_MS = 5_000;
/** De hace un rato: la vendedora sigue en esta conversación, pero no es un ping-pong. */
export const CADENCIA_HILO_TIBIO_MS = 15_000;
/**
 * Frío, o desconocido — sin stream. Con el stream vivo, `intervaloDelHilo`
 * lo espacia a `RED_CON_STREAM_MS` (5 min): los ✓✓ de la Cloud API ya avisan
 * por el bus (`entrega/avisoDebounced.ts`), así que este número deja de ser
 * el único camino para que aparezca un tilde.
 */
export const CADENCIA_HILO_FRIO_MS = 60_000;

/** Hasta acá el hilo se considera vivo. */
export const HILO_VIVO_MS = 2 * 60_000;
/** Hasta acá, tibio. */
export const HILO_TIBIO_MS = 60 * 60_000;

/**
 * Cuánto esperar hasta volver a pedir el hilo, en milisegundos.
 *
 * `ultimoMensajeEn` es el `occurred_at` del ÚLTIMO mensaje del hilo (el server
 * lo sirve ASC, así que es `mensajes.at(-1)`). `null`/`undefined`/basura → el
 * escalón más rápido. `vivo` es el latido del stream (`lib/datos/latido.ts`):
 * sólo afecta al escalón FRÍO — vivo y tibio son fijos (ver el docblock de
 * arriba).
 *
 * Vive fuera del hook, pura y con test, por lo mismo que `ritmoDePolling` en
 * `miLinea.ts`: adentro de la opción de `useQuery` esta decisión no se puede
 * interrogar sobre el caso que todavía no pasó.
 */
export function intervaloDelHilo(
  ultimoMensajeEn: string | Date | number | null | undefined,
  ahora: number | Date,
  vivo: boolean,
): number {
  const cuando = enMilisegundos(ultimoMensajeEn);
  const referencia = enMilisegundos(ahora);
  if (cuando === null || referencia === null) return CADENCIA_HILO_VIVO_MS;
  const transcurrido = referencia - cuando;
  // Negativo = el reloj del server va adelante del nuestro. Se lee como
  // «recién», que es la lectura que degrada hacia MÁS frecuente.
  if (transcurrido < HILO_VIVO_MS) return CADENCIA_HILO_VIVO_MS;
  if (transcurrido < HILO_TIBIO_MS) return CADENCIA_HILO_TIBIO_MS;
  return intervaloConStream(vivo, CADENCIA_HILO_FRIO_MS);
}

/**
 * Un instante en milisegundos, o `null` si no se entiende.
 *
 * Una fecha ilegible tiene que caer en `null` —y de ahí al escalón más
 * rápido—, nunca en `NaN`: con `NaN` toda comparación da `false` y el hilo se
 * iría solo al escalón más LENTO, que es exactamente al revés de la regla.
 */
function enMilisegundos(valor: string | Date | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  const ms = typeof valor === 'number' ? valor : new Date(valor).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * CADA CUÁNTO SE REPREGUNTA EL ESTADO DE LA LÍNEA, y cuándo se deja de preguntar.
 *
 * ══ LO MEDIDO ═════════════════════════════════════════════════════════════
 *
 * `GET /api/whatsapp/sesion` costaba **58.429 pedidos el 18-ago** (10 s fijos ×
 * ~6 observadores montados a la vez) y **19.313 de ellos terminaron en 404** —
 * el front preguntaba por líneas que el gestor no monta y no dejaba de
 * preguntar nunca.
 *
 * ══ EL 404 ES UNA RESPUESTA ESTABLE, NO UN FALLO TRANSITORIO ═══════════════
 *
 * `server/src/routes/whatsapp.ts` contesta `404 {message:'esa línea no está
 * corriendo'}` cuando `gestorWhatsapp().de(numeroPropio)` no encuentra la
 * línea. Eso no cambia solo: cambia cuando alguien monta la línea, y **cuando
 * eso pasa el server emite un evento `estado` por el bus**, que
 * `lib/datos/tiempoReal.ts` traduce a una invalidación de `['wa','sesion']`.
 * O sea que hay una red explícita: no hace falta martillar.
 *
 * ⚠️ **`refetchOnWindowFocus` está APAGADO globalmente** (`lib/datos/cliente.ts`),
 * así que «al volver a la pestaña se refresca solo» es FALSO en esta app. La
 * única red que queda al congelar el poll es la invalidación del SSE — por eso
 * `tiempoReal.ts` la dispara también **al reconectar** el stream, y no sólo al
 * recibir un `estado`.
 *
 * ══ 🔴 Y CON EL STREAM VIVO, 5 MINUTOS — NO SE PIERDE NADA (docs/plan-borrar-el-polling.md §6 PR 1) ══
 *
 * El poll de 60 s ya era la red **por escrito** del bloque de arriba: la
 * fuente es el evento `estado`. Este número es sólo lo que queda cuando el
 * push no está — con el stream vivo, la red se espacia a 5 minutos como el
 * resto de los polls de la raíz.
 */
export const CADENCIA_SESION_MS = 60_000;

/**
 * ¿Este error es «esa línea no está corriendo»?
 *
 * Se pregunta por el `status` con tipado de pato y no con `instanceof ErrorApi`
 * a propósito: así este módulo no arrastra `lib/datos/cliente.ts` (que importa
 * la config y el token) y se puede testear sin entorno. `ErrorApi` cumple la
 * forma; cualquier otra cosa cae en `false`.
 */
export function esLineaQueNoCorre(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { status?: unknown }).status === 404
  );
}

/**
 * Cuánto esperar hasta repreguntar el estado de la línea, o `false` para no
 * volver a preguntar. Un 404 congela el poll **antes** de mirar el stream —
 * ninguna cantidad de latido lo revive, porque lo que lo revive es el evento
 * `estado` que dispara el montaje de la línea (ver el docblock de arriba)—;
 * **cualquier otro error sigue repreguntando**, porque un 503 o una red caída
 * sí se arreglan solos. `vivo` compone con eso: 5 minutos con el stream, el
 * ritmo de siempre sin él (`intervaloConStream`, `lib/datos/latido.ts`).
 */
export function intervaloDeLaSesion(error: unknown, vivo: boolean): number | false {
  return esLineaQueNoCorre(error) ? false : intervaloConStream(vivo, CADENCIA_SESION_MS);
}
