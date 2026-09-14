import { DIMENSIONES, type FiltrosPadron } from './padron';
import { FACETAS, SIN_ASIGNAR } from './galeriaDatos';

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

/** Mismos nombres que `entroPorLinea` en `galeria.tsx`. «Ventas Meta» es la
 * cifra de la captura del dueño del 10-sep-2026 (era 3.272 el 24-ago, #605); las
 * otras dos siguen siendo las del 24-ago — no salen en esa captura. */
export const LINEAS_DE_ENTRADA: { valor: string; etiqueta: string; contactos: number }[] = [
  { valor: '51984429504', etiqueta: 'Ventas Meta', contactos: SIN_ASIGNAR.ventasMeta },
  { valor: '51986394450', etiqueta: 'Ventas Perú', contactos: 1840 },
  { valor: '51987654321', etiqueta: 'Betto', contactos: 612 },
];

/**
 * EL PADRÓN ENTERO DE HOY, ilustrativo: los 73.200 sin asignar de la captura del
 * 10-sep más los asignados de base de este fixture. No es una medición — no hubo
 * forma de medirlo —, es la única cifra que deja a «Todos» por encima de «Sin
 * asignar», que es lo mínimo que tiene que cumplir.
 */
export const PADRON_HOY = SIN_ASIGNAR.total + YA_ASIGNADOS_DE_BASE;

/**
 * EL TOTAL ILUSTRATIVO — una aproximación de una sola dimensión a la vez.
 *
 * ⚠️ **No cruza dimensiones entre sí** (pedir país Y curso a la vez no suma
 * las dos restricciones, gana la primera que tenga algo puesto): el server
 * real sí las cruza (AND entre dimensiones), pero replicar eso acá pediría
 * una tabla de contingencia que nadie midió. Alcanza para lo que la franja de
 * atajos necesita — cada atajo pone COMO MUCHO una dimensión a la vez.
 *
 * ⚠️ **Con `sinHabilitar` cruza SÓLO la etapa**, que es lo que las vistas de
 * la pantalla prometen con número (`SIN_ASIGNAR`, captura del 10-sep). Curso,
 * país, nivel y fuente siguen siendo conteos del PADRÓN ENTERO del 24-ago (lo
 * prueba `galeriaDatos.test.ts`, que sus sumas dan `TOTAL_PADRON`): en
 * producción el server SÍ los cruza, pero acá no hay datos medidos para ese
 * cruce, así que el número que se ve es el de la dimensión sola. Documentado,
 * no escondido: es la misma clase de honestidad que ya usa `contar-con-dueno`
 * («nadie midió esta intersección todavía»).
 */
export function totalIlustrativo(params: URLSearchParams, repartidosIds: ReadonlySet<number>): number {
  const lista = (clave: string) => params.get(clave)?.split(',').filter(Boolean) ?? [];
  const sinHabilitar = params.get('sinHabilitar') === 'true';

  // Las vistas «sin asignar» de la pantalla cruzan una dimensión con
  // `sinHabilitar`, y ESAS cifras sí salen de la captura del 10-sep: sin este
  // cruce, la vista prometería «En negociación · 5.792» y la tabla contaría los
  // 5.796 del padrón entero — la galería mintiendo sobre su propia promesa.
  if (sinHabilitar && lista('etapa').length) {
    const etapa = lista('etapa');
    return SIN_ASIGNAR.etapa.filter(([v]) => etapa.includes(v)).reduce((s, [, n]) => s + n, 0);
  }

  for (const dim of DIMENSIONES) {
    const seleccion = lista(dim.id);
    if (seleccion.length) {
      return FACETAS[dim.id].filter(([v]) => seleccion.includes(v)).reduce((s, [, n]) => s + n, 0);
    }
  }

  const asignadoASel = lista('asignadoA');
  if (asignadoASel.length) {
    return asignadoASel.reduce((s, v) => s + (CARGA_POR_VENDEDORA[v] ?? 0), 0);
  }

  // `entroPorLinea` no es una de las cinco `DIMENSIONES` ni `asignadoA` — es
  // el caso número cuatro que se anticipó (#605): si el mock no lo soporta,
  // «Ventas Meta» clickeado deja el total clavado. Este test lo habría
  // atrapado solo, vía `COBERTURA_DE_FILTROS`.
  const lineaSel = lista('entroPorLinea');
  if (lineaSel.length) {
    return LINEAS_DE_ENTRADA.filter((l) => lineaSel.includes(l.valor)).reduce((s, l) => s + l.contactos, 0);
  }

  if (sinHabilitar) return SIN_ASIGNAR.total - repartidosIds.size;
  return PADRON_HOY;
}
