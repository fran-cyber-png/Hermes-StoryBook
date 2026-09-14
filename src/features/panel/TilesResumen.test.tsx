// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { montar, type Montado } from '../../pruebas/dom';
import { TilesResumen } from './TilesResumen';
import type { CompraUnificada } from './comprasUnificadas';

const COMPRA: CompraUnificada = {
  folio: 'GOB-1',
  monto: '300.00',
  moneda: 'PEN',
  fecha: '2026-04-28T23:24:00.000Z',
  canalOEstado: null,
  fuente: 'cerberus',
  productos: ['Diploma Internacional del Gestor Parlamentario 1'],
  esCompra: true,
  negocios: ['Escuela'],
};

describe('TilesResumen — el resumen en UNA tarjeta (dueño, 13-sep-2026)', () => {
  it('es una sola tarjeta: la última actividad y las compras son renglones, no tres cajas', () => {
    const v = montar(
      <TilesResumen
        actividad={{ rotulo: 'Compra', valor: '300.00 PEN', timestamp: '2026-04-28T23:24:00.000Z', esSenal: false }}
        compra={COMPRA}
        totalCompras={1}
        montoTotal={{ n: 1, total: 300, moneda: 'PEN' }}
      />,
    );
    expect(v.contenedor.querySelectorAll('section')).toHaveLength(1);
    const texto = v.contenedor.textContent ?? '';
    expect(texto).toContain('Última actividad');
    expect(texto).toContain('1 compra');
    expect(texto).toContain('PEN 300 en total');
    v.desmontar();
  });

  /**
   * Dueño, 13-sep-2026: «sería mejor que muestres el producto que compró en un
   * componente más claro». «1 compra · PEN 300» no decía QUÉ: el producto va
   * primero, grande, con su negocio, su monto y su fecha; el total queda abajo.
   */
  it('la última compra se lee por su PRODUCTO: nombre, negocio, monto y fecha', () => {
    const v = montar(
      <TilesResumen
        actividad={null}
        compra={COMPRA}
        totalCompras={1}
        montoTotal={{ n: 1, total: 300, moneda: 'PEN' }}
      />,
    );
    const producto = v.contenedor.querySelector('[data-producto]');
    expect(producto?.textContent, 'el nombre del producto, en su propio renglón').toBe(
      'Diploma Internacional del Gestor Parlamentario 1',
    );
    const texto = v.contenedor.textContent ?? '';
    expect(texto).toContain('Escuela');
    expect(texto).toContain('300.00 PEN');
    expect(texto).toMatch(/28 abr/);
    v.desmontar();
  });

  it('con más de una compra dice cuántas más hay, sin perder la última', () => {
    const v = montar(
      <TilesResumen
        actividad={null}
        compra={COMPRA}
        totalCompras={3}
        montoTotal={{ n: 3, total: 1200, moneda: 'PEN' }}
      />,
    );
    expect(v.contenedor.querySelector('[data-producto]')).not.toBeNull();
    expect(v.contenedor.textContent).toContain('3 compras');
    expect(v.contenedor.textContent).toContain('PEN 1200 en total');
    v.desmontar();
  });

  it('una compra sin productos cargados se nombra por su folio, nunca con un hueco', () => {
    const v = montar(
      <TilesResumen actividad={null} compra={{ ...COMPRA, productos: [] }} totalCompras={1} />,
    );
    expect(v.contenedor.querySelector('[data-producto]')?.textContent).toBe('GOB-1');
    v.desmontar();
  });

  it('el vacío honesto: sin actividad ni compras, lo dice, no inventa un cero engañoso', () => {
    const v: Montado = montar(<TilesResumen actividad={null} compra={null} totalCompras={0} />);
    expect(v.contenedor.textContent).toContain('Sin actividad todavía');
    expect(v.contenedor.textContent).toContain('Sin compras');
    v.desmontar();
  });

  it('la señal se marca con su chip, no como «IA»', () => {
    const v: Montado = montar(
      <TilesResumen
        actividad={{ rotulo: 'Cotización', timestamp: '2026-08-14T15:00:00Z', esSenal: true }}
        compra={null}
        totalCompras={0}
      />,
    );
    expect(v.contenedor.textContent).toContain('Cotización');
    expect(v.contenedor.textContent).toContain('Señal');
    expect(v.contenedor.textContent).not.toContain('IA');
    v.desmontar();
  });

  it('«Ver todas» solo aparece con handler Y con al menos una compra', () => {
    const onVer = vi.fn();
    const sinHandler = montar(<TilesResumen actividad={null} compra={COMPRA} totalCompras={1} />);
    expect(sinHandler.contenedor.textContent).not.toContain('Ver todas');
    sinHandler.desmontar();

    const conHandler = montar(
      <TilesResumen actividad={null} compra={COMPRA} totalCompras={1} onVerTodasLasCompras={onVer} />,
    );
    const boton = [...conHandler.contenedor.querySelectorAll('button')].find((b) => /ver todas/i.test(b.textContent ?? ''));
    expect(boton).toBeDefined();
    boton!.click();
    expect(onVer).toHaveBeenCalledOnce();
    conHandler.desmontar();
  });

  it('con cero compras no ofrece «Ver todas» aunque haya handler — la regla del cero', () => {
    const v = montar(<TilesResumen actividad={null} compra={null} totalCompras={0} onVerTodasLasCompras={() => {}} />);
    expect(v.contenedor.textContent).not.toContain('Ver todas');
    v.desmontar();
  });

  /**
   * 🔴 LO QUE REEMPLAZA A «NO SE PUDO SABER» (dueño, 13-sep-2026: «no me gusta»).
   * Si la ficha no cargó, «Sin compras» sería mentir —no sabemos—, y el chip
   * amarillo de la cabecera no daba ninguna salida. El renglón de compras lo dice
   * en palabras de la vendedora y le da el botón.
   */
  it('si la ficha no cargó, el renglón de compras NO dice «Sin compras»: dice que no cargó y ofrece reintentar', () => {
    const onReintentar = vi.fn();
    const v = montar(
      <TilesResumen actividad={null} compra={null} totalCompras={0} estadoCompras="error" onReintentar={onReintentar} />,
    );
    const texto = v.contenedor.textContent ?? '';
    expect(texto).not.toContain('Sin compras');
    expect(texto).toMatch(/no cargaron/i);
    const boton = [...v.contenedor.querySelectorAll('button')].find((b) => /reintentar/i.test(b.textContent ?? ''));
    expect(boton, 'la salida es un botón, no una frase').toBeDefined();
    boton!.click();
    expect(onReintentar).toHaveBeenCalledOnce();
    v.desmontar();
  });

  it('mientras la ficha viaja tampoco se afirma «Sin compras»', () => {
    const v = montar(<TilesResumen actividad={null} compra={null} totalCompras={0} estadoCompras="cargando" />);
    expect(v.contenedor.textContent).not.toContain('Sin compras');
    expect(v.contenedor.querySelector('[data-esqueleto]')).not.toBeNull();
    v.desmontar();
  });
});
