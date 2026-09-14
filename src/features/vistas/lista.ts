import { claveDeVendedora, mismaVendedora, nombreCorto } from '../../dominio/dueno';
import { tarjetasVisibles, type EtapaTrabajo, type Recorte, type TarjetaTablero } from './tablero';

/**
 * LA LISTA DEL PIPELINE — el mismo tablero, dicho en filas. La política, sin DOM.
 *
 * La Lista no pide nada propio: muestra lo que las columnas ya cargaron, con los
 * mismos recortes (`tarjetasVisibles`). Si Tablero y Lista mostraran conjuntos
 * distintos con los mismos filtros puestos, cambiar de vista cambiaría la
 * respuesta. Lo que agrega es lo que una tabla hace mejor que un tablero:
 * ordenar por cualquier columna y, para quien supervisa, filtrar por dueña.
 */

export interface FilaDeLista<C> {
  c: C;
  etapa: EtapaTrabajo;
}

/** Una fila por tarjeta visible, en el orden de las columnas del tablero. */
export function filasDeLista<C extends TarjetaTablero>(
  columnas: readonly { id: EtapaTrabajo }[],
  repartidas: ReadonlyMap<EtapaTrabajo, readonly C[]>,
  recorteDe: (etapa: EtapaTrabajo) => Recorte,
): FilaDeLista<C>[] {
  return columnas.flatMap((col) =>
    tarjetasVisibles(repartidas.get(col.id) ?? [], recorteDe(col.id)).map((c) => ({ c, etapa: col.id })),
  );
}

/**
 * El valor del filtro para «las que nadie tiene asignadas». Empieza con `:`
 * para que no pueda chocar con un username: `nombreCorto` ya trata lo que va
 * antes de un `:` como namespace, así que ningún id normalizado empieza así.
 */
export const SIN_ASIGNAR = ':sin-asignar';

/**
 * Filtra por dueña: `''` = todas · `SIN_ASIGNAR` = las que no tiene nadie · o un
 * username. Compara normalizando LOS DOS lados (`mismaVendedora`, candado 4):
 * Cerberus empuja `Luz` y ella entra como `luz`, y comparar exacto no da error —
 * da que su fila no aparece bajo su nombre.
 */
export function filtrarPorAsignada<F extends { c: { asignada_a?: string | null } }>(
  filas: readonly F[],
  filtro: string,
): F[] {
  if (!filtro) return [...filas];
  if (filtro === SIN_ASIGNAR) return filas.filter((f) => !claveDeVendedora(f.c.asignada_a));
  return filas.filter((f) => mismaVendedora(f.c.asignada_a ?? '', filtro));
}

export interface OpcionDeAsignada {
  valor: string;
  rotulo: string;
  n: number;
}

/**
 * Las opciones del filtro, sacadas de lo CARGADO y no del equipo entero: una
 * persona que no aparece en ninguna fila sería una opción que vacía la lista.
 * Por lo mismo «Sin asignar» sólo se ofrece si hay alguna, y va primera porque
 * para quien supervisa es la pregunta de todos los días.
 */
export function opcionesDeAsignada(filas: readonly { c: { asignada_a?: string | null } }[]): OpcionDeAsignada[] {
  let sinAsignar = 0;
  const personas = new Map<string, OpcionDeAsignada>();
  for (const { c } of filas) {
    const clave = claveDeVendedora(c.asignada_a);
    if (!clave) {
      sinAsignar++;
      continue;
    }
    const previa = personas.get(clave);
    if (previa) previa.n++;
    else personas.set(clave, { valor: clave, rotulo: nombreCorto(c.asignada_a ?? ''), n: 1 });
  }
  const ordenadas = [...personas.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'es'));
  return sinAsignar > 0 ? [{ valor: SIN_ASIGNAR, rotulo: 'Sin asignar', n: sinAsignar }, ...ordenadas] : ordenadas;
}
