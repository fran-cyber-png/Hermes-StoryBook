import { describe, expect, it } from 'vitest';
import { formatearTelefono } from './PanelDerecho';

/**
 * BUG DEL 25-AGO-2026: un local peruano de 9 dígitos SIN código de país
 * (`normalizarE164` no lo agrega si no estaba) se mostraba con los dos
 * primeros dígitos comidos, como si fueran un `51` que nunca llegó a escribirse.
 */
describe('formatearTelefono', () => {
  it('un local de 9 dígitos SIN código de país no pierde dígitos', () => {
    expect(formatearTelefono('998765423')).toBe('+51 998 765 423');
  });

  it('con código de país incluido (11 dígitos), lo separa bien', () => {
    expect(formatearTelefono('51998765423')).toBe('+51 998 765 423');
  });

  it('un código de país de más de 2 dígitos también se separa bien', () => {
    expect(formatearTelefono('502987654321')).toBe('+502 987 654 321');
  });

  it('menos de 8 dígitos: devuelve el crudo, no hay nada que formatear', () => {
    expect(formatearTelefono('12345')).toBe('12345');
  });
});
