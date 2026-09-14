// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import { HiloWhatsapp } from './HiloWhatsapp';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * ELIMINAR UN MENSAJE — «delete for everyone», el molde exacto de
 * `editarEnHilo.test.tsx` (mismo ADR 0056, misma limitación de protocolo).
 *
 * ── Lo que este test vigila, y por qué se puede perder en un refactor ─────
 * 🔴 **Feature-detectado por `sesion.puedeEliminar`.** Sin la bandera (el
 * caso de la línea del bot, Cloud API), el botón NO PUEDE estar, o
 * prometería algo que el 409 del server desmentiría después.
 * · Solo en mensajes SALIENTES: nadie elimina lo que dijo el lead.
 * · Con la sesión caída, tampoco: el mismo criterio que Editar y Reaccionar.
 * · El clic NO manda nada todavía: primero pide confirmación inline.
 */

const TELEFONO = '51987654321';
const NUMERO_PROPIO = '51984429504';
const TEXTO_ORIGINAL = 'El diploma sale S/ 450';
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

const SALIENTE = { id: 1, direccion: 'saliente', autor: 'luz', texto: TEXTO_ORIGINAL, occurred_at: AHORA, external_id: 'wa:1' };
const ENTRANTE = { id: 2, direccion: 'entrante', autor: 'persona', texto: '¿cuánto cuesta?', occurred_at: AHORA, external_id: 'wa:2' };

let montado: Montado | null = null;
let posts: { url: string; body: unknown }[] = [];

function conMensajes(
  mensajesIniciales: Array<Record<string, unknown>>,
  sesion: Record<string, unknown> = { estado: 'conectado', puedeEliminar: true },
) {
  posts = [];
  // ESTATEFUL a propósito, mismo motivo que `editarEnHilo.test.tsx`: el
  // refetch que dispara `onSettled` tiene que devolver la eliminación
  // aplicada, o pisaría el update optimista con el mensaje intacto.
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
        if (url.includes('/api/whatsapp/eliminar') && body) {
          const fila = mensajes.find((m) => m.external_id === body.mensajeId);
          if (fila) fila.eliminado = { eliminadoEn: new Date().toISOString(), revocadoEnWhatsapp: true };
        }
      }
      if (url.includes('/api/whatsapp/sesion')) return json({ telefono: NUMERO_PROPIO, ...sesion });
      if (url.includes('/api/whatsapp/conversacion/')) return json({ telefono: TELEFONO, mensajes, origen: null });
      if (url.includes('/api/whatsapp/eliminar')) return json({ ok: true });
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

function botonesEliminar(m: Montado): HTMLButtonElement[] {
  return [...m.contenedor.querySelectorAll<HTMLButtonElement>('button')].filter(
    (b) => b.getAttribute('aria-label') === 'Eliminar este mensaje',
  );
}

describe('eliminar un mensaje saliente', () => {
  test('🔴 sin `puedeEliminar` (Cloud API) el botón no existe', async () => {
    conMensajes([SALIENTE], { estado: 'conectado', puedeEliminar: false });
    const m = await abrir();
    expect(botonesEliminar(m)).toHaveLength(0);
  });

  test('🔴 un server viejo (sin la bandera) tampoco lo ofrece', async () => {
    conMensajes([SALIENTE], { estado: 'conectado' }); // sin `puedeEliminar`
    const m = await abrir();
    expect(botonesEliminar(m)).toHaveLength(0);
  });

  test('solo en lo SALIENTE: lo que dijo el lead no se elimina', async () => {
    conMensajes([SALIENTE, ENTRANTE]);
    const m = await abrir();
    expect(botonesEliminar(m)).toHaveLength(1);
  });

  test('con la sesión caída, tampoco — mismo criterio que Editar y Reaccionar', async () => {
    conMensajes([SALIENTE], { estado: 'desconectado', puedeEliminar: true });
    const m = await abrir();
    expect(botonesEliminar(m)).toHaveLength(0);
  });

  test('tocar Eliminar pide confirmación — no manda nada todavía', async () => {
    conMensajes([SALIENTE]);
    const m = await abrir();

    tocar(botonesEliminar(m)[0]!);
    await reposar();

    expect(m.contenedor.textContent).toContain('¿Eliminar este mensaje para todos?');
    expect(posts.filter((p) => p.url.includes('/eliminar'))).toEqual([]);
  });

  test('Cancelar no manda nada, y cierra la confirmación', async () => {
    conMensajes([SALIENTE]);
    const m = await abrir();

    tocar(botonesEliminar(m)[0]!);
    await reposar();

    const cancelar = [...m.contenedor.querySelectorAll('button')].find((b) => b.textContent === 'Cancelar');
    tocar(cancelar!);
    await reposar();

    expect(posts.filter((p) => p.url.includes('/eliminar'))).toEqual([]);
    expect(m.contenedor.textContent).not.toContain('¿Eliminar este mensaje para todos?');
    // El mensaje sigue ahí, intacto — cancelar no lo tacha.
    expect(m.contenedor.textContent).toContain(TEXTO_ORIGINAL);
  });

  test('Confirmar manda el POST con el mensaje, el teléfono y la línea correctos', async () => {
    conMensajes([SALIENTE]);
    const m = await abrir();

    tocar(botonesEliminar(m)[0]!);
    await reposar();

    const confirmar = [...m.contenedor.querySelectorAll('button')].find((b) => b.textContent?.includes('Eliminar'));
    tocar(confirmar!);
    await reposar();

    const orden = posts.find((p) => p.url.includes('/eliminar'));
    expect(orden?.body).toEqual({
      numeroPropio: NUMERO_PROPIO,
      telefono: TELEFONO,
      mensajeId: 'wa:1',
    });
  });

  test('optimista: la burbuja se tacha antes de que vuelva el server, y pierde sus acciones', async () => {
    conMensajes([SALIENTE]);
    const m = await abrir();

    tocar(botonesEliminar(m)[0]!);
    await reposar();
    tocar([...m.contenedor.querySelectorAll('button')].find((b) => b.textContent?.includes('Eliminar'))!);
    await reposar();

    expect(m.contenedor.textContent).toContain('Se eliminó este mensaje');
    expect(m.contenedor.textContent).not.toContain(TEXTO_ORIGINAL);
    // Nada que copiar, citar ni volver a eliminar en un mensaje ya eliminado.
    expect(botonesEliminar(m)).toHaveLength(0);
  });
});
