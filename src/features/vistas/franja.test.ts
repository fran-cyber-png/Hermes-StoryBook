import { describe, expect, it } from 'vitest';
import {
  GRUPOS_DE_FRANJAS,
  limitesDe,
  pisoDelRango,
  rangoDeFechas,
  rotuloDeFranja,
  type PresetFranja,
} from './franja';

/**
 * LA FRANJA DE «NUNCA CONTESTARON», INTERROGADA SIN PIPELINE.
 *
 * Las fechas se construyen con el constructor LOCAL y nunca con ISO + `Z`: la
 * vendedora lee su agenda mirando el reloj de la pared, y un test escrito en UTC
 * diría una cosa en Lima y otra en el runner (el mismo motivo que
 * `agenda/fechas.test.ts` deja escrito, y el defecto que el issue #421 persigue).
 */

/** Jueves 20 de agosto de 2026, 15:47:33.512 — con segundos sucios a propósito. */
const AHORA = new Date(2026, 7, 20, 15, 47, 33, 512);

describe('limitesDe — los dos bordes de cada franja', () => {
  it('«Hoy» arranca en la medianoche local y no tiene borde de arriba', () => {
    const { desde, hasta } = limitesDe({ tipo: 'preset', id: 'hoy' }, AHORA);
    expect(desde).toEqual(new Date(2026, 7, 20, 0, 0, 0, 0));
    expect(hasta).toBeNull();
  });

  it('«Ayer» es un día ENTERO y termina donde empieza hoy', () => {
    const { desde, hasta } = limitesDe({ tipo: 'preset', id: 'ayer' }, AHORA);
    expect(desde).toEqual(new Date(2026, 7, 19, 0, 0, 0, 0));
    expect(hasta).toEqual(new Date(2026, 7, 20, 0, 0, 0, 0));
  });

  it('los relativos cuentan hacia atrás desde ahora', () => {
    const desdeDe = (id: PresetFranja) => limitesDe({ tipo: 'preset', id }, AHORA).desde;
    expect(desdeDe('m30')).toEqual(new Date(2026, 7, 20, 15, 17, 0, 0));
    expect(desdeDe('h3')).toEqual(new Date(2026, 7, 20, 12, 47, 0, 0));
    expect(desdeDe('d7')).toEqual(new Date(2026, 7, 13, 15, 47, 0, 0));
  });

  it('🔴 el `desde` se recorta al MINUTO: es lo que evita una consulta por render', () => {
    // Dos instantes del mismo minuto tienen que dar el MISMO borde, o la
    // queryKey del tablero cambiaría en cada repintado.
    const a = limitesDe({ tipo: 'preset', id: 'm15' }, new Date(2026, 7, 20, 15, 47, 1, 0));
    const b = limitesDe({ tipo: 'preset', id: 'm15' }, new Date(2026, 7, 20, 15, 47, 59, 999));
    expect(a.desde).toEqual(b.desde);
    expect(a.desde.getSeconds()).toBe(0);
    expect(a.desde.getMilliseconds()).toBe(0);
  });
});

describe('el menú que se ofrece', () => {
  it('🔴 no ofrece «Últimos 30 días»: sería el total de la columna', () => {
    // La cola mira 30 días (`consultarCola.ts`), así que ese preset devolvería
    // exactamente lo mismo que no filtrar — la regla del cero, del otro lado.
    const labels = GRUPOS_DE_FRANJAS.flatMap((g) => g.opciones.map((o) => o.label));
    expect(labels).not.toContain('Últimos 30 días');
    expect(labels).toContain('Últimos 7 días');
  });

  it('los tres menús son un solo eje: ningún id se repite entre grupos', () => {
    const ids = GRUPOS_DE_FRANJAS.flatMap((g) => g.opciones.map((o) => o.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(GRUPOS_DE_FRANJAS.map((g) => g.titulo)).toEqual(['Fecha', 'Hora', 'Minutos']);
  });

  it('sin franja el chip dice «Cuándo»; con franja dice cuál', () => {
    expect(rotuloDeFranja(null)).toBe('Cuándo');
    expect(rotuloDeFranja({ tipo: 'preset', id: 'm30' })).toBe('Últimos 30 minutos');
  });
});

describe('el rango a medida', () => {
  it('🔴 «del 18 al 18» es el día ENTERO, no una raya vacía', () => {
    const f = rangoDeFechas('2026-08-18', '2026-08-18');
    expect(f).not.toBeNull();
    expect(new Date(f!.tipo === 'rango' ? f!.desde : '')).toEqual(new Date(2026, 7, 18, 0, 0, 0, 0));
    expect(new Date(f!.tipo === 'rango' ? f!.hasta : '')).toEqual(new Date(2026, 7, 19, 0, 0, 0, 0));
  });

  it('un rango al revés no se pide: no hay nada que mostrar entre el jueves y el lunes', () => {
    expect(rangoDeFechas('2026-08-20', '2026-08-17')).toBeNull();
    expect(rangoDeFechas('', '2026-08-17')).toBeNull();
  });

  it('el calendario no deja pedir más atrás de lo que la cola mira', () => {
    // 20-ago menos 30 días = 21-jul. Más atrás no hay tarjetas en el tablero.
    expect(pisoDelRango(AHORA)).toBe('2026-07-21');
  });

  it('el rótulo de un rango de un solo día no repite la fecha dos veces', () => {
    const f = rangoDeFechas('2026-08-18', '2026-08-18')!;
    expect(rotuloDeFranja(f)).toBe('18 ago');
    const largo = rangoDeFechas('2026-08-18', '2026-08-20')!;
    expect(rotuloDeFranja(largo)).toBe('18 ago – 20 ago');
  });
});
