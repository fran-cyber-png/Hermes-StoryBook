// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { debeRegistrarServiceWorker, registrarServiceWorker } from './registrarServiceWorker';

/**
 * CUÁNDO HERMES REGISTRA SU SERVICE WORKER — la regla y el cableado, por separado (candado 11).
 *
 * 🔴 **La cáscara Tauri no lo registra.** La ventana de la app de escritorio navega a la misma URL que el
 * navegador, así que sin la guarda el SW quedaría instalado adentro del WebView de la vendedora, que se
 * actualiza por OTA y no necesita instalarse.
 */

describe('debeRegistrarServiceWorker — la regla', () => {
  test('en un navegador con soporte y en el build de producción, sí', () => {
    expect(debeRegistrarServiceWorker({ enTauri: false, soportaServiceWorker: true, esProduccion: true })).toBe(true);
  });

  test.each([
    ['🔴 dentro de la cáscara Tauri', { enTauri: true, soportaServiceWorker: true, esProduccion: true }],
    ['sin soporte de service worker', { enTauri: false, soportaServiceWorker: false, esProduccion: true }],
    ['en desarrollo, con vite', { enTauri: false, soportaServiceWorker: true, esProduccion: false }],
  ])('%s, no', (_que, entorno) => {
    expect(debeRegistrarServiceWorker(entorno)).toBe(false);
  });
});

describe('registrarServiceWorker — el cableado', () => {
  const register = vi.fn(async () => ({}));

  beforeEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register } });
    vi.stubEnv('PROD', true);
  });

  afterEach(() => {
    register.mockReset();
    register.mockImplementation(async () => ({}));
    Reflect.deleteProperty(navigator, 'serviceWorker');
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /** Registra, y si la página todavía no terminó de cargar, la termina. */
  function registrarYCargar() {
    registrarServiceWorker();
    window.dispatchEvent(new Event('load'));
  }

  test('en el navegador registra /sw.js para toda la app', () => {
    registrarYCargar();
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  test('🔴 en la cáscara Tauri no registra nada', () => {
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = { invoke: async () => null };
    registrarYCargar();
    expect(register).not.toHaveBeenCalled();
  });

  test('si el registro falla, lo avisa en la consola y la app sigue', async () => {
    register.mockRejectedValueOnce(new Error('el navegador no quiso'));
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(registrarYCargar).not.toThrow();
    await vi.waitFor(() => expect(aviso).toHaveBeenCalled());
  });
});

describe('main.tsx lo llama', () => {
  test('🔴 el arranque de la app registra el service worker', () => {
    const MAIN = Object.values(import.meta.glob('../../main.tsx', { eager: true, query: '?raw', import: 'default' }))[0] as string;
    expect(MAIN, 'no se pudo leer main.tsx').toBeTruthy();
    expect(MAIN).toMatch(/import \{ registrarServiceWorker \} from '\.\/lib\/pwa\/registrarServiceWorker'/);
    expect(MAIN).toMatch(/^registrarServiceWorker\(\);?$/m);
  });
});
