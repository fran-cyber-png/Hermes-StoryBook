import type { FranjaDeColumna } from '../../dominio/conversaciones';
import { limitesDe, type Franja } from './franja';
import { esRecorteDelDia, type RecorteDelDia } from '../../dominio/recortesDelDia';
import {
  COLUMNA_CON_FRANJA,
  esRecorteSemaforo,
  type EtapaTrabajo,
  type OrigenDelVacio,
  type Recorte,
  type RecorteSemaforo,
} from './tablero';

/**
 * ══ LA MESA DEL PIPELINE — qué recortes pueden estar puestos a la vez ════════
 *
 * Cuatro ejes, y hasta acá cada uno era un `useState` suelto en `VistaEmbudo` con
 * sus exclusiones escritas a mano en cada `onClick`:
 *
 *   · el RANGO de la mesa (Hoy · 7 d · 30 d), que el server aplica a las cinco
 *     columnas con `franjaEn=*` (#946);
 *   · el RECORTE de la mesa: una luz de la leyenda, o un recorte del día
 *     («escribieron por primera vez hoy», «sin respuesta hace más de 24 h»);
 *   · el recorte de CADA columna (sus chips);
 *   · la FRANJA de «Nunca contestaron» (`franja.ts`).
 *
 * 🔴 **LA REGLA QUE LOS ORDENA ES LA DE ADR 0069: un botón promete el número de la
 * lista que aparece cuando lo tocas.** Los números de la leyenda y de los chips
 * salen del DESGLOSE, que se cuenta sobre los 30 días y el server NO recorta por
 * franja — tampoco con `franjaEn=*`. De ahí sale todo lo demás:
 *
 *   · Un rango apaga los chips de columna y la franja de columna: cuentan sobre el
 *     desglose, y cruzados con «Hoy» dirían «Para seguir 1.349» encima de una
 *     lista de doce.
 *   · Un rango CONSERVA el recorte del día: ése lo aplica el server y su total ya
 *     es la intersección.
 *   · 🔴 **Un rango y una luz CONVIVEN** (11-sep-2026, pedido del usuario). Hasta
 *     ese día tocar una luz volvía el rango a 30 días y cambiar el rango apagaba
 *     la luz (ADR 0103 §9): «marco Hoy, toco Verdes y me manda a 30 días». La luz
 *     se recorta del lado del cliente, sobre las tarjetas cargadas, y esas
 *     tarjetas ya vienen recortadas por el rango: cruzarlas no pide nada al
 *     server. Lo que no cruza es el NÚMERO de la leyenda, que sale del desglose de
 *     30 días — y por eso, con un rango puesto, la leyenda lo dice («En 30 d:»)
 *     en vez de prometer el tamaño de la lista.
 *
 * ⚠️ **La mesa arranca en «Hoy», no en 30 días** (11-sep-2026): lo que se trabaja
 * al entrar es lo de hoy. 7 d y 30 d se precargan detrás (`VistaEmbudo`), así que
 * cambiar de rango no espera. El puente del Dashboard sí abre en 30 días: sus
 * cifras son de 30 días, y el tablero tiene que dar el número que prometió.
 *
 * Puro y sin React a propósito: qué convive con qué es política, y se interroga
 * sin montar el Pipeline (`mesa.test.ts`).
 */

/**
 * `cola` = lo que ya mira la cola (`DIAS_DE_LA_COLA`, hoy 30 días): no manda
 * franja. Se llama así y no `d30` porque es la ventana de la cola, sea cual sea.
 */
export type RangoDeMesa = 'cola' | 'hoy' | 'd7';

/** Lo que recorta las cinco columnas a la vez. `todas` = nada. */
export type RecorteDeMesa = 'todas' | RecorteSemaforo | RecorteDelDia;

export interface EstadoDeMesa {
  rango: RangoDeMesa;
  /** El recorte de ARRIBA, el de las cinco columnas. */
  recorte: RecorteDeMesa;
  /** El chip puesto en cada columna. Sólo rige sin recorte de mesa. */
  deColumna: Partial<Record<EtapaTrabajo, Recorte>>;
  /** La franja de `COLUMNA_CON_FRANJA`. Una sola: el server nombra la columna (`?franjaEn=`). */
  franja: Franja | null;
}

export const MESA_INICIAL: EstadoDeMesa = { rango: 'hoy', recorte: 'todas', deColumna: {}, franja: null };

export type AccionDeMesa =
  | { tipo: 'rango'; rango: RangoDeMesa }
  /** Tocar la luz que ya está puesta la apaga. */
  | { tipo: 'luz'; luz: RecorteSemaforo }
  /** `null` = quitarlo (el ✕ de su chip arriba). */
  | { tipo: 'recorteDelDia'; recorte: RecorteDelDia | null }
  | { tipo: 'recorteDeColumna'; etapa: EtapaTrabajo; recorte: Recorte }
  | { tipo: 'franjaDeColumna'; franja: Franja | null }
  /** El puente del Dashboard: «abre el Pipeline ASÍ», nunca «súmale esto a lo que había». */
  | { tipo: 'abrir'; luz: RecorteSemaforo | null };

