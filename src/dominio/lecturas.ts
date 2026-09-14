import type { Confianza, OrigenDeAfirmacion } from './dimensiones';

/** De qué viene la afirmación, para el autor de la lectura. */
function nombreDelMotor(regla: string | undefined): string {
  return regla?.startsWith('escucha.') ? 'la escucha' : 'el sistema';
}

/**
 * ══ LO QUE EL SISTEMA LEYÓ, COMO RENGLONES DEL TIMELINE (ADR 0095 §7) ═══════
 *
 * Cada afirmación del sistema es una fila al lado del chat, con la evidencia
 * enlazada y las acciones para aceptarla o corregirla. Es la lección de ADR
 * 0018 aplicada donde sale gratis: **el juicio se da con el contexto delante o
 * no se da**, y el contexto —el mensaje— está a 300 px.
 *
 * Y es la única fuente de correcciones etiquetadas que el sistema va a tener.
 * Hoy hay cero: `bot_calificaciones` tiene 85 filas sin un solo lector y 0 de
 * 1.206 respuestas en sombra se revisaron nunca. Sin estas filas no hay
 * precisión por regla, y sin precisión por regla nada puede aprender (§8).
 *
 * ── TRES VERBOS, SIEMPRE LOS MISMOS ─────────────────────────────────────────
 *
 *   · **leyó**    — clasificó un mensaje (postura, tema, lugar). No cambió nada.
 *   · **anotó**   — cambió el tablero: puso un peldaño, prendió el riesgo.
 *   · **propone** — espera a una persona: un enlace de identidad, una próxima
 *                   acción. Todavía no cuenta.
 *   · **corrigió** — lo dictaminó una persona. Es el único que no lo hace una
 *                   máquina, y por eso no sale de `verboDe`: sale de que haya
 *                   veredicto.
 *
 * La misma acción se llama igual en las cinco superficies; es el señalamiento
 * con el que alguien aprende a moverse en el producto. Y en tercera persona: la
 * máquina no habla de sí en primera («leí») porque el actor puede ser la escucha
 * o el LLM, y el renglón tiene que poder nombrar cuál fue.
 */
export type Verbo = 'leyó' | 'anotó' | 'propone' | 'corrigió';

/**
 * El veredicto de una persona sobre una lectura. Tres, no dos.
 *
 * 🔴 **`no_aplica` no es «corregir con otro valor».** Es el caso en que la
 * lectura no está mal ni bien: el mensaje no venía al caso. Sin este veredicto,
 * quien atiende lo mete adentro de `corrige` con un valor cualquiera y ensucia
 * la precisión de la regla **justo donde se la mide**. Queda fuera del cociente
 * (`acepta / (acepta + corrige)`), y su conteo aparte es, él solo, la señal de
 * que una regla se está disparando donde no debe.
 */
export type Veredicto = 'acepta' | 'corrige' | 'no_aplica';

export interface Lectura {
  /** Estable, para la key de React y para el ancla del veredicto. */
  id: string;
  verbo: Verbo;
  /** Qué leyó, en las palabras de quien atiende: «pide agua», «simpatiza». */
  que: string;
  /** El matiz, si lo hay: «Huarmey». Nunca el nombre de un campo. */
  detalle?: string;
  /** La familia de la regla, sin versión: `escucha.apoyo`. Es contra esto que se registra. */
  regla: string;
  /** El `interaction_id` citable. Sin él no hay ancla, y el renglón lo dice. */
  evidencia?: string;
  /** El texto del mensaje que lo justifica, si viaja. */
  cita?: string;
  /** Cuándo HABLÓ la persona — no cuándo lo dedujimos. Son cosas distintas. */
  ocurridoAt?: string;
  /** Sólo cuando NO es alta: el silencio significa alta (misma regla que la tarjeta). */
  confianza?: Confianza;
  /** Lo que una persona ya dictaminó. Sin esto, la fila pide veredicto. */
  veredicto?: Veredicto;
  /** A qué lo corrigió, y quién. Corregir REVOCA, no borra. */
  corregidoA?: string;
  corregidoPor?: string;
}

