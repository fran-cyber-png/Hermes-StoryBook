// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { montar, type Montado } from '../../pruebas/dom';
import { useTiempoReal } from './tiempoReal';
import { useAutoRespuesta } from '../../features/autorespuesta/datos';
import { useBot } from '../../features/bot/datos';

/**
 * 🔴 EL EVENTO `cambio` INVALIDA LA CLAVE QUE NOMBRA (docs/plan-borrar-el-polling.md §6 PR 3).
 *
 * El chip de auto-respuesta y el del bot ya no dependen sólo del poll (PR 1):
 * cuando el modo cambia de MÁQUINA (freno automático, reloj de encolado) o
 * desde OTRA pestaña, el server manda `{tipo:'cambio', que:'autorespuesta'|'bot'}`
 * y el chip se refresca al instante — sin esto, tarda hasta 5 min (la red del
 * PR 1) en enterarse.
 *
 * Se monta el stream de verdad (como `recuperarAlReconectar.test.tsx`) y se
 * mira que el `fetch` de la clave nombrada se dispare de más, en vez de
 * interrogar el parser SSE por separado: es el cableado real —`manejar` vive
 * adentro de `useTiempoReal` y no se exporta— lo que puede tener un defecto
 * invisible para un test puro (la lección de ADR 0024, otra vez).
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

/**
 * Cuánto tarda el server en aceptar el stream, en este test. Como en
 * `recuperarAlReconectar.test.tsx`: sin esta demora, el evento llegaría
 * mientras el pedido inicial del chip todavía está en vuelo, y la invalidación
 * no produciría un segundo `fetch` — el test pasaría con el cableado puesto Y
 * sacado, que es exactamente lo que un candado no puede hacer.
 */
const TARDANZA_DEL_STREAM_MS = 1_000;

/** Un stream que tarda en abrir y, ya abierto, manda UN evento sin cerrarse. */
function streamConEvento(cuerpoDelEvento: string): Promise<Response> {
  return new Promise((listo) => {
    setTimeout(() => {
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode(`data: ${cuerpoDelEvento}\n\n`));
        },
      });
      listo(new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    }, TARDANZA_DEL_STREAM_MS);
  });
}

let espia: ReturnType<typeof vi.fn>;

function stub(streamEvento: string) {
  espia = vi.fn(async (url: string) => {
    if (String(url).includes('/api/stream')) return streamConEvento(streamEvento);
    return new Response('{"ok":false}', { status: 503, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', espia);
}

beforeEach(() => {
  localStorage.setItem('hermes.token', 'tok');
  relojDeMentira();
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const pedidos = (parte: string) => espia.mock.calls.filter(([u]) => String(u).includes(parte)).length;

function AnfitrionAutoRespuesta() {
  useTiempoReal(true);
  useAutoRespuesta();
  return <div>anfitrión</div>;
}

function AnfitrionBot() {
  useTiempoReal(true);
  useBot();
  return <div>anfitrión</div>;
}

describe('el evento `cambio` invalida la clave que nombra', () => {
  it('`que: "autorespuesta"` refresca el chip de auto-respuesta', async () => {
    stub('{"tipo":"cambio","que":"autorespuesta"}');
    montado = montar(<AnfitrionAutoRespuesta />);
    await correrElReloj(0);
    expect(pedidos('/api/autorespuesta')).toBe(1); // el pedido del montaje, ya asentado

    // El stream abre (tarda `TARDANZA_DEL_STREAM_MS`) y entrega el evento.
    await correrElReloj(TARDANZA_DEL_STREAM_MS + 100);

    expect(pedidos('/api/autorespuesta')).toBe(2);
  });

  it('`que: "bot"` refresca el chip del bot', async () => {
    stub('{"tipo":"cambio","que":"bot"}');
    montado = montar(<AnfitrionBot />);
    await correrElReloj(0);
    expect(pedidos('/api/bot/estado')).toBe(1);

    await correrElReloj(TARDANZA_DEL_STREAM_MS + 100);

    expect(pedidos('/api/bot/estado')).toBe(2);
  });

  /**
   * ⚠️ Un `que` que este front no conoce (un server futuro con un tercer
   * chip) no tiene que tirar ni invalidar nada al azar: `[e.que]` sería una
   * queryKey que ninguna pantalla usa, así que no pasa nada — y eso es lo
   * correcto, no un caso a blindar con un `if` extra.
   */
  it('un `que` desconocido no rompe el render ni refresca nada', async () => {
    stub('{"tipo":"cambio","que":"algo-que-todavia-no-existe"}');
    montado = montar(<AnfitrionBot />);
    await correrElReloj(0);
    expect(pedidos('/api/bot/estado')).toBe(1);

    await correrElReloj(TARDANZA_DEL_STREAM_MS + 100);

    expect(pedidos('/api/bot/estado')).toBe(1);
    expect(montado.contenedor.textContent).toContain('anfitrión');
  });
});
