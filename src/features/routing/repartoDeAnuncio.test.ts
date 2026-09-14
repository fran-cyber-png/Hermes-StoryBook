import { describe, expect, it } from 'vitest';
import {
  escritoInicial,
  estadoDeLaSuma,
  leerEscrito,
  queGuardaria,
  repartirParejo,
  resumenDelReparto,
} from './repartoDeAnuncio';

describe('el editor del reparto de un anuncio (#1002)', () => {
  it('arranca con lo guardado, y quien tiene parte sin estar en los destinos igual aparece', () => {
    const { orden, escrito } = escritoInicial(['ana', 'luz', 'sindy'], [
      { vendedora: 'luz', porcentaje: 70 },
      { vendedora: 'tracy', porcentaje: 30 },
    ]);
    expect(orden).toEqual(['ana', 'luz', 'sindy', 'tracy']);
    expect(escrito).toEqual({ ana: '', luz: '70', sindy: '', tracy: '30' });
  });

  it('lo vacío y el cero no son una parte; lo que no es un entero de 0 a 100 se marca', () => {
    const r = leerEscrito(['ana', 'luz', 'sindy', 'tracy', 'walter'], {
      ana: '30',
      luz: ' 70 ',
      sindy: '',
      tracy: '0',
      walter: '33.5',
    });
    expect(r.partes).toEqual([
      { vendedora: 'ana', porcentaje: 30 },
      { vendedora: 'luz', porcentaje: 70 },
    ]);
    expect(r.invalidas).toEqual(['walter']);
  });

  /**
   * 🔴 LA DIVERGENCIA QUE ENCONTRÓ LA REVISIÓN. «00» pasaba la expresión de
   * dígitos y salía como una parte de 0 %, que el server rechaza con un 400
   * `cuerpo_invalido` — o sea, un botón prendido que devuelve un error que nadie
   * entiende. Cualquier forma de escribir cero es «a ésta no le toca nada».
   */
  it('«00» y «000» también son cero, no una parte de 0 %', () => {
    const r = leerEscrito(['ana', 'luz', 'sindy'], { ana: '00', luz: '100', sindy: '000' });
    expect(r.partes).toEqual([{ vendedora: 'luz', porcentaje: 100 }]);
    expect(r.invalidas).toEqual([]);
  });

  it('más partes que las que acepta el server no se guardan, y se dice por qué', () => {
    const orden = Array.from({ length: 21 }, (_, i) => `v${i}`);
    const escrito = Object.fromEntries(orden.map((v, i) => [v, i === 0 ? '80' : '1']));
    const plan = queGuardaria(leerEscrito(orden, escrito), []);
    expect(plan.accion).toBe('nada');
    expect(plan.bloqueo).toMatch(/20/);
  });

  it('dice cuánto falta y cuánto sobra, con esas palabras', () => {
    expect(estadoDeLaSuma([{ vendedora: 'ana', porcentaje: 30 }, { vendedora: 'luz', porcentaje: 50 }])).toEqual({
      suma: 80,
      tipo: 'falta',
      texto: 'Suma 80 % · faltan 20 %',
    });
    expect(estadoDeLaSuma([{ vendedora: 'ana', porcentaje: 60 }, { vendedora: 'luz', porcentaje: 50 }]).texto).toBe(
      'Suma 110 % · sobran 10 %',
    );
    expect(estadoDeLaSuma([{ vendedora: 'ana', porcentaje: 30 }, { vendedora: 'luz', porcentaje: 70 }]).tipo).toBe('justo');
    expect(estadoDeLaSuma([]).tipo).toBe('vacio');
  });

  /**
   * 🔴 LA DECISIÓN DEL DUEÑO, del lado de la pantalla: con otra suma que 100 no
   * hay botón que guarde. El server también lo rechaza, pero que la pantalla lo
   * deje intentar para después mostrar un 400 es enseñar a desconfiar del botón.
   */
  it('🔴 con 30 + 50 no guarda nada, y el motivo es lo que falta', () => {
    const lectura = leerEscrito(['ana', 'luz'], { ana: '30', luz: '50' });
    expect(queGuardaria(lectura, [])).toEqual({ accion: 'nada', bloqueo: 'Suma 80 % · faltan 20 %' });
  });

  it('con 30 + 70 guarda', () => {
    const lectura = leerEscrito(['ana', 'luz'], { ana: '30', luz: '70' });
    expect(queGuardaria(lectura, [])).toEqual({ accion: 'guardar' });
  });

  it('un valor que no es un porcentaje bloquea, aunque lo demás sume 100', () => {
    const lectura = leerEscrito(['ana', 'luz', 'sindy'], { ana: '30', luz: '70', sindy: 'abc' });
    expect(queGuardaria(lectura, []).accion).toBe('nada');
    expect(queGuardaria(lectura, []).bloqueo).toMatch(/sindy/);
  });

  it('guardar lo mismo que ya está no es una acción: el server no reiniciaría nada, y el botón no lo promete', () => {
    const lectura = leerEscrito(['ana', 'luz'], { ana: '30', luz: '70' });
    expect(queGuardaria(lectura, [{ vendedora: 'Luz', porcentaje: 70 }, { vendedora: 'ana', porcentaje: 30 }])).toEqual({
      accion: 'nada',
      bloqueo: 'Ya está guardado así.',
    });
  });

  it('vaciarlo todo con una regla guardada es QUITARLA; sin regla guardada no hay nada que hacer', () => {
    const vacio = leerEscrito(['ana', 'luz'], { ana: '', luz: '0' });
    expect(queGuardaria(vacio, [{ vendedora: 'luz', porcentaje: 100 }])).toEqual({ accion: 'quitar' });
    expect(queGuardaria(vacio, []).accion).toBe('nada');
  });

  it('repartir parejo da enteros que suman 100 exacto', () => {
    expect(repartirParejo(['ana', 'luz', 'sindy'])).toEqual([
      { vendedora: 'ana', porcentaje: 34 },
      { vendedora: 'luz', porcentaje: 33 },
      { vendedora: 'sindy', porcentaje: 33 },
    ]);
    for (let n = 1; n <= 12; n++) {
      const partes = repartirParejo(Array.from({ length: n }, (_, i) => `v${i}`));
      expect(partes.reduce((s, p) => s + p.porcentaje, 0)).toBe(100);
    }
    expect(repartirParejo([])).toEqual([]);
  });

  it('el resumen del renglón pone primero la parte más grande', () => {
    expect(
      resumenDelReparto(
        [{ vendedora: 'ana', porcentaje: 30 }, { vendedora: 'luz', porcentaje: 70 }],
        (v) => v.toUpperCase(),
      ),
    ).toBe('LUZ 70 % · ANA 30 %');
    expect(resumenDelReparto([], (v) => v)).toBe('');
  });
});
