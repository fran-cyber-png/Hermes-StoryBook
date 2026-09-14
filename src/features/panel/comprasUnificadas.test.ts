import { describe, expect, it } from 'vitest';
import { comprasUnificadas, ultimaCompra } from './comprasUnificadas';
import type { Ficha } from '../cerberus/ficha';
import type { CompraDelPadron } from './usePadron';

const CLIENTE_VERIFICADO: Ficha = {
  estado: 'cliente',
  id: 1,
  nombre: 'Ana',
  codigo: 'CLI-1',
  dni: '',
  pais: '',
  correo: '',
  ventasCount: 1,
  ventas: [{ folio: 'GOB-1', estado: 'Pagado', monto: '100', moneda: 'PEN', fecha: '2026-04-01T00:00:00Z', productos: [] }],
  verificado: true,
};

const CLIENTE_SIN_VERIFICAR: Ficha = {
  ...CLIENTE_VERIFICADO,
  ventasCount: null,
  ventas: [],
  verificado: false,
};

const COMPRA_PADRON: CompraDelPadron = {
  folio: 'GOB-10291',
  fecha: '2025-10-31T00:00:00.000Z',
  monto: '2505',
  moneda: 'DOP',
  canal: 'whatsapp',
  fuente: 'puente-icarus',
};

describe('comprasUnificadas — F.5, una sola lista sin mezclar fuentes', () => {
  it('Cerberus verificado manda: sus ventas, no el padrón', () => {
    const r = comprasUnificadas(CLIENTE_VERIFICADO, [COMPRA_PADRON]);
    expect(r).toHaveLength(1);
    expect(r[0].folio).toBe('GOB-1');
    expect(r[0].fuente).toBe('cerberus');
  });

  it('sin verificar (ventasCount null): el padrón llena el hueco', () => {
    const r = comprasUnificadas(CLIENTE_SIN_VERIFICAR, [COMPRA_PADRON]);
    expect(r).toHaveLength(1);
    expect(r[0].folio).toBe('GOB-10291');
    expect(r[0].fuente).toBe('padron');
  });

  it('sin ficha (lead nuevo) y sin padrón: lista vacía, no un error', () => {
    expect(comprasUnificadas(undefined, undefined)).toEqual([]);
  });

  it('nunca mezcla las dos fuentes en una sola lista', () => {
    const r = comprasUnificadas(CLIENTE_VERIFICADO, [COMPRA_PADRON]);
    expect(r.every((c) => c.fuente === 'cerberus')).toBe(true);
  });

  // #1033 — el producto venía de Cerberus y se perdía acá: sin él, el resumen del
  // perfil no puede decir QUÉ compró, que es lo que evita cotizarle lo mismo.
  it('conserva los productos de Cerberus', () => {
    const conProductos: Ficha = {
      ...CLIENTE_VERIFICADO,
      ventas: [{ ...(CLIENTE_VERIFICADO as Extract<Ficha, { estado: 'cliente' }>).ventas[0], productos: ['Diploma en Gestión Pública'] }],
    };
    expect(comprasUnificadas(conProductos, [])[0].productos).toEqual(['Diploma en Gestión Pública']);
  });

  it('del padrón no viene producto: lista vacía, nunca un nombre inventado', () => {
    expect(comprasUnificadas(CLIENTE_SIN_VERIFICAR, [COMPRA_PADRON])[0].productos).toEqual([]);
  });

  // 🔴 #1033 — la marca de compra y el negocio los pone el server; sin marca, «Anulado» decide.
  it('lleva de Cerberus la marca de compra y los negocios; sin marca, el rótulo «Anulado» decide', () => {
    const ficha: Ficha = {
      ...CLIENTE_VERIFICADO,
      ventas: [
        { folio: 'GOB-1', estado: 'Pagado', monto: '100', moneda: 'PEN', fecha: '', productos: [], esCompra: true, negocios: ['Escuela'] },
        { folio: 'GOB-2', estado: 'Cotización', monto: '50', moneda: 'PEN', fecha: '', productos: [], esCompra: false },
        { folio: 'GOB-3', estado: 'Anulado', monto: '50', moneda: 'PEN', fecha: '', productos: [] },
      ],
    };
    expect(comprasUnificadas(ficha, []).map((c) => [c.folio, c.esCompra, c.negocios])).toEqual([
      ['GOB-1', true, ['Escuela']],
      ['GOB-2', false, []],
      ['GOB-3', false, []],
    ]);
  });

  it('del padrón la marca también la pone el server; sin ella cuenta, como contó siempre', () => {
    const r = comprasUnificadas(CLIENTE_SIN_VERIFICAR, [{ ...COMPRA_PADRON, esCompra: false }, { ...COMPRA_PADRON, folio: 'GOB-2' }]);
    expect(r.map((c) => c.esCompra)).toEqual([false, true]);
  });
});

describe('ultimaCompra', () => {
  it('la primera de la lista (ya viene ordenada por fecha desc)', () => {
    expect(ultimaCompra(comprasUnificadas(CLIENTE_VERIFICADO, []))?.folio).toBe('GOB-1');
  });

  it('null cuando no hay ninguna', () => {
    expect(ultimaCompra([])).toBeNull();
  });
});
