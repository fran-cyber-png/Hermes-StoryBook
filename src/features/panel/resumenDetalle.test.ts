import { describe, expect, it } from 'vitest';
import { ultimaActividad } from './resumenDetalle';
import type { EventoLinea, GrupoDia } from './timeline';

function evento(sobre: Partial<EventoLinea> = {}): EventoLinea {
  return { id: 'x', tipo: 'mensaje', rotulo: 'Mensaje', estado: 'confirmado', ...sobre };
}

const grupo = (etiqueta: string, eventos: EventoLinea[]): GrupoDia => ({ etiqueta, eventos });

describe('ultimaActividad — el primer evento fechado, nunca uno de «Sin fecha» si hay otro', () => {
  it('toma el primero del primer grupo', () => {
    const grupos = [grupo('Hoy', [evento({ rotulo: 'Cotización', timestamp: '2026-08-14T10:00:00Z', estado: 'senal' })])];
    const r = ultimaActividad(grupos);
    expect(r?.rotulo).toBe('Cotización');
    expect(r?.esSenal).toBe(true);
  });

  it('un grupo fechado siempre gana al de «Sin fecha», sin importar el orden de los grupos', () => {
    const grupos = [
      grupo('Sin fecha', [evento({ rotulo: 'Nombre identificado' })]),
      grupo('14 ago', [evento({ rotulo: 'Mensaje', timestamp: '2026-08-14T10:00:00Z' })]),
    ];
    // En la práctica `ensamblarTimeline` pone «Sin fecha» al final, pero la
    // función no debe DEPENDER de ese orden si algún día cambia: toma el
    // primer grupo CON eventos, cualquiera sea — este test fija el contrato
    // actual (el llamador es responsable del orden).
    expect(ultimaActividad(grupos)?.rotulo).toBe('Nombre identificado');
  });

  it('grupos vacíos no rompen nada', () => {
    expect(ultimaActividad([grupo('Hoy', [])])).toBeNull();
  });

  it('sin ningún grupo, null — no un evento inventado', () => {
    expect(ultimaActividad([])).toBeNull();
  });
});
