// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import { ConversacionActiva } from './ConversacionActiva';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * LA FLECHA DE VOLVER EN CELULAR — el CABLEADO, no el dibujo.
 *
 * En el celular la lista de chats y el chat abierto no caben juntos, así que
 * el shell (d4) monta uno u otro y le pasa `onVolver` a `ConversacionActiva`.
 * Con eso, la cabecera del chat dibuja la flecha con el nombre del contacto,
 * como en WhatsApp. Sin `onVolver` —el escritorio, donde la lista sigue al
 * lado— la flecha NO existe: un botón que no lleva a ningún lado es peor que
 * ninguno.
 *
 * Lo que un test puro no puede ver: que la prop VIAJE desde `ConversacionActiva`
 * hasta la cabecera del canal que corresponda (WhatsApp y Messenger tienen
 * cabeceras distintas y las dos la tienen que montar), y que el clic la LLAME.
 * Es la forma de defecto de ADR 0024: la regla existe y nadie la cablea.
 *
 * jsdom no hace layout, así que acá no se afirma que en escritorio se esconda
 * (eso es `md:hidden`, y lo mira la captura de Playwright a 1280).
 */

const TELEFONO = '51987654321';
const NUMERO_PROPIO = '51984429504';
const AHORA = new Date().toISOString();

const WHATSAPP = {
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

const MESSENGER = {
  ...WHATSAPP,
  clave: 'conv:facebook:persona-1',
  canal: 'facebook',
  persona_id: 'persona-1',
  numero_propio: null,
} as Conversacion;

let montado: Montado | null = null;

function conServerFalso() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL) => {
      const url = String(entrada);
      const json = (c: unknown) =>
        new Response(JSON.stringify(c), { headers: { 'content-type': 'application/json' } });
      if (url.includes('/api/whatsapp/sesion')) return json({ telefono: NUMERO_PROPIO, estado: 'conectado' });
      if (url.includes('/api/whatsapp/conversacion/')) return json({ telefono: TELEFONO, mensajes: [], origen: null });
      if (url.includes('/api/persona/conv/')) return json({ historial: [], nombre: 'Javier', total: 0 });
      return json({});
    }),
  );
}

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
});

const flecha = () => montado!.contenedor.querySelector<HTMLButtonElement>('button[aria-label="Volver a la lista"]');

describe.each([
  ['WhatsApp', WHATSAPP],
  ['Messenger', MESSENGER],
])('la flecha de volver en %s', (_canal, conversacion) => {
  test('con onVolver aparece, lleva el nombre del contacto y el clic la llama', async () => {
    conServerFalso();
    const onVolver = vi.fn();
    montado = montar(<ConversacionActiva conversacion={conversacion} onCerrar={() => {}} onVolver={onVolver} />);
    await reposar();

    const boton = flecha();
    expect(boton).not.toBeNull();
    // El nombre va EN la flecha, como en WhatsApp: tocar el nombre también vuelve.
    expect(boton!.textContent).toContain('Javier');
    tocar(boton!);
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  test('sin onVolver no se dibuja: en escritorio la lista sigue al lado', async () => {
    conServerFalso();
    montado = montar(<ConversacionActiva conversacion={conversacion} onCerrar={() => {}} />);
    await reposar();
    expect(flecha()).toBeNull();
  });
});
