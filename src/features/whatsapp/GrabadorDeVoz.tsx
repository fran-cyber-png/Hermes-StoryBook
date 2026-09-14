import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, RotateCcw, Send, Trash2 } from 'lucide-react';
import { DURACION_MAXIMA_S, puedeGrabarVoz, relojDeVoz } from './notaDeVoz';
import { elegirFormatoDeGrabacion, motivoDelMicrofono } from './grabacionDeVoz';
import type { NotaPreparada } from './convertirNotaDeVoz';

export interface VozParaEnviar {
  segundos: number;
  onda: number[] | null;
}

/**
 * EL MICRÓFONO DEL COMPOSITOR — graba, y al detener manda.
 *
 * ── Dónde se dibuja ──────────────────────────────────────────────────────
 * En reposo es un botón más de la fila, donde está Enviar cuando la caja está
 * vacía (como en WhatsApp: con texto se manda texto, sin texto se graba).
 * Grabando, la barra TAPA la fila entera —se cuelga del `relative` que la fila ya
 * tiene—: mientras se graba no se escribe, no se adjunta y no se pide la varita,
 * y taparlo es más honesto que dejar controles vivos que no hacen nada.
 *
 * ── Qué no se pierde ─────────────────────────────────────────────────────
 * Si convertir o mandar falla, la grabación NO se tira: queda con «Reintentar».
 * Una nota de cuatro minutos perdida por un corte de red es volver a hablarla,
 * y eso no se le pide a nadie. El motivo del envío fallido lo muestra la banda
 * roja del composer, que ya lee `enviarMedia`.
 *
 * ── Teclado ──────────────────────────────────────────────────────────────
 * Escape cancela la grabación (y corta la tecla ahí, para que no cierre nada
 * más). Al empezar, el foco pasa a «Detener y enviar»: Enter o Espacio la manda,
 * que es el gesto de apretar el botón que se tiene enfrente.
 */
