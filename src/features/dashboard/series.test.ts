import { describe, expect, it } from 'vitest';
import { serieDeLeads } from './series';

/**
 * «LOS ÚLTIMOS 14 DÍAS» — la tira que se mudó de «Mi turno» a «El negocio» (ADR 0104).
 *
 * La cuenta vivía adentro de `VistaDashboard.tsx`, sin test. Al mudarla se saca pura:
 * qué dice cada columna al pasar el mouse y qué resume la tira.
 */

const dia = (i: number) => new Date(Date.UTC(2026, 7, 28 + i)).toISOString().slice(0, 10);

describe('serieDeLeads — la tira de los últimos 14 días', () => {
  it('suma chats, comentarios y formularios por día y los dice en palabras, sin los que dan cero', () => {
    const { puntos } = serieDeLeads([
      { dia: dia(0), chats: 9, comentarios: 1, formularios: 0 },
      { dia: dia(1), chats: 1, comentarios: 0, formularios: 2 },
      { dia: dia(2), chats: 0, comentarios: 0, formularios: 0 },
    ]);
    expect(puntos).toEqual([
      { dia: dia(0), total: 10, detalle: '9 chats · 1 comentario' },
      { dia: dia(1), total: 3, detalle: '1 chat · 2 formularios' },
      { dia: dia(2), total: 0, detalle: undefined },
    ]);
  });

  it('el resumen compara la última semana con la anterior', () => {
    const catorce = Array.from({ length: 14 }, (_, i) => ({ dia: dia(i), chats: i < 7 ? 2 : 3, comentarios: 0, formularios: 0 }));
    expect(serieDeLeads(catorce).resumen).toBe('Esta semana cayeron 21; la pasada, 14.');
  });
});
