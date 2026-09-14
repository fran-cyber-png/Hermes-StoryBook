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

  /**
   * 🔴 13-SEP-2026 — EL +1 SE PARTÍA MAL: «+18 097 961 936» para una dominicana. El
   * código salía de «lo que sobra antes de los últimos 9», y en el plan de
   * numeración del +1 el local tiene 10. Desde que el número va grande en su propio
   * renglón de la cabecera, el error se lee a primera vista.
   */
  it('el +1 tiene código de un dígito y local de 10, que se agrupa 3-3-4', () => {
    expect(formatearTelefono('18097961936')).toBe('+1 809 796 1936');
    expect(formatearTelefono('12125550123')).toBe('+1 212 555 0123');
  });

  it('un local de 10 dígitos de un país conocido también se agrupa 3-3-4', () => {
    expect(formatearTelefono('525512345678')).toBe('+52 551 234 5678');
  });
});
