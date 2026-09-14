// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, type Montado } from '../../pruebas/dom';
import { idDeComentario, type Conversacion } from '../../dominio/conversaciones';
import { FilaConversacion } from './FilaConversacion';
import { TarjetaEmbudo } from '../vistas/TarjetaEmbudo';
import type { ReactNode } from 'react';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { claves } from '../../lib/datos/cliente';
import { leerPresencias } from './respuestaUnica';

/**
 * «RESPONDIDO» Y «QUIÉN LO TIENE ABIERTO», SIN ABRIR EL COMENTARIO (ADR 0121).
 *
 * Montado, porque lo que se rompe es el cableado: que la fila y la tarjeta
 * llamen a las pastillas sólo en comentarios, y que cien pastillas no hagan cien
 * pedidos. Los ids son los de la Página de Américo (521348, el de Nina Silva).
 */

const COMENTARIO: Conversacion = {
  clave: 'int:521348',
  canal: 'facebook',
  tipo: 'comentario',
  persona_id: null,
  persona_nombre: 'Nina Silva',
  numero_propio: null,
  texto: 'La mejor opción! RR 🩵💪🏻',
  contexto_texto: null,
  respondida: true,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: '2026-09-12T17:12:28.000Z',
  ultimo_at: '2026-09-12T17:12:28.000Z',
  dias: 0,
  nivel: 2,
};

const CHAT: Conversacion = {
  ...COMENTARIO,
  clave: 'conv:whatsapp:51987654321:51912789170',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51987654321',
  numero_propio: '51912789170',
};