export function mesaSiguiente(e: EstadoDeMesa, a: AccionDeMesa): EstadoDeMesa {
  switch (a.tipo) {
    case 'rango':
      // El rango es un segmentado, no un interruptor: tocar el puesto no apaga nada.
      if (a.rango === e.rango) return e;
      return {
        rango: a.rango,
        recorte: esRecorteDelDia(e.recorte) || esRecorteSemaforo(e.recorte) ? e.recorte : 'todas',
        deColumna: {},
        franja: null,
      };
    case 'luz':
      return { ...MESA_INICIAL, rango: e.rango, recorte: e.recorte === a.luz ? 'todas' : a.luz };
    case 'recorteDelDia':
      return { ...e, recorte: a.recorte ?? 'todas', deColumna: {}, franja: null };
    case 'recorteDeColumna':
      // Franja y recorte de «Nunca contestaron» son el mismo eje (ADR 0069).
      return {
        ...e,
        deColumna: { ...e.deColumna, [a.etapa]: a.recorte },
        franja: a.etapa === COLUMNA_CON_FRANJA ? null : e.franja,
      };
    case 'franjaDeColumna':
      return {
        ...e,
        franja: a.franja,
        deColumna: a.franja ? { ...e.deColumna, [COLUMNA_CON_FRANJA]: 'todas' } : e.deColumna,
      };
    case 'abrir':
      // En 30 días: lo que el Dashboard prometió se contó sobre 30 días.
      return { ...MESA_INICIAL, rango: 'cola', recorte: a.luz ?? 'todas' };
  }
}

/** ¿Hay un rango puesto (Hoy · 7 d)? Con «30 d» no hay: es lo que la cola ya mira. */
export function hayRango(rango: RangoDeMesa): boolean {
  return rango !== 'cola';
}

/**
 * ¿Las columnas ofrecen sus chips (y la franja)? Sólo con la mesa entera: con un
 * recorte arriba sería un filtro cruzado sin botón a la vista que lo apague, y con
 * un rango puesto sus números serían de 30 días.
 */
export function chipsDeColumnaVisibles(e: EstadoDeMesa): boolean {
  return e.recorte === 'todas' && !hayRango(e.rango);
}

/** El recorte que rige en una columna: el de la mesa le gana al suyo. */
export function recorteDeLaColumna(e: EstadoDeMesa, etapa: EtapaTrabajo): Recorte {
  return e.recorte !== 'todas' ? e.recorte : (e.deColumna[etapa] ?? 'todas');
}

/**
 * QUÉ CONTROL VACIÓ LA COLUMNA — para que su vacío mande al botón que existe.
 * Con el recorte o el rango de arriba puestos, la columna no dibuja su «Todas»
 * (`chipsDeColumnaVisibles`): mandar a tocarlo sería mandar a un botón que no está.
 */
export function origenDelVacio(e: EstadoDeMesa, etapa: EtapaTrabajo): OrigenDelVacio {
  if (e.recorte !== 'todas') return 'mesa';
  if (hayRango(e.rango)) return 'rango';
  if (etapa === COLUMNA_CON_FRANJA && e.franja) return 'franja';
  return 'columna';
}

/**
 * Los instantes que viajan con `franjaEn=*`. Salen de `limitesDe` —la misma
 * cuenta que la franja de columna— así que «Hoy» es la medianoche LOCAL y «7 d» es
 * ahora − 7×24 h, recortado al minuto. Se resuelven cuando SALE el pedido
 * (`useTablero`), no en la `queryKey`: ver `claveDelRango`.
 *
 * ⚠️ **Como instante con zona (`toISOString()`)**: el server lee una fecha pelada
 * como medianoche UTC, que en Lima son las 7 de la noche del día anterior.
 */
export function limitesDelRango(rango: RangoDeMesa, ahora: Date): FranjaDeColumna | null {
  if (rango === 'cola') return null;
  const { desde, hasta } = limitesDe({ tipo: 'preset', id: rango }, ahora);
  return { desde: desde.toISOString(), hasta: hasta?.toISOString() ?? null };
}

/**
 * 🔴 LO QUE ENTRA A LA `queryKey` DEL TABLERO: el rango, no sus instantes.
 *
 * Con el instante adentro, «7 d» cambiaba de clave cada minuto, y cada cambio era
 * la consulta más cara del repo en frío, el tablero entero en esqueleto y lo traído
 * con «Ver más» tirado (revisión cruzada de #956). «Hoy» lleva el DÍA local: a la
 * medianoche es otra lista, y la de ayer no se sirve de la caché.
 */
export function claveDelRango(rango: RangoDeMesa, ahora: Date): string | null {
  if (rango === 'cola') return null;
  if (rango === 'd7') return 'd7';
  const p = (n: number) => String(n).padStart(2, '0');
  return `hoy:${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
}

/** Una función por rango, creada UNA vez: `useTablero` la tiene de dependencia. */
const LIMITES_DEL_RANGO = {
  hoy: (ahora: Date) => limitesDelRango('hoy', ahora)!,
  d7: (ahora: Date) => limitesDelRango('d7', ahora)!,
} as const;

/** El rango como lo pide `useTablero`: la clave para la caché, y los instantes para cuando salga cada pedido. */
export function rangoDelTablero(
  rango: RangoDeMesa,
  ahora: Date,
): { clave: string; limites: (ahora: Date) => FranjaDeColumna } | null {
  if (rango === 'cola') return null;
  return { clave: claveDelRango(rango, ahora)!, limites: LIMITES_DEL_RANGO[rango] };
}
