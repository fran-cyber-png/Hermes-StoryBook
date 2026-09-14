import { Download, Loader2 } from 'lucide-react';
import type { MediaHilo } from './conversacionWa';
import { useDescargarAdjunto } from './descargarAdjunto';

/**
 * DESCARGAR — en las acciones de la burbuja, para CUALQUIER adjunto.
 *
 * Al lado de Responder y Copiar, y con su mismo molde: siempre en el DOM,
 * invisible hasta el hover (montarlo al pasar por encima haría que el primer
 * clic caiga en la nada). Va en los dos sentidos: se guarda tanto lo que mandó
 * el lead como lo que salió de Hermes.
 *
 * Existe aparte del visor porque un audio o un Excel no se abren en grande, y
 * una foto se quiere guardar sin tener que abrirla primero.
 */
export function BotonDescargarAdjunto({ media, cuando }: { media: MediaHilo; cuando: string }) {
  const { descargar, bajando, fallo, nombre } = useDescargarAdjunto(media, cuando);
  const titulo = fallo ? `No se pudo bajar ${nombre} — toca para reintentar` : `Descargar ${nombre}`;

  return (
    <button
      type="button"
      onClick={descargar}
      disabled={bajando}
      title={titulo}
      aria-label={titulo}
      className={
        'flex size-6 items-center justify-center rounded-full border bg-card shadow-[0_1px_3px_rgba(14,42,82,0.12)] transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-wait ' +
        (bajando || fallo
          ? 'opacity-100 ' + (fallo ? 'border-destructive/40 text-destructive' : 'border-border text-muted-foreground')
          : 'border-border text-muted-foreground opacity-0 group-hover/burbuja:opacity-100')
      }
    >
      {bajando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
    </button>
  );
}
