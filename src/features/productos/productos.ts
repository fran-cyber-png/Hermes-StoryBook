import { useQuery } from '@tanstack/react-query';
import { colorDeCurso } from '../../dominio/curso';
import type { ColorCategoria } from '../../dominio/paletaCategorias';
import { api } from '../../lib/datos/cliente';
import { familiaDeProducto } from '../../lib/producto';

/**
 * EL CATÁLOGO DE PRODUCTOS DE CERBERUS, POR NEGOCIO — el modelo de la vista
 * «Productos» (ADR 0106, que reemplaza a la tabla de una fila por SKU).
 *
 * Trae los ~350 productos de una sola vez (`GET /api/productos`, sin paginación
 * server-side: Cerberus tampoco pagina el endpoint público de donde sale) y todo lo
 * demás —agrupar, recortar, contar— pasa en el navegador. Es una elección deliberada
 * y no pereza: replicar acá el filtrado server-side que sí necesita el padrón
 * (`padron/donde.ts`, 72.923 filas) sería resolver un problema de escala que este
 * catálogo no tiene.
 *
 * ── LA UNIDAD ES EL PRODUCTO, NO LA EDICIÓN ──────────────────────────────────
 * La vista vieja pintaba una fila por SKU: «Oratoria para Políticos 4, 5, 6, 7, 8, 9»
 * eran seis filas con el mismo precio. Medido el 10-sep-2026: los **252 SKUs a la
 * venta son 196 productos** (Escuela 99 · Editorial 62 · LifeStyle 28 · Consultoría 7).
 * ⚠️ Desde el 12-sep-2026 Consultoría **no llega**: el server la recorta para el área de
 * ventas (`cerberus/negociosDeVentas.ts`, enmienda a ADR 0106). Acá no hay lista de
 * negocios: se dibujan los que vienen.
 *
 * ── «DISPONIBLE» NO QUIERE DECIR «SE VENDE HOY» ──────────────────────────────
 * DIPICOT tiene **23 de sus 28 ediciones marcadas Disponible**, de la 1 a la 27, con
 * siete combinaciones de precio distintas (de USD 85 a USD 250). Por eso un producto
 * muestra su edición VIGENTE —la de número más alto entre las que están a la venta—
 * y no «23 a la venta», que sería repetir como dato lo que en Cerberus es un olvido.
 *
 * ── NEGOCIO MANDA, Y LO DE ABAJO SE RECORTA SOLO ─────────────────────────────
 * Pedido del dueño (10-sep-2026): «principal debe ser filtro de negocios y los demás
 * deben ser adaptables». División y Categoría se cuentan DENTRO del negocio elegido,
 * y un selector con una sola opción no se dibuja (regla del cero): en LifeStyle ›
 * Inteligencia la única categoría es Merchadising, así que preguntar «¿qué
 * categoría?» sería una pregunta con una sola respuesta.
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
  /**
   * La URL absoluta de la imagen del producto, o `null`. **OPCIONAL** por dos motivos:
   * un server viejo (o el caché de IndexedDB, ADR 0007) no la manda, y hoy Cerberus
   * tampoco: `tb_producto.imagen_producto` existe pero su API pública no la publica
   * (10-sep-2026). El server ya la lee si aparece (`server/src/cerberus/productos.ts`).
   */
  imagen?: string | null;
}

/**
 * El catálogo público de Cerberus (`/productos/api/public/productos-cursos/`)
 * NUNCA manda la moneda de `precio_normal`/`precio_promocion` — `p.moneda` llega
 * `''` para todos los productos, medido el 20-ago-2026 y otra vez el 10-sep.
 * Confirmado con el dueño: el catálogo entero está en USD. Se rotula acá, UNA vez,
 * en vez de confiar en `p.moneda` (que seguiría vacía) — el día que Cerberus la
 * mande, este archivo es el único lugar que hay que tocar.
 */
export const MONEDA_DEL_CATALOGO = 'USD';

/**
 * `activo = false` APAGA LA CONSULTA, no sólo el dibujo: `/api/productos` es superficie
 * de `ventas` y a la campaña le contesta 403. Pedirlo igual es el defecto de ADR 0063
 * (un 403 en cada apertura, dos veces por el `retry`, haciendo cola en el pool).
 */
