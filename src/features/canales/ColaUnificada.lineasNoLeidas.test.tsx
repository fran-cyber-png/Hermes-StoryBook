// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, tocar, type Montado } from '../../pruebas/dom';
import { MENSAJE_LINEAS_NO_LEIDAS as MENSAJE, respuestaLineasNoLeidas } from '../../pruebas/lineasNoLeidas';
import { ColaUnificada } from './ColaUnificada';

/**
 * 🔴 SI EL SERVER NO PUDO LEER LAS LÍNEAS, LA COLA LO DICE Y OFRECE REINTENTAR (#952, ADR 0108).
 *
 * Desde ADR 0108 el server cierra con 503 `lineas_no_leidas` en vez de servir de más. Sin manejarlo,
 * react-query deja la consulta en error y sin datos, así que la cola se veía VACÍA: con la frescura
 * al día, eso es «Estás al día», un festejo encima de una falla. La vendedora tiene que leer lo que
 * dijo el server y tener un botón que vuelva a pedir.
 *
 * Se monta `ColaUnificada` de verdad, con cada endpoint que pide al montar respondido de mentira.
 */

const AHORA = new Date().toISOString();

const CONVERSACION = {
  clave: 'conv:whatsapp:51933330003:51970356062',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51933330003',
  persona_nombre: 'Rosa Quispe',
  numero_propio: '51970356062',
  texto: 'Hola, ¿cuánto cuesta el diplomado?',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: true,
  n: 1,
  referencia: 'r1',
  ultimo_at: AHORA,
  dias: 0,
  nivel: 3,
};

let vista: Montado | null = null;
let fallaLaLectura = true;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  fallaLaLectura = true;
  vi.stubGlobal(
    'fetch',
    vi.fn((entrada: unknown) => {
      const url = String(entrada);
      if (url.includes('intencion=pregunto-precio')) return Promise.resolve(json({ conversaciones: [], total: 0, hayMas: false }));
      if (url.includes('/api/conversaciones/estado')) return Promise.resolve(json({ ok: true }));
      if (url.includes('/api/conversaciones')) {
        return Promise.resolve(
          fallaLaLectura ? respuestaLineasNoLeidas() : json({ conversaciones: [CONVERSACION], total: 1, hayMas: false }),
        );
      }
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
const botonReintentar = () => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Reintentar'));

describe('la cola cuando el server no pudo leer las líneas', () => {
  it('🔴 dice lo que dijo el server, no festeja «Estás al día», y un botón vuelve a pedir', async () => {
    vista = montar(<ColaUnificada seleccionada={null} onSeleccionar={() => {}} miVendedora="luz" />);

    await esperarA(() => texto().includes(MENSAJE), 'que la cola muestre el mensaje del 503');
    expect(texto()).not.toContain('Estás al día');
    const boton = botonReintentar();
    expect(boton, 'tiene que haber un botón para reintentar').toBeDefined();

    fallaLaLectura = false;
    tocar(boton!);

    await esperarA(() => texto().includes('Rosa Quispe'), 'que el reintento traiga la cola');
    expect(texto()).not.toContain(MENSAJE);
  });
});
