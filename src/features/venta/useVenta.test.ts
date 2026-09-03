import { describe, expect, it } from 'vitest';
import { precioDe, totalCarrito, type ProductoElegido } from './useVenta';

function linea(p: Partial<ProductoElegido['producto']> = {}, cantidad = 1, precio?: string): ProductoElegido {
  return {
    producto: { id: 'p1', sku: 'SKU-1', nombre: 'Curso', precioNormal: 100, precioPromocion: 90, moneda: 'S/', ...p },
    cantidad,
    precio,
  };
}

describe('precioDe — lo tipeado, como número usable', () => {
  it('sin texto no hay precio', () => {
    expect(precioDe(undefined)).toBe(0);
  });

  it('acepta coma decimal', () => {
    expect(precioDe('1200,50')).toBe(1200.5);
  });

  it('nunca negativo: un descuento no es una devolución', () => {
    expect(precioDe('-50')).toBe(0);
  });

  it('texto que no es número no rompe nada', () => {
    expect(precioDe('sin dato')).toBe(0);
  });
});

describe('totalCarrito — la cifra que arranca «Registrar venta»', () => {
  it('sin líneas no hay total', () => {
    expect(totalCarrito([])).toEqual([]);
  });

  it('una línea sin precio anotado todavía no suma', () => {
    expect(totalCarrito([linea({ id: 'p1' }, 1, undefined)])).toEqual([]);
  });

  it('suma cantidad × precio de cada línea, por moneda', () => {
    const r = totalCarrito([
      linea({ id: 'p1' }, 2, '100'),
      linea({ id: 'p2' }, 1, '50'),
    ]);
    expect(r).toEqual([{ moneda: 'S/', total: 250 }]);
  });

  it('no mezcla monedas: cada una suma la suya', () => {
    const r = totalCarrito([
      linea({ id: 'p1', moneda: 'S/' }, 1, '100'),
      linea({ id: 'p2', moneda: 'USD' }, 1, '30'),
    ]);
    expect(r).toEqual([
      { moneda: 'S/', total: 100 },
      { moneda: 'USD', total: 30 },
    ]);
  });

  it('sin moneda en el catálogo, usa la que eligió la vendedora en el carrito', () => {
    const r = totalCarrito([linea({ id: 'p1', moneda: '' }, 1, '199')], 'USD');
    expect(r).toEqual([{ moneda: 'USD', total: 199 }]);
  });

  it('sin moneda del catálogo NI elegida, no inventa una: agrupa bajo la vacía', () => {
    const r = totalCarrito([linea({ id: 'p1', moneda: '' }, 1, '199')]);
    expect(r).toEqual([{ moneda: '', total: 199 }]);
  });
});
