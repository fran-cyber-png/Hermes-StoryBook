// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { esperarA, montar, tocar, type Montado } from '../../pruebas/dom';
import { Libreta } from './Libreta';

/**
 * LA BARRA DE PESTAÑAS, MONTADA SOBRE LA LIBRETA DE VERDAD (26-ago-2026).
 * Mismo motivo que `Libreta.dibujo.test.tsx`: `siguienteAlCerrar` ya está
 * fijada pura en `pestanas.test.ts` — lo que solo se ve montando es el
 * CABLEADO: que abrir una página desde la lista de verdad le agregue su
 * pestaña, y que cerrarla mueva la selección real de `Libreta.tsx`.
 */

const PAGINA_1 = {
  id: 1,
  clave: 'general',
  vendedoraId: 'luz',
  texto: 'precios del diplomado',
  doc: null,
  anotaciones: null,
  fijada: false,
  creadoAt: '2026-08-04T00:00:00Z',
  editadoAt: null,
  archivadoAt: null,
  origen: 'nota',
  espacioId: null,
  tipo: 'texto',
};

const PAGINA_2 = {
  ...PAGINA_1,
  id: 2,
  texto: 'ruta al local',
  creadoAt: '2026-08-05T00:00:00Z',
};

let montado: Montado | null = null;

/** La clave de `useLocalStorage` que arma `usePestanas` — ver `pestanas.ts`. */
const CLAVE_PESTANAS = 'libreta:pestanas';

/**
 * `removeItem` a secas NO ALCANZA. `useLocalStorage` (`lib/useLocalStorage.ts`)
 * cachea el crudo en un `Map` de MÓDULO que sobrevive entre casos — así que las
 * pestañas que dejó abiertas un test se filtran al siguiente y la suite pasa a
 * depender del ORDEN (mismo defecto ya documentado en `lib/tema.test.tsx`). El
 * evento `storage` es la puerta que el propio módulo abre para invalidar esa
 * caché.
 */
function limpiarPestanas() {
  window.localStorage.removeItem(CLAVE_PESTANAS);
  window.dispatchEvent(new StorageEvent('storage', { key: CLAVE_PESTANAS, newValue: null }));
}

beforeEach(() => {
  limpiarPestanas();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/api/espacios/padron')) return new Response(JSON.stringify({ personas: ['luz'] }));
      if (u.includes('/api/espacios')) return new Response(JSON.stringify({ espacios: [] }));
      // Ambas rutas — la lista y `useNotaPorId` — sirven de la MISMA fixture:
      // a esta escala no hace falta distinguirlas.
      if (/\/api\/notas\/\d+$/.test(u)) {
        const id = Number(u.match(/(\d+)$/)![1]);
        const nota = [PAGINA_1, PAGINA_2].find((n) => n.id === id);
        return nota ? new Response(JSON.stringify({ ok: true, nota })) : new Response('{}', { status: 404 });
      }
      if (u.includes('/api/notas')) return new Response(JSON.stringify({ notas: [PAGINA_1, PAGINA_2] }));
      return new Response('{}', { status: 503 });
    }),
  );
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
  limpiarPestanas();
});

function botonQueDice(texto: string): HTMLElement | undefined {
  return [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(texto));
}

const filaDePestanas = () => document.querySelector('[role="tablist"]');

/** No alcanza con que la FILA exista: se dibuja apenas hay una pestaña, con
 *  el título todavía en «…» hasta que `useNotaPorId` resuelve. */
async function esperarPestana(titulo: string) {
  await esperarA(() => filaDePestanas()?.textContent?.includes(titulo) ?? false, `la pestaña «${titulo}» resolvió su título`);
}

function botonCerrarPestana(titulo: string): HTMLButtonElement {
  return document.querySelector(`button[aria-label*="${titulo}"]`) as HTMLButtonElement;
}

test('sin ninguna página abierta, la fila de pestañas no se dibuja', async () => {
  montado = montar(<Libreta vendedoraId="luz" />);
  // El panel de "Páginas" arranca cerrado (03-sep-2026, rediseño): hay que
  // abrirlo para que la lista aparezca en el DOM.
  tocar(botonQueDice('Todas las páginas')!);
  await esperarA(() => Boolean(botonQueDice('precios del diplomado')), 'llegó la lista');

  expect(filaDePestanas()).toBeNull();
});

test('abrir una página desde la lista le agrega su pestaña', async () => {
  montado = montar(<Libreta vendedoraId="luz" />);
  // El panel de "Páginas" arranca cerrado (03-sep-2026, rediseño): hay que
  // abrirlo para que la lista aparezca en el DOM.
  tocar(botonQueDice('Todas las páginas')!);
  await esperarA(() => Boolean(botonQueDice('precios del diplomado')), 'llegó la lista');

  tocar(botonQueDice('precios del diplomado')!);
  await esperarPestana('precios del diplomado');
});

