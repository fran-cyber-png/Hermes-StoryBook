// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { esperarA, montar, reposar, type Montado } from '../../pruebas/dom';
import { Libreta } from './Libreta';

/**
 * EL CABLEADO DEL SELECTOR DE ESPACIOS — lo que ningún test puro puede ver.
 *
 * Las reglas ya están fijadas puras (`espacios.test.ts`) y contra base
 * (`espacios/visibilidad.paridad.test.db.ts`). Lo que queda, y es la lección de
 * ADR 0024, es lo que solo se ve MONTANDO: los defectos de abajo no rompen
 * nada, no tiran ninguna excepción y en pantalla se ven bien.
 *
 *   1. **La bienvenida comiéndose la pantalla adentro de un espacio vacío.** Se
 *      lleva el selector con ella, así que la vendedora queda ENCERRADA en un
 *      lugar vacío: el único camino de vuelta a «Mi libreta» es recargar la app.
 *      Un espacio recién creado está vacío por definición, siempre — o sea que
 *      es el primer estado que ve quien usa el frente.
 *
 * 🔴 **«Cambiar de espacio CIERRA la página abierta» se probaba acá y era al
 * revés de lo que se quería (04-sep-2026, a pedido explícito).** Tocar un
 * espacio del riel para MIRAR su lista no tiene por qué tirar abajo lo que ya
 * estabas leyendo o escribiendo — el panel de "Páginas" ya se superpone sin
 * empujar nada (`absolute`, `Libreta.tsx`), y ahora tampoco tapa la página
 * abierta. `alElegirVista` dejó de hacer `setSeleccion(null)`, y
 * `paginaAbierta` aprendió a resolverse por `useNotaPorId` cuando la página ya
 * no está en la lista de la vista actual (mismo seam que `PantallaDividida.tsx`
 * y la barra de pestañas). El candado de abajo («YA NO cierra») prueba lo
 * contrario de lo que este archivo probaba hasta ayer.
 */

const ESPACIOS = [
  { id: 7, nombre: 'Equipo de ventas', creadaPor: 'luz', creadoAt: '2026-08-10T00:00:00Z', miembros: ['luz', 'sindy'] },
];

/** Las páginas que devuelve el stub, por espacio. `general` = la libreta privada. */
const PAGINAS: Record<string, unknown[]> = {
  privada: [
    {
      id: 1,
      clave: 'general',
      vendedoraId: 'luz',
      texto: 'mi página privada',
      doc: null,
      fijada: false,
      creadoAt: '2026-08-04T00:00:00Z',
      editadoAt: null,
      archivadoAt: null,
      origen: 'nota',
      espacioId: null,
    },
  ],
  // El espacio está VACÍO: es el estado de uno recién creado, y el que disparaba
  // la bienvenida que encerraba a la vendedora.
  '7': [],
};

let montado: Montado | null = null;
/** Las URLs que la app pidió. Sirve para esperar a un request CONCRETO. */
let pedidas: string[] = [];
/** Lo que devuelve `/api/espacios` en ESTE test. Mutable: el de «sin espacios» la vacía. */
let espaciosDelServer: unknown[] = ESPACIOS;

