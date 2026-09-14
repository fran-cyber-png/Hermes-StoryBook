/**
 * EL SEMÁFORO DE VENTAS — qué tan cerca está esta persona de COMPRAR.
 *
 * ══ EL NOMBRE IMPORTA ════════════════════════════════════════════════════════
 *
 * No mide urgencia de atención ni riesgo: mide **intención de compra**. La
 * antigüedad ya tiene su canal (el reloj, el oro de la ventana de Meta — que es
 * intocable y significa SOLO «tiempo que se acaba»). Lo que la vendedora no ve
 * hoy es QUIÉN QUIERE, y eso es lo que esta función responde.
 *
 * Decisión del dueño (9-set-2026), las cuatro en sus palabras:
 *
 *   🟢 verde — prácticamente va a comprar
 *   🟡 ámbar — el limbo: no se sabe aún, pero hay alguna respuesta positiva
 *   ⚪ gris  — no ha respondido, no hay interacción
 *   🔴 rojo  — ya sabemos de por sí que no comprará
 *
 * TODOS LLEGAN GRISES. El color lo pone lo que la persona DICE, no cuándo lo
 * dijo. Un lead de hace 20 minutos que sólo mandó un sticker es gris.
 *
 * ══ LO QUE CAMBIÓ EL 9-SET-2026, Y POR QUÉ (medido) ══════════════════════════
 *
 * La versión anterior daba **3.272 verdes sobre 4.450 conversaciones**. Las
 * razones, contadas:
 *
 *     2.542  «compró»                ← sale del padrón: «es cliente de antes»
 *       660  «nombró un curso»       ← el formulario que llenó alguna vez
 *        24  «preguntó precio»       ← la ÚNICA que habla de ESTA conversación
 *         2  «caliente según el bot»
 *
 * 🔴 **El 79 % de los verdes eran verdes por haber comprado alguna vez.** En una
 * campaña a alumnos eso pinta la lista entera de verde por construcción, sin que
 * nadie haya dicho una palabra — y esconde a los ~24 que sí preguntaron el
 * precio. «Atender siguiente» abría el primer verde de una lista de miles.
 *
 * Los tres cambios, todos en la misma dirección (que la luz hable de ESTA
 * conversación y no del expediente de la persona):
 *
 *   1. **`compró` deja de ser una luz.** Ser cliente de antes no es «va a
 *      comprar». Y el dato no se pierde: lo dice el chip «Cliente» al lado del
 *      nombre (`dominio/cliente.ts`), que ahora también está en la tarjeta del
 *      Pipeline. Antes estaba dicho dos veces y una de las dos mentía.
 *   2. **`nombró un curso` baja a ÁMBAR, y sólo si contestó.** Es el curso del
 *      formulario que llenó hace meses, emparejado por teléfono — una señal
 *      positiva sobre la que no se sabe nada más. Eso es ámbar, no verde.
 *   3. **Un contestador de empresa nunca es un lead de ningún color.** Fuerza
 *      gris antes que cualquier otra señal.
 *
 * ══ PRECEDENCIA: gris forzado > rojo > verde > ámbar > gris ══════════════════
 *
 * Alguien que preguntó precio y DESPUÉS dijo que no es rojo — se deja de
 * invertir tiempo ahí, aunque haya mostrado interés antes.
 *
 * 🔴 **Y AL REVÉS TAMBIÉN, que es lo que faltaba.** El rechazo es un hecho del
 * historial (`bool_or` sobre todos los entrantes) y la luz lo preguntaba
 * primero, así que quien dijo «no me interesa» en julio y preguntó el precio en
 * septiembre quedaba **rojo para siempre** — y «Atender siguiente» NUNCA abre un
 * rojo, o sea que ese lead no lo veía nadie nunca más. Con ocho frases en el
 * diccionario el defecto casi no mordía (2 rojos en 4.450); ampliarlo sin
 * arreglar esto convertía la mejora en una máquina de enterrar leads vivos.
 *
 * Decisión del dueño: **gana la señal más nueva**. Se implementa con
 * `preguntoPrecio`, que NO es un `bool_or`: es el veredicto del ÚLTIMO entrante
 * con texto (`cola/pregunta.ts`, #49). Así que «preguntoPrecio» ya significa «lo
 * más nuevo que dijo con palabras habló de plata», y las dos direcciones salen
 * correctas sin guardar una sola fecha nueva.
 *
 * `origen: 'maquina'` marca que la luz —o la razón que ganó dentro de esa luz—
 * salió del bot o del reloj de inferencias (#792), no de una regla propia
 * derivada de texto. S.2 la dibuja punteada; `undefined` (sin origen) es el
 * default de lo derivado por Hermes mismo, que ya se dibuja lleno.
 *
 * Gemelo SQL: `server/src/cola/semaforoSql.ts`. `tsconfig` separa los dos
 * paquetes (`rootDir`), así que el test de paridad no puede importar ESTE
 * archivo — importa su copia server-side, `server/src/cola/semaforo.ts`, con el
 * mismo cuerpo. Es el mismo patrón que `src/dominio/curso.ts` frente a
 * `server/src/cursos/precedencia.ts`. Si tocas la regla, toca las DOS.
 */

