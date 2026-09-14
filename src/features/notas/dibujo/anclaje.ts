import { useEffect, useRef } from 'react';
import type { EditorLibreta } from '../editor';
import type { Ancla, Figura, Punto } from './figuras';

/**
 * DÓNDE VIVE «EL BLOQUE DE TEXTO MÁS CERCA» — lo único de la capa de dibujo que
 * de verdad toca BlockNote/el DOM. `figuras.ts` es puro a propósito (ver su
 * docblock); esto no puede serlo, porque medir un bloque es medir el DOM.
 *
 * ══ `[data-id="<id>"]` NO ES UN ACCIDENTE ════════════════════════════════════
 *
 * BlockNote pinta ese atributo en el wrapper de CADA bloque (y lo lee ella
 * misma en su propio side-menu, `getDraggableBlockFromElement`), así que es una
 * convención estable de la librería, no un detalle de implementación que pueda
 * desaparecer en un parche menor.
 *
 * ⚠️ `EditorLibreta` se importa SOLO como tipo. Un import de VALOR acá
 * arrastraría el motor entero al chunk de entrada de la Libreta — el mismo
 * defecto que ya pasó una vez (ver `### Entrar a la Libreta no es abrir el
 * editor` en `docs/reglas/libreta-espacios.md`) y que `npm run presupuesto`
 * vigila.
 */

interface Rectangulo {
  top: number;
  left: number;
}

/**
 * EL BLOQUE MÁS CERCA DE `punto` — o `null` si el editor no tiene ninguno
 * medible todavía (recién montado, o sin DOM en un test).
 *
 * «Más cerca» es: el que CONTIENE el punto en su rango vertical (distancia 0),
 * y si hay varios anidados que lo contienen (una lista, una tabla), el de
 * menor alto — el más específico, no el contenedor. Sin ninguno que lo
 * contenga (el punto cae en un hueco, o debajo del último párrafo), el de
 * borde más cercano. Con al menos un párrafo en el documento —que BlockNote
 * siempre tiene— esto resuelve a algo.
 */
export function resolverAncla(
  editor: Pick<EditorLibreta, 'domElement'>,
  contenedor: Rectangulo,
  punto: Punto,
): Ancla | null {
  const raiz = editor.domElement;
  if (!raiz) return null;

  const [x, y] = punto;
  let mejor: { id: string; top: number; left: number; alto: number; distancia: number } | null = null;

  for (const el of raiz.querySelectorAll<HTMLElement>('[data-id]')) {
    const id = el.getAttribute('data-id');
    if (!id) continue;
    const r = el.getBoundingClientRect();
    const top = r.top - contenedor.top;
    const left = r.left - contenedor.left;
    const distancia = y < top ? top - y : y > top + r.height ? y - (top + r.height) : 0;
    if (!mejor || distancia < mejor.distancia || (distancia === mejor.distancia && r.height < mejor.alto)) {
      mejor = { id, top, left, alto: r.height, distancia };
    }
  }

  if (!mejor) return null;
  return { bloqueId: mejor.id, dx: x - mejor.left, dy: y - mejor.top };
}

/** El resultado de una pasada de reflow: qué mover y qué desanclar. */
export interface ResultadoDeReflow {
  /** Las figuras cuyo bloque se corrió, y cuánto. */
  cambios: { id: string; dx: number; dy: number }[];
  /** Los `bloqueId` que ya no están en el DOM: sus figuras pierden el ancla. */
  perdidos: string[];
}

/**
 * MANTIENE LAS FIGURAS ANCLADAS PEGADAS A SU BLOQUE.
 *
 * ══ CUÁNDO SE VUELVE A MEDIR ═════════════════════════════════════════════════
 *
 *  · `editor.onChange` — cualquier edición del documento (escribir un párrafo
 *    arriba, borrar uno, un bloque que cambia de alto). Es el caso que motivó
 *    esto.
 *  · Un `ResizeObserver` sobre `editor.domElement` — el reflow VISUAL sin
 *    edición: angostar la ventana, abrir la pantalla dividida. `onChange` no
 *    dispara ahí porque el documento no cambió, solo cómo se ve.
 *
 * ══ POR QUÉ SE GUARDA LA ÚLTIMA POSICIÓN EN UN `ref` Y NO EN ESTADO ═════════
 *
 * Es contabilidad interna, no algo que deba disparar un render: lo que importa
 * ya lo dispara `onReubicar` al mover las figuras de verdad. Con estado acá,
 * cada medición de por sí forzaría un render antes de saber si hubo cambio.
 *
 * ══ POR QUÉ NO TOCA `ancla` DE LOS QUE SE CORREN ═════════════════════════════
 *
 * El offset guardado (`dx`/`dy`) es la distancia entre la figura y SU bloque:
 * si los dos se corrieron lo mismo, esa distancia no cambió. Tocar `ancla` acá
 * sería resolver de nuevo algo que ya está resuelto.
 */
