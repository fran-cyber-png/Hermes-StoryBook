import { describe, test, expect } from 'vitest';
import { medioDeVenta } from './medioVenta';

describe('medioDeVenta — postventa gana (decisión del dueño, 8-sep-2026)', () => {
  test('ya compró y NO vino de anuncio → postventa', () => {
    expect(medioDeVenta({ vinoDeAnuncio: false, yaCompro: true })).toBe('postventa');
  });

  test('ya compró Y vino de un anuncio → postventa igual: postventa le gana a pagado', () => {
    expect(medioDeVenta({ vinoDeAnuncio: true, yaCompro: true })).toBe('postventa');
  });

  test('no compró antes y vino de un anuncio → pagado', () => {
    expect(medioDeVenta({ vinoDeAnuncio: true, yaCompro: false })).toBe('pagado');
  });

  test('no compró antes y no vino de un anuncio → orgánico', () => {
    expect(medioDeVenta({ vinoDeAnuncio: false, yaCompro: false })).toBe('organico');
  });
});
