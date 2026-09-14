import { useState } from 'react';
import {
  Check,
  GraduationCap,
  Mail,
  MessageCircle,
  NotebookPen,
  Pencil,
  PhoneCall,
  Sparkles,
  Trash2,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { COLOR, type EventoLinea as EventoTL, type TipoEvento } from './timeline';

/**
 * #887 pieza 3 — UN ÍCONO POR TIPO, decoración pura (no vive en el catálogo
 * compartido con el server — mismo criterio que `RegistrarEvento.ICONO_TIPO`).
 * `Record` sobre `TipoEvento`, así que un tipo nuevo sin ícono NO COMPILA.
 */
const ICONO_TIPO: Record<TipoEvento, LucideIcon> = {
  llegada: MessageCircle,
  identidad: UserRound,
  mensaje: MessageCircle,
  interes_detectado: Sparkles,
  interes_registrado: NotebookPen,
  compra: Wallet,
  cotizacion: Sparkles,
  enfriamiento: X,
  pendiente: Check,
  registrado: NotebookPen,
  correo: Mail,
  ficha: UserRound,
  seguimiento: Check,
  llamada: PhoneCall,
};

function formatearHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function Punto({ estado }: { estado: EventoTL['estado'] }) {
  return (
    <span
      aria-hidden
      className={
        'relative z-10 mt-3.5 size-2.5 shrink-0 rounded-full ' +
        (estado === 'pendiente'
          ? 'border-2 border-dashed border-muted-foreground/40 bg-card'
          : COLOR[estado].punto)
      }
    />
  );
}

/**
 * Un evento es una tarjeta sobre un rail: punto (10 px, color por estado), el
 * ícono del tipo en un cuadro, rótulo y hora quieta a la derecha (dueño,
 * 13-sep-2026, sobre una referencia compacta). La línea conectora se corta en el
 * último (`data-ultimo`), no se estira más allá del punto.
 *
 * ── LO QUE CAMBIÓ, Y POR QUÉ ────────────────────────────────────────────────
 * 1. **Se dice QUIÉN.** El timeline calculaba `fuente` y no la dibujaba en
 *    ningún lado: la pantalla no distinguía lo que afirmó Cerberus de lo que
 *    escuchó una persona. Ahora el autor va al lado del valor, en neutro.
 * 2. **Los botones de Editar y Borrar tenían el `<button>` sin `onClick`.**
 *    Eran andamio del rediseño. Ahora se dibujan SOLO cuando hay handler Y el
 *    evento es de quien mira — nunca un no-op, la misma regla por la que
 *    `PieAccionTimeline` no dibuja nada sin `onVender`.
 * 3. **Se fue el botón «Corregir» de los eventos de IA**, que tampoco tenía
 *    handler. Corregir lo que dedujo una señal automática es otro frente (hay
 *    que decidir qué significa «corregir» un cálculo que se re-deriva en cada
 *    consulta, ADR 0016): mientras no exista, el botón mentía.
 */
export function EventoLinea({
  e,
  esUltimo,
  onEditar,
  onBorrar,
}: {
  e: EventoTL;
  esUltimo: boolean;
  /** Solo los registrados a mano lo reciben. Sin handler no se dibuja el botón. */
  onEditar?: (id: number, nota: string) => void;
  onBorrar?: (id: number) => void;
}) {
  const c = COLOR[e.estado];
  const Icono = ICONO_TIPO[e.tipo];
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [texto, setTexto] = useState(e.comentario ?? '');

  // Se puede tocar solo lo propio, y solo si el que monta pasó los handlers.
  const puedeTocar = e.eventoId != null && e.mio === true;

  function confirmarEdicion() {
    if (e.eventoId != null) onEditar?.(e.eventoId, texto.trim());
    setEditando(false);
  }

  return (
    <li className="group/ev relative flex gap-2.5 pb-2 pl-1">
      <Punto estado={e.estado} />
      <span
        aria-hidden
        data-ultimo={esUltimo || undefined}
        className="absolute bottom-[-0.875rem] left-2 top-6 w-px bg-border data-[ultimo]:hidden"
      />
      <div className="flex min-w-0 flex-1 items-start gap-2.5 rounded-xl border border-border/70 bg-card px-2.5 py-2">
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted/70 text-muted-foreground">
          <Icono size={14} />
        </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[12.5px] font-semibold text-foreground">{e.rotulo}</span>
          {/* El tag («MANUAL», «IA») dice de qué clase es el evento. Con AUTOR a
              la vista sobra: «por Luz» ya dice que lo escribió una persona, y
              «MANUAL · por Luz» es la misma cosa dos veces en una fila de 360 px.
              Se queda para lo que no tiene autor —las señales de IA— que es
              justo donde hace falta. */}
          {c.tag && !e.autor && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-warning">{c.tag}</span>
          )}
          {puedeTocar && onEditar && onBorrar && !editando && !borrando && (
            <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/ev:opacity-100 group-focus-within/ev:opacity-100">
              <button
                type="button"
                aria-label={`Editar «${e.rotulo}»`}
                onClick={() => {
                  setTexto(e.comentario ?? '');
                  setEditando(true);
                }}
                className="grid min-h-6 min-w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Pencil size={12} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Borrar «${e.rotulo}» del timeline`}
                onClick={() => setBorrando(true)}
                className="grid min-h-6 min-w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={12} aria-hidden />
              </button>
            </span>
          )}
          <time
            className={
              'shrink-0 text-[11px] tabular-nums text-muted-foreground ' +
              (puedeTocar && !editando && !borrando ? '' : 'ml-auto')
            }
          >
            {e.timestamp ? formatearHora(e.timestamp) : ''}
          </time>
        </div>

        {/* El valor y QUIÉN lo afirmó, en la misma línea: sin el autor, un
            evento que una persona escuchó se lee igual que uno que dedujo una
            máquina. */}
        {(e.valor || e.autor) && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {e.valor}
            {e.valor && e.autor && <span aria-hidden> · </span>}
            {e.autor && <span className="font-medium">por {e.autor}</span>}
          </p>
        )}

        {/* Qué producto fue — hoy solo lo lleva una compra. Ícono aparte para
            que se distinga de un dato suelto: es LO QUE SE LLEVÓ, la pregunta
            que evita cotizarle de nuevo lo mismo. */}
        {e.detalle && (
          <p
            className="mt-0.5 flex items-center gap-1 truncate text-xs text-foreground/80"
            title={e.detalle}
          >
            <GraduationCap size={11} aria-hidden className="shrink-0 text-muted-foreground" />
            <span className="truncate">{e.detalle}</span>
          </p>
        )}

        {editando ? (
          <div className="mt-1 flex items-center gap-1">
            <input
              value={texto}
              maxLength={500}
              autoFocus
              onChange={(ev) => setTexto(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') {
                  ev.preventDefault();
                  confirmarEdicion();
                }
                if (ev.key === 'Escape') {
                  ev.stopPropagation();
                  setEditando(false);
                }
              }}
              placeholder="qué pasó"
              className="min-w-0 flex-1 rounded-md border border-primary bg-card px-1.5 py-0.5 text-xs outline-none"
            />
            <button
              type="button"
              aria-label="Guardar"
              onClick={confirmarEdicion}
              className="grid min-h-6 min-w-6 place-items-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Check size={12} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Cancelar"
              onClick={() => setEditando(false)}
              className="grid min-h-6 min-w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={12} aria-hidden />
            </button>
          </div>
        ) : borrando ? (
          // Confirmación en el lugar, como «¿Perdido?» en la BarraGestion:
          // borrar del timeline es sacar algo que el equipo puede estar usando.
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold">
            <span className="text-muted-foreground">¿Borrar del timeline?</span>
            <button
              type="button"
              onClick={() => {
                if (e.eventoId != null) onBorrar?.(e.eventoId);
                setBorrando(false);
              }}
              className="rounded px-1 text-destructive transition-colors hover:bg-destructive/10"
            >
              Sí
            </button>
            <button
              type="button"
              onClick={() => setBorrando(false)}
              className="rounded px-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              No
            </button>
          </p>
        ) : (
          e.comentario && (
            <p className="mt-0.5 text-xs italic text-muted-foreground">“{e.comentario}”</p>
          )
        )}
      </div>
      </div>
    </li>
  );
}