export function GrabadorDeVoz({
  mostrarBoton,
  deshabilitado,
  onEnviar,
  onAviso,
}: {
  /**
   * El micrófono se ofrece solo con la caja vacía y sin adjunto. Es una prop y no
   * un montaje condicional A PROPÓSITO: si el componente se desmontara al soltar
   * un archivo en la ventana a mitad de una grabación, la grabación se perdería.
   */
  mostrarBoton: boolean;
  deshabilitado: boolean;
  /** Tiene que rechazar si el envío falla: es lo que deja la grabación para reintentar. */
  onEnviar: (archivo: File, voz: VozParaEnviar) => Promise<unknown>;
  /** Un motivo para mostrar en el composer, o `null` para limpiarlo. */
  onAviso: (motivo: string | null) => void;
}) {
  const [disponible] = useState(puedeGrabarVoz);
  const [fase, setFase] = useState<'reposo' | 'pidiendo' | 'grabando' | 'preparando' | 'fallida'>('reposo');
  const [segundos, setSegundos] = useState(0);

  const grabador = useRef<MediaRecorder | null>(null);
  const flujo = useRef<MediaStream | null>(null);
  const trozos = useRef<Blob[]>([]);
  const inicio = useRef(0);
  const cancelada = useRef(false);
  const montado = useRef(true);
  /** Lo grabado que todavía no salió: para reintentar sin volver a grabar. */
  const pendiente = useRef<{ grabado: Blob; respaldoS: number; nota: NotaPreparada | null } | null>(null);
  const botonDetener = useRef<HTMLButtonElement>(null);

  function soltarMicrofono() {
    flujo.current?.getTracks().forEach((pista) => pista.stop());
    flujo.current = null;
  }

  // Cambiar de conversación desmonta el composer: la grabación se descarta y el
  // micrófono se apaga. Sin esto la luz del micrófono queda prendida.
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      cancelada.current = true;
      if (grabador.current?.state === 'recording') grabador.current.stop();
      soltarMicrofono();
    };
  }, []);

  useEffect(() => {
    if (fase !== 'grabando') return;
    botonDetener.current?.focus();
    const reloj = setInterval(() => {
      const transcurrido = (performance.now() - inicio.current) / 1000;
      setSegundos(transcurrido);
      if (transcurrido >= DURACION_MAXIMA_S) detener();
    }, 250);
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      cancelar();
    };
    window.addEventListener('keydown', alTeclear, true);
    return () => {
      clearInterval(reloj);
      window.removeEventListener('keydown', alTeclear, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  async function empezar() {
    onAviso(null);
    setFase('pidiendo');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      if (montado.current) {
        setFase('reposo');
        onAviso(motivoDelMicrofono(err));
      }
      return;
    }
    if (!montado.current) {
      stream.getTracks().forEach((pista) => pista.stop());
      return;
    }
    flujo.current = stream;
    const mimeType = elegirFormatoDeGrabacion((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    trozos.current = [];
    cancelada.current = false;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) trozos.current.push(e.data);
    };
    rec.onstop = () => void alDetener(rec.mimeType);
    rec.start(1000);
    grabador.current = rec;
    inicio.current = performance.now();
    setSegundos(0);
    setFase('grabando');
    // La primera vez el motor son 32 MB: que baje MIENTRAS habla, no después.
    void import('./convertirNotaDeVoz').then((m) => m.precalentarMotor()).catch(() => {});
  }

  function detener() {
    if (grabador.current?.state === 'recording') grabador.current.stop();
  }

  function cancelar() {
    cancelada.current = true;
    detener();
  }

  async function alDetener(mime: string) {
    soltarMicrofono();
    grabador.current = null;
    if (cancelada.current || !montado.current) {
      trozos.current = [];
      if (montado.current) setFase('reposo');
      return;
    }
    pendiente.current = {
      grabado: new Blob(trozos.current, { type: mime }),
      respaldoS: (performance.now() - inicio.current) / 1000,
      nota: null,
    };
    trozos.current = [];
    await mandarPendiente();
  }

  async function mandarPendiente() {
    const p = pendiente.current;
    if (!p) return;
    setFase('preparando');
    onAviso(null);
    try {
      if (!p.nota) {
        try {
          const { prepararNotaDeVoz } = await import('./convertirNotaDeVoz');
          p.nota = await prepararNotaDeVoz(p.grabado, p.respaldoS);
        } catch {
          onAviso('No se pudo preparar la nota de voz para enviarla. Vuelve a intentarlo.');
          throw new Error('conversión');
        }
      }
      await onEnviar(p.nota.archivo, { segundos: p.nota.segundos, onda: p.nota.onda });
      pendiente.current = null;
      if (montado.current) setFase('reposo');
    } catch {
      if (montado.current) setFase('fallida');
    }
  }

  function descartarPendiente() {
    pendiente.current = null;
    onAviso(null);
    setFase('reposo');
  }

  if (!disponible) return null;

  const boton =
    // 44 px en el celular (`max-md:size-11`): el micrófono es el botón que más se
    // toca con el pulgar, y 40 px queda por debajo del objetivo táctil.
    'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:opacity-40 max-md:size-11';

  return (
    <>
      {(mostrarBoton || fase !== 'reposo') && (
        <button
          type="button"
          onClick={() => void empezar()}
          disabled={deshabilitado || fase !== 'reposo'}
          title="Grabar una nota de voz — al detener, se envía"
          aria-label="Grabar una nota de voz"
          className={`${boton} bg-primary text-primary-foreground hover:bg-primary-hover`}
        >
          {fase === 'pidiendo' ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
        </button>
      )}

      {(fase === 'grabando' || fase === 'preparando' || fase === 'fallida') && (
        <div
          role="group"
          aria-label="Nota de voz"
          className="absolute inset-0 z-10 flex items-center gap-2 rounded-xl border border-border bg-card px-1"
        >
          {fase === 'grabando' && (
            <>
              <button
                type="button"
                onClick={cancelar}
                title="Cancelar la grabación · Esc"
                aria-label="Cancelar la grabación"
                className={`${boton} text-muted-foreground hover:bg-muted hover:text-destructive`}
              >
                <Trash2 size={16} />
              </button>
              <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-destructive" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                Grabando{' '}
                <span className="font-mono tabular-nums">{relojDeVoz(segundos)}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground"> / {relojDeVoz(DURACION_MAXIMA_S)}</span>
              </span>
              <button
                ref={botonDetener}
                type="button"
                onClick={detener}
                title="Detener y enviar"
                aria-label="Detener y enviar"
                className={`${boton} bg-primary text-primary-foreground hover:bg-primary-hover`}
              >
                <Send size={16} />
              </button>
            </>
          )}
          {fase === 'preparando' && (
            <span className="flex min-w-0 flex-1 items-center gap-2 px-2 text-sm text-muted-foreground">
              <Loader2 size={16} className="shrink-0 animate-spin" />
              Enviando nota de voz…
            </span>
          )}
          {fase === 'fallida' && (
            <>
              <span className="min-w-0 flex-1 truncate px-2 text-sm text-destructive">La nota de voz no salió</span>
              <button
                type="button"
                onClick={descartarPendiente}
                title="Descartar la nota de voz"
                aria-label="Descartar la nota de voz"
                className={`${boton} text-muted-foreground hover:bg-muted hover:text-destructive`}
              >
                <Trash2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => void mandarPendiente()}
                title="Volver a intentar el envío"
                aria-label="Reintentar"
                className={`${boton} bg-primary text-primary-foreground hover:bg-primary-hover`}
              >
                <RotateCcw size={16} />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
