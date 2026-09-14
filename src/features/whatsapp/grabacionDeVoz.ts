import { MUESTRAS_DE_ONDA } from './notaDeVoz';

/**
 * LO QUE SÓLO NECESITA EL GRABADOR — y por eso entra perezoso con
 * `GrabadorDeVoz.tsx`, no en el arranque. Las reglas de la nota de voz y el
 * porqué de convertir están en `notaDeVoz.ts`.
 */

/**
 * Qué pedirle a `MediaRecorder`. En orden: lo que menos trabajo le deja a la
 * conversión primero. `undefined` = que elija el navegador — igual se convierte.
 */
export function elegirFormatoDeGrabacion(soporta: (tipo: string) => boolean): string | undefined {
  return ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4'].find((t) => soporta(t));
}

/**
 * La onda: el volumen medio de cada tramo, llevado a 0..100 contra el tramo más
 * fuerte. Normalizada al pico porque lo que se lee en la burbuja es la FORMA —
 * dónde habló y dónde calló—, y sin normalizar una nota grabada lejos del
 * micrófono sería una raya.
 */
export function ondaDeMuestras(muestras: Float32Array): number[] {
  const tramo = Math.max(1, Math.floor(muestras.length / MUESTRAS_DE_ONDA));
  const medias = Array.from({ length: MUESTRAS_DE_ONDA }, (_, i) => {
    const desde = i * tramo;
    const hasta = Math.min(muestras.length, desde + tramo);
    let suma = 0;
    for (let j = desde; j < hasta; j++) suma += Math.abs(muestras[j]);
    return hasta > desde ? suma / (hasta - desde) : 0;
  });
  const pico = Math.max(...medias);
  if (pico === 0) return medias.map(() => 0);
  return medias.map((m) => Math.round((m / pico) * 100));
}

/**
 * Lo que la vendedora lee cuando el micrófono no arranca. El nombre del error es
 * lo único estable entre navegadores; el `message` cambia con cada uno.
 */
export function motivoDelMicrofono(err: unknown): string {
  const nombre = err instanceof Error ? err.name : '';
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
    return 'Hermes no tiene permiso para usar el micrófono. Revisa el permiso del micrófono en el navegador o en la configuración de privacidad de tu computadora.';
  }
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
    return 'No se encontró ningún micrófono conectado.';
  }
  if (nombre === 'NotReadableError' || nombre === 'AbortError') {
    return 'El micrófono está ocupado por otra aplicación.';
  }
  return 'No se pudo usar el micrófono.';
}
