// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
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
      // POST de creación (tipo: 'archivo' o 'diagrama'). Se agrega a `paginas`
      // ANTES de contestar: `crearDocumento`/`crearDiagrama` invalidan la
      // lista al terminar, y el refetch que sigue tiene que encontrar la fila
      // nueva — como haría el server de verdad.
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
  await esperarA(() => Boolean(botonQueDice('precios del diplomado')), 'llegó la lista');
}

test('el menú de «Nueva página» ofrece las tres formas de empezar', async () => {
  await listaLista();

  expect(menuNuevaPagina(), 'la flechita del botón dividido').toBeTruthy();
  tocar(menuNuevaPagina()!);

  expect(botonQueDice('Página en blanco'), 'falta la opción de siempre').toBeTruthy();
  expect(botonQueDice('Diagrama'), 'falta la opción escondida hasta ahora').toBeTruthy();
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

  // La página nueva se abre SOLA, sin que haga falta un segundo clic — mismo
  // trato que «Nuevo Diagrama».
  await esperarA(() => Boolean(botonQueDice('Contrato.pdf')), 'el visor muestra el nombre del documento');
  // Y NUNCA por el editor de BlockNote: un archivo no se escribe.
  expect(document.querySelector('[data-libreta-editor]'), 'no tiene que montarse el editor de texto').toBeNull();
});

test('una página-documento ya guardada abre su visor y no el editor de BlockNote', async () => {
  await listaLista();
  tocar(botonQueDice('apuntes.txt')!);

  await esperarA(() => Boolean(document.body.textContent?.includes('el contenido del archivo')), 'se ve el texto del .txt');
  expect(document.querySelector('[data-libreta-editor]'), 'no tiene que montarse el editor de texto').toBeNull();
});
