import { useEffect, useRef, useState } from 'react';
import { MessageSquareQuote, Settings2, Users } from 'lucide-react';

/**
 * «CONFIGURACIÓN» AL PIE DEL RIEL (03-sep-2026) — reemplaza al botón
 * «Configurar Respuestas Rápidas» que vivía solo ahí. Con "Administrar
 * espacios" mudándose desde `SelectorDeEspacio.tsx`, dos acciones de
 * administración competían por el mismo lugar fijo del pie del riel; en vez
 * de apilarlas (dos filas, cada una empujando a la Libreta hacia arriba) se
 * fusionan en un menú — mismo criterio que "Nueva página" ya usa para sus
 * dos formas de empezar (`NuevaPagina.tsx`).
 *
 * Mismo patrón de "clic afuera cierra" que ese componente (`pointerdown` en
 * captura + `ref`) — tercera vez que se necesita, ver también
 * `SelectorDeIconoDeEspacio.tsx`.
 */
export function MenuDeConfiguracion({
  onAdministrarEspacios,
  onConfigurarRespuestas,
}: {
  onAdministrarEspacios: () => void;
  onConfigurarRespuestas: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', afuera, true);
    return () => document.removeEventListener('pointerdown', afuera, true);
  }, [abierto]);

  return (
    // `h-14` FIJO (03-sep-2026, antes `p-2` a secas) — el mismo alto exacto
    // que el pie de la paginación del panel de "Páginas" (`Libreta.tsx`),
    // para que las dos líneas divisorias queden a la MISMA altura: con cada
    // uno sacando su alto de su propio contenido (un texto acá, íconos
    // ahí), los dos números salían distintos y la línea se veía descolgada
    // entre las dos tarjetas — reportado con una captura.
    <div ref={caja} className="relative flex h-14 shrink-0 items-center border-t border-border px-2">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        // Mismo azul de hover que el resto de las filas fijas de la Libreta
        // (`FilaPagina`, `border-primary/30 bg-secondary`): no hay estado
        // "activo" que marcar, así que el hover toma esos dos colores para
        // que se lea como parte de la misma familia y no como un gris genérico.
        className="group flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-primary/30 hover:bg-secondary"
      >
        <Settings2 className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        <span className="block text-sm font-medium text-foreground transition-colors group-hover:text-navy-ink">
          Configuración
        </span>
      </button>

      {abierto && (
        <div className="absolute bottom-full left-2 right-2 z-20 mb-1 rounded-lg border border-border bg-card p-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onAdministrarEspacios();
              setAbierto(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
          >
            <Users className="size-4 shrink-0 text-muted-foreground" />
            Administrar espacios
          </button>
          <button
            type="button"
            onClick={() => {
              onConfigurarRespuestas();
              setAbierto(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
          >
            <MessageSquareQuote className="size-4 shrink-0 text-muted-foreground" />
            Configurar respuestas rápidas
          </button>
        </div>
      )}
    </div>
  );
}
