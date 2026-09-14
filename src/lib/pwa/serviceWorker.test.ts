import { describe, expect, test, vi } from 'vitest';

/**
 * EL SERVICE WORKER DE HERMES — qué contesta y qué no. Se ejecuta el `public/sw.js` DE VERDAD, con un `self` y
 * un `fetch` falsos.
 *
 * 🔴 **Lo que se cuida es #1011.** Un `index.html` viejo guardado en caché, que apunta a chunks que el deploy ya
 * borró, deja la pantalla en blanco. Este SW no guarda nada: las navegaciones van a la red, y sin red fallan
 * igual que sin service worker. Lo que no es una navegación —`/api`, el SSE, los chunks— no lo contesta, y
 * donde hay rutas estáticas ni siquiera lo despierta.
 */

const CODIGO = Object.values(import.meta.glob('../../../public/sw.js', { eager: true, query: '?raw', import: 'default' }))[0] as
  | string
  | undefined;

interface PedidoFalso {
  mode: RequestMode;
  url: string;
}

interface ReglaDeRuta {
  condition: Record<string, string>;
  source: string;
}

interface EventoDeFetchFalso {
  request: PedidoFalso;
  preloadResponse: Promise<Response | undefined>;
  respondWith: (respuesta: Promise<Response>) => void;
}

interface EventoExtensibleFalso {
  waitUntil: (promesa: Promise<unknown>) => void;
}

interface EventoDeInstalacionFalso extends EventoExtensibleFalso {
  addRoutes?: (regla: ReglaDeRuta) => Promise<void>;
}

interface PrecargaFalsa {
  enable: () => Promise<void>;
}

interface RegistroFalso {
  navigationPreload: PrecargaFalsa;
}

interface ClientesFalsos {
  claim: () => Promise<void>;
}

type Oyente = (evento: EventoDeFetchFalso | EventoDeInstalacionFalso) => void;

/** Corre `public/sw.js` con una red que contesta lo que diga `red`. */
function arrancarSw(red: (pedido: PedidoFalso) => Promise<Response>) {
  expect(CODIGO, 'no hay public/sw.js').toBeTruthy();
  const oyentes = new Map<string, Oyente>();
  const fetchFalso = vi.fn(red);
  const clients: ClientesFalsos = { claim: vi.fn(async () => {}) };
  const registration: RegistroFalso = { navigationPreload: { enable: vi.fn(async () => {}) } };
  const self = {
    addEventListener: (tipo: string, oyente: Oyente) => oyentes.set(tipo, oyente),
    skipWaiting: vi.fn(async () => {}),
    clients,
    registration,
  };
  new Function('self', 'fetch', CODIGO!)(self, fetchFalso);
  return { oyentes, fetchFalso, self };
}

/** Dispara la instalación y espera lo que el SW haya dejado en `waitUntil`. */
async function instalar(sw: ReturnType<typeof arrancarSw>, addRoutes?: (regla: ReglaDeRuta) => Promise<void>) {
  const esperas: Promise<unknown>[] = [];
  sw.oyentes.get('install')?.({ addRoutes, waitUntil: (p) => esperas.push(p) });
  await Promise.all(esperas);
}

/** Dispara un `fetch` y devuelve lo que el SW contestó, o `undefined` si no lo contestó. */
function pedir(sw: ReturnType<typeof arrancarSw>, pedido: PedidoFalso, precarga?: Response): Promise<Response> | undefined {
  let respuesta: Promise<Response> | undefined;
  sw.oyentes.get('fetch')?.({
    request: pedido,
    preloadResponse: Promise.resolve(precarga),
    respondWith: (r) => {
      respuesta = r;
    },
  });
  return respuesta;
}

const NAVEGACION: PedidoFalso = { mode: 'navigate', url: 'https://hermes-api.goberna.us/?vista=mensajes' };

