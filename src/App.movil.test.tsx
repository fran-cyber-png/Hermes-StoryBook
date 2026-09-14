// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { escribir, esperarA, montar, reposar, teclear, tocar, type Montado } from './pruebas/dom';
import { simularPantalla, type PantallaSimulada } from './pruebas/pantalla';
import App from './App';

/**
 * MENSAJES EN EL CELULAR: LA LISTA O EL CHAT, NUNCA LOS DOS — Y EN ESCRITORIO,
 * NADA CAMBIA.
 *
 * El pedido del dueño es atender desde el teléfono como en WhatsApp. A 390 px no
 * entran tres columnas, así que el shell pasa a UNA: la cola a pantalla
 * completa, y al tocar a alguien el chat encima. Lo que este archivo fija es el
 * CABLEADO de ese cambio, que es donde se rompe:
 *
 *   · que la lista NO se desmonte al abrir un chat — si se desmonta, volver
 *     pierde el scroll, la búsqueda y la página de «Ver más», y la vendedora
 *     vuelve a buscar desde arriba a la persona siguiente;
 *   · que el botón atrás de Android cierre el chat en vez de sacarla de Hermes;
 *   · que en escritorio la lista y el chat sigan lado a lado, con el riel y la
 *     ficha, como siempre.
 *
 * ── Por qué `ConversacionActiva` es de mentira acá ──
 * El chat por dentro es de otro frente, y la flecha de volver la dibuja ese
 * frente cuando recibe `onVolver`. Ese prop ES el contrato entre los dos, así
 * que el reemplazo hace exactamente eso y nada más: dice con quién es el chat y,
 * si le llega `onVolver`, dibuja un botón que lo llama. Así este archivo no se
 * rompe cuando el hilo cambie de forma, y sí se rompe si el shell deja de pasar
 * el prop.
 *
 * ── Por qué el server contesta 503 a casi todo ──
 * Mismo criterio que `App.test.tsx`: sólo la sesión y la cola responden bien.
 * Todo lo demás cae en su estado de error —que ya está escrito— y lo que queda en
 * pie es lo que se mide: el shell.
 */

vi.mock('./features/canales/ConversacionActiva', async () => {
  const { createElement } = await import('react');
  return {
    ConversacionActiva: ({
      conversacion,
      onVolver,
    }: {
      conversacion: { persona_nombre: string | null } | null;
      onVolver?: () => void;
    }) =>
      createElement(
        'div',
        { 'data-prueba': 'chat' },
        conversacion ? createElement('p', null, `Chat con ${conversacion.persona_nombre}`) : null,
        onVolver ? createElement('button', { type: 'button', onClick: onVolver }, 'Volver a la lista') : null,
      ),
  };
});

const AHORA = new Date().toISOString();

const fila = (clave: string, telefono: string, nombre: string, texto: string) => ({
  clave: `conv:whatsapp:${telefono}:51970356062`,
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: telefono,
  persona_nombre: nombre,
  numero_propio: '51970356062',
  texto,
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: clave,
  ultimo_at: AHORA,
  dias: 0,
  nivel: 3,
});

const CONVERSACIONES = [
  fila('r1', '51933330003', 'Rosa Quispe', 'Hola, ¿cuánto cuesta el diplomado?'),
  fila('r2', '51955443322', 'Carlos Huamán', 'Ya hice el pago, les mando el voucher'),
  fila('r3', '51933221100', 'Milagros Ríos', 'Gracias, lo voy a conversar en casa'),
];

