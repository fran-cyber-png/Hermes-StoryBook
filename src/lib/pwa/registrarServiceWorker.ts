import { enTauri } from '../tauri';

/**
 * EL SERVICE WORKER SE REGISTRA ACÁ, Y SOLO DONDE HACE FALTA — ADR 0111.
 *
 * `public/sw.js` está para que el celular ofrezca instalar Hermes. No guarda nada.
 *
 * 🔴 **No en la cáscara Tauri.** La ventana de la app de escritorio navega a la misma URL que el navegador.
 * Sin esta guarda, el SW quedaría registrado adentro del WebView de cada vendedora, que se actualiza por OTA y
 * no se instala.
 *
 * **Tampoco con vite en desarrollo**: un SW registrado en `localhost:5173` sigue ahí para cualquier otro
 * proyecto que después use ese puerto.
 *
 * Se registra con la ruta ABSOLUTA. El build tiene `base: './'` y la app puede estar en otra ruta que no sea
 * `/`: un `./sw.js` relativo quedaría con otro alcance, o caería en el fallback de la SPA.
 */

const RUTA_DEL_SERVICE_WORKER = '/sw.js';

export interface EntornoDelServiceWorker {
  enTauri: boolean;
  soportaServiceWorker: boolean;
  esProduccion: boolean;
}

export function debeRegistrarServiceWorker(entorno: EntornoDelServiceWorker): boolean {
  return !entorno.enTauri && entorno.soportaServiceWorker && entorno.esProduccion;
}

function entornoActual(): EntornoDelServiceWorker {
  return {
    enTauri: enTauri(),
    soportaServiceWorker: 'serviceWorker' in navigator,
    esProduccion: import.meta.env.PROD,
  };
}

/**
 * Registra el SW con la página ya cargada, para no competir con el chunk de entrada. Si falla, lo dice en la
 * consola y nada más: Hermes anda igual sin él, solo que no ofrece instalarse.
 */
export function registrarServiceWorker(): void {
  if (!debeRegistrarServiceWorker(entornoActual())) return;
  const registrar = () => {
    navigator.serviceWorker.register(RUTA_DEL_SERVICE_WORKER, { scope: '/' }).catch((error: unknown) => {
      console.warn('[pwa] no se pudo registrar el service worker; Hermes sigue igual, pero no ofrece instalarse', error);
    });
  };
  if (document.readyState === 'complete') registrar();
  else window.addEventListener('load', registrar, { once: true });
}
