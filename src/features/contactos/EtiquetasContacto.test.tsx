// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEtiquetasDeVarios, useEtiquetasMutaciones } from './EtiquetasContacto';

/**
 * ASIGNAR/QUITAR UNA ETIQUETA NO PUEDE RECARGAR EL PADRÓN ENTERO.
 *
 * ── El síntoma ───────────────────────────────────────────────────────────
 * «Cuando selecciona una etiqueta en Contactos, la página se congela y se
 * cuelga» (3-sep-2026). `contactos-registrados` (`/api/contactos/registrados`)
 * no lleva `LIMIT`: trae toda la historia de conversaciones de las líneas de
 * la vendedora, y `VistaContactosCampana` encadena 7 `useMemo` sobre ese
 * array completo. `useEtiquetasMutaciones` invalidaba esa query en CADA
 * asignar/quitar, aunque el endpoint no devuelve ni un campo de etiquetas —
 * el gesto más común de la pantalla (tocar una píldora) disparaba un refetch
 * y un recálculo del padrón entero sin necesidad.
 */

const CLAVE = 'conv:whatsapp:51987654321:51984429504';

let qc: QueryClient;
let raiz: Root | null = null;
let contenedor: HTMLElement | null = null;
type Api = ReturnType<typeof useEtiquetasMutaciones>;
let api: Api | null = null;

function Sonda() {
  api = useEtiquetasMutaciones(CLAVE);
  return null;
}

function montarSonda() {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
  act(() => {
    raiz?.render(
      <QueryClientProvider client={qc}>
        <Sonda />
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  // 🔴 SIN ESTO EL TEST NO MIDE NADA, Y ASÍ ENTRÓ (3-sep-2026).
  // `api()` le mete el token de la vendedora a cada request y lo lee con
  // `tokenGuardado()` → `localStorage.getItem`. **El jsdom de este repo no trae
  // `localStorage`**: `window.localStorage` es `undefined` (comprobado). Así que
  // el `mutationFn` reventaba con un TypeError ANTES de llegar al `fetch`
  // stubeado, `onSuccess` no corría, y no se invalidaba NADA.
  //
  // Las dos afirmaciones de etiquetas fallaban, y la tercera —la que de verdad
  // importa, que `contactos-registrados` NO se invalide— pasaba **por el motivo
  // equivocado**: daba `false` porque no se había invalidado nada, no porque el
  // código la hubiera dejado afuera a propósito.
  //
  // `lib/datos/cliente.test.ts` ya tenía escrita esta misma trampa con estas
  // mismas palabras. Acá se repitió.
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  });

  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(['contactos-registrados'], { contactos: [], porPersona: [] });
  qc.setQueryData(['etiquetas', 'lote', CLAVE], { etiquetas: {} });
  qc.setQueryData(['etiquetas', CLAVE], { etiquetas: {} });
});

afterEach(() => {
  act(() => {
    raiz?.unmount();
  });
  contenedor?.remove();
  raiz = null;
  contenedor = null;
  api = null;
  vi.unstubAllGlobals();
  qc.clear();
});

describe('asignar/quitar una etiqueta no toca el padrón de contactos', () => {
  test('🔴 asignar invalida las etiquetas, NO `contactos-registrados`', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } })),
    );

    montarSonda();

    await act(async () => {
      api?.asignar.mutate('interesado');
      await new Promise((r) => setTimeout(r, 0));
    });

    // Que la mutación haya SALIDO BIEN es parte de lo que se afirma: si vuelve a
    // reventar antes del fetch, esto se pone rojo acá y no tres líneas abajo con
    // un mensaje que no explica nada.
    expect(api?.asignar.status).toBe('success');

    expect(qc.getQueryState(['etiquetas', 'lote', CLAVE])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['etiquetas', CLAVE])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['contactos-registrados'])?.isInvalidated).toBe(false);
  });

  test('🔴 quitar invalida las etiquetas, NO `contactos-registrados`', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } })),
    );

    montarSonda();

    await act(async () => {
      api?.quitar.mutate('interesado');
      await new Promise((r) => setTimeout(r, 0));
    });

    // Que la mutación haya SALIDO BIEN es parte de lo que se afirma: si vuelve a
    // reventar antes del fetch, esto se pone rojo acá y no tres líneas abajo con
    // un mensaje que no explica nada.
    expect(api?.quitar.status).toBe('success');

    expect(qc.getQueryState(['etiquetas', 'lote', CLAVE])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['etiquetas', CLAVE])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['contactos-registrados'])?.isInvalidated).toBe(false);
  });
});

/**
 * EL LOTE DE ETIQUETAS VA POR `POST`, NUNCA POR `GET ?claves=`.
 *
 * ── El síntoma en producción (3-sep-2026) ─────────────────────────────────
 * "No se pudieron traer los contactos" arriba de la tabla, con la consola
 * mostrando `net::ERR_HTTP2_PROTOCOL_ERROR` en `/api/contactos/registrados` y
 * `net::ERR_CONNECTION_CLOSED` en `/api/gestiones/etiquetas?claves=...`. El
 * padrón real de una campaña tiene miles de contactos: un `GET` con esas
 * claves en el query string arma una URL que supera el límite de campo de
 * cabecera de HTTP/2 (nginx). nginx corta el STREAM en vez de contestar un
 * 414, y como el navegador multiplexa varios pedidos en la misma conexión
 * HTTP/2, se lleva puestos otros pedidos en vuelo — de ahí que un endpoint
 * SIN relación (`contactos/registrados`) reventara al mismo tiempo.
 */
describe('el lote de etiquetas de varios contactos va por POST', () => {
  let qcLote: QueryClient;
  let raizLote: Root | null = null;
  let contenedorLote: HTMLElement | null = null;

  afterEach(() => {
    act(() => {
      raizLote?.unmount();
    });
    contenedorLote?.remove();
    raizLote = null;
    contenedorLote = null;
    vi.unstubAllGlobals();
    qcLote?.clear();
  });

  test('🔴 pide `/api/gestiones/etiquetas/lote` por POST, con las claves en el body — no en la URL', async () => {
    qcLote = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const claves = ['conv:whatsapp:1:2', 'conv:whatsapp:3:4'];
    const fetchEspiado = vi.fn(
      async () => new Response('{"etiquetas":{}}', { headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchEspiado);

    function SondaLote() {
      useEtiquetasDeVarios(claves);
      return null;
    }

    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    contenedorLote = document.createElement('div');
    document.body.appendChild(contenedorLote);
    raizLote = createRoot(contenedorLote);
    await act(async () => {
      raizLote?.render(
        <QueryClientProvider client={qcLote}>
          <SondaLote />
        </QueryClientProvider>,
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(fetchEspiado).toHaveBeenCalledTimes(1);
    const [url, init] = fetchEspiado.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('?claves=');
    expect(url).toContain('/api/gestiones/etiquetas/lote');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ claves });
  });
});
