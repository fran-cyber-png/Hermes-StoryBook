import { DIMENSIONES, type Dimension, type FiltrosPadron } from './padron';
import { FACETAS, TOTAL_PADRON } from './galeriaDatos';

/**
 * QUÉ FILTRO SIMULA DE VERDAD ESTE MOCK, Y CUÁL NO — declarado, no adivinado.
 *
 * 🔴 **La galería mintió CUATRO veces el mismo día (24-ago-2026)**: facetas
 * incompletas → «Se perdió: 0»; un total fijo que no reaccionaba a los
 * repartos → «Quedan 73.145» después de repartir 4; el mock sin cruzar
 * etapa/curso/asignadoA → un atajo clickeado que no movía el total; y
 * `asignadoA`/`entroPorLinea` anidados mal en el TIPO del front (ver
 * `RespuestaFacetas` en `padron.ts`) — ese cuarto no era de la galería, pero
 * es la misma familia: un instrumento que afirma una forma sin que nadie la
 * compruebe contra la real.
 *
 * Este `Record` está tipado contra `keyof FiltrosPadron` a propósito: si el
 * server agrega un campo nuevo, TypeScript pone esto rojo hasta que alguien
 * decida — a mano, mirando la fila de abajo — si el mock lo simula o si
 * documenta por qué no. La decisión no puede quedar pendiente en silencio:
 * `galeriaFiltrado.test.ts` exige que todo lo marcado `'simulado'` de verdad
 * baje el total.
 */
export const COBERTURA_DE_FILTROS: Record<keyof FiltrosPadron, 'simulado' | 'no_aplica'> = {
  pais: 'simulado',
  curso: 'simulado',
  etapa: 'simulado',
  nivel: 'simulado',
  fuente: 'simulado',
  asignadoA: 'simulado',
  entroPorLinea: 'simulado',
  sinHabilitar: 'simulado',
  // Búsqueda libre: no hay un conteo previo que prometer (no es una faceta con
  // valores cerrados) — lo que hace falta probar es que las filas coincidan,
  // no que el total baje contra un número anunciado. Fuera del alcance de
  // este candado, que es sobre promesas numéricas.
  q: 'no_aplica',
  // Rango de fechas: mismo motivo que `q` — no hay una cifra anunciada de
  // antemano en ningún lado de la pantalla que este mock tenga que igualar.
  entroDesde: 'no_aplica',
  entroHasta: 'no_aplica',
  // Interruptores sin faceta propia detrás (no aparecen en ninguna franja de
  // atajos ni chip con conteo — se activan y se ve la tabla, no un número).
  conVenta: 'no_aplica',
  conTelefono: 'no_aplica',
  // Orden de la lista, no un recorte: no reduce nada, reordena lo mismo.
  orden: 'no_aplica',
  // Paginación: no es un filtro de contenido.
  pagina: 'no_aplica',
  porPagina: 'no_aplica',
};

/** Mismos tres nombres y cifras que `asignadoA.opciones` en `galeria.tsx`. */
export const CARGA_POR_VENDEDORA: Record<string, number> = {
  'ventas11@grupogoberna.com': 3383,
  'ventas12@grupogoberna.com': 1204,
  luz: 877,
};

/**
 * Ya hay 5.464 asignados de base ANTES de que esta sesión de galería reparta
 * nada — son los que `CARGA_POR_VENDEDORA` ya trae. `totalIlustrativo` los
 * tiene que descontar de «Sin asignar» igual que la faceta descuenta
 * `sinRepartir` en `galeria.tsx`: si no, con `repartidosIds` vacío (recién
 * abierta la página) «Sin asignar» daría el padrón ENTERO, idéntico a no
 * poner el filtro — lo que atrapó este mismo test en rojo la primera vez.
 */
export const YA_ASIGNADOS_DE_BASE = Object.values(CARGA_POR_VENDEDORA).reduce((s, n) => s + n, 0);

/** Mismos nombres y cifras que `entroPorLinea` en `galeria.tsx` — medido en
 * producción el 24-ago-2026 (#605): «Ventas Meta» es la línea con más gente
 * sin repartir y la que mejor convierte de todo el padrón. */
export const LINEAS_DE_ENTRADA: { valor: string; etiqueta: string; contactos: number }[] = [
  { valor: '51984429504', etiqueta: 'Ventas Meta', contactos: 3272 },
  { valor: '51986394450', etiqueta: 'Ventas Perú', contactos: 1840 },
  { valor: '51987654321', etiqueta: 'Betto', contactos: 612 },
];

