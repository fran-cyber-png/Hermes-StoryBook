import { mismaVendedora } from '../../dominio/dueno';
import {
  chipsDeGrupos,
  contactosDelGrupo,
  ETAPA_GRUPOS,
  NIVEL_GRUPOS,
  type OpcionFaceta,
} from '../../dominio/segmentosPadron';
import {
  DIMENSIONES,
  nombreCorto,
  TOGGLES,
  type CargaVendedora,
  type FiltrosPadron,
  type OpcionLinea,
} from './padron';

/**
 * LAS VISTAS DEL PADRÓN — el «Sin asignar ▾» con que abre la tabla (ADR 0102).
 *
 * ══ QUÉ REEMPLAZA ═══════════════════════════════════════════════════════════
 * La franja «Para repartir hoy» (24-ago-2026): cuatro atajos y un desplegable en
 * una fila propia, más la fila de chips que con el default del supervisor no se
 * iba nunca. Una vista hace lo mismo que hacía un atajo —un recorte que
 * REEMPLAZA al que estaba, no uno que se suma— pero vive adentro de un selector.
 *
 * ══ POR QUÉ LA VISTA SE DERIVA Y NO SE GUARDA ═══════════════════════════════
 * Los filtros se tocan desde tres lados: la vista, el panel lateral y los chips.
 * Con «la vista elegida» guardada aparte, destildar «Sin asignar» en el panel
 * dejaría al selector diciendo «Sin asignar» sobre una tabla que ya no lo es.
 * `vistaVigente` pregunta cuál de las vistas está CONTENIDA en el filtro puesto,
 * y gana la más específica: no hay un segundo estado que pueda discrepar.
 *
 * Puro: nada de React ni de `fetch`.
 */

/** Lo que una vista pone: sólo claves de recorte, nunca la página ni el orden. */
export type FiltrosDeVista = Pick<FiltrosPadron, 'sinHabilitar' | 'etapa' | 'entroPorLinea' | 'asignadoA'>;

export interface VistaDelPadron {
  id: string;
  /** Cómo se lee adentro del menú. */
  rotulo: string;
  /** Cómo se lee en el disparador, ya puesta. */
  titulo: string;
  grupo: 'general' | 'para_repartir' | 'asignado';
  filtros: FiltrosDeVista;
  /** Cuántos trae. `undefined` mientras no haya una cifra que prometer: nunca un cero inventado. */
  contactos?: number;
}

/**
 * Los dos grupos de etapa que son TRABAJO ESPERANDO, los mismos de la franja
 * vieja: «Venta cerrada» y «Venta perdida» ya se resolvieron, y «Por contactar»
 * es el 84 % del padrón — demasiado grande para ser una vista de un clic.
 */
const GRUPOS_PARA_REPARTIR = ETAPA_GRUPOS.filter((g) => g.id === 'conversacion' || g.id === 'sin_cerrar');

