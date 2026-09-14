import { useEscape } from '../../lib/teclado/useEscape';

/**
 * CONFIRMAR UNA ACCIÓN — reemplaza el `window.confirm` nativo del navegador
 * (03-sep-2026, reportado con una captura: el diálogo de Chrome decía
 * "localhost:5174 dice…", que es justo el problema — no se lee como parte de
 * Hermes, y no se puede estilar).
 *
 * Mismo molde visual que `ModalDeEspacios.tsx` (overlay, panel, header con
 * `X`, `useEscape`) para que se lea como el mismo lenguaje — no un segundo
 * tipo de diálogo con reglas propias.
 */
export function ModalDeConfirmacion({
  titulo,
  mensaje,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  peligroso = false,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Estilo del botón principal en rojo — para lo que no se puede deshacer. */
  peligroso?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  useEscape(onCancelar);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/25 p-4"
      onClick={onCancelar}
      role="alertdialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pb-1 pt-6">
          <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
          <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">{mensaje}</p>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6 pt-4">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {textoCancelar}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirmar}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              peligroso
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary-hover'
            }`}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
