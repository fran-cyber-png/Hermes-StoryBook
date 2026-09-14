// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { escribir, montar, reposar, teclear, tocar, type Montado } from '../../pruebas/dom';
import { CLAVE_CATALOGO, type HechoDelCatalogo, type RespuestaCatalogo } from '../hechos/catalogo';
import { CATALOGO_MEDIDO_10_SEP } from './catalogoMedido';
import { VistaProductos } from './VistaProductos';

/**
 * EL CABLEADO DE LA VISTA — montada de verdad, con el catálogo medido.
 *
 * `productos.test.ts` prueba las REGLAS; esto prueba que la vista las LLAMA. Es la
 * lección de ADR 0024 y 0068, y la de ADR 0082 dicha con otras palabras: nueve tests
 * puros en verde y una captura perfecta de una feature que en la app estaba muerta
 * porque nadie cableaba la función.
 */

const CLAVE_NEGOCIO = 'hermes.productos.negocio';

let m: Montado | null = null;
const copiar = vi.fn<(texto: string) => Promise<void>>();

beforeEach(() => {
  copiar.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: copiar }, configurable: true });
  // Nada de red: si la vista pidiera algo que no está sembrado, el test lo tiene que ver fallar.
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sin red en el test'))));
});

afterEach(() => {
  m?.desmontar();
  m = null;
  // `useLocalStorage` cachea por módulo: se le avisa como si otra pestaña lo hubiera borrado.
  localStorage.removeItem(CLAVE_NEGOCIO);
  window.dispatchEvent(new StorageEvent('storage', { key: CLAVE_NEGOCIO, newValue: null }));
  vi.unstubAllGlobals();
});

function sembrar(hechos: HechoDelCatalogo[] = []) {
  return (c: QueryClient) => {
    c.setQueryData(['productos', 'catalogo'], { productos: CATALOGO_MEDIDO_10_SEP });
    c.setQueryData<RespuestaCatalogo>(CLAVE_CATALOGO, { hechos, editable: true, origen: 'tabla' });
  };
}

function dato(clave: string, texto: string, familia: string | null = null): HechoDelCatalogo {
  return { clave, rotulo: clave, texto, momentos: [], orden: 100, activo: true, familia };
}

const botonDeNegocio = (nombre: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Negocio"] button')].find((b) =>
    b.textContent?.startsWith(nombre),
  )!;
const selectores = () => [...document.querySelectorAll('select')].map((s) => s.options[0]?.textContent);
const hoja = () => document.querySelector('[role="dialog"]');
const tarjeta = (nombre: string) =>
  document.querySelector<HTMLButtonElement>(`button[aria-label="Ver el detalle de ${nombre}"]`)!;

function elegir(select: HTMLSelectElement, valor: string) {
  act(() => {
    select.value = valor;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('VistaProductos — negocio manda, y lo de abajo se recorta montado', () => {
  it('abre en Escuela con sus 99 productos y los dos selectores', () => {
    m = montar(<VistaProductos />, sembrar());
    expect(botonDeNegocio('Escuela').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('article')).toHaveLength(99);
    expect(selectores()).toEqual(['División', 'Categoría']);
  });

  it('LifeStyle › Inteligencia: el selector de Categoría NO se dibuja (regla del cero, cableada)', () => {
    m = montar(<VistaProductos />, sembrar());
    tocar(botonDeNegocio('LifeStyle'));
    elegir(document.querySelector('select')!, 'Inteligencia');
    expect(selectores()).toEqual(['División']);
    expect(document.querySelectorAll('article')).toHaveLength(10);
  });

  it('cambiar de negocio suelta la división que el negocio nuevo no tiene', () => {
    m = montar(<VistaProductos />, sembrar());
    elegir(document.querySelector('select')!, 'Inteligencia');
    tocar(botonDeNegocio('Consultoria'));
    expect(document.querySelector('select')!.value).toBe('');
    expect(document.querySelectorAll('article')).toHaveLength(7);
  });

  it('una búsqueda que deja a la división elegida sin productos la suelta: nunca un filtro escondido (B1 de #961)', () => {
    m = montar(<VistaProductos />, sembrar());
    elegir(document.querySelector('select')!, 'Inteligencia');
    escribir(document.querySelector<HTMLInputElement>('input[type="search"]')!, 'oratoria');
    // «Oratoria» en la Escuela es sólo de Estrategia Política: con una sola división
    // posible el selector no se dibuja, y un filtro que no se ve no puede seguir recortando.
    expect(document.querySelectorAll('article').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('Nada con «oratoria»');
  });

  it('la búsqueda sin resultados ofrece el otro negocio, y tocarlo lo cambia', () => {
    m = montar(<VistaProductos />, sembrar());
    tocar(botonDeNegocio('Editorial'));
    escribir(document.querySelector<HTMLInputElement>('input[type="search"]')!, 'contraterrorismo');
    const irA = [...document.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Ver en Escuela'))!;
    tocar(irA);
    expect(botonDeNegocio('Escuela').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('article').length).toBeGreaterThan(0);
  });

  it('el negocio elegido se recuerda al volver a abrir la vista (D1)', () => {
    m = montar(<VistaProductos />, sembrar());
    tocar(botonDeNegocio('Editorial'));
    m.desmontar();
    m = montar(<VistaProductos />, sembrar());
    expect(botonDeNegocio('Editorial').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('VistaProductos — la hoja del producto', () => {
  it('tocar una tarjeta abre su hoja, y Escape la cierra', () => {
    m = montar(<VistaProductos />, sembrar());
    tocar(tarjeta('Diplomado en Inteligencia y Contrainteligencia'));
    expect(hoja()?.textContent).toContain('DIPICOT027');
    teclear('Escape');
    expect(hoja()).toBeNull();
  });

  it('«Copiar precio para el chat» deja la línea del producto, y es la única acción primaria', async () => {
    m = montar(<VistaProductos />, sembrar());
    tocar(tarjeta('Curso de Especialización Oratoria para Políticos'));
    const primaria = [...hoja()!.querySelectorAll('button')].filter((b) => b.className.includes('bg-primary'));
    expect(primaria).toHaveLength(1);
    tocar(primaria[0]);
    await reposar();
    expect(copiar).toHaveBeenCalledWith(
      'Curso de Especialización Oratoria para Políticos: USD 80 (precio regular USD 150).',
    );
  });

  it('el pago por país sale en cualquier producto; el precio, SOLO en el de su familia', () => {
    const hechos = [
      dato('pago-peru', 'Se paga por transferencia a la Escuela.'),
      dato('precio-peru', 'En Perú el diploma cuesta S/ 500.', 'DIPICOT'),
    ];
    m = montar(<VistaProductos />, sembrar(hechos));

    tocar(tarjeta('Curso de Especialización Oratoria para Políticos'));
    expect(hoja()!.textContent).toContain('Se paga por transferencia a la Escuela.');
    expect(hoja()!.textContent).not.toContain('S/ 500');

    tocar(tarjeta('Diplomado en Inteligencia y Contrainteligencia'));
    expect(hoja()!.textContent).toContain('En Perú el diploma cuesta S/ 500.');
  });

  it('HOY, con los precios sin familia, ninguna hoja muestra un precio por país', () => {
    m = montar(<VistaProductos />, sembrar([dato('precio-peru', 'En Perú el diploma cuesta S/ 500.')]));
    tocar(tarjeta('Diplomado en Inteligencia y Contrainteligencia'));
    expect(hoja()!.textContent).not.toContain('S/ 500');
    expect(hoja()!.textContent).not.toContain('Por país');
  });
});
