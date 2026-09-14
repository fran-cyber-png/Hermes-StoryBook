import { describe, expect, it } from 'vitest';
import { ErrorApi } from '../../lib/datos/cliente';
import { LIMITE_TEXTO } from './notas';
import { motivoDelFallo, renglonDeEstado, type EstadoGuardado } from './guardado';

/**
 * EL DEFECTO, ESCRITO COMO REGLA.
 *
 * La Libreta tenía esto en el JSX:
 *
 *     {guardando ? 'Guardando…' : paginaAbierta?.editadoAt ? 'Guardado' : ''}
 *
 * Sin rama de error, y con `editadoAt` mandando: **después de un 400 la barra
 * volvía a decir «Guardado»**. Un ternario adentro del JSX no se puede
 * interrogar sobre el caso que no existe, así que el defecto era invisible para
 * cualquier test. Acá la regla se puede escribir, y es una sola:
 *
 *     un fallo sin resolver le gana a TODO.
 */

const FALLO: EstadoGuardado = { tipo: 'fallo', motivo: 'No se guardó: pasa de los 2000 caracteres' };

/** Un `editadoAt` de hace `min` minutos, como ISO string — lo que trae `Nota.editadoAt`. */
const editadoHaceMin = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

describe('qué dice el renglón de estado', () => {
  it('🔴 un fallo le gana a «Guardado», aunque la página ya se haya editado', () => {
    const r = renglonDeEstado(FALLO, editadoHaceMin(5));
    expect(r.hayFallo).toBe(true);
    expect(r.texto).toBe(FALLO.motivo);
    expect(r.texto).not.toContain('Guardado');
  });

  it('🔴 y le gana también en una página nueva', () => {
    expect(renglonDeEstado(FALLO, null).hayFallo).toBe(true);
  });

  it('mientras guarda lo dice', () => {
    expect(renglonDeEstado({ tipo: 'guardando' }, editadoHaceMin(5)).texto).toBe('Guardando…');
    expect(renglonDeEstado({ tipo: 'guardando' }, editadoHaceMin(5)).hayFallo).toBe(false);
  });

  it('guardado bien (el instante justo después del autoguardado) dice «recién»', () => {
    // No `hace(editadoAt)` acá a propósito: `editadoAt` puede no haber llegado
    // todavía al caché en ese mismo render (ver el docblock de `guardado.ts`).
    expect(renglonDeEstado({ tipo: 'guardado' }, null).texto).toBe('Guardado · recién');
  });

  it('una página ya editada que no se tocó dice CUÁNTO hace', () => {
    expect(renglonDeEstado({ tipo: 'quieto' }, editadoHaceMin(5)).texto).toBe('Guardado · hace 5 min');
  });

  it('una página editada hace menos de un minuto dice «recién»', () => {
    expect(renglonDeEstado({ tipo: 'quieto' }, editadoHaceMin(0)).texto).toBe('Guardado · recién');
  });

  it('una página nueva sin tocar no dice nada', () => {
    expect(renglonDeEstado({ tipo: 'quieto' }, null).texto).toBe('');
  });

  it('ningún estado de fallo puede salir sin marcar', () => {
    for (const motivo of ['x', 'No se guardó: se cerró tu sesión', '']) {
      expect(renglonDeEstado({ tipo: 'fallo', motivo }, editadoHaceMin(1)).hayFallo).toBe(true);
    }
  });
});

/**
 * EL MOTIVO TIENE QUE DECIR CUÁNTO RECORTAR.
 *
 * El server ya manda «la nota no puede superar los 2.000 caracteres (tiene
 * 2.431)», que trae el número exacto. Ese se prefiere sobre cualquier frase
 * nuestra: es la diferencia entre corregir y adivinar.
 */
describe('el motivo del fallo', () => {
  it('prefiere lo que explicó el server, con su número', () => {
    const e = new ErrorApi('la nota no puede superar los 2000 caracteres (tiene 2431)', 400);
    expect(motivoDelFallo(e)).toContain('2431');
  });

  it('un 400 sin explicación cae en el tope, que es lo que siempre es acá', () => {
    expect(motivoDelFallo(new ErrorApi('', 400))).toContain(String(LIMITE_TEXTO));
  });

  it('un 401 dice que se cerró la sesión, no que el texto está mal', () => {
    expect(motivoDelFallo(new ErrorApi('', 401))).toContain('sesión');
  });

  it('sin respuesta del server lo dice como lo que es: red', () => {
    expect(motivoDelFallo(new TypeError('Failed to fetch'))).toContain('servidor');
  });

  it('nunca devuelve algo que se pueda leer como «se guardó»', () => {
    for (const e of [new ErrorApi('x', 400), new ErrorApi('x', 500), new Error('?'), null]) {
      expect(motivoDelFallo(e).toLowerCase()).toContain('no se guardó');
    }
  });
});