export type Luz = 'gris' | 'verde' | 'ambar' | 'rojo';
export type OrigenSemaforo = 'persona' | 'maquina';

export interface Semaforo {
  luz: Luz;
  /** El porqué, en palabras — la evidencia de ADR 0095, y lo que se lee en el tooltip. */
  porque: string;
  /** `'maquina'` = viene del bot/LLM y se dibuja punteado. Ausente = derivado y lleno. */
  origen?: OrigenSemaforo;
}

export interface EntradaSemaforo {
  /** La persona escribió alguna vez en esta conversación. */
  hablo: boolean;
  /**
   * Algún entrante dice algo más que un saludo, un sticker o una foto sin
   * texto. Un «hola, info» sigue siendo SIN sustancia: no dijo qué quiere.
   */
  entranteConSustancia: boolean;
  /**
   * El ÚLTIMO entrante con texto preguntó precio o cómo pagar
   * (`cola/pregunta.ts`, nivel 1). **No es un `bool_or`**, y de eso depende la
   * regla de recencia del rojo: ver la precedencia en la cabecera.
   */
  preguntoPrecio: boolean;
  /** Nombró un curso, por interés registrado o formulario (`dominio/curso.ts`). */
  nombroUnCurso: boolean;
  /** Algún entrante rechazó, alguna vez (`cola/dijoQueNo.ts`, historial). */
  dijoQueNo: boolean;
  /** Algún entrante es el contestador de otra empresa (`campana/autoRespuesta.ts`). */
  autoRespuestaDeNegocio: boolean;
  /** Incoherente, spam, u otro idioma sin sentido. */
  incoherente: boolean;
  /** La etapa efectiva es `perdido` (declarado, no derivado del silencio). */
  perdidoDeclarado: boolean;
  /** Lo que el bot o el LLM (#792) calificaron. `null` = sin calificación. */
  botTemperatura: 'caliente' | 'tibio' | 'frio' | null;
  /** Un verde (le pasamos precio) que se enfrió: silencio ≥ 3 días (`senales/enfriamiento.ts`). */
  enfriada: boolean;
}

/** Una razón candidata, con su luz y si viene de una máquina. */
interface Razon {
  luz: Luz;
  porque: string;
  origen?: OrigenSemaforo;
}

/**
 * Las razones posibles, en el orden de PRIORIDAD dentro de su propia luz —no
 * el orden entre luces, que lo decide la precedencia de abajo. Un candidato
 * que no aplica no entra al arreglo.
 */
