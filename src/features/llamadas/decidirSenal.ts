import type { SenalDeLlamada } from '../../lib/datos/senalDeLlamada';

/**
 * QUÉ HACE ESTA PESTAÑA CON UNA SEÑAL DE LLAMADA — la regla, pura.
 *
 * El estado vive en `llamadaActual.ts`, que tiene WebRTC, `fetch` y sonido. Lo que se decide ante cada
 * señal está acá, porque es donde se equivoca: una misma señal significa cosas distintas según quién la
 * recibe. `tomada` le apaga el timbre a las demás y no le hace nada a quien la tomó; `sonando` en una
 * pestaña libre es una entrante nueva, y en la que está llamando es el celular del lead timbrando.
 */

export type Direccion = 'entrante' | 'saliente';

export type EstadoLlamada =
  | { fase: 'libre' }
  | { fase: 'entrante'; callId: string; telefono: string; clave: string }
  | { fase: 'conectando'; callId: string | null; direccion: Direccion; telefono: string; clave: string }
  | { fase: 'llamando'; callId: string; telefono: string; clave: string }
  | {
      fase: 'en-curso';
      callId: string;
      direccion: Direccion;
      telefono: string;
      clave: string;
      desde: number;
      silenciado: boolean;
    }
  | { fase: 'terminada'; telefono: string; motivo: string; duracion: number | null };

export type Reaccion =
  | 'consultar-entrante'
  | 'apagar-timbre'
  | 'aplicar-respuesta'
  | 'marcar-en-curso'
  | 'cortar'
  | 'nada';

export function callIdDe(e: EstadoLlamada): string | null {
  return 'callId' in e ? e.callId : null;
}

export function queHacerConLaSenal(e: EstadoLlamada, s: SenalDeLlamada, ignoradas: ReadonlySet<string>): Reaccion {
  const esLaMia = callIdDe(e) === s.callId;
  const esperandoAlLead = e.fase === 'llamando' || (e.fase === 'conectando' && e.direccion === 'saliente');

  switch (s.fase) {
    case 'sonando':
      // Una pestaña ocupada no timbra otra llamada: el server ya no se la manda a quien está en una, pero
      // otra pestaña de la misma persona puede estar a mitad de marcar.
      if (e.fase !== 'libre' && e.fase !== 'terminada') return 'nada';
      return ignoradas.has(s.callId) ? 'nada' : 'consultar-entrante';
    case 'tomada':
      return esLaMia && e.fase === 'entrante' ? 'apagar-timbre' : 'nada';
    case 'respuesta':
      return esLaMia && esperandoAlLead ? 'aplicar-respuesta' : 'nada';
    case 'aceptada':
      return esLaMia && esperandoAlLead ? 'marcar-en-curso' : 'nada';
    case 'rechazada':
    case 'terminada':
      if (!esLaMia) return 'nada';
      return e.fase === 'entrante' ? 'apagar-timbre' : 'cortar';
  }
}
