import { useLocalStorage } from '../../lib/useLocalStorage';

/**
 * LAS PESTAÑAS ABIERTAS (26-ago-2026) — tipo navegador clásico: cada página
 * que se abre queda como pestaña hasta que alguien la cierra a mano. Viven en
 * localStorage y NO en el server: es una preferencia de CÓMO TRABAJÁS vos en
 * este navegador, la misma regla que ya separa `lib/datos/cliente.ts` —
 * estado del servidor va al caché de consultas, preferencias de UI van acá.
 *
 * ⚠️ **Solo páginas `origen: 'nota'`.** Una histórica de `gestiones` no tiene
 * fila en `notas` — su id es de OTRA tabla — así que no hay
 * `GET /api/notas/:id` que la resuelva (`consultarNotaPorId` solo mira
 * `notas`). Es la misma frontera que ya traza `PantallaDividida.tsx` para
 * elegir con qué dividir: una histórica se lee en su lugar, no se abre en
 * pestaña.
 *
 * ⚠️ **Una sola fila, para TODOS los lugares** (Mi libreta y cada espacio),
 * a propósito: la pregunta que esto contesta es «¿qué tengo a mano ahora
 * mismo?», y esa pregunta no depende de en qué carpeta estés parado en este
 * instante. Activar una pestaña de otro lugar mueve el selector de la
 * izquierda solo para mostrarla — no las separa en filas distintas.
 */

export interface RefPestana {
  id: number;
  /** Dónde vive esa página — para poder mover el selector de espacio al
   *  activarla. `null` = Mi libreta. */
  espacioId: number | null;
  /** Para pintar el ícono correcto SIN esperar a que la página resuelva. */
  tipo: 'texto' | 'archivo';
}

const CLAVE_PESTANAS = 'libreta:pestanas';

function esLaMisma(a: { id: number }, b: { id: number }): boolean {
  return a.id === b.id;
}

export function usePestanas() {
  const [abiertas, guardar] = useLocalStorage<RefPestana[]>(CLAVE_PESTANAS, []);

  /** No hace nada si ya está abierta — un segundo clic sobre la misma página
   *  no duplica su pestaña, solo la deja donde estaba. */
  const abrir = (ref: RefPestana) => {
    guardar((prev) => (prev.some((p) => esLaMisma(p, ref)) ? prev : [...prev, ref]));
  };

  const cerrar = (id: number) => {
    guardar((prev) => prev.filter((p) => p.id !== id));
  };

  return { abiertas, abrir, cerrar };
}

/**
 * QUÉ PESTAÑA QUEDA ACTIVA DESPUÉS DE CERRAR UNA — pura, para poder probarla
 * sin montar nada. La que cerraste puede o no ser la que tenías abierta:
 *
 *  · Si NO era la activa, la activa sigue siendo la misma (`undefined`: quien
 *    llama no cambia la selección).
 *  · Si SÍ era la activa, se elige la que quedó EN SU MISMO LUGAR de la fila
 *    (la que la sucede corriéndose un puesto) y, si era la última, la
 *    anterior. Sin ninguna pestaña que quede, `null` — hay que volver a la
 *    lista.
 *
 * Es el mismo criterio que Chrome: cerrar una pestaña del medio te deja
 * mirando a la que estaba a su derecha, no salta al principio ni al final.
 */
export function siguienteAlCerrar(
  abiertas: RefPestana[],
  cerradaId: number,
  activaId: number | null,
): RefPestana | null | undefined {
  if (activaId !== cerradaId) return undefined;
  const idx = abiertas.findIndex((p) => p.id === cerradaId);
  const restantes = abiertas.filter((p) => p.id !== cerradaId);
  if (restantes.length === 0) return null;
  return restantes[idx] ?? restantes[idx - 1] ?? null;
}
