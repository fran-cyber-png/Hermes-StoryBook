import type { HechoDelCatalogo } from '../hechos/catalogo';

/**
 * EL PRECIO Y EL PAGO POR PAÍS DE UN PRODUCTO — lo que la hoja muestra debajo del
 * precio en dólares, y que no sale de Cerberus sino de los Datos (tabla `hechos`).
 *
 * ── LA CONVENCIÓN QUE SE LEE, Y POR QUÉ ES UNA CONVENCIÓN ──
 * El país vive en la CLAVE del dato: `precio-peru`, `pago-mexico`,
 * `pago-panama-guatemala-rd`, `precio-otros-paises`. No se inventó acá: es como
 * están escritas las doce filas de producción (medido el 10-sep-2026), y se fija
 * con test para que un dato nuevo que la rompa se note en vez de desaparecer.
 *
 * ── A QUÉ PRODUCTO LE CORRESPONDE CADA UNO (ADR 0106) ──
 * La llave es `familia`, la familia del SKU (`DIPICOT`), **nunca el nombre**:
 *   · un `precio-*` se muestra SOLO en la hoja de su familia. Uno sin familia no se
 *     muestra en ninguna: los cuatro de producción dicen «el diploma cuesta S/ 500»
 *     sin decir cuál, y colgarlos de todos los productos haría cotizar Oratoria con
 *     el precio de Inteligencia;
 *   · un `pago-*` sin familia vale para todos (una cuenta de banco no depende del
 *     curso), y uno CON familia sólo para la suya — lo específico gana, igual que el
 *     SKU le gana al alias de texto (ADR 0060).
 *
 * `yape` queda afuera a propósito: repite `pago-peru` con otro formato, y dos
 * formas de pagar en Perú que dicen lo mismo son una de más.
 */

export type TipoPorPais = 'precio' | 'pago';

/** El orden en que se ofrecen los países: el de la gente que escribe, no el alfabeto. */
const PAISES_CONOCIDOS: readonly (readonly [string, string])[] = [
  ['peru', 'Perú'],
  ['mexico', 'México'],
  ['bolivia', 'Bolivia'],
  ['ecuador', 'Ecuador'],
  ['usa', 'EE. UU.'],
  ['panama-guatemala-rd', 'Panamá · Guatemala · RD'],
  ['otros-paises', 'Otros países'],
  // No es un país: es «pagar con tarjeta desde cualquiera». Va último por eso.
  ['link-tarjeta', 'Con tarjeta'],
];

const NOMBRE_DE_PAIS = new Map(PAISES_CONOCIDOS);
const ORDEN_DE_PAIS = new Map(PAISES_CONOCIDOS.map(([pais], i) => [pais, i]));

/**
 * `precio-por-pais` NO es un país: es la instrucción que le pide al bot dar sólo el
 * precio del país del lead (hoy apagada). Sin esta excepción, el día que alguien la
 * prendiera aparecería un país llamado «Por pais».
 */
const CLAVES_QUE_NO_SON_PAIS = new Set(['precio-por-pais']);

export function paisDeClave(clave: string): { tipo: TipoPorPais; pais: string } | null {
  if (CLAVES_QUE_NO_SON_PAIS.has(clave)) return null;
  const m = /^(precio|pago)-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(clave);
  return m ? { tipo: m[1] as TipoPorPais, pais: m[2] } : null;
}

/** «panama-guatemala-rd» → el nombre conocido; uno nuevo se muestra con su propia clave, legible. */
export function nombreDePais(pais: string): string {
  const conocido = NOMBRE_DE_PAIS.get(pais);
  if (conocido) return conocido;
  const legible = pais.replace(/-/g, ' ');
  return legible.charAt(0).toUpperCase() + legible.slice(1);
}

export interface DatoPorPais {
  pais: string;
  nombre: string;
  precio: HechoDelCatalogo | null;
  pago: HechoDelCatalogo | null;
}

const mismaFamilia = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

/**
 * Los países que tienen algo que decir sobre ESTE producto. Vacío = la hoja no
 * dibuja la sección (regla del cero).
 */
export function datosPorPais(hechos: readonly HechoDelCatalogo[], familia: string): DatoPorPais[] {
  const porPais = new Map<string, DatoPorPais>();
  for (const h of hechos) {
    if (!h.activo) continue;
    const c = paisDeClave(h.clave);
    if (!c) continue;
    const suFamilia = h.familia ?? null;
    const aplica = suFamilia ? mismaFamilia(suFamilia, familia) : c.tipo === 'pago';
    if (!aplica) continue;

    const dato = porPais.get(c.pais) ?? { pais: c.pais, nombre: nombreDePais(c.pais), precio: null, pago: null };
    const previo = dato[c.tipo];
    // Si hay uno de la familia y uno general para el mismo país, gana el de la familia.
    if (!previo || (suFamilia && !previo.familia)) dato[c.tipo] = h;
    porPais.set(c.pais, dato);
  }

  return [...porPais.values()].sort((a, b) => {
    const oa = ORDEN_DE_PAIS.get(a.pais) ?? Number.MAX_SAFE_INTEGER;
    const ob = ORDEN_DE_PAIS.get(b.pais) ?? Number.MAX_SAFE_INTEGER;
    return oa - ob || a.nombre.localeCompare(b.nombre, 'es');
  });
}
