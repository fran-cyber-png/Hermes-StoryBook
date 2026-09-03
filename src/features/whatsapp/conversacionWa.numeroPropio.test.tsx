// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConversacionWa } from './conversacionWa';
/**
 * 🔴 EL SHIM DE `localStorage`, Y SIN ÉL ESTE ARCHIVO ENTERO ES UN FALSO NEGATIVO.
 *
 * Se importa por su EFECTO, no por lo que exporta: `pruebas/dom.tsx` instala en
 * `globalThis` lo que jsdom deja sólo en su ventana. `token.ts` usa
 * `localStorage` sin guarda, así que sin esto `tokenGuardado()` tira
 * «Cannot read properties of undefined (reading 'getItem')» ADENTRO de `api()`
 * — la request no sale nunca y los cuatro asserts leen `undefined`.
 *
 * ⚠️ **El error no se ve.** React Query se queda con él en `query.state.error` y
 * el test falla por el `undefined` que viene después, así que el síntoma apunta a
 * la espera o al stub de `fetch` y no a la causa. Se pierde media hora ahí.
 *
 * ⚠️ **Copiar el molde no alcanza**: `leidoInstantaneo.test.tsx` tiene los
 * imports IDÉNTICOS a los de acá y pasa, porque no llega a hacer una request. El
 * shim no vive en el molde — vive en un archivo que ninguna de las dos sondas
 * importa. Toda sonda armada a mano con `createRoot` que dispare una request
 * necesita esta línea.
 */
import '../../pruebas/dom';

/**
 * 🔴 `numeroPropio` TIENE QUE VIAJAR AL `GET` DEL HILO — el defecto que hacía
 * que «Desvincular WhatsApp, eliminar chats» (`routes/miLinea.ts`) archivara
 * bien del lado del server y no se notara del lado de la pantalla.
 *
 * `HiloWhatsapp.tsx` ya tenía `numeroPropio` a mano y se lo pasaba a
 * `enviar`/`marcarLeido`/etc., pero llamaba a `useConversacionWa(telefono)`
 * SOLO con el teléfono. El server sabe archivar por línea
 * (`GET /conversacion?numeroPropio=`, `numeros/repositorio.ts:chatsArchivados`)
 * pero nadie se lo estaba preguntando así — así que la vendedora seguía
 * viendo los mensajes que acababa de pedir ocultar. La regla del server
 * estaba bien escrita y con test; el cableado del front nunca la llamaba con
 * el dato real (CLAUDE.md #10).
 *
 * Molde: `leidoInstantaneo.test.tsx` (la misma sonda mínima, sin
 * `@testing-library`).
 */

const TELEFONO = '51987654321';
const LINEA_A = '51986790746';
const LINEA_B = '51900000000';

let qc: QueryClient;
let raiz: Root | null = null;
let contenedor: HTMLElement | null = null;

type Api = ReturnType<typeof useConversacionWa>;
let api: Api | null = null;
let numeroPropioProp: string | undefined;

function Sonda() {
  api = useConversacionWa(TELEFONO, numeroPropioProp);
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
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  numeroPropioProp = undefined;
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

const json = (cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } });

