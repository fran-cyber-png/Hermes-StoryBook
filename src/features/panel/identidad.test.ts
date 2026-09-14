import { describe, expect, it } from 'vitest';
import { nombreDelContacto } from './identidad';

describe('nombreDelContacto — el nombre real le gana al pushname', () => {
  it('con nada, no inventa un nombre', () => {
    expect(nombreDelContacto({})).toEqual({ principal: null, alias: null, fuente: 'ninguna' });
  });

  it('solo el pushname: es lo que hay, y no queda alias que repetir', () => {
    expect(nombreDelContacto({ pushname: 'MUMM-RA' })).toEqual({
      principal: 'MUMM-RA',
      alias: null,
      fuente: 'whatsapp',
    });
  });

  it('el nombre del formulario le gana al pushname basura, y el basura queda de alias', () => {
    expect(nombreDelContacto({ pushname: '🦋W', leadNombre: 'Javier Zeballos' })).toEqual({
      principal: 'Javier Zeballos',
      alias: '🦋W',
      fuente: 'formulario',
    });
  });

  it('Cerberus le gana al formulario: firmó una venta, no llenó un campo', () => {
    const n = nombreDelContacto({
      pushname: 'Alejandro Vila',
      leadNombre: 'Alejandro V.',
      cerberusNombre: 'DR EN DERECHO IGNACIO ALEJANDRO VILA CHÁVEZ',
    });
    expect(n.principal).toBe('DR EN DERECHO IGNACIO ALEJANDRO VILA CHÁVEZ');
    expect(n.fuente).toBe('cerberus');
    expect(n.alias).toBe('Alejandro Vila');
  });

  it('si el pushname es el mismo nombre, no se repite abajo — solo cambia el tamaño de letra', () => {
    expect(nombreDelContacto({ pushname: 'javier  zeballos', leadNombre: 'Javier Zeballos' }).alias).toBeNull();
  });

  it('un nombre en blanco no es un nombre', () => {
    expect(nombreDelContacto({ pushname: 'Kevin', leadNombre: '   ' })).toEqual({
      principal: 'Kevin',
      alias: null,
      fuente: 'whatsapp',
    });
  });

  it('la ficha (lo que el equipo anotó a mano) le gana al pushname — es lo único que hay en campaña sin Cerberus ni formulario', () => {
    expect(nombreDelContacto({ pushname: '🦋W', fichaNombre: 'Angel Eduardo' })).toEqual({
      principal: 'Angel Eduardo',
      alias: '🦋W',
      fuente: 'ficha',
    });
  });

  it('el formulario le gana a la ficha: lo tipeó la propia persona, no alguien de oído', () => {
    expect(nombreDelContacto({ leadNombre: 'Javier Zeballos', fichaNombre: 'Javier Z' }).fuente).toBe('formulario');
  });

  // 🔴 F.2 — el caso de Pedro López (José Francisco Lopez Fermin, icarus:23913):
  // sin este escalón la ficha no tenía de dónde sacar su nombre real, y el
  // panel mostraba el alias de WhatsApp como si fuera el nombre.
  it('icarus (F.1) le gana al formulario y a la ficha — compró, aunque Cerberus todavía no lo diga', () => {
    const n = nombreDelContacto({
      pushname: 'Pedro López',
      leadNombre: 'Pedro L',
      fichaNombre: 'Pedro',
      icarusNombre: 'José Francisco Lopez Fermin',
    });
    expect(n.principal).toBe('José Francisco Lopez Fermin');
    expect(n.fuente).toBe('icarus');
    expect(n.alias).toBe('Pedro López');
  });

  it('Cerberus le gana a icarus: firmó, no es solo un contacto sincronizado', () => {
    const n = nombreDelContacto({
      cerberusNombre: 'DR EN DERECHO IGNACIO ALEJANDRO VILA CHÁVEZ',
      icarusNombre: 'Alejandro Vila',
    });
    expect(n.fuente).toBe('cerberus');
  });

  // 🔴 #1033 (12-sep-2026) — la cabecera de Luis Ángel decía «alias de WhatsApp: .».
  // Un pushname de pura puntuación o sólo emojis no nombra a nadie: no es alias
  // cuando hay un nombre real, y no es nombre cuando no hay otro.
  it('un pushname sin letras ni dígitos no es alias: «.» debajo del nombre real no dice nada', () => {
    expect(nombreDelContacto({ pushname: '.', cerberusNombre: 'Luis Ángel Llaguento Heredia' })).toEqual({
      principal: 'Luis Ángel Llaguento Heredia',
      alias: null,
      fuente: 'cerberus',
    });
  });

  it('un pushname sin letras ni dígitos tampoco es nombre cuando no hay otro', () => {
    for (const push of ['.', '-', '...', '🦋🦋']) {
      expect(nombreDelContacto({ pushname: push })).toEqual({ principal: null, alias: null, fuente: 'ninguna' });
    }
  });
});