test('cerrar una pestaña que NO es la activa no mueve la selección', async () => {
  montado = montar(<Libreta vendedoraId="luz" />);
  // El panel de "Páginas" arranca cerrado (03-sep-2026, rediseño): hay que
  // abrirlo para que la lista aparezca en el DOM.
  tocar(botonQueDice('Todas las páginas')!);
  await esperarA(() => Boolean(botonQueDice('precios del diplomado')), 'llegó la lista');
  tocar(botonQueDice('precios del diplomado')!);
  await esperarPestana('precios del diplomado');
  // Elegir una página CIERRA el panel — hay que volver a abrirlo para la segunda.
  tocar(botonQueDice('Todas las páginas')!);
  await esperarA(() => Boolean(botonQueDice('ruta al local')), 'el panel volvió a abrirse');
  tocar(botonQueDice('ruta al local')!);
  await esperarPestana('ruta al local');

  // Cierra la de «precios», que quedó de fondo — «ruta al local» sigue activa.
  tocar(botonCerrarPestana('precios del diplomado'));

  await esperarA(() => !filaDePestanas()!.textContent!.includes('precios del diplomado'), 'se fue la pestaña cerrada');
  expect(filaDePestanas()?.textContent).toContain('ruta al local');
});

test('🔴 cerrar la pestaña ACTIVA activa la que quedó en su lugar', async () => {
  montado = montar(<Libreta vendedoraId="luz" />);
  // El panel de "Páginas" arranca cerrado (03-sep-2026, rediseño): hay que
  // abrirlo para que la lista aparezca en el DOM.
  tocar(botonQueDice('Todas las páginas')!);
  await esperarA(() => Boolean(botonQueDice('precios del diplomado')), 'llegó la lista');
  tocar(botonQueDice('precios del diplomado')!);
  await esperarPestana('precios del diplomado');
  // Elegir una página CIERRA el panel — hay que volver a abrirlo para la segunda.
  tocar(botonQueDice('Todas las páginas')!);
  await esperarA(() => Boolean(botonQueDice('ruta al local')), 'el panel volvió a abrirse');
  tocar(botonQueDice('ruta al local')!);
  await esperarPestana('ruta al local');

  tocar(botonCerrarPestana('ruta al local'));

  // Se fue «ruta al local» (la activa); queda «precios» — y el editor tiene
  // que haber saltado a mostrarla, no quedarse en una pantalla en blanco.
  await esperarA(() => !filaDePestanas()!.textContent!.includes('ruta al local'), 'se cerró la activa');
  expect(filaDePestanas()?.textContent).toContain('precios del diplomado');
  await esperarA(() => Boolean(document.querySelector('[data-libreta-editor]')), 'el editor sigue con algo abierto');
});

test('🔴 una pestaña guardada con un `tipo` que ya no existe no tira abajo la Libreta', async () => {
  // Simula lo que quedó en el navegador de ANTES de un cambio como el de hoy
  // (se sacó `copy` de `BarraDePestanas.tsx`): una pestaña vieja en
  // `localStorage` con un `tipo` que el mapa de íconos ya no conoce, apuntando
  // a un id que ni siquiera existe más (`/api/notas/99` da 404, así que
  // `nota.data` nunca resuelve y `Pestana` usa `pestana.tipo` tal cual quedó
  // guardado). Sin el `?? FileText` de `BarraDePestanas.tsx`, esto crashea
  // React entero — pantalla en blanco, sin ningún error visible para quien
  // mira la app.
  const conPestanaVieja = JSON.stringify([{ id: 99, espacioId: null, tipo: 'copy' }]);
  window.localStorage.setItem(CLAVE_PESTANAS, conPestanaVieja);
  // `newValue` tiene que llevar el JSON que se acaba de guardar — con `null`
  // (como hace `limpiarPestanas`) el listener de `useLocalStorage.ts` invalida
  // su caché en vez de cargarlo, y la Libreta monta como si no hubiera pestaña.
  window.dispatchEvent(new StorageEvent('storage', { key: CLAVE_PESTANAS, newValue: conPestanaVieja }));

  montado = montar(<Libreta vendedoraId="luz" />);

  await esperarA(() => Boolean(filaDePestanas()), 'la fila de pestañas se dibuja con la pestaña vieja adentro');
  expect(filaDePestanas()).not.toBeNull();
});

test('cerrar la ÚNICA pestaña abierta vuelve a la lista', async () => {
  montado = montar(<Libreta vendedoraId="luz" />);
  // El panel de "Páginas" arranca cerrado (03-sep-2026, rediseño): hay que
  // abrirlo para que la lista aparezca en el DOM.
  tocar(botonQueDice('Todas las páginas')!);
  await esperarA(() => Boolean(botonQueDice('precios del diplomado')), 'llegó la lista');
  tocar(botonQueDice('precios del diplomado')!);
  await esperarPestana('precios del diplomado');

  tocar(botonCerrarPestana('precios del diplomado'));

  await esperarA(() => filaDePestanas() === null, 'la fila entera desaparece');
  expect(document.querySelector('[data-libreta-editor]')).toBeNull();
});
