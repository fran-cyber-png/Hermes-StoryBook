// @vitest-environment jsdom
import { act } from 'react';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { claves } from '../../lib/datos/cliente';
import { escribir, esperarA, montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import ResponderPanel from './ResponderPanel';
import type { Interaccion } from './types';
import type { Conversacion } from '../../dominio/conversaciones';
import { olvidarUltimaPlantilla } from '../../dominio/plantillaPublica';
import type { EstadoDeRespuesta, RespuestaPrevia } from './respuestaUnica';
import { simularPantalla, type PantallaSimulada } from '../../pruebas/pantalla';

/**
 * UN COMENTARIO SE RESPONDE UNA VEZ — el panel, montado (13-sep-2026).
 *
 * El comentario de Nina Silva en la Página de Américo recibió cuatro respuestas,
 * de agentes distintas, porque el panel abría siempre con la caja vacía. El
 * server ya frena la duplicada. Esto fija lo que la pantalla tiene que hacer con
 * eso: mostrar lo que ya tiene ANTES de dejar escribir, anunciar a quien lo tiene
 * abierto, y no dejar el 409 como un error suelto.
 *
 * Los textos son las cuatro respuestas reales (candado 10).
 */

const COMENTARIO: Interaccion = {
  id: 521348,
  canal: 'facebook',
  tipo: 'comentario',
  persona_nombre: 'Nina Silva',
  texto: '',
  contexto_texto: null,
  occurred_at: new Date(1_700_000_000_000).toISOString(),
  status: 'contactado',
  pide_info: false,
  ventana_abierta: true,
  dias: 0,
};

const CONVERSACION: Conversacion = {
  clave: 'int:521348',
  canal: 'facebook',
  tipo: 'comentario',
  persona_id: null,
  persona_nombre: 'Nina Silva',
  numero_propio: null,
  texto: '',
  contexto_texto: null,
  respondida: true,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: COMENTARIO.occurred_at,
  ultimo_at: COMENTARIO.occurred_at,
  dias: 0,
  nivel: 2,
};

const DE_NINA: RespuestaPrevia[] = [
  'Hola Nina Silva te agradezco',
  'Buenos días estimada sigamos adelante',
  'Hola te invito a seguirme en mi canal de WhatsApp!',
  'Vecina Nina! Feliz de contar con tu apoyo, saludos!',
].map((texto, i) => ({
  origen: 'hermes',
  cuando: new Date(Date.now() - (4 - i) * 3_600_000).toISOString(),
  quien: `centurion:americo.agente${i + 1}`,
  nombre: null,
  texto,
  conPrivado: false,
}));

let estado: EstadoDeRespuesta;
let respuestaDelEnvio: () => Response;
let pedidos: { url: string; metodo: string; cuerpo: Record<string, unknown> | null }[];
let vista: Montado;

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  olvidarUltimaPlantilla();
  estado = { respuestas: [], respondiendo: [] };
  respuestaDelEnvio = () => json({ type: 'enviado', publico: 'c_1', errores: [] });
  pedidos = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const metodo = init?.method ?? 'GET';
      pedidos.push({ url: u, metodo, cuerpo: init?.body ? JSON.parse(String(init.body)) : null });

      if (u.includes('/estado')) return json(estado);
      if (u.includes('/presencia')) return json({ ok: true });
      if (u.includes('/api/responder/') && metodo === 'POST') return respuestaDelEnvio();
      if (u.includes('/puede-privado')) {
        return json({ puede: true, motivo: null, dias: 0, modulo: 'campana', cliente: 'americo' });
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

const texto = () => vista.contenedor.textContent ?? '';
const cajas = () => vista.contenedor.querySelectorAll('textarea');
const botonConTexto = (t: string) =>
  [...vista.contenedor.querySelectorAll('button')].find((b) => b.textContent?.includes(t));
const envios = () => pedidos.filter((p) => p.metodo === 'POST' && !p.url.includes('/presencia'));

async function abrir() {
  vista = montar(
    <ResponderPanel interaccion={COMENTARIO} conversacion={CONVERSACION} esDeCampana onCerrar={() => {}} onRespondido={() => {}} />,
  );
  await reposar();
}

async function enviarLoEscrito(publico: string) {
  escribir(cajas()[0] as HTMLTextAreaElement, publico);
  tocar(vista.contenedor.querySelector('button[aria-label="Enviar la respuesta a esta persona"]')!);
  await esperarA(() => envios().length === 1, 'que salga el envío');
  await reposar();
}

test('🔴 con respuestas previas no hay cajas ni botón de enviar: se ve quién respondió y qué dijo', async () => {
  estado = { respuestas: DE_NINA, respondiendo: [] };
  await abrir();
  await esperarA(() => texto().includes('Ya tiene 4 respuestas'), 'la lista de lo ya respondido');

  expect(cajas()).toHaveLength(0);
  expect(vista.contenedor.querySelector('button[aria-label="Enviar la respuesta a esta persona"]')).toBeNull();
  expect(texto()).toContain('Vecina Nina! Feliz de contar con tu apoyo, saludos!');
  // El username entero: recortado al primer punto se leería «Americo», como si respondiera el candidato.
  expect(texto()).toContain('americo.agente4');
});

test('🔴 «Responder otra vez» abre las cajas, y el envío dice cuántas respuestas vio', async () => {
  estado = { respuestas: DE_NINA, respondiendo: [] };
  await abrir();
  await esperarA(() => Boolean(botonConTexto('Responder otra vez')), 'el botón de responder otra vez');

  tocar(botonConTexto('Responder otra vez')!);
  await reposar();
  expect(cajas()).toHaveLength(2);

  await enviarLoEscrito('Gracias Nina, nos vemos el domingo');
  expect(envios()[0].cuerpo).toMatchObject({ mensajePublico: 'Gracias Nina, nos vemos el domingo', respuestasVistas: 4 });
});

test('🔴 si llega otra respuesta mientras escribe, las cajas se cierran, y el envío dice lo que vio al elegir', async () => {
  /**
   * La carrera que encontró la revisión de spec del ADR 0115: dos agentes ven UNA
   * respuesta y las dos eligen «Responder otra vez». Con la cuenta en vivo, a la
   * segunda le llegaba la de la primera por el SSE, mandaba «vi 2» y el server
   * la dejaba pasar.
   */
  estado = { respuestas: DE_NINA.slice(0, 1), respondiendo: [] };
  let cliente!: QueryClient;
  function ConElCliente() {
    cliente = useQueryClient();
    return <ResponderPanel interaccion={COMENTARIO} conversacion={CONVERSACION} esDeCampana onCerrar={() => {}} onRespondido={() => {}} />;
  }
  vista = montar(<ConElCliente />);
  await reposar();
  await esperarA(() => Boolean(botonConTexto('Responder otra vez')), 'el botón de responder otra vez');
  tocar(botonConTexto('Responder otra vez')!);
  await reposar();
  expect(cajas()).toHaveLength(2);

  // Otra agente respondió: el SSE invalida el estado de este comentario.
  estado = { respuestas: DE_NINA.slice(0, 2), respondiendo: [] };
  await act(async () => {
    await cliente.invalidateQueries({ queryKey: claves.estadoDeRespuesta(COMENTARIO.id) });
  });
  await esperarA(() => texto().includes('Ya tiene 2 respuestas'), 'que llegue la respuesta nueva');
  expect(cajas(), 'eligió viendo una; ahora hay dos y tiene que volver a decidir').toHaveLength(0);

  tocar(botonConTexto('Responder otra vez')!);
  await reposar();
  await enviarLoEscrito('Gracias Nina, nos vemos el domingo');
  expect(envios()[0].cuerpo).toMatchObject({ respuestasVistas: 2 });
});

test('sin respuestas previas el cuerpo del envío no cambia', async () => {
  await abrir();
  await esperarA(() => cajas().length === 2, 'las cajas');

  await enviarLoEscrito('Hola Nina Silva te agradezco');
  expect(envios()[0].cuerpo).toEqual({ mensajePublico: 'Hola Nina Silva te agradezco', mensajePrivado: '' });
});

test('🔴 si otra agente se adelantó, la caja se cierra y se ve su respuesta, con lo que dijo el server', async () => {
  const FRASE =
    'No se envió nada: este comentario ya tiene una respuesta. La última la mandó americo.agente1: «Hola Nina Silva te agradezco».';
  await abrir();
  await esperarA(() => cajas().length === 2, 'las cajas');

  respuestaDelEnvio = () => {
    // Mientras ésta escribía, otra respondió: el estado que se vuelva a pedir ya la trae.
    estado = { respuestas: DE_NINA.slice(0, 1), respondiendo: [] };
    return json({ type: 'ya_respondido', respuestas: DE_NINA.slice(0, 1), errores: [FRASE] }, 409);
  };
  await enviarLoEscrito('Buenos días estimada sigamos adelante');

  await esperarA(() => texto().includes('Ya tiene respuesta'), 'que se refresque lo que ya tiene');
  expect(texto()).toContain(FRASE);
  expect(cajas(), 'no puede quedar la caja abierta para mandarla de nuevo').toHaveLength(0);
  expect(envios(), 'y no se reintenta solo').toHaveLength(1);
});

test('avisa quién más lo está respondiendo, sin quitarle la caja', async () => {
  estado = {
    respuestas: [],
    respondiendo: [{ quien: 'centurion:americo.agente2', nombre: 'Rosa Quispe', desde: new Date().toISOString() }],
  };
  await abrir();
  await esperarA(() => texto().includes('Rosa Quispe lo está respondiendo ahora.'), 'el aviso de presencia');

  expect(cajas()).toHaveLength(2);
});

test('🔴 abrir el comentario lo marca como abierto, y cerrarlo lo desmarca', async () => {
  await abrir();
  await esperarA(
    () => pedidos.some((p) => p.metodo === 'PUT' && p.url.includes('/api/responder/521348/presencia')),
    'la marca de presencia',
  );

  vista.desmontar();
  expect(pedidos.some((p) => p.metodo === 'DELETE' && p.url.includes('/api/responder/521348/presencia'))).toBe(true);
});

/**
 * 📱 EL MISMO PANEL EN EL CELULAR (ADR 0121). Lo que cambia es QUÉ se monta, y
 * eso no lo ve una captura sola: la privada plegada, el aviso de presencia fuera
 * del scroll y la lista de respuestas plegada.
 */
describe('📱 en el celular', () => {
  let pantalla: PantallaSimulada;
  beforeEach(() => {
    pantalla = simularPantalla(390);
  });
  afterEach(() => {
    vista?.desmontar();
    pantalla.restaurar();
  });

  const botonMensajePrivado = () => botonConTexto('Mensaje privado');

  test('🔴 la privada arranca plegada; «+ Mensaje privado» la abre con el foco', async () => {
    await abrir();
    await esperarA(() => Boolean(botonMensajePrivado() && !botonMensajePrivado()!.disabled), 'el botón de la privada');
    expect(cajas(), 'sólo la pública').toHaveLength(1);

    tocar(botonMensajePrivado()!);
    await esperarA(() => cajas().length === 2, 'la caja privada');
    await esperarA(() => document.activeElement === cajas()[1], 'el foco en la privada');
  });

  test('la card «Privado» de las acciones también la abre', async () => {
    await abrir();
    await esperarA(() => Boolean(botonMensajePrivado() && !botonMensajePrivado()!.disabled), 'el botón de la privada');

    tocar(vista.contenedor.querySelector('button[aria-label="Enviar mensaje privado"]')!);
    await esperarA(() => cajas().length === 2, 'la caja privada');
  });

  test('🔴 al pasar a la mesa ancha, la privada vuelve a estar a la vista', async () => {
    await abrir();
    await esperarA(() => cajas().length === 1, 'la pública sola');

    await act(async () => pantalla.cambiarA(1280));
    await esperarA(() => cajas().length === 2, 'las dos cajas lado a lado');
    expect(botonMensajePrivado()).toBeUndefined();
  });

  test('🔴 el aviso de presencia va FUERA del scroll, y una sola vez', async () => {
    estado = {
      respuestas: [],
      respondiendo: [{ quien: 'centurion:americo.agente2', nombre: 'Rosa Quispe', desde: new Date().toISOString() }],
    };
    await abrir();
    await esperarA(() => texto().includes('Rosa Quispe lo está respondiendo ahora.'), 'el aviso de presencia');

    const avisos = vista.contenedor.querySelectorAll('[role="status"]');
    expect(avisos).toHaveLength(1);
    expect(avisos[0].closest('.overflow-y-auto'), 'adentro del scroll se va mientras escribe').toBeNull();
  });

  test('🔴 la lista de respuestas arranca plegada, con la última a la vista', async () => {
    estado = { respuestas: DE_NINA, respondiendo: [] };
    await abrir();
    await esperarA(() => texto().includes('Ya tiene 4 respuestas'), 'la lista de lo ya respondido');

    expect(texto()).toContain('Vecina Nina! Feliz de contar con tu apoyo, saludos!');
    expect(texto(), 'las anteriores, plegadas').not.toContain('Buenos días estimada sigamos adelante');
    expect(botonConTexto('Responder otra vez'), 'la acción sigue a mano').toBeDefined();

    const plegador = botonConTexto('Ya tiene 4 respuestas')!;
    expect(plegador.getAttribute('aria-expanded')).toBe('false');
    tocar(plegador);
    await reposar();
    expect(texto()).toContain('Buenos días estimada sigamos adelante');
  });
});

test('🔴 quien ya respondió deja de anunciar que lo está respondiendo', async () => {
  await abrir();
  await esperarA(() => cajas().length === 2, 'las cajas');

  await enviarLoEscrito('Hola Nina Silva te agradezco');
  await esperarA(
    () => pedidos.some((p) => p.metodo === 'DELETE' && p.url.includes('/presencia')),
    'que suelte la presencia al responder',
  );
});
