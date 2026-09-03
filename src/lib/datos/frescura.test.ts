import { describe, expect, it, vi } from 'vitest';
import { esFresca, hace, horasDesdeIngesta } from './frescura';

/**
 * 🔴 `horasDesdeIngesta` SE CALCULA AL LEER, NUNCA SE LEE DE UN CAMPO CACHEADO
 * (docs/plan-borrar-el-polling.md §6 PR 2). El server ya no manda un número de
 * horas: manda `ultimaIngesta`, una fecha cruda, y el front la resta contra
 * `Date.now()` en el momento de mostrarla — así el mismo cuerpo cacheado sigue
 * diciendo la verdad aunque el server lleve horas sirviéndolo sin cambiar.
 */
describe('horasDesdeIngesta', () => {
  it('sin ultimaIngesta, no se sabe', () => {
    expect(horasDesdeIngesta({ ultimaIngesta: null })).toBeNull();
  });

  it('se calcula contra AHORA, no contra un número guardado', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-22T12:00:00Z'));

    const f = { ultimaIngesta: new Date('2026-08-22T09:00:00Z').toISOString() };
    expect(horasDesdeIngesta(f)).toBeCloseTo(3, 5);

    // El mismo cuerpo, tres horas más tarde: el cálculo avanza aunque el dato
    // cacheado no haya cambiado un carácter.
    vi.setSystemTime(new Date('2026-08-22T15:00:00Z'));
    expect(horasDesdeIngesta(f)).toBeCloseTo(6, 5);

    vi.useRealTimers();
  });
});

describe('esFresca', () => {
  it('menos de 6 horas es fresca', () => {
    expect(esFresca(5.99)).toBe(true);
    expect(esFresca(0)).toBe(true);
  });

  it('6 horas o más ya no', () => {
    expect(esFresca(6)).toBe(false);
    expect(esFresca(24)).toBe(false);
  });

  it('sin dato, no se puede afirmar que esté fresca', () => {
    expect(esFresca(null)).toBe(false);
  });
});

describe('hace', () => {
  it('sigue aceptando horas ya calculadas — no cambió con este frente', () => {
    expect(hace(null)).toBe('nunca');
    expect(hace(0.5)).toBe('hace 30 min');
    expect(hace(3)).toBe('hace 3 horas');
    expect(hace(48)).toBe('hace 2 días');
  });
});
