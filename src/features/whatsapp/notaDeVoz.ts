/**
 * LA NOTA DE VOZ DEL COMPOSITOR — las reglas, sin navegador adentro.
 *
 * El gesto es el de WhatsApp: se aprieta el micrófono, se habla, y al detener
 * SALE. No queda como adjunto para escuchar antes (decisión del 11-sep-2026):
 * la vendedora que graba ya sabe lo que dijo, y un paso más es un paso que en la
 * cola de un día largo no se da.
 *
 * ── Por qué hay que convertir ────────────────────────────────────────────
 * WhatsApp y la Cloud API piden OGG/OPUS mono, y ningún navegador de los que
 * abren Hermes lo graba así: Chrome y WebView2 (Windows) dan `webm/opus`,
 * WKWebView (macOS) da `mp4/aac`. Por eso lo grabado pasa por ffmpeg.wasm antes
 * de subir (`convertirNotaDeVoz.ts`), el mismo motor que ya achica los videos.
 *
 * ── Qué vive acá, y qué en `grabacionDeVoz.ts` ───────────────────────────
 * Acá, lo que necesitan el hilo y el envío —que entran en el ARRANQUE—: el
 * reloj, si el entorno puede grabar, la onda en base64. Lo que sólo usa el
 * grabador (qué formato pedir, calcular la onda, qué decir si el micrófono no
 * está) vive en `grabacionDeVoz.ts`, que entra perezoso con él. Juntos, el
 * bundler metía el módulo entero en el arranque (medido con `npm run presupuesto`).
 * El server valida la forma de lo que llega (`server/src/whatsapp/notaDeVoz.ts`)
 * — la duración MÁXIMA es sólo de acá, a propósito: corta la grabación, y en el
 * server no protegería nada.
 */

/** 10 minutos: al llegar, la grabación se detiene y sale sola. */
export const DURACION_MAXIMA_S = 10 * 60;

/** Las barras de la onda de WhatsApp. El server exige exactamente esta cantidad. */
export const MUESTRAS_DE_ONDA = 64;

/** Nombre del archivo que viaja: el hilo y la auditoría lo leen. */
export const NOMBRE_DE_NOTA = 'nota-de-voz.ogg';

/** El mime con el que sale: el que WhatsApp reproduce como nota de voz. */
export const MIME_DE_NOTA = 'audio/ogg; codecs=opus';

/** Base64 de los bytes, que es como el server lee la onda de la query. */
export function ondaEnBase64(onda: number[]): string {
  return btoa(String.fromCharCode(...onda));
}

/** `7.9` → `0:07`. */
export function relojDeVoz(segundos: number): string {
  const s = Math.floor(segundos);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * ¿Este entorno puede grabar? En la app de macOS sin `NSMicrophoneUsageDescription`
 * WebKit ni siquiera expone `navigator.mediaDevices`: ahí el botón no se ofrece,
 * en vez de ofrecerse y fallar.
 */
export function puedeGrabarVoz(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}
