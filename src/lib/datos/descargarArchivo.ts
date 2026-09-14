import { ErrorApi } from './cliente';
import { tokenGuardado } from './token';

/**
 * GUARDAR UN ARCHIVO EN LA COMPUTADORA — el gesto, sin saber de qué pantalla viene.
 *
 * `<a download>` sobre un blob: anda en el navegador y en la app de Windows
 * (WebView2). ⚠️ En la app de macOS (WKWebView) hace falta cablear `on_download`
 * en la cáscara (PR #78).
 *
 * El blob y no la URL del archivo, por dos motivos que muerden por separado: la
 * media de Hermes está detrás del Bearer (#36), y el navegador **ignora
 * `download` sobre un archivo de otro dominio** —una imagen del CDN de Meta se
 * abriría en vez de guardarse—.
 */
export function guardarBlob(urlDelBlob: string, nombre: string): void {
  const a = document.createElement('a');
  a.href = urlDelBlob;
  a.download = nombre;
  a.rel = 'noreferrer';
  a.click();
}

const EXTENSION_DE_IMAGEN: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

/**
 * Pide un archivo a Hermes con la sesión, y lo guarda como `nombreBase` más la
 * extensión de lo que llegó. Lanza `ErrorApi` si el server no lo entregó.
 */
export async function descargarAutenticado(url: string, nombreBase: string): Promise<void> {
  const token = tokenGuardado();
  const res = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ErrorApi(`No se pudo descargar (${res.status})`, res.status);
  const blob = await res.blob();
  const local = URL.createObjectURL(blob);
  guardarBlob(local, `${nombreBase}${EXTENSION_DE_IMAGEN[blob.type] ?? ''}`);
  // El navegador ya copió el blob al empezar la descarga; soltarlo enseguida
  // puede cortarla en algunos, así que se suelta con aire.
  setTimeout(() => URL.revokeObjectURL(local), 60_000);
}
