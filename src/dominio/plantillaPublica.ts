/**
 * QUÉ SE SUGIERE EN LA RESPUESTA PÚBLICA — de quién es cada texto, y la elección, pura.
 *
 * ══ 🔴 CADA TEXTO ES DE UN CLIENTE, Y SÓLO SE LE SUGIERE A ESE CLIENTE ═══════
 *
 * Medido en producción el 11-sep-2026, en la Página de Américo (22:45 a 23:07
 * UTC): de 27 respuestas públicas que salieron desde Hermes, 13 llevaban el texto
 * de la Escuela y 14 las frases escritas para Betto, 6 de ellas con «…por un solo
 * Áncash». Ninguna era de Américo. Hasta ese día el panel elegía la sugerencia
 * mirando sólo si se podía el privado: con privado, las frases de Betto para
 * todos; sin privado, el texto de la Escuela para todos.
 *
 * Ahora la lista sale del cliente de la Página del comentario
 * (`paginas_meta.cliente_id`) y del módulo de quien responde, los dos como los
 * contesta `/puede-privado`. **Un cliente sin textos propios —hoy `americo`—
 * abre la caja vacía**: acá no se inventa un texto para nadie. Y si no se sabe de
 * quién es la Página, tampoco se sugiere nada.
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
 * ══ 🔴 NINGUNA DE CAMPAÑA PROMETE UN PRIVADO, Y ESO ES UNA GARANTÍA ═════════
 *
 * Esa promesa es la que ADR 0033 existe para custodiar: si el público dice «te
 * escribimos por privado» y el privado no sale, queda una mentira publicada bajo
 * la marca del cliente. Desde el 11-sep-2026 el server ya no publica el público
 * cuando el privado falla (`server/src/responder/enviarRespuesta.ts`), pero el
 * botón de enviar se habilita con sólo el público: un prefill que prometiera,
 * con la caja privada en blanco, publicaría la promesa igual.
 *
 * ⚠️ **«Te acabamos de escribir por mensaje privado» estaba en la lista y se
 * sacó** (25-ago-2026, a pedido del dueño). Era la sugerencia por defecto desde
 * siempre, y su costo estaba a la vista: el camino de MENOR esfuerzo —prefill
 * que promete + privado en blanco + enviar— publicaba la promesa sin que saliera
 * ningún privado. Ahora ese camino no existe.
 *
 * 🔴 **Corolario, y hay que decirlo**: la campaña no tiene una sugerencia para el
 * comentario que PIDE INFORMACIÓN. Quien responda a un «¿cuánto cuesta?» tiene
 * que escribir el público a mano — el sorteo le va a ofrecer un agradecimiento,
 * que para ese caso no sirve. Es deliberado: la cola de la campaña de Betto es de
 * respaldo, no de consultas.
 *
 * ⚠️ **Esto es una SUGERENCIA en una caja editable, no un envío.** Quien
 * responde lee el texto sorteado antes de apretar el botón, y lo cambia si no
 * le calza al comentario. Por eso el sorteo puede ser ciego al contenido: el
 * criterio lo pone la persona, no el azar.
 */

/** De quién es la Página del comentario, tal como lo contesta `/puede-privado`. */
export interface DeQuienEsLaPagina {
  /** Desde dónde responde quien pregunta: `ventas` es la Escuela. */
  modulo?: 'ventas' | 'campana';
  /** El `paginas_meta.cliente_id` de la Página, o `null` si no está registrada. */
  cliente?: string | null;
}

/**
 * LOS TEXTOS DE CADA CLIENTE, por su `cliente_id` (el slug de `clientes_meta`).
 *
 * 🔴 **Un cliente que no está acá no recibe ninguna sugerencia**, y es a
 * propósito: los textos de un cliente los decide ese cliente, nunca se toman
 * prestados de otro.
 */
export const PLANTILLAS_PUBLICAS_POR_CLIENTE = {
  /**
   * La Escuela: invita a escribir por privado, sin dar por hecho ningún mensaje.
   * ⚠️ Hasta el 11-sep-2026 era además el texto que el server publicaba si el
   * privado fallaba, y por eso salió en la Página de Américo. Esa sustitución ya
   * no existe.
   */
  escuela: [
    'Hola — con gusto. Escríbenos por mensaje privado y te mandamos el programa completo con fechas y precios.',
  ],
  /**
   * La campaña de Betto. 🔴 **Ninguna puede prometer un mensaje privado**: hay un
   * test que lo fija, léelo antes de agregar una.
   */
  betto: [
    '¡Gracias por el respaldo! 🤝 Seguimos trabajando con la convicción de que sí podemos hacer las cosas bien por nuestra región.',
    '¡Un abrazo grande! 🙌 Gracias por acompañarnos en este camino. ¡Sí podemos! 💪',
    '¡Muchas gracias por tus palabras y tu confianza! 💙 Seguimos firmes, trabajando por un solo Áncash.',
  ],
} as const satisfies Record<string, readonly string[]>;

