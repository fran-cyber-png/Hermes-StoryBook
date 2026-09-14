// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { montar, reposar, type Montado } from '../../pruebas/dom';
import { MenuDeFila } from './MenuDeFila';
import type { Espacio } from './espacios';

/**
 * EL MENÚ `⋮` DE LA FILA (ADR 0093) — el cableado que ningún test puro puede
 * ver, calcado de lo que `AccionesDePagina.test.tsx` fijaba ANTES de este
 * cambio (mismos textos, mismo orden de clics) sobre la superficie nueva:
 *
 *   1. **Traer una página del espacio a tu libreta se la saca al equipo**, y
 *      hay que decirlo con los nombres antes de hacerlo — sigue viviendo acá
 *      (`ConfirmarSacarDelEquipo` se mudó tal cual, sin aflojar una palabra).
 *   2. **«Compartir» ya no dibuja el modal**: solo avisa (`onCompartir`) — el
 *      modal (`ModalDeLink`) lo decide `Libreta.tsx`, buscando la nota en la
 *      lista VIVA (igual que `paginaAbierta`). Ese cableado fino vive en
 *      `ModalDeLink.test.tsx` (el modal en sí) y en la Libreta.
 */

const ESPACIO: Espacio = {
  id: 7,
  nombre: 'Equipo de ventas',
  creadaPor: 'luz',
  creadoAt: '2026-08-10T00:00:00Z',
  miembros: ['luz', 'Sindy', 'ventas10@grupogoberna.com'],
};

let montado: Montado | null = null;
afterEach(() => {
  montado?.desmontar();
  montado = null;
});

function botonQueDice(texto: string): HTMLElement | undefined {
  return [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(texto));
}

function disparador(): HTMLElement | null {
  return document.querySelector('[aria-label="Más acciones de la página"]');
}

async function abrirMenu() {
  disparador()?.click();
  await reposar();
}

test('fijar y desfijar llaman a su handler y cierran el menú', async () => {
  const onFijar = vi.fn();
  montado = montar(
    <MenuDeFila
      fijada={false}
      accion={{
        tipo: 'normal',
        onFijar,
        onFavorito: () => {},
        onArchivar: () => {},
        onMover: () => {},
        onCompartir: () => {},
        donde: 7,
        espacios: [ESPACIO],
        vendedoraId: 'luz',
      }}
    />,
  );
  await abrirMenu();
  expect(botonQueDice('Fijar')).toBeTruthy();

  botonQueDice('Fijar')?.click();
  await reposar();

  expect(onFijar).toHaveBeenCalledOnce();
  // El menú cierra solo: «Archivar» (que solo vive adentro del panel) ya no está.
  expect(botonQueDice('Archivar')).toBeFalsy();
});

test('sin `onRenombrar` (una página de texto) el ítem «Renombrar» no existe', async () => {
  montado = montar(
    <MenuDeFila
      fijada={false}
      accion={{
        tipo: 'normal',
        onFijar: () => {},
        onFavorito: () => {},
        onArchivar: () => {},
        onMover: () => {},
        onCompartir: () => {},
        donde: null,
        espacios: [],
        vendedoraId: 'luz',
      }}
    />,
  );
  await abrirMenu();
  expect(botonQueDice('Renombrar')).toBeFalsy();
});

test('con `onRenombrar` (un documento) «Renombrar» llama a su handler y cierra el menú', async () => {
  const onRenombrar = vi.fn();
  montado = montar(
    <MenuDeFila
      fijada={false}
      accion={{
        tipo: 'normal',
        onFijar: () => {},
        onFavorito: () => {},
        onArchivar: () => {},
        onMover: () => {},
        onCompartir: () => {},
        donde: null,
        espacios: [],
        vendedoraId: 'luz',
      }}
      onRenombrar={onRenombrar}
    />,
  );
  await abrirMenu();
  botonQueDice('Renombrar')?.click();
  await reposar();

  expect(onRenombrar).toHaveBeenCalledOnce();
  expect(disparador()?.getAttribute('aria-expanded')).toBe('false');
});

test('en la Papelera, con `onRenombrar`, también ofrece «Renombrar» junto a Restaurar', async () => {
  const onRenombrar = vi.fn();
  montado = montar(
    <MenuDeFila
      fijada={false}
      accion={{ tipo: 'papelera', onRestaurar: () => {}, onEliminarParaSiempre: () => {} }}
      onRenombrar={onRenombrar}
    />,
  );
  await abrirMenu();
  botonQueDice('Renombrar')?.click();
  await reposar();
  expect(onRenombrar).toHaveBeenCalledOnce();
});

test('archivar llama a su handler', async () => {
  const onArchivar = vi.fn();
  montado = montar(
    <MenuDeFila
      fijada={false}
      accion={{
        tipo: 'normal',
        onFijar: () => {},
        onFavorito: () => {},
        onArchivar,
        onMover: () => {},
        onCompartir: () => {},
        donde: null,
        espacios: [],
        vendedoraId: 'luz',
      }}
    />,
  );
  await abrirMenu();
  botonQueDice('Archivar')?.click();
  await reposar();
  expect(onArchivar).toHaveBeenCalledOnce();
});

test('«Compartir» solo avisa — no dibuja ningún modal acá', async () => {
  const onCompartir = vi.fn();
  montado = montar(
    <MenuDeFila
      fijada={false}
      accion={{
        tipo: 'normal',
        onFijar: () => {},
        onFavorito: () => {},
        onArchivar: () => {},
        onMover: () => {},
        onCompartir,
        donde: null,
        espacios: [],
        vendedoraId: 'luz',
      }}
    />,
  );
  await abrirMenu();
  botonQueDice('Compartir')?.click();
  await reposar();

  expect(onCompartir).toHaveBeenCalledOnce();
  // Nada de "Quién lo abre" ni "Generar el link": ese modal ya no vive acá.
  expect(document.body.textContent).not.toContain('Quién lo abre');
});