describe('el GET del hilo lleva numeroPropio', () => {
  test('🔴 con numeroPropio, el query string lo lleva', async () => {
    const llamadas: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: RequestInfo | URL) => {
        llamadas.push(String(url));
        return Promise.resolve(json({ telefono: TELEFONO, mensajes: [], origen: null }));
      }),
    );

    numeroPropioProp = LINEA_A;
    await act(async () => {
      montarSonda();
      await new Promise((r) => setTimeout(r, 0));
    });

    const pedidoDelHilo = llamadas.find((u) => u.includes('/api/whatsapp/conversacion/'));
    expect(pedidoDelHilo).toContain(`numeroPropio=${LINEA_A}`);
  });

  test('sin numeroPropio, el comportamiento viejo: sin query string', async () => {
    const llamadas: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: RequestInfo | URL) => {
        llamadas.push(String(url));
        return Promise.resolve(json({ telefono: TELEFONO, mensajes: [], origen: null }));
      }),
    );

    await act(async () => {
      montarSonda();
      await new Promise((r) => setTimeout(r, 0));
    });

    const pedidoDelHilo = llamadas.find((u) => u.includes('/api/whatsapp/conversacion/'));
    expect(pedidoDelHilo).not.toContain('numeroPropio');
  });

  test('🔴 dos líneas para el mismo teléfono NO comparten caché — una archivada no tapa a la otra', async () => {
    let respuesta = { telefono: TELEFONO, mensajes: [{ id: 1, texto: 'de la línea A' }], origen: null };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(respuesta))));

    numeroPropioProp = LINEA_A;
    await act(async () => {
      montarSonda();
      await new Promise((r) => setTimeout(r, 0));
    });
    const claveA = ['wa', 'conversacion', TELEFONO, LINEA_A];
    expect((qc.getQueryData(claveA) as typeof respuesta | undefined)?.mensajes).toHaveLength(1);

    // La línea B, archivada: el server contestaría vacío. Es una query DISTINTA.
    respuesta = { telefono: TELEFONO, mensajes: [], origen: null };
    act(() => {
      raiz?.unmount();
    });
    contenedor?.remove();
    numeroPropioProp = LINEA_B;
    await act(async () => {
      montarSonda();
      await new Promise((r) => setTimeout(r, 0));
    });

    const claveB = ['wa', 'conversacion', TELEFONO, LINEA_B];
    expect((qc.getQueryData(claveB) as typeof respuesta | undefined)?.mensajes).toHaveLength(0);
    // Y lo de la línea A sigue en el caché, sin pisar ni pisado.
    expect((qc.getQueryData(claveA) as typeof respuesta | undefined)?.mensajes).toHaveLength(1);
  });
});

describe('las mutaciones optimistas apuntan a la MISMA entrada que lee el hilo', () => {
  test('🔴 reaccionar con numeroPropio actualiza lo que `hilo.data` muestra, no una copia muda', async () => {
    // El POST de `/reaccionar` se deja COLGADO a propósito: `onSettled`
    // invalida y refetchea el hilo, y el mock del GET no sabe de reacciones
    // — si el refetch llegara a correr, pisaría el optimista con el mismo
    // dato de siempre y el test dejaría de medir lo que dice medir. Colgado,
    // lo único que puede haber puesto la reacción es `onMutate`.
    vi.stubGlobal(
      'fetch',
      vi.fn((url: RequestInfo | URL) => {
        if (String(url).includes('/reaccionar')) return new Promise<Response>(() => {});
        return Promise.resolve(
          json({
            telefono: TELEFONO,
            mensajes: [{ id: 1, external_id: 'wa:1', texto: 'hola', direccion: 'entrante' }],
            origen: null,
          }),
        );
      }),
    );

    numeroPropioProp = LINEA_A;
    montarSonda();
    for (let i = 0; i < 20 && api?.hilo.data === undefined; i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    }

    expect(api?.hilo.data?.mensajes[0]?.texto).toBe('hola');
    expect(api?.hilo.data?.mensajes[0]?.reacciones).toBeUndefined();

    act(() => {
      api?.reaccionar.mutate({ numeroPropio: LINEA_A, telefono: TELEFONO, mensajeId: '1', emoji: '👍' });
    });
    // `onMutate` es async (`cancelQueries` de por medio): sin esperar, el
    // `setQueryData` optimista todavía no corrió cuando se lee `hilo.data`.
    for (let i = 0; i < 20 && api?.hilo.data?.mensajes[0]?.reacciones === undefined; i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    }

    // Optimista: se ve YA, antes de que el POST vuelva — y si `clave` no
    // coincidiera con la `queryKey` real del hilo, esto seguiría `undefined`
    // para siempre (estaría escribiendo en una entrada de caché que nadie lee).
    expect(api?.hilo.data?.mensajes[0]?.reacciones).toEqual([{ emoji: '👍', nuestra: true }]);
  });
});
