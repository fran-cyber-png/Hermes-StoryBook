import type { ReactNode } from 'react';

/**
 * EL TÍTULO DE LA SECCIÓN QUE ESTÁ ABIERTA — Pipeline, Contactos, Mensajes…
 *
 * ── Por qué existe un componente para una línea de CSS ──
 * Porque antes no existía y se notaba. El rótulo de la vista vivía como un
 * `<h1>` suelto en la barra de `App.tsx` con `text-sm` —14 px, el mismo cuerpo
 * que una fila de la cola— mientras adentro de las vistas había encabezados de
 * 18 y hasta 24 px. O sea: **el título de la página era el texto más chico de
 * la página**, y la jerarquía quedaba dada vuelta. Con el rótulo acá, el tamaño
 * de «dónde estoy parada» se decide en UN lugar para las diez secciones.
 *
 * No hay escala tipográfica en el tema (`@theme` sólo define familias, no
 * tamaños), así que esto es lo más cerca de un token que se puede tener sin
 * inventar un sistema entero para un caso.
 *
 * ── La jerarquía que fija ──
 * Un solo escalón, y bien marcado, porque lo único que tiene que contestar la
 * barra de arriba es «¿en qué pantalla estoy?»:
 *
 *   título de sección   24 px / 700   ← esto
 *   encabezado interno  18 px / 600-700
 *   cuerpo              13-14 px
 *   meta y controles    11 px
 *
 * ⚠️ **Es el único `<h1>` de la pantalla, y eso no es decoración.** La barra se
 * dibuja antes que la vista, así que `querySelector('h1')` devuelve éste — y
 * `App.test.tsx` lo usa exactamente así para preguntar qué vista está adelante.
 * Un `<h1>` nuevo adentro de una vista rompería esa lectura además de repetir
 * el nivel: adentro van `<h2>`.
 */
export function TituloDeSeccion({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-heading text-2xl font-bold leading-tight tracking-tight text-navy-ink">
      {children}
    </h1>
  );
}
