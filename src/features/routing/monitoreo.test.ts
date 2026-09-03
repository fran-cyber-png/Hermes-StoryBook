import { describe, expect, test } from 'vitest';
import { resumen } from './Monitoreo';
import { explicarMotivo } from './routing';
import type { LoQueCayo } from './routing';

/**
 * EL RESUMEN DE LA FRANJA — la pregunta de portada del monitoreo.
 *
 * Lo que se fija: que agrupe por MOTIVO (que es lo que contesta «¿el ruteo que
 * configuré se está aplicando?») y que un motivo desconocido no se disfrace del
 * más parecido.
 */

function f(motivo: string, vendedoraId: string, conversaciones: number): LoQueCayo {
  return { motivo, vendedoraId, conversaciones, ultima: null };
}

describe('el resumen', () => {
  test('agrupa por motivo, sumando las personas', () => {
    // La pregunta es «¿por dónde entró?», no «¿a quién le tocó?». Por persona
    // contesta otra cosa —el reparto— y para eso está el detalle.
    expect(resumen([f('producto', 'luz', 4), f('producto', 'sindy', 6), f('round-robin', 'darian', 2)]))
      .toBe('10 por el producto · 2 por la rueda');
  });

  test('ordena por peso: primero lo que más entró', () => {
    expect(resumen([f('round-robin', 'a', 2), f('division', 'b', 9)]))
      .toBe('9 por la división · 2 por la rueda');
  });

  test('corta en tres: una franja no es una tabla', () => {
    const cayo = [
      f('producto', 'a', 5),
      f('division', 'b', 4),
      f('campana', 'c', 3),
      f('round-robin', 'd', 2),
      f('linea', 'e', 1),
    ];
    expect(resumen(cayo).split(' · ')).toHaveLength(3);
  });

  test('sin nada devuelve vacío, y la franja entera se calla', () => {
    /**
     * 🔴 «0 conversaciones» es una afirmación sobre el NEGOCIO —«no está
     * entrando nadie»— cuando lo que puede estar pasando es que la migración no
     * corrió, que la línea cambió, o que quien mira sólo ve lo suyo. Tres causas
     * opuestas con el mismo cartel.
     */
    expect(resumen([])).toBe('');
  });
});

describe('el motivo en criollo', () => {
  test('los cinco niveles de la cascada tienen su nombre', () => {
    expect(explicarMotivo('campana')).toBe('por la campaña');
    expect(explicarMotivo('producto')).toBe('por el producto');
    expect(explicarMotivo('division')).toBe('por la división');
    expect(explicarMotivo('linea')).toBe('por la línea');
    expect(explicarMotivo('round-robin')).toBe('por la rueda');
  });

  test('🔴 un motivo desconocido NO se mapea al más parecido', () => {
    // En producción hay 25 filas con `historico-campana`. Llamarlas «por la
    // campaña» sería afirmar que las ruteó una regla que nadie puso.
    expect(explicarMotivo('historico-campana')).toBe('no se sabe');
    expect(explicarMotivo('')).toBe('no se sabe');
    expect(explicarMotivo(null)).toBe('no se sabe');
  });

  test('lo hecho a mano se distingue de lo repartido', () => {
    expect(explicarMotivo('manual')).toBe('a mano');
  });
});
