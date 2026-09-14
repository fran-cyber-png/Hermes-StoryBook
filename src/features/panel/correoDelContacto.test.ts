import { describe, expect, it } from 'vitest';
import { correoDelContacto } from './identidad';

/**
 * UN CORREO, CON SU FUENTE — la precedencia que vivía adentro de `QuienEs.tsx`
 * y que desde que la pestaña «Datos» se fue (dueño, 13-sep-2026) la usa la
 * cabecera. Sale a una función para que no quede escrita en un componente.
 */
describe('correoDelContacto', () => {
  const LEAD = { email: 'lead@x.com', fuente: 'web' } as const;

  it('lo anotado por el equipo gana sobre todo lo demás', () => {
    expect(
      correoDelContacto({ anotado: 'anotado@x.com', cerberus: 'cerberus@x.com', icarus: 'icarus@x.com', lead: LEAD }),
    ).toEqual({ valor: 'anotado@x.com', fuente: 'anotado' });
  });

  it('sin anotado, Cerberus; sin Cerberus, icarus', () => {
    expect(correoDelContacto({ anotado: null, cerberus: 'cerberus@x.com', icarus: 'icarus@x.com', lead: LEAD })).toEqual({
      valor: 'cerberus@x.com',
      fuente: 'Cerberus',
    });
    expect(correoDelContacto({ anotado: '', cerberus: '', icarus: 'icarus@x.com', lead: LEAD })).toEqual({
      valor: 'icarus@x.com',
      fuente: 'de icarus',
    });
  });

  it('el formulario es el último, y dice de qué formulario vino', () => {
    const r = correoDelContacto({ anotado: null, cerberus: null, icarus: null, lead: LEAD });
    expect(r.valor).toBe('lead@x.com');
    expect(r.fuente).toBeTruthy();
  });

  it('un correo de puros espacios no es un correo, y sin ninguno no hay nada', () => {
    expect(correoDelContacto({ anotado: '   ', cerberus: null, icarus: null, lead: null })).toEqual({ valor: '' });
  });
});
