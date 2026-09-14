// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { montar, type Montado } from '../../pruebas/dom';
import { useTiempoReal } from './tiempoReal';
import { useNegocio } from '../../features/dashboard/negocio';
import { useHoy } from '../../features/dashboard/hoy';
import { useSeriesDashboard } from '../../features/dashboard/series';

/**
 * 🔴 HOTFIX «el negocio no tumba producción» — el SSE ya no refresca «El negocio».
 *
 * `['dashboard']` invalidaba TODO lo que empezara con esa clave, `['dashboard',
 * 'negocio', ...]` incluido — y con 7-18 mensajes por minuto en producción, eso
 * era pisarle el `staleTime` de 120 s a la consulta de 9-13 s cada 15-19 s. Es
 * la mitad de la tormenta que la caché del server (`cacheNegocio.ts`) no puede
 * ver sola: aunque la caché sirviera gratis, seguiría siendo un round-trip por
 * cada pestaña y cada mensaje.
 *
 * Mismo patrón que `tiempoRealCambio.test.tsx`: se monta el stream real y se
 * cuenta el `fetch` de verdad — el cableado vive adentro de `useTiempoReal` y
 * no se exporta, así que un test puro del predicate no vería si alguien lo usa.
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

const TARDANZA_DEL_STREAM_MS = 1_000;

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

/** Lo mínimo que «Hoy» contesta: la forma de `DatosHoy`, en cero. */
const HOY_VACIO = {
  inicioDeHoy: '2026-09-10T05:00:00.000Z',
  generadoEn: '2026-09-10T05:00:00.000Z',
  supervisor: true,
  modulo: 'ventas',
  lineas: [],
  escribieron: { total: 0, porLinea: [] },
  sinRespuesta: { total: 0, porDuena: [], porLinea: [] },
  calientesSinDuena: { total: 0, porLinea: [] },
  personas: [],
  sinAtribuir: [],
};

function stub(streamEvento: string) {
  espia = vi.fn(async (url: string) => {
    if (String(url).includes('/api/stream')) return streamConEvento(streamEvento);
    if (String(url).includes('/api/dashboard/negocio')) {
      return new Response(
        JSON.stringify({
          rango: { desde: '2026-01-01', hasta: '2026-01-08' },
          periodo: '7d',
          numeros: [],
          numero_propio: null,
          dimension: 'curso',
          atencion: {
            conversaciones: 0,
            esperan: 0,
            nunca_respondidos: 0,
            sin_atender_24h: 0,
            demora_mediana_en_horario_min: null,
            demora_mediana_fuera_min: null,
            llegaron_fuera_de_horario: 0,
            cobertura: [],
          },
          filas: [],
          sin_atribuir: 0,
          subregistro: { cotizados: 0, precio_mencionado: 0 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (String(url).includes('/api/dashboard/hoy')) {
      return new Response(JSON.stringify(HOY_VACIO), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url).includes('/api/dashboard/series')) {
      return new Response(JSON.stringify({ leads_dia: [], envios_dia: [], ventas_dia: [] }), {
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

function AnfitrionNegocio() {
  useTiempoReal(true);
  useNegocio({ periodo: '7d', numero: null, dimension: 'curso', activo: true });
  return <div>anfitrión</div>;
}

describe('el SSE no refresca «El negocio»', () => {
  it('un evento `mensaje` (la campanita) no dispara un segundo fetch de /api/dashboard/negocio', async () => {
    stub('{"tipo":"mensaje","direccion":"entrante","telefono":"51987654321"}');
    montado = montar(<AnfitrionNegocio />);
    await correrElReloj(0);
    expect(pedidos('/api/dashboard/negocio')).toBe(1); // el pedido del montaje

    // El stream abre y entrega el evento; la ventana agrupada (15 s + jitter)
    // ya venció de sobra a los 20 s.
    await correrElReloj(TARDANZA_DEL_STREAM_MS + 20_000);

    expect(pedidos('/api/dashboard/negocio')).toBe(1);
  });
});

function AnfitrionHoy() {
  useTiempoReal(true);
  useHoy({ activo: true });
  useSeriesDashboard({ activo: true });
  return <div>anfitrión</div>;
}

/**
 * 🔴 Y TAMPOCO «HOY» NI LA TIRA DE LOS ÚLTIMOS 14 DÍAS (ADR 0104).
 *
 * El mismo motivo, con otra consulta: cada pedido de «Hoy» arma en el server la
 * `todo` de la cola (1 a 2 s medidos en producción), y la serie de 14 días cambia
 * una vez por día. Con el prefijo `['dashboard']` invalidado por cada mensaje,
 * cada Dashboard abierto volvería a pagarlo cada 15 a 19 s.
 */
describe('el SSE tampoco refresca «Hoy» ni la tira de los últimos 14 días', () => {
  it('un evento `mensaje` no vuelve a pedir /api/dashboard/hoy ni /api/dashboard/series', async () => {
    stub('{"tipo":"mensaje","direccion":"entrante","telefono":"51987654321"}');
    montado = montar(<AnfitrionHoy />);
    await correrElReloj(0);
    expect(pedidos('/api/dashboard/hoy')).toBe(1);
    expect(pedidos('/api/dashboard/series')).toBe(1);

    await correrElReloj(TARDANZA_DEL_STREAM_MS + 20_000);

    expect(pedidos('/api/dashboard/hoy')).toBe(1);
    expect(pedidos('/api/dashboard/series')).toBe(1);
  });
});
