import { describe, expect, test } from 'vitest';
import { cifra, fechaCorta } from './formato';

/**
 * LA FECHA Y LA CIFRA DE UNA TABLA — lo que dice el docblock, y no lo que ICU
 * decida ese día.
 *
 * El docblock de `fechaCorta` promete «12 mar 2026», y la referencia del
 * rediseño de Contactos (10-sep-2026) pide «9 sep 2026». Con
 * `toLocaleDateString('es')` septiembre sale «sept», y la columna de fechas
 * deja de alinear justo en el mes en que se miró.
 */
describe('fechaCorta', () => {
  test('septiembre se abrevia «sep», como los otros once meses, en tres letras', () => {
    expect(fechaCorta('2026-09-09T12:00:00')).toBe('9 sep 2026');
  });

  test('el resto de los meses, sin punto y en minúscula', () => {
    expect(fechaCorta('2026-03-12T12:00:00')).toBe('12 mar 2026');
    expect(fechaCorta('2026-05-01T12:00:00')).toBe('1 may 2026');
    expect(fechaCorta('2026-12-31T12:00:00')).toBe('31 dic 2026');
  });

  test('lo que no parsea vuelve tal cual', () => {
    expect(fechaCorta('ayer')).toBe('ayer');
  });
});

/**
 * 🔴 «7025» AL LADO DE «73.200», EN LA MISMA FRANJA — medido en la captura de
 * antes del rediseño: `toLocaleString('es')` no agrupa por debajo de 10.000
 * (regla de CLDR para el español), así que una fila de conteos mezclaba cifras
 * con punto y sin punto.
 */
describe('cifra', () => {
  test('agrupa también las de cuatro dígitos', () => {
    expect(cifra(7025)).toBe('7.025');
    expect(cifra(1464)).toBe('1.464');
  });

  test('las de cinco y las de tres, como siempre', () => {
    expect(cifra(73200)).toBe('73.200');
    expect(cifra(850)).toBe('850');
  });
});
