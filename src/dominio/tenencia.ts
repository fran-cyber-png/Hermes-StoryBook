import { mismaVendedora, nombreCorto } from './dueno';

/**
 * ¿SE PUEDE ESCRIBIR EN ESTE CHAT? — puro, fuera del JSX (ADR 0083).
 *
 * El server manda de quién es (`asignada_a`) y hasta cuándo (`asignada_hasta`), y
 * acá se decide qué se dibuja y si el compositor se apaga. Vive afuera del
 * componente por el motivo de siempre: un `if` adentro del JSX no se puede
 * interrogar sobre el caso que todavía no pasó —el segundo después del
 * vencimiento, el server que no manda el campo, la fila que salió del caché— y
 * esos son justo los que importan.
 *
 * ── 🔴 ESTO NO ES LA GARANTÍA, Y DECIRLO IMPORTA ──────────────────────────────
 * El candado de verdad rechaza el envío en el server
 * (`whatsapp/enviarYProyectar.ts`). Apagar el compositor es cortesía: evita que
 * alguien escriba tres párrafos para comerse un 409. Un `textarea` deshabilitado
 * no impide nada —una pestaña vieja, un reintento, un `curl` mandan igual—, y
 * tratarlo como la frontera es cómo se pierde la mitad que sí protege.
 *
 * ── LO PROPIO NO SE ROTULA, NUNCA ─────────────────────────────────────────────
 * Es la misma decisión que `marcaDeDueno` ya tomó en este archivo vecino, y por
 * el mismo motivo: la mayoría de los chats que alguien abre son suyos, así que un
 * borde verde permanente deja de ser una señal y pasa a ser fondo. La señal
 * existe para quien NO es el dueño, que es el único que necesita enterarse.
 */

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;

/** Lo que la fila de la cola trae sobre su tenencia. */
export interface FilaConTenencia {
  /** El id crudo de quien la tiene. `null`/ausente = sin dueño. */
  asignada_a?: string | null;
  /**
   * Hasta cuándo es suya, en ISO. `null` = **no vence** (contestó y la pelota es
   * del lead) — nunca «está libre».
   */
  asignada_hasta?: string | null;
}

export interface LecturaTenencia {
  /** El id crudo, para el `title`: ahí no se abrevia nada. */
  duena: string;
  /** Cómo se lo nombra al lado del contacto. */
  nombre: string;
  /** El rótulo corto: «activo con Luz» o «activo con Luz · 6 min». */
  texto: string;
  /** El `title` largo, que es donde se explica qué pasa y cuándo. */
  ayuda: string;
  /** Cuánto falta para que se libere, o `null` si esta tenencia no vence. */
  falta: string | null;
}

/**
 * Cuánto falta, en criollo. **Redondea para ARRIBA**, al revés que
 * `ventana.ts:cuantoFalta`, y la asimetría es deliberada: allá el error caro es
 * prometer tiempo que no hay para escribirle a un lead; acá el error caro es
 * decirle a alguien «ya se libera» treinta segundos antes de que se libere, y que
 * apriete enviar para comerse un 409. Con 5 min 10 s dice «6 min».
 */
export function cuantoFaltaParaSoltar(ms: number): string {
  if (ms >= HORA) return `${Math.ceil(ms / HORA)} h`;
  return `${Math.max(1, Math.ceil(ms / MINUTO))} min`;
}

/**
 * QUÉ DICE EL RÓTULO, o `null` si no se dibuja nada — y `null` significa además
 * **«puedes escribir»**, que es la misma pregunta contestada una sola vez.
 *
 * Los cuatro casos que devuelven `null` se ven igual en pantalla y son distintos
 * abajo, y está bien que se vean igual: la ausencia de señal no afirma nada.
 *   · el frente está apagado, o el server no sabe de esto (`activo` en `false`);
 *   · la conversación no tiene dueño;
 *   · el dueño eres tú;
 *   · la tenencia ya venció y está libre.
 *
 * 🔴 **EL VENCIMIENTO SE VUELVE A JUZGAR ACÁ AUNQUE EL SERVER YA LO FILTRÓ.** La
 * cola sirve sólo tenencias vigentes (`cola/asignadaSql.ts`), pero esa respuesta
 * se persiste en IndexedDB (ADR 0007) y se rehidrata antes del primer render: una
 * página guardada hace media hora afirmaría un candado que venció hace veinte
 * minutos. Sin este segundo juicio, el bloqueo dura lo que dure el caché.
 *
 * 🔴 **`activo` NO tiene default `true`.** Sin él, un N4 desplegado antes que N5
 * —que es lo normal: N4 va solo y N5 es un botón— bloquearía todo lo que tenga
 * dueño, y en producción eso son 3.637 conversaciones. El campo llega del server
 * (`bloqueoDeChat`) sólo cuando el frente está prendido y la migración del
 * reparto está: ausente es «como antes de este frente», que es la degradación
 * correcta para algo que QUITA una capacidad.
 */
export function lecturaDeTenencia(
  fila: FilaConTenencia,
  quien: { yo?: string | null; activo?: boolean },
  ahora: Date,
  nombres?: Record<string, string>,
): LecturaTenencia | null {
  if (!quien.activo) return null;

  const duena = typeof fila.asignada_a === 'string' ? fila.asignada_a.trim() : '';
  if (!duena) return null;
  if (mismaVendedora(duena, quien.yo ?? '')) return null;

  const falta = faltaMs(fila.asignada_hasta, ahora);
  // `undefined` = no vence: sigue siendo suya y no hay reloj que mostrar.
  if (falta !== undefined && falta <= 0) return null;

  const nombre = nombres?.[duena.toLowerCase()]?.trim() || nombreCorto(duena);
  const cuanto = falta === undefined ? null : cuantoFaltaParaSoltar(falta);

  return {
    duena,
    nombre,
    falta: cuanto,
    texto: cuanto ? `activo con ${nombre} · ${cuanto}` : `activo con ${nombre}`,
    ayuda: cuanto
      ? `${duena} está atendiendo esta conversación. Se libera en ${cuanto} si no responde.`
      : `${duena} está atendiendo esta conversación. Se libera cuando la persona escriba y él no conteste a tiempo.`,
  };
}

/**
 * Cuánto falta, o `undefined` cuando la tenencia **no vence**.
 *
 * ⚠️ Los dos vacíos se distinguen a propósito: `undefined` es «no vence» y no se
 * puede colapsar con «venció», que es un número negativo. Colapsarlos deja libre
 * justo el caso más trabado — la conversación de alguien que contestó.
 *
 * Una fecha ilegible se trata como «no vence» y no como «libre»: ante un dato
 * roto, el estado que se conserva es el que el server afirmó al mandar el dueño.
 */
function faltaMs(hasta: string | null | undefined, ahora: Date): number | undefined {
  if (!hasta) return undefined;
  const t = new Date(hasta).getTime();
  if (Number.isNaN(t)) return undefined;
  return t - ahora.getTime();
}

/**
 * ¿Puedo escribirle? Es `lecturaDeTenencia` en booleano, y se escribe así —y no
 * como una segunda regla— porque son la MISMA pregunta: todo lo que dibuja el
 * rótulo es exactamente lo que apaga el compositor. Dos funciones con dos
 * condiciones parecidas son dos que divergen (#37), y acá divergir significaría
 * un chat que dice «activo con Luz» y te deja escribir igual.
 */
export function puedoEscribir(
  fila: FilaConTenencia,
  quien: { yo?: string | null; activo?: boolean },
  ahora: Date,
): boolean {
  return lecturaDeTenencia(fila, quien, ahora) === null;
}
