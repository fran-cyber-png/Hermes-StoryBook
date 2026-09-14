// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, type Montado } from '../../pruebas/dom';
import { ColaUnificada } from './ColaUnificada';

/**
 * 🔴 EN CAMPAÑA LA COLA NO OFRECE «LOS QUE PREGUNTARON PRECIO» (regla del dueño, 13-sep-2026:
 * «no debería decir preguntó precio en ningún caso para campaña»).
 *
 * El vacío «Estás al día» ofrece como salida el chip de plata —«Ver los N que preguntaron
 * precio →»— y lo contaba sin mirar el módulo, así que un operador de campaña al día leía un
 * rótulo de venta. La fila ya lo callaba (`FilaConversacion`) y el Pipeline también
 * (`dominio/semaforo.ts`); acá faltaba. Se monta `ColaUnificada` de verdad, con la cola vacía y
 * un conteo de precio que NO es cero: si el botón aparece, es porque nadie miró el módulo.
 */

const AHORA = new Date().toISOString();

let vista: Montado | null = null;
let pedidos: string[] = [];

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  pedidos = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((entrada: unknown) => {
      const url = String(entrada);
      pedidos.push(url);
      if (url.includes('intencion=pregunto-precio')) return Promise.resolve(json({ conversaciones: [], total: 7, hayMas: false }));
      if (url.includes('/api/conversaciones/estado')) return Promise.resolve(json({ ok: true }));
      if (url.includes('/api/conversaciones')) return Promise.resolve(json({ conversaciones: [], total: 0, hayMas: false }));
      if (url.includes('/api/whatsapp/sesion')) return Promise.resolve(json({ transporte: 'cloud-api' }));
      if (url.includes('/api/whatsapp/lineas')) return Promise.resolve(json({ lineas: [] }));
      if (url.includes('/api/interactions/frescura')) return Promise.resolve(json({ ultimoDato: AHORA, ultimaIngesta: AHORA, total: 1200 }));
      if (url.includes('/api/categorias')) return Promise.resolve(json({ categorias: [] }));
      if (url.includes('/api/agenda')) return Promise.resolve(json({ recordatorios: [] }));
      if (url.includes('/api/dashboard')) return Promise.resolve(json({ porVendedora: [] }));
      return Promise.resolve(json({}, 404));
    }),
  );
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

const texto = () => document.body.textContent ?? '';

describe('el vacío «Estás al día» y el chip de precio', () => {
  it('en ventas ofrece «Ver los N que preguntaron precio»', async () => {
    vista = montar(<ColaUnificada seleccionada={null} onSeleccionar={() => {}} miVendedora="luz" />);
    await esperarA(() => texto().includes('preguntaron precio'), 'el botón del chip de plata en ventas');
    expect(texto()).toContain('Ver los 7 que preguntaron precio');
  });

  it('🔴 en campaña no lo ofrece, ni pide el conteo', async () => {
    vista = montar(<ColaUnificada seleccionada={null} onSeleccionar={() => {}} miVendedora="luz" esDeCampana />);
    await esperarA(() => texto().includes('Estás al día'), 'el vacío «Estás al día» en campaña');
    await reposar();
    expect(texto()).not.toMatch(/precio/i);
    expect(pedidos.some((u) => u.includes('intencion=pregunto-precio')), 'pidió el conteo de precio en campaña').toBe(false);
  });
});
