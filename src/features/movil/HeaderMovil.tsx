import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { BotonDeTema } from '../../components/BotonDeTema';

/**
 * EL HEADER MÓVIL — el que reemplaza al riel de vistas y a la barra de arriba.
 *
 * En escritorio hay dos cosas que en un teléfono no caben: el riel lateral de
 * las nueve vistas y la barra que las encabeza. Acá se funden en una sola
 * franja: de dónde vengo (la flecha), dónde estoy (el título) y las dos señales
 * que no pueden esperar a que abras un menú — el tema y si el bot tiene línea.
 *
 * ⚠️ **El chip del bot NO es decoración.** Dice si hay una máquina contestando
 * a los leads ahora mismo; sin línea, nadie está respondiendo del otro lado. Es
 * el mismo dato que en escritorio vive en `InterruptorBot`, servido acá como
 * aviso de solo lectura: en el teléfono se mira, no se administra.
 */
export function HeaderMovil({
  titulo,
  onVolver,
  aviso,
}: {
  titulo: string;
  /** Sin `onVolver` la flecha no se dibuja: una flecha que no vuelve a ningún lado miente. */
  onVolver?: () => void;
  /** El estado del bot, ya resuelto por quien lo sabe. Ausente = no se dibuja. */
  aviso?: string | null;
}) {
  return (
    <header className="flex h-[76px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-5">
      <div className="flex min-w-0 items-center gap-3">
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            aria-label="Volver"
            className="-ml-1 shrink-0 rounded-lg p-1 text-primary transition-colors duration-200 ease-house hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft size={28} strokeWidth={2.2} />
          </button>
        )}
        <h1 className="min-w-0 truncate font-heading text-2xl font-bold tracking-tight text-foreground">
          {titulo}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <BotonDeTema />
        {aviso && (
          <span
            title={aviso}
            className="flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1.5 font-heading text-[11px] font-semibold text-warning-foreground"
          >
            <TriangleAlert size={12} className="shrink-0" />
            {aviso}
          </span>
        )}
      </div>
    </header>
  );
}