let vista: Montado | null = null;
let presencias: unknown;
let espia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  presencias = { presencias: {} };
  espia = vi.fn(async (url: string) => {
    if (String(url).includes('/api/responder/presencias')) {
      return new Response(JSON.stringify(presencias), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', espia);
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

const pedidosDePresencias = () => espia.mock.calls.filter(([u]) => String(u).includes('/api/responder/presencias')).length;
const pastilla = (cual: 'respondido' | 'abierto') => vista!.contenedor.querySelectorAll(`[data-pastilla="${cual}"]`);

const fila = (c: Conversacion) => <FilaConversacion c={c} seleccionada={false} onAbrir={vi.fn()} indice={0} />;
const tarjeta = (c: Conversacion) => (
  <TarjetaEmbudo
    c={c}
    indice={0}
    onAbrir={vi.fn()}
    alArrastrar={vi.fn()}
    alTerminar={vi.fn()}
    arrastrando={false}
    rebotada={false}
    cotizando={false}
  />
);

describe.each([
  ['la fila de la cola', fila],
  ['la tarjeta del Pipeline', tarjeta],
])('%s', (_donde, pintar) => {
  it('🔴 un comentario respondido lleva «Respondido»', () => {
    vista = montar(pintar(COMENTARIO));
    expect(pastilla('respondido')).toHaveLength(1);
    expect(pastilla('respondido')[0].textContent).toBe('Respondido');
  });

  it('sin responder, no', () => {
    vista = montar(pintar({ ...COMENTARIO, respondida: false }));
    expect(pastilla('respondido')).toHaveLength(0);
  });

  it('🔴 un CHAT respondido no lleva las pastillas del comentario, ni pide presencias', async () => {
    vista = montar(pintar(CHAT));
    await reposar();
    expect(pastilla('respondido')).toHaveLength(0);
    expect(pedidosDePresencias()).toBe(0);
  });

  it('🔴 dice quién tiene abierto el comentario', async () => {
    presencias = {
      presencias: { 521348: [{ quien: 'centurion:americo.agente4', nombre: null, desde: '2026-09-13T17:00:00.000Z' }] },
    };
    vista = montar(pintar(COMENTARIO));
    await esperarA(() => pastilla('abierto').length === 1, 'la pastilla de presencia');
    // El username entero, como en el panel: «Americo» se leería como el candidato.
    expect(pastilla('abierto')[0].textContent).toBe('americo.agente4');
  });

  it('si nadie lo tiene abierto, no dibuja nada', async () => {
    presencias = { presencias: { 521350: [{ quien: 'luz', nombre: 'Luz', desde: '2026-09-13T17:00:00.000Z' }] } };
    vista = montar(pintar(COMENTARIO));
    await esperarA(() => pedidosDePresencias() === 1, 'el pedido de presencias');
    await reposar();
    expect(pastilla('abierto')).toHaveLength(0);
  });
});

it('🔴 en la fila, el ✓ de «respondida» no se repite al lado de la pastilla', () => {
  vista = montar(fila(COMENTARIO));
  expect(vista.contenedor.querySelector('[aria-label="respondida"]')).toBeNull();
  vista.desmontar();

  vista = montar(fila(CHAT));
  expect(vista.contenedor.querySelector('[aria-label="respondida"]'), 'en un chat el ✓ sigue').not.toBeNull();
});

it('🔴 cien pastillas hacen UN pedido', async () => {
  presencias = {
    presencias: { 521360: [{ quien: 'centurion:americo.agente2', nombre: 'Rosa Quispe', desde: '2026-09-13T17:00:00.000Z' }] },
  };
  const filas = Array.from({ length: 100 }, (_, i) => ({ ...COMENTARIO, clave: `int:${521300 + i}` }));
  vista = montar(<>{filas.map((c) => <div key={c.clave}>{fila(c)}</div>)}</>);
  await esperarA(() => pastilla('abierto').length === 1, 'la pastilla de la 521360');
  await reposar();

  expect(pedidosDePresencias()).toBe(1);
  expect(pastilla('abierto')[0].textContent).toBe('Rosa Quispe');
});

it('🔴 cien pastillas: UN reloj de red para todas, y ninguna con `refetchInterval` propio', async () => {
  // `refetchInterval` arma un reloj por observador: con las filas montándose al scrollear salían
  // hasta cien pedidos cada 30 s (revisión de ADR 0121). Se mira el mecanismo y no un reloj
  // falso: los intervalos de react-query no pasan por el `setInterval` que falsea vitest.
  const relojes = vi.spyOn(globalThis, 'setInterval');
  const detenidos = vi.spyOn(globalThis, 'clearInterval');
  try {
    let cliente!: QueryClient;
    function ConElCliente({ children }: { children: ReactNode }) {
      cliente = useQueryClient();
      return <>{children}</>;
    }
    const filas = Array.from({ length: 100 }, (_, i) => ({ ...COMENTARIO, clave: `int:${521300 + i}` }));
    vista = montar(<ConElCliente>{filas.map((c) => <div key={c.clave}>{fila(c)}</div>)}</ConElCliente>);
    await esperarA(() => pedidosDePresencias() === 1, 'el pedido de presencias');

    const deLaRed = relojes.mock.calls.map((llamada, i) => ({ ms: llamada[1], id: relojes.mock.results[i]?.value })).filter((r) => r.ms === 30_000);
    expect(deLaRed, 'un solo reloj de 30 s para las cien').toHaveLength(1);

    const observadores = cliente.getQueryCache().find({ queryKey: claves.presenciasDeComentarios() })!.observers;
    expect(observadores.length).toBeGreaterThan(0);
    expect(observadores.filter((o) => o.options.refetchInterval), 'ninguna con su propio reloj').toHaveLength(0);

    vista.desmontar();
    vista = null;
    expect(detenidos.mock.calls.some(([id]) => id === deLaRed[0].id), 'al desmontar la última, el reloj se apaga').toBe(true);
  } finally {
    relojes.mockRestore();
    detenidos.mockRestore();
  }
});

it('idDeComentario: sólo las claves de comentario, y sólo si es un comentario', () => {
  expect(idDeComentario({ tipo: 'comentario', clave: 'int:521348' })).toBe(521348);
  expect(idDeComentario({ tipo: 'mensaje', clave: 'int:521348' })).toBeNull();
  expect(idDeComentario({ tipo: 'mensaje', clave: 'conv:whatsapp:51987654321:51912789170' })).toBeNull();
  expect(idDeComentario({ tipo: 'comentario', clave: 'int:' })).toBeNull();
  expect(idDeComentario({ tipo: 'lead', clave: 'landing:9001' })).toBeNull();
});

it('leerPresencias: un server anterior o una respuesta rara dejan a nadie', () => {
  expect(leerPresencias(null)).toEqual({});
  expect(leerPresencias({ error: 'not found' })).toEqual({});
  expect(leerPresencias({ presencias: [] })).toEqual({});
  expect(leerPresencias({ presencias: { 1: 'x', 2: [] } })).toEqual({});
});
