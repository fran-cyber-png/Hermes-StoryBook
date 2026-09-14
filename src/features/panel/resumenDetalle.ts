import type { EventoLinea, GrupoDia } from './timeline';

/**
 * #887 — EL TILE «ÚLTIMA ACTIVIDAD» — el primer evento de la cronología que el
 * timeline ya arma (`ensamblarTimeline`), sin recalcular nada.
 *
 * Los grupos ya vienen ordenados: fechado más reciente primero, «Sin fecha» al
 * final. Tomar el primer evento del primer grupo no-vacío alcanza — y por eso
 * un evento fechado siempre le gana a uno sin fecha, aunque este último esté
 * primero en el array crudo.
 */
export interface ActividadTile {
  rotulo: string;
  valor?: string;
  timestamp?: string;
  /** El chip «Señal» que ya usa el timeline (`COLOR.senal`) — no es «IA». */
  esSenal: boolean;
}

export function ultimaActividad(grupos: readonly GrupoDia[]): ActividadTile | null {
  for (const grupo of grupos) {
    const evento = grupo.eventos[0];
    if (evento) return tile(evento);
  }
  return null;
}

function tile(e: EventoLinea): ActividadTile {
  return { rotulo: e.rotulo, valor: e.valor, timestamp: e.timestamp, esSenal: e.estado === 'senal' };
}
