import { useState } from 'react';
import { Phone, Loader2, Check, X } from 'lucide-react';
import { useIniciarLlamada } from './useLlamadas';
import { ErrorApi } from '../../lib/datos/cliente';

export function BotonLlamar({
  telefono,
  onExito,
}: {
  telefono: string;
  onExito?: () => void;
}) {
  const [mostrandoConfirmacion, setMostrandoConfirmacion] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const iniciar = useIniciarLlamada();

  function handleClick() {
    if (!mostrandoConfirmacion) {
      setMostrandoConfirmacion(true);
      setAviso(null);
      return;
    }
    iniciar.mutate(
      { telefono },
      {
        onSuccess: (data) => {
          setMostrandoConfirmacion(false);
          setAviso({ tipo: 'ok', texto: data.mensaje ?? 'Solicitud de permiso enviada.' });
          onExito?.();
        },
        onError: (err) => {
          setMostrandoConfirmacion(false);
          setAviso({
            tipo: 'error',
            texto: err instanceof ErrorApi ? err.message : 'No se pudo enviar la solicitud.',
          });
        },
      },
    );
  }

  function handleCancel(e: React.MouseEvent) {
    e.stopPropagation();
    setMostrandoConfirmacion(false);
  }

  const avisoEl = aviso && (
    <div
      className={
        'mt-1.5 flex items-start justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ' +
        (aviso.tipo === 'ok' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning-foreground')
      }
    >
      <span className="flex items-start gap-1.5">
        {aviso.tipo === 'ok' ? (
          <Check size={12} className="mt-0.5 shrink-0" />
        ) : (
          <X size={12} className="mt-0.5 shrink-0" />
        )}
        {aviso.texto}
      </span>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => setAviso(null)}
        className="shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
      >
        <X size={11} />
      </button>
    </div>
  );

  if (mostrandoConfirmacion) {
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleClick}
            disabled={iniciar.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white transition-[background-color,transform] duration-200 ease-house hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50"
          >
            {iniciar.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Phone size={13} />
            )}
            {iniciar.isPending ? 'Enviando…' : '¿Segura?'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl bg-muted px-2 py-2 text-[11px] font-medium text-muted-foreground transition-[background-color,transform] duration-200 ease-house hover:bg-muted/80 active:scale-[0.98]"
          >
            Cancelar
          </button>
        </div>
        {avisoEl}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-navy px-3 py-2 text-xs font-bold text-white transition-[background-color,transform] duration-200 ease-house hover:bg-navy/90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Phone size={13} /> Llamar por WhatsApp
      </button>
      {avisoEl}
    </div>
  );
}
