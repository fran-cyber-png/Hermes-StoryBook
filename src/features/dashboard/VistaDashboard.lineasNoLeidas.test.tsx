// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, tocar, type Montado } from '../../pruebas/dom';
import { MENSAJE_LINEAS_NO_LEIDAS as MENSAJE, respuestaLineasNoLeidas } from '../../pruebas/lineasNoLeidas';
import { VistaDashboard } from './VistaDashboard';

/**
 * 🔴 SI EL SERVER NO PUDO LEER LAS LÍNEAS, «HOY» LO DICE Y OFRECE REINTENTAR (#952, ADR 0108).
 *
 * Desde ADR 0108 el server cierra con 503 `lineas_no_leidas` en vez de servir de más. Si «Hoy» se
 * quedara con su «no llegó del servidor, se vuelve a pedir solo en un minuto», quien mira no sabría
 * qué pasó ni tendría qué hacer: tiene que leer lo que dijo el server y tener un botón que vuelva
 * a pedir. Y si la falla llega en un refresco, con cifras ya en pantalla, esas cifras se quedan
 * pero no pasan por frescas: el aviso va encima, como en la cola.
 */

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

let vista: Montado | null = null;
let pedidosDeHoy = 0;
let fallaLaLectura = true;

const json = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  pedidosDeHoy = 0;
  fallaLaLectura = true;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: unknown) => {
      if (String(url).includes('/api/dashboard/hoy')) {
        pedidosDeHoy += 1;
        return Promise.resolve(fallaLaLectura ? respuestaLineasNoLeidas() : json(HOY, 200));
      }
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
const botonReintentar = () =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Reintentar'));

describe('«Hoy» cuando el server no pudo leer las líneas', () => {
  it('🔴 dice lo que dijo el server y un botón vuelve a pedir, en vez de esperar un minuto en blanco', async () => {
    vista = montar(<VistaDashboard onAbrirPipeline={() => {}} />);

    await esperarA(() => texto().includes(MENSAJE), 'que «Hoy» muestre el mensaje del 503');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(MENSAJE);
    const boton = botonReintentar();
    expect(boton, 'tiene que haber un botón para reintentar').toBeDefined();

    fallaLaLectura = false;
    tocar(boton!);

    await esperarA(() => !texto().includes(MENSAJE), 'que el reintento traiga «Hoy»');
    expect(pedidosDeHoy).toBe(2);
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('🔴 si falla un refresco con cifras en pantalla, las deja pero avisa encima y ofrece reintentar', async () => {
    fallaLaLectura = false;
    vista = montar(<VistaDashboard onAbrirPipeline={() => {}} />);
    await esperarA(() => texto().includes('El equipo hoy'), 'que «Hoy» llegue');

    fallaLaLectura = true;
    tocar(document.querySelector<HTMLButtonElement>('button[aria-label="Actualizar las cifras de hoy"]')!);

    await esperarA(() => texto().includes(MENSAJE), 'que el refresco caído se diga encima de las cifras');
    expect(texto(), 'las cifras que ya estaban no se borran').toContain('El equipo hoy');

    fallaLaLectura = false;
    tocar(botonReintentar()!);

    await esperarA(() => !texto().includes(MENSAJE), 'que el reintento quite el aviso');
    expect(pedidosDeHoy).toBe(3);
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });
});