/**
 * EL CLIENTE CUYOS TEXTOS SE SUGIEREN, o `null` si no corresponde ninguno.
 *
 * · **La Escuela** responde desde `ventas`. Las Páginas de Goberna casi nunca
 *   están registradas en `paginas_meta` (14 de 15, `server/src/meta/clientes.ts`)
 *   y la frontera las da por de la Escuela, porque «la frontera es de lo
 *   declarado». En `ventas`, una Página sin cliente es de la Escuela.
 * · **Una campaña** responde desde `campana` y sólo sobre las Páginas de su
 *   cliente. Ahí manda el cliente de la Página, y una Página sin cliente no es de
 *   nadie.
 * · **Si falta cualquiera de los dos datos**, `null`: no se sabe, así que no se
 *   sugiere.
 */
export function clienteDeLasPlantillas({ modulo, cliente }: DeQuienEsLaPagina): string | null {
  if (cliente === undefined) return null;
  if (modulo === 'ventas') return cliente ?? 'escuela';
  if (modulo === 'campana') return cliente;
  return null;
}

/** Las frases que se pueden sugerir sobre esa Página. Vacía = la caja arranca vacía. */
export function plantillasPublicasPara(pagina: DeQuienEsLaPagina): readonly string[] {
  const cliente = clienteDeLasPlantillas(pagina);
  // `Object.hasOwn` y no un índice con `?? []`: un `cliente_id` que se llamara
  // `constructor` encontraría una función heredada de `Object`.
  if (cliente === null || !Object.hasOwn(PLANTILLAS_PUBLICAS_POR_CLIENTE, cliente)) return [];
  return PLANTILLAS_PUBLICAS_POR_CLIENTE[cliente as keyof typeof PLANTILLAS_PUBLICAS_POR_CLIENTE];
}

/**
 * Sortea una frase de `lista`, **evitando la que se usó recién**.
 *
 * 🔴 **Lo de «evitando» no es un lujo, y con tres opciones importa MÁS que con
 * cuatro.** Un sorteo uniforme sobre tres repite la anterior **una de cada
 * tres veces**, y esa repetición no se ve diluida en el mes: se ve en los DOS
 * comentarios seguidos del mismo post, que es exactamente el lugar donde se
 * nota. Descartar la anterior lleva esa probabilidad a cero sin volver el texto
 * predecible — con tres frases quedan dos candidatas, o sea que sigue habiendo
 * moneda al aire en cada apertura.
 *
 * @param lista las frases del cliente (`plantillasPublicasPara`). Vacía = `''`.
 * @param anterior la última que se sugirió, o `null` en el primer comentario.
 * @param azar seam para los tests: devuelve [0, 1). En producción es
 *   `Math.random`, y se inyecta porque una regla que no se puede fijar no se
 *   puede poner en rojo a propósito.
 */
export function elegirPlantillaPublica(
  lista: readonly string[],
  anterior: string | null = null,
  azar: () => number = Math.random,
): string {
  // Sin frases para este cliente, la caja arranca vacía. `''` y no `undefined`:
  // la caja es controlada, y un `undefined` la volvería no controlada.
  if (lista.length === 0) return '';

  // Si `anterior` no está en la lista (la editaron a mano, o es de otro cliente),
  // `candidatas` queda entera y el sorteo es el normal. Un `length` de 0 sólo
  // pasa con una lista de un solo elemento — de ahí el respaldo.
  const candidatas = lista.filter((p) => p !== anterior);
  if (candidatas.length === 0) return lista[0];

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

/** Sortea la próxima para esa Página y la recuerda. Es lo que llama el panel. */
export function siguientePlantillaPublica(pagina: DeQuienEsLaPagina, azar: () => number = Math.random): string {
  const elegida = elegirPlantillaPublica(plantillasPublicasPara(pagina), ultimaSugerida, azar);
  // Una caja vacía no es una sugerencia: no pisa la última de verdad.
  if (elegida) ultimaSugerida = elegida;
  return elegida;
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
