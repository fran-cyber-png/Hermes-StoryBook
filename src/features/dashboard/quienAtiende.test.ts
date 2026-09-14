import { describe, expect, it } from 'vitest';
import { nombreDeOperador, operadorSinAlta } from './campana';

/**
 * 🔴 LOS CASOS SON LOS DE PRODUCCIÓN, medidos el 4-sep-2026 sobre la línea de
 * Betto: `centurion:usuario4` (280 envíos), `centurion:job.meneses` (59) y `bot`
 * (49). El bloque los mostraba crudos y el dueño reportó que «no está jalando
 * bien quién atiende» — los números estaban bien, lo que faltaba era el nombre.
 */
describe('cómo se llama quien atiende', () => {
  it('usa el nombre de `equipo` cuando lo hay', () => {
    expect(nombreDeOperador({ operador: 'centurion:usuario1', nombre: 'Andrea' })).toBe('Andrea');
    expect(nombreDeOperador({ operador: 'centurion:job.meneses', nombre: 'Job Meneses' })).toBe('Job Meneses');
  });

  it('sin alta, cae al id SIN el prefijo del namespace', () => {
    // `centurion:` dice de qué sistema viene la credencial, no quién es — y en
    // este panel todos vienen del mismo, así que es ruido repetido en cada fila.
    expect(nombreDeOperador({ operador: 'centurion:usuario4', nombre: null })).toBe('usuario4');
    expect(nombreDeOperador({ operador: 'centurion:job.meneses', nombre: null })).toBe('job.meneses');
  });

  it('un id sin namespace se muestra tal cual — `bot` manda envíos y no está en equipo', () => {
    expect(nombreDeOperador({ operador: 'bot', nombre: null })).toBe('bot');
  });

  it('🔴 NUNCA devuelve vacío: una fila sin etiqueta con 280 envíos al lado es peor que una fea', () => {
    expect(nombreDeOperador({ operador: 'centurion:', nombre: null })).toBe('centurion:');
    expect(nombreDeOperador({ operador: 'x', nombre: '   ' })).toBe('x');
  });

  it('⚠️ no inventa un nombre bonito a partir del id', () => {
    // Convertir «usuario4» en «Usuario 4» sugeriría que el sistema sabe quién
    // es, y escondería lo que hay que arreglar: que le falta el alta.
    expect(nombreDeOperador({ operador: 'centurion:usuario4', nombre: null })).not.toBe('Usuario 4');
  });

  it('marca a quien le falta el alta, en vez de disimularlo', () => {
    expect(operadorSinAlta({ nombre: null })).toBe(true);
    expect(operadorSinAlta({ nombre: '  ' })).toBe(true);
    expect(operadorSinAlta({ nombre: 'Andrea' })).toBe(false);
  });
});
