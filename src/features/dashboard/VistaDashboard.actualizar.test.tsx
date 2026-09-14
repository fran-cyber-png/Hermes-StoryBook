// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, type Montado } from '../../pruebas/dom';
import { VistaDashboard } from './VistaDashboard';

/**
 * «ACTUALIZAR» NO PUEDE DUPLICAR UN PEDIDO EN VUELO — el cableado del botón de «Hoy».
 *
 * Cada pedido de «Hoy» arma en el server la `todo` de la cola (1 a 2 s medidos en
 * producción). Con `refetch()` a secas, react-query CANCELA el pedido en vuelo y
 * lanza otro: el `fetch` ya salió, así que dos clics seguidos son dos consultas
 * pesadas en el server, y la impaciencia de quien mira se paga en la base. El
 * segundo clic se tiene que sumar al pedido que ya está en camino.
 */

let vista: Montado | null = null;
let pedidosDeHoy = 0;

const HOY = {
  inicioDeHoy: '2026-09-10T05:00:00.000Z',
  generadoEn: '2026-09-10T15:00:00.000Z',
  supervisor: true,
  modulo: 'ventas',
  lineas: [],
  escribieron: { total: 0, porLinea: [] },
  sinRespuesta: { total: 0, porDuena: [], porLinea: [] },
  calientesSinDuena: { total: 0, porLinea: [] },
  personas: [],
  sinAtribuir: [],
};

beforeEach(() => {
  pedidosDeHoy = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: unknown) => {
      if (String(url).includes('/api/dashboard/hoy')) {
        pedidosDeHoy += 1;
        // Tarda a propósito: el segundo clic tiene que caer con el primero en vuelo.
        return new Promise<Response>((listo) =>
          setTimeout(
            () => listo(new Response(JSON.stringify(HOY), { status: 200, headers: { 'content-type': 'application/json' } })),
            80,
          ),
        );
      }
      return Promise.reject(new Error('sin server en el test'));
    }),
  );
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

describe('«Actualizar» de «Hoy»', () => {
  it('🔴 dos clics seguidos dan UN solo pedido: el segundo se suma al que ya está en vuelo', async () => {
    vista = montar(<VistaDashboard onAbrirPipeline={() => {}} />);
    await esperarA(
      () => (vista!.contenedor.textContent ?? '').includes('Escribieron por primera vez hoy'),
      'que llegue la primera respuesta de «Hoy»',
    );
    expect(pedidosDeHoy).toBe(1);

    const boton = vista.contenedor.querySelector<HTMLButtonElement>('[aria-label="Actualizar las cifras de hoy"]');
    expect(boton, 'el botón «Actualizar» tiene que estar en la cabecera de «Hoy»').toBeTruthy();
    boton!.click();
    boton!.click();
    await new Promise((listo) => setTimeout(listo, 300));

    expect(pedidosDeHoy, 'dos clics seguidos no pueden lanzar dos pedidos').toBe(2);
  });
});