/** La forma en que una afirmación viaja desde el server. */
export interface Afirmacion {
  id: string;
  /** Qué dimensión afirma: `postura` · `compromiso` · `riesgo` · `identidad` · `proxima_accion`. */
  dimension: string;
  valor: string;
  detalle?: string;
  regla: string;
  origen: OrigenDeAfirmacion;
  confianza?: Confianza;
  evidencia?: string;
  cita?: string;
  ocurridoAt?: string;
  /** ¿Está aplicada, o espera un veredicto para contar? */
  aplicada?: boolean;
  veredicto?: Veredicto;
  corregidoA?: string;
  corregidoPor?: string;
}

/**
 * LAS DIMENSIONES QUE CAMBIAN EL TABLERO. Afirmarlas no es leer un mensaje: es
 * mover a alguien de columna o prender una alarma, y el verbo tiene que decirlo.
 */
const CAMBIAN_EL_TABLERO: readonly string[] = ['compromiso', 'riesgo'];

/**
 * EL VERBO DE UNA AFIRMACIÓN.
 *
 * ⚠️ **`propone` gana sobre todo lo demás.** Una afirmación sin aplicar no
 * «anotó» nada aunque su dimensión sea de las que mueven el tablero — todavía no
 * pasó. Preguntar primero por la dimensión y después por si está aplicada
 * dejaría un renglón diciendo «anotó: simpatiza» sobre alguien que sigue en su
 * columna de antes.
 */
export function verboDe(a: Pick<Afirmacion, 'dimension' | 'aplicada'>): Verbo {
  if (a.aplicada === false) return 'propone';
  return CAMBIAN_EL_TABLERO.includes(a.dimension) ? 'anotó' : 'leyó';
}

/**
 * ¿Esta fila todavía pide una decisión?
 *
 * 🔴 **Sólo lo que escribió una MÁQUINA y nadie dictaminó.** Lo que afirmó una
 * persona no se acepta ni se corrige: ya es un hecho, y ofrecerle a alguien
 * «¿está bien?» sobre lo que él mismo escribió es ruido en cada fila del
 * timeline. Y una lectura ya dictaminada tampoco vuelve a preguntar: la fila
 * pasa a mostrar el veredicto.
 */
export function pideVeredicto(a: Pick<Afirmacion, 'origen' | 'veredicto'>): boolean {
  return a.origen === 'sistema' && a.veredicto == null;
}

/**
 * UNA AFIRMACIÓN, COMO RENGLÓN.
 *
 * 🔴 **Una corrección deja las DOS cosas en la misma fila.** Corregir revoca la
 * afirmación, no la borra (`revocado_at`, nunca un `DELETE`), y el renglón lo
 * muestra: «corrigió: apoya · por Luz · antes decía ~~se opone~~». Dos filas
 * separadas obligarían a reconstruir mentalmente qué reemplazó a qué.
 *
 * Y no es prolijidad de auditoría: el valor de una corrección no es sólo el dato
 * nuevo, es **la prueba de que esa regla falló ahí**. Es lo único con lo que
 * Revisión puede decir «acierta el 94 %». Un timeline que borra los errores del
 * sistema borra también la evidencia de que aprende.
 */
export function lecturaDe(a: Afirmacion): Lectura {
  const corregida = a.veredicto === 'corrige' && a.corregidoA != null;
  return {
    id: a.id,
    verbo: corregida ? 'corrigió' : verboDe(a),
    /**
     * 🔴 **El verbo NO se mete acá adentro.** La primera versión lo dejaba
     * pegado sólo en el caso corregido (`corrigió: apoya`) y en los demás
     * devolvía el valor pelado — así que `verbo` se calculaba, se testeaba, y
     * **no se dibujaba en ningún lado**. La captura mostró filas que decían
     * «pide agua» donde tenían que decir «leyó: pide agua».
     *
     * Es exactamente el defecto que este timeline ya tuvo con `fuente`, que
     * durante meses se computaba sin que ningún JSX la usara. Separados, la
     * vista tiene que juntarlos y el test puede exigir que el verbo esté.
     */
    que: corregida ? a.corregidoA! : textoDe(a),
    detalle: a.detalle,
    regla: a.regla,
    evidencia: a.evidencia,
    cita: a.cita,
    ocurridoAt: a.ocurridoAt,
    // El silencio significa alta, igual que en la tarjeta: escribirla en cada
    // renglón llenaría el timeline de una palabra que nunca cambia lo que se hace.
    confianza: a.origen === 'sistema' && a.confianza !== 'alta' ? a.confianza : undefined,
    veredicto: a.veredicto,
    corregidoA: a.corregidoA,
    corregidoPor: a.corregidoPor,
  };
}

