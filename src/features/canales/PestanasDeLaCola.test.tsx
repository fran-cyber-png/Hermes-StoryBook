// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { escribir, montar, reposar, teclear, tocar, type Montado } from '../../pruebas/dom';
import { ColaUnificada } from './ColaUnificada';

/**
 * LA CABECERA DE TRES PESTAÑAS (07-sep-2026, pedido del dueño): Canales ·
 * Chats · Llamadas — ver el docblock grande de `ColaUnificada.tsx`.
 *
 * Lo que este archivo fija: que «Llamadas» de verdad esconde el buscador (no
 * sólo agrega un cartel al lado), que el panel de canales ACOPLA y EMPUJA la
 * cola (08-sep-2026: reemplaza al panel flotante del día anterior, que este
 * mismo archivo fijaba con el nombre contrario) y que Escape/elegir un canal
 * lo cierran, igual que cualquier otro popover de la app (`usePopover`).
 */

let montado: Montado | null = null;
const fetchOriginal = globalThis.fetch;
const pedidos: string[] = [];

function servir(url: string): Response {
  pedidos.push(url);
  if (url.includes('/api/conversaciones?')) {
    return new Response(
      JSON.stringify({ conversaciones: [], total: 0, hayMas: false }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  return new Response(JSON.stringify({ message: 'no' }), { status: 404 });
}

beforeEach(() => {
  pedidos.length = 0;
  vi.stubGlobal('fetch', (entrada: RequestInfo | URL) => Promise.resolve(servir(String(entrada))));
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.stubGlobal('fetch', fetchOriginal);
});

async function pintada(): Promise<void> {
  for (let i = 0; i < 6; i++) await reposar();
}

describe('la pestaña «Chats» (default)', () => {
  it('trae el buscador y los tabs de siempre', async () => {
    montado = montar(<ColaUnificada seleccionada={null} onSeleccionar={() => {}} miVendedora="luz" />);
    await pintada();
    expect(montado.contenedor.querySelector('input[placeholder*="Buscar"]')).toBeTruthy();
    expect(montado.contenedor.textContent).toContain('No leídos');
  });
});

describe('la pestaña «Llamadas»', () => {
  it('esconde los filtros de Chats y muestra solo el cartel', async () => {
    montado = montar(<ColaUnificada seleccionada={null} onSeleccionar={() => {}} miVendedora="luz" />);
    await pintada();
    const llamadas = [...montado.contenedor.querySelectorAll('[role="tab"]')].find(
      (b) => b.textContent === 'Llamadas',
    )!;
    tocar(llamadas);
    await pintada();

    expect(montado.contenedor.textContent).toContain('Próximamente');
    // «No leídos»/«Favoritos» son del CUERPO de Chats, no de la cabecera
    // compartida — esos sí tienen que desaparecer.
    expect(montado.contenedor.textContent).not.toContain('No leídos');
    // El buscador, en cambio, vive en la cabecera compartida (al lado de
    // Chats/Llamadas, pedido del dueño 07-sep-2026) — sigue montado siempre,
    // nunca se desmonta (si no, el atajo global `/` de `App.tsx` apretaría
    // `focus()` sobre `null` estando en Llamadas).
    expect(montado.contenedor.querySelector('input[placeholder*="Buscar"]')).toBeTruthy();

    // La vuelta también funciona: no quedó una pestaña sin salida.
    const chats = [...montado.contenedor.querySelectorAll('[role="tab"]')].find((b) => b.textContent === 'Chats')!;
    tocar(chats);
    await pintada();
    expect(montado.contenedor.textContent).toContain('No leídos');
  });
});

describe('🔴 el buscador nunca se desmonta (el atajo global `/` depende de eso)', () => {
  it('el ícono lo expande, y con texto adentro se queda expandido aunque pierda el foco', async () => {
    montado = montar(<ColaUnificada seleccionada={null} onSeleccionar={() => {}} miVendedora="luz" />);
    await pintada();

    const input = montado.contenedor.querySelector<HTMLInputElement>('input[placeholder*="Buscar"]')!;
    expect(input, 'el input tiene que existir desde el primer render, colapsado').toBeTruthy();
    expect(input.tabIndex, 'colapsado, no debería entrar por Tab').toBe(-1);

    const iconoLupa = [...montado.contenedor.querySelectorAll('button')].find(
      (b) => b.getAttribute('title') === 'Buscar nombre, teléfono o texto…',
    )!;
    expect(iconoLupa, 'el botón-ícono que abre el buscador tiene que existir').toBeTruthy();

    tocar(iconoLupa);
    act(() => {
      input.focus();
    });
    await pintada();
    expect(input.tabIndex).not.toBe(-1);

    // Con texto adentro, perder el foco NO lo colapsa — si lo hiciera, la
    // lista seguiría filtrada sin ninguna pista visible de por qué.
    escribir(input, 'manuel');
    act(() => {
      input.blur();
    });
    await pintada();
    expect(input.tabIndex, 'con texto, se queda expandido aunque pierda el foco').not.toBe(-1);
  });
});

describe('🔴 el panel de canales acopla y empuja (08-sep-2026: ya no flota)', () => {
  it('el botón lo abre con los seis canales adentro, y Escape lo cierra', async () => {
    montado = montar(<ColaUnificada seleccionada={null} onSeleccionar={() => {}} miVendedora="luz" />);
    await pintada();

    const disparador = montado.contenedor.querySelector<HTMLButtonElement>('button[title="Filtrar por canal"]')!;
    expect(disparador, 'el botón que abre el panel de canales tiene que existir').toBeTruthy();

    // 🔴 EL RIEL YA NO SE DESMONTA (08-sep-2026: «se abre y se cierra muy de
    // golpe») — se queda SIEMPRE en el DOM, porque no hay forma de animar un
    // ancho hacia/desde un elemento que no existe todavía. Lo que lo apaga
    // mientras está cerrado es `inert` + `aria-hidden`, no el montado: por
    // eso este test ya no puede mirar si el TEXTO «aparece» (aparecería
    // igual, sólo que apagado) — mira el atributo.
    const nav = () => montado!.contenedor.querySelector('nav[aria-label="Filtrar por canal"]');
    expect(nav(), 'el riel está montado desde el arranque, para poder animar la apertura').toBeTruthy();
    expect(
      nav()!.closest('[aria-hidden="true"]'),
      'cerrado, el riel tiene que estar aria-hidden (y por lo tanto inert)',
    ).toBeTruthy();
    expect(disparador.getAttribute('aria-expanded')).toBe('false');

    tocar(disparador);
    await pintada();
    expect(nav()!.closest('[aria-hidden="true"]'), 'abierto, ya no debería estar aria-hidden').toBeFalsy();
    expect(montado.contenedor.textContent).toContain('WhatsApp');
    expect(montado.contenedor.textContent).toContain('Instagram');
    expect(disparador.getAttribute('aria-expanded')).toBe('true');
    // El riel es un `<nav>` de verdad, hermano del resto — no un `role="menu"`
    // flotando encima (lo que reemplaza no era accesible como landmark).
    expect(nav()).toBeTruthy();

    teclear('Escape');
    await pintada();
    expect(nav()!.closest('[aria-hidden="true"]'), 'Escape lo vuelve a apagar').toBeTruthy();
  });

  it('elegir un canal cierra el panel y filtra la consulta', async () => {
    montado = montar(<ColaUnificada seleccionada={null} onSeleccionar={() => {}} miVendedora="luz" />);
    await pintada();

    tocar(montado.contenedor.querySelector<HTMLButtonElement>('button[title="Filtrar por canal"]')!);
    await pintada();
    const whatsapp = [...montado.contenedor.querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').includes('WhatsApp'),
    )!;
    tocar(whatsapp);
    await pintada();

    // El panel se cerró solo (elegir = decidir, no un panel que hay que
    // acordarse de cerrar) — sigue montado, pero vuelve a `aria-hidden`.
    const nav = montado.contenedor.querySelector('nav[aria-label="Filtrar por canal"]')!;
    expect(nav.closest('[aria-hidden="true"]'), 'el riel debería volver a apagarse').toBeTruthy();
    // Y la elección viajó al server.
    expect(pedidos.some((u) => u.includes('canal=whatsapp'))).toBe(true);
  });
});
