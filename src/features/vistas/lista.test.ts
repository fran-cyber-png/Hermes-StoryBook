import { describe, expect, test } from 'vitest';
import type { EtapaTrabajo, Recorte, TarjetaTablero } from './tablero';
import { filasDeLista, filtrarPorAsignada, opcionesDeAsignada, SIN_ASIGNAR } from './lista';

/**
 * LA LISTA DEL PIPELINE — qué filas hay y cómo se filtran por dueña, sin DOM.
 *
 * La Lista es el MISMO tablero dicho en filas: lo cargado de las cinco columnas,
 * con los mismos recortes. Si la Lista y el Tablero mostraran conjuntos distintos
 * con los mismos filtros puestos, cambiar de vista cambiaría la respuesta.
 */

type Tarjeta = TarjetaTablero & { asignada_a?: string | null };

const columnas: { id: EtapaTrabajo }[] = [{ id: 'interesado' }, { id: 'contactado' }, { id: 'cotizado' }];
const repartidas = new Map<EtapaTrabajo, Tarjeta[]>([
  ['interesado', [{ clave: 'a', luz: 'verde' }, { clave: 'b', luz: 'gris' }]],
  ['contactado', [{ clave: 'c', luz: 'verde' }]],
  ['cotizado', [{ clave: 'd' }]],
]);
const claves = (filas: { c: Tarjeta }[]) => filas.map((f) => f.c.clave);

describe('filasDeLista — el tablero, dicho en filas', () => {
  test('una fila por tarjeta, en el orden de las columnas, con su etapa', () => {
    expect(filasDeLista(columnas, repartidas, () => 'todas').map((f) => [f.c.clave, f.etapa])).toEqual([
      ['a', 'interesado'],
      ['b', 'interesado'],
      ['c', 'contactado'],
      ['d', 'cotizado'],
    ]);
  });

  test('🔴 el recorte de luz de la mesa aplica igual que en el tablero — y sin `luz` cuenta como gris', () => {
    expect(claves(filasDeLista(columnas, repartidas, () => 'verde'))).toEqual(['a', 'c']);
    expect(claves(filasDeLista(columnas, repartidas, () => 'gris'))).toEqual(['b', 'd']);
  });

  test('cada columna con SU recorte, como en el tablero', () => {
    const recorteDe = (e: EtapaTrabajo): Recorte => (e === 'interesado' ? 'gris' : 'todas');
    expect(claves(filasDeLista(columnas, repartidas, recorteDe))).toEqual(['b', 'c', 'd']);
  });
});

describe('filtrarPorAsignada — el filtro de quien supervisa', () => {
  const filas = [
    { c: { clave: '1', asignada_a: 'Luz' } },
    { c: { clave: '2', asignada_a: ' luz' } },
    { c: { clave: '3', asignada_a: null } },
    { c: { clave: '4', asignada_a: 'sindy.rojas' } },
  ];

  test('sin filtro, todas', () => {
    expect(claves(filtrarPorAsignada(filas, ''))).toEqual(['1', '2', '3', '4']);
  });

  test('🔴 por vendedora, normalizando los DOS lados: «Luz» y « luz» son la misma persona (candado 4)', () => {
    expect(claves(filtrarPorAsignada(filas, 'luz'))).toEqual(['1', '2']);
    expect(claves(filtrarPorAsignada(filas, 'LUZ '))).toEqual(['1', '2']);
  });

  test('«Sin asignar» trae las que no tienen dueña', () => {
    expect(claves(filtrarPorAsignada(filas, SIN_ASIGNAR))).toEqual(['3']);
  });

  test('las opciones salen de lo cargado, una por persona, con su cuenta y «Sin asignar» primero', () => {
    expect(opcionesDeAsignada(filas)).toEqual([
      { valor: SIN_ASIGNAR, rotulo: 'Sin asignar', n: 1 },
      { valor: 'luz', rotulo: 'Luz', n: 2 },
      { valor: 'sindy.rojas', rotulo: 'Sindy', n: 1 },
    ]);
  });

  test('sin ninguna sin dueña, «Sin asignar» no se ofrece: sería una opción que vacía la lista', () => {
    expect(opcionesDeAsignada(filas.filter((f) => f.c.asignada_a)).map((o) => o.valor)).not.toContain(SIN_ASIGNAR);
  });
});
