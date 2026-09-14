// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { esperarA, montar, tocar, type Montado } from '../../pruebas/dom';
import { Libreta } from './Libreta';

/**
 * ADJUNTAR UN DOCUMENTO COMO PÁGINA (26-ago-2026) — el cableado de punta a
 * punta: el menú de «Nueva página», la subida, la creación de la fila y el
 * visor que abre. Mismo molde que `Libreta.dibujo.test.tsx`: lo que un test
 * puro no puede ver es el CABLEADO — acá está todo el riesgo de este frente,
 * no en `validarArchivoAdjunto` (ya cubierto en `server/src/notas/notas.test.ts`).
 */

const PAGINA_TEXTO = {
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

const PAGINA_ARCHIVO = {
  id: 9,
  clave: 'general',
  vendedoraId: 'luz',
  texto: 'apuntes.txt',
  doc: null,
  anotaciones: null,
  fijada: false,
  creadoAt: '2026-08-20T00:00:00Z',
  editadoAt: null,
  archivadoAt: null,
  origen: 'nota',
  espacioId: null,
  tipo: 'archivo',
  archivo: { archivo: 'nota-doc-vieja.txt', nombreOriginal: 'apuntes.txt', mime: 'text/plain', bytes: 42 },
};

const NOTA_SUBIDA = {
  id: 10,
  clave: 'general',
  vendedoraId: 'luz',
  texto: 'Contrato.pdf',
  doc: null,
  anotaciones: null,
  fijada: false,
  creadoAt: '2026-08-26T00:00:00Z',
  editadoAt: null,
  archivadoAt: null,
  origen: 'nota',
  espacioId: null,
  tipo: 'archivo',
  archivo: { archivo: 'nota-doc-nueva.pdf', nombreOriginal: 'Contrato.pdf', mime: 'application/pdf', bytes: 2048 },
};

/**
 * 🔴 SIN ESTO, VITEST TIRA UN «UNHANDLED REJECTION» AL AZAR.
 *
 * `Libreta` precarga `EditorDePagina` (`perezosos.tsx`) al montar, sin
 * `await` — a propósito, es fuego y olvido para no bloquear la lista. Cada
 * test de este archivo monta y desmonta la Libreta en milisegundos, mucho
 * antes de que ese `import()` (BlockNote) termine de bajar y parsear. Cuando
 * por fin resuelve, el entorno jsdom de ESTE archivo ya se desmontó — y
 * `EnvironmentTeardownError` sale como rechazo SIN manejar, no como falla de
 * ningún test puntual (por eso Vitest reporta todo en verde y aun así el
 * proceso termina en rojo).
 *
 * Importarlo acá, una vez, ANTES de que corra ningún test deja el módulo ya
 * resuelto en el registro: la precarga de `Libreta` encuentra la promesa
 * cacheada y no dispara una descarga nueva que pueda terminar tarde.
 */
beforeAll(async () => {
  await import('./EditorDePagina');
});

let montado: Montado | null = null;
let paginas = [PAGINA_TEXTO, PAGINA_ARCHIVO];
let peticiones: { url: string; metodo: string; body: Record<string, unknown> | undefined }[] = [];

beforeEach(() => {
  paginas = [PAGINA_TEXTO, PAGINA_ARCHIVO];
  peticiones = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opciones?: RequestInit) => {
      const u = String(url);
      const metodo = (opciones?.method ?? 'GET').toUpperCase();
      const body = typeof opciones?.body === 'string' ? JSON.parse(opciones.body) : undefined;
      peticiones.push({ url: u, metodo, body });

      if (u.includes('/api/espacios/padron')) return new Response(JSON.stringify({ personas: ['luz'] }));
      if (u.includes('/api/espacios')) return new Response(JSON.stringify({ espacios: [] }));

      // GET de un documento ya subido — sirve texto plano para las dos notas
      // de la fixture, que alcanza para lo que este archivo verifica.
      if (u.includes('/api/notas/documentos/') && metodo === 'GET') {
        return new Response('el contenido del archivo', { headers: { 'content-type': 'text/plain' } });
      }
      // POST de subida — SIEMPRE devuelve el mismo puntero, no importa qué
      // archivo mandó el test: lo que se fija es el CABLEADO, no el server.
      if (u.includes('/api/notas/documentos') && metodo === 'POST') {
        return new Response(JSON.stringify({ ok: true, adjunto: NOTA_SUBIDA.archivo }), { status: 201 });
      }
      // POST de creación (tipo: 'archivo'). Se agrega a `paginas` ANTES de
      // contestar: `crearDocumento` invalida la lista al terminar, y el
      // refetch que sigue tiene que encontrar la fila nueva — como haría el
      // server de verdad.
      if (u.endsWith('/api/notas') && metodo === 'POST') {
        if (body?.tipo === 'archivo') {
          paginas = [...paginas, NOTA_SUBIDA];
          return new Response(JSON.stringify({ ok: true, nota: NOTA_SUBIDA }));
        }
        const nueva = { ...PAGINA_TEXTO, id: 99, tipo: body?.tipo ?? 'texto' };
        paginas = [...paginas, nueva];
        return new Response(JSON.stringify({ ok: true, nota: nueva }));
      }
      if (u.includes('/api/notas')) return new Response(JSON.stringify({ notas: paginas }));
      return new Response('{}', { status: 503 });
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

const menuNuevaPagina = () => document.querySelector('[aria-label="Más formas de crear una página"]') as HTMLButtonElement | null;
const inputDocumento = () => document.querySelector('input[aria-label="Elegir documento"]') as HTMLInputElement | null;

async function listaLista() {
  montado = montar(<Libreta vendedoraId="luz" />);
  // El panel de "Páginas" arranca cerrado (03-sep-2026): hay que abrirlo para
  // que la lista (y el menú de "Nueva página", que vive adentro) aparezcan.
  await esperarA(() => Boolean(botonQueDice('Todas las páginas')), 'llegó el riel');
  tocar(botonQueDice('Todas las páginas')!);
  await esperarA(() => Boolean(botonQueDice('precios del diplomado')), 'llegó la lista');
}

test('el botón dividido de «Nueva página» ofrece las dos formas de empezar', async () => {
  await listaLista();

  // Botón dividido (rediseño de ficha, 03-sep-2026): el clic PRINCIPAL en
  // «Nueva página» ya crea la página en blanco directo — no es una opción
  // del menú. La flechita es lo único que abre el menú, y ahí vive nada más
  // «Adjuntar documento», la forma menos usada.
  expect(botonQueDice('Nueva página'), 'falta el botón principal, siempre visible').toBeTruthy();
  expect(menuNuevaPagina(), 'la flechita del botón dividido').toBeTruthy();
  tocar(menuNuevaPagina()!);

  expect(botonQueDice('Adjuntar documento'), 'falta la opción nueva').toBeTruthy();
});

test('🔴 «Adjuntar documento» abre el buscador de archivos, con la lista blanca del server', async () => {
  await listaLista();
  tocar(menuNuevaPagina()!);

  const input = inputDocumento();
  expect(input, 'sin input no hay de dónde elegir el archivo').toBeTruthy();
  expect(input!.accept).toContain('application/pdf');
  expect(input!.accept).toContain('.docx');
  expect(input!.accept).toContain('text/plain');

  const clic = vi.spyOn(input!, 'click');
  tocar(botonQueDice('Adjuntar documento')!);
  expect(clic, 'el botón del menú tiene que disparar el input oculto').toHaveBeenCalledOnce();
});

test('elegir un archivo lo sube, crea la página como tipo "archivo" y la abre en su visor', async () => {
  await listaLista();
  tocar(menuNuevaPagina()!);
  const input = inputDocumento()!;

  const archivo = new File(['%PDF-1.4 contenido de prueba'], 'Contrato.pdf', { type: 'application/pdf' });
  Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
  act(() => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Las tres peticiones, EN ORDEN: subir el archivo, crear la fila, y recién
  // después bajar los bytes para el visor de la página que se acaba de abrir.
  await esperarA(
    () => peticiones.some((p) => p.url.endsWith('/api/notas/documentos') && p.metodo === 'POST'),
    'subió el documento',
  );
  await esperarA(
    () => peticiones.some((p) => p.url.endsWith('/api/notas') && p.metodo === 'POST' && p.body?.tipo === 'archivo'),
    'creó la página con tipo "archivo"',
  );
  const creacion = peticiones.find((p) => p.url.endsWith('/api/notas') && p.metodo === 'POST' && p.body?.tipo === 'archivo');
  expect(creacion?.body?.archivo, 'manda el puntero que devolvió la subida, no el archivo crudo').toEqual(NOTA_SUBIDA.archivo);

  // La página nueva se abre SOLA, sin que haga falta un segundo clic — y el
  // panel de "Páginas" se cierra al crearla (`adjuntarDocumento`), así que lo
  // que hay que ver es el VISOR principal, no un botón de la lista.
  //
  // ⚠️ El nombre ya NO se lee del `textContent` del visor (04-sep-2026): la
  // cabecera que lo mostraba como texto plano se sacó de `PaginaDocumento.tsx`
  // a pedido explícito (ADR 0093, «Descargar» se mudó al menú `⋮` de la fila).
  // Lo que queda visible con ese nombre es el campo de `AccionesDePagina.tsx`
  // (`TituloEditable`, «Nombra el documento») — un `<input>`, así que su
  // `.value` no aparece en `textContent` y hay que leerlo aparte.
  await esperarA(
    () =>
      document.querySelector<HTMLInputElement>('input[aria-label="Nombra el documento"]')?.value === 'Contrato.pdf',
    'el campo de título muestra el nombre del documento',
  );
  // Y NUNCA por el editor de BlockNote: un archivo no se escribe.
  expect(document.querySelector('[data-libreta-editor]'), 'no tiene que montarse el editor de texto').toBeNull();
});

test('una página-documento ya guardada abre su visor y no el editor de BlockNote', async () => {
  await listaLista();
  tocar(botonQueDice('apuntes.txt')!);

  await esperarA(() => Boolean(document.body.textContent?.includes('el contenido del archivo')), 'se ve el texto del .txt');
  expect(document.querySelector('[data-libreta-editor]'), 'no tiene que montarse el editor de texto').toBeNull();
});