export function useCatalogoProductos(activo = true) {
  return useQuery({
    queryKey: ['productos', 'catalogo'],
    queryFn: () => api<{ productos: ProductoCatalogo[] }>('/api/productos'),
    enabled: activo,
    select: (d) => d.productos,
    // El catálogo no cambia mientras se lo mira: cinco minutos evita repreguntarle
    // a Cerberus cada vez que la vendedora vuelve a esta vista en la sesión.
    staleTime: 5 * 60_000,
  });
}

/** Sin acentos y en minúsculas — para comparar, nunca para mostrar. */
function plano(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Familia y edición desde el SKU, con la receta de `server/src/plantillas/familias.ts`
 * y **no** con la de `server/src/cursos/catalogo.ts`: ésa lee el `8` de
 * `DIPCOCO002-BFA8` como número de edición (así elige la 002 cuando la vigente es la
 * 004) y junta `PK2LIB0000…PK8LIB0000`, que son siete packs distintos, en una
 * familia «PK». Es el issue #937, y **se cita, no se arregla acá**: la receta única
 * con test de paridad (candado 3 de `CLAUDE.md`) es ese frente.
 */
export function familiaYEdicion(sku: string): { familia: string; edicion: number | null } {
  const limpio = sku.trim().toUpperCase();
  // Los genéricos (`GEN5C4BE8`) no siguen `<PREFIJO><NNN>`: cada uno es su familia.
  if (limpio.startsWith('GEN')) return { familia: limpio, edicion: null };
  const m = /^([A-Z]+)(\d+)(?:-[A-Z0-9]+)?$/.exec(limpio);
  return m ? { familia: m[1], edicion: Number(m[2]) } : { familia: limpio, edicion: null };
}

/** El nombre sin el número de edición del final — la misma poda que `plantillas/familias.ts`. */
function sinNumeroFinal(nombre: string): string {
  return nombre
    .trim()
    .replace(/[\s\-–—:]*\b(?:n[°º.]?\s*)?\d{1,3}\s*$/i, '')
    .replace(/[\s\-–—:]+$/, '')
    .trim();
}

const PALABRAS_SIN_INICIAL = new Set(['y', 'e', 'o', 'u', 'de', 'del', 'la', 'las', 'el', 'los', 'en', 'para', 'por', 'con', 'a', 'al']);

/** Dos letras para la portada sin foto: «Inteligencia y Contrainteligencia» → «IC». */
export function inicialesDe(nombreCorto: string): string {
  const palabras = nombreCorto
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w) && !PALABRAS_SIN_INICIAL.has(plano(w)));
  if (palabras.length === 0) return nombreCorto.trim().slice(0, 1).toUpperCase();
  return palabras
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export interface Producto {
  /** El prefijo del SKU (`DIPICOT`). Identidad para agrupar — **nunca** un rótulo (ADR 0060). */
  familia: string;
  /** El nombre de la edición vigente, sin su número. */
  nombre: string;
  /** La edición que manda: la de número más alto entre las que están a la venta, o entre todas si ninguna lo está. */
  vigente: ProductoCatalogo;
  edicionVigente: number | null;
  /** Las ediciones marcadas Disponible, de la más nueva a la más vieja. */
  aLaVenta: ProductoCatalogo[];
  deBaja: ProductoCatalogo[];
  negocio: string;
  division: string;
  categoria: string;
  /**
   * La imagen de la vigente y, si no tiene, la de la edición más nueva que sí tenga:
   * las 23 ediciones de DIPICOT comparten el mismo flyer, y que la 27 todavía no lo
   * tenga cargado no es motivo para mostrar la portada sin foto.
   */
  imagen: string | null;
  /**
   * El color con el que la COLA ya pinta este curso: `colorDeCurso` sobre la misma
   * llave que arma `cursoDeFila` (la familia del NOMBRE, porque la cola no tiene SKU).
   * Mismo curso, mismo color, en las dos pantallas.
   */
  color: ColorCategoria;
  iniciales: string;
}

/** La edición más nueva primero; sin número, desempata el alta más reciente en Cerberus. */
function masNuevaPrimero(a: ProductoCatalogo, b: ProductoCatalogo): number {
  const ea = familiaYEdicion(a.sku).edicion ?? -1;
  const eb = familiaYEdicion(b.sku).edicion ?? -1;
  if (ea !== eb) return eb - ea;
  return Number(b.id) - Number(a.id);
}

