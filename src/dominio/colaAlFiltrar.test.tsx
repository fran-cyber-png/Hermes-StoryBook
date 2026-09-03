// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { montar, esperarA, tocar, type Montado } from '../pruebas/dom';
import { useConversaciones } from './conversaciones';

/**
 * 🔴 FILTRAR NO PUEDE VACIAR LA PANTALLA.
 *
 * ── El defecto que fija ──
 * La `queryKey` de la cola lleva los filtros adentro (`['conversaciones', base]`),
 * así que cada tab, cada chip y cada cambio de línea es una clave NUEVA: fallo de
 * caché garantizado. Sin `placeholderData`, `items` volvía a `[]` y la mesa de
 * trabajo quedaba en blanco hasta que contestara el servidor — p50 de **3,73 s**
 * medido en producción el 21-ago, y eso DESPUÉS de soltar el pool.
 *
 * Se lee como «la app tarda en renderizar» y no es el render: es la pantalla
 * vaciándose.
 *
 * ── Por qué montado y no puro ──
 * Lo que se rompe acá no es una función: es el comportamiento del hook cuando la
 * clave cambia. Un test puro sobre `parametrosDeCola` seguiría verde con la cola
 * parpadeando en cada clic — la lección de ADR 0024, otra vez: el defecto vive en
 * el CABLEADO.
 */
describe('la cola no se vacía al cambiar de filtro', () => {
  const respuestas: Record<string, string[]> = {
    todo: ['ana', 'beto', 'cata'],
    'pregunto-precio': ['dora'],
  };
  let resolverEl: ((v: unknown) => void) | null = null;

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const cual = url.includes('intencion=pregunto-precio') ? 'pregunto-precio' : 'todo';
        const cuerpo = {
          conversaciones: respuestas[cual].map((n) => ({
            clave: `conv:whatsapp:${n}:519`,
            canal: 'whatsapp',
            tipo: 'mensaje',
            persona_id: n,
            persona_nombre: n,
            texto: n,
          })),
          total: respuestas[cual].length,
          hayMas: false,
        };
        const responder = () =>
          Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(cuerpo) } as Response);
        // El segundo pedido (el del filtro) se deja EN VUELO a propósito: es
        // exactamente el instante que este test mira.
        if (cual === 'pregunto-precio') {
          return new Promise((r) => {
            resolverEl = () => void r(responder());
          });
        }
        return responder();
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resolverEl = null;
  });

  /**
   * ⚠️ **El filtro es estado INTERNO, y esa es la mitad del contrato.**
   * `keepPreviousData` vive en el observador de la query: conserva la página
   * anterior cuando la CLAVE cambia bajo un componente montado. Si el componente
   * se desmonta y se vuelve a montar, no hay anterior que conservar y esto no
   * sirve de nada.
   *
   * Es exactamente lo que hace la app: `ColaUnificada` guarda `tab`, `filtroSec`
   * y `linea` en su propio `useState`/`useLocalStorage` y sigue montada. Un test
   * que remontara estaría midiendo otro sistema — y en la primera versión de este
   * archivo lo hacía, y daba cero: el defecto correcto sobre el montaje equivocado.
   */
  function Sonda() {
    const [filtro, setFiltro] = useState('');
    const { items, actualizando } = useConversaciones(filtro);
    return (
      <div>
        <span data-testid="n">{items.length}</span>
        <span data-testid="trayendo">{actualizando ? 'sí' : 'no'}</span>
        <button data-testid="filtrar" onClick={() => setFiltro('pregunto-precio')}>
          filtrar
        </button>
      </div>
    );
  }

  it('mientras trae el filtro nuevo, sigue mostrando las filas anteriores', async () => {
    const m: Montado = montar(<Sonda />);
    await esperarA(
      () => m.contenedor.querySelector('[data-testid="n"]')?.textContent === '3',
      'que cargue la cola sin filtro',
    );

    // Cambia el filtro SIN remontar: clave nueva, pedido en vuelo, respuesta
    // todavía sin llegar. Es lo que pasa cuando la vendedora toca un chip.
    tocar(m.contenedor.querySelector('[data-testid="filtrar"]')!);
    await esperarA(
      () => m.contenedor.querySelector('[data-testid="trayendo"]')?.textContent === 'sí',
      'que arranque el pedido del filtro',
    );

    // 🔴 LO QUE IMPORTA: no es cero. La mesa sigue teniendo filas mientras carga.
    const n = m.contenedor.querySelector('[data-testid="n"]')?.textContent;
    expect(n, 'la cola se vació al filtrar: volvió el defecto que este test fija').not.toBe('0');

    // Y cuando llega la respuesta, se reemplaza por la de verdad.
    resolverEl?.(null);
    await esperarA(
      () => m.contenedor.querySelector('[data-testid="n"]')?.textContent === '1',
      'que el filtro nuevo reemplace a lo anterior',
    );
  });
});
