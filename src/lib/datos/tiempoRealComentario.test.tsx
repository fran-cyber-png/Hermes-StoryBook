// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { montar, type Montado } from '../../pruebas/dom';
import { useTiempoReal } from './tiempoReal';
import { useEstadoDeRespuesta, useQuienesTienenAbierto } from '../../features/canales/respuestaUnica';

/**
 * 🔴 EL AVISO DE UN COMENTARIO REFRESCA LO QUE ESE COMENTARIO YA TIENE (13-sep-2026).
 *
 * Es el cable de la presencia en vivo: otra agente abre, cierra o responde el
 * comentario, el server manda `{tipo:'comentario', interactionId}`, y el panel
 * que lo tiene abierto vuelve a pedir su estado. Sin este cable, la segunda
 * agente se enteraría recién con la red de 30 s, o al apretar enviar, que es
 * justo lo que llevó al comentario de Nina Silva a cuatro respuestas.
 *
 * Se monta el stream de verdad, igual que `tiempoRealCambio.test.tsx`: `manejar`
 * vive adentro de `useTiempoReal` y no se exporta, así que un test puro no puede
 * ver si el cable está puesto (ADR 0024).
 */

let montado: Montado | null = null;

const NINA = 521348;
/** Lo mismo que `tiempoRealCambio.test.tsx`: sin la demora, el evento llega con el primer pedido en vuelo. */
const TARDANZA_DEL_STREAM_MS = 1_000;

async function correrElReloj(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

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
    if (String(url).includes('/api/responder/presencias')) {
      return new Response('{"presencias":{}}', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url).includes(`/api/responder/${NINA}/estado`)) {
      return new Response('{"respuestas":[],"respondiendo":[]}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('{"ok":false}', { status: 503, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', espia);
}

beforeEach(() => {
  localStorage.setItem('hermes.token', 'tok');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const pedidosDelEstado = () => espia.mock.calls.filter(([u]) => String(u).includes(`/api/responder/${NINA}/estado`)).length;

/** Un panel con el comentario de Nina abierto, con el stream conectado. */
function PanelAbierto() {
  useTiempoReal(true);
  useEstadoDeRespuesta(NINA, true);
  return <div>panel</div>;
}

describe('el evento `comentario` refresca sólo el estado de ese comentario', () => {
  it('🔴 el aviso de ESE comentario lo vuelve a pedir', async () => {
    stub(`{"tipo":"comentario","interactionId":${NINA}}`);
    montado = montar(<PanelAbierto />);
    await correrElReloj(0);
    expect(pedidosDelEstado()).toBe(1);

    await correrElReloj(TARDANZA_DEL_STREAM_MS + 100);

    expect(pedidosDelEstado()).toBe(2);
  });

  it('el aviso de OTRO comentario no pide nada', async () => {
    stub('{"tipo":"comentario","interactionId":521350}');
    montado = montar(<PanelAbierto />);
    await correrElReloj(0);

    await correrElReloj(TARDANZA_DEL_STREAM_MS + 100);

    expect(pedidosDelEstado()).toBe(1);
  });

  it('🔴 recortado, sin id, no pide nada ni rompe el render', async () => {
    // Es lo que recibe una agente de la Escuela cuando el comentario es de una
    // Página de campaña (`server/src/realtime/visibilidad.ts`).
    stub('{"tipo":"comentario"}');
    montado = montar(<PanelAbierto />);
    await correrElReloj(0);

    await correrElReloj(TARDANZA_DEL_STREAM_MS + 100);

    expect(pedidosDelEstado()).toBe(1);
    expect(montado.contenedor.textContent).toContain('panel');
  });
});

const pedidosDePresencias = () => espia.mock.calls.filter(([u]) => String(u).includes('/api/responder/presencias')).length;

/** Una lista con pastillas de comentario (la cola o el Pipeline), con el stream conectado. */
function ListaConPastillas() {
  useTiempoReal(true);
  useQuienesTienenAbierto(NINA);
  useQuienesTienenAbierto(521350);
  return <div>lista</div>;
}

describe('el evento `comentario` refresca las pastillas de la lista (ADR 0121)', () => {
  it('🔴 el aviso de un comentario vuelve a pedir quién tiene abierto qué, agrupado', async () => {
    stub('{"tipo":"comentario","interactionId":521999}');
    montado = montar(<ListaConPastillas />);
    await correrElReloj(0);
    expect(pedidosDePresencias(), 'dos pastillas, un pedido').toBe(1);

    await correrElReloj(TARDANZA_DEL_STREAM_MS + 100);
    expect(pedidosDePresencias(), 'agrupado: todavía no').toBe(1);

    await correrElReloj(3_100);
    expect(pedidosDePresencias()).toBe(2);
  });

  it('recortado, sin id, no pide nada', async () => {
    stub('{"tipo":"comentario"}');
    montado = montar(<ListaConPastillas />);
    await correrElReloj(0);

    await correrElReloj(TARDANZA_DEL_STREAM_MS + 3_100);
    expect(pedidosDePresencias()).toBe(1);
  });
});
