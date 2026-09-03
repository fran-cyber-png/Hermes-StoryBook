import { describe, expect, test } from 'vitest';
import { temperaturaDeEntrada, UMBRAL_ENTRADA_DIAS } from './temperaturaEntrada';

const AHORA = new Date('2026-08-24T12:00:00.000Z');

function hace(dias: number): string {
  return new Date(AHORA.getTime() - dias * 86_400_000).toISOString();
}

describe('temperaturaDeEntrada', () => {
  test('sin fecha, null — nunca una antigüedad inventada', () => {
    expect(temperaturaDeEntrada(null, AHORA)).toBeNull();
    expect(temperaturaDeEntrada(undefined, AHORA)).toBeNull();
  });

  test('una fecha ilegible, null', () => {
    expect(temperaturaDeEntrada('no es una fecha', AHORA)).toBeNull();
  });

  test('recién entrado, fresco', () => {
    expect(temperaturaDeEntrada(hace(0), AHORA)).toBe('fresco');
    expect(temperaturaDeEntrada(hace(UMBRAL_ENTRADA_DIAS.tibio - 1), AHORA)).toBe('fresco');
  });

  test('los tres cortes son el borde exacto, no un día antes ni un día después', () => {
    expect(temperaturaDeEntrada(hace(UMBRAL_ENTRADA_DIAS.tibio), AHORA)).toBe('tibio');
    expect(temperaturaDeEntrada(hace(UMBRAL_ENTRADA_DIAS.frio), AHORA)).toBe('frio');
    expect(temperaturaDeEntrada(hace(UMBRAL_ENTRADA_DIAS.helado), AHORA)).toBe('helado');
  });

  test('de años, helado', () => {
    expect(temperaturaDeEntrada(hace(365 * 2), AHORA)).toBe('helado');
  });
});