function textoDe(a: Afirmacion): string {
  return a.valor;
}

/**
 * EL AUTOR DE UNA FILA, dicho para una persona.
 *
 * Una corrección la firma quien la hizo; una lectura, el motor que la escribió.
 * La diferencia es lo único que separa «esto lo decidió alguien» de «esto lo
 * dedujo una máquina», y el timeline la tenía calculada y sin dibujar desde
 * antes del ARM.
 */
export function autorDe(l: Lectura): string {
  if (l.corregidoPor) return `por ${l.corregidoPor}`;
  return nombreDelMotor(l.regla);
}

/**
 * QUÉ DICE UNA FILA CORREGIDA DEL VALOR VIEJO. `null` cuando no hay corrección.
 *
 * Se devuelve aparte del texto para que la vista lo pueda tachar: un valor
 * revocado y uno vigente en la misma frase, sin marca, se leen como dos datos.
 */
export function valorRevocado(a: Afirmacion): string | null {
  return a.veredicto === 'corrige' && a.corregidoA != null ? a.valor : null;
}

/** Un valor al que una persona puede corregir una lectura. */
export interface OpcionDeCorreccion {
  valor: string;
  rotulo: string;
}

/**
 * A QUÉ SE PUEDE CORREGIR UNA LECTURA, por dimensión.
 *
 * 🔴 **Corregir pide el VALOR de reemplazo, no un pulgar abajo.** «No sirve» no
 * dice qué era lo correcto, así que no alimenta nada: ni el prompt, ni el
 * diccionario, ni la precisión por regla. Lo que hace aprender al sistema es la
 * lista cerrada de abajo.
 *
 * ⚠️ **Y sólo se ofrece donde la lista ES cerrada.** El `lugar` no está: sus
 * valores son el catálogo de distritos de la campaña (ADR 0088), que es una
 * búsqueda y no cuatro botones, y meterlo acá con una lista recortada dejaría a
 * quien atiende sin poder poner el distrito que de verdad es. Sin opciones, la
 * fila no dibuja «Corregir» — mejor no ofrecer la acción que ofrecerla mutilada.
 * El día que exista el buscador de distritos, entra por acá.
 */
const OPCIONES: Record<string, readonly OpcionDeCorreccion[]> = {
  postura: [
    { valor: 'apoya', rotulo: 'Apoya' },
    { valor: 'indeciso', rotulo: 'Indeciso' },
    { valor: 'se_opone', rotulo: 'Se opone' },
    { valor: 'pro_rival', rotulo: 'Con el rival' },
  ],
  /**
   * Los tres peldaños de campaña. **El sistema sólo declara el primero** (ADR
   * 0095 §3: no toca `comprometido` ni `voluntario`), pero una PERSONA sí puede
   * subir a alguien desde acá — corregir hacia arriba es exactamente lo que la
   * escalera de ADR 0063 pide que haga quien habló con la gente.
   */
  compromiso: [
    { valor: 'simpatiza', rotulo: 'Simpatiza' },
    { valor: 'comprometido', rotulo: 'Se comprometió' },
    { valor: 'voluntario', rotulo: 'Es voluntario' },
  ],
};

export function opcionesDeCorreccion(dimension: string): readonly OpcionDeCorreccion[] {
  return OPCIONES[dimension] ?? [];
}
