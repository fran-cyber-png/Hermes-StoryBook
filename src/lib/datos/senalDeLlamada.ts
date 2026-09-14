/**
 * LA SEÑAL DE UNA LLAMADA QUE LLEGA POR EL SSE — el gemelo de `pulsoDeRuteo.ts`.
 *
 * `tiempoReal.ts` la recibe (`{tipo:'llamada', callId, fase}`) y la reparte acá, sin saber qué es una
 * llamada: `lib` no puede importar una feature (ADR 0057), así que la feature se suscribe.
 *
 * Solo llega completa a quien está en el timbre de esa llamada (`server/src/realtime/visibilidad.ts`); la
 * recortada no trae `callId` y ni siquiera se emite.
 */

export type FaseDeLlamada = 'sonando' | 'tomada' | 'respuesta' | 'aceptada' | 'rechazada' | 'terminada';

export interface SenalDeLlamada {
  tipo: 'llamada';
  callId: string;
  fase: FaseDeLlamada;
}

const FASES: readonly string[] = ['sonando', 'tomada', 'respuesta', 'aceptada', 'rechazada', 'terminada'];

/** Lo que vino por el cable, si es una señal completa. Una fase que este front no conoce se ignora. */
export function senalDeLlamadaDe(e: { tipo?: string; callId?: unknown; fase?: unknown }): SenalDeLlamada | null {
  if (e.tipo !== 'llamada' || typeof e.callId !== 'string' || !e.callId) return null;
  if (typeof e.fase !== 'string' || !FASES.includes(e.fase)) return null;
  return { tipo: 'llamada', callId: e.callId, fase: e.fase as FaseDeLlamada };
}

type Oyente = (s: SenalDeLlamada) => void;

const oyentes = new Set<Oyente>();

export function emitirSenalDeLlamada(s: SenalDeLlamada): void {
  for (const o of oyentes) {
    try {
      o(s);
    } catch {
      // Un oyente roto no puede tumbar el stream.
    }
  }
}

export function suscribirSenalDeLlamada(o: Oyente): () => void {
  oyentes.add(o);
  return () => oyentes.delete(o);
}
