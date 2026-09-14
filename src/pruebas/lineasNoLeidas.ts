import { CODIGO_LINEAS_NO_LEIDAS } from '../lib/datos/lineasNoLeidas';

/**
 * EL 503 DE «NO PUDIMOS LEER TUS LÍNEAS», TAL COMO LO MANDA EL SERVER — para tests y galerías (ADR 0108).
 *
 * Es el cuerpo que arma `contestarFallo` (`server/src/lib/ruta.ts`) para `LecturaDeLineasFallida`.
 * Hay UNA copia en el front, y `lineasNoLeidas.paridad.test.ts` la cruza con la del server: una
 * galería que sirve un mensaje que el server ya no manda no es evidencia (candado 10).
 */
export const MENSAJE_LINEAS_NO_LEIDAS =
  'No pudimos leer tus líneas, así que no sabemos qué conversaciones te tocan. Vuelve a intentar en unos segundos.';

/** Los segundos del `Retry-After` que manda el server con este 503. */
export const REINTENTAR_EN_SEGUNDOS = 5;

export function respuestaLineasNoLeidas(): Response {
  return new Response(
    JSON.stringify({ ok: false, codigo: CODIGO_LINEAS_NO_LEIDAS, message: MENSAJE_LINEAS_NO_LEIDAS }),
    {
      status: 503,
      headers: { 'content-type': 'application/json', 'retry-after': String(REINTENTAR_EN_SEGUNDOS) },
    },
  );
}
