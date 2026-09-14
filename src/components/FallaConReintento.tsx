import { RotateCw } from 'lucide-react';
import { ErrorApi } from '../lib/datos/cliente';
import { controlDeBarraClass } from '../lib/styles';

/**
 * UNA FALLA QUE SE PUEDE REINTENTAR, EN PANTALLA — no una pantalla en blanco ni un spinner eterno.
 *
 * Nació con #952 (ADR 0108). Cuando el server no puede leer las líneas de quien mira, contesta 503
 * `lineas_no_leidas` en vez de servir de más. Lo que la persona tiene que ver es POR QUÉ no hay nada
 * y un botón que vuelva a pedir. Sin eso, una cola vacía se lee como «estás al día» y un «Hoy» en
 * blanco, como un Hermes colgado.
 *
 * El mensaje es el del server cuando la falla trae nombre (`ErrorApi` con `codigo`), porque es el
 * que sabe qué pasó; si no, el genérico que pasa quien la usa.
 */
export function FallaConReintento({
  error,
  generico,
  onReintentar,
  reintentando = false,
  compacta = false,
}: {
  error: unknown;
  /** Lo que se dice cuando la falla no trae mensaje propio. */
  generico: string;
  onReintentar: () => void;
  /** Mientras el reintento está en vuelo: el botón no se puede volver a tocar. */
  reintentando?: boolean;
  /** Una línea dentro de otro bloque, en vez de ocupar el espacio de la lista. */
  compacta?: boolean;
}) {
  const mensaje = error instanceof ErrorApi && error.codigo ? error.message : generico;
  return (
    <div
      role="alert"
      className={
        compacta
          ? 'mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground'
          : 'flex flex-col items-center gap-3 px-6 py-12 text-center'
      }
    >
      <p className={compacta ? '' : 'max-w-md text-sm leading-relaxed text-foreground'}>{mensaje}</p>
      <button
        type="button"
        onClick={onReintentar}
        disabled={reintentando}
        aria-busy={reintentando}
        className={controlDeBarraClass + ' disabled:opacity-60'}
      >
        <RotateCw size={12} aria-hidden="true" className={reintentando ? 'motion-safe:animate-spin' : ''} />
        Reintentar
      </button>
    </div>
  );
}
