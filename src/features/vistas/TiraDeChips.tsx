import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * UNA FILA DE CHIPS QUE SE CORRE DE LADO — y avisa que hay más.
 *
 * Los recortes de una columna van en UNA fila (10-sep-2026): con dos o tres
 * renglones de chips, cada columna tenía una cabecera de otra altura y las
 * tarjetas arrancaban a destiempo en un tablero que ADR 0089 quiere parejo.
 * Pero en «Saben el precio» los chips reales no entran en los ~217 px de una
 * columna a 1280 (En ventana 455 · Para seguir 764 · Se callaron 2.383), así que
 * la fila se desliza.
 *
 * 🔴 **Y UN CHIP DETRÁS DE UN SCROLL QUE NO SE VE ES UN CHIP QUE NO EXISTE.** Es la
 * cicatriz de la barra de filtros de la cola (`canales/BarraFiltros.tsx`): el
 * chip de la deuda quedó detrás de un scroll invisible. Por eso el borde que
 * tiene más chips del otro lado se desvanece.
 *
 * ⚠️ **Máscara y no un degradado pintado encima**: el fondo de la columna es
 * `bg-secondary/50` sobre el fondo de la app, y un degradado de color no calza
 * con esa mezcla en ninguno de los dos temas. La máscara desvanece los chips
 * mismos y deja ver el fondo que haya. Va con `WebkitMaskImage` porque la
 * cáscara de escritorio en macOS es WebKit.
 *
 * ⚠️ **Nada con menú adentro**: `overflow-x-auto` recorta también en vertical, y
 * un popover absoluto (el «Cuándo» de `FiltroCuando`) quedaría cortado. Ese va
 * afuera de la tira (`VistaEmbudo`).
 */
const DESVANECIDO_PX = 20;

export function TiraDeChips({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [bordes, setBordes] = useState({ izquierda: false, derecha: false });

  // Sin dependencias a propósito: los chips aparecen y desaparecen con los datos
  // (la regla del cero) sin que la tira cambie de tamaño, así que un
  // ResizeObserver solo no se enteraría. Medir es barato; el `set` sólo cambia
  // el estado si algo cambió, así que no hay bucle.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const izquierda = el.scrollLeft > 1;
      const derecha = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setBordes((b) => (b.izquierda === izquierda && b.derecha === derecha ? b : { izquierda, derecha }));
    };
    medir();
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    observador?.observe(el);
    el.addEventListener('scroll', medir, { passive: true });
    return () => {
      observador?.disconnect();
      el.removeEventListener('scroll', medir);
    };
  });

  const mascara =
    bordes.izquierda || bordes.derecha
      ? `linear-gradient(to right, ${bordes.izquierda ? 'transparent' : 'black'}, black ${DESVANECIDO_PX}px, black calc(100% - ${DESVANECIDO_PX}px), ${bordes.derecha ? 'transparent' : 'black'})`
      : undefined;

  return (
    <div
      ref={ref}
      className="sin-riel flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
      style={mascara ? { maskImage: mascara, WebkitMaskImage: mascara } : undefined}
    >
      {children}
    </div>
  );
}
