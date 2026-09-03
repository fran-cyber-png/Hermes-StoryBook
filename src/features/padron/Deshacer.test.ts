import { describe, expect, test } from 'vitest';
import { esVieja, todoOmitido } from './Deshacer';

/**
 * `todoOmitido` y `esVieja` son las dos preguntas que deciden qué TEXTO se
 * muestra — un candado acá evita el mismo tipo de defecto mudo que ya pasó
 * con las facetas de la galería (#37): una regla de negocio sin test que la
 * cruce diverge del comportamiento pensado sin que nada se ponga rojo.
 */

describe('todoOmitido', () => {
  test('todo se movió después: total y omitidos coinciden, y hay algo', () => {
    expect(todoOmitido({ total: 470, omitidosPorCambioPosterior: 470 })).toBe(true);
  });

  test('nada se movió después: omitidos en 0', () => {
    expect(todoOmitido({ total: 470, omitidosPorCambioPosterior: 0 })).toBe(false);
  });

  test('parcial: coinciden en 0 pero no hay tanda — no es "todo omitido", es "no hubo nada"', () => {
    expect(todoOmitido({ total: 0, omitidosPorCambioPosterior: 0 })).toBe(false);
  });

  test('sin datos, false — nunca inventar una tanda que no vino', () => {
    expect(todoOmitido(undefined)).toBe(false);
    expect(todoOmitido({})).toBe(false);
  });
});

describe('esVieja', () => {
  test('recién repartido, no es vieja', () => {
    expect(esVieja(new Date(Date.now() - 5 * 60_000).toISOString())).toBe(false);
  });

  test('de hace 23 h, todavía no es vieja', () => {
    expect(esVieja(new Date(Date.now() - 23 * 3_600_000).toISOString())).toBe(false);
  });

  test('de hace 24 h o más, es vieja — el corte es el borde exacto', () => {
    expect(esVieja(new Date(Date.now() - 24 * 3_600_000).toISOString())).toBe(true);
  });

  test('de ayer, es vieja', () => {
    expect(esVieja(new Date(Date.now() - 30 * 3_600_000).toISOString())).toBe(true);
  });
});
