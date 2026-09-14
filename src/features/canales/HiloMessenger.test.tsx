// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { escribir, esperarA, montar, tocar, type Montado } from '../../pruebas/dom';
import { HiloMessenger } from './HiloMessenger';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * EL PIE DEL HILO DE MESSENGER — el CABLEADO del motivo, no la regla.
 *
 * La regla (cuándo se puede escribir, y qué decir si no) vive en el server:
 * `responder/ventanaDeMessenger.ts` y `responder/errorLegible.ts`, con sus
 * tests. Éste cubre lo que aquéllos no pueden ver: que la frase que el server
 * escribió LLEGUE a la pantalla.
 *
 * 🔴 **El defecto real (4-sep-2026)**: el server contestaba
 * `502 { type: 'meta_rechazo', error: 'Esta persona no puede recibir…' }` y la
 * pantalla mostraba «No se pudo enviar. Puedes intentarlo de nuevo en un
 * momento» — leía `.error` de un `ErrorApi` que no tiene esa propiedad. La
 * vendedora reintentó siete veces contra un rechazo que no cambia con
 * reintentar. Es ADR 0024 otra vez: la traducción estaba bien y nadie la
 * mostraba.
 */

const conversacion = {
  clave: 'conv:facebook:27797148129984063:',
  canal: 'facebook',
  tipo: 'mensaje',
  persona_id: '27797148129984063',
  persona_nombre: 'Jin Pierre Mestanza',
  numero_propio: null,
  texto: '.',
  contexto_texto: null,
  respondida: true,
  ventana_abierta: true,
  pregunto: false,
  n: 2,
  referencia: '2026-09-04T15:09:56Z',
  ultimo_at: '2026-09-04T15:09:56Z',
  dias: 0,
  nivel: 5,
} as Conversacion;

const MOTIVO_DE_META = 'Esta persona no puede recibir mensajes de la página. Puede que haya bloqueado los mensajes o cerrado su cuenta.';
const TODAVIA_NO_CONTESTA =
  'Le escribimos por Messenger y todavía no contesta. Cuando responda se abre el plazo de 24 horas para seguir la conversación.';

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
}

function hiloCon(ventana: { puede: boolean; explicacion: string }) {
  return {
    historial: [{ id: 1, direccion: 'saliente', autor: 'pagina', texto: '.', occurred_at: '2026-09-04T15:09:56Z' }],
    nombre: 'Jin Pierre Mestanza',
    total: 1,
    ventana: { ...ventana, restanteMs: ventana.puede ? 3_600_000 : 0 },
  };
}

/** El server: el GET trae el hilo; el POST contesta lo que el test decida. */
function servidor(hilo: unknown, alEnviar: () => Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => ((init?.method ?? 'GET') === 'POST' ? alEnviar() : json(hilo))),
  );
}

let vista: Montado | null = null;
const texto = () => vista?.contenedor.textContent ?? '';
const redactor = () => vista?.contenedor.querySelector('textarea') as HTMLTextAreaElement | null;

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

test('🔴 cuando Meta rechaza, se lee el motivo que el server tradujo — no el genérico', async () => {
  servidor(hiloCon({ puede: true, explicacion: 'Puedes escribirle por 1 h 0 min más.' }), () =>
    json({ type: 'meta_rechazo', error: MOTIVO_DE_META }, 502),
  );
  vista = montar(<HiloMessenger conversacion={conversacion} />);
  await esperarA(() => redactor() !== null, 'el redactor abierto');

  escribir(redactor()!, 'Hola Jin');
  tocar(vista.contenedor.querySelector('button[aria-label="Enviar por Messenger"]')!);
  await esperarA(() => texto().includes('no puede recibir mensajes'), 'el motivo del server en pantalla');

  // Y sin el consejo de reintentar: contra este rechazo, reintentar no cambia nada.
  expect(texto()).not.toContain('intentarlo de nuevo');
});

test('cuando la persona sólo comentó, el server cierra el redactor y la pantalla dice por qué', async () => {
  servidor(hiloCon({ puede: false, explicacion: TODAVIA_NO_CONTESTA }), () => {
    throw new Error('no tenía que salir ningún envío');
  });
  vista = montar(<HiloMessenger conversacion={conversacion} />);
  await esperarA(() => texto().includes('todavía no contesta'), 'la explicación del plazo');

  expect(redactor()).toBeNull();
});

/** El hilo con una foto de Messenger ya bajada, y la media servida como la sirve Hermes. */
function servidorConFoto() {
  const hilo = {
    ...hiloCon({ puede: true, explicacion: 'Puedes escribirle por 1 h 0 min más.' }),
    historial: [
      {
        id: 2,
        direccion: 'entrante',
        autor: 'persona',
        texto: null,
        occurred_at: '2026-09-11T15:00:00Z',
        adjuntos: [{ clase: 'imagen', archivo: 'meta-m_1-0.jpg', mime: 'image/jpeg', nombre: null }],
      },
    ],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      String(url).includes('/api/whatsapp/media/')
        ? ({ ok: true, status: 200, blob: async () => new Blob(['x'], { type: 'image/jpeg' }) } as unknown as Response)
        : json(hilo),
    ),
  );
}

const fotoEnElHilo = () => vista?.contenedor.querySelector('button[title="Ver completa"]') ?? null;

/**
 * 🔴 LA FOTO DEL LEAD SE VE — antes decía «(sin texto)».
 *
 * La ingesta de Meta guardaba sólo el texto, así que una foto por Messenger era
 * una burbuja con «(sin texto)» y la vendedora tenía que ir a Business Suite. El
 * server ahora la baja al llegar y la manda en `adjuntos`; esto fija que el hilo
 * la DIBUJE, con el mismo componente del hilo de WhatsApp, y ofrezca guardarla.
 */
test('🔴 un mensaje con foto y sin texto muestra la foto y Descargar, no «(sin texto)»', async () => {
  servidorConFoto();
  vista = montar(<HiloMessenger conversacion={conversacion} />);
  await esperarA(() => Boolean(fotoEnElHilo()?.querySelector('img')), 'la foto en el hilo');

  expect(texto()).not.toContain('(sin texto)');
  expect(vista.contenedor.querySelector('button[title^="Descargar imagen-2026-09-11"]')).not.toBeNull();
});

/**
 * 🔴 LOS DOS VISORES, DEL LADO DE MESSENGER.
 *
 * En el hilo de WhatsApp la foto abre `VisorDeImagen`, que vive en el hilo y
 * recorre sus fotos (`visorDeImagenEnHilo.test.tsx`). El de Messenger no le pasa
 * `onAmpliar` a la burbuja, así que la foto abre `VisorDeAdjunto`. Si esa rama se
 * pierde, «Ver completa» queda como un botón que no abre nada, y ningún test del
 * hilo de WhatsApp puede verlo.
 */
test('🔴 la foto de Messenger se abre en el visor de adjuntos, con Descargar adentro', async () => {
  servidorConFoto();
  vista = montar(<HiloMessenger conversacion={conversacion} />);
  await esperarA(() => Boolean(fotoEnElHilo()?.querySelector('img')), 'la foto en el hilo');

  tocar(fotoEnElHilo()!);

  await esperarA(
    () => document.querySelector('[role="dialog"][aria-label^="imagen-2026-09-11.jpg"]') !== null,
    'el visor de adjuntos abierto con la foto',
  );
  expect(document.querySelector('[role="dialog"] button[title="Descargar imagen-2026-09-11.jpg"]')).not.toBeNull();
});
