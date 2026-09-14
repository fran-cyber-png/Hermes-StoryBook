import type { FilaDesglose } from '../../dominio/desglose';
import type { Luz } from '../../dominio/semaforo';
import { DIAS_DE_LA_COLA } from './franja';
import type { RangoDeMesa } from './mesa';
import {
  contarHoy,
  resumirBandeja,
  resumirColumna,
  seOfreceRecorte,
  type ColumnaTablero,
  type Recorte,
} from './tablero';

/**
 * LA FILA DE ARRIBA DEL PIPELINE — la mesa entera, contada una vez.
 *
 * 🔴 **EL PIPELINE MUESTRA LO QUE SE TRABAJA; LO QUE SE MIDE VA AL DASHBOARD**
 * (decisión del dueño, 10-sep-2026: «ninguna cifra vive en los dos»). Por eso
 * acá no hay KPIs ni distribución por etapa: el tamaño de la mesa, lo que es
 * nuevo hoy y el semáforo, que acá no es una cifra sino un RECORTE que se toca.
 *
 * Suma lo que ya cuentan `resumirColumna` y `contarHoy`, columna por columna,
 * sobre las columnas que ESTE tablero dibuja (`columnasDe`). No hay una segunda
 * lectura del desglose: si la fila de arriba y una columna no cerraran, sería
 * un bug y no una diferencia de definición.
 */

export interface ResumenTablero {
  /** La mesa entera: la suma de las columnas dibujadas. `perdido` no es mesa. */
  total: number;
  /**
   * `false` mientras el server no manda desglose (N4 sale antes que N5): ahí el
   * total sale de los conteos y la fila CALLA el semáforo, en vez de pintar
   * cuatro ceros que no son ciertos. Misma regla que `resumirBandeja`.
   */
  hayDetalle: boolean;
  /** Conversaciones que nacieron hoy. `null` = el server no manda `nacioHoy` todavía: no se dibuja. */
  nuevasHoy: number | null;
  /** Las cuatro luces sobre la mesa entera. Una fila sin `luz` no suma a ninguna. */
  semaforo: Record<Luz, number>;
}

export function resumirTablero(
  columnas: readonly ColumnaTablero[],
  desglose: readonly FilaDesglose[] | undefined,
  conteos?: Record<string, number>,
): ResumenTablero {
  const resumenes = columnas.map((col) => resumirColumna(desglose, col.id, conteos));
  const sumar = (campo: 'total' | 'verdes' | 'ambar' | 'grises' | 'rojos') =>
    resumenes.reduce((suma, r) => suma + r[campo], 0);
  return {
    total: sumar('total'),
    hayDetalle: resumirBandeja(desglose, conteos).hayDetalle,
    nuevasHoy: contarHoy(
      desglose,
      columnas.map((c) => c.id),
    ),
    semaforo: { verde: sumar('verdes'), ambar: sumar('ambar'), gris: sumar('grises'), rojo: sumar('rojos') },
  };
}

/** De qué ventana es una cifra del desglose, dicho como se lee al lado del número. */
const VENTANA_DEL_RANGO: Record<RangoDeMesa, string> = {
  hoy: 'hoy',
  d7: '· 7 d',
  cola: `· ${DIAS_DE_LA_COLA} d`,
};

/**
 * «N RESPONDIDOS» EN LA CARD DE «TE ESPERAN» (pedido del dueño, 13-sep-2026: «en
 * vez de contestaron pon los que ya fueron respondidos hoy»). Cuenta la columna
 * «Respondidos» (`contactado`) en la misma foto que el resto de la card.
 *
 * 🔴 **EL RÓTULO DICE DE QUÉ VENTANA ES, porque depende del server.** Con
 * `mesaPorCanal` el desglose es del RANGO puesto («respondidos hoy»); un server
 * viejo lo manda siempre de 30 días, y ahí dice «· 30 d» aunque la mesa esté en
 * «Hoy» — el mismo defecto que la leyenda resolvía con su «En 30 d:».
 *
 * `null` = no hay desglose: sin foto no hay cifra, y un «0 respondidos» sería falso.
 */
export function respondidosDeLaMesa(
  desglose: readonly FilaDesglose[] | undefined,
  rango: RangoDeMesa,
  /** ¿El desglose es del rango puesto (`mesaPorCanal: true`)? `false` = de 30 días. */
  desgloseDelRango: boolean,
): { n: number; rotulo: string } | null {
  if (!desglose) return null;
  const n = desglose.reduce((suma, f) => (f.etapa === 'contactado' ? suma + f.n : suma), 0);
  return { n, rotulo: `${n === 1 ? 'respondido' : 'respondidos'} ${VENTANA_DEL_RANGO[desgloseDelRango ? rango : 'cola']}` };
}

/**
 * ══ EL SEMÁFORO, EXPLICADO UNA VEZ ═══════════════════════════════════════════
 *
 * Estos cuatro textos vivían en `recortesDeColumna`, como `ayuda` de cuatro
 * chips que cada columna repetía. Medido en producción el 10-sep-2026: ámbar
 * es el 93 % de «Saben el precio» y el 89 % de «Contestaron», verdes hay 278 en
 * toda la mesa — cuatro chips por columna no recortaban nada. Suben a UNA
 * leyenda arriba del tablero, que aplica a las cinco columnas a la vez.
 *
 * ⚠️ **Y se corrigieron al mudarse.** El de verde decía «nombraron un curso», y
 * desde el 9-sep-2026 eso es ÁMBAR (`dominio/semaforo.ts`, cambio 2): la ayuda
 * le explicaba a la vendedora una regla que ya no rige. Si tocas la regla allá,
 * relee estas cuatro frases.
 */
export const LEYENDA_SEMAFORO: readonly { luz: Luz; label: string; ayuda: string }[] = [
  {
    luz: 'verde',
    label: 'Verdes',
    ayuda: 'Quieren comprar: lo último que escribieron pregunta el precio o cómo pagar, o el bot los ve calientes',
  },
  {
    luz: 'ambar',
    label: 'Ámbar',
    ayuda:
      'Contestaron, pero todavía no dicen que quieren comprar: nombraron un curso, no dijeron qué buscan, o preguntaron el precio y se enfriaron',
  },
  {
    luz: 'gris',
    label: 'Grises',
    ayuda: 'Todavía no dieron ninguna señal: nunca contestaron, solo saludaron, o es el contestador de otra empresa',
  },
  {
    luz: 'rojo',
    label: 'Rojos',
    ayuda: 'Dijeron que no, escriben incoherencias o el bot los ve fríos: se deja de invertir tiempo en estos',
  },
];

export interface OpcionDeLeyenda {
  luz: Luz;
  label: string;
  ayuda: string;
  /** Sobre la mesa entera, no sobre una columna. */
  n: number;
  /** Tocarla cambia lo que se ve (`seOfreceRecorte`). La leyenda se DIBUJA entera igual. */
  clicable: boolean;
}

/**
 * La leyenda con sus conteos. Se dibuja SIEMPRE con las cuatro luces —una
 * leyenda con un color de menos no explica el color que falta—, pero sólo se
 * toca la que recorta algo: la regla del cero, la misma de los chips.
 */
export function leyendaDelTablero(
  resumen: Pick<ResumenTablero, 'total' | 'semaforo'>,
  activo: Recorte,
): OpcionDeLeyenda[] {
  return LEYENDA_SEMAFORO.map((l) => {
    const n = resumen.semaforo[l.luz];
    return { ...l, n, clicable: seOfreceRecorte(n, resumen.total, activo === l.luz) };
  });
}
