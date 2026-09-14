import { describe, expect, it } from 'vitest';
import { colorDeCurso } from '../../dominio/curso';
import { familiaDeProducto } from '../../lib/producto';
import { CATALOGO_MEDIDO_10_SEP } from './catalogoMedido';
import {
  agruparEnProductos,
  categoriasDe,
  conBusqueda,
  conDivision,
  conNegocio,
  divisionesDe,
  familiaYEdicion,
  filtrar,
  inicialesDe,
  negocioInicial,
  negociosDe,
  precioDe,
  RECORTE_INICIAL,
  seDibuja,
  textoDePrecio,
  type Producto,
  type ProductoCatalogo,
} from './productos';

/**
 * Contra el catálogo MEDIDO el 10-sep-2026, no contra un fixture a mano: lo que se
 * afirma acá es lo que la vista dibuja, y un fixture ideal no habría encontrado ni
 * `DIPCOCO002-BFA8` ni los siete packs de libros a precio 0.
 */
const PRODUCTOS = agruparEnProductos(CATALOGO_MEDIDO_10_SEP);

function producto(familia: string, productos: readonly Producto[] = PRODUCTOS): Producto {
  const p = productos.find((x) => x.familia === familia);
  if (!p) throw new Error(`el catálogo no tiene la familia ${familia}`);
  return p;
}

function edicion(p: Partial<ProductoCatalogo> & { id: string; sku: string }): ProductoCatalogo {
  return {
    nombre: 'Diploma de Prueba 1',
    precioNormal: 199,
    precioPromocion: 150,
    moneda: '',
    categoria: 'Curso Online',
    negocio: 'Escuela',
    division: 'Inteligencia',
    disponible: true,
    ...p,
  };
}

describe('familiaYEdicion — la receta de plantillas/familias.ts, no la de cursos/catalogo.ts (#937)', () => {
  it('el sufijo que Cerberus pegó para desambiguar NO es el número de edición', () => {
    expect(familiaYEdicion('DIPCOCO002-BFA8')).toEqual({ familia: 'DIPCOCO', edicion: 2 });
  });

  it('los packs de libros son productos distintos, no ediciones de «PK»', () => {
    expect(familiaYEdicion('PK2LIB0000').familia).toBe('PK2LIB0000');
    expect(familiaYEdicion('PK8LIB0000').familia).toBe('PK8LIB0000');
  });

  it('un GEN* es su propia familia, aunque empiece con GENB', () => {
    expect(familiaYEdicion('GENB4E1FA')).toEqual({ familia: 'GENB4E1FA', edicion: null });
  });
});

