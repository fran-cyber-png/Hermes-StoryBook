import { useCallback, useLayoutEffect, useSyncExternalStore } from 'react';
import { useLocalStorage } from './useLocalStorage';

/**
 * EL TEMA DE LA APP — claro u oscuro, para toda la mesa.
 *
 * Antes esto era un botón adentro de la Agenda que le pegaba una clase al
 * contenedor de la Agenda (`agenda-dark-mode`). Funcionaba en la Agenda y en
 * ningún otro lado — y mientras tanto la app ENTERA se ponía oscura sola por una
 * media query global que ese mismo commit había dejado suelta. O sea: el tema no
 * lo elegía nadie, lo elegía el sistema operativo, y el interruptor movía un
 * rectángulo de la pantalla.
 *
 * Ahora hay una sola perilla, en la barra de arriba, y una sola forma de decir
 * qué tema está puesto: el atributo `data-theme` sobre `<html>`. El CSS no
 * pregunta nada más.
 *
 * ── El sistema propone, la vendedora dispone ──
 * Sin elección guardada, se sigue al sistema operativo (y se sigue en vivo: si
 * el equipo cambia a oscuro al atardecer, Hermes también). En cuanto toca el
 * botón, esa elección manda y sobrevive a recargas y a cerrar la app. No hay
 * forma de volver a «lo que diga el sistema» desde el botón, y está bien: es un
 * interruptor de dos posiciones, no un menú de tres.
 */

export type Tema = 'claro' | 'oscuro';

/** La clave en localStorage. Fuera del hook porque `arrancarTema()` la lee crudo. */
export const CLAVE_TEMA = 'hermes-tema';

const CONSULTA_OSCURO = '(prefers-color-scheme: dark)';

/** Lo que pide el sistema operativo ahora mismo. */
export function temaDelSistema(): Tema {
  // `matchMedia` no existe en jsdom (lo remienda `src/pruebas/dom.tsx`) ni en
  // node: sin la guarda, importar este módulo desde un test puro revienta.
  const mq = typeof window !== 'undefined' ? window.matchMedia?.(CONSULTA_OSCURO) : undefined;
  return mq?.matches ? 'oscuro' : 'claro';
}

/**
 * La elección guardada, o `null` si nunca eligió.
 *
 * Lee el crudo y lo valida en vez de confiar: `useLocalStorage` guarda JSON, y
 * un valor viejo de otra versión (la clave anterior guardaba `"true"`) no puede
 * dejar la app en un tema que no existe.
 */
export function temaGuardado(): Tema | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_TEMA);
    if (crudo === null) return null;
    const valor: unknown = JSON.parse(crudo);
    return valor === 'claro' || valor === 'oscuro' ? valor : null;
  } catch {
    return null;
  }
}

/**
 * 🔴 EL CAMBIO DE TEMA NO SE TRANSICIONA — y ésta es la mitad del parpadeo que
 * el `useLayoutEffect` de abajo no podía arreglar.
 *
 * Hay ~470 elementos en la app con `transition-colors` o
 * `transition-[color,background-color,…] duration-200`. Ninguno es del tema:
 * están para el hover. Pero una transición de color no distingue de dónde salió
 * el color nuevo, así que también agarra el cambio de las variables CSS cuando
 * `data-theme` se da vuelta — y entonces cada elemento se toma sus 200 ms para
 * llegar.
 *
 * Medido el 3-sep-2026 en Chromium, sobre las clases del riel de `App.tsx`, 100
 * ms después de dar vuelta el tema: el fondo iba en `rgb(166, 172, 181)`, un
 * gris que NO EXISTE en ninguno de los dos temas —ni el `rgb(33, 40, 48)` del
 * oscuro ni el `rgb(239, 244, 254)` del claro—, mientras el borde del MISMO
 * elemento ya estaba en el color nuevo (no tiene transición). O sea: durante un
 * quinto de segundo hay en pantalla una mezcla de los dos temas más un tercero
 * inventado. Eso es lo que se ve y se reporta como «delay».
 *
 * Se apagan TODAS las transiciones, se estampa el atributo, el navegador pinta
 * ese cuadro sin ninguna corriendo, y recién después se reactivan. No se agrega
 * ninguna animación: se saca la que había. El hover de después transiciona
 * igual que siempre.
 *
 * ⚠️ La hoja es nueva en cada llamada y se la lleva su propio `setTimeout`. Con
 * una clase compartida y un temporizador único, dos clics seguidos —que es
 * exactamente cómo se prueba un interruptor— dejaban al segundo sin protección,
 * porque el temporizador del primero la apagaba en el medio.
 */
