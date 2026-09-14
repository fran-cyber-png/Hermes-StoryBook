import { useEffect, useState } from 'react';
import { Loader2, Mic, MicOff, PhoneIncoming, PhoneOff, X } from 'lucide-react';
import { formatoTelefono } from '../../lib/formato';
import { cerrarAviso, colgar, contestar, ignorar, silenciar, useLlamadaActual } from './llamadaActual';

/**
 * LA LLAMADA, SIEMPRE A LA VISTA — el timbre de una entrante y los controles de la que está en curso.
 *
 * Se monta una vez, en la cáscara (`App.tsx`), y no en la ficha: la vendedora puede cambiar de
 * conversación o de vista con una llamada abierta sin cortarla (ADR 0123).
 *
 * ⚠️ En la app de escritorio, el navegador embebido (⌘9) es una capa del sistema encima del DOM: mientras
 * esta barra se ve —llamada, error o aviso—, la vista lo tapa (`App.tsx`, `tapado`). Sin eso, el timbre
 * sonaría detrás.
 */

function reloj(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const BOTON =
  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-[background-color,transform] duration-200 ease-house active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export function BarraDeLlamada() {
  const { estado, error, nota } = useLlamadaActual();
  const [ahora, setAhora] = useState(() => Date.now());
  const enCurso = estado.fase === 'en-curso';

  useEffect(() => {
    if (!enCurso) return;
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enCurso]);

  if (estado.fase === 'libre' && !error && !nota) return null;

  const telefono = 'telefono' in estado && estado.telefono ? formatoTelefono(estado.telefono) : null;

  return (
    <div
      role={estado.fase === 'entrante' ? 'alertdialog' : 'status'}
      aria-live="polite"
      aria-label="Llamada de WhatsApp"
      className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] animate-entrar rounded-2xl border border-border bg-card p-3 shadow-panel"
    >
      {estado.fase === 'entrante' ? (
        <>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 animate-pulse items-center justify-center rounded-full bg-success/10 text-success">
              <PhoneIncoming size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Llamada de WhatsApp</p>
              <p className="truncate text-sm font-bold text-navy-ink">{telefono}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void contestar()} className={`${BOTON} bg-success text-white hover:bg-success/90`}>
              <PhoneIncoming size={13} /> Contestar
            </button>
            <button type="button" onClick={ignorar} className={`${BOTON} bg-muted text-muted-foreground hover:bg-muted/80`}>
              Que conteste otra
            </button>
          </div>
        </>
      ) : estado.fase === 'conectando' || estado.fase === 'llamando' || estado.fase === 'en-curso' ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {estado.fase === 'en-curso' ? null : <Loader2 size={11} className="animate-spin" />}
                {estado.fase === 'conectando' ? 'Conectando…' : estado.fase === 'llamando' ? 'Sonando en su celular…' : 'En llamada'}
              </p>
              <p className="truncate text-sm font-bold text-navy-ink">{telefono}</p>
            </div>
            {estado.fase === 'en-curso' ? (
              <span className="font-mono text-sm font-semibold tabular-nums text-navy-ink">{reloj((ahora - estado.desde) / 1000)}</span>
            ) : null}
          </div>
          <div className="mt-3 flex gap-2">
            {estado.fase === 'en-curso' ? (
              <button
                type="button"
                onClick={silenciar}
                aria-pressed={estado.silenciado}
                className={`${BOTON} ${estado.silenciado ? 'bg-navy text-white hover:bg-navy/90' : 'bg-muted text-navy-ink hover:bg-muted/80'}`}
              >
                {estado.silenciado ? <MicOff size={13} /> : <Mic size={13} />} {estado.silenciado ? 'Silenciado' : 'Silenciar'}
              </button>
            ) : null}
            <button type="button" onClick={() => void colgar()} className={`${BOTON} bg-destructive text-white hover:bg-destructive/90`}>
              <PhoneOff size={13} /> Colgar
            </button>
          </div>
        </>
      ) : estado.fase === 'terminada' ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-navy-ink">{estado.motivo}</p>
            <p className="truncate text-xs text-muted-foreground">
              {telefono}
              {estado.duracion ? ` · ${reloj(estado.duracion)}` : ''}
            </p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={cerrarAviso} className="rounded p-1 text-muted-foreground hover:text-navy-ink">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {nota ? (
        <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
          <span>{nota}</span>
          <button type="button" aria-label="Cerrar aviso" onClick={cerrarAviso} className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100">
            <X size={11} />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-2 flex items-start justify-between gap-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-[11px] font-medium text-destructive">
          <span>{error}</span>
          <button type="button" aria-label="Cerrar aviso" onClick={cerrarAviso} className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100">
            <X size={11} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
