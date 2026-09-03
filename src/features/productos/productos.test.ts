import { describe, expect, it } from 'vitest';
import {
  categoriasDe,
  conteosPorCategoria,
  conteosPorDivision,
  conteosPorNegocio,
  divisionesDe,
  filtrarProductos,
  negociosDe,
  FILTROS_VACIOS,
  type ProductoCatalogo,
} from './productos';

function producto(p: Partial<ProductoCatalogo> = {}): ProductoCatalogo {
  return {
    id: '1',
    sku: 'ABC001',
    nombre: 'Diploma en Gestión Pública',
    precioNormal: 250,
    precioPromocion: 199,
    moneda: 'USD',
    categoria: 'Curso Online',
    negocio: 'Escuela',
    division: 'Estrategia Politica',
    disponible: true,
    ...p,
  };
}

const SIN_FILTROS = FILTROS_VACIOS;

describe('filtrarProductos — el catálogo que ve la vendedora', () => {
  it('sin filtros, sólo lo disponible', () => {
    const r = filtrarProductos(
      [producto({ id: '1', disponible: true }), producto({ id: '2', disponible: false })],
      SIN_FILTROS,
    );
    expect(r.map((p) => p.id)).toEqual(['1']);
  });

  it('estado «no_disponible» trae SOLO lo dado de baja', () => {
    const productos = [producto({ id: '1', disponible: true }), producto({ id: '2', disponible: false })];
    const r = filtrarProductos(productos, { ...SIN_FILTROS, estado: 'no_disponible' });
    expect(r.map((p) => p.id)).toEqual(['2']);
  });

  it('estado «todos» trae los dos', () => {
    const productos = [producto({ id: '1', disponible: true }), producto({ id: '2', disponible: false })];
    const r = filtrarProductos(productos, { ...SIN_FILTROS, estado: 'todos' });
    expect(r.map((p) => p.id)).toEqual(['1', '2']);
  });

  it('busca por nombre y por SKU, sin importar mayúsculas', () => {
    const productos = [producto({ id: '1', nombre: 'Diploma en OSINT', sku: 'OSN001' })];
    expect(filtrarProductos(productos, { ...SIN_FILTROS, q: 'osint' })).toHaveLength(1);
    expect(filtrarProductos(productos, { ...SIN_FILTROS, q: 'osn001' })).toHaveLength(1);
    expect(filtrarProductos(productos, { ...SIN_FILTROS, q: 'contraterrorismo' })).toHaveLength(0);
  });

  it('categoría es de un solo valor, como negocio y división', () => {
    const productos = [
      producto({ id: '1', categoria: 'Curso Online' }),
      producto({ id: '2', categoria: 'E-Book' }),
      producto({ id: '3', categoria: 'Fisico' }),
    ];
    const r = filtrarProductos(productos, { ...SIN_FILTROS, categoria: 'Curso Online' });
    expect(r.map((p) => p.id)).toEqual(['1']);
  });

  it('negocio es de un solo valor: no admite «Escuela o Editorial» a la vez', () => {
    const productos = [
      producto({ id: '1', negocio: 'Escuela' }),
      producto({ id: '2', negocio: 'Editorial' }),
      producto({ id: '3', negocio: 'Consultoria' }),
    ];
    const r = filtrarProductos(productos, { ...SIN_FILTROS, negocio: 'Editorial' });
    expect(r.map((p) => p.id)).toEqual(['2']);
  });

  it('división filtra igual que negocio, un solo valor', () => {
    const productos = [
      producto({ id: '1', division: 'Inteligencia' }),
      producto({ id: '2', division: 'Estrategia Politica' }),
    ];
    const r = filtrarProductos(productos, { ...SIN_FILTROS, division: 'Inteligencia' });
    expect(r.map((p) => p.id)).toEqual(['1']);
  });

  it('búsqueda, categoría, negocio, división y estado se combinan con AND', () => {
    const productos = [
      producto({
        id: '1',
        nombre: 'Diploma de Inteligencia',
        categoria: 'Curso Online',
        negocio: 'Escuela',
        division: 'Inteligencia',
        disponible: true,
      }),
      producto({
        id: '2',
        nombre: 'Diploma de Inteligencia',
        categoria: 'E-Book',
        negocio: 'Editorial',
        division: 'Inteligencia',
        disponible: true,
      }),
      producto({
        id: '3',
        nombre: 'Diploma de Inteligencia',
        categoria: 'Curso Online',
        negocio: 'Escuela',
        division: 'Inteligencia',
        disponible: false,
      }),
    ];
    const r = filtrarProductos(productos, {
      ...SIN_FILTROS,
      q: 'inteligencia',
      categoria: 'Curso Online',
      negocio: 'Escuela',
      division: 'Inteligencia',
      estado: 'disponible',
    });
    expect(r.map((p) => p.id)).toEqual(['1']);
  });
});

