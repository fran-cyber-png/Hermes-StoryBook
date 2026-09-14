import { useState } from 'react';
import { rotuloEtapa } from '../../lib/etapas';
import {
  MOTIVOS_DE_PERDIDA,
  MOTIVO_DE_PERDIDA_ROTULO,
  TOPE_DETALLE_PERDIDA,
  type MotivoDePerdida,
} from '../../lib/motivosDePerdida';

/** Lo que se declara con «Dijo que no»: el motivo y, si se quiere, una frase. */
export interface PerdidaDeclarada {
  motivo: MotivoDePerdida;
  detalle: string | null;
}

/**
 * LA CONFIRMACIÓN DE «DIJO QUE NO», CON SU MOTIVO (ADR 0107).
 *
 * En este negocio la gente se calla: en ventas no hubo un solo `perdido` declarado en toda
 * la historia. Por eso el motivo no se infiere de nada y se pide acá, en el mismo gesto
 * que confirma: una lista corta y cerrada, con «Otro» siempre, y una frase opcional.
 *
 * ⚠️ **Sigue adentro del menú y no es un modal**, como antes: la acción es reversible —se
 * vuelve eligiendo otra etapa— y un modal para eso sería más ceremonia que la decisión.
 *
 * ⚠️ **«Sí, dijo que no» no se puede tocar sin motivo.** El server lo rechazaría igual
 * (`server/src/gestiones/motivosDePerdida.ts`), pero un 400 después de confirmar se lee
 * como «no me deja»; apagado antes, se lee como «falta elegir por qué».
 *
 * En campaña esta versión no pide motivo (sus motivos no son los de una venta): queda el
 * «Sí / No» de siempre.
 */
export function ConfirmarPerdida({
  pideMotivo,
  motivoInicial = null,
  onConfirmar,
  onCancelar,
}: {
  /** `false` en campaña. */
  pideMotivo: boolean;
  /** Para corregir una ya perdida: arranca con el motivo que tiene. */
  motivoInicial?: MotivoDePerdida | null;
  onConfirmar: (perdida: PerdidaDeclarada | null) => void;
  onCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState<MotivoDePerdida | null>(motivoInicial);
  const [detalle, setDetalle] = useState('');

  if (!pideMotivo) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold">
        <span className="flex-1 text-muted-foreground">¿{rotuloEtapa('perdido')}?</span>
        <button
          type="button"
          onClick={() => onConfirmar(null)}
          className="rounded px-1.5 text-destructive transition-colors hover:bg-destructive/10"
        >
          Sí
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded px-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-2 py-1.5">
      <p className="text-[11px] font-semibold text-muted-foreground">¿Por qué dijo que no?</p>
      <div role="group" aria-label="Por qué dijo que no" className="flex flex-wrap gap-1">
        {MOTIVOS_DE_PERDIDA.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={motivo === m}
            onClick={() => setMotivo(m)}
            className={
              'rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ' +
              // El chip elegido con la misma tinta que los de «Registrar gestión»: el rojo queda para
              // «Sí, dijo que no», que es la acción, no la opción.
              (motivo === m
                ? 'border border-navy bg-navy text-white'
                : 'border border-border bg-card text-muted-foreground hover:text-foreground')
            }
          >
            {MOTIVO_DE_PERDIDA_ROTULO[m]}
          </button>
        ))}
      </div>
      <input
        type="text"
        aria-label="Detalle (opcional)"
        placeholder="Detalle (opcional)"
        value={detalle}
        maxLength={TOPE_DETALLE_PERDIDA}
        onChange={(e) => setDetalle(e.target.value)}
        className="h-7 w-full rounded-md border border-border bg-muted px-2 text-[11px] outline-none transition-colors focus:border-primary focus:bg-card"
      />
      <div className="flex items-center justify-end gap-1 text-[11px] font-semibold">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          No
        </button>
        <button
          type="button"
          disabled={!motivo}
          onClick={() => motivo && onConfirmar({ motivo, detalle: detalle.trim() || null })}
          className="rounded px-1.5 py-0.5 text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Sí, dijo que no
        </button>
      </div>
    </div>
  );
}
