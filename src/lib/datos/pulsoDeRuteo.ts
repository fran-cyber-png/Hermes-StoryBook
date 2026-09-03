/**
 * EL PULSO DE RUTEO — «acaba de caer un dato, y fue para acá».
 *
 * ══ 🔴 POR QUÉ NO VIVE EN EL CACHÉ DE REACT QUERY ═══════════════════════════
 *
 * Un pulso es un HECHO INSTANTÁNEO, no un estado. Metiéndolo en el caché pasaría
 * lo que le pasa a todo lo que se cachea en esta app: se persiste en IndexedDB
 * (ADR 0007) y se rehidrata en el próximo montaje — o sea que al abrir Hermes a
 * la mañana verías el puntito de un lead que cayó anoche, viajando otra vez. Un
 * evento que revive es un evento que miente.
 *
 * ══ POR QUÉ UN EMISOR DE MÓDULO Y NO UN CONTEXTO ════════════════════════════
 *
 * `tiempoReal.ts` es un hook que corre UNA vez en la raíz de la app; la pantalla
 * de Routing puede no estar montada. Con un contexto habría que envolver el
 * árbol entero para un dato que sólo mira una vista. Un emisor de módulo deja
 * que quien lo necesite se suscriba y que el resto ni se entere.
 *
 * ⚠️ **Si nadie escucha, el pulso se pierde a propósito y eso es correcto**: no
 * es una cola de trabajo, es «esto pasó recién». Guardarlos para cuando
 * alguien abra la pantalla los mostraría todos juntos y fuera de tiempo.
 */

/** Lo que el server manda por el SSE cuando se decide un ruteo. */
export interface PulsoDeRuteo {
  tipo: 'ruteo';
  canal: string;
  /** El nivel de la cascada: `campana` · `producto` · `division` · `linea` · `round-robin`. */
  motivo: string;
  /**
   * El eje de la regla que decidió. **Ausente cuando el evento viene RECORTADO**
   * —o sea, cuando el lead no es de quien mira y no supervisa—, y también cuando
   * no hubo regla (la rueda). La pantalla no puede distinguir esos dos casos, y
   * no le hace falta: en los dos, lo que no se dibuja es el origen.
   */
  eje?: string;
  regla?: string;
  /** `alta` · `revencida` · `manual`. Ausente en el evento recortado. */
  hecho?: string;
  /** A quién le cayó. **Ausente en el recortado**: sin esto no se anima nada. */
  destino?: string;
}

type Oyente = (p: PulsoDeRuteo) => void;

const oyentes = new Set<Oyente>();

/** Lo llama `tiempoReal.ts` al recibir un evento `ruteo`. Nunca tira. */
export function emitirPulsoDeRuteo(p: PulsoDeRuteo): void {
  for (const o of oyentes) {
    try {
      o(p);
    } catch {
      // Un oyente roto no puede tumbar el stream: el resto sigue recibiendo.
    }
  }
}

/** Suscribirse. Devuelve la baja, para el `useEffect`. */
export function suscribirPulsoDeRuteo(o: Oyente): () => void {
  oyentes.add(o);
  return () => oyentes.delete(o);
}
