import { UserRound } from 'lucide-react';
import type { MarcaAsignacion } from '../../dominio/dueno';

/**
 * A QUIÉN ESTÁ ASIGNADA, dibujado — UNA píldora para la tarjeta y la Lista.
 *
 * Qué se dice lo decide `marcaDeAsignacion` (`dominio/dueno.ts`); acá sólo la
 * forma, para que las dos vistas no puedan decirlo distinto. Neutra y sin oro: no
 * apura nada, dice de quién es. «Sin asignar» va con el contorno PUNTEADO, la
 * forma que la casa ya usa para «esto no lo tiene nadie todavía»
 * (`dominio/origen.ts`), y mide lo mismo que la llena (borde + `py-px` en las
 * dos) para que la tarjeta no salte de alto.
 */
export function PildoraAsignacion({ marca }: { marca: MarcaAsignacion }) {
  return (
    <span
      title={marca.titulo}
      className={
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[11px] font-semibold ' +
        (marca.asignada ? 'border-border text-foreground' : 'border-dashed border-border text-muted-foreground')
      }
    >
      <UserRound size={10} className="shrink-0" aria-hidden />
      {marca.texto}
    </span>
  );
}