/** Un token que `quienDiceSer` acepta sin server (mismo molde que `App.test.tsx`). */
function tokenVivo(id = 'ana'): string {
  const cuerpo = btoa(`${id}|${Date.now() + 60 * 60 * 1000}`)
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${cuerpo}.firma-que-nadie-mira-acá`;
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

let montado: Montado | null = null;
let pantalla: PantallaSimulada | null = null;

beforeEach(() => {
  localStorage.setItem('hermes.token', tokenVivo());
  history.replaceState(null, '', window.location.pathname);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: unknown) => {
      const url = String(entrada);
      if (url.includes('/api/auth/yo')) {
        return json({ vendedora: { id: 'ana', nombre: 'Ana Lucía', puedeEntrenar: true }, cerberus: true });
      }
      if (url.includes('/api/conversaciones?') || url.endsWith('/api/conversaciones')) {
        return json({ conversaciones: CONVERSACIONES, total: CONVERSACIONES.length, hayMas: false });
      }
      return json({ ok: false, message: 'el test no levanta server' }, 503);
    }),
  );
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  pantalla?.restaurar();
  pantalla = null;
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function abrirAppA(ancho: number): Promise<Montado> {
  pantalla = simularPantalla(ancho);
  montado = montar(<App />);
  await reposar();
  await esperarA(() => filaDe('Rosa Quispe') != null, 'que la cola traiga a sus tres personas');
  return montado;
}

const titulo = () => document.querySelector('h1')?.textContent?.trim() ?? '';
const riel = () => document.querySelector('nav[aria-label="Vistas"]');
const lista = () => document.querySelector<HTMLElement>('[data-scroll-cola]');
const columnaDeLaLista = () => lista()?.closest('main') ?? null;
const columnaDelChat = () => document.querySelector('[data-prueba="chat"]')?.closest('section') ?? null;
const filaDe = (nombre: string) =>
  [...(lista()?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.includes(nombre));
const botonVolver = () =>
  [...document.querySelectorAll('button')].find((b) => b.textContent === 'Volver a la lista');
const botonDeLaFicha = () => document.querySelector('button[aria-label="Ocultar la ficha del contacto"]');

/** El chat está a la vista y es con esta persona. */
const chatAbiertoCon = (nombre: string) =>
  columnaDelChat()?.hidden === false && (columnaDelChat()?.textContent ?? '').includes(`Chat con ${nombre}`);
/** La lista sigue montada pero no se puede tocar ni leer: el chat la tapa. */
const listaTapada = () => columnaDeLaLista()?.hasAttribute('inert') === true;

describe('Mensajes en el celular (390 px)', () => {
  it('abre en Mensajes, sin riel de vistas — aunque la URL pida otra vista', async () => {
    history.replaceState(null, '', `${window.location.pathname}?vista=dashboard`);
    await abrirAppA(390);

    expect(titulo()).toBe('Mensajes');
    expect(riel()).toBeNull();
    expect(listaTapada()).toBe(false);
  });

  it('tocar a alguien abre su chat a pantalla completa; la lista queda detrás, montada, y sin la ficha', async () => {
    await abrirAppA(390);
    const laLista = lista();

    tocar(filaDe('Rosa Quispe')!);
    await esperarA(() => chatAbiertoCon('Rosa Quispe'), 'que se abra el chat de Rosa');

    expect(listaTapada()).toBe(true);
    expect(lista(), 'la misma lista, no una nueva').toBe(laLista);
    expect(botonDeLaFicha(), 'el panel derecho no existe en el celular').toBeNull();
  });

  it('volver con la flecha regresa a la lista con el mismo scroll y la misma búsqueda', async () => {
    await abrirAppA(390);
    const laLista = lista()!;
    laLista.scrollTop = 240;
    const buscador = document.querySelector<HTMLInputElement>('input[placeholder^="Buscar nombre"]')!;
    escribir(buscador, 'Rosa');

    tocar(filaDe('Rosa Quispe')!);
    await esperarA(() => chatAbiertoCon('Rosa Quispe'), 'que se abra el chat de Rosa');
    tocar(botonVolver()!);
    await esperarA(() => columnaDelChat()?.hidden === true, 'que la flecha cierre el chat');

    expect(listaTapada()).toBe(false);
    expect(lista(), 'la misma lista, no una nueva').toBe(laLista);
    expect(laLista.scrollTop).toBe(240);
    expect(buscador.value).toBe('Rosa');
  });

  it('el botón atrás de Android cierra el chat en vez de salir de Hermes', async () => {
    await abrirAppA(390);

    tocar(filaDe('Carlos Huamán')!);
    await esperarA(() => chatAbiertoCon('Carlos Huamán'), 'que se abra el chat de Carlos');

    history.back();
    await esperarA(() => columnaDelChat()?.hidden === true, 'que el atrás cierre el chat');

    expect(listaTapada()).toBe(false);
    expect(titulo()).toBe('Mensajes');
  });

  /**
   * La flecha y el atrás tienen que ser EL MISMO gesto. Si la flecha cerrara el
   * chat sin consumir la entrada del historial, cada chat abierto y cerrado con
   * la flecha dejaría un «atrás» muerto apilado: la vendedora aprieta atrás para
   * salir y no pasa nada, una vez por cada persona que atendió.
   */
  /*
   * ⚠️ Se compara `history.state` y no `history.length`: el largo no dice en qué
   * entrada estás parada (las de «adelante» que dejó otro test se truncan con el
   * próximo `pushState`), y una flecha rota que cerrara sin consumir la entrada
   * daría el mismo largo. Lo que distingue a las dos es DÓNDE queda el historial.
   */
  it('volver con la flecha consume la entrada del chat: el historial queda como antes de abrirlo', async () => {
    await abrirAppA(390);
    const antesDelChat = history.state;

    tocar(filaDe('Rosa Quispe')!);
    await esperarA(() => chatAbiertoCon('Rosa Quispe'), 'que se abra el chat de Rosa');
    expect(history.state, 'abrir el chat apila su propia entrada').not.toEqual(antesDelChat);

    tocar(botonVolver()!);
    await esperarA(() => columnaDelChat()?.hidden === true, 'que la flecha cierre el chat');

    expect(history.state).toEqual(antesDelChat);
  });

  /**
   * La cabecera del celular es mínima, pero no calla lo que bloquea plata: si
   * Hermes perdió la sesión de Cerberus, la vendedora no puede registrar una
   * venta, y sin el aviso no sabe por qué.
   */
  it('con la sesión de Cerberus caída, la cabecera lo avisa', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (entrada: unknown) => {
        const url = String(entrada);
        if (url.includes('/api/auth/yo')) return json({ vendedora: { id: 'ana', nombre: 'Ana Lucía' }, cerberus: false });
        if (url.includes('/api/conversaciones?') || url.endsWith('/api/conversaciones')) {
          return json({ conversaciones: CONVERSACIONES, total: CONVERSACIONES.length, hayMas: false });
        }
        return json({ ok: false }, 503);
      }),
    );
    await abrirAppA(390);

    await esperarA(
      () => (document.querySelector('header')?.textContent ?? '').includes('Cerberus'),
      'que la cabecera avise que se cayó Cerberus',
    );
  });

  it('el menú de arriba sólo permite cerrar sesión, y cerrarla lleva al login', async () => {
    await abrirAppA(390);

    tocar(document.querySelector('button[aria-label="Tu cuenta"]')!);
    const opciones = [...document.querySelectorAll('[role="menu"] [role="menuitem"]')].map((b) =>
      b.textContent?.trim(),
    );
    expect(opciones).toEqual(['Cerrar sesión']);

    tocar(document.querySelector('[role="menu"] [role="menuitem"]')!);
    await esperarA(
      () => [...document.querySelectorAll('button[type="submit"]')].some((b) => b.textContent?.includes('Entrar')),
      'que cerrar sesión lleve al login',
    );
  });

  /**
   * El giro al revés: el chat se abrió con el teléfono en horizontal (≥ 768 px,
   * escritorio, sin entrada en el historial) y después se giró a vertical. Si al
   * cruzar el corte no se le da su entrada, el primer atrás de Android saca a la
   * vendedora de Hermes con el chat en la mano.
   */
  it('abrir el chat en horizontal y girar a vertical: el atrás igual vuelve a la lista', async () => {
    history.replaceState(null, '', `${window.location.pathname}?vista=bandeja`);
    await abrirAppA(1280);
    tocar(filaDe('Rosa Quispe')!);
    await esperarA(() => chatAbiertoCon('Rosa Quispe'), 'que se abra el chat de Rosa');
    const antesDeGirar = history.state;

    act(() => pantalla!.cambiarA(390));
    await reposar();
    expect(listaTapada()).toBe(true);
    expect(history.state, 'al cruzar a celular, el chat abierto gana su entrada').not.toEqual(antesDeGirar);

    history.back();
    await esperarA(() => columnaDelChat()?.hidden === true, 'que el atrás cierre el chat');
    expect(history.state).toEqual(antesDeGirar);
  });

  /**
   * Recargar con un chat abierto deja la entrada del chat en el historial (el
   * navegador la conserva) pero ningún chat abierto. Escape en ese estado no
   * tiene nada que cerrar, y no puede gastarse la entrada navegando hacia atrás.
   */
  it('después de recargar con un chat abierto, Escape sin chat no navega hacia atrás', async () => {
    await abrirAppA(390);
    tocar(filaDe('Rosa Quispe')!);
    await esperarA(() => chatAbiertoCon('Rosa Quispe'), 'que se abra el chat de Rosa');

    // La «recarga»: se desmonta todo y se vuelve a montar con el historial intacto.
    montado!.desmontar();
    montado = montar(<App />);
    await esperarA(() => filaDe('Rosa Quispe') != null, 'que la cola vuelva después de recargar');
    const estadoTrasRecargar = history.state;

    teclear('Escape');
    await reposar();
    await reposar();

    expect(history.state).toEqual(estadoTrasRecargar);
    expect(listaTapada()).toBe(false);
  });

  it('girar a horizontal (≥ 768 px) con el chat abierto pone la lista al lado, sin cerrar el chat', async () => {
    await abrirAppA(390);
    tocar(filaDe('Rosa Quispe')!);
    await esperarA(() => chatAbiertoCon('Rosa Quispe'), 'que se abra el chat de Rosa');

    act(() => pantalla!.cambiarA(1280));

    expect(listaTapada()).toBe(false);
    expect(chatAbiertoCon('Rosa Quispe')).toBe(true);
    expect(riel()).not.toBeNull();
  });
});

describe('Mensajes en escritorio (1280 px): nada cambia', () => {
  it('la lista y el chat siguen lado a lado, con el riel y la ficha, sin flecha y sin tocar el historial', async () => {
    history.replaceState(null, '', `${window.location.pathname}?vista=bandeja`);
    await abrirAppA(1280);
    const antes = history.length;

    tocar(filaDe('Rosa Quispe')!);
    await esperarA(() => chatAbiertoCon('Rosa Quispe'), 'que se abra el chat de Rosa');

    expect(listaTapada()).toBe(false);
    expect(riel()).not.toBeNull();
    expect(botonDeLaFicha(), 'la ficha sigue al lado del chat').not.toBeNull();
    expect(botonVolver(), 'en escritorio no hay flecha de volver').toBeUndefined();
    expect(history.length).toBe(antes);
  });

  it('sin la URL, sigue abriendo en el Dashboard', async () => {
    pantalla = simularPantalla(1280);
    montado = montar(<App />);
    await reposar();

    expect(titulo()).toBe('Dashboard');
    expect(riel()).not.toBeNull();
  });
});
