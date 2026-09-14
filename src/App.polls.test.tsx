// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { montar, type Montado } from './pruebas/dom';
import { marcarLatido, olvidarLatido } from './lib/datos/latido';
import App from './App';

/**
 * 🔴 DETRÁS DEL LOGIN NO SE LE PIDE NADA AL SERVER.
 *
 * ── Lo que estaba mal, medido ──
 * `App` era un solo componente con `useSesionWa`, `useAutoRespuesta`,
 * `useAgenda`, `useDashboard` y el SSE declarados ARRIBA de los early returns —
 * y las reglas de los hooks obligan a eso: un `return` temprano no puede
 * saltearse una llamada. Así que **con la pantalla de Login adelante seguían
 * corriendo cuatro polls** (10 s, 30 s, 30 s y 60 s), todos contestando 401 y
 * ninguno visible para nadie. Una máquina abierta en el Login le pegaba a
 * producción indefinidamente.
 *
 * ── Por qué este test y no `enabled` en cada hook ──
 * `enabled: Boolean(vendedora)` arregla los cuatro que hay hoy y no dice nada
 * del que se agregue mañana. Lo que fija esto es la PROPIEDAD: sin sesión, cero
 * pedidos. Un hook nuevo declarado en el lugar equivocado lo pone rojo, aunque
 * quien lo escribió no supiera que existía esta regla.
 *
 * ── Cómo se cuenta ──
 * Se monta `<App/>` **sin token**, así `useSesion` ni siquiera pregunta
 * `/api/auth/yo` (corta antes: sin token no hay nada que validar), y se dejan
 * correr 90 s de reloj falso — más de un ciclo del más lento de los polls
 * viejos. Cualquier `fetch` que salga es el defecto.
 *
 * ⚠️ Reloj falso ACOTADO a los timers, como en `useAutoguardado.test.tsx`: con
 * todo falseado el scheduler de React no pinta, y `reposar()` no se puede usar
 * porque su `setTimeout(…, 0)` nunca vence.
 */

let montado: Montado | null = null;

function relojDeMentira() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
}

