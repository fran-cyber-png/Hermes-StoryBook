import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cifra } from '../lib/formato';

/**
 * EL PIE DE PÁGINA DE UNA TABLA — motor de `@tanstack/react-table`.
 *
 * Reusado por `PantallaPadron` (paginación manual, servida por el server) y por
 * `VistaContactosCampana` (paginación automática, en memoria).
 *
 * ⚠️ **Recibe NÚMEROS, no la instancia `Table` de react-table.** `useReactTable`
 * devuelve SIEMPRE el mismo objeto (lo muta in-place — `react-table/src/index.tsx`,
 * `tableRef.current`), así que como prop es referencialmente idéntico entre
 * renders. El React Compiler de este proyecto memoiza automáticamente cada
 * componente comparando props, y con una referencia que nunca cambia decide que
 * `Paginador` no tiene nada nuevo que pintar — aunque `table.getState()` por
 * dentro ya diga otra página. El síntoma exacto: el estado avanza (se ve en el
 * padre), pero el número en pantalla queda pegado. Pasando primitivos, cada
 * pantalla sigue usando `previousPage()`/`nextPage()`/`setPageIndex()` de
 * react-table para NAVEGAR, y solo el número que llega acá cambia por valor.
 *
 * ⚠️ **En angosto el pie se parte en dos renglones y las flechas pierden el
 * texto.** Con el resumen al lado, a 390 px el resumen se partía palabra por
 * palabra encima del número de página (captura del 10-sep-2026).
 */
export function Paginador({
  paginaActual,
  totalPaginas,
  puedeAnterior,
  puedeSiguiente,
  onAnterior,
  onSiguiente,
  onIrA,
  resumen,
}: {
  /** 1-based. */
  paginaActual: number;
  totalPaginas: number;
  puedeAnterior: boolean;
  puedeSiguiente: boolean;
  onAnterior: () => void;
  onSiguiente: () => void;
  /** 1-based; quien llama la clampea si hace falta. */
  onIrA: (pagina: number) => void;
  /**
   * Lo que se dice a la izquierda del pie — «73.200 contactos · se ven 1–50»
   * (ADR 0102). Con esto el pie se dibuja aunque haya una sola página: cuántos
   * hay no depende de que haya a dónde paginar. Sin esto, el pie es el de
   * siempre: centrado, y nada con una página.
   */
  resumen?: ReactNode;
}) {
  const [texto, setTexto] = useState(String(paginaActual));

  // Si la página cambió desde afuera (Anterior/Siguiente, o un filtro que la
  // recortó), el input tiene que reflejarlo — si no, muestra un número viejo
  // hasta que alguien vuelva a tocarlo.
  useEffect(() => {
    setTexto(String(paginaActual));
  }, [paginaActual]);

  if (totalPaginas <= 1 && !resumen) return null;

  function confirmar(valor: string) {
    const n = Number(valor);
    if (!Number.isInteger(n)) {
      setTexto(String(paginaActual));
      return;
    }
    const clamp = Math.min(Math.max(1, n), totalPaginas);
    onIrA(clamp);
    setTexto(String(clamp));
  }

  return (
    <div
      className={`flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-border bg-card px-4 py-2 text-xs ${
        resumen ? 'justify-between' : 'justify-center'
      }`}
    >
      {resumen && <div className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground">{resumen}</div>}

      {totalPaginas > 1 && (
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            disabled={!puedeAnterior}
            onClick={onAnterior}
            aria-label="Página anterior"
            className="flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-foreground hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft size={13} /> <span className="hidden sm:inline">Anterior</span>
          </button>

          <span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
            Página
            <input
              type="number"
              min={1}
              max={totalPaginas}
              value={texto}
              aria-label="Ir a la página"
              onChange={(e) => setTexto(e.target.value)}
              onBlur={(e) => confirmar(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmar(e.currentTarget.value);
              }}
              className="w-12 rounded-md border border-border bg-muted py-0.5 text-center tabular-nums text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
            de <span className="font-semibold text-foreground tabular-nums">{cifra(totalPaginas)}</span>
          </span>

          <button
            type="button"
            disabled={!puedeSiguiente}
            onClick={onSiguiente}
            aria-label="Página siguiente"
            className="flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-foreground hover:bg-muted disabled:opacity-30"
          >
            <span className="hidden sm:inline">Siguiente</span> <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
