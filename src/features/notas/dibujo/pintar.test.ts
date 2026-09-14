import { describe, expect, it } from 'vitest';
import { pintar } from './pintar';

/**
 * EL TRANSFORM DE `pintar`, sin un canvas de verdad — jsdom no implementa
 * `getContext`, así que esto arma a mano el pedacito de `CanvasRenderingContext2D`
 * que `pintar` toca cuando no hay ninguna figura, y mira qué llamó.
 *
 * ══ QUÉ DEFECTO ATRAPA ESTO ══════════════════════════════════════════════════
 *
 * 🔴 Hasta el 09-sep-2026, `MiniaturaDeCapa` armaba su propio encuadre con
 * `ctx.translate`/`ctx.scale` y LUEGO llamaba a `pintar`, que arranca con su
 * propio `ctx.setTransform` — y `setTransform` REEMPLAZA la matriz entera en vez
 * de componerla con la que ya había puesta. El encuadre externo se perdía
 * siempre, así que la miniatura pintaba la imagen en sus coordenadas CRUDAS de
 * la página: se veía bien solo si la figura caía cerca del origen por
 * casualidad, y se descolocaba en cuanto se la movía. El arreglo es que el
 * encuadre (`escala`/`desplazamiento`) viaje como OPCIÓN de `pintar`, para que
 * un solo `setTransform` lo aplique junto con el `dpr` — lo que este archivo
 * fija es que ese valor final sea el correcto y no algo que un `setTransform`
 * de más adelante pueda volver a pisar.
 */

function ctxFalso(ancho: number, alto: number) {
  const setTransform: number[][] = [];
  const clearRect: number[][] = [];
  const ctx = {
    canvas: { width: ancho, height: alto },
    lineCap: '',
    lineJoin: '',
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
      setTransform.push([a, b, c, d, e, f]);
    },
    clearRect(x: number, y: number, w: number, h: number) {
      clearRect.push([x, y, w, h]);
    },
    save() {},
    restore() {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, llamadas: { setTransform, clearRect } };
}

describe('pintar: el transform final', () => {
  it('sin encuadre propio, pinta a 1:1 multiplicado por el dpr', () => {
    const { ctx, llamadas } = ctxFalso(100, 80);
    pintar(ctx, [], { dpr: 2 });
    expect(llamadas.setTransform.at(-1)).toEqual([2, 0, 0, 2, 0, 0]);
  });

  it('🔴 el encuadre (escala + desplazamiento) llega al ÚLTIMO setTransform, no se pierde', () => {
    const { ctx, llamadas } = ctxFalso(104, 76);
    pintar(ctx, [], { dpr: 2, escala: 0.5, desplazamiento: [10, 4] });
    // dpr·escala en la diagonal, y el desplazamiento ya multiplicado por dpr —
    // es EXACTAMENTE lo que `ctx.translate(10,4); ctx.scale(0.5,0.5)` habría
    // dejado puesto, pero en una sola llamada que nada de acá adentro puede pisar.
    expect(llamadas.setTransform.at(-1)).toEqual([1, 0, 0, 1, 20, 8]);
  });

  it('el clear va SIN transform puesto y contra el buffer físico, antes del encuadre', () => {
    const { ctx, llamadas } = ctxFalso(104, 76);
    pintar(ctx, [], { dpr: 2, escala: 0.5, desplazamiento: [10, 4] });
    expect(llamadas.clearRect).toEqual([[0, 0, 104, 76]]);
    // Si el clear pasara DESPUÉS del transform del encuadre, limpiaría un
    // rectángulo corrido y escalado — no el buffer entero.
    expect(llamadas.setTransform[0]).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('con `limpiar: false` no borra lo que el llamador ya pintó debajo (el damero de una capa vacía)', () => {
    const { ctx, llamadas } = ctxFalso(104, 76);
    pintar(ctx, [], { dpr: 2, escala: 0.5, desplazamiento: [10, 4], limpiar: false });
    expect(llamadas.clearRect).toEqual([]);
    expect(llamadas.setTransform).toEqual([[1, 0, 0, 1, 20, 8]]);
  });
});