describe('agruparEnProductos — la unidad es el producto, y manda la edición vigente', () => {
  it('252 ediciones a la venta son 196 productos', () => {
    expect(CATALOGO_MEDIDO_10_SEP.filter((p) => p.disponible)).toHaveLength(252);
    expect(PRODUCTOS.filter((p) => p.aLaVenta.length > 0)).toHaveLength(196);
  });

  it('DIPCOCO: la vigente es la 004, no la 002-BFA8 que elige cursos/catalogo.ts', () => {
    expect(producto('DIPCOCO').vigente.sku).toBe('DIPCOCO004');
  });

  it('DIPICOT: 23 ediciones marcadas Disponible, y la vigente es la 27', () => {
    const dipicot = producto('DIPICOT');
    expect(dipicot.aLaVenta).toHaveLength(23);
    expect(dipicot.deBaja).toHaveLength(5);
    expect(dipicot.vigente.sku).toBe('DIPICOT027');
    expect(dipicot.nombre).toBe('Diplomado en Inteligencia y Contrainteligencia');
  });

  it('las seis filas de Oratoria de la captura del dueño son UN producto', () => {
    expect(producto('EPCOORP').aLaVenta.map((p) => p.sku)).toEqual([
      'EPCOORP009',
      'EPCOORP008',
      'EPCOORP007',
      'EPCOORP006',
      'EPCOORP005',
      'EPCOORP004',
    ]);
  });

  it('el color es el MISMO que la cola le pone a ese curso (misma llave que cursoDeFila)', () => {
    const enLaCola = familiaDeProducto(null, 'Diploma Internacional de Inteligencia y Contrainteligencia').familia;
    expect(producto('DIPICOT').color).toBe(colorDeCurso(enLaCola));
  });

  it('hoy ninguna imagen llega: los 196 productos van con la portada sin foto', () => {
    expect(PRODUCTOS.every((p) => p.imagen === null)).toBe(true);
  });

  it('la imagen es la de la vigente y, si no tiene, la de la edición más nueva que sí tenga', () => {
    const conFotoVieja = agruparEnProductos([
      edicion({ id: '1', sku: 'DIPX001', imagen: 'https://x/1.jpg' }),
      edicion({ id: '2', sku: 'DIPX002', imagen: 'https://x/2.jpg' }),
      edicion({ id: '3', sku: 'DIPX003', imagen: null }),
    ]);
    expect(producto('DIPX', conFotoVieja).vigente.sku).toBe('DIPX003');
    expect(producto('DIPX', conFotoVieja).imagen).toBe('https://x/2.jpg');

    const conFotoPropia = agruparEnProductos([
      edicion({ id: '1', sku: 'DIPX001', imagen: 'https://x/1.jpg' }),
      edicion({ id: '2', sku: 'DIPX002', imagen: 'https://x/2.jpg' }),
    ]);
    expect(producto('DIPX', conFotoPropia).imagen).toBe('https://x/2.jpg');
  });
});

describe('negocio manda — los selectores de abajo se recortan a lo que existe', () => {
  it('los cuatro negocios, del más grande al más chico, contando productos y no SKUs', () => {
    expect(negociosDe(PRODUCTOS, RECORTE_INICIAL)).toEqual([
      { valor: 'Escuela', cuantos: 99 },
      { valor: 'Editorial', cuantos: 62 },
      { valor: 'LifeStyle', cuantos: 28 },
      { valor: 'Consultoria', cuantos: 7 },
    ]);
  });

  it('con una búsqueda, los negocios NO desaparecen ni cambian de orden: cambia sólo el número', () => {
    const negocios = negociosDe(PRODUCTOS, { ...RECORTE_INICIAL, q: 'contraterrorismo' });
    expect(negocios.map((o) => o.valor)).toEqual(['Escuela', 'Editorial', 'LifeStyle', 'Consultoria']);
    expect(negocios.find((o) => o.valor === 'Escuela')!.cuantos).toBeGreaterThan(0);
    expect(negocios.find((o) => o.valor === 'Editorial')!.cuantos).toBe(0);
  });

  it('se busca por el SKU de CUALQUIER edición, también de una vieja', () => {
    const r = filtrar(PRODUCTOS, { ...RECORTE_INICIAL, q: 'dipicot014' });
    expect(r.map((p) => p.familia)).toEqual(['DIPICOT']);
  });

  it('la búsqueda no distingue acentos ni mayúsculas', () => {
    const r = { ...RECORTE_INICIAL, q: 'CRIMINOLOGÍA' };
    expect(filtrar(PRODUCTOS, r).length).toBe(filtrar(PRODUCTOS, { ...r, q: 'criminologia' }).length);
    expect(filtrar(PRODUCTOS, r).length).toBeGreaterThan(0);
  });

  it('regla del cero: en LifeStyle › Inteligencia hay UNA categoría, y ese selector no se dibuja', () => {
    const r = conDivision(PRODUCTOS, { ...RECORTE_INICIAL, negocio: 'LifeStyle' }, 'Inteligencia');
    expect(categoriasDe(PRODUCTOS, r).map((o) => o.valor)).toEqual(['Merchadising']);
    expect(seDibuja(categoriasDe(PRODUCTOS, r))).toBe(false);
    expect(seDibuja(divisionesDe(PRODUCTOS, r))).toBe(true);
  });

  it('cambiar a un negocio que no tiene la división elegida la suelta', () => {
    const enEscuela = conDivision(PRODUCTOS, RECORTE_INICIAL, 'Inteligencia');
    expect(enEscuela.division).toBe('Inteligencia');
    expect(conNegocio(PRODUCTOS, enEscuela, 'Consultoria').division).toBe('');
  });

  it('buscar suelta la división que la búsqueda deja escondida (B1 de #961)', () => {
    const enInteligencia = conDivision(PRODUCTOS, RECORTE_INICIAL, 'Inteligencia');
    const buscando = conBusqueda(PRODUCTOS, enInteligencia, 'oratoria');
    expect(seDibuja(divisionesDe(PRODUCTOS, buscando))).toBe(false);
    expect(buscando.division).toBe('');
    expect(filtrar(PRODUCTOS, buscando).length).toBeGreaterThan(0);
  });

  it('un filtro que la pantalla no dibuja no puede seguir recortando', () => {
    const r = conNegocio(PRODUCTOS, { ...RECORTE_INICIAL, categoria: 'Merchadising' }, 'LifeStyle');
    expect(conDivision(PRODUCTOS, r, 'Inteligencia').categoria).toBe('');
  });
});