export function vistasDelPadron({
  sinAsignar,
  carga,
}: {
  /**
   * Las facetas pedidas con `{ sinHabilitar: true }` FIJO, no con el filtro que
   * esté puesto: una vista es un punto de referencia («hoy hay 5.792 en
   * negociación sin asignar»), no un número que cambia según lo que se esté
   * mirando.
   */
  sinAsignar?: { etapa?: OpcionFaceta[]; sinRepartir?: number; lineas?: OpcionLinea[] | null };
  /**
   * 🔴 **La carga del reparto (`/api/padron/reparto`), y NO `asignadoA.opciones`
   * de esas facetas.** `facetaAsignadoA` cuenta dentro del recorte, y un recorte
   * «sin asignar» no tiene asignados por definición: el atajo viejo que leía de
   * ahí mostraba «Todavía nadie tiene nada asignado» con miles repartidos.
   */
  carga?: CargaVendedora[];
}): VistaDelPadron[] {
  const vistas: VistaDelPadron[] = [
    { id: 'todos', rotulo: 'Todos', titulo: 'Todos los contactos', grupo: 'general', filtros: {} },
    {
      id: 'sin_asignar',
      rotulo: 'Sin asignar',
      titulo: 'Sin asignar',
      grupo: 'para_repartir',
      filtros: { sinHabilitar: true },
      contactos: sinAsignar?.sinRepartir,
    },
  ];

  // La línea con más gente sin asignar, sin clavar cuál: hoy es «Ventas Meta», y
  // si mañana es otra, la vista apunta a esa sola.
  const linea = [...(sinAsignar?.lineas ?? [])].sort((a, b) => b.contactos - a.contactos)[0];
  if (linea) {
    vistas.push({
      id: `linea:${linea.valor}`,
      rotulo: linea.etiqueta,
      titulo: `${linea.etiqueta} sin asignar`,
      grupo: 'para_repartir',
      filtros: { sinHabilitar: true, entroPorLinea: [linea.valor] },
      contactos: linea.contactos,
    });
  }

  for (const g of GRUPOS_PARA_REPARTIR) {
    vistas.push({
      id: `etapa:${g.id}`,
      rotulo: g.rotulo,
      titulo: `${g.rotulo} sin asignar`,
      grupo: 'para_repartir',
      filtros: { sinHabilitar: true, etapa: [...g.valores] },
      contactos: sinAsignar?.etapa ? contactosDelGrupo(sinAsignar.etapa, g) : undefined,
    });
  }

  for (const c of [...(carga ?? [])].sort((a, b) => b.contactos - a.contactos)) {
    vistas.push({
      id: `asignado:${c.vendedoraId}`,
      rotulo: nombreCorto(c.vendedoraId),
      titulo: `Asignado a ${nombreCorto(c.vendedoraId)}`,
      grupo: 'asignado',
      filtros: { asignadoA: [c.vendedoraId] },
      contactos: c.contactos,
    });
  }

  return vistas;
}

const CAMPOS_LISTA = ['etapa', 'entroPorLinea', 'asignadoA'] as const;
type CampoLista = (typeof CAMPOS_LISTA)[number];

/**
 * ¿Es el mismo valor? Una dueña se compara con `mismaVendedora` —normalizando los
 * dos lados, candado #4: `Luz` y `luz` son la misma persona—; el resto, tal cual
 * viaja.
 */
function mismoValor(campo: CampoLista, a: string, b: string): boolean {
  return campo === 'asignadoA' ? mismaVendedora(a, b) : a === b;
}

function estaContenida(vista: FiltrosDeVista, filtros: FiltrosPadron): boolean {
  if (vista.sinHabilitar && filtros.sinHabilitar !== true) return false;
  return CAMPOS_LISTA.every((campo) =>
    (vista[campo] ?? []).every((pedido) => (filtros[campo] ?? []).some((puesto) => mismoValor(campo, pedido, puesto))),
  );
}

/** Cuántas condiciones pone una vista: la más específica gana. */
function peso(vista: FiltrosDeVista): number {
  return (vista.sinHabilitar ? 1 : 0) + CAMPOS_LISTA.filter((c) => (vista[c]?.length ?? 0) > 0).length;
}

/**
 * LA VISTA QUE ESTÁ PUESTA — la más específica de las contenidas en el filtro.
 * «Todos» no pone nada, así que siempre está contenida: con vistas, nunca da
 * `null`. Un empate lo gana la que aparece primero en el menú.
 */
export function vistaVigente(filtros: FiltrosPadron, vistas: readonly VistaDelPadron[]): VistaDelPadron | null {
  let mejor: VistaDelPadron | null = null;
  for (const v of vistas) {
    if (!estaContenida(v.filtros, filtros)) continue;
    if (!mejor || peso(v.filtros) > peso(mejor.filtros)) mejor = v;
  }
  return mejor;
}

/**
 * PONER UNA VISTA — REEMPLAZA el recorte, igual que los atajos de antes: si se
 * sumara, la cifra que la vista prometió no coincidiría con la tabla. Vuelve a la
 * página 1. El ORDEN se queda, y es lo único que cambia respecto del atajo: ya no
 * vive entre los filtros, así que cambiar de vista no tiene por qué pisarlo.
 *
 * Es también «Limpiar filtros»: volver a poner la vista vigente saca todo lo que
 * la refinaba y deja la vista.
 */
export function aplicarVista(filtros: FiltrosPadron, vista: VistaDelPadron): FiltrosPadron {
  return {
    pagina: 1,
    porPagina: filtros.porPagina ?? 50,
    ...(filtros.orden ? { orden: filtros.orden } : {}),
    ...vista.filtros,
  };
}

