// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { montar, reposar, type Montado } from '../../pruebas/dom';
import { EncabezadoTimeline } from './EncabezadoTimeline';

/**
 * EL MOTIVO JUNTO A «DIJO QUE NO», EN LA FICHA (ADR 0107).
 *
 * La ficha muestra la etapa y no la declara (eso es de la barra del chat). Con `perdido`,
 * el chip dice también POR QUÉ: es lo que alguien necesita leer antes de volver a
 * escribirle a esa persona, y lo único que un supervisor no puede reconstruir después.
 *
 * El `Avatar` pide la foto por la red: `fetch` contesta 503 y se dibujan las iniciales. El
 * `localStorage` se simula porque el jsdom de este repo no lo trae y `api()` lo lee.
 */

let vista: Montado | null = null;

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":false}', { status: 503 })));
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

const BASE = {
  nombre: 'Javier Peralta',
  telefono: '',
  canal: 'whatsapp',
  acento: 'neutro' as const,
  tituloEstado: '',
  compras: null,
  chips: [],
};

const chipDeEtapa = () => vista!.contenedor.querySelector('[data-etapa]');

describe('EncabezadoTimeline — la razón de la pérdida junto a la etapa', () => {
  it('🔴 con «Dijo que no» el chip dice el motivo, y el detalle queda al pasar el mouse', async () => {
    vista = montar(<EncabezadoTimeline {...BASE} etapa="perdido" perdida={{ motivo: 'precio', detalle: 'le pareció caro' }} />);
    await reposar();

    expect(chipDeEtapa()?.textContent).toBe('Dijo que no · Precio');
    expect(chipDeEtapa()?.getAttribute('title')).toBe('le pareció caro');
  });

  it('una perdida de antes, sin motivo, dice sólo «Dijo que no»: no se inventa uno', async () => {
    vista = montar(<EncabezadoTimeline {...BASE} etapa="perdido" perdida={{ motivo: null, detalle: null }} />);
    await reposar();

    expect(chipDeEtapa()?.textContent).toBe('Dijo que no');
    expect(chipDeEtapa()?.hasAttribute('title')).toBe(false);
  });

  it('si la conversación ya no está perdida, un motivo que llegue no se muestra', async () => {
    vista = montar(<EncabezadoTimeline {...BASE} etapa="contactado" perdida={{ motivo: 'precio', detalle: null }} />);
    await reposar();

    expect(chipDeEtapa()?.textContent).not.toContain('Precio');
  });
});
