// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import { limpiarBlobsAutenticados } from '../../lib/datos/blobAutenticado';
import { BotonDescargarAdjunto } from './BotonDescargarAdjunto';
import type { MediaHilo } from './conversacionWa';

/**
 * EL CABLEADO DE DESCARGAR — lo que `nombreDeDescarga` no ve: que el botón de la
 * burbuja guarde con el nombre legible, incluso cuando el archivo todavía no
 * estaba bajado, y sin volver a pedirlo al server la segunda vez.
 */

const FOTO: MediaHilo = { clase: 'imagen', archivo: 'wa-3EB0.jpg', mime: 'image/jpeg' };
const CUANDO = '2026-09-11T15:30:00-05:00';

let montado: Montado | null = null;
let guardados: { href: string; download: string }[] = [];

beforeEach(() => {
  limpiarBlobsAutenticados();
  guardados = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    guardados.push({ href: this.href, download: this.download });
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(['x'], { type: 'image/jpeg' }) }) as unknown as Response),
  );
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('BotonDescargarAdjunto', () => {
  it('🔴 con el archivo SIN bajar, un solo clic lo baja y lo guarda al llegar', async () => {
    montado = montar(<BotonDescargarAdjunto media={FOTO} cuando={CUANDO} />);

    tocar(document.querySelector('button')!);
    await esperarA(() => guardados.length === 1, 'que se guarde al terminar de bajar');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(guardados[0].download).toBe('imagen-2026-09-11.jpg');
    expect(guardados[0].href).toMatch(/^blob:/);
  });

  it('el segundo clic no vuelve a pedirlo al server', async () => {
    montado = montar(<BotonDescargarAdjunto media={FOTO} cuando={CUANDO} />);
    tocar(document.querySelector('button')!);
    await esperarA(() => guardados.length === 1, 'la primera descarga');

    tocar(document.querySelector('button')!);
    await reposar();
    expect(guardados).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