function sinTransicionDeColor(estampar: () => void): void {
  const hoja = document.createElement('style');
  hoja.dataset.sinTransicionDeTema = '';
  hoja.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.appendChild(hoja);

  estampar();

  // Fuerza el recálculo con el atributo YA puesto y la hoja todavía encima: es
  // lo que garantiza que el cuadro que se pinta sea el del tema nuevo y sin
  // transiciones, en vez de dejar el orden librado a cuándo el navegador
  // decida mirar los estilos.
  void document.documentElement.offsetHeight;

  // Un macrotask, no un microtask: los microtasks corren ANTES de pintar, así
  // que sacar la hoja ahí la volvería inútil.
  window.setTimeout(() => hoja.remove(), 0);
}

/**
 * Estampa el tema en `<html>`. Es lo ÚNICO que mira el CSS.
 *
 * Siempre pone el atributo, incluso cuando el tema coincide con el del sistema:
 * un `data-theme` explícito hace que la hoja no dependa de la media query, y que
 * «claro» signifique claro aunque el equipo esté en oscuro.
 */
export function aplicarTema(tema: Tema): void {
  sinTransicionDeColor(() => {
    document.documentElement.dataset.theme = tema === 'oscuro' ? 'dark' : 'light';
  });
}

/**
 * ANTES DEL PRIMER RENDER, desde `main.tsx`.
 *
 * ⚠️ **ESTO NO ES LO QUE EVITA EL FOGONAZO, aunque durante meses el comentario
 * de acá decía que sí.** Decía que corre «con el `<div id="root">` todavía
 * vacío, así que no hay nada pintado que pueda parpadear», y la segunda mitad
 * es falsa: el `<body>` vacío TAMBIÉN se pinta, con el fondo que diga el CSS.
 * Y esta línea no corre temprano — vive en un módulo diferido, detrás de los
 * 822 KB del chunk de entrada. La ventana dura lo que tarde ese chunk: nada en
 * una recarga con todo en caché, un rato largo la primera vez o con la red
 * mala. Medido demorando el chunk 700 ms a propósito —para poder mirarla—, el
 * fondo claro se pintó los 700 con «oscuro» elegido.
 *
 * El que llega a tiempo es el script clásico de `index.html`. Éste queda como
 * el arranque del lado de JS: deja el atributo puesto para cualquier entrada
 * que no pase por ese HTML, y confirma —sin cambiar nada— lo que el HTML ya
 * resolvió. Los dos usan `aplicarTema`, así que el mapa a `dark`/`light` sigue
 * escrito una sola vez.
 */
export function arrancarTema(): void {
  aplicarTema(temaGuardado() ?? temaDelSistema());
}

/** Que un cambio de tema del SISTEMA vuelva a renderizar a quien lo esté siguiendo. */
function suscribirAlSistema(avisar: () => void) {
  const mq = typeof window !== 'undefined' ? window.matchMedia?.(CONSULTA_OSCURO) : undefined;
  if (!mq) return () => {};
  mq.addEventListener('change', avisar);
  return () => mq.removeEventListener('change', avisar);
}

/**
 * El tema puesto y la forma de darlo vuelta.
 *
 * `useLocalStorage` es lo que hace que esto se pueda leer desde DOS lugares sin
 * que se desincronicen: el botón de la barra y la Libreta —que tiene que pasarle
 * el tema a BlockNote, porque su editor trae hoja propia y no se entera del
 * `data-theme`— miran la misma clave y se enteran a la vez.
 */
export function useTema(): { tema: Tema; alternar: () => void } {
  const [guardado, guardar] = useLocalStorage<Tema | null>(CLAVE_TEMA, null);
  const delSistema = useSyncExternalStore(suscribirAlSistema, temaDelSistema, () => 'claro' as Tema);
  const tema = guardado ?? delSistema;

  // `useLayoutEffect`, no `useEffect`: el click ya cambió el ícono del botón en
  // este mismo render. Un `useEffect` corre DESPUÉS de que el navegador pinta
  // ese frame, así que había un cuadro con el ícono nuevo y el `data-theme`
  // (y con él, todo el fondo/color) todavía viejo — el parpadeo. `useLayoutEffect`
  // corre antes de pintar: los dos cambios llegan en el mismo frame.
  useLayoutEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  const alternar = useCallback(() => {
    guardar(tema === 'oscuro' ? 'claro' : 'oscuro');
  }, [guardar, tema]);

  return { tema, alternar };
}
