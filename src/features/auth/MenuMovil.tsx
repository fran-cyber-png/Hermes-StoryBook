import { useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { usePopover } from '../../lib/teclado/usePopover';
import { inicial } from '../../lib/iniciales';
import type { Vendedora } from './sesion';

/**
 * LA CUENTA, EN EL CELULAR — y sólo para salir.
 *
 * En escritorio la cuenta vive abajo del riel (`PanelUsuario`): foto grande,
 * línea vinculada, sesión de Cerberus, Configuración. En el teléfono no hay
 * riel, y el pedido es mínimo a propósito: se atiende la cola y se sale. Vincular
 * una línea o cambiar la contraseña se sigue haciendo desde la computadora.
 *
 * Quién entró va escrito arriba de la acción: con cinco vendedoras compartiendo
 * teléfonos, «¿entré con el usuario que era?» es la pregunta que se contesta
 * antes de salir.
 *
 * El cierre —Escape y tocar afuera— lo pone `usePopover`, el de todos los
 * popovers. `z-30`/`z-40`: por encima de la cola, por debajo del chat abierto
 * (`z-40` en `App.tsx`, que de todos modos tapa esta barra).
 */
export function MenuMovil({ vendedora, onSalir }: { vendedora: Vendedora; onSalir: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const disparador = useRef<HTMLButtonElement>(null);
  const { propsOverlay } = usePopover(
    abierto,
    () => {
      setAbierto(false);
      disparador.current?.focus();
    },
    { z: 'z-30' },
  );

  return (
    // `flex` y no un `span` en línea: dentro de un bloque, un `span` en línea que
    // envuelve un botón `flex` queda PRIMERO en la pila de `elementsFromPoint` y
    // el toque puede caerle a él y no al botón. En `PanelUsuario` no pasa porque
    // su padre es `flex`; acá no se depende de quién sea el padre.
    <span className="relative flex">
      <button
        ref={disparador}
        type="button"
        aria-label="Tu cuenta"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className={
          'flex size-10 items-center justify-center rounded-full font-heading text-sm font-bold ' +
          'transition-[background-color,color,transform] duration-200 ease-house active:scale-[0.96] ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
          (abierto ? 'bg-navy text-white' : 'bg-secondary text-navy-ink')
        }
      >
        {inicial(vendedora.nombre)}
      </button>

      {abierto && (
        <>
          <div {...propsOverlay} />
          <div
            role="menu"
            aria-label="Cuenta"
            className="absolute right-0 top-full z-40 mt-2 w-64 animate-entrar rounded-xl bg-card p-1.5 shadow-panel"
          >
            <p className="truncate px-3 pb-2 pt-1.5 text-sm font-bold text-foreground">{vendedora.nombre}</p>
            <div className="mx-1 mb-1 border-t border-border" />
            <button
              type="button"
              role="menuitem"
              onClick={onSalir}
              className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-semibold text-foreground transition-colors duration-150 ease-house active:bg-destructive/10 active:text-destructive"
            >
              <LogOut size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </span>
  );
}
