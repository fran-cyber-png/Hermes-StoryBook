// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { montar, reposar, teclear, tocar, type Montado } from '../../pruebas/dom';
import { DesvincularMiWhatsapp } from './DesvincularMiWhatsapp';

/**
 * EL CABLEADO de «Desvincular WhatsApp» — molde de `VincularMiWhatsapp.test.tsx`:
 * lo que importa acá es que la elección real (eliminar vs. mantener los chats)
 * viaje en el `body` del POST, no el dibujo (eso lo cubriría un test de vista
 * pura si `DesvincularMiWhatsapp` tuviera una, y hoy es chico y sin pasos).
 */

let montado: Montado | null = null;
afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
});

function botonPorTexto(m: Montado, patron: RegExp) {
  return [...m.contenedor.querySelectorAll('button')].find((b) => patron.test(b.textContent ?? ''));
}

describe('DesvincularMiWhatsapp', () => {
  test('Escape cierra el modal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
    const onCerrar = vi.fn();
    montado = montar(<DesvincularMiWhatsapp onCerrar={onCerrar} />);
    await reposar();
    teclear('Escape');
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  test('"Cancelar" cierra sin haber llamado a la API', async () => {
    const fetchEspiado = vi.fn(async () => new Response('{}', { status: 503 }));
    vi.stubGlobal('fetch', fetchEspiado);
    const onCerrar = vi.fn();
    montado = montar(<DesvincularMiWhatsapp onCerrar={onCerrar} />);
    const cancelar = botonPorTexto(montado, /^cancelar$/i);
    expect(cancelar).toBeDefined();
    if (cancelar) tocar(cancelar);
    expect(onCerrar).toHaveBeenCalledTimes(1);
    expect(fetchEspiado).not.toHaveBeenCalled();
  });

  test('🔴 "mantener los chats" manda `eliminarChats: false`', async () => {
    const llamadas: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        llamadas.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
        return new Response(JSON.stringify({ ok: true, numero: '51955135507', eliminarChats: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    const onCerrar = vi.fn();
    montado = montar(<DesvincularMiWhatsapp onCerrar={onCerrar} />);
    const mantener = botonPorTexto(montado, /mantener los chats/i);
    expect(mantener).toBeDefined();
    if (mantener) tocar(mantener);
    await reposar();
    await reposar();

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.url).toContain('/mi-linea/desvincular');
    expect(llamadas[0]?.body).toEqual({ eliminarChats: false });
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  test('🔴 "eliminar los chats" manda `eliminarChats: true`', async () => {
    const llamadas: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        llamadas.push(init?.body ? JSON.parse(String(init.body)) : undefined);
        return new Response(JSON.stringify({ ok: true, numero: '51955135507', eliminarChats: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    const onCerrar = vi.fn();
    montado = montar(<DesvincularMiWhatsapp onCerrar={onCerrar} />);
    const eliminar = botonPorTexto(montado, /eliminar los chats/i);
    expect(eliminar).toBeDefined();
    if (eliminar) tocar(eliminar);
    await reposar();
    await reposar();

    expect(llamadas).toEqual([{ eliminarChats: true }]);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  test('un error del server se muestra y el modal NO se cierra', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ message: 'no se pudo cerrar la sesión de WhatsApp — probá de nuevo' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const onCerrar = vi.fn();
    montado = montar(<DesvincularMiWhatsapp onCerrar={onCerrar} />);
    const mantener = botonPorTexto(montado, /mantener los chats/i);
    if (mantener) tocar(mantener);
    await reposar();
    await reposar();

    expect(montado.contenedor.textContent).toContain('no se pudo cerrar la sesión');
    expect(onCerrar).not.toHaveBeenCalled();
  });
});
