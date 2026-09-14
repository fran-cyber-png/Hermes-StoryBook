import { describe, expect, test } from 'vitest';

/**
 * HERMES SE PUEDE INSTALAR — el manifest, sus íconos, la marca y el `<head>` dicen lo mismo.
 *
 * Nada de esto tiene lógica, pero todo falla mudo: con un ícono que no existe o un `sizes` mal escrito, Chrome
 * simplemente no ofrece instalar, sin un error en ningún lado. Con este manifest, `Page.getInstallabilityErrors`
 * no dio ningún error en Chromium 151 ni en Chrome 152 (11-sep-2026, ADR 0111).
 *
 * ⚠️ `import.meta.glob` y NUNCA `node:fs`: con `fs` el test pasa en vitest y falla el typecheck de
 * `tsconfig.app.json`, que no lleva los tipos de node (ver `lib/tema.test.tsx`).
 */

interface IconoDelManifest {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: IconoDelManifest[];
}

const primero = (archivos: Record<string, unknown>) => Object.values(archivos)[0] as string | undefined;

const HTML = primero(import.meta.glob('../../../index.html', { eager: true, query: '?raw', import: 'default' }));
const MANIFEST_CRUDO = primero(import.meta.glob('../../../public/manifest.webmanifest', { eager: true, query: '?raw', import: 'default' }));
const CSS = primero(import.meta.glob('../../index.css', { eager: true, query: '?raw', import: 'default' }));
/** Las rutas públicas de los PNG que de verdad existen: `/pwa/hermes-192.png`… */
const ICONOS_EN_PUBLIC = Object.keys(import.meta.glob('../../../public/pwa/*.png')).map((ruta) =>
  ruta.replace('../../../public', ''),
);

function manifest(): Manifest {
  expect(MANIFEST_CRUDO, 'no hay public/manifest.webmanifest').toBeTruthy();
  return JSON.parse(MANIFEST_CRUDO!) as Manifest;
}

/** El primer valor de un token de `src/index.css`: el del tema claro, que es el de `:root`. */
function token(nombre: string): string | undefined {
  return CSS?.match(new RegExp(`--${nombre}:\\s*(#[0-9A-Fa-f]{6})`))?.[1];
}

describe('el manifest', () => {
  test('trae lo que Chrome pide para instalar', () => {
    const m = manifest();
    expect(m.name).toBe('Hermes');
    expect(m.short_name).toBe('Hermes');
    expect(m.start_url).toBe('/');
    expect(m.scope).toBe('/');
    expect(m.display).toBe('standalone');
  });

  test('🔴 cada ícono que declara existe en public/, y están el 192, el 512 y el maskable', () => {
    const { icons } = manifest();
    for (const icono of icons) expect(ICONOS_EN_PUBLIC, `el manifest pide ${icono.src} y no está`).toContain(icono.src);
    expect(icons.some((i) => i.sizes === '192x192' && i.type === 'image/png')).toBe(true);
    expect(icons.some((i) => i.sizes === '512x512' && i.type === 'image/png' && (i.purpose ?? 'any') === 'any')).toBe(true);
    expect(icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
  });

  test('🔴 los colores son los tokens de la marca, no una copia que se pueda separar', () => {
    const m = manifest();
    expect(token('navy'), 'no encontré --navy en index.css').toBeTruthy();
    expect(m.theme_color).toBe(token('navy'));
    expect(m.background_color).toBe(token('background'));
  });
});

describe('el <head> de index.html', () => {
  test('enlaza el manifest y el ícono de iOS, y su theme-color es el del manifest', () => {
    expect(HTML).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest" \/>/);
    expect(HTML).toMatch(/<link rel="apple-touch-icon" href="\/pwa\/apple-touch-icon\.png" \/>/);
    expect(ICONOS_EN_PUBLIC).toContain('/pwa/apple-touch-icon.png');
    expect(HTML!.match(/<meta name="theme-color" content="(#[0-9A-Fa-f]{6})" \/>/)?.[1]).toBe(manifest().theme_color);
  });

  test('el viewport llega hasta los bordes del celular', () => {
    const viewport = HTML!.match(/<meta name="viewport" content="([^"]+)" \/>/)?.[1] ?? '';
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('initial-scale=1');
    expect(viewport).toContain('viewport-fit=cover');
    // Con el teclado abierto, Chrome Android achica el viewport en vez de taparlo: el composer queda a la vista.
    expect(viewport).toContain('interactive-widget=resizes-content');
  });

  test('instalado en iOS abre sin la barra de Safari y con su nombre', () => {
    expect(HTML).toMatch(/<meta name="apple-mobile-web-app-capable" content="yes" \/>/);
    expect(HTML).toMatch(/<meta name="mobile-web-app-capable" content="yes" \/>/);
    expect(HTML).toMatch(/<meta name="apple-mobile-web-app-title" content="Hermes" \/>/);
  });
});