/**
 * EL TOTAL ILUSTRATIVO — una aproximación de una sola dimensión a la vez.
 *
 * ⚠️ **No cruza dimensiones entre sí** (pedir país Y curso a la vez no suma
 * las dos restricciones, gana la primera que tenga algo puesto): el server
 * real sí las cruza (AND entre dimensiones), pero replicar eso acá pediría
 * una tabla de contingencia que nadie midió. Alcanza para lo que la franja de
 * atajos necesita — cada atajo pone COMO MUCHO una dimensión a la vez.
 *
 * ⚠️ **Tampoco cruza con `sinHabilitar` cuando hay una dimensión puesta**:
 * `FACETAS.etapa/curso/...` son conteos del PADRÓN ENTERO (lo prueba
 * `galeriaDatos.test.ts`, que sus sumas dan `TOTAL_PADRON`), no del recorte
 * «sin repartir». En producción, `atajosFacetas` pide con `sinHabilitar=true`
 * de base y el server SÍ cruza (la faceta excluye su propia dimensión pero
 * incluye las demás activas) — acá no hay datos medidos para ese cruce, así
 * que el número que se ve es el de la dimensión sola. Documentado, no
 * escondido: es la misma clase de honestidad que ya usa `contar-con-dueno`
 * («nadie midió esta intersección todavía»).
 */
export function totalIlustrativo(params: URLSearchParams, repartidosIds: ReadonlySet<number>): number {
  for (const dim of DIMENSIONES) {
    const seleccion = params.get(dim.id)?.split(',').filter(Boolean) ?? [];
    if (seleccion.length) {
      return FACETAS[dim.id].filter(([v]) => seleccion.includes(v)).reduce((s, [, n]) => s + n, 0);
    }
  }

  const asignadoASel = params.get('asignadoA')?.split(',').filter(Boolean) ?? [];
  if (asignadoASel.length) {
    return asignadoASel.reduce((s, v) => s + (CARGA_POR_VENDEDORA[v] ?? 0), 0);
  }

  // `entroPorLinea` no es una de las cinco `DIMENSIONES` ni `asignadoA` — es
  // el caso número cuatro que se anticipó (#605): si el mock no lo soporta,
  // «Ventas Meta · 3.272» clickeado deja el total clavado. Este test lo
  // habría atrapado solo, vía `COBERTURA_DE_FILTROS`.
  const lineaSel = params.get('entroPorLinea')?.split(',').filter(Boolean) ?? [];
  if (lineaSel.length) {
    return LINEAS_DE_ENTRADA.filter((l) => lineaSel.includes(l.valor)).reduce((s, l) => s + l.contactos, 0);
  }

  if (params.get('sinHabilitar') === 'true') return TOTAL_PADRON - YA_ASIGNADOS_DE_BASE - repartidosIds.size;
  return TOTAL_PADRON;
}

/** Las filas visibles del recorte de 12 contactos ilustrativos, para la MISMA
 * combinación de filtros que `totalIlustrativo` — misma lógica, alcance más
 * chico (doce filas, no 73.145). */
export function filtrarContactosIlustrativos<
  T extends { id: number; etapa: string; curso: string | null; pais: string; nivel: string; fuente: string },
>(todos: T[], params: URLSearchParams, repartidosIds: ReadonlySet<number>): T[] {
  const sinHabilitar = params.get('sinHabilitar') === 'true';
  const seleccionPorDimension: Partial<Record<Dimension, string[]>> = {};
  for (const dim of DIMENSIONES) {
    const seleccion = params.get(dim.id)?.split(',').filter(Boolean) ?? [];
    if (seleccion.length) seleccionPorDimension[dim.id] = seleccion;
  }

  return todos.filter((c) => {
    if (sinHabilitar && repartidosIds.has(c.id)) return false;
    if (seleccionPorDimension.etapa && !seleccionPorDimension.etapa.includes(c.etapa)) return false;
    if (seleccionPorDimension.curso && !(c.curso && seleccionPorDimension.curso.includes(c.curso))) return false;
    if (seleccionPorDimension.pais && !seleccionPorDimension.pais.includes(c.pais)) return false;
    if (seleccionPorDimension.nivel && !seleccionPorDimension.nivel.includes(c.nivel)) return false;
    if (seleccionPorDimension.fuente && !seleccionPorDimension.fuente.includes(c.fuente)) return false;
    return true;
  });
}
