import { cargarFfmpeg } from './motorFfmpeg';
import { MIME_DE_NOTA, NOMBRE_DE_NOTA } from './notaDeVoz';
import { ondaDeMuestras } from './grabacionDeVoz';

/**
 * DE LO QUE GRABÓ EL NAVEGADOR A UNA NOTA DE VOZ DE WHATSAPP.
 *
 * ── Este archivo entra con `import()`, nunca estático ────────────────────
 * Arrastra el motor de ffmpeg (32 MB). El compositor lo pide al empezar a grabar
 * (`precalentarMotor`), así la primera nota del día no espera la bajada del core
 * DESPUÉS de detener, que es cuando la vendedora espera que salga.
 *
 * ── Por qué siempre se recodifica, aunque ya venga en opus ───────────────
 * Chrome graba `webm/opus` y bastaría cambiar el contenedor, pero la Cloud API
 * pide MONO («mono input only») y el grabador usa los canales del micrófono,
 * que en una laptop suelen ser dos. Recodificar a opus mono cuesta poco (es
 * audio, no video) y deja un solo camino para los tres navegadores en vez de
 * uno por formato.
 *
 * 24 kbps con `-application voip`: la calidad normal de una nota de voz. Se
 * descartó bajarla para que las notas largas entren en los 512 KB con los que
 * Meta muestra el botón de play (11-sep-2026): una nota de más de ~2:50 por la
 * línea de la Cloud API llega con ícono de descarga, y así se aceptó.
 */

export interface NotaPreparada {
  archivo: File;
  segundos: number;
  /** `null` si el navegador no pudo decodificar lo que grabó: la nota sale igual. */
  onda: number[] | null;
}

/** Empieza a bajar el motor sin esperar a usarlo. Idempotente. */
export async function precalentarMotor(): Promise<void> {
  await cargarFfmpeg();
}

/**
 * La duración y la onda salen de decodificar lo grabado con Web Audio: el
 * navegador siempre sabe leer su propio formato, y la duración del contenedor no
 * sirve (el `webm` de MediaRecorder no la trae). Si no se puede, cae al reloj de
 * la grabación y a una onda plana — nunca frena el envío.
 */
async function medir(grabado: Blob, respaldoS: number): Promise<{ segundos: number; onda: number[] | null }> {
  let contexto: AudioContext | null = null;
  try {
    contexto = new AudioContext();
    const audio = await contexto.decodeAudioData(await grabado.arrayBuffer());
    return { segundos: Math.max(1, Math.round(audio.duration)), onda: ondaDeMuestras(audio.getChannelData(0)) };
  } catch {
    return { segundos: Math.max(1, Math.round(respaldoS)), onda: null };
  } finally {
    void contexto?.close().catch(() => {});
  }
}

export async function prepararNotaDeVoz(grabado: Blob, respaldoS: number): Promise<NotaPreparada> {
  const [medida, ff] = await Promise.all([medir(grabado, respaldoS), cargarFfmpeg()]);

  const entrada = 'grabacion';
  const salida = 'nota.ogg';
  try {
    await ff.writeFile(entrada, new Uint8Array(await grabado.arrayBuffer()));
    const codigo = await ff.exec([
      '-i', entrada,
      '-vn',
      '-map_metadata', '-1',
      '-ac', '1',
      '-ar', '48000',
      '-c:a', 'libopus',
      '-b:a', '24k',
      '-application', 'voip',
      salida,
    ]);
    if (codigo !== 0) throw new Error(`ffmpeg terminó con código ${codigo}`);

    // Copia: el `Uint8Array` de ffmpeg apunta a su heap, que se reusa.
    const bytes = new Uint8Array((await ff.readFile(salida)) as Uint8Array);
    return {
      archivo: new File([bytes], NOMBRE_DE_NOTA, { type: MIME_DE_NOTA, lastModified: Date.now() }),
      ...medida,
    };
  } finally {
    await ff.deleteFile(entrada).catch(() => {});
    await ff.deleteFile(salida).catch(() => {});
  }
}