export function useReflowPorAnclas(
  editor: EditorLibreta | null | undefined,
  figuras: Figura[],
  /**
   * 🔴 EL NODO DE `.hoja-a4` — NO el canvas, y no es un detalle menor.
   *
   * Hasta acá esto medía contra el canvas (`canvasRef`), y era la causa de un
   * defecto real: la posición del canvas es DERIVADA (`origen`, en
   * `CapaDeAnotaciones`) y tarda un instante en estabilizarse después de
   * montar — un reload midió el bloque contra el canvas en dos momentos
   * distintos de esa estabilización y vio un salto de 94,5px que el bloque
   * JAMÁS dio: era el canvas ajustándose, no el texto moviéndose. La figura
   * se corría esos mismos 94,5px sin que nada real la hubiera empujado.
   *
   * `.hoja-a4` no tiene ese problema: es un nodo REAL del DOM cuya posición en
   * pantalla no depende de ningún cálculo de React — solo cambia si la propia
   * ventana se redimensiona. Medir los bloques contra ÉL (con la misma resta
   * de `scrollTop` que usa `origen`, para que el número no dependa de cuánto
   * se haya scrolleado en el instante de medir) dijo desde siempre lo mismo:
   * cero cuando nada se movió.
   */
  hojaA4: HTMLElement | null,
  onReubicar: (r: ResultadoDeReflow) => void,
): void {
  const ultimaPos = useRef(new Map<string, Rectangulo>());
  const figurasRef = useRef(figuras);
  figurasRef.current = figuras;
  const onReubicarRef = useRef(onReubicar);
  onReubicarRef.current = onReubicar;

  useEffect(() => {
    // Sin editor o sin `.hoja-a4` no hay nada que medir: una página de solo
    // lectura sin editor vivo (una `gestion` histórica, una página-archivo),
    // o el instante entre que el editor está listo y `.hoja-a4` todavía no
    // montó. Las figuras quedan donde estaban — el comportamiento de siempre.
    if (!editor || !hojaA4) return;
    const raiz = editor.domElement;
    if (!raiz) return;

    // Cambiar de página remonta este componente entero (la `key` de
    // `ZonaDeTrabajo`), así que no hace falta limpiar `ultimaPos` a mano: nace
    // vacía en cada montaje.
    const recalcular = () => {
      const idsAncla = new Set<string>();
      for (const f of figurasRef.current) if (f.ancla) idsAncla.add(f.ancla.bloqueId);
      if (idsAncla.size === 0) return;

      const base = hojaA4.getBoundingClientRect();
      const cambios: ResultadoDeReflow['cambios'] = [];
      const perdidos: string[] = [];

      for (const bloqueId of idsAncla) {
        const el = raiz.querySelector<HTMLElement>(`[data-id="${bloqueId}"]`);
        if (!el) {
          perdidos.push(bloqueId);
          ultimaPos.current.delete(bloqueId);
          continue;
        }
        const r = el.getBoundingClientRect();
        const actual: Rectangulo = {
          top: r.top - base.top + hojaA4.scrollTop,
          left: r.left - base.left + hojaA4.scrollLeft,
        };
        const anterior = ultimaPos.current.get(bloqueId);
        ultimaPos.current.set(bloqueId, actual);
        // Primera medición de este bloque: nada que corregir todavía, solo
        // queda la marca de agua para la próxima pasada.
        if (!anterior) continue;
        const dy = actual.top - anterior.top;
        const dx = actual.left - anterior.left;
        if (dx === 0 && dy === 0) continue;
        for (const f of figurasRef.current) {
          if (f.ancla?.bloqueId === bloqueId) cambios.push({ id: f.id, dx, dy });
        }
      }

      if (cambios.length > 0 || perdidos.length > 0) onReubicarRef.current({ cambios, perdidos });
    };

    recalcular();
    const desuscribir = editor.onChange(recalcular);

    let observador: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observador = new ResizeObserver(recalcular);
      observador.observe(raiz);
    }

    return () => {
      desuscribir?.();
      observador?.disconnect();
    };
    // `figuras`/`onReubicar` viajan por `ref` a propósito (ver el docblock de
    // arriba): no hace falta re-suscribirse en cada tecla, así que no entran
    // a este arreglo de dependencias.
  }, [editor, hojaA4]);
}
