import { useSyncExternalStore } from 'react';

/**
 * ¿ESTO SE ESTÁ VIENDO EN UN CELULAR? — el ÚNICO detector de ancho del front.
 *
 * Existe porque el dueño quiere atender desde el teléfono como en WhatsApp: una
 * sola columna, la lista o el chat, nunca los dos. Esa decisión cambia QUÉ SE
 * MONTA (el riel, el panel derecho, la lista escondida detrás del chat), y eso no
 * se puede resolver con una clase `md:` — por eso hay un hook. Lo que sólo cambia
 * de ESTILO (un padding, un tamaño de letra) va con `max-md:` en el className y
 * no pasa por acá.
 *
 * ⚠️ **Uno solo, a propósito.** Con dos detectores —uno con 767 y otro con 768,
 * o uno escuchando `resize` y otro `matchMedia`— habría un ancho en el que el
 * shell cree que es celular y la cola cree que es escritorio. Si hace falta
 * saberlo en otro lado, se importa esto.
 *
 * 🔴 **La consulta es la MISMA que Tailwind emite para `max-md:`, con su unidad y
 * su comparación**, y no un `(max-width: 767px)` que dice lo mismo a 16 px. El
 * corte vive en dos lugares —este hook y cada clase `max-md:`— y el `rem` de una
 * media query sale de la letra del NAVEGADOR: con la letra en 20 px, `48rem` son
 * 960 px, y entre 768 y 959 el shell se armaría de escritorio mientras la cola se
 * pinta de celular. Diciéndolo igual, no hay ancho en el que discrepen. El test
 * lo cruza contra `index.css` (candado #3 de CLAUDE.md, la paridad).
 *
 * `useSyncExternalStore` y no un `useState` + efecto: la primera lectura sale
 * bien en el primer render (sin un cuadro de escritorio antes de pasar a
 * celular) y el cambio de ancho —girar el teléfono, angostar la ventana— llega
 * como una suscripción, no como un sondeo. Sin guarda de SSR ni `addListener`:
 * esta app no se renderiza en un server, y la sintaxis de rango ya exige el
 * mismo Safari (16.4) que el CSS de Tailwind 4.
 */
export const CONSULTA_CELULAR = '(width < 48rem)';

function suscribir(avisar: () => void): () => void {
  const mq = window.matchMedia(CONSULTA_CELULAR);
  mq.addEventListener('change', avisar);
  return () => mq.removeEventListener('change', avisar);
}

function leer(): boolean {
  return window.matchMedia(CONSULTA_CELULAR).matches;
}

export function useEsMovil(): boolean {
  return useSyncExternalStore(suscribir, leer);
}
