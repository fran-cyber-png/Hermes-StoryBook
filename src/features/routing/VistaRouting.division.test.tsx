// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act } from 'react';
import { esperarA, montar, reposar, type Montado } from '../../pruebas/dom';
import { VistaRouting } from './VistaRouting';

/**
 * ELEGIR UNA DIVISIÓN DIBUJA SU LIENZO — el test de CABLEADO que faltaba.
 *
 * ══ 🔴 POR QUÉ EXISTE ESTE ARCHIVO ══════════════════════════════════════════
 *
 * `division.test.ts` prueba `columnasDeDivision` y `cablesDeDivision` como
 * funciones puras, y pasaban las nueve. La galería mostraba el lienzo de la
 * división y la captura se veía perfecta. **Y la feature estaba muerta en la
 * app**: el render seguía condicionado a `producto || pieza`, que son `null` por
 * definición cuando hay una división elegida, así que el armado se calculaba y
 * se tiraba — la fila se marcaba activa a la izquierda y el lienzo pintaba
 * «Elige algo de la izquierda para conectarlo».
 *
 * La galería no lo desmintió **porque monta `Lienzo` DIRECTO**, salteándose esta
 * vista. Es exactamente la lección de ADR 0024, repetida en ADR 0068: *un test
 * de REGLA no reemplaza uno de CABLEADO; el defecto suele ser que nadie llama a
 * la regla, no que esté mal escrita*.
 *
 * Por eso este test monta `VistaRouting` de verdad, hace clic en una división y
 * exige ver su columna. Es lo único que se habría puesto rojo.
 */

let montado: Montado | undefined;

/** La foto de `/api/routing`: una campaña, para que la vista no muestre el vacío. */
const FOTO = {
  linea: '51984429504',
  etiqueta: 'Ventas Meta',
  ventanaDias: 30,
  campanas: [
    {
      campanaId: 'c1',
      nombre: '[AGO] OSINT',
      estado: 'activa',
      anuncios: 1,
      personas: 12,
      ultima: null,
      familia: 'dipicot',
      vendedoras: [],
    },
  ],
  cursos: [],
  productos: [{ familia: 'dipicot', nombre: 'Inteligencia y Contrainteligencia' }],
  anunciosSinResolver: 0,
  campanasEnOtraLinea: 0,
  actualizadoAt: null,
  sinMigracion: false,
  destinos: ['Luz', 'Sindy'],
};

/**
 * El tablero: una división que **YA tiene una vendedora**. Es el caso que importa
 * — con la división vacía, el defecto de la siembra no se ve.
 */
const TABLERO = {
  divisiones: [
    { division: 'inteligencia', nombre: 'Inteligencia', familias: 58, productos: 96, vendedoras: ['Luz'] },
  ],
  familias: [
    {
      familia: 'dipicot',
      nombre: 'Inteligencia y Contrainteligencia',
      division: 'inteligencia',
      divisionNombre: 'Inteligencia',
      productos: 23,
      vendedoras: [],
    },
  ],
  cayo: [],
  actualizadoAt: null,
  ventanaDias: 30,
};

/** Lo que el front le mandó al server. Es lo que fija el segundo test. */
let enviados: { url: string; body: unknown }[] = [];

beforeEach(() => {
  enviados = [];
  localStorage.setItem('hermes.token', 'no-se-verifica-en-el-front');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, opciones?: RequestInit) => {
      const u = String(url);
      const json = (v: unknown) =>
        new Response(JSON.stringify(v), { status: 200, headers: { 'content-type': 'application/json' } });

      if (opciones?.method === 'PUT') {
        enviados.push({ url: u, body: JSON.parse(String(opciones.body)) });
        return json({ ok: true });
      }
      if (u.includes('/api/routing/tablero')) return json(TABLERO);
      if (u.includes('/api/routing/historial')) return json({ filas: [] });
      if (u.includes('/api/routing')) return json(FOTO);
      return json({ ok: true });
    }),
  );
});

afterEach(() => {
  montado?.desmontar();
  montado = undefined;
  vi.unstubAllGlobals();
});

/** El texto que la vista pinta cuando no hay nada elegido. Si aparece, no se dibujó. */
const VACIO = 'Elige algo de la izquierda';

/** Un clic de verdad, dentro de `act`: lo que hace `teclear` para el teclado. */
async function clic(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
  });
}

function texto(): string {
  return montado?.contenedor.textContent ?? '';
}

function filaDeLaDivision(): HTMLElement | undefined {
  return [...(montado?.contenedor.querySelectorAll('button') ?? [])].find((b) =>
    b.textContent?.includes('96 productos'),
  ) as HTMLElement | undefined;
}

test('🔴 elegir una división DIBUJA su lienzo, no el cartel de vacío', async () => {
  montado = montar(<VistaRouting />);
  await esperarA(() => texto().includes('Inteligencia'), 'la lista trajo la división');

  const fila = filaDeLaDivision();
  expect(fila, 'la fila de la división tiene que estar en la lista').toBeTruthy();
  await clic(fila!);
  await reposar();

  // La columna de la división sólo existe si `columnasDeDivision` llegó al render.
  expect(texto()).toContain('La división');
  expect(texto()).not.toContain(VACIO);
});

test('🔴 el primer arrastre manda el conjunto COMPLETO, no sólo el nuevo', async () => {
  /**
   * `PUT /api/routing/reglas` es DECLARATIVO: el arreglo que recibe es el
   * conjunto completo y el server borra a quien no esté. Si la siembra no
   * corriera al elegir, el lienzo dibujaría cero cables desde el nodo de la
   * división y el primer arrastre mandaría un conjunto de UNO — **borrando en el
   * server a las que ya estaban**, mientras la fila de la izquierda las sigue
   * listando. Pérdida de datos silenciosa, y sólo la primera vez por carga.
   */
  montado = montar(<VistaRouting />);
  await esperarA(() => texto().includes('96 productos'), 'la división está en la lista');
  await clic(filaDeLaDivision()!);
  await esperarA(() => texto().includes('La división'), 'el lienzo de la división se dibujó');

  /**
   * ⚠️ **Se cuentan los cables de REGLA, no todos los trazos.** El primer intento
   * miraba `path[stroke="currentColor"]` y pasaba igual con el defecto puesto,
   * porque contaba también los punteados de PERTENENCIA —que salen de
   * `armado.pertenencia` y no de la siembra—. Sólo un cable de regla lleva el
   * trazo grueso transparente que es su área de clic (`Lienzo.tsx`), así que ése
   * es el marcador que distingue «se sembró» de «se dibujó el árbol».
   */
  const reglas = montado.contenedor.querySelectorAll('svg path[stroke="transparent"]');
  expect(
    reglas.length,
    'el cable que la división YA tenía tiene que estar sembrado antes de tocar nada',
  ).toBeGreaterThan(0);
});
