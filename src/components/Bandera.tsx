import { lazy, Suspense } from 'react';

/**
 * UNA BANDERA DIBUJADA, NUNCA UN EMOJI (dueño, 13-sep-2026: «el país debe salir
 * como bandera»).
 *
 * 🔴 **Windows no dibuja los emojis de bandera**: en WebView2 —donde corre la
 * cáscara Tauri de casi todo el equipo— 🇵🇪 sale como las letras «PE». Por eso
 * son SVG (`country-flag-icons`, MIT).
 *
 * ⚠️ **Los dibujos se cargan perezosos** (`BanderaDibujo.tsx`): en el chunk de
 * entrada pasaban el presupuesto del arranque. Mientras llegan se reserva el
 * mismo rectángulo, así el nombre del país no salta de lugar.
 */
const BanderaDibujo = lazy(() => import('./BanderaDibujo'));

const MARCO = 'h-3 w-[18px] shrink-0 rounded-[3px]';

export function Bandera({ iso, nombre, className = '' }: { iso: string; nombre: string; className?: string }) {
  return (
    <Suspense fallback={<span aria-hidden className={`inline-block bg-muted ${MARCO} ${className}`} />}>
      <BanderaDibujo
        iso={iso}
        nombre={nombre}
        // El anillo de 1 px en tinta casi transparente separa las banderas con blanco
        // (Perú, Japón…) del fondo de la tarjeta sin ponerles un borde gris.
        className={`${MARCO} shadow-[0_0_0_1px_rgb(0_0_0/0.08)] ${className}`}
      />
    </Suspense>
  );
}