function razonesCandidatas(e: EntradaSemaforo): Razon[] {
  const razones: Razon[] = [];

  // ── ROJO ──────────────────────────────────────────────────────────────
  // El rechazo rige MIENTRAS sea lo último que dijo. Si después preguntó el
  // precio, la señal nueva le gana: `preguntoPrecio` mira el último entrante
  // con texto, así que esta resta es toda la regla de recencia.
  if (e.dijoQueNo && !e.preguntoPrecio) razones.push({ luz: 'rojo', porque: 'dijo que no' });
  if (e.incoherente) razones.push({ luz: 'rojo', porque: 'escribe incoherencias' });
  if (e.botTemperatura === 'frio') {
    razones.push({ luz: 'rojo', porque: 'frío según el bot', origen: 'maquina' });
  }
  if (e.perdidoDeclarado) razones.push({ luz: 'rojo', porque: 'perdido declarado' });

  // ── VERDE ─────────────────────────────────────────────────────────────
  // Sólo lo que dijo EN ESTA conversación y habla de comprar AHORA. Un verde
  // que se enfrió (precio + silencio ≥ 3 días) ya no es verde: la pregunta de
  // precio sigue siendo cierta, pero `enfriada` es la lectura de esa misma
  // señal cruzada con el silencio, y es la que manda.
  if (e.preguntoPrecio && !e.enfriada) razones.push({ luz: 'verde', porque: PORQUE_DE_PRECIO.pregunto });
  if (e.botTemperatura === 'caliente') {
    razones.push({ luz: 'verde', porque: 'caliente según el bot', origen: 'maquina' });
  }

  // ── ÁMBAR ─────────────────────────────────────────────────────────────
  if (e.enfriada) razones.push({ luz: 'ambar', porque: PORQUE_DE_PRECIO.seEnfrio });
  if (e.botTemperatura === 'tibio') {
    razones.push({ luz: 'ambar', porque: 'tibio según el bot', origen: 'maquina' });
  }
  // El curso sale del formulario de hace meses, no de esta conversación: por sí
  // solo no dice nada. Con una respuesta encima ya es el limbo del dueño.
  if (e.nombroUnCurso && e.hablo) {
    razones.push({ luz: 'ambar', porque: 'nombró un curso y contestó' });
  }
  if (e.hablo && e.entranteConSustancia) {
    razones.push({ luz: 'ambar', porque: PORQUE_DE_RELLENO.contesto });
  }

  return razones;
}

/**
 * ══ LOS TRES PORQUÉS QUE NO DICEN NADA ═══════════════════════════════════════
 *
 * Son el estado de ENTRADA de cada luz —lo que se dice cuando no hay ninguna
 * señal que contar— y por eso son los que más se repiten. Medido en producción
 * el 10-sep-2026 sobre las cien primeras tarjetas de cada columna: «contestó,
 * sin decir todavía qué quiere» iba debajo del nombre en el **90 %** de las de
 * «Saben el precio» y «Contestaron», y «llegó, todavía no contestó» en el 89 %
 * de «Nunca contestaron». Un renglón idéntico en miles de tarjetas no explica
 * nada: es la misma lección de ADR 0016 con el preview de nuestra plantilla.
 *
 * Viven con nombre para que la tarjeta pueda CALLARLOS (`porqueDestacable`) sin
 * copiar el texto: si mañana la frase cambia acá, la regla sigue reconociéndola.
 * ⚠️ El `porque` sigue viajando y sigue en el tooltip de la ficha — lo único
 * que cambia es que la LISTA no lo repite.
 */
export const PORQUE_DE_RELLENO = {
  contesto: 'contestó, sin decir todavía qué quiere',
  saludo: 'solo saludó, todavía no dijo qué quiere',
  llego: 'llegó, todavía no contestó',
} as const;

