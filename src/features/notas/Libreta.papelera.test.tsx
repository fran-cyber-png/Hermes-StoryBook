// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { act } from 'react';
import { esperarA, montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import { Libreta } from './Libreta';

/**
 * Precarga `EditorDePagina` (BlockNote) ANTES de que corra ningún test de
 * este archivo — mismo motivo que `Libreta.documentos.test.tsx`: `Libreta`
 * dispara ese `import()` sin `await` al montar, y un test que monta y
 * desmonta en milisegundos deja la promesa resolviendo sobre un jsdom que
 * ya se tiró abajo, lo que sale como `EnvironmentTeardownError` SIN manejar
 * (todo en verde y el proceso igual en rojo).
 */
beforeAll(async () => {
  await import('./EditorDePagina');
});

/**
 * 🔴 EL CABLEADO DE LOS CONTADORES Y LA PAPELERA (03-sep-2026) — reportado
 * como "los espacios no se están contando correctamente" y "los botones de
 * eliminar no funcionan correctamente". Las DOS quejas tenían la MISMA causa:
 * `archivar`/`desarchivar`/`crear`/`mover` invalidaban la lista de páginas
 * VIVAS de un lugar, pero nunca la Papelera (`['notas', clave, 'papelera']`)
 * ni el conteo de "Tus espacios" (`['espacios']`) — dos queryKeys DISTINTAS
 * que miran el mismo `archivadoAt`/`espacioId` desde otro ángulo.
 *
 * El síntoma no era que el botón de "Eliminar para siempre" fallara: era que
 * la fila que había que borrar **nunca llegaba a aparecer en la Papelera**
 * sin recargar la app entera — y por eso ningún test puro lo vio (`archivar`
 * en el server está bien, y `usePapelera` también; lo que faltaba era el
 * INVALIDADO cruzado, que solo se ve montando de verdad, como ADR 0024).
 */

function pagina(id: number, texto: string, espacioId: number | null = null) {
  return {
    id,
    clave: 'general',
    vendedoraId: 'luz',
    texto,
    doc: null,
    anotaciones: null,
    fijada: false,
    creadoAt: `2026-08-1${id}T00:00:00Z`,
    editadoAt: null,
    archivadoAt: null as string | null,
    origen: 'nota' as const,
    espacioId,
    tipo: 'texto' as const,
  };
}

let montado: Montado | null = null;
let store: Record<number, ReturnType<typeof pagina>> = {};
let siguienteId = 100;
const ESPACIO_ID = 7;
/**
 * Si hay un espacio, `Libreta.tsx` ATERRIZA ahí sola al montar (`yaEntro`,
 * `Libreta.tsx:814-819`) — y las pruebas de la libreta privada (1 a 3) no
 * esperan ESE dato antes de tocar el riel, así que el aterrizaje les pisaba
 * el clic apenas resolvía `/api/espacios`. Por eso el espacio solo existe en
 * el servidor cuando el test lo necesita.
 */
let hayEspacio = false;

beforeEach(() => {
  store = {};
  siguienteId = 100;
  hayEspacio = false;

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const metodo = init?.method ?? 'GET';
      // `subirDocumento` (`documentos.ts`) manda los BYTES crudos del
      // archivo como cuerpo, no JSON: `String(init.body)` de un `File` da
      // `"[object File]"` y `JSON.parse` de eso revienta ANTES de llegar a
      // mirar la URL, así que la subida entera fallaba con «No se pudo
      // adjuntar el documento» — nunca era el server, era este stub.
      const cuerpo = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      const enviar = (v: unknown, estado = 200) => new Response(JSON.stringify(v), { status: estado });

      if (u.includes('/api/espacios/padron')) return enviar({ personas: ['luz'] });
      // El conteo se DERIVA del store, igual que hace el server de verdad
      // (`contarPaginasPorEspacio`): si el test mutó `store` y el riel no lo
      // muestra, es la propia app la que está mal, no el stub.
      if (u.endsWith('/api/espacios') && metodo === 'GET') {
        if (!hayEspacio) return enviar({ espacios: [] });
        const paginas = Object.values(store).filter((n) => n.espacioId === ESPACIO_ID && !n.archivadoAt).length;
        return enviar({
          espacios: [{ id: ESPACIO_ID, nombre: 'Ideas', creadaPor: 'luz', creadoAt: '2026-08-01T00:00:00Z', miembros: ['luz'], paginas }],
        });
      }

      // POST de subida de documento — el puntero que `crearDocumento` reenvía
      // tal cual en el POST de creación de abajo (`Libreta.documentos.test.tsx`
      // fija el mismo contrato: lo que se cablea acá es la llamada, no el
      // server, que ya tiene su propio test).
      if (u.includes('/api/notas/documentos') && metodo === 'POST') {
        return enviar({ ok: true, adjunto: { archivo: 'nota-doc.pdf', nombreOriginal: 'Contrato.pdf', mime: 'application/pdf', bytes: 2048 } }, 201);
      }

      const archivarMatch = u.match(/\/api\/notas\/(\d+)\/archivar$/);
      if (archivarMatch && metodo === 'PATCH') {
        const id = Number(archivarMatch[1]);
        if (!store[id]) return enviar({ ok: false }, 404);
        store[id] = { ...store[id], archivadoAt: '2026-08-20T00:00:00Z' };
        return enviar({ ok: true, nota: store[id] });
      }
      const desarchivarMatch = u.match(/\/api\/notas\/(\d+)\/desarchivar$/);
      if (desarchivarMatch && metodo === 'PATCH') {
        const id = Number(desarchivarMatch[1]);
        if (!store[id]) return enviar({ ok: false }, 404);
        store[id] = { ...store[id], archivadoAt: null };
        return enviar({ ok: true, nota: store[id] });
      }

      const porIdMatch = u.match(/\/api\/notas\/(\d+)$/);
      if (porIdMatch && metodo === 'DELETE') {
        const id = Number(porIdMatch[1]);
        if (!store[id]) return enviar({ ok: false }, 404);
        if (!store[id].archivadoAt) return enviar({ ok: false, message: 'no archivada' }, 400);
        delete store[id];
        return enviar({ ok: true });
      }
      if (porIdMatch && metodo === 'GET') {
        const nota = store[Number(porIdMatch[1])];
        if (!nota || nota.archivadoAt) return enviar({ ok: false }, 404);
        return enviar({ ok: true, nota });
      }
      if (porIdMatch && metodo === 'PATCH') {
        const id = Number(porIdMatch[1]);
        store[id] = {
          ...store[id],
          ...(cuerpo.doc !== undefined ? { doc: cuerpo.doc, texto: 'editada' } : {}),
          ...(cuerpo.fijada !== undefined ? { fijada: cuerpo.fijada } : {}),
        };
        return enviar({ ok: true, nota: store[id] });
      }

      if (u.includes('/api/notas') && metodo === 'GET') {
        const params = new URL(u, 'http://x').searchParams;
        const archivadas = params.get('archivadas') === '1';
        const espacio = params.get('espacio');
        const filas = Object.values(store).filter((n) => Boolean(n.archivadoAt) === archivadas);
        return enviar({
          notas: filas.filter((n) =>
            espacio
              ? String(n.espacioId) === espacio
              : // La Papelera (04-sep-2026, ADR 0093): además de lo privado, trae lo
                // archivado de CUALQUIER espacio — acá la única vendedora del test
                // es miembro de todos los que el propio stub siembra.
                archivadas
                ? true
                : n.espacioId === null,
          ),
        });
      }

      if (u.endsWith('/api/notas') && metodo === 'POST') {
        const id = siguienteId++;
        const nueva = pagina(id, cuerpo.texto ?? '', cuerpo.espacioId ?? null);
        store[id] = nueva;
        return enviar({ ok: true, nota: nueva });
      }

      return enviar({ ok: false, message: 'stub' }, 503);
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

/**
 * La fila de una página, sin asumir que el título es un botón: en la
 * Papelera NO lo es (`Libreta.tsx` — «una página archivada no se edita
 * desde acá: restaurar o eliminar para siempre, nada más», así que el
 * título es un `<div>`, no un botón, y `botonQueDice` nunca la encuentra
 * aunque el texto SÍ esté en el DOM).
 */
function filaQueDice(texto: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('.group')].find((el) => el.textContent?.includes(texto));
}

/**
 * Fijar/archivar/restaurar/eliminar viven ADENTRO del menú `⋮` de la fila
 * (`MenuDeFila.tsx`, ADR 0093) — hay que abrirlo antes de poder tocarlos.
 */
async function abrirMenuDeFila(fila: Element) {
  tocar(fila.querySelector('[aria-label="Más acciones de la página"]')!);
  await reposar();
}

function contadorDe(nombreDeFila: string): string | undefined {
  const fila = botonQueDice(nombreDeFila);
  return fila?.querySelector('span:last-child')?.textContent ?? undefined;
}

async function montarConPagina() {
  store[1] = pagina(1, 'Precio del diplomado');
  montado = montar(<Libreta vendedoraId="luz" />);
  await esperarA(() => Boolean(botonQueDice('Todas las páginas')), 'llegó el riel');
}

test('🔴 archivar hace que la página aparezca en Papelera SIN recargar', async () => {
  await montarConPagina();
  tocar(botonQueDice('Todas las páginas')!);
  await esperarA(() => Boolean(botonQueDice('Precio del diplomado')), 'llegó la página');

  const fila = botonQueDice('Precio del diplomado')!.closest('.group')!;
  await abrirMenuDeFila(fila);
  tocar(botonQueDice('Archivar')!);

  // Antes de este candado, esto se quedaba esperando para siempre: `archivar`
  // no invalidaba `['notas', clave, 'papelera']`, así que la Papelera seguía
  // mostrando la respuesta VIEJA (vacía) hasta un reload.
  await esperarA(() => contadorDe('Papelera') === '1', 'el contador de Papelera subió sin recargar');

  tocar(botonQueDice('Papelera')!);
  await esperarA(() => Boolean(filaQueDice('Precio del diplomado')), 'la página apareció en la Papelera');
});

test('🔴 restaurar desde la Papelera la devuelve a Todas las páginas SIN recargar', async () => {
  store[1] = { ...pagina(1, 'Precio del diplomado'), archivadoAt: '2026-08-20T00:00:00Z' };
  montado = montar(<Libreta vendedoraId="luz" />);
  await esperarA(() => Boolean(botonQueDice('Papelera')), 'llegó el riel');
  tocar(botonQueDice('Papelera')!);
  await esperarA(() => Boolean(filaQueDice('Precio del diplomado')), 'llegó a la Papelera');

  const fila = filaQueDice('Precio del diplomado')!;
  await abrirMenuDeFila(fila);
  tocar(botonQueDice('Restaurar')!);

  await esperarA(() => contadorDe('Todas las páginas') === '1', 'el contador de Todas subió sin recargar');
  await esperarA(() => contadorDe('Papelera') === '0', 'el contador de Papelera bajó sin recargar');
});

test('eliminar para siempre saca la página de la Papelera para siempre', async () => {
  store[1] = { ...pagina(1, 'Precio del diplomado'), archivadoAt: '2026-08-20T00:00:00Z' };
  montado = montar(<Libreta vendedoraId="luz" />);
  await esperarA(() => Boolean(botonQueDice('Papelera')), 'llegó el riel');
  tocar(botonQueDice('Papelera')!);
  await esperarA(() => Boolean(filaQueDice('Precio del diplomado')), 'llegó a la Papelera');

  const fila = filaQueDice('Precio del diplomado')!;
  await abrirMenuDeFila(fila);
  tocar(botonQueDice('Eliminar para siempre')!);

  // El `ModalDeConfirmacion` propio reemplazó el `window.confirm` nativo del
  // navegador (03-sep-2026) — hay que confirmar ADENTRO de él; el ícono de la
  // fila solo lo abre, no borra nada por sí mismo.
  await esperarA(() => Boolean(botonQueDice('Eliminar para siempre')), 'se abrió la confirmación');
  tocar(botonQueDice('Eliminar para siempre')!);

  await esperarA(() => !filaQueDice('Precio del diplomado'), 'la página se fue de la lista');
  await esperarA(() => contadorDe('Papelera') === '0', 'el contador bajó a 0');
  expect(store[1]).toBeUndefined();
});

/**
 * ⚠️ Esta prueba crea la página ADJUNTANDO UN DOCUMENTO y no escribiendo en
 * el editor de texto: `EditorDePagina` es BlockNote (ProseMirror), que no
 * expone `document.execCommand` ni nada que jsdom implemente, así que no hay
 * forma de simular un tecleo real — el mismo motivo que documenta
 * `useAutoguardado.test.tsx` para probar esa máquina sin montar el editor de
 * verdad. Adjuntar un documento pasa por un `<input type="file">` normal
 * (`change`), que sí es 100 % simulable, y ejercita la MISMA invalidación:
 * `crearDocumento` nace en `espacioId` igual que `crear` (`notas.ts`).
 */
const inputDocumento = () => document.querySelector('input[aria-label="Elegir documento"]') as HTMLInputElement | null;
const menuNuevaPagina = () => document.querySelector('[aria-label="Más formas de crear una página"]') as HTMLButtonElement | null;

test('🔴 crear una página EN UN ESPACIO actualiza su contador en el riel SIN recargar', async () => {
  hayEspacio = true;
  montado = montar(<Libreta vendedoraId="luz" />);
  await esperarA(() => contadorDe('Ideas') === '0', 'llegó el espacio');

  tocar(botonQueDice('Ideas')!);
  await esperarA(() => Boolean(menuNuevaPagina()), 'se abrió el panel del espacio');
  tocar(menuNuevaPagina()!);
  tocar(botonQueDice('Adjuntar documento')!);

  const archivo = new File(['%PDF-1.4 contenido de prueba'], 'Contrato.pdf', { type: 'application/pdf' });
  const input = inputDocumento()!;
  Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
  act(() => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Antes de este candado, ni `crear` ni `crearDocumento` invalidaban
  // `['espacios']`: el riel seguía diciendo "0" con una página ya guardada
  // en el server.
  await esperarA(() => contadorDe('Ideas') === '1', 'el contador del espacio subió sin recargar');
});

test('🔴 archivar una página de un espacio le baja el contador SIN recargar', async () => {
  hayEspacio = true;
  store[1] = pagina(1, 'Nota del equipo', ESPACIO_ID);
  montado = montar(<Libreta vendedoraId="luz" />);
  await esperarA(() => contadorDe('Ideas') === '1', 'llegó el espacio con su página');

  tocar(botonQueDice('Ideas')!);
  await esperarA(() => Boolean(botonQueDice('Nota del equipo')), 'llegó la página del espacio');
  const fila = botonQueDice('Nota del equipo')!.closest('.group')!;
  await abrirMenuDeFila(fila);
  tocar(botonQueDice('Archivar')!);

  await esperarA(() => contadorDe('Ideas') === '0', 'el contador del espacio bajó sin recargar');
});

test('🔴 archivar una página de un espacio la lleva a la Papelera, y se puede restaurar (ADR 0093)', async () => {
  hayEspacio = true;
  store[1] = pagina(1, 'Nota del equipo', ESPACIO_ID);
  montado = montar(<Libreta vendedoraId="luz" />);
  await esperarA(() => contadorDe('Ideas') === '1', 'llegó el espacio con su página');

  tocar(botonQueDice('Ideas')!);
  await esperarA(() => Boolean(botonQueDice('Nota del equipo')), 'llegó la página del espacio');
  const fila = botonQueDice('Nota del equipo')!.closest('.group')!;
  await abrirMenuDeFila(fila);
  tocar(botonQueDice('Archivar')!);
  await esperarA(() => contadorDe('Ideas') === '0', 'se fue de la vista viva del espacio');

  // Antes de este candado, acá terminaba la historia: la Papelera solo traía
  // lo privado, así que una página de espacio archivada no aparecía en NINGÚN
  // lado — quedaba archivada para siempre, sin un botón que la restaure.
  tocar(botonQueDice('Papelera')!);
  await esperarA(() => Boolean(filaQueDice('Nota del equipo')), 'apareció en la Papelera');
  // Dice de qué espacio vino — sin esto se vería igual que una privada.
  expect(filaQueDice('Nota del equipo')!.textContent).toContain('Ideas');

  const filaEnPapelera = filaQueDice('Nota del equipo')!;
  await abrirMenuDeFila(filaEnPapelera);
  tocar(botonQueDice('Restaurar')!);

  await esperarA(() => contadorDe('Ideas') === '1', 'restaurarla la devuelve al espacio');

  // ⚠️ Esta parte NO detecta el bug real de `desarchivar` (04-sep-2026): el
  // `QueryClient` de los tests no tiene `staleTime` (`dom.tsx`, «sin caché
  // entre casos»), así que volver a "Ideas" siempre refetchea, invalidado o
  // no. En producción `staleTime` es 30 s (`lib/datos/cliente.ts`) y ESO es
  // lo que dejaba la lista vieja hasta navegar afuera y volver — se verificó
  // a mano contra el server real (Playwright), no acá. Queda igual como
  // afirmación de contenido correcto, no como candado de la invalidación.
  tocar(botonQueDice('Ideas')!);
  await esperarA(() => Boolean(botonQueDice('Nota del equipo')), 'la página vuelve a verse en la lista del espacio');
});
