import { describe, expect, it } from 'vitest';
import { paramDeHoy } from './conversaciones';

/**
 * 🔴 «HOY» ES EL DE LA VENDEDORA: SU MEDIANOCHE, NO EL INSTANTE.
 *
 * El server cuenta `nacioHoy` contra lo que le manda el navegador (#421: el hoy
 * de quien mira no es el del server). Con `new Date()` crudo cada pedido diría
 * «hoy empezó hace un segundo» y `nacioHoy` daría siempre cero; con la
 * medianoche local, todos los pedidos de un día preguntan lo mismo y el del día
 * siguiente pregunta otra cosa.
 */

const leer = (p: string) => new Date(new URLSearchParams(p.replace(/^&/, '')).get('inicioDeHoy') ?? '');

describe('paramDeHoy — desde cuándo es «hoy» para quien mira', () => {
  it('es la medianoche LOCAL del día en que se mira', () => {
    const inicio = leer(paramDeHoy(new Date(2026, 8, 10, 15, 42)));
    expect([inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), inicio.getHours(), inicio.getMinutes()]).toEqual([
      2026, 8, 10, 0, 0,
    ]);
  });

  it('🔴 dos momentos del mismo día preguntan lo MISMO: nunca «hoy empezó hace un segundo»', () => {
    expect(paramDeHoy(new Date(2026, 8, 10, 0, 1))).toBe(paramDeHoy(new Date(2026, 8, 10, 23, 59)));
  });

  it('al pasar la medianoche cambia: el «hoy» de ayer no se sirve de la caché', () => {
    expect(paramDeHoy(new Date(2026, 8, 10, 23, 59))).not.toBe(paramDeHoy(new Date(2026, 8, 11, 0, 1)));
  });
});
