import { useEffect, useRef } from 'react';
import { useBlobAutenticado } from '../../lib/datos/blobAutenticado';
import { guardarBlob } from '../../lib/datos/descargarArchivo';
import { urlMedia, type MediaHilo } from './conversacionWa';

/**
 * GUARDAR UN ADJUNTO DEL HILO EN LA COMPUTADORA — el nombre y el gesto.
 *
 * ── Por qué el nombre importa ────────────────────────────────────────────
 * El archivo vive en el server como `wa-3EB0C4…jpg` o `out-1789…-flyer.jpg`:
 * nombres para la máquina. Guardado así, la vendedora no lo encuentra en
 * Descargas. Gana el nombre original (`temario.pdf`); sin él, la clase y el día
 * del mensaje (`imagen-2026-09-11.jpg`), que es lo que busca quien tiene que
 * mandarle a alguien «la foto del voucher del jueves».
 *
 * ── Por qué un blob ───────────────────────────────────────────────────────
 * La media está detrás del Bearer (#36), así que un link directo daría 401: se
 * baja con `useBlobAutenticado`, que ya la tiene en caché si se vio, y la guarda
 * `guardarBlob` (`lib/datos/descargarArchivo.ts`, con el caso de la app de macOS).
 */

const EXTENSION_POR_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/3gpp': '.3gp',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/amr': '.amr',
  'application/pdf': '.pdf',
};

const EXTENSION = /\.[a-z0-9]{2,5}$/i;

function extensionDe(media: MediaHilo): string {
  const delArchivo = media.archivo.match(EXTENSION)?.[0];
  if (delArchivo && delArchivo.toLowerCase() !== '.bin') return delArchivo.toLowerCase();
  // `audio/ogg; codecs=opus` → `audio/ogg`.
  const mime = (media.mime ?? '').split(';')[0].trim().toLowerCase();
  return EXTENSION_POR_MIME[mime] ?? '';
}

/** `2026-09-11`, en la hora de Lima: la vendedora es peruana, el `toISOString` no. */
function diaDe(cuando: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date(cuando));
}

export function nombreDeDescarga(media: MediaHilo, cuando: string): string {
  const original = media.nombre?.trim();
  if (original) return EXTENSION.test(original) ? original : `${original}${extensionDe(media)}`;
  const clase = media.clase === 'audio' && media.voz ? 'nota-de-voz' : media.clase;
  return `${clase}-${diaDe(cuando)}${extensionDe(media)}`;
}

/** Un PDF se puede VER en el visor; el resto de los documentos solo se guarda. */
export function esPdf(media: MediaHilo): boolean {
  return (media.mime ?? '').toLowerCase().startsWith('application/pdf') || /\.pdf$/i.test(media.nombre ?? '');
}

/**
 * Descargar un adjunto con un clic, esté o no bajado. Si no lo estaba, el mismo
 * clic lo baja y lo guarda al llegar: pedirle a la vendedora un segundo clic
 * después de «Bajando…» es un clic que no se da.
 */
export function useDescargarAdjunto(media: MediaHilo, cuando: string) {
  const { url, bajando, fallo, pedir } = useBlobAutenticado(urlMedia(media.archivo), { alPedir: true });
  const guardarAlLlegar = useRef(false);
  const nombre = nombreDeDescarga(media, cuando);

  useEffect(() => {
    if (url && guardarAlLlegar.current) {
      guardarAlLlegar.current = false;
      guardarBlob(url, nombre);
    }
  }, [url, nombre]);

  function descargar() {
    if (url) {
      guardarBlob(url, nombre);
      return;
    }
    guardarAlLlegar.current = true;
    pedir();
  }

  return { descargar, bajando, fallo, nombre };
}
