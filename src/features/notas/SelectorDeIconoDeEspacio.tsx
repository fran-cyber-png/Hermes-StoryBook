import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw } from 'lucide-react';
import { ICONOS_DE_ESPACIO, ICONO_POR_DEFECTO, iconoDeEspacio } from './iconosDeEspacio';

/**
 * Alto de la cuadrícula + el botón de "usar el de siempre" — lo que hace
 * falta para decidir si abre para arriba o para abajo. No es una
 * ESTIMACIÓN: el contenido es siempre el mismo (las 25 claves fijas de
 * `ICONOS_DE_ESPACIO`, nunca menos ni más), así que el alto real no cambia
 * entre aperturas y se puede medir una vez a mano. Medido con Playwright
 * contra el DOM real: 245px — acá va con margen porque un cálculo 3px corto
 * es exactamente el defecto que este número existe para evitar (reportado
 * con una captura: la cuadrícula se cortaba contra el borde del modal).
 */
const ALTO_PANEL = 256;
const ANCHO = 256;
const MARGEN = 8;

/**
 * ELEGIR EL ÍCONO DE UN ESPACIO (03-sep-2026) — un botón con el ícono actual
 * que abre una cuadrícula de las 25 claves del set curado, más un camino de
 * vuelta al de siempre.
 *
 * 🔴 **VA POR UN PORTAL A `document.body`, y no es antojo.** Este selector
 * vive adentro de `ModalDeEspacios`, que tiene su lista con
 * `overflow-y-auto` (necesita scroll: puede haber muchos espacios). Un
 * popover `position: absolute` normal queda RECORTADO por ese contenedor en
 * cuanto la fila no está pegada arriba — reportado con una captura: la
 * cuadrícula se cortaba a la mitad contra el borde del modal. `fixed` +
 * portal escapa de cualquier ancestro con `overflow`, y la posición se
 * calcula a mano desde el botón (`getBoundingClientRect`), con flip hacia
 * arriba si no entra hacia abajo.
 *
 * Por ir afuera del árbol de `caja` (el botón), el "clic afuera cierra" no
 * puede mirar solo esa `ref` — por eso hay una segunda `ref` para el panel
 * portado, y las dos cuentan como "adentro".
 */
export function SelectorDeIconoDeEspacio({
  valor,
  onElegir,
  deshabilitado,
}: {
  valor: string | null | undefined;
  onElegir: (clave: string | null) => void;
  deshabilitado?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const Actual = iconoDeEspacio(valor);

  const posicionar = () => {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    const abajo = window.innerHeight - r.bottom >= ALTO_PANEL + MARGEN;
    const top = abajo ? r.bottom + MARGEN : Math.max(MARGEN, r.top - ALTO_PANEL - MARGEN);
    // Pegado a la izquierda del botón, sin salirse por la derecha de la ventana.
    const left = Math.min(r.left, window.innerWidth - ANCHO - MARGEN);
    setPos({ top, left: Math.max(MARGEN, left) });
  };

  useEffect(() => {
    if (!abierto) return;
    posicionar();

    const afuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (boton.current?.contains(t) || panel.current?.contains(t)) return;
      setAbierto(false);
    };
    // Captura: cualquier scroll (el de la lista del modal incluido) reubica
    // el panel en vez de dejarlo pegado a una posición vieja.
    document.addEventListener('pointerdown', afuera, true);
    window.addEventListener('scroll', posicionar, true);
    window.addEventListener('resize', posicionar);
    return () => {
      document.removeEventListener('pointerdown', afuera, true);
      window.removeEventListener('scroll', posicionar, true);
      window.removeEventListener('resize', posicionar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        disabled={deshabilitado}
        aria-label="Cambiar el ícono del espacio"
        aria-expanded={abierto}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"
      >
        <Actual className="size-4" />
      </button>

      {abierto &&
        pos &&
        createPortal(
          <div
            ref={panel}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: ANCHO }}
            className="z-50 rounded-lg border border-border bg-card p-2 shadow-lg"
          >
            <div className="grid grid-cols-5 gap-1">
              {ICONOS_DE_ESPACIO.map(({ clave, Icono }) => {
                const elegido = valor === clave;
                return (
                  <button
                    key={clave}
                    type="button"
                    title={clave}
                    onClick={() => {
                      onElegir(clave);
                      setAbierto(false);
                    }}
                    className={`flex size-9 items-center justify-center rounded-lg border transition ${
                      elegido
                        ? 'border-primary bg-secondary text-foreground'
                        : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icono className="size-4" />
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                onElegir(null);
                setAbierto(false);
              }}
              className="mt-1.5 flex w-full items-center gap-1.5 rounded-lg border-t border-border px-1.5 pt-2 text-left text-xs text-muted-foreground transition hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              Usar el de siempre
              <ICONO_POR_DEFECTO className="ml-auto size-3.5 shrink-0" />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