describe('el service worker', () => {
  test('🔴 no usa la Cache API: no hay nada guardado que pueda quedar viejo', () => {
    expect(CODIGO, 'no hay public/sw.js').toBeTruthy();
    expect(CODIGO).not.toMatch(/\bcaches\b/);
  });

  test('🔴 al instalarse manda a la red, sin despertarlo, todo lo que no es una navegación', async () => {
    const sw = arrancarSw(async () => new Response('red'));
    const addRoutes = vi.fn(async (_regla: ReglaDeRuta) => {});
    await instalar(sw, addRoutes);

    const reglas = addRoutes.mock.calls.map(([regla]) => regla);
    expect(reglas).toEqual(
      expect.arrayContaining([
        { condition: { requestMode: 'cors' }, source: 'network' },
        { condition: { requestMode: 'no-cors' }, source: 'network' },
        { condition: { requestMode: 'same-origin' }, source: 'network' },
      ]),
    );
    expect(reglas.some((r) => r.condition.requestMode === 'navigate'), 'las navegaciones no van por una ruta estática').toBe(false);
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });

  test('donde el navegador no tiene rutas estáticas, o no entiende una regla, se instala igual', async () => {
    const sinRutas = arrancarSw(async () => new Response('red'));
    await instalar(sinRutas);
    expect(sinRutas.self.skipWaiting).toHaveBeenCalled();

    const conReglasRaras = arrancarSw(async () => new Response('red'));
    let llamadas = 0;
    await instalar(conReglasRaras, async () => {
      llamadas += 1;
      if (llamadas === 1) throw new TypeError('condición desconocida');
      return Promise.reject(new TypeError('tampoco'));
    });
    expect(conReglasRaras.self.skipWaiting).toHaveBeenCalled();
  });

  test('al activarse toma la página y enciende la precarga de navegación', async () => {
    const sw = arrancarSw(async () => new Response('red'));
    const esperas: Promise<unknown>[] = [];
    sw.oyentes.get('activate')?.({ waitUntil: (p) => esperas.push(p) });
    await Promise.all(esperas);
    expect(sw.self.clients.claim).toHaveBeenCalled();
    expect(sw.self.registration.navigationPreload.enable).toHaveBeenCalled();
  });

  test('🔴 lo que no es una navegación no lo contesta: /api, el SSE y los chunks van a la red como siempre', () => {
    const sw = arrancarSw(async () => new Response('red'));
    const pedidos: PedidoFalso[] = [
      { mode: 'cors', url: 'https://hermes-api.goberna.us/api/whatsapp/conversaciones' },
      { mode: 'same-origin', url: 'https://hermes-api.goberna.us/api/eventos' },
      { mode: 'no-cors', url: 'https://hermes-api.goberna.us/assets/index-A5R1L34_.js' },
    ];
    for (const pedido of pedidos) expect(pedir(sw, pedido), pedido.url).toBeUndefined();
    expect(sw.fetchFalso).not.toHaveBeenCalled();
  });

  test('una navegación va a la red y devuelve lo que contesta', async () => {
    const deLaRed = new Response('<!doctype html>de la red', { headers: { 'content-type': 'text/html' } });
    const sw = arrancarSw(async () => deLaRed);
    expect(await pedir(sw, NAVEGACION)).toBe(deLaRed);
    expect(sw.fetchFalso).toHaveBeenCalledTimes(1);
  });

  test('si la precarga de navegación ya llegó, usa ésa y no la pide dos veces', async () => {
    const precargada = new Response('<!doctype html>precargada');
    const sw = arrancarSw(async () => new Response('no'));
    expect(await pedir(sw, NAVEGACION, precargada)).toBe(precargada);
    expect(sw.fetchFalso).not.toHaveBeenCalled();
  });

  test('🔴 sin red la navegación falla igual que sin service worker: no inventa ni saca nada guardado', async () => {
    const sinRed = new TypeError('Failed to fetch');
    const sw = arrancarSw(async () => {
      throw sinRed;
    });
    const respuesta = pedir(sw, NAVEGACION);
    expect(respuesta, 'la navegación la tiene que tomar el SW para ir a la red').toBeDefined();
    await expect(respuesta!).rejects.toBe(sinRed);
    expect(sw.fetchFalso).toHaveBeenCalledTimes(1);
  });
});