export function agruparEnProductos(catalogo: readonly ProductoCatalogo[]): Producto[] {
  const porFamilia = new Map<string, ProductoCatalogo[]>();
  for (const p of catalogo) {
    // Un SKU vacío (0 de 352 medidos) no puede juntarse con otro SKU vacío.
    const clave = familiaYEdicion(p.sku).familia || `ID:${p.id}`;
    const grupo = porFamilia.get(clave);
    if (grupo) grupo.push(p);
    else porFamilia.set(clave, [p]);
  }

  return [...porFamilia].map(([familia, ediciones]) => {
    const ordenadas = [...ediciones].sort(masNuevaPrimero);
    const aLaVenta = ordenadas.filter((p) => p.disponible);
    const vigente = aLaVenta[0] ?? ordenadas[0];
    const deLaCola = familiaDeProducto(null, vigente.nombre);
    const conImagen = [vigente, ...ordenadas].find((p) => p.imagen);
    return {
      familia,
      nombre: sinNumeroFinal(vigente.nombre) || vigente.nombre,
      vigente,
      edicionVigente: familiaYEdicion(vigente.sku).edicion,
      aLaVenta,
      deBaja: ordenadas.filter((p) => !p.disponible),
      negocio: vigente.negocio,
      division: vigente.division,
      categoria: vigente.categoria,
      imagen: conImagen?.imagen ?? null,
      color: colorDeCurso(deLaCola.familia),
      iniciales: inicialesDe(deLaCola.nombreCorto),
    };
  });
}

export interface Recorte {
  /** Nunca vacío en pantalla: es el filtro principal. */
  negocio: string;
  /** `''` = todas. */
  division: string;
  /** `''` = todas. */
  categoria: string;
  q: string;
  /** `false` = sólo productos con alguna edición a la venta. */
  conBajas: boolean;
}

/** El negocio de Hermes: es el que atiende la vista si nadie eligió otro. */
export const NEGOCIO_POR_DEFECTO = 'Escuela';

export const RECORTE_INICIAL: Recorte = {
  negocio: NEGOCIO_POR_DEFECTO,
  division: '',
  categoria: '',
  q: '',
  conBajas: false,
};

export interface Opcion {
  valor: string;
  cuantos: number;
}

const estaALaVenta = (p: Producto) => p.aLaVenta.length > 0;

function pasaEstado(p: Producto, r: Recorte): boolean {
  return r.conBajas || estaALaVenta(p);
}

/** Busca en el nombre y el SKU de CUALQUIER edición: quien tipea «DIPICOT014» busca el producto, no la fila. */
function pasaBusqueda(p: Producto, q: string): boolean {
  const buscado = plano(q);
  if (!buscado) return true;
  const ediciones = [...p.aLaVenta, ...p.deBaja];
  return ediciones.some((e) => plano(e.nombre).includes(buscado) || plano(e.sku).includes(buscado));
}

function contar(productos: readonly Producto[], campo: (p: Producto) => string): Map<string, number> {
  const conteos = new Map<string, number>();
  for (const p of productos) {
    const v = campo(p);
    if (v !== '') conteos.set(v, (conteos.get(v) ?? 0) + 1);
  }
  return conteos;
}

const alfabetico = (a: Opcion, b: Opcion) => a.valor.localeCompare(b.valor, 'es');

/**
 * Los negocios, **siempre todos**: el filtro principal no se esconde nunca. El ORDEN
 * sale del catálogo entero (el más grande primero) y NO de la búsqueda, para que los
 * botones no bailen mientras se tipea; lo que sí sigue a la búsqueda es el número.
 */
export function negociosDe(productos: readonly Producto[], r: Recorte): Opcion[] {
  const orden = contar(
    productos.filter((p) => pasaEstado(p, r)),
    (p) => p.negocio,
  );
  const conBusqueda = contar(
    productos.filter((p) => pasaEstado(p, r) && pasaBusqueda(p, r.q)),
    (p) => p.negocio,
  );
  return [...orden]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([valor]) => ({ valor, cuantos: conBusqueda.get(valor) ?? 0 }));
}

