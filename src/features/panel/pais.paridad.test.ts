import { describe, expect, it } from 'vitest';
import {
  PAISES as PAISES_DEL_SERVER,
  paisDeNombre as paisDeNombreDelServer,
  paisDelNumero as paisDelNumeroDelServer,
} from '../../../server/src/telefono/paises';
import { PAISES, paisDeNombre, paisDelNumero } from '../../dominio/pais';

/**
 * EL CANDADO ENTRE LAS DOS LISTAS DE PAÍSES (#37).
 *
 * El front necesita su copia para dibujar la bandera (dueño, 13-sep-2026): el
 * código ISO no está en la del server y la campaña no tiene perfil que lo traiga.
 * Una copia que no se cruza diverge callada: el server reconocería «Rep.
 * Dominicana» y la cabecera no, o al revés, y la bandera saldría para unos y no
 * para otros sin un solo error.
 *
 * ⚠️ La única diferencia a propósito es el +1: el server lo tiene como un solo
 * país («EE. UU./Canadá», con los nombres de República Dominicana adentro) y el
 * front lo parte en tres para poder poner una bandera. Por eso se cruzan los
 * CÓDIGOS y los NOMBRES, no las filas.
 */
describe('la lista de países del front y la del server dicen lo mismo', () => {
  it('cada código del server está en el front, con los mismos largos', () => {
    for (const delServer of PAISES_DEL_SERVER) {
      const delFront = PAISES.filter((p) => p.codigo === delServer.codigo);
      expect(delFront.length, `el código +${delServer.codigo} no está en el front`).toBeGreaterThan(0);
      for (const p of delFront) {
        expect([...p.largos].sort(), `${p.nombre}: largos distintos`).toEqual([...delServer.largos].sort());
      }
    }
  });

  it('todo nombre que reconoce el server lo reconoce el front, con el mismo código', () => {
    for (const delServer of PAISES_DEL_SERVER) {
      for (const nombre of delServer.nombres) {
        expect(paisDeNombre(nombre)?.codigo, `«${nombre}»`).toBe(paisDeNombreDelServer(nombre)?.codigo);
      }
    }
  });

  it('y el front no reconoce un nombre que el server no', () => {
    for (const p of PAISES) {
      for (const nombre of p.nombres) {
        expect(paisDeNombreDelServer(nombre)?.codigo, `«${nombre}»`).toBe(p.codigo);
      }
    }
  });

  it('un número da el mismo código en los dos (salvo el +1 que el front no adivina)', () => {
    const numeros = [
      '51900333444', '5215512345678', '593987654321', '59171234567', '573001234567', '50255551234',
      '50761234567', '56912345678', '5491123456789', '584121234567', '50371234567', '50491234567',
      '50581234567', '50681234567', '595981234567', '59891234567', '5511912345678', '34612345678',
      '18097961936',
    ];
    for (const numero of numeros) {
      const delFront = paisDelNumero(numero);
      expect(delFront, `el front no reconoce ${numero}`).not.toBeNull();
      expect(delFront?.codigo, numero).toBe(paisDelNumeroDelServer(numero)?.codigo);
    }
  });
});