test('sin `onDescargar` (una página de texto) el ítem «Descargar» no existe', async () => {
  montado = montar(
    <MenuDeFila
      fijada={false}
      accion={{
        tipo: 'normal',
        onFijar: () => {},
        onFavorito: () => {},
        onArchivar: () => {},
        onMover: () => {},
        onCompartir: () => {},
        donde: null,
        espacios: [],
        vendedoraId: 'luz',
      }}
    />,
  );
  await abrirMenu();
  expect(botonQueDice('Descargar')).toBeFalsy();
});

test('con `onDescargar` (una página-documento) «Descargar» llama a su handler y cierra el menú', async () => {
  const onDescargar = vi.fn();
  montado = montar(
    <MenuDeFila
      fijada={false}
      accion={{
        tipo: 'normal',
        onFijar: () => {},
        onFavorito: () => {},
        onArchivar: () => {},
        onMover: () => {},
        onCompartir: () => {},
        donde: null,
        espacios: [],
        vendedoraId: 'luz',
        onDescargar,
      }}
    />,
  );
  await abrirMenu();
  botonQueDice('Descargar')?.click();
  await reposar();

  expect(onDescargar).toHaveBeenCalledOnce();
  expect(disparador()?.getAttribute('aria-expanded')).toBe('false');
});

test('en la Papelera, con `onDescargar`, también ofrece «Descargar» junto a Restaurar', async () => {
  const onDescargar = vi.fn();
  montado = montar(
    <MenuDeFila
      fijada={false}
      accion={{ tipo: 'papelera', onRestaurar: () => {}, onEliminarParaSiempre: () => {}, onDescargar }}
    />,
  );
  await abrirMenu();
  botonQueDice('Descargar')?.click();
  await reposar();
  expect(onDescargar).toHaveBeenCalledOnce();
});

test('🔴 traer una página del espacio a mi libreta AVISA con los nombres, y no mueve hasta confirmar', async () => {
  const movido: (number | null)[] = [];
  montado = montar(
    <MenuDeFila
      fijada={false}
      accion={{
        tipo: 'normal',
        onFijar: () => {},
        onFavorito: () => {},
        onArchivar: () => {},
        onMover: (d) => movido.push(d),
        onCompartir: () => {},
        donde: 7,
        espacios: [ESPACIO],
        vendedoraId: 'luz',
      }}
    />,
  );
  await abrirMenu();
  botonQueDice('Mover')?.click();
  await reposar();
  botonQueDice('Mi libreta')?.click();
  await reposar();

  // Todavía NO se movió: primero el aviso.
  expect(movido).toEqual([]);
  expect(document.body.textContent).toContain('Sindy');
  expect(document.body.textContent).toContain('ventas10');
  // A ti misma no te nombra: no dejas de verla.
  expect(document.body.textContent).not.toContain('luz,');

  botonQueDice('Traerla igual')?.click();
  await reposar();
  expect(movido).toEqual([null]);
});

test('«Dejarla acá» no mueve nada', async () => {
  const movido: (number | null)[] = [];
  montado = montar(
    <MenuDeFila
      fijada={false}
      accion={{
        tipo: 'normal',
        onFijar: () => {},
        onFavorito: () => {},
        onArchivar: () => {},
        onMover: (d) => movido.push(d),
        onCompartir: () => {},
        donde: 7,
        espacios: [ESPACIO],
        vendedoraId: 'luz',
      }}
    />,
  );
  await abrirMenu();
  botonQueDice('Mover')?.click();
  await reposar();
  botonQueDice('Mi libreta')?.click();
  await reposar();
  botonQueDice('Dejarla acá')?.click();
  await reposar();

  expect(movido).toEqual([]);
});

test('mover HACIA un espacio no pregunta nada: no le saca nada a nadie', async () => {
  const movido: (number | null)[] = [];
  montado = montar(
    <MenuDeFila
      fijada={false}
      accion={{
        tipo: 'normal',
        onFijar: () => {},
        onFavorito: () => {},
        onArchivar: () => {},
        onMover: (d) => movido.push(d),
        onCompartir: () => {},
        donde: null,
        espacios: [ESPACIO],
        vendedoraId: 'luz',
      }}
    />,
  );
  await abrirMenu();
  botonQueDice('Mover')?.click();
  await reposar();
  botonQueDice('Equipo de ventas')?.click();
  await reposar();

  expect(movido).toEqual([7]);
});

test('en la Papelera solo ofrece Restaurar y Eliminar para siempre', async () => {
  const onRestaurar = vi.fn();
  const onEliminarParaSiempre = vi.fn();
  montado = montar(
    <MenuDeFila fijada={false} accion={{ tipo: 'papelera', onRestaurar, onEliminarParaSiempre }} />,
  );
  await abrirMenu();

  expect(botonQueDice('Fijar')).toBeFalsy();
  expect(botonQueDice('Mover')).toBeFalsy();
  expect(botonQueDice('Compartir')).toBeFalsy();

  botonQueDice('Restaurar')?.click();
  await reposar();
  expect(onRestaurar).toHaveBeenCalledOnce();

  await abrirMenu();
  botonQueDice('Eliminar para siempre')?.click();
  await reposar();
  expect(onEliminarParaSiempre).toHaveBeenCalledOnce();
});
