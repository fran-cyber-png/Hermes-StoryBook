import { describe, expect, test } from 'vitest';
import { siguienteAlCerrar, type RefPestana } from './pestanas';

/** Puro, sin DOM: `usePestanas` es un `useLocalStorage` con nombre — lo único
 * con lógica propia para testear es `siguienteAlCerrar`. */

const p = (id: number): RefPestana => ({ id, espacioId: null, tipo: 'texto' });

describe('siguienteAlCerrar', () => {
  test('si la cerrada NO era la activa, no cambia nada (undefined)', () => {
    const abiertas = [p(1), p(2), p(3)];
    expect(siguienteAlCerrar(abiertas, 2, 1)).toBeUndefined();
  });

  test('cerrar la del medio deja la que quedó en su mismo lugar — la de su derecha', () => {
    const abiertas = [p(1), p(2), p(3)];
    const r = siguienteAlCerrar(abiertas, 2, 2);
    expect(r?.id).toBe(3);
  });

  test('cerrar la ÚLTIMA activa cae a la anterior, no da vuelta al principio', () => {
    const abiertas = [p(1), p(2), p(3)];
    const r = siguienteAlCerrar(abiertas, 3, 3);
    expect(r?.id).toBe(2);
  });

  test('cerrar la única pestaña abierta vuelve a la lista (null)', () => {
    const abiertas = [p(5)];
    expect(siguienteAlCerrar(abiertas, 5, 5)).toBeNull();
  });

  test('cerrar la primera de varias deja la que pasó a ocupar su lugar', () => {
    const abiertas = [p(1), p(2), p(3)];
    const r = siguienteAlCerrar(abiertas, 1, 1);
    expect(r?.id).toBe(2);
  });
});
