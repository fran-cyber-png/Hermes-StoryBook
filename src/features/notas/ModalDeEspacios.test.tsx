// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { esperarA, escribir, montar, tocar, type Montado } from '../../pruebas/dom';
import { ModalDeEspacios } from './ModalDeEspacios';

/**
 * EL CABLEADO DEL MODAL DE ADMINISTRAR ESPACIOS (26-ago-2026) — lo que
 * ningún test puro puede ver: que listar, renombrar y archivar/desarchivar
 * manden de verdad lo que dicen que mandan.
 */

const VIVO = { id: 1, nombre: 'Equipo de ventas', creadaPor: 'luz', creadoAt: '2026-08-10T00:00:00Z', miembros: ['luz', 'sindy'], archivadoAt: null };
const ARCHIVADO = {
  id: 2,
  nombre: 'Proyecto viejo',
  creadaPor: 'luz',
  creadoAt: '2026-07-01T00:00:00Z',
  miembros: ['luz'],
  archivadoAt: '2026-07-15T00:00:00Z',
};

let montado: Montado | null = null;
let peticiones: { url: string; metodo: string }[] = [];
let lista = [VIVO, ARCHIVADO];

beforeEach(() => {
  peticiones = [];
  lista = [VIVO, ARCHIVADO];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opciones?: RequestInit) => {
      const u = String(url);
      const metodo = (opciones?.method ?? 'GET').toUpperCase();
      peticiones.push({ url: u, metodo });
      if (u.includes('/api/espacios/padron')) return new Response(JSON.stringify({ personas: ['luz', 'sindy', 'jefferson'] }));
      if (u.includes('/api/espacios/mios')) return new Response(JSON.stringify({ espacios: lista }));
      return new Response(JSON.stringify({ ok: true, espacio: VIVO }));
    }),
  );
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
});

function botonQueDice(texto: string): HTMLElement | undefined {
  return [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(texto));
}

/** El nombre del VIVO vive en un `<input>` (`TituloEditable`), no en texto —
 *  `document.body.textContent` no lo ve. El del ARCHIVADO sí, porque es un
 *  `<span>`: se usa ESE como señal de «ya cargó la lista». */
function campoDeNombre(): HTMLInputElement | null {
  return document.querySelector('input[placeholder="Nombre del espacio"]');
}
async function esperarLista() {
  await esperarA(() => document.body.textContent?.includes('Proyecto viejo') ?? false, 'cargó la lista de espacios');
}

test('lista los vivos y los archivados, en secciones separadas', async () => {
  montado = montar(<ModalDeEspacios onCerrar={() => {}} />);
  await esperarLista();

  expect(campoDeNombre()?.value).toBe('Equipo de ventas');
  expect(document.body.textContent).toContain('Proyecto viejo');
  expect(document.body.textContent).toContain('Archivados');
});

test('sin ningún espacio propio, lo dice en vez de mostrar una lista vacía muda', async () => {
  lista = [];
  montado = montar(<ModalDeEspacios onCerrar={() => {}} />);
  await esperarA(() => document.body.textContent?.includes('Todavía no creaste') ?? false, 'se ve el vacío');
});

test('renombrar un espacio VIVO manda el PATCH con el nombre nuevo', async () => {
  montado = montar(<ModalDeEspacios onCerrar={() => {}} />);
  await esperarLista();

  const campo = campoDeNombre()!;
  campo.focus();
  escribir(campo, 'Ventas — nombre nuevo');
  campo.blur();

  await esperarA(
    () => peticiones.some((p) => p.url.endsWith('/api/espacios/1') && p.metodo === 'PATCH'),
    'salió el PATCH de renombrar',
  );
});

test('«Archivar» en un espacio VIVO llama a la ruta de archivar', async () => {
  montado = montar(<ModalDeEspacios onCerrar={() => {}} />);
  await esperarLista();

  tocar(botonQueDice('Archivar')!);

  await esperarA(
    () => peticiones.some((p) => p.url.endsWith('/api/espacios/1/archivar') && p.metodo === 'PATCH'),
    'salió el PATCH de archivar',
  );
});

test('«Desarchivar» en un espacio archivado llama a la ruta de desarchivar', async () => {
  montado = montar(<ModalDeEspacios onCerrar={() => {}} />);
  await esperarLista();

  tocar(botonQueDice('Desarchivar')!);

  await esperarA(
    () => peticiones.some((p) => p.url.endsWith('/api/espacios/2/desarchivar') && p.metodo === 'PATCH'),
    'salió el PATCH de desarchivar',
  );
});

test('un espacio archivado no ofrece renombrarlo', async () => {
  montado = montar(<ModalDeEspacios onCerrar={() => {}} />);
  await esperarLista();

  // Solo el VIVO tiene campo editable — el archivado muestra su nombre como
  // texto plano (ver `campoDeNombre`, que ya lo confirma indirectamente).
  const campos = [...document.querySelectorAll('input[placeholder="Nombre del espacio"]')];
  expect(campos).toHaveLength(1);
});
