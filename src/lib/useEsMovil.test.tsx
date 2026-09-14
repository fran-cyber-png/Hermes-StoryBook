// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { montar, type Montado } from '../pruebas/dom';
import { simularPantalla, type PantallaSimulada } from '../pruebas/pantalla';
import { CONSULTA_CELULAR, useEsMovil } from './useEsMovil';

/**
 * EL ÚNICO DETECTOR DE CELULAR DEL FRONT.
 *
 * Lo que fija este archivo es el CORTE, no la implementación: debajo de 768 px
 * el shell de Mensajes pasa a una sola columna (lista o chat, nunca los dos), y
 * de 768 para arriba todo sigue como en escritorio. Si alguien corre el número
 * «para que entre una tablet», estos tests lo dicen antes que la vendedora.
 */

let montado: Montado | null = null;
let pantalla: PantallaSimulada | null = null;

afterEach(() => {
  montado?.desmontar();
  montado = null;
  pantalla?.restaurar();
  pantalla = null;
});

function Sonda() {
  return <output>{useEsMovil() ? 'celular' : 'escritorio'}</output>;
}

const lectura = () => montado?.contenedor.querySelector('output')?.textContent;

describe('useEsMovil', () => {
  it('a 390 px (un teléfono en vertical) es celular', () => {
    pantalla = simularPantalla(390);
    montado = montar(<Sonda />);
    expect(lectura()).toBe('celular');
  });

  it('a 1280 px no lo es', () => {
    pantalla = simularPantalla(1280);
    montado = montar(<Sonda />);
    expect(lectura()).toBe('escritorio');
  });

  it('767 px es el último ancho de celular; 768 ya es escritorio', () => {
    pantalla = simularPantalla(767);
    montado = montar(<Sonda />);
    expect(lectura()).toBe('celular');

    act(() => pantalla!.cambiarA(768));
    expect(lectura()).toBe('escritorio');
  });

  /**
   * 🔴 EL CORTE VIVE EN DOS LUGARES —este hook y cada clase `max-md:`— y tiene
   * que ser el MISMO. Con `(max-width: 767px)` acá y `48rem` en el CSS, alguien
   * con la letra del navegador en 20 px tiene `48rem = 960 px`: entre 768 y 959
   * el shell se arma de escritorio mientras la cola se pinta de celular.
   * Diciéndolo con la misma unidad y la misma comparación que Tailwind, no hay
   * ancho en el que discrepen. Si `index.css` redefine `--breakpoint-md`, manda
   * ese valor; si no, el de Tailwind 4.
   */
  it('usa el mismo corte que `max-md:` de Tailwind', async () => {
    const css = await import('../index.css?raw').then((m) => m.default as string);
    const corte = css.match(/--breakpoint-md:\s*([^;]+);/)?.[1]?.trim() ?? '48rem';

    expect(CONSULTA_CELULAR).toBe(`(width < ${corte})`);
  });

  it('se entera cuando la ventana cruza el corte, sin recargar', () => {
    pantalla = simularPantalla(1280);
    montado = montar(<Sonda />);
    expect(lectura()).toBe('escritorio');

    act(() => pantalla!.cambiarA(390));
    expect(lectura()).toBe('celular');

    act(() => pantalla!.cambiarA(1024));
    expect(lectura()).toBe('escritorio');
  });
});
