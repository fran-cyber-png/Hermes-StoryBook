// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
// `pruebas/dom` le da a jsdom el `localStorage` que vitest no copia a los globales.
import '../pruebas/dom';
import { anotarReciente, leerRecientes } from './emojisRecientes';

/**
 * LOS EMOJIS RECIENTES DE ESTA MÁQUINA (ADR 0126, #1082).
 *
 * Por último uso y no por frecuencia: lo que la vendedora acaba de poner va
 * primero y se queda donde lo dejó, en vez de reordenarse solo.
 */
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('emojisRecientes', () => {
  test('el último que se usó va primero', () => {
    anotarReciente('🙏');
    anotarReciente('😊');
    expect(leerRecientes()).toEqual(['😊', '🙏']);
  });

  test('volver a usar uno lo trae al frente, sin repetirlo', () => {
    anotarReciente('🙏');
    anotarReciente('😊');
    anotarReciente('🙏');
    expect(leerRecientes()).toEqual(['🙏', '😊']);
  });

  test('guarda 27 —tres filas de 9— y el más viejo se va', () => {
    const veintiocho = Array.from({ length: 28 }, (_, i) => String.fromCodePoint(0x1f600 + i));
    for (const emoji of veintiocho) anotarReciente(emoji);
    const recientes = leerRecientes();
    expect(recientes).toHaveLength(27);
    expect(recientes[0]).toBe(veintiocho[27]);
    expect(recientes).not.toContain(veintiocho[0]);
  });

  test('un localStorage con basura o bloqueado no rompe el panel: no hay recientes y nada más', () => {
    localStorage.setItem('hermes.emojis.recientes', '{roto');
    expect(leerRecientes()).toEqual([]);

    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(leerRecientes()).toEqual([]);
    expect(anotarReciente('🙏')).toEqual(['🙏']);
  });
});
