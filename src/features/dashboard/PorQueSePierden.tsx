import { rotuloDelMotivo } from '../../lib/motivosDePerdida';
import { sectionLabel } from '../../lib/styles';
import type { DatosNegocio } from './negocio';

/**
 * POR QUÉ SE PIERDEN — el bloque de «El negocio» (ADR 0107).
 *
 * Cuenta la MISMA cohorte que la tabla de abajo: las que llegaron en el período y hoy
 * están en «Dijo que no», por el motivo que declaró la persona que las atendía. No son
 * «las pérdidas del período»: una que llegó antes y se perdió ayer no está acá, y el
 * renglón de arriba lo dice para que nadie lo lea de otra forma.
 *
 * ⚠️ **Lo más probable es que diga cero, y está bien que lo diga.** En este negocio la
 * gente se calla: en ventas no hubo un solo `perdido` declarado en toda la historia. El
 * vacío explica de dónde sale el dato (una persona lo declara) en vez de parecer un error.
 *
 * `perdidas` ausente = server viejo o caché rehidratado (ADR 0007): no se dibuja nada.
 */
export function PorQueSePierden({
  perdidas,
  llegaron,
}: {
  perdidas: DatosNegocio['perdidas'];
  /** Cuántas llegaron en el período: el denominador de la frase. */
  llegaron: number;
}) {
  if (!perdidas) return null;

  return (
    <section aria-label="Por qué se pierden" className="shrink-0 rounded-2xl bg-card px-4 py-3 shadow-panel">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h3 className={sectionLabel}>Por qué se pierden</h3>
        {perdidas.total > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {perdidas.total} de las {llegaron} que llegaron en el período hoy están en «Dijo que no».
          </p>
        )}
      </div>

      {perdidas.total === 0 ? (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Nadie declaró «Dijo que no» entre las que llegaron en este período. El motivo lo declara una persona al
          decirlo, y no se infiere de nada.
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {perdidas.porMotivo.map((p) => (
            <li
              key={p.motivo ?? 'sin_motivo'}
              data-motivo={p.motivo ?? 'sin_motivo'}
              title={p.motivo === null ? 'Perdidas de antes de que se pidiera el motivo.' : undefined}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px]"
            >
              <span data-rotulo className="font-semibold text-foreground">
                {rotuloDelMotivo(p.motivo)}
              </span>
              <span data-n className="tabular-nums text-muted-foreground">
                {p.n}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
