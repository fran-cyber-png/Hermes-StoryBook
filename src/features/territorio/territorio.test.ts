import { describe, expect, it } from 'vitest';
import { conteoDelDistritoActual, lecturaDeTerritorio, type RespuestaTerritorio } from './territorio';

const CATALOGO = [
  { id: 1, nombre: 'Ate', zona: null, orden: 0 },
  { id: 2, nombre: 'Comas', zona: 'Lima Norte', orden: 0 },
];

const respuesta = (v: Partial<RespuestaTerritorio> = {}): RespuestaTerritorio => ({
  distritos: CATALOGO,
  conteos: {},
  ...v,
});

/**
 * 🔴 Desde ADR 0088 anotar ya NO depende del catálogo: la operadora marca una
 * dirección en el mapa aunque la campaña no tenga un solo distrito cargado —
 * el catálogo sólo clasifica sola en segundo plano. El único vacío que sigue
 * bloqueando es no tener línea de campaña asignada.
 */
describe('qué se lee en el bloque de territorio', () => {
  it('sin línea asignada lo dice, y no ofrece anotar', () => {
    const r = lecturaDeTerritorio(respuesta({ sinLinea: true, distritos: [] }));
    expect(r.puedeAnotar).toBe(false);
    expect(r.vacio).toContain('línea');
  });

  it('con línea y SIN catálogo igual se puede anotar (el mapa no necesita catálogo)', () => {
    const r = lecturaDeTerritorio(respuesta({ sinCatalogo: true, distritos: [] }));
    expect(r.puedeAnotar).toBe(true);
    expect(r.vacio).toBeNull();
  });

  it('con catálogo se puede anotar y no se dibuja ningún vacío', () => {
    const r = lecturaDeTerritorio(respuesta());
    expect(r.puedeAnotar).toBe(true);
    expect(r.vacio).toBeNull();
  });

  it('⚠️ mientras carga no ofrece nada Y no afirma que falte algo', () => {
    // Con `undefined` (todavía sin respuesta) un `vacio` haría parpadear «esta
    // campaña no tiene distritos» en cada ficha que se abre.
    const r = lecturaDeTerritorio(undefined);
    expect(r.puedeAnotar).toBe(false);
    expect(r.vacio).toBeNull();
  });

  it('un catálogo vacío SIN banderas ya no bloquea (server viejo que no manda sinCatalogo)', () => {
    expect(lecturaDeTerritorio(respuesta({ distritos: [] })).puedeAnotar).toBe(true);
  });
});

/**
 * EL CONTADOR "N ACÁ" — sólo se dibuja cuando el auto-match encontró un
 * distrito de catálogo parecido a la dirección anotada (ADR 0088). Sin
 * match, `null`: no es un error, es una dirección que no cayó ahí.
 */
describe('el conteo del distrito de esta conversación', () => {
  it('lo resuelve contra los conteos, por el distrito que matcheó solo', () => {
    const r = respuesta({
      conteos: { '2': 5 },
      actual: {
        distritoId: 2,
        direccion: 'Jr. Lima 123, Comas',
        ubicacion: 'Comas, Lima',
        lat: -11.9,
        lon: -77.05,
        anotadoPor: 'x',
      },
    });
    expect(conteoDelDistritoActual(r)).toBe(5);
  });

  it('sin anotar es null', () => {
    expect(conteoDelDistritoActual(respuesta({ actual: null }))).toBeNull();
    expect(conteoDelDistritoActual(respuesta())).toBeNull();
  });

  it('una dirección anotada que no matcheó ningún distrito es null, no un error', () => {
    const r = respuesta({
      actual: {
        distritoId: null,
        direccion: 'Un lugar fuera del catálogo',
        ubicacion: null,
        lat: 0,
        lon: 0,
        anotadoPor: 'x',
      },
    });
    expect(conteoDelDistritoActual(r)).toBeNull();
  });

  it('un distrito matcheado sin entrada en conteos cuenta 0, no null', () => {
    const r = respuesta({
      conteos: {},
      actual: {
        distritoId: 1,
        direccion: 'Jr. Ate 1',
        ubicacion: 'Comas, Lima',
        lat: -12,
        lon: -76.9,
        anotadoPor: 'x',
      },
    });
    expect(conteoDelDistritoActual(r)).toBe(0);
  });
});