/**
 * El negocio que se abre: el que la vendedora eligió la última vez si todavía existe
 * en el catálogo, y si no el de Hermes. Uno guardado que Cerberus ya no tiene no
 * puede dejar la vista vacía y sin ningún botón encendido.
 */
export function negocioInicial(productos: readonly Producto[], guardado: string | null): string {
  const existentes = new Set(productos.map((p) => p.negocio));
  if (guardado && existentes.has(guardado)) return guardado;
  if (existentes.has(NEGOCIO_POR_DEFECTO)) return NEGOCIO_POR_DEFECTO;
  return negociosDe(productos, RECORTE_INICIAL)[0]?.valor ?? NEGOCIO_POR_DEFECTO;
}

/** Las divisiones que existen DENTRO del negocio elegido. */
export function divisionesDe(productos: readonly Producto[], r: Recorte): Opcion[] {
  const base = productos.filter((p) => pasaEstado(p, r) && pasaBusqueda(p, r.q) && p.negocio === r.negocio);
  return [...contar(base, (p) => p.division)].map(([valor, cuantos]) => ({ valor, cuantos })).sort(alfabetico);
}

/** Las categorías que existen dentro del negocio Y de la división elegida. */
export function categoriasDe(productos: readonly Producto[], r: Recorte): Opcion[] {
  const base = productos.filter(
    (p) =>
      pasaEstado(p, r) &&
      pasaBusqueda(p, r.q) &&
      p.negocio === r.negocio &&
      (r.division === '' || p.division === r.division),
  );
  return [...contar(base, (p) => p.categoria)].map(([valor, cuantos]) => ({ valor, cuantos })).sort(alfabetico);
}

/** Regla del cero: un selector con una sola opción es una pregunta con una sola respuesta. */
export const seDibuja = (opciones: readonly Opcion[]): boolean => opciones.length > 1;

/**
 * Lo que queda elegido abajo después de cambiar CUALQUIER cosa que recorta —el negocio,
 * la división, la búsqueda o lo dado de baja—. Un valor que ya no existe —o cuyo selector
 * dejó de dibujarse— se suelta: un filtro que la pantalla no muestra no puede seguir
 * recortando.
 */
function soltarLoQueNoExiste(productos: readonly Producto[], r: Recorte): Recorte {
  let siguiente = r;
  const divisiones = divisionesDe(productos, siguiente);
  if (siguiente.division && (!seDibuja(divisiones) || !divisiones.some((o) => o.valor === siguiente.division))) {
    siguiente = { ...siguiente, division: '' };
  }
  const categorias = categoriasDe(productos, siguiente);
  if (siguiente.categoria && (!seDibuja(categorias) || !categorias.some((o) => o.valor === siguiente.categoria))) {
    siguiente = { ...siguiente, categoria: '' };
  }
  return siguiente;
}

export function conNegocio(productos: readonly Producto[], r: Recorte, negocio: string): Recorte {
  return soltarLoQueNoExiste(productos, { ...r, negocio });
}

export function conDivision(productos: readonly Producto[], r: Recorte, division: string): Recorte {
  return soltarLoQueNoExiste(productos, { ...r, division });
}

/**
 * Buscar y prender o apagar lo dado de baja TAMBIÉN sueltan lo que se deja de ver (B1 de
 * la revisión cruzada de #961). `divisionesDe` y `categoriasDe` cuentan con la búsqueda
 * puesta, así que una búsqueda puede dejar UNA sola opción: medido, en Escuela ›
 * Inteligencia buscar «oratoria» deja sólo Estrategia Política. El selector se dejaba de
 * dibujar y `filtrar` seguía recortando por Inteligencia: «Nada con «oratoria»» con once
 * productos que sí existían.
 *
 * ⚠️ Lo que se suelta no vuelve al borrar la búsqueda. Un filtro que la pantalla dejó de
 * mostrar ya no es de la vendedora, y restaurarlo sin que lo vea sería el mismo defecto
 * al revés.
 */
export function conBusqueda(productos: readonly Producto[], r: Recorte, q: string): Recorte {
  return soltarLoQueNoExiste(productos, { ...r, q });
}

