/**
 * QUÉ SE SUGIERE EN LA RESPUESTA PÚBLICA — la elección, pura.
 *
 * ══ POR QUÉ SORTEADA Y NO SIEMPRE LA MISMA ══════════════════════════════════
 *
 * Hasta el 25-ago-2026 el panel prefilleaba UNA sola frase, así que una tarde
 * de cola dejaba la misma línea repetida palabra por palabra debajo de la misma
 * publicación. Dos cosas de eso importan, y ninguna es estética:
 *
 * · **Se lee como un bot.** Quien entra al post ve el mismo texto firmado por
 *   la Página bajo cinco comentarios distintos, y la conversación deja de
 *   parecer una persona contestando.
 * · **Meta trata el comentario idéntico repetido como spam**, que es la clase
 *   de señal que termina limitando el alcance de la Página — el costo no lo
 *   paga el comentario, lo paga la publicación entera.
 *
 * ══ 🔴 NINGUNA PROMETE UN PRIVADO, Y ESO ES UNA GARANTÍA, NO UNA CASUALIDAD ══
 *
 * Esa promesa es la que ADR 0033 existe para custodiar: si el público dice «te
 * escribimos por privado» y el privado falla, queda una mentira publicada bajo
 * la marca del cliente. El server tiene su red para eso —publica
 * `mensajePublicoSinPrivado` en lugar del texto que lo prometía
 * (`server/src/responder/textoPublico.ts`)— pero acá el problema **ni siquiera
 * llega a plantearse**: las tres frases agradecen y no dan por hecho nada, así
 * que son honestas salga o no salga el privado.
 *
 * ⚠️ **«Te acabamos de escribir por mensaje privado» estaba en esta lista y se
 * sacó** (25-ago-2026, a pedido del dueño). Era la sugerencia por defecto desde
 * siempre, y su costo estaba a la vista: el botón de enviar se habilita con
 * sólo el público, así que el camino de MENOR esfuerzo —prefill que promete +
 * privado en blanco + enviar— publicaba la promesa sin que saliera ningún
 * privado. Ahora ese camino no existe.
 *
 * 🔴 **Corolario, y hay que decirlo**: ya no hay una sugerencia para el
 * comentario que PIDE INFORMACIÓN. Quien responda a un «¿cuánto cuesta?» tiene
 * que escribir el público a mano — el sorteo le va a ofrecer un agradecimiento,
 * que para ese caso no sirve. Es deliberado: la cola de esta campaña es de
 * respaldo, no de consultas.
 *
 * ⚠️ **Esto es una SUGERENCIA en una caja editable, no un envío.** Quien
 * responde lee el texto sorteado antes de apretar el botón, y lo cambia si no
 * le calza al comentario. Por eso el sorteo puede ser ciego al contenido: el
 * criterio lo pone la persona, no el azar.
 */

/**
 * Las frases que pueden salir prefilleadas cuando el privado SÍ se puede.
 *
 * ⚠️ No es la lista de cuando no se puede: ésa (`PLANTILLA_PUBLICA_SOLA`, en el
 * panel) invita a escribir por privado y además es el texto de repuesto que se
 * publica si el privado falla. Sortearla rompería las dos funciones a la vez.
 *
 * 🔴 **Ninguna entrada de acá puede prometer un mensaje privado.** Hay un test
 * que lo fija; léelo antes de agregar una.
 */
export const PLANTILLAS_PUBLICAS = [
  '¡Gracias por el respaldo! 🤝 Seguimos trabajando con la convicción de que sí podemos hacer las cosas bien por nuestra región.',
  '¡Un abrazo grande! 🙌 Gracias por acompañarnos en este camino. ¡Sí podemos! 💪',
  '¡Muchas gracias por tus palabras y tu confianza! 💙 Seguimos firmes, trabajando por un solo Áncash.',
] as const;

/**
 * Sortea una frase, **evitando la que se usó recién**.
 *
 * 🔴 **Lo de «evitando» no es un lujo, y con tres opciones importa MÁS que con
 * cuatro.** Un sorteo uniforme sobre tres repite la anterior **una de cada
 * tres veces**, y esa repetición no se ve diluida en el mes: se ve en los DOS
 * comentarios seguidos del mismo post, que es exactamente el lugar donde se
 * nota. Descartar la anterior lleva esa probabilidad a cero sin volver el texto
 * predecible — con tres frases quedan dos candidatas, o sea que sigue habiendo
 * moneda al aire en cada apertura.
 *
 * @param anterior la última que se sugirió, o `null` en el primer comentario.
 * @param azar seam para los tests: devuelve [0, 1). En producción es
 *   `Math.random`, y se inyecta porque una regla que no se puede fijar no se
 *   puede poner en rojo a propósito.
 */
export function elegirPlantillaPublica(
  anterior: string | null = null,
  azar: () => number = Math.random,
): string {
  // Si `anterior` no está en la lista (la editaron a mano, o cambió la lista),
  // `candidatas` queda entera y el sorteo es el normal. No hace falta un `if`:
  // el filtro ya se encarga, y un `length` de 0 sólo pasaría con una lista de
  // un solo elemento — de ahí el respaldo.
  const candidatas = PLANTILLAS_PUBLICAS.filter((p) => p !== anterior);
  if (candidatas.length === 0) return PLANTILLAS_PUBLICAS[0];

  // `Math.min` acota el caso de borde de un `azar()` que devuelva 1: sin él el
  // índice se sale del array y la sugerencia llega `undefined` — una caja
  // vacía, que se lee como que el panel no cargó.
  const i = Math.min(Math.floor(azar() * candidatas.length), candidatas.length - 1);
  return candidatas[i];
}

/**
 * 🔴 **LA ÚLTIMA SUGERIDA VIVE ACÁ Y NO EN UN `useRef` DEL PANEL, y eso se
 * aprendió midiendo en la app viva.**
 *
 * `ResponderPanel` **se desmonta al cerrar el comentario**: `ConversacionActiva`
 * decide qué dibujar con un `if` sobre el tipo de conversación, así que cerrar
 * no es «pasarle `null`», es sacarlo del árbol. Un `useRef` se reinicia con eso,
 * y entonces cada apertura sorteaba con `anterior = null` — o sea uniforme sobre
 * la lista entera, que es exactamente lo que `elegirPlantillaPublica` existe
 * para evitar. **Medido el 25-ago-2026 abriendo el mismo comentario cinco veces: las
 * tres primeras salieron idénticas.**
 *
 * Es un módulo con estado, que este repo mira con desconfianza (candado #13). Se
 * justifica porque lo que hay que recordar es de la SESIÓN y no de ningún
 * componente: «qué le sugerí a esta persona hace un rato» sobrevive a cualquier
 * pantalla que se abra o se cierre en el medio. La regla de al lado sigue siendo
 * pura y es la que tiene los tests; esto es sólo quién guarda el `anterior`.
 */
let ultimaSugerida: string | null = null;

/** Sortea la próxima y la recuerda. Es lo que llama el panel. */
export function siguientePlantillaPublica(azar: () => number = Math.random): string {
  ultimaSugerida = elegirPlantillaPublica(ultimaSugerida, azar);
  return ultimaSugerida;
}

/**
 * Olvida la última, para que un test empiece de cero.
 *
 * ⚠️ Existe porque el estado de módulo se comparte entre los casos de UN MISMO
 * archivo: sin esto, el primer sorteo de un test arrastra lo que dejó el
 * anterior y el caso pasa —o falla— por lo que hizo su vecino.
 */
export function olvidarUltimaPlantilla(): void {
  ultimaSugerida = null;
}
