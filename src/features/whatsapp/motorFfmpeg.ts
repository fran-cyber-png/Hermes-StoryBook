import { FFmpeg } from '@ffmpeg/ffmpeg';

/**
 * EL MOTOR — ffmpeg compilado a WebAssembly, UNO por sesión, para los dos que lo
 * usan: la compresión de un video pesado (`comprimirVideo.ts`) y la conversión
 * de una nota de voz (`convertirNotaDeVoz.ts`).
 *
 * Vivía adentro de `comprimirVideo.ts`. Salió cuando llegó el segundo usuario:
 * con una copia por módulo, una vendedora que achica un video y después graba
 * una nota de voz bajaría el core de 32 MB dos veces y tendría dos motores en
 * memoria.
 *
 * ── Este archivo NO se importa de forma estática desde ningún lado ────────
 * Lo importan solo módulos que a su vez entran con `import()`. Un import
 * estático desde el composer sumaría 32 MB a lo que baja por OTA cada vendedora
 * después de cada deploy (lo mide `npm run presupuesto`).
 *
 * ── 🔴 EL CORE SE SIRVE DESDE `public/ffmpeg/`, NO SE IMPORTA ─────────────
 * Lo copia ahí el plugin `goberna:ffmpeg-core` de `vite.config.ts`. Tiene que
 * ser el build **ESM** (el worker de @ffmpeg/ffmpeg es `type: "module"` y
 * termina haciendo `import(coreURL)`, que pide un `export default` que el UMD no
 * tiene), y no hay forma de pedirle esa URL al bundler — Vite pre-bundlea el
 * paquete y `?url` deja de devolver una URL. Candado: `coreEnElBuild.test.ts`.
 *
 * `document.baseURI` y no una ruta absoluta: el fallback local de la cáscara
 * abre el build sin servidor (de ahí el `base: './'` de `vite.config.ts`), y
 * `/ffmpeg/…` apuntaría a la raíz del disco.
 */
function urlDelCore(archivo: string): string {
  return new URL(`ffmpeg/${archivo}`, document.baseURI).href;
}

let instancia: FFmpeg | null = null;
let cargando: Promise<FFmpeg> | null = null;

export async function cargarFfmpeg(alProgresarCarga?: (f: number) => void): Promise<FFmpeg> {
  if (instancia) return instancia;
  if (cargando) return cargando;

  cargando = (async () => {
    const ff = new FFmpeg();
    // URLs DIRECTAS, no `toBlobURL`. El helper de @ffmpeg/util existe para
    // cargar el core desde un CDN (cross-origin), y acá el core es nuestro: sale
    // del mismo `express.static` que la app. Con blobs, además, el core ESM
    // pierde su `import.meta.url` —que es como ubica archivos hermanos— y los
    // dos `blob:` terminan en `net::ERR_ABORTED` dentro del worker.
    alProgresarCarga?.(1);
    await ff.load({
      coreURL: urlDelCore('ffmpeg-core.js'),
      wasmURL: urlDelCore('ffmpeg-core.wasm'),
    });
    instancia = ff;
    return ff;
  })();

  try {
    return await cargando;
  } finally {
    cargando = null;
  }
}

/** Después de un `terminate()` el motor queda inservible: el próximo pedido carga otro. */
export function olvidarMotor(): void {
  instancia = null;
}