export function conBajas(productos: readonly Producto[], r: Recorte, conBajas: boolean): Recorte {
  return soltarLoQueNoExiste(productos, { ...r, conBajas });
}

/**
 * Los productos del recorte: primero lo que se puede cotizar y, dentro de eso, lo más
 * reciente primero (la edición recién dada de alta es la que se está vendiendo).
 *
 * El primer criterio lo pidió la captura, no un test: sin él, Editorial abría con los
 * siete packs de libros a precio 0 —los SKUs más nuevos del negocio—, o sea siete
 * tarjetas que no sirven para contestar «¿cuánto cuesta?». Siguen ahí, al final, con
 * su «Sin precio en Cerberus» a la vista.
 */
export function filtrar(productos: readonly Producto[], r: Recorte): Producto[] {
  const sinPrecio = (p: Producto) => (precioDe(p.vigente).sinPrecio ? 1 : 0);
  return productos
    .filter(
      (p) =>
        pasaEstado(p, r) &&
        pasaBusqueda(p, r.q) &&
        p.negocio === r.negocio &&
        (r.division === '' || p.division === r.division) &&
        (r.categoria === '' || p.categoria === r.categoria),
    )
    .sort((a, b) => sinPrecio(a) - sinPrecio(b) || Number(b.vigente.id) - Number(a.vigente.id));
}

/** Cuántos productos del recorte no tienen ninguna edición a la venta — el número del interruptor. */
export function dadosDeBajaEn(productos: readonly Producto[], r: Recorte): number {
  return filtrar(productos, { ...r, conBajas: true }).filter((p) => !estaALaVenta(p)).length;
}

export interface Precio {
  vigente: number;
  /** El precio normal, sólo cuando es MAYOR que el vigente: en 135 de 252 ediciones son el mismo número. */
  regular: number | null;
  /** 13 ediciones a la venta tienen precio 0 en Cerberus (los siete packs de libros, las cinco consultorías y un webinar). */
  sinPrecio: boolean;
  moneda: string;
}

export function precioDe(p: ProductoCatalogo): Precio {
  const vigente = p.precioPromocion > 0 ? p.precioPromocion : p.precioNormal;
  return {
    vigente,
    regular: p.precioNormal > vigente ? p.precioNormal : null,
    sinPrecio: vigente <= 0,
    moneda: p.moneda || MONEDA_DEL_CATALOGO,
  };
}

const FORMATO = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 });

export function monto(n: number, moneda: string = MONEDA_DEL_CATALOGO): string {
  return `${moneda} ${FORMATO.format(n)}`;
}

/**
 * La línea que «Copiar precio para el chat» deja en el portapapeles, en la voz de la
 * vendedora. `null` sin precio: copiar «USD 0» de un pack de ocho libros sería decirle
 * un precio falso a un lead.
 */
export function textoDePrecio(p: Producto): string | null {
  const precio = precioDe(p.vigente);
  if (precio.sinPrecio) return null;
  const vigente = monto(precio.vigente, precio.moneda);
  return precio.regular === null
    ? `${p.nombre}: ${vigente}.`
    : `${p.nombre}: ${vigente} (precio regular ${monto(precio.regular, precio.moneda)}).`;
}

export type Glifo = 'curso' | 'evento' | 'libro' | 'audio' | 'objeto' | 'merch' | 'servicio' | 'pack' | 'otro';

/** Las 14 categorías que Cerberus tiene hoy, con su ortografía de Cerberus («Fisico», «Merchadising»). */
const GLIFO_POR_CATEGORIA: Record<string, Glifo> = {
  'curso online': 'curso',
  'curso virtual': 'curso',
  'seminario online': 'evento',
  'seminario virtual': 'evento',
  'seminario presencial': 'evento',
  evento: 'evento',
  'e-book': 'libro',
  audiolibro: 'audio',
  audiocurso: 'audio',
  fisico: 'objeto',
  merchadising: 'merch',
  merchandising: 'merch',
  servicio: 'servicio',
  'pack de curso': 'pack',
  'pack de libro': 'pack',
};

/** Una categoría nueva no rompe nada: cae a `otro` y la portada dibuja el ícono genérico. */
export function glifoDe(categoria: string): Glifo {
  return GLIFO_POR_CATEGORIA[plano(categoria)] ?? 'otro';
}
