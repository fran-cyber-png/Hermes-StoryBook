import { describe, expect, test } from 'vitest';
import { insertarEnCursor } from './insertarEnCursor';

/**
 * INSERTAR ALGO DONDE ESTÁ EL CURSOR (ADR 0126, #1081 y #1083).
 *
 * El emoji entra donde la vendedora dejó el cursor, no al final: meter un 😊 en
 * medio de una frase ya escrita es el caso que un «agregar al final» rompe.
 * El cursor se cuenta en unidades de `selectionStart` (UTF-16): un emoji ocupa
 * dos, y un cursor contado en caracteres quedaría en medio del emoji.
 */
describe('insertarEnCursor', () => {
  test('entre dos palabras, el emoji queda en el medio y el cursor justo después', () => {
    expect(insertarEnCursor('hola  mundo', 5, 5, '😊')).toEqual({ texto: 'hola 😊 mundo', cursor: 7 });
  });

  test('con un tramo seleccionado, el emoji lo reemplaza', () => {
    expect(insertarEnCursor('hola mundo', 0, 4, '😊')).toEqual({ texto: '😊 mundo', cursor: 2 });
  });
});
