// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { descargarAutenticado } from './descargarArchivo';

// jsdom no le pasa `localStorage` a vitest (ver `pruebas/dom.tsx`): la sesión se da por hecha.
vi.mock('./token', () => ({ tokenGuardado: () => 'tok' }));

/**
 * LO QUE DESCARGAR PIDE Y GUARDA — con la sesión, y con la extensión de lo que llegó.
 *
 * La imagen de un comentario sale de Meta sin nombre ni extensión conocida
 * (`.../12345_n.jpg?oh=…` o un GIF): la extensión la pone el tipo que devolvió
 * el server, y sin ella Windows no sabe con qué abrir el archivo.
 */

let guardados: string[] = [];
let pedidos: { url: string; auth: string | null }[] = [];

beforeEach(() => {
  guardados = [];
  pedidos = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    guardados.push(this.download);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function responder(status: number, tipo = 'image/gif') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      pedidos.push({ url, auth: new Headers(init?.headers).get('authorization') });
      return { ok: status < 400, status, blob: async () => new Blob(['x'], { type: tipo }) } as unknown as Response;
    }),
  );
}

describe('descargarAutenticado', () => {
  it('pide con la sesión y guarda con la extensión del tipo que llegó', async () => {
    responder(200, 'image/gif');
    await descargarAutenticado('https://api.test/api/comentario/7/imagen', 'imagen-del-comentario');
    expect(pedidos).toEqual([{ url: 'https://api.test/api/comentario/7/imagen', auth: 'Bearer tok' }]);
    expect(guardados).toEqual(['imagen-del-comentario.gif']);
  });

  it('si el server no la entrega, falla (y no guarda un archivo con el error adentro)', async () => {
    responder(404);
    await expect(descargarAutenticado('https://api.test/x', 'x')).rejects.toThrow();
    expect(guardados).toEqual([]);
  });
});