async function correrElReloj(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

let espia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  relojDeMentira();
  espia = vi.fn(
    async () =>
      new Response('{"ok":false,"message":"el test no levanta server"}', {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', espia);
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** A dónde se pidió, para que el rojo diga QUÉ hook se coló y no sólo cuántos. */
const urls = () => espia.mock.calls.map(([u]) => String(u));

describe('sin sesión, la app no le pide nada al server', () => {
  it('monta el Login y no dispara un solo pedido', async () => {
    montado = montar(<App />);
    await correrElReloj(0);

    // Es el Login de verdad y no un esqueleto: tiene su caja de usuario.
    expect(montado.contenedor.querySelector('input[placeholder=\'tu usuario\']')).not.toBeNull();
    expect(urls()).toEqual([]);
  });

  /**
   * 90 s: más de un ciclo del más lento de los cuatro polls que corrían acá
   * (la agenda, 60 s). Con el `App` de antes eran ~15 pedidos.
   */
  it('y sigue sin pedir nada después de 90 segundos', async () => {
    montado = montar(<App />);
    await correrElReloj(0);

    await correrElReloj(90_000);

    expect(urls()).toEqual([]);
  });

  /**
   * Y con cinco minutos tampoco: lo que se está fijando no es «tarda en
   * arrancar», es que **no arranca**. Un poll que empieza al minuto y medio se
   * vería igual de bien en el test de arriba.
   */
  it('ni después de cinco minutos', async () => {
    montado = montar(<App />);
    await correrElReloj(0);

    await correrElReloj(5 * 60_000);

    expect(urls()).toEqual([]);
  });
});

/**
 * 🔴 CON SESIÓN Y EL STREAM VIVO, LOS POLLS DE LA RAÍZ SIGUEN LA REGLA DEL
 * LATIDO — el candado que `docs/plan-borrar-el-polling.md` (§6, PR 0) pedía
 * y no existía: «hoy se puede volver a poner un `refetchInterval: 10_000` en
 * la raíz y ningún test se pone rojo».
 *
 * ── Los cinco, y por qué EL TECHO ES POR URL ──
 * `/api/autorespuesta` · `/api/bot/estado` · `/api/whatsapp/sesion` ·
 * `/api/agenda` · `/api/dashboard` son los que `AppAutenticada` y la vista
 * Dashboard (la que abre por default) montan sin que la vendedora toque nada.
 * Un techo en TOTAL se puede cumplir moviendo tráfico de un endpoint barato a
 * uno caro; acá cada URL tiene el suyo.
 *
 * ── Por qué `marcarLatido()` y no un stream real ──
 * `streamVivo()` lee `Date.now()` —NO fingido por `vi.useFakeTimers` (sólo se
 * falsean los timers, como en `cadenciaDeLosPolls.test.tsx`)—, así que un
 * único `marcarLatido()` antes de avanzar el reloj alcanza: el reloj real
 * apenas se mueve mientras el de los timers avanza diez minutos de un salto.
 * No hace falta simular el SSE de verdad para probar el ritmo que produce.
 *
 * ── Por qué NO se cuenta `/api/stream` ──
 * Es el canal del push, no uno de los polls que este frente ataca: con el stub
 * devolviendo error, el loop de `tiempoReal.ts` reintenta cada 3 s para
 * siempre — eso es exactamente lo que tiene que hacer un stream caído, y no es
 * el ritmo que este candado mide.
 *
 * ── Por qué NO se cuenta `/api/interactions/frescura` ──
 * Es el sexto poll de la raíz y **no es de este PR**: su cadencia la decide
 * `src/lib/datos/frescura.ts` (PR #506, todavía sin mergear) y su costo del
 * lado del server es el PR 2. Que siga en 60 s acá no es una regresión de
 * este cambio.
 */
describe('con sesión y el stream vivo, los cinco polls de la raíz siguen el latido', () => {
  /** El mismo molde de `App.test.tsx`: `<id>|<vencimiento>` en base64url. */
  function tokenVivo(id = 'ana'): string {
    const cuerpo = btoa(`${id}|${Date.now() + 60 * 60 * 1000}`)
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    return `${cuerpo}.firma-que-nadie-mira-acá`;
  }

  beforeEach(() => {
    localStorage.setItem('hermes.token', tokenVivo());
    relojDeMentira();
    marcarLatido();
    espia = vi.fn(async (url: string) => {
      if (String(url).includes('/api/auth/yo')) {
        return new Response(
          JSON.stringify({ vendedora: { id: 'ana', nombre: 'Ana Lucía' }, cerberus: true }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      // Todo lo demás falla a propósito (molde de `App.test.tsx`): así cada
      // hook cae en su estado de error, sin que este archivo tenga que conocer
      // la forma del payload de cada pantalla. Ninguno de los cinco polls se
      // congela por un 503 — sólo un 404 de la sesión lo hace, y ése no es
      // este caso.
      return new Response('{"ok":false,"message":"el test no levanta server"}', {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', espia);
  });

  afterEach(() => {
    olvidarLatido();
  });

  it('en 10 minutos, cada uno de los cinco pide como máximo lo que su red permite', async () => {
    // `VistaDashboard` es perezosa (`React.lazy`, App.tsx): precargarla antes de
    // montar evita que el `import()` de React quede pendiente detrás del reloj
    // falso, que sólo avanza timers y no la resolución de un import dinámico.
    await import('./features/dashboard/VistaDashboard');

    montado = montar(<App />);
    await correrElReloj(0);
    await correrElReloj(0);

    await correrElReloj(10 * 60_000);

    const todas = urls();
    const porEndpoint = (parte: string) => todas.filter((u) => u.includes(parte)).length;

    /**
     * 300 s de red sobre 600 s de reloj: dos vencimientos + el pedido inicial
     * dan 3 — el mínimo posible con un solo observador. Autorespuesta y bot lo
     * tocan justo: sus dos observadores (`AppAutenticada` + su chip de
     * header) nacen en el MISMO render y dedupan. `sesion` y `agenda` dan uno
     * más (4): sus segundos observadores VIVÍAN en `VistaDashboard`, que es
     * PEREZOSA: montaba un tick después del header y su timer no quedaba
     * sincronizado con el del header. Desde ADR 0104 el Dashboard ya no pide la
     * agenda ni la sesión (se fueron las píldoras y la ficha), así que hoy dan 3;
     * el techo de 4 se deja como estaba.
     *
     * ⚠️ **El plan estimó ≤ 12 en total asumiendo un observador por clave**
     * (`docs/plan-borrar-el-polling.md` §6, PR 0). Medido con la app real, la
     * duplicación legítima de observadores lo deja en 17 — sigue siendo el
     * mismo orden de magnitud de mejora (~60 → 17, una caída del 72 %) y NO
     * una regresión: unificar `sesion` en un solo dueño es el PR 5, marcado
     * como OPCIONAL en el plan («si con esto alcanza, no se hace»). Este
     * candado no depende de esa unificación — depende de que NINGUNO de los
     * cinco vuelva a un intervalo corto.
     */
    expect(porEndpoint('/api/autorespuesta')).toBeLessThanOrEqual(3);
    expect(porEndpoint('/api/bot/estado')).toBeLessThanOrEqual(3);
    expect(porEndpoint('/api/whatsapp/sesion')).toBeLessThanOrEqual(4);
    expect(porEndpoint('/api/agenda')).toBeLessThanOrEqual(4);
    expect(porEndpoint('/api/dashboard')).toBeLessThanOrEqual(3);

    // Y el total: bien lejos de los ~60 pedidos de hoy sin esta regla.
    const totalDeLosCinco =
      porEndpoint('/api/autorespuesta') +
      porEndpoint('/api/bot/estado') +
      porEndpoint('/api/whatsapp/sesion') +
      porEndpoint('/api/agenda') +
      porEndpoint('/api/dashboard');
    expect(totalDeLosCinco).toBeLessThanOrEqual(17);
  });
});
