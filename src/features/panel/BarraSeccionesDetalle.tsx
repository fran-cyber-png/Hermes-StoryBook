import { seccionesDetalle, type IdSeccionDetalle } from './pestanas';

/**
 * #887 — LA BARRA DE Resumen · Actividad · Compras · Datos.
 *
 * Reemplaza el scroll único que apilaba Quién es, el timeline entero y
 * Compras uno debajo del otro («un scroll infinito», el dueño 8-sep-2026).
 * Una fila de 4 —de 3 en campaña, que no tiene «Compras» (`pestanas.ts`)—,
 * ícono opcional a futuro — hoy solo el rótulo, porque a 360/372 px un ícono
 * por pestaña deja menos de 60 px de texto por una.
 */
export function BarraSeccionesDetalle({
  activa,
  onCambiar,
  esDeCampana = false,
}: {
  activa: IdSeccionDetalle;
  onCambiar: (id: IdSeccionDetalle) => void;
  /** En campaña no hay «Compras» (`pestanas.ts`). Ausente = ventas. */
  esDeCampana?: boolean;
}) {
  return (
    <div role="tablist" className="flex border-b border-border px-4">
      {seccionesDetalle({ esDeCampana }).map((s) => (
        <button
          key={s.id}
          type="button"
          role="tab"
          aria-selected={activa === s.id}
          onClick={() => onCambiar(s.id)}
          className={
            'flex-1 border-b-2 px-1 py-2 text-xs font-semibold transition-colors duration-150 ease-house ' +
            (activa === s.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground')
          }
        >
          {s.etiqueta}
        </button>
      ))}
    </div>
  );
}
