// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, tocar, type Montado } from './pruebas/dom';
import { simularPantalla, type PantallaSimulada } from './pruebas/pantalla';
import App from './App';

/**
 * LA BARRA MENSAJES / PIPELINE DEL CELULAR: SÓLO CAMPAÑA, Y SÓLO EN EL CELULAR.
 *
 * Lo que se fija acá es el CABLEADO de `BarraDeNavegacionMovil` en el shell,
 * que es donde se rompe sin que un test del componente lo vea:
 *
 *   · un comando de campaña a 390 px la tiene, y tocar «Pipeline» cambia la
 *     vista de verdad (hasta el 12-sep-2026 el celular estaba clavado en
 *     Mensajes para todos);
 *   · una vendedora de la Escuela a 390 px NO la tiene: para ventas el celular
 *     sigue siendo Mensajes y nada más;
 *   · en escritorio nadie la tiene, ni de campaña: ahí está el riel de siempre;
 *   · con un chat abierto encima de la lista, la barra no está a mano.
 *
 * Mismo andamio que `App.movil.test.tsx`: sesión y cola contestan, el resto 503,
 * y el hilo y el Pipeline son de mentira porque lo que se mide es el shell.
 */

vi.mock('./features/canales/ConversacionActiva', async () => {
  const { createElement } = await import('react');
  return {
    ConversacionActiva: ({ conversacion }: { conversacion: { persona_nombre: string | null } | null }) =>
      createElement('div', { 'data-prueba': 'chat' }, conversacion ? `Chat con ${conversacion.persona_nombre}` : null),
  };
});
vi.mock('./features/vistas/VistaEmbudo', async () => {
  const { createElement } = await import('react');
  return { VistaEmbudo: () => createElement('div', { 'data-prueba': 'pipeline' }, 'El Pipeline') };
});

const AHORA = new Date().toISOString();
const CONVERSACIONES = [
  {
    clave: 'conv:whatsapp:51933330003:51970356062',
    canal: 'whatsapp',
    tipo: 'mensaje',
    persona_id: '51933330003',
    persona_nombre: 'Rosa Quispe',
    numero_propio: '51970356062',
    texto: 'Hola, ¿cuánto cuesta?',
    contexto_texto: null,
    respondida: false,
    ventana_abierta: true,
    pregunto: false,
    n: 1,
    referencia: 'r1',
    ultimo_at: AHORA,
    dias: 0,
    nivel: 3,
  },
];

function tokenVivo(id = 'ana'): string {
  const cuerpo = btoa(`${id}|${Date.now() + 60 * 60 * 1000}`).replace(/\+/g, '-').replace(/\//g, '_');
  return `${cuerpo}.firma-que-nadie-mira-acá`;
}
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

let montado: Montado | null = null;
let pantalla: PantallaSimulada | null = null;

function servir(esDeCampana: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: unknown) => {
      const url = String(entrada);
      if (url.includes('/api/auth/yo')) return json({ vendedora: { id: 'ana', nombre: 'Ana', esDeCampana }, cerberus: true });
      if (url.includes('/api/conversaciones?') || url.endsWith('/api/conversaciones')) {
        return json({ conversaciones: CONVERSACIONES, total: 1, hayMas: false });
      }
      return json({ ok: false, message: 'el test no levanta server' }, 503);
    }),
  );
}

beforeEach(() => {
  localStorage.setItem('hermes.token', tokenVivo());
  history.replaceState(null, '', window.location.pathname);
});
afterEach(() => {
  montado?.desmontar();
  montado = null;
  pantalla?.restaurar();
  pantalla = null;
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function abrir(ancho: number, esDeCampana: boolean) {
  servir(esDeCampana);
  pantalla = simularPantalla(ancho);
  montado = montar(<App />);
  await reposar();
  await esperarA(() => filaDe('Rosa Quispe') != null, 'que la cola traiga a Rosa');
}

const barra = () => document.querySelector<HTMLElement>('nav[aria-label="Secciones"]');
const boton = (rotulo: string) => [...(barra()?.querySelectorAll('button') ?? [])].find((b) => b.textContent === rotulo);
const activa = () => barra()?.querySelector('[aria-current="page"]')?.textContent ?? null;
const titulo = () => document.querySelector('h1')?.textContent?.trim() ?? '';
const filaDe = (nombre: string) =>
  [...(document.querySelector('[data-scroll-cola]')?.querySelectorAll('button') ?? [])].find((b) =>
    b.textContent?.includes(nombre),
  );
const pipeline = () => document.querySelector('[data-prueba="pipeline"]');

describe('la barra Mensajes / Pipeline en el celular', () => {
  it('un comando de campaña a 390 px la tiene, con Mensajes puesto de entrada', async () => {
    await abrir(390, true);
    expect(barra()).not.toBeNull();
    expect(activa()).toBe('Mensajes');
    expect(barra()!.textContent).not.toMatch(/\d/); // sin globos ni conteos
  });

  it('tocar «Pipeline» muestra el Pipeline y lo marca; tocar «Mensajes» vuelve', async () => {
    await abrir(390, true);
    tocar(boton('Pipeline')!);
    await esperarA(() => pipeline() != null, 'que se monte el Pipeline');
    expect(activa()).toBe('Pipeline');
    expect(titulo()).toBe('Pipeline');

    tocar(boton('Mensajes')!);
    await esperarA(() => pipeline() == null, 'que el Pipeline se desmonte');
    expect(activa()).toBe('Mensajes');
    expect(titulo()).toBe('Mensajes');
    expect(filaDe('Rosa Quispe'), 'la lista sigue ahí, no se remontó').not.toBeUndefined();
  });

  it('con un chat abierto encima de la lista, la barra no está a mano', async () => {
    await abrir(390, true);
    tocar(filaDe('Rosa Quispe')!);
    await esperarA(() => document.querySelector('[data-prueba="chat"]')?.textContent?.includes('Rosa') === true, 'que abra el chat');
    expect(barra()?.hidden).toBe(true);
  });

  it('una vendedora de la Escuela a 390 px NO la tiene: el celular sigue siendo sólo Mensajes', async () => {
    await abrir(390, false);
    expect(barra()).toBeNull();
    expect(titulo()).toBe('Mensajes');
  });

  it('en escritorio no existe, ni para campaña: ahí está el riel de vistas', async () => {
    await abrir(1280, true);
    expect(barra()).toBeNull();
    expect(document.querySelector('nav[aria-label="Vistas"]')).not.toBeNull();
  });
});