/**
 * ══ LOS DOS PORQUÉS QUE HABLAN DE PLATA ══════════════════════════════════════
 *
 * 🔴 **En campaña no se dicen, en ningún caso** (regla del dueño, 13-sep-2026:
 * «no debería decir preguntó precio en ningún caso para campaña»). Es la misma
 * regla que ya callaba «Preguntó precio» en la fila de Mensajes
 * (`FilaConversacion`) y el chip «Precio» en la tarjeta: en campaña no se vende
 * nada, así que un rótulo de precio encima de un simpatizante es de otro negocio.
 *
 * ⚠️ **Se calla la PALABRA, no la luz.** La luz la pone el server
 * (`cola/semaforoSql.ts`) y no sabe de módulos; cambiarla sería tocar la paridad
 * SQL≡TS por un rótulo. Con nombre acá para que la regla de abajo no copie el
 * texto. ⚠️ **Las frases las escribe el SERVER** (`cola/semaforoSql.ts` y su
 * gemelo `cola/semaforo.ts`): el test de paridad de allá cruza esos dos y NO a
 * éste. Lo que ata esta constante con el server es `semaforo.test.ts` («las
 * frases de precio son LAS MISMAS que escribe el server»), que lee sus fuentes.
 */
export const PORQUE_DE_PRECIO = {
  pregunto: 'preguntó precio',
  seEnfrio: 'preguntó precio y se enfrió',
} as const;

/**
 * El porqué que se puede decir en esta pantalla: el mismo, salvo los de precio en
 * campaña, que son `null`. Lo usan la LISTA (en el `title` de la luz, donde los de
 * relleno sí van) y `porqueDestacable`.
 */
export function porqueParaMostrar(
  porque: string | null | undefined,
  { esDeCampana = false }: { esDeCampana?: boolean } = {},
): string | null {
  if (!porque) return null;
  if (esDeCampana && Object.values(PORQUE_DE_PRECIO).includes(porque as never)) return null;
  return porque;
}

/**
 * ¿Vale la pena dibujar este porqué en una LISTA? Sólo cuando cuenta algo que
 * la luz sola no dice: «preguntó precio», «dijo que no», «se enfrió», «es el
 * contestador de otra empresa». Los tres de relleno se callan, y en campaña
 * también los de precio (`porqueParaMostrar`).
 */
export function porqueDestacable(
  porque: string | null | undefined,
  opciones: { esDeCampana?: boolean } = {},
): boolean {
  const decible = porqueParaMostrar(porque, opciones);
  if (!decible) return false;
  return !Object.values(PORQUE_DE_RELLENO).includes(decible as never);
}

const PRIORIDAD_LUZ: readonly Luz[] = ['rojo', 'verde', 'ambar', 'gris'];

export function semaforoDe(e: EntradaSemaforo): Semaforo {
  // EL CONTESTADOR DE OTRA EMPRESA NO ES UN LEAD DE NINGÚN COLOR, y por eso se
  // contesta antes que la precedencia y no adentro de ella: no es que su
  // interés sea bajo, es que del otro lado no hay nadie a quien venderle. Sin
  // esto quedaban pintados de VERDE los que mencionan precio en su saludo
  // automático.
  if (e.autoRespuestaDeNegocio) {
    return { luz: 'gris', porque: 'es el contestador de otra empresa' };
  }

  const razones = razonesCandidatas(e);

  for (const luz of PRIORIDAD_LUZ) {
    const ganadora = razones.find((r) => r.luz === luz);
    if (ganadora) {
      // `origen` se OMITE cuando no aplica —nunca `origen: undefined`—: así el
      // resultado tiene la misma forma (mismas claves presentes) sin importar
      // qué razón ganó, y un `deepEqual` contra un objeto armado a mano (el
      // test de paridad) no distingue «ausente» de «presente pero undefined».
      return ganadora.origen
        ? { luz: ganadora.luz, porque: ganadora.porque, origen: ganadora.origen }
        : { luz: ganadora.luz, porque: ganadora.porque };
    }
  }

  return e.hablo
    ? { luz: 'gris', porque: PORQUE_DE_RELLENO.saludo }
    : { luz: 'gris', porque: PORQUE_DE_RELLENO.llego };
}
