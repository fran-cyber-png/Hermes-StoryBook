import { describe, expect, it } from 'vitest';
import { paisDeNombre, paisDelContacto, paisDelNumero } from './pais';

/**
 * LA BANDERA DE LA CABECERA (dueño, 13-sep-2026): primero el país que alguien
 * declaró (Cerberus, el padrón), y si no hay, el que dice el código del número —
 * marcado como tal, porque el prefijo dice dónde se sacó la línea, no dónde vive
 * la persona.
 */
describe('paisDelContacto', () => {
  it('lo declarado gana sobre el número: una dominicana que escribe desde una línea peruana es dominicana', () => {
    expect(paisDelContacto({ declarado: 'República Dominicana', telefono: '51900111222' })).toEqual({
      iso: 'DO',
      nombre: 'República Dominicana',
      porNumero: false,
    });
  });

  it('sin país declarado, sale del código del número, y lo dice', () => {
    expect(paisDelContacto({ declarado: null, telefono: '51900333444' })).toEqual({
      iso: 'PE',
      nombre: 'Perú',
      porNumero: true,
    });
  });

  it('un número de 9 dígitos sin código es de Perú, igual que lo muestra la cabecera (`formatearTelefono`)', () => {
    expect(paisDelContacto({ declarado: null, telefono: '998765423' })).toEqual({
      iso: 'PE',
      nombre: 'Perú',
      porNumero: true,
    });
  });

  it('un país declarado que no está en la lista se muestra con su nombre y sin bandera: no se inventa una', () => {
    expect(paisDelContacto({ declarado: 'Alemania', telefono: '51900333444' })).toEqual({
      iso: null,
      nombre: 'Alemania',
      porNumero: false,
    });
  });

  it('sin país declarado y con un número que no alcanza, no hay país', () => {
    expect(paisDelContacto({ declarado: null, telefono: null })).toBeNull();
    expect(paisDelContacto({ declarado: '   ', telefono: '123' })).toBeNull();
  });
});

describe('paisDeNombre — cada quien lo escribe a su manera', () => {
  it('«peru», «MX» y «Rep. Dominicana» son países conocidos', () => {
    expect(paisDeNombre('peru')?.iso).toBe('PE');
    expect(paisDeNombre('MX')?.iso).toBe('MX');
    expect(paisDeNombre('Rep. Dominicana')?.iso).toBe('DO');
  });
});

describe('paisDelNumero', () => {
  it('🔴 el +1 no es un país: 809, 829 y 849 son República Dominicana, y el resto no se adivina', () => {
    expect(paisDelNumero('18097961936')?.iso).toBe('DO');
    expect(paisDelNumero('18297961936')?.iso).toBe('DO');
    expect(paisDelNumero('18497961936')?.iso).toBe('DO');
    expect(paisDelNumero('12125550123'), 'un +1 que no es de República Dominicana puede ser EE. UU. o Canadá').toBeNull();
  });

  it('México con el 1 que WhatsApp arrastra (521…) sigue siendo México', () => {
    expect(paisDelNumero('5215512345678')?.iso).toBe('MX');
  });

  it('el código más largo gana: 502 es Guatemala, no Perú ni Brasil', () => {
    expect(paisDelNumero('50255551234')?.iso).toBe('GT');
  });
});