beforeEach(() => {
  pedidas = [];
  espaciosDelServer = ESPACIOS;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      pedidas.push(String(url));
      const u = String(url);
      if (u.includes('/api/espacios/padron')) return new Response(JSON.stringify({ personas: ['luz', 'sindy'] }));
      if (u.includes('/api/espacios')) return new Response(JSON.stringify({ espacios: espaciosDelServer }));
      // `GET /api/notas/:id` — la trae `useNotaPorId`, ANTES del listado
      // genérico de abajo (que también matchea por `includes`): la página
      // abierta ya no cierra al cambiar de espacio (04-sep-2026), así que
      // `paginaAbierta` puede pedirla por su cuenta aunque no esté en la
      // lista de la vista actual.
      const porId = u.match(/\/api\/notas\/(\d+)$/);
      if (porId) {
        const id = Number(porId[1]);
        const nota = Object.values(PAGINAS)
          .flat()
          .find((n): n is { id: number } => typeof n === 'object' && n !== null && (n as { id?: number }).id === id);
        if (!nota) return new Response(JSON.stringify({ ok: false }), { status: 404 });
        return new Response(JSON.stringify({ ok: true, nota }));
      }
      if (u.includes('/api/notas')) {
        const espacio = new URL(u, 'http://x').searchParams.get('espacio');
        return new Response(JSON.stringify({ notas: PAGINAS[espacio ?? 'privada'] ?? [] }));
      }
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

/**
 * ⚠️ **«Ya no dice Cargando…» NO alcanza como espera**, y por eso esto mira el
 * request. Al tocar el espacio, react-query estrena `queryKey` y tarda un tick en
 * ponerse en `isPending`: en ese hueco la condición se cumple con la pantalla
 * ANTERIOR, el test sigue de largo y falla contra un estado que ya no existe.
 * Se espera a que el fetch de ESE espacio haya salido y además haya resuelto.
 */
const cargoElEspacio = (id: number) => () =>
  pedidas.some((u) => u.includes(`espacio=${id}`)) && !document.body.textContent?.includes('Cargando…');

test('al entrar, con un espacio disponible, arranca AHÍ y no en Mi libreta', async () => {
  // Decisión del dueño (17-ago-2026): con espacios de equipo en uso, dejan de
  // ser lo segundo — el selector los sigue mostrando abajo de Mi libreta
  // (orden), pero el lugar donde la vendedora ATERRIZA es el primer espacio.
  montado = montar(<Libreta vendedoraId="luz" />);
  await esperarA(cargoElEspacio(7), 'cargaron las páginas del espacio 7');

  expect(botonQueDice('Todas las páginas')).toBeTruthy();
  expect(botonQueDice('Todas las páginas')?.getAttribute('aria-current')).toBeNull();
  expect(botonQueDice('Equipo de ventas')?.getAttribute('aria-current')).toBe('true');
});

test('sin ningún espacio, se queda en Mi libreta — la Libreta de siempre', async () => {
  // El fallback que hace seguro el redirect: quien todavía no tiene un espacio
  // de equipo no puede quedar sin ningún lugar donde aterrizar.
  espaciosDelServer = [];
  montado = montar(<Libreta vendedoraId="luz" />);
  // El panel de "Páginas" arranca cerrado (03-sep-2026): hay que abrirlo para
  // que la lista aparezca en el DOM.
  await esperarA(() => Boolean(botonQueDice('Todas las páginas')), 'llegó el riel');
  botonQueDice('Todas las páginas')?.click();
  await esperarA(() => Boolean(botonQueDice('mi página privada')), 'llegó la página privada');

  expect(botonQueDice('Todas las páginas')?.getAttribute('aria-current')).toBe('true');
});

test('🔴 cambiar de espacio YA NO cierra la página abierta', async () => {
  montado = montar(<Libreta vendedoraId="luz" />);
  await esperarA(cargoElEspacio(7), 'cargaron las páginas del espacio 7');

  // Vuelvo a la privada a mano para abrir una página de ahí — el redirect
  // automático solo corre una vez, al montar, así que no me trae de vuelta.
  botonQueDice('Todas las páginas')?.click();
  await esperarA(() => Boolean(botonQueDice('mi página privada')), 'llegó la página privada');

  botonQueDice('mi página privada')?.click();
  // Un `reposar()` a secas no alcanza: el editor está detrás de una frontera
  // perezosa (`perezosos.tsx`), así que el primer montaje del test tarda más de
  // un turno. Es el mismo motivo que documenta `esperarA`.
  await esperarA(() => Boolean(document.querySelector('[data-libreta-editor]')), 'se montó el editor');
  expect(document.querySelector('[data-libreta-editor]')).toBeTruthy();

  // Salto al espacio compartido — antes esto cerraba la página; ahora solo
  // cambia qué lista muestra el panel, que se superpone sin tapar nada.
  botonQueDice('Equipo de ventas')?.click();
  // `paginaAbierta` ya no la encuentra en la lista de "Equipo de ventas"
  // (está vacía, `PAGINAS['7']`) y tiene que pedirla aparte por
  // `useNotaPorId` — esperar a que ESE fetch concreto haya salido, mismo
  // motivo que `cargoElEspacio` de más arriba.
  await esperarA(() => pedidas.some((u) => /\/api\/notas\/1$/.test(u)), 'pidió la página abierta por su id');
  await reposar();

  expect(document.querySelector('[data-libreta-editor]')).toBeTruthy();
  expect(botonQueDice('Equipo de ventas')?.getAttribute('aria-current')).toBe('true');
});

test('🔴 en un espacio VACÍO no aparece la bienvenida — no se queda encerrada', async () => {
  montado = montar(<Libreta vendedoraId="luz" />);
  await esperarA(cargoElEspacio(7), 'cargaron las páginas del espacio 7');

  // La bienvenida es de la libreta privada: su texto no puede salir acá, porque
  // dice «es tuya, nadie más la ve» sobre un espacio que ve todo el equipo.
  expect(document.body.textContent).not.toContain('Tu libreta está en blanco');
  // Y el camino de vuelta sigue en pantalla, que es lo que importa de verdad.
  expect(botonQueDice('Todas las páginas')).toBeTruthy();

  // El panel arranca cerrado — el vacío del espacio se dice ADENTRO de él.
  botonQueDice('Equipo de ventas')?.click();
  await esperarA(
    () => Boolean(document.body.textContent?.includes('Nadie escribió nada acá todavía')),
    'apareció el vacío del espacio',
  );
});

test('el vacío de un espacio NO dice «nadie más del equipo la ve»', async () => {
  // La peor mentira posible de este frente: la que hace escribir un precio mal
  // puesto creyendo que no lo lee nadie.
  montado = montar(<Libreta vendedoraId="luz" />);
  await esperarA(cargoElEspacio(7), 'cargaron las páginas del espacio 7');

  expect(document.body.textContent).not.toContain('nadie más del equipo la ve');
});

test('🔴 «Administrar espacios» es FIJO — está en Mi libreta y en cualquier espacio por igual', async () => {
  // Hasta el 26-ago-2026 decía «Administrar «X»…» y solo aparecía sobre un
  // espacio del que fueras la creadora — reportado como que desarmaba la UI
  // (el botón saltaba de lugar, o directamente no estaba, según dónde
  // estuvieras parada). Ahora es un botón fijo que abre un modal
  // (`ModalDeEspacios.tsx`), y ESE es quien decide qué se puede administrar —
  // ver `listarCreadosPor` del server, con su propio test de grafía
  // normalizada (`espacios/repositorio.test.db.ts`).
  //
  // 03-sep-2026: el disparador vive adentro del menú «Configuración» (se
  // fusionó con «Configurar Respuestas Rápidas», que competía por el mismo
  // lugar fijo al pie del riel) — hay que abrirlo para verlo.
  montado = montar(<Libreta vendedoraId="Luz" />);
  await esperarA(cargoElEspacio(7), 'cargaron las páginas del espacio 7');
  botonQueDice('Configuración')?.click();
  await reposar();
  expect(botonQueDice('Administrar espacios')).toBeTruthy();

  botonQueDice('Todas las páginas')?.click();
  await reposar();
  // El clic de arriba no dispara `pointerdown` (es `.click()`, no `tocar()`),
  // así que el menú puede haber quedado abierto o cerrado según el entorno —
  // se abre solo si hace falta, en vez de asumir un estado.
  if (!botonQueDice('Administrar espacios')) {
    botonQueDice('Configuración')?.click();
    await reposar();
  }
  expect(botonQueDice('Administrar espacios')).toBeTruthy();
});
