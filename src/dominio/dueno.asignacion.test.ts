import { describe, expect, it } from 'vitest';
import { marcaDeAsignacion } from './dueno';

/**
 * «¿A QUIÉN ESTÁ ASIGNADA?» PARA QUIEN SUPERVISA — la otra cara de `marcaDeDueno`.
 *
 * `marcaDeDueno` calla «sin dueño» a propósito: en la cola de una vendedora es el
 * estado más aburrido que hay, y una píldora en 1.900 filas es ruido. Para quien
 * SUPERVISA es al revés (pedido del dueño, 10-sep-2026: «para un supervisor es
 * imprescindible ver a quién está asignado»), y medido ese día `asignada_a` viene
 * vacío en casi toda la mesa salvo «Compraron» (45 %): «Sin asignar» es la
 * mayoría, y callarlo esconde justo lo que se vino a mirar.
 */
describe('marcaDeAsignacion — la marca de quien supervisa', () => {
  it('con dueña dice su nombre corto, y el username entero va al title', () => {
    expect(marcaDeAsignacion({ asignada_a: 'sindy.rojas' })).toEqual({
      asignada: true,
      texto: 'Sindy',
      titulo: 'Asignada a sindy.rojas',
    });
  });

  it('🔴 sin dueña dice «Sin asignar»: nunca un hueco, que se leería como un dato que no cargó', () => {
    for (const asignada_a of [null, undefined, '', '   ']) {
      expect(marcaDeAsignacion({ asignada_a }), String(asignada_a)).toEqual({
        asignada: false,
        texto: 'Sin asignar',
        titulo: 'Nadie la tiene asignada todavía',
      });
    }
  });
});