describe('categoriasDe / negociosDe / divisionesDe — lo que existe de verdad, no una lista a mano', () => {
  it('categoriasDe deduplica, ordena alfabético y descarta vacías', () => {
    const productos = [
      producto({ categoria: 'Fisico' }),
      producto({ categoria: 'E-Book' }),
      producto({ categoria: 'Fisico' }),
      producto({ categoria: '' }),
    ];
    expect(categoriasDe(productos)).toEqual(['E-Book', 'Fisico']);
  });

  it('negociosDe hace lo mismo con negocio', () => {
    const productos = [producto({ negocio: 'Escuela' }), producto({ negocio: 'Editorial' }), producto({ negocio: '' })];
    expect(negociosDe(productos)).toEqual(['Editorial', 'Escuela']);
  });

  it('divisionesDe hace lo mismo con division', () => {
    const productos = [producto({ division: 'Inteligencia' }), producto({ division: 'Estrategia Politica' })];
    expect(divisionesDe(productos)).toEqual(['Estrategia Politica', 'Inteligencia']);
  });
});

describe('conteosPorCategoria / conteosPorNegocio / conteosPorDivision — sin el propio filtro', () => {
  it('conteosPorCategoria: tildar una no hace desaparecer a las otras', () => {
    const productos = [
      producto({ id: '1', categoria: 'Curso Online' }),
      producto({ id: '2', categoria: 'Curso Online' }),
      producto({ id: '3', categoria: 'E-Book' }),
    ];
    const conteos = conteosPorCategoria(productos, { ...SIN_FILTROS, categoria: 'Curso Online' });
    expect(conteos.get('Curso Online')).toBe(2);
    expect(conteos.get('E-Book')).toBe(1);
  });

  it('conteosPorNegocio: elegir «Escuela» no oculta cuánto tiene «Editorial»', () => {
    const productos = [
      producto({ id: '1', negocio: 'Escuela' }),
      producto({ id: '2', negocio: 'Editorial' }),
    ];
    const conteos = conteosPorNegocio(productos, { ...SIN_FILTROS, negocio: 'Escuela' });
    expect(conteos.get('Escuela')).toBe(1);
    expect(conteos.get('Editorial')).toBe(1);
  });

  it('conteosPorDivision: mismo criterio', () => {
    const productos = [
      producto({ id: '1', division: 'Inteligencia' }),
      producto({ id: '2', division: 'Estrategia Politica' }),
    ];
    const conteos = conteosPorDivision(productos, { ...SIN_FILTROS, division: 'Inteligencia' });
    expect(conteos.get('Inteligencia')).toBe(1);
    expect(conteos.get('Estrategia Politica')).toBe(1);
  });

  it('todos SÍ respetan la búsqueda y el estado — esos no son «su propio filtro»', () => {
    const productos = [
      producto({ id: '1', categoria: 'Curso Online', disponible: true }),
      producto({ id: '2', categoria: 'Curso Online', disponible: false }),
    ];
    expect(conteosPorCategoria(productos, SIN_FILTROS).get('Curso Online')).toBe(1);
    expect(
      conteosPorCategoria(productos, { ...SIN_FILTROS, estado: 'todos' }).get('Curso Online'),
    ).toBe(2);
  });
});
