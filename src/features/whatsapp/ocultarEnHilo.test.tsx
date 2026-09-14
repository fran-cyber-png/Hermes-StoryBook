// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import { HiloWhatsapp } from './HiloWhatsapp';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * OCULTAR EL MENSAJE DE UN LEAD — «eliminar para mí», nunca «para todos»
 * (ADR 0100 §"eliminar el mensaje del lead"). WhatsApp no deja revocar lo que
 * uno no mandó, así que esto NUNCA toca la línea: no manda nada, no depende
 * de `puedeEliminar` ni de la sesión — al revés que `eliminarEnHilo.test.tsx`.
 *
 * ── Lo que este test vigila ────────────────────────────────────────────────
 * · Solo en mensajes ENTRANTES: lo que la vendedora mandó tiene su propio
 *   botón, «Eliminar» de verdad (con whatsmeow), no este.
 * · Funciona CON LA SESIÓN CAÍDA: no hay transporte de por medio.
 * · La confirmación dice, textual, que esto NO le llega al lead.
 * · La burbuja resultante dice «se ocultó en Hermes», nunca «se eliminó».
 */

const TELEFONO = '51987654321';
const NUMERO_PROPIO = '51984429504';
const TEXTO_LEAD = '¿cuánto cuesta el diploma?';
const AHORA = new Date().toISOString();

const CONVERSACION = {
  clave: `conv:whatsapp:${TELEFONO}:${NUMERO_PROPIO}`,
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: TELEFONO,
  persona_nombre: 'Javier',
  numero_propio: NUMERO_PROPIO,
  texto: 'hola',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: 'r1',
  ultimo_at: AHORA,
  dias: 0,
  nivel: 0,
} as Conversacion;

const ENTRANTE = { id: 1, direccion: 'entrante', autor: 'persona', texto: TEXTO_LEAD, occurred_at: AHORA, external_id: 'wa:1' };
const SALIENTE = { id: 2, direccion: 'saliente', autor: 'luz', texto: 'El diploma sale S/ 450', occurred_at: AHORA, external_id: 'wa:2' };

let montado: Montado | null = null;
let posts: { url: string; body: unknown }[] = [];

function conMensajes(
  mensajesIniciales: Array<Record<string, unknown>>,
  sesion: Record<string, unknown> = { estado: 'conectado' },
) {
  posts = [];
  const mensajes = mensajesIniciales.map((m) => ({ ...m }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      const json = (c: unknown) =>
        new Response(JSON.stringify(c), { headers: { 'content-type': 'application/json' } });
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        posts.push({ url, body });
        if (url.includes('/api/whatsapp/ocultar') && body) {
          const fila = mensajes.find((m) => m.external_id === body.mensajeId);
          if (fila) fila.eliminado = { eliminadoEn: new Date().toISOString(), revocadoEnWhatsapp: false };
        }
      }
      if (url.includes('/api/whatsapp/sesion')) return json({ telefono: NUMERO_PROPIO, ...sesion });
      if (url.includes('/api/whatsapp/conversacion/')) return json({ telefono: TELEFONO, mensajes, origen: null });
      if (url.includes('/api/whatsapp/ocultar')) return json({ ok: true });
      return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
    }),
  );
}

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
});

async function abrir(): Promise<Montado> {
  const m = montar(<HiloWhatsapp conversacion={CONVERSACION} />);
  await reposar();
  montado = m;
  return m;
}

function botonesOcultar(m: Montado): HTMLButtonElement[] {
  return [...m.contenedor.querySelectorAll<HTMLButtonElement>('button')].filter(
    (b) => b.getAttribute('aria-label') === 'Ocultar este mensaje',
  );
}

describe('ocultar el mensaje de un lead', () => {
  test('el botón existe en un mensaje ENTRANTE sin ninguna bandera especial', async () => {
    conMensajes([ENTRANTE], { estado: 'conectado' }); // sin `puedeEliminar`
    const m = await abrir();
    expect(botonesOcultar(m)).toHaveLength(1);
  });

  test('solo en lo ENTRANTE: lo que mandó la vendedora tiene su propio botón, no este', async () => {
    conMensajes([ENTRANTE, SALIENTE]);
    const m = await abrir();
    expect(botonesOcultar(m)).toHaveLength(1);
    // El saliente, en cambio, ofrece "Eliminar" (whatsmeow) — no "Ocultar".
    const eliminar = [...m.contenedor.querySelectorAll('button')].filter(
      (b) => b.getAttribute('aria-label') === 'Eliminar este mensaje',
    );
    expect(eliminar).toHaveLength(0); // sin `puedeEliminar` en la sesión de este test
  });

  test('🔴 funciona con la sesión CAÍDA: a diferencia de eliminar, no hay transporte de por medio', async () => {
    conMensajes([ENTRANTE], { estado: 'desconectado' });
    const m = await abrir();
    expect(botonesOcultar(m)).toHaveLength(1);
  });

  test('tocar Ocultar pide confirmación, y explica que esto NO le llega al lead', async () => {
    conMensajes([ENTRANTE]);
    const m = await abrir();

    tocar(botonesOcultar(m)[0]!);
    await reposar();

    expect(m.contenedor.textContent).toContain('¿Ocultar este mensaje en Hermes?');
    expect(m.contenedor.textContent).toContain('No se elimina del WhatsApp de Javier');
    expect(posts.filter((p) => p.url.includes('/ocultar'))).toEqual([]);
  });

  test('Cancelar no manda nada, y el mensaje del lead sigue intacto', async () => {
    conMensajes([ENTRANTE]);
    const m = await abrir();

    tocar(botonesOcultar(m)[0]!);
    await reposar();
    const cancelar = [...m.contenedor.querySelectorAll('button')].find((b) => b.textContent === 'Cancelar');
    tocar(cancelar!);
    await reposar();

    expect(posts.filter((p) => p.url.includes('/ocultar'))).toEqual([]);
    expect(m.contenedor.textContent).toContain(TEXTO_LEAD);
  });

  test('Confirmar manda el POST a /ocultar (no a /eliminar) con el mensaje y la línea', async () => {
    conMensajes([ENTRANTE]);
    const m = await abrir();

    tocar(botonesOcultar(m)[0]!);
    await reposar();
    const confirmar = [...m.contenedor.querySelectorAll('button')].find((b) => b.textContent?.includes('Ocultar'));
    tocar(confirmar!);
    await reposar();

    expect(posts.filter((p) => p.url.includes('/eliminar'))).toEqual([]);
    const orden = posts.find((p) => p.url.includes('/ocultar'));
    expect(orden?.body).toEqual({ numeroPropio: NUMERO_PROPIO, telefono: TELEFONO, mensajeId: 'wa:1' });
  });

  test('optimista: la burbuja dice «se ocultó en Hermes», nunca «se eliminó»', async () => {
    conMensajes([ENTRANTE]);
    const m = await abrir();

    tocar(botonesOcultar(m)[0]!);
    await reposar();
    tocar([...m.contenedor.querySelectorAll('button')].find((b) => b.textContent?.includes('Ocultar'))!);
    await reposar();

    expect(m.contenedor.textContent).toContain('Se ocultó este mensaje en Hermes');
    expect(m.contenedor.textContent).not.toContain('Se eliminó este mensaje');
    expect(m.contenedor.textContent).not.toContain(TEXTO_LEAD);
  });
});