export interface ChipDelRecorte {
  llave: string;
  rotulo: string;
  /** El cambio que lo saca, ya calculado sobre el filtro REAL (no sobre lo que queda afuera de la vista). */
  quitar: Partial<FiltrosPadron>;
}

/** Los valores de `puestos` que la vista no puso. */
function fueraDeLaVista(campo: CampoLista, puestos: string[] | undefined, deLaVista: string[] | undefined): string[] {
  return (puestos ?? []).filter((v) => !(deLaVista ?? []).some((p) => mismoValor(campo, p, v)));
}

/**
 * LO QUE REFINA A LA VISTA, UN CHIP POR COSA.
 *
 * Lo que la vista puso NO es un chip: la vista ya lo dice en el disparador, y
 * repetirlo abajo es la fila «Sin repartir ×» que no se iba nunca. Con esto,
 * `chips.length` es el número de «Filtros N»: los dos cuentan lo mismo porque
 * salen de acá.
 *
 * ⚠️ **El texto buscado no es un chip**: ya está escrito en el buscador, con su
 * propia ×.
 *
 * Etapa y nivel van por GRUPO con su rótulo humano (`chipsDeGrupos`): elegir
 * «Contactado» dibuja un chip, no tres en inglés. Y el `quitar` de un grupo se
 * aplica sobre la lista real, así que sacar un refinamiento nunca se lleva los
 * valores que puso la vista.
 */
export function chipsDelRecorte(
  filtros: FiltrosPadron,
  vista: VistaDelPadron | null,
  lineas: OpcionLinea[] | null | undefined,
): ChipDelRecorte[] {
  const deLaVista = vista?.filtros ?? {};
  const chips: ChipDelRecorte[] = [];

  for (const d of DIMENSIONES) {
    if (d.id === 'etapa') {
      for (const chip of chipsDeGrupos('etapa', ETAPA_GRUPOS, fueraDeLaVista('etapa', filtros.etapa, deLaVista.etapa))) {
        chips.push({ llave: chip.llave, rotulo: chip.rotulo, quitar: { etapa: chip.quitar(filtros.etapa) } });
      }
      continue;
    }
    if (d.id === 'nivel') {
      for (const chip of chipsDeGrupos('nivel', NIVEL_GRUPOS, filtros.nivel)) {
        chips.push({ llave: chip.llave, rotulo: chip.rotulo, quitar: { nivel: chip.quitar(filtros.nivel) } });
      }
      continue;
    }
    const puestos = filtros[d.id] ?? [];
    for (const v of puestos) {
      chips.push({ llave: `${d.id}:${v}`, rotulo: v, quitar: { [d.id]: puestos.filter((x) => x !== v) } });
    }
  }

  // Dueña y línea: el mismo recorrido, con el rótulo que corresponde a cada una
  // (la línea por su etiqueta, nunca el número crudo, #605).
  const listas: { campo: 'asignadoA' | 'entroPorLinea'; rotulo: (v: string) => string }[] = [
    { campo: 'asignadoA', rotulo: nombreCorto },
    { campo: 'entroPorLinea', rotulo: (v) => lineas?.find((l) => l.valor === v)?.etiqueta ?? v },
  ];
  for (const { campo, rotulo } of listas) {
    for (const v of fueraDeLaVista(campo, filtros[campo], deLaVista[campo])) {
      chips.push({
        llave: `${campo}:${v}`,
        rotulo: rotulo(v),
        quitar: { [campo]: (filtros[campo] ?? []).filter((x) => x !== v) },
      });
    }
  }

  if (filtros.entroDesde || filtros.entroHasta) {
    const rotulo =
      filtros.entroDesde && filtros.entroHasta
        ? `Cargado: ${filtros.entroDesde} a ${filtros.entroHasta}`
        : filtros.entroDesde
          ? `Cargado desde ${filtros.entroDesde}`
          : `Cargado hasta ${filtros.entroHasta}`;
    chips.push({ llave: 'entro', rotulo, quitar: { entroDesde: undefined, entroHasta: undefined } });
  }

  for (const t of TOGGLES) {
    if (!filtros[t.id]) continue;
    if (t.id === 'sinHabilitar' && deLaVista.sinHabilitar) continue;
    chips.push({ llave: t.id, rotulo: t.rotulo, quitar: { [t.id]: undefined } });
  }

  return chips;
}
