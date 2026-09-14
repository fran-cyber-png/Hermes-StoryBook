import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * UN COMPONENTE PEREZOSO QUE NO DEJA LA PANTALLA EN BLANCO SI SU CHUNK YA NO EXISTE.
 *
 * `React.lazy` rechaza cuando el `import()` falla, y sin un ErrorBoundary encima ese rechazo desmonta
 * la pantalla entera. El caso real: una vendedora con Hermes abierto desde antes de un deploy abre un
 * chat, el navegador pide por nombre el chunk viejo del grabador, y el server contesta `index.html` (el
 * fallback de la SPA) porque ese archivo ya no existe. Con esto, lo que no cargó no se dibuja, lo demás
 * sigue en pie y el motivo queda en la consola. Salió de la revisión de #996.
 *
 * ⚠️ **No reintenta.** `lazy` recuerda lo que resolvió, así que lo que no cargó sigue sin dibujarse hasta
 * recargar la página: un «Ver en grande» que no abre nada. Es mejor que la pantalla en blanco, no es lo
 * ideal. Recargar sola ante `vite:preloadError` sería el paso siguiente, y hoy nadie lo escucha.
 *
 * Recibe el componente, no el módulo: `perezoso(() => import('./X').then((m) => m.X))`.
 */
export function perezoso<P extends object>(
  cargar: () => Promise<ComponentType<P>>,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(() =>
    cargar().then(
      (componente) => ({ default: componente }),
      (error: unknown) => {
        console.warn('[perezoso] no se pudo cargar un componente diferido; no se dibuja', error);
        return { default: Nada as ComponentType<P> };
      },
    ),
  );
}

function Nada(): null {
  return null;
}
