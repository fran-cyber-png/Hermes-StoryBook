import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';

/**
 * EL CATÁLOGO DE PRODUCTOS DE CERBERUS — solo lectura, para la vista
 * «Productos» del riel.
 *
 * Trae los ~340 productos de una sola vez (`GET /api/productos`, sin
 * paginación server-side: Cerberus tampoco pagina el endpoint público de
 * donde sale) y todo lo demás —buscar, filtrar por categoría, mostrar o no
 * lo dado de baja— pasa en el navegador. Es una elección deliberada y no
 * pereza: replicar acá el filtrado server-side que sí necesita el padrón
 * (`padron/donde.ts`, 72.923 filas) sería resolver un problema de escala que
 * este catálogo no tiene.
 */

export interface ProductoCatalogo {
  id: string;
  sku: string;
  nombre: string;
  precioNormal: number;
  precioPromocion: number;
  moneda: string;
  categoria: string;
  negocio: string;
  division: string;
  disponible: boolean;
}

/**
 * El catálogo público de Cerberus (`/productos/api/public/productos-cursos/`)
 * NUNCA manda la moneda de `precio_normal`/`precio_promocion` — `p.moneda`
 * llega `''` para los ~340 productos, medido el 20-ago-2026. Confirmado con
 * el dueño: el catálogo entero está en USD. Se rotula acá, UNA vez, en vez de
 * confiar en `p.moneda` (que seguiría vacía) — el día que Cerberus la mande,
 * este archivo es el único lugar que hay que tocar.
 */
export const MONEDA_DEL_CATALOGO = 'USD';

export function useCatalogoProductos() {
  return useQuery({
    queryKey: ['productos', 'catalogo'],
    queryFn: () => api<{ productos: ProductoCatalogo[] }>('/api/productos'),
    select: (d) => d.productos,
    // El catálogo no cambia mientras se lo mira: cinco minutos evita repreguntarle
    // a Cerberus cada vez que la vendedora vuelve a esta vista en la sesión.
    staleTime: 5 * 60_000,
  });
}

/** Los tres estados que Cerberus conoce — el vocabulario que ya usa su propia pantalla. */
export const ESTADOS_PRODUCTO = ['todos', 'disponible', 'no_disponible'] as const;
export type EstadoProducto = (typeof ESTADOS_PRODUCTO)[number];

export interface FiltrosProductos {
  q: string;
  /**
   * Un solo valor, como `negocio`/`division` (revierte el multivalor del
   * 20-ago-2026: los chips ocupaban dos filas y el pedido fue «que sea un
   * combobox, igual que los otros tres»). `''` = todas.
   */
  categoria: string;
  negocio: string;
  division: string;
  /** `'disponible'` (default) = lo de siempre; `'no_disponible'` = solo lo dado de baja; `'todos'` = los dos. */
  estado: EstadoProducto;
}

export const FILTROS_VACIOS: FiltrosProductos = {
  q: '',
  categoria: '',
  negocio: '',
  division: '',
  estado: 'disponible',
};

/** ¿Este producto sobrevive al recorte? Puro, para poder interrogarlo sin montar la pantalla. */
export function pasaElFiltro(p: ProductoCatalogo, f: FiltrosProductos): boolean {
  if (f.estado === 'disponible' && !p.disponible) return false;
  if (f.estado === 'no_disponible' && p.disponible) return false;
  if (f.negocio && p.negocio !== f.negocio) return false;
  if (f.division && p.division !== f.division) return false;
  if (f.categoria && p.categoria !== f.categoria) return false;
  const q = f.q.trim().toLowerCase();
  if (q && !p.nombre.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
  return true;
}

export function filtrarProductos(productos: readonly ProductoCatalogo[], f: FiltrosProductos): ProductoCatalogo[] {
  return productos.filter((p) => pasaElFiltro(p, f));
}

/** Los valores de un campo que de verdad existen en ESTE catálogo, alfabético — nunca una lista a mano. */
function valoresDe(productos: readonly ProductoCatalogo[], campo: 'categoria' | 'negocio' | 'division'): string[] {
  return [...new Set(productos.map((p) => p[campo]).filter((v) => v !== ''))].sort((a, b) => a.localeCompare(b, 'es'));
}

export const categoriasDe = (productos: readonly ProductoCatalogo[]): string[] => valoresDe(productos, 'categoria');
export const negociosDe = (productos: readonly ProductoCatalogo[]): string[] => valoresDe(productos, 'negocio');
export const divisionesDe = (productos: readonly ProductoCatalogo[]): string[] => valoresDe(productos, 'division');

/**
 * Cuántos productos tiene cada valor de un campo, EN EL RECORTE ACTUAL — pero
 * sin el filtro de ESE MISMO campo (mismo criterio que las facetas del
 * padrón, `padron/donde.ts`): si se contara con «Curso Online» ya tildado, el
 * chip de «E-Book» mostraría 0 y no habría forma de ver cuánto tiene para
 * agregarlo. El número que se ve al lado de cada opción es lo que ESA opción
 * agregaría, no lo que ya está.
 */
function conteosDe(
  productos: readonly ProductoCatalogo[],
  sinPropioFiltro: FiltrosProductos,
  campo: 'categoria' | 'negocio' | 'division',
): Map<string, number> {
  const base = filtrarProductos(productos, sinPropioFiltro);
  const conteos = new Map<string, number>();
  for (const p of base) {
    if (p[campo] === '') continue;
    conteos.set(p[campo], (conteos.get(p[campo]) ?? 0) + 1);
  }
  return conteos;
}

export const conteosPorCategoria = (productos: readonly ProductoCatalogo[], f: FiltrosProductos) =>
  conteosDe(productos, { ...f, categoria: '' }, 'categoria');
export const conteosPorNegocio = (productos: readonly ProductoCatalogo[], f: FiltrosProductos) =>
  conteosDe(productos, { ...f, negocio: '' }, 'negocio');
export const conteosPorDivision = (productos: readonly ProductoCatalogo[], f: FiltrosProductos) =>
  conteosDe(productos, { ...f, division: '' }, 'division');
