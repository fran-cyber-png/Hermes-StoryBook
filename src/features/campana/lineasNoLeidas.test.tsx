// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, type Montado } from '../../pruebas/dom';
import { MENSAJE_LINEAS_NO_LEIDAS, respuestaLineasNoLeidas } from '../../pruebas/lineasNoLeidas';
import { PantallaHistorial } from './PantallaHistorial';
import { PantallaListas } from './PantallaListas';

/**
 * 🔴 UN 503 NO ES SIEMPRE «FALTA LA MIGRACIÓN» (ADR 0108, #952).
 *
 * `/api/campana` va detrás del guard `deVentas`, y desde ADR 0108 ese guard contesta 503
 * `lineas_no_leidas` cuando no puede leer las líneas de quien pide. Estas dos pantallas leían
 * cualquier 503 como la migración 0019 que falta: ante un hipo de la base le decían a la vendedora
 * que falta un paso de sistemas que ya está hecho. Se mira el código del cuerpo, no el status.
 */

let vista: Montado | null = null;

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

const texto = () => document.body.textContent ?? '';

/** El 503 que la ruta de campaña manda de verdad cuando la tabla no existe (`routes/campana.ts`). */
const faltaLaMigracion = () =>
  new Response(JSON.stringify({ ok: false, motivo: 'sin_migracion', message: 'falta aplicar la migración 0019' }), {
    status: 503,
    headers: { 'content-type': 'application/json' },
  });

const PANTALLAS: [string, () => ReactElement][] = [
  ['el historial', () => <PantallaHistorial />],
  ['las listas', () => <PantallaListas />],
];

describe.each(PANTALLAS)('%s de campaña ante un 503', (_nombre, pantalla) => {
  it('🔴 «no pudimos leer tus líneas» se dice como lo dijo el server, no como una migración que falta', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(respuestaLineasNoLeidas())));
    vista = montar(pantalla());

    await esperarA(() => texto().includes(MENSAJE_LINEAS_NO_LEIDAS), 'que la pantalla diga lo que dijo el server');
    expect(texto()).not.toContain('Falta aplicar la migración');
  });

  it('y la migración que falta de verdad se sigue nombrando', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(faltaLaMigracion())));
    vista = montar(pantalla());

    await esperarA(() => texto().includes('Falta aplicar la migración'), 'que siga nombrando la migración');
  });
});