describe('negocioInicial — se recuerda el último negocio elegido (D1)', () => {
  it('el guardado, si todavía existe en el catálogo', () => {
    expect(negocioInicial(PRODUCTOS, 'Editorial')).toBe('Editorial');
  });

  it('uno guardado que Cerberus ya no tiene cae a Escuela: la vista no puede abrir vacía', () => {
    expect(negocioInicial(PRODUCTOS, 'Librería')).toBe('Escuela');
    expect(negocioInicial(PRODUCTOS, null)).toBe('Escuela');
  });

  it('sin Escuela en el catálogo, el negocio más grande', () => {
    const sinEscuela = PRODUCTOS.filter((p) => p.negocio !== 'Escuela');
    expect(negocioInicial(sinEscuela, null)).toBe('Editorial');
  });
});

describe('precio — uno vigente, y el regular sólo cuando dice algo', () => {
  it('Oratoria: USD 80 vigente, USD 150 regular', () => {
    expect(precioDe(producto('EPCOORP').vigente)).toMatchObject({ vigente: 80, regular: 150, sinPrecio: false });
  });

  it('DIPICOT 27: Cerberus manda la promoción en null, así que no hay regular que tachar', () => {
    expect(precioDe(producto('DIPICOT').vigente)).toMatchObject({ vigente: 199, regular: null });
  });

  it('un pack de libros en 0 es «sin precio», y «Copiar precio» no tiene nada que copiar', () => {
    const pack = producto('PK8LIB0000');
    expect(precioDe(pack.vigente).sinPrecio).toBe(true);
    expect(textoDePrecio(pack)).toBeNull();
  });

  it('lo que no se puede cotizar va al final: Editorial ya no abre con siete packs a precio 0', () => {
    const editorial = filtrar(PRODUCTOS, { ...RECORTE_INICIAL, negocio: 'Editorial' });
    expect(precioDe(editorial[0].vigente).sinPrecio).toBe(false);
    const primeroSinPrecio = editorial.findIndex((p) => precioDe(p.vigente).sinPrecio);
    expect(primeroSinPrecio).toBeGreaterThan(0);
    expect(editorial.slice(primeroSinPrecio).every((p) => precioDe(p.vigente).sinPrecio)).toBe(true);
  });

  it('la línea para el chat, en la voz de la vendedora', () => {
    expect(textoDePrecio(producto('EPCOORP'))).toBe(
      'Curso de Especialización Oratoria para Políticos: USD 80 (precio regular USD 150).',
    );
  });
});

describe('inicialesDe — la portada sin foto', () => {
  it('saltea los conectores', () => {
    expect(inicialesDe('Inteligencia y Contrainteligencia')).toBe('IC');
    expect(inicialesDe('Oratoria para Políticos')).toBe('OP');
    expect(inicialesDe('OSINT & SOCMINT')).toBe('OS');
  });
});
