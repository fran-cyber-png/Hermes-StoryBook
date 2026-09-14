/**
 * Mock de `fetch` para historias de organismos que usan `api()` (lib/datos/cliente.ts).
 *
 * `api()` es el único `fetch` del frontend — pega contra `API_URL` + la ruta. En
 * Storybook no hay servidor: sin esto, cada `useQuery`/efecto que llama `api()`
 * termina en `isError` (o cuelga en `isPending`) y la historia no puede mostrar el
 * estado real del componente. Se pisa `window.fetch` global, matcheando por
 * fragmento de la URL — no hace falta ser más preciso: cada historia declara solo
 * las rutas que su componente pide.
 */
export interface RutaMock {
  /** Fragmento que debe aparecer en la URL pedida (incluye el método si hace falta distinguir). */
  fragmento: string;
  /** Cuerpo JSON de la respuesta, o una función que lo arma a partir de la URL. */
  cuerpo: unknown | ((url: string) => unknown);
  status?: number;
  /** Simula latencia — útil para capturar el estado `isPending` en una historia aparte. */
  demoraMs?: number;
}

/**
 * Pisa `window.fetch` para el resto del ciclo de vida del módulo. Se llama desde el
 * `render`/`decorators` de la historia (corre en cada render, antes de que los
 * efectos del componente disparen su propio `fetch`, así que siempre gana el mock).
 */
export function mockFetch(rutas: RutaMock[]): void {
  window.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const ruta = rutas.find((r) => url.includes(r.fragmento));
    if (!ruta) {
      // Sin mock para esta ruta: 501 explícito en vez de colgar — se ve enseguida
      // en la consola de Storybook si falta declarar una ruta.
      return new Response(JSON.stringify({ message: `mockApi: sin ruta para ${url}` }), {
        status: 501,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (ruta.demoraMs) await new Promise((r) => setTimeout(r, ruta.demoraMs));
    const cuerpo = typeof ruta.cuerpo === 'function' ? (ruta.cuerpo as (u: string) => unknown)(url) : ruta.cuerpo;
    return new Response(JSON.stringify(cuerpo), {
      status: ruta.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}
