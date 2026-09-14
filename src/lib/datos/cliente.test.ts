import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  debeReintentar,
  ErrorApi,
  esperaAntesDeReintentar,
  queryClient,
  reintentarEnMsDe,
} from './cliente';

/**
 * EL BORDE DONDE SE PERDÍA `reintentable` (#175).
 *
 * `api()` es el único `fetch` del front, así que es el único lugar donde un campo del cuerpo
 * de error puede desaparecer para siempre. Y desapareció: el server calculaba `reintentable`
 * con el estado HTTP a la vista, lo mandaba en cada 502 **para que la app no reimplementara la
 * tabla de códigos**, y acá se descartaba en silencio — la clase ni tenía el campo. La pantalla
 * la reimplementó igual, y las dos tablas ya decían cosas distintas antes de mergear.
 *
 * Un campo que se cae en un borde no se ve en ninguna pantalla ni en ningún log: se ve acá.
 */

function respuestaDeError(cuerpo: unknown, status = 502): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Deja `fetch` devolviendo lo que se le pase, y se limpia solo. */
function fetchDevuelve(res: Response) {
  vi.stubGlobal('fetch', () => Promise.resolve(res));
}

beforeEach(() => {
  // `api()` mete el token de la vendedora en cada request, y lo lee de `localStorage`. Este
  // archivo corre en el entorno `node` de siempre (no es un test de DOM: no monta nada), así
  // que se le da lo mínimo para que el request se arme. Sin esto el `TypeError` de
  // `tokenGuardado` sale ANTES del borde que acá se mide, y todo falla por el motivo equivocado.
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * `api()` siempre tira acá: el `await expect(...).rejects` deja escapar el tipo.
 *
 * El `instanceof` NO es decorativo. Sin él, cualquier otro throw —un `TypeError` porque falta
 * `localStorage`, por ejemplo— se devolvía como si fuera el `ErrorApi` esperado, y los tests que
 * afirman `reintentable === undefined` pasaban VACÍOS: leer `.reintentable` de un `TypeError`
 * también da `undefined`. Pasó de verdad al escribir este archivo.
 */
async function errorDe(res: Response): Promise<ErrorApi> {
  fetchDevuelve(res);
  try {
    await api('/api/ivi/preguntar', { method: 'POST' });
  } catch (e) {
    if (!(e instanceof ErrorApi)) {
      throw new Error(`api() tiró algo que no es ErrorApi: ${String(e)}`);
    }
    return e;
  }
  throw new Error('se esperaba que api() tirara y no tiró');
}

describe('api() — lo que el server dice sobre el error llega entero', () => {
  it('`reintentable: true` cruza el borde', async () => {
    const err = await errorDe(
      respuestaDeError({ ok: false, codigo: 'http_inesperado', message: 'Ivi falló', reintentable: true }),
    );
    expect(err).toBeInstanceOf(ErrorApi);
    expect(err.codigo).toBe('http_inesperado');
    expect(err.reintentable).toBe(true);
  });

  it('`reintentable: false` también cruza — no se confunde con «no vino»', async () => {
    const err = await errorDe(
      respuestaDeError({ ok: false, codigo: 'falta_config', reintentable: false }),
    );
    expect(err.reintentable).toBe(false);
  });

  it('sin el campo queda `undefined`, que es lo que le cede la decisión a la tabla del front', async () => {
    const err = await errorDe(respuestaDeError({ ok: false, codigo: 'timeout' }));
    expect(err.reintentable).toBeUndefined();
  });

  it('un `reintentable` que no es booleano NO se interpreta: `null` y una cadena no son «false»', async () => {
    // Si `null` se leyera como falsy, un server que manda `null` apagaría el botón afirmando
    // algo que nunca dijo. La ausencia de opinión tiene que ser distinguible de un «no».
    expect((await errorDe(respuestaDeError({ codigo: 'timeout', reintentable: null }))).reintentable).toBeUndefined();
    expect((await errorDe(respuestaDeError({ codigo: 'timeout', reintentable: 'true' }))).reintentable).toBeUndefined();
  });

  it('un cuerpo de error que no es JSON no rompe: sigue habiendo `ErrorApi` con su estado', async () => {
    fetchDevuelve(new Response('<html>502 Bad Gateway</html>', { status: 502 }));
    await expect(api('/api/ivi/preguntar')).rejects.toBeInstanceOf(ErrorApi);
  });
});

/**
 * LOS DOS BORDES QUE AMPLIFICABAN LA SATURACIÓN (21-ago-2026).
 *
 * El server ya decía las dos cosas —«esto no se arregla reintentando» en el cuerpo
 * (`reintentable`, #175) y «vuelve en 5 segundos» en un header (`Retry-After`, el 503
 * de `server/src/lib/ruta.ts`)— y la capa de red no leía ninguna: `retry: 1` a secas.
 * O sea que el día que el server contestaba «estoy saturado», el front le duplicaba
 * los pedidos al instante y sincronizado, que es exactamente lo contrario de lo que
 * ese 503 vino a pedir.
 *
 * Los dos defectos son invisibles: no hay pantalla que los muestre ni log del front
 * que los cuente. Se ven acá.
 */
describe('reintentarEnMsDe — el `Retry-After` que se tiraba', () => {
  const con = (v: string | null) =>
    reintentarEnMsDe(new Headers(v == null ? {} : { 'retry-after': v }));

  it('lee los segundos enteros que manda `lib/ruta.ts` en su 503', () => {
    expect(con('5')).toBe(5000);
  });

  it('sin header no inventa una espera', () => {
    expect(con(null)).toBeUndefined();
  });

  it('una fecha HTTP se descarta en vez de leerse como un número raro', () => {
    // Interpretarla exigiría confiar en el reloj de la máquina de la vendedora contra
    // el del server: un reloj adelantado daría una espera negativa.
    expect(con('Wed, 21 Oct 2026 07:28:00 GMT')).toBeUndefined();
  });

  it('cero, negativo y basura no son esperas', () => {
    expect(con('0')).toBeUndefined();
    expect(con('-5')).toBeUndefined();
    expect(con('pronto')).toBeUndefined();
    expect(con('')).toBeUndefined();
    expect(con('2.5')).toBeUndefined();
  });

  it('se recorta a un minuto: una app quieta diez minutos se ve igual que una colgada', () => {
    expect(con('600')).toBe(60_000);
  });

  it('cruza el borde de `api()` entero, que es donde se perdía', async () => {
    fetchDevuelve(
      new Response(JSON.stringify({ ok: false, codigo: 'servidor_ocupado' }), {
        status: 503,
        headers: { 'content-type': 'application/json', 'retry-after': '5' },
      }),
    );
    try {
      await api('/api/conversaciones');
      throw new Error('se esperaba que api() tirara');
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw new Error(`no es ErrorApi: ${String(e)}`);
      expect(e.status).toBe(503);
      expect(e.reintentarEnMs).toBe(5000);
    }
  });
});

describe('debeReintentar — la opinión del server le gana a la del front', () => {
  it('`reintentable: false` NO se reintenta', () => {
    // El caso real: `falta_config` de Ivi. Un error de configuración que no se arregla
    // solo, reintentado automáticamente contra un server que ya está saturado.
    expect(debeReintentar(0, new ErrorApi('', 502, undefined, undefined, 'falta_config', false))).toBe(false);
  });

  it('sin opinión del server se reintenta una vez, como siempre', () => {
    expect(debeReintentar(0, new ErrorApi('', 502, undefined, undefined, 'timeout'))).toBe(true);
    expect(debeReintentar(1, new ErrorApi('', 502, undefined, undefined, 'timeout'))).toBe(false);
  });

  it('`reintentable: true` no agrega reintentos: el techo de uno sigue mandando', () => {
    expect(debeReintentar(1, new ErrorApi('', 502, undefined, undefined, 'red', true))).toBe(false);
  });

  it('lo que no es `ErrorApi` cae al techo de siempre', () => {
    expect(debeReintentar(0, new TypeError('failed to fetch'))).toBe(true);
    expect(debeReintentar(1, new TypeError('failed to fetch'))).toBe(false);
  });
});

describe('esperaAntesDeReintentar — con jitter, o la estampida vuelve', () => {
  const ocupado = new ErrorApi('', 503, undefined, undefined, 'servidor_ocupado', undefined, undefined, 5000);

  it('respeta lo que pidió el server, en una banda de 0,5× a 1,5×', () => {
    for (let i = 0; i < 200; i++) {
      const ms = esperaAntesDeReintentar(0, ocupado);
      expect(ms).toBeGreaterThanOrEqual(2500);
      expect(ms).toBeLessThan(7500);
    }
  });

  it('🔴 NO es un valor fijo: un delay igual para todos re-sincroniza la estampida', () => {
    const muestras = new Set(Array.from({ length: 50 }, () => esperaAntesDeReintentar(0, ocupado)));
    expect(muestras.size).toBeGreaterThan(1);
  });

  it('sin `Retry-After` queda el backoff exponencial de siempre', () => {
    const err = new ErrorApi('', 500);
    expect(esperaAntesDeReintentar(0, err)).toBe(1000);
    expect(esperaAntesDeReintentar(1, err)).toBe(2000);
    expect(esperaAntesDeReintentar(0, new TypeError('boom'))).toBe(1000);
  });
});

/**
 * EL CABLEADO — y es el que faltaba.
 *
 * 🔴 **Las tres funciones de arriba estaban testeadas hasta el hueso y NINGÚN test
 * verificaba que el `QueryClient` las use.** Comprobado sacándolas: con
 * `retry: 1` de vuelta y sin `retryDelay`, o sea con el efecto entero del frente
 * revertido, los 1.941 tests del front seguían en VERDE. Es exactamente la lección
 * de ADR 0024 y de `routes/stream.test.ts`: el defecto no es una regla mal escrita,
 * es que el borde que decide nunca la mira.
 *
 * Por eso esto NO interroga a `debeReintentar`/`esperaAntesDeReintentar`, que ya
 * tienen sus pruebas: interroga a **`queryClient.getDefaultOptions()`**, que es el
 * único lugar desde donde salen o no salen los pedidos de verdad.
 */
describe('queryClient — que las reglas estén ENCHUFADAS, no solo escritas', () => {
  const porDefecto = () => queryClient.getDefaultOptions().queries;

  it('🔴 el `retry` del cliente consulta la opinión del server', () => {
    const { retry } = porDefecto() ?? {};
    if (typeof retry !== 'function') throw new Error(`retry no es la función: ${String(retry)}`);
    // `reintentable: false` (un `falta_config`) no puede generar un segundo pedido.
    expect(retry(0, new ErrorApi('', 502, undefined, undefined, 'falta_config', false))).toBe(false);
    // Y sin opinión del server sigue valiendo el techo de uno, como con `retry: 1`.
    expect(retry(0, new ErrorApi('', 502))).toBe(true);
    expect(retry(1, new ErrorApi('', 502))).toBe(false);
  });

  it('🔴 el `retryDelay` del cliente obedece el `Retry-After`, y con jitter', () => {
    const { retryDelay } = porDefecto() ?? {};
    if (typeof retryDelay !== 'function') throw new Error(`retryDelay no es la función: ${String(retryDelay)}`);
    const ocupado = new ErrorApi('', 503, undefined, undefined, 'servidor_ocupado', undefined, undefined, 5000);
    const muestras = Array.from({ length: 50 }, () => retryDelay(0, ocupado));
    for (const ms of muestras) {
      expect(ms).toBeGreaterThanOrEqual(2500);
      expect(ms).toBeLessThan(7500);
    }
    // Un valor fijo re-sincroniza la estampida que el 503 vino a frenar.
    expect(new Set(muestras).size).toBeGreaterThan(1);
    // Y sin `Retry-After` queda el backoff de siempre: 1 s al primer fallo.
    expect(retryDelay(0, new ErrorApi('', 500))).toBe(1000);
  });
});

/**
 * EL OTRO NOMBRE DEL MENSAJE: `error`.
 *
 * 305 respuestas de error del server dicen `message`; **11 dicen `error`**
 * (`routes/persona.ts` entre ellas, medido el 4-sep-2026). Este borde sólo leía
 * la primera, así que el rechazo de Meta ya traducido —«Esta persona no puede
 * recibir mensajes de la página…»— llegaba a la pantalla como «Error 502», y el
 * hilo de Messenger mostraba su genérico. Misma lección que `reintentable`: el
 * server distingue con cuidado y el cliente lo aplana.
 */
describe('el texto del error', () => {
  it('un cuerpo con `error` en vez de `message` no se aplana a «Error 502»', async () => {
    const e = await errorDe(
      respuestaDeError({ type: 'meta_rechazo', error: 'Esta persona no puede recibir mensajes de la página.' }),
    );
    expect(e.message).toBe('Esta persona no puede recibir mensajes de la página.');
    expect(e.tipo).toBe('meta_rechazo');
  });

  it('`message` sigue mandando cuando vienen los dos', async () => {
    const e = await errorDe(respuestaDeError({ message: 'la canónica', error: 'la otra' }));
    expect(e.message).toBe('la canónica');
  });

  it('y un `error` que no es texto no se cuela como mensaje', async () => {
    const e = await errorDe(respuestaDeError({ error: { code: 551 } }));
    expect(e.message).toBe('Error 502');
  });
});
