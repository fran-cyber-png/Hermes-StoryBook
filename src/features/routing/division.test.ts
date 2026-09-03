import { describe, expect, test } from 'vitest';
import { ID, cablesDeDivision, columnasDeDivision, leerId } from './piezas';

/**
 * CABLEAR UNA DIVISIÓN — el eje que hace que esto rinda.
 *
 * Medido contra el catálogo vivo de Cerberus el 24-ago-2026: **185 familias de
 * SKU y 3 divisiones**, y con tres reglas de división se cubren 244 de 244
 * productos. Lo que se fija acá es que la pantalla no rompa esa promesa: que la
 * división sea UNA regla y no un abanico, y que no se confunda con el producto.
 */

const DIVISION = { division: 'inteligencia', nombre: 'Inteligencia', familias: 58, productos: 96 };

const FAMILIAS = [
  { familia: 'dipicot', nombre: 'Inteligencia y Contrainteligencia', productos: 23, vendedoras: ['Luz'] },
  { familia: 'diposoc', nombre: 'OSINT & SOCMINT', productos: 4, vendedoras: [] },
];

const DESTINOS = ['Luz', 'Sindy'];

describe('los ids', () => {
  test('🔴 una FAMILIA como regla no comparte namespace con el PRODUCTO', () => {
    /**
     * Son dos cosas con el mismo nombre y distinto comportamiento:
     * `prod:dipicot` se abre en abanico y escribe un cable por pieza;
     * `fam:dipicot` es UNA fila de `producto_ruteo`. Con un solo prefijo, el
     * mismo gesto escribiría en la tabla equivocada según desde dónde lo hagas
     * — y no daría error.
     */
    expect(ID.familia('dipicot')).not.toBe(ID.producto('dipicot'));
    expect(leerId(ID.familia('dipicot'))).toEqual({ tipo: 'fam', clave: 'dipicot' });
    expect(leerId(ID.division('inteligencia'))).toEqual({ tipo: 'div', clave: 'inteligencia' });
  });
});

describe('las columnas', () => {
  const { columnas, pertenencia } = columnasDeDivision(DIVISION, FAMILIAS, DESTINOS);

  test('son tres: la división, lo que le entra, y las vendedoras', () => {
    expect(columnas.map((c) => c.id)).toEqual(['division', 'familias', 'vendedoras']);
  });

  test('la división dice cuánto cubre — es el dato que justifica cablearla', () => {
    expect(columnas[0]!.nodos[0]!.pie).toBe('58 familias · 96 productos');
    expect(columnas[0]!.nodos[0]!.salida).toBe(true);
  });

  test('🔴 sus familias cuelgan por PERTENENCIA, no por regla', () => {
    /**
     * Dibujarlas como reglas haría creer que hay 58 cables que alguien puso y
     * que se pueden cortar de a uno, cuando lo que hay es UNA regla y una
     * herencia por la cascada.
     */
    expect(pertenencia).toHaveLength(2);
    expect(pertenencia.every((c) => c.tipo === 'pertenencia')).toBe(true);
    expect(pertenencia.map((c) => c.a)).toEqual([ID.familia('dipicot'), ID.familia('diposoc')]);
  });

  test('una familia igual puede cablearse aparte: tiene entrada y salida', () => {
    // Es el afinado: la división da el default y la familia lo pisa donde no
    // sirve. Sin salida propia, el segundo eje no existiría.
    expect(columnas[1]!.nodos[0]!.salida).toBe(true);
    expect(columnas[1]!.nodos[0]!.entrada).toBe(true);
  });
});

describe('los cables', () => {
  test('la regla de la división sale de su nodo', () => {
    const cables = cablesDeDivision({ division: 'inteligencia', vendedoras: ['Sindy'] }, [], DESTINOS);
    expect(cables).toEqual([
      { de: 'div:inteligencia', a: 'v:Sindy', tipo: 'regla', color: 'producto' },
    ]);
  });

  test('y las de cada familia, del suyo', () => {
    const cables = cablesDeDivision({ division: 'inteligencia', vendedoras: [] }, FAMILIAS, DESTINOS);
    expect(cables).toEqual([{ de: 'fam:dipicot', a: 'v:Luz', tipo: 'regla', color: 'producto' }]);
  });

  test('🔴 el destino se resuelve NORMALIZANDO, y usa la grafía de la columna', () => {
    /**
     * Regla dura #4. El cable guardado puede decir `luz` y el nodo llamarse
     * `v:Luz`: sin normalizar, el cable apunta a un nodo que no existe — no se
     * dibuja, no se puede cortar, y la fila de la izquierda igual dice que esa
     * división es de alguien. Sin error y sin log.
     */
    const cables = cablesDeDivision({ division: 'inteligencia', vendedoras: ['LUZ'] }, [], DESTINOS);
    expect(cables[0]!.a).toBe('v:Luz');
  });

  test('🔴 un cable hacia alguien que no está en los destinos se DESCARTA', () => {
    // Dibujarlo obligaría a inventarle un nodo, y ese nodo sería una persona que
    // la pantalla ofrece y el server rechaza con 409.
    const cables = cablesDeDivision({ division: 'inteligencia', vendedoras: ['darian'] }, [], DESTINOS);
    expect(cables).toEqual([]);
  });
});

describe('quien se fue del equipo', () => {
  test('🔴 se MARCA en la columna, y sigue estando', () => {
    /**
     * Sacarla de la lista haría desaparecer los cables que YA apuntan a ella, y
     * nadie podría verlos para cortarlos: Tracy tenía tres en `curso_ruteo` y se
     * llevaba ~32 leads al mes. Lo que hacía invisible ese defecto era
     * justamente que nada en la pantalla la distinguía del resto.
     */
    const { columnas } = columnasDeDivision(DIVISION, FAMILIAS, ['Luz', 'Tracy'], ['tracy']);
    const vendedoras = columnas[2]!.nodos;

    expect(vendedoras.map((n) => n.id)).toEqual(['v:Luz', 'v:Tracy']);
    expect(vendedoras.find((n) => n.id === 'v:Tracy')?.pie).toBe('dada de baja');
    expect(vendedoras.find((n) => n.id === 'v:Luz')?.pie).toBeUndefined();
  });

  test('🔴 la grafía no importa: `tracy` de la tabla marca a `Tracy` de la columna', () => {
    // Regla dura #4. Comparar exacto no daría error: daría que el aviso no
    // aparece nunca, o sea una protección que se ve puesta y no protege.
    const { columnas } = columnasDeDivision(DIVISION, FAMILIAS, ['Tracy'], ['  TRACY ']);
    expect(columnas[2]!.nodos[0]!.pie).toBe('dada de baja');
  });

  test('sin el dato no se marca a nadie — mejor que marcar mal', () => {
    // `deBaja` es opcional: ausente = server viejo o caché rehidratado (ADR 0007).
    const { columnas } = columnasDeDivision(DIVISION, FAMILIAS, ['Luz', 'Tracy']);
    expect(columnas[2]!.nodos.every((n) => n.pie === undefined)).toBe(true);
  });
});
