// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { PanelDerecho } from './PanelDerecho';

/**
 * LA RAZÓN DE LA PÉRDIDA EN LA FICHA — EL CABLEADO (ADR 0107).
 *
 * `EncabezadoTimeline.perdida.test.tsx` fija cómo se dibuja el motivo si llega. Lo que ese
 * test no ve es si el panel lo PIDE y se lo PASA (ADR 0024: el defecto suele estar en
 * quién llama). Y tiene dos mitades, como `PanelDerecho.campana.test.tsx`: la conversación
 * perdida pide el historial y dice el motivo; la que no está perdida no lo pide, porque
 * sería una consulta más en cada ficha sin nada que mostrar.
 *
 * `fetch` contesta el historial y rechaza todo lo demás; `localStorage` se simula porque
 * el jsdom de este repo no lo trae y `api()` lo lee antes de llegar al `fetch`.
 */

const CONTACTO: Conversacion = {
  clave: 'conv:whatsapp:51987654321:51963139984',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51987654321',
  persona_nombre: 'Javier Peralta',
  numero_propio: '51963139984',
  texto: null,
  contexto_texto: null,
  respondida: false,
  ventana_abierta: false,
  pregunto: false,
  n: 0,
  referencia: '2026-09-10T14:00:00.000Z',
  ultimo_at: '2026-09-10T14:00:00.000Z',
  dias: 0,
  nivel: 5,
};

let vista: Montado | null = null;
let pedidos: string[] = [];

beforeEach(() => {
  pedidos = [];
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown) => {
      const ruta = String(url);
      pedidos.push(ruta);
      if (ruta.includes('/api/gestiones/de/')) {
        return new Response(
          JSON.stringify({ etapa: 'perdido', gestiones: [], perdida: { motivo: 'precio', detalle: 'le pareció caro' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error('sin server en el test');
    }),
  );
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

describe('el panel derecho y la razón de la pérdida', () => {
  it('🔴 con la conversación en «Dijo que no», la ficha pide el historial y dice el motivo', async () => {
    vista = montar(<PanelDerecho conversacion={{ ...CONTACTO, etapa_efectiva: 'perdido' }} miVendedora="luz" />);

    await esperarA(
      () => vista!.contenedor.querySelector('[data-etapa="perdido"]')?.textContent === 'Dijo que no · Precio',
      'la ficha dijo por qué se perdió',
    );
  });

  it('si no está perdida, no pide el historial: sería una consulta más por ficha sin nada que mostrar', async () => {
    vista = montar(<PanelDerecho conversacion={{ ...CONTACTO, etapa_efectiva: 'contactado' }} miVendedora="luz" />);
    await reposar();

    expect(pedidos.filter((p) => p.includes('/api/gestiones/de/'))).toEqual([]);
    expect(vista.contenedor.querySelector('[data-etapa="contactado"]'), 'la etapa se sigue dibujando').not.toBeNull();
  });
});
