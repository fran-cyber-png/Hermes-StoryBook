import { Star } from 'lucide-react';
import { useMarcarFavorito } from './contactosRegistrados';

/**
 * LA ESTRELLA DE FAVORITO — un solo componente, para que prender/apagar se
 * sienta igual en la tabla, la cuadrícula y el detalle (pedido del 24-ago-2026:
 * antes solo se podía tocar desde la ficha; ahora también desde la lista, a
 * la derecha de las etiquetas).
 */
export function BotonFavorito({
  clave,
  favorito,
  compacto = false,
}: {
  clave: string;
  favorito: boolean;
  compacto?: boolean;
}) {
  const marcar = useMarcarFavorito();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // no seleccionar la fila/tarjeta de paso
        marcar.mutate({ clave, favorito: !favorito });
      }}
      aria-label={favorito ? 'Quitar de favoritos' : 'Marcar como favorito'}
      aria-pressed={favorito}
      title={favorito ? 'Quitar de favoritos' : 'Marcar como favorito'}
      className={
        'shrink-0 rounded-md transition-colors hover:bg-muted ' + (compacto ? 'p-0.5' : 'p-1')
      }
    >
      <Star
        size={compacto ? 13 : 15}
        className={favorito ? 'fill-warning text-warning' : 'text-muted-foreground'}
      />
    </button>
  );
}
