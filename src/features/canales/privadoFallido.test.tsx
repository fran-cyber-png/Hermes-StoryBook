// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { escribir, esperarA, montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import ResponderPanel from './ResponderPanel';
import type { Interaccion } from './types';
import type { Conversacion } from '../../dominio/conversaciones';
import { olvidarUltimaPlantilla } from '../../dominio/plantillaPublica';

/**
 * SI EL PRIVADO FALLA, EL PÚBLICO NO SALE SOLO — el panel, montado.
 *
 * El 11-sep-2026, en la Página de Américo, 13 privados rebotaron con
 * `(#10900) Activity already replied to` y en cada uno se publicó un texto de la
 * Escuela que la agente no había escrito ni visto. Lo que este archivo fija:
 *
 * · el envío ya no lleva ningún texto de repuesto;
 * · el fallo se muestra, con la causa en castellano, y se dice que no se publicó nada;
 * · publicar el público queda en manos de la vendedora, con un botón visible, y lo que
 *   sale es exactamente lo que tiene en la caja, sin privado.
 */

const EN_PANTALLA = '¡Gracias por tu comentario! Te leemos.';
const PRIVADO = 'Hola, te escribo por aquí.';
const CAUSA = 'Mensaje privado: A esta persona ya se le respondió por privado en este comentario.';

const COMENTARIO: Interaccion = {
  id: 1,
  canal: 'facebook',
  tipo: 'comentario',
  persona_nombre: null,
  texto: 'Fuerza Américo',
  contexto_texto: null,
  occurred_at: new Date(1_700_000_000_000).toISOString(),
  status: 'pendiente',
  pide_info: false,
  ventana_abierta: true,
  dias: 1,
};

const CONVERSACION: Conversacion = {
  clave: 'int:1',
  canal: 'facebook',
  tipo: 'comentario',
  persona_id: null,
  persona_nombre: null,
  numero_propio: null,
  texto: 'Fuerza Américo',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: COMENTARIO.occurred_at,
  ultimo_at: COMENTARIO.occurred_at,
  dias: 1,
  nivel: 2,
};

/** Los cuerpos de cada POST a `/api/responder`, en orden. */
let envios: Record<string, unknown>[];
let vista: Montado;

beforeEach(() => {
  olvidarUltimaPlantilla();
  envios = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const json = (cuerpo: unknown, status = 200) =>
        new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

      if (u.includes('/api/responder/') && init?.method === 'POST') {
        envios.push(JSON.parse(String(init.body)));
        // El primero rebota como en producción; el segundo es la confirmación sin privado.
        return envios.length === 1
          ? json({ type: 'privado_fallo', message: 'No se publicó nada.', errores: [CAUSA] }, 409)
          : json({ type: 'enviado', publico: 'c_1', errores: [] });
      }
      if (u.includes('/puede-privado')) {
        return json({ puede: true, motivo: null, dias: 1, modulo: 'campana', cliente: 'americo' });
      }
      if (u.includes('/contexto')) return json({ post: null, adjunto: null, estado: {} });
      return json({ permalink: null });
    }),
  );
});

afterEach(() => {
  vista?.desmontar();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const botonConTexto = (texto: string) =>
  [...vista.contenedor.querySelectorAll('button')].find((b) => b.textContent?.includes(texto));

async function responderConElPrivadoRebotando() {
  vista = montar(
    <ResponderPanel interaccion={COMENTARIO} conversacion={CONVERSACION} onCerrar={() => {}} onRespondido={() => {}} />,
  );
  await reposar();
  const [cajaPublica, cajaPrivada] = vista.contenedor.querySelectorAll('textarea');
  escribir(cajaPublica as HTMLTextAreaElement, EN_PANTALLA);
  escribir(cajaPrivada as HTMLTextAreaElement, PRIVADO);
  tocar(vista.contenedor.querySelector('button[aria-label="Enviar la respuesta a esta persona"]')!);
  await esperarA(() => envios.length === 1, 'que salga el envío');
  await reposar();
}

test('🔴 el envío no lleva ningún texto de repuesto', async () => {
  await responderConElPrivadoRebotando();

  expect(envios[0]).toEqual({ mensajePublico: EN_PANTALLA, mensajePrivado: PRIVADO });
});

test('🔴 con el privado rebotado se ve la causa, se dice que no salió nada y no se manda otro pedido solo', async () => {
  await responderConElPrivadoRebotando();

  const texto = vista.contenedor.textContent ?? '';
  expect(texto).toContain('ya se le respondió por privado en este comentario');
  expect(texto).toContain('No se publicó nada');
  expect(botonConTexto('Publicar solo la respuesta pública')).toBeDefined();
  await reposar();
  expect(envios).toHaveLength(1);
});

test('🔴 el clic visible publica exactamente lo que está en la caja, sin privado', async () => {
  await responderConElPrivadoRebotando();

  tocar(botonConTexto('Publicar solo la respuesta pública')!);
  await esperarA(() => envios.length === 2, 'que salga la confirmación');
  await reposar();

  expect(envios[1]).toEqual({ mensajePublico: EN_PANTALLA, mensajePrivado: '' });
  expect(vista.contenedor.textContent).toContain('Respondido');
});
