/**
 * DE QUÉ ESTÁ HECHO UN COMENTARIO — la clasificación, pura.
 *
 * Fase 5 del rediseño (25-ago-2026): la pantalla tiene que adaptar la
 * presentación al contenido, y para eso primero hay que poder nombrarlo.
 *
 * ══ POR QUÉ «SÓLO EMOJIS» ES UNA CLASE APARTE ═══════════════════════════════
 *
 * Porque un «😂😂😂» en cuerpo 16, alineado a la izquierda como un párrafo, se
 * lee como un error de renderizado — y en la cola de una campaña esa clase de
 * comentario es de las más frecuentes. Facebook y Messenger los agrandan, y la
 * fase 9 pide justamente aprovechar los patrones que la gente ya conoce.
 *
 * ══ 🔴 POR QUÉ NO ES `/\p{Emoji}/u` A SECAS ═════════════════════════════════
 *
 * Esa propiedad de Unicode es **más ancha de lo que su nombre promete**: los
 * dígitos `0`–`9`, el `#` y el `*` la cumplen, porque son la base de los emojis
 * de teclado (`1️⃣`). Con ella, un comentario que dice **«2»** —o «10», o un
 * número de teléfono— se dibujaría gigante y centrado.
 *
 * Lo que sí sirve es `\p{Extended_Pictographic}`, que es la propiedad para «esto
 * es un pictograma» y NO incluye los dígitos. Alrededor de ella hay que dejar
 * pasar lo que compone un emoji sin ser uno: los modificadores de tono de piel,
 * los selectores de variación, el ZWJ que pega las familias (`👨‍👩‍👧`) y las
 * banderas (que son pares de letras regionales).
 *
 * ⚠️ **El espacio en blanco NO cuenta**, así que «😂 😂» sigue siendo sólo
 * emojis. Pero la puntuación sí: «😂!» es texto, porque en cuanto hay algo que
 * leer, agrandarlo lo vuelve ilegible.
 */

export type ClaseDeComentario = 'vacio' | 'emoji' | 'texto';

/**
 * Lo que puede aparecer adentro de un emoji sin ser un pictograma:
 *
 * · `️`/`︎` — selectores de variación (dibujo vs. texto).
 * · `‍` — ZWJ, el pegamento de `👨‍👩‍👧` y `🧑‍💻`.
 * · `\u{1F3FB}`–`\u{1F3FF}` — los cinco tonos de piel.
 * · `\u{1F1E6}`–`\u{1F1FF}` — letras regionales: las banderas son pares de ellas.
 * · `\u{E0020}`–`\u{E007F}` — etiquetas, para las banderas de subdivisión (🏴󠁧󠁢󠁳󠁣󠁴󠁿).
 */
const ACOMPANANTES = /[︎️‍\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u{E0020}-\u{E007F}]/u;

const PICTOGRAMA = /\p{Extended_Pictographic}/u;

/**
 * 🔴 UNA BANDERA NO TIENE NINGÚN PICTOGRAMA, y eso rompe la prueba obvia.
 *
 * `🇵🇪` son DOS letras indicadoras regionales (`\u{1F1F5}\u{1F1EA}`), y esas no
 * cumplen `Extended_Pictographic` — ninguna de las dos. Con «tiene que haber al
 * menos un pictograma» como evidencia, un comentario que es sólo una bandera se
 * clasificaba como TEXTO. Lo atrapó el test antes de que llegara a la pantalla.
 */
const REGIONAL = /[\u{1F1E6}-\u{1F1FF}]/u;

/** ¿Este carácter es parte de un emoji (o un espacio, que no cuenta)? */
function esDeEmoji(caracter: string): boolean {
  if (caracter.trim() === '') return true;
  return PICTOGRAMA.test(caracter) || ACOMPANANTES.test(caracter);
}

/**
 * Cómo hay que dibujar este comentario.
 *
 * ⚠️ **Se recorre por PUNTO DE CÓDIGO** (`[...texto]`), no por índice: un emoji
 * ocupa dos unidades en una cadena de JavaScript, y recorrerlo con `charAt`
 * partiría el par sustituto en dos mitades que no son nada — cada una fallaría
 * la prueba y todo emoji se clasificaría como texto.
 */
export function claseDeComentario(texto: string | null | undefined): ClaseDeComentario {
  const limpio = (texto ?? '').trim();
  if (!limpio) return 'vacio';

  const caracteres = [...limpio];
  // La evidencia de que esto es un emoji: un pictograma, o una letra regional
  // (que es de lo único que están hechas las banderas).
  const hayEmoji = caracteres.some((c) => PICTOGRAMA.test(c) || REGIONAL.test(c));
  if (!hayEmoji) return 'texto';

  return caracteres.every(esDeEmoji) ? 'emoji' : 'texto';
}

/**
 * ¿Cuánto se agranda? Tres emojis se leen bien grandes; veinte no entran, y
 * agrandarlos rompería el alto de la tarjeta que la fase 11 pide cuidar.
 *
 * El corte en 8 sale de mirar los comentarios reales de la campaña: los de
 * aplauso y corazón vienen de a uno a cinco, y las ristras largas son la
 * excepción — ahí se dibujan como texto normal, que sigue siendo legible.
 */
export function emojisQueEntranGrandes(texto: string): boolean {
  const caracteres = [...texto.trim()];
  const pictogramas = caracteres.filter((c) => PICTOGRAMA.test(c)).length;
  // Las banderas se cuentan por PARES: sin esto, veinte banderas dan cero
  // pictogramas y entrarían «grandes» — que es el caso que el tope evita.
  const banderas = Math.floor(caracteres.filter((c) => REGIONAL.test(c)).length / 2);
  return pictogramas + banderas <= 8;
}
