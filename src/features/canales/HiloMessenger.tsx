import { Suspense, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Lock, Send, Smile } from 'lucide-react';
import { api, ErrorApi } from '../../lib/datos/cliente';
import { agruparPorDia, MediaEnBurbuja, SeparadorDia, SkeletonHilo, tintaSeparador } from '../whatsapp/HiloWhatsapp';
import { BotonDescargarAdjunto } from '../whatsapp/BotonDescargarAdjunto';
import type { MediaHilo } from '../whatsapp/conversacionWa';
import { CabeceraDeChat } from './CabeceraDeChat';
import type { Conversacion } from '../../dominio/conversaciones';
import { insertarEnCursor } from '../../lib/insertarEnCursor';
import { perezoso } from '../../lib/perezoso';
import { usePopover } from '../../lib/teclado/usePopover';
import { useEsMovil } from '../../lib/useEsMovil';

/** Perezoso, como en WhatsApp (ADR 0126): al arranque le toca el botón, no `frimousse`. */
const SelectorDeEmojis = perezoso(() => import('../../components/SelectorDeEmojis').then((m) => m.SelectorDeEmojis));

/**
 * EL HILO DE MESSENGER — leer la conversación completa, con las dos mitades.
 *
 * Mata al dead-end ("ábrelo en Business Suite" sin mostrar nada): el hilo ya
 * estaba en la base — la ingesta guarda lo que la persona escribió Y lo que la
 * página respondió — solo que nadie lo dibujaba.
 *
 * 🔴 **YA NO ES SOLO LECTURA (25-ago-2026).** Decía que responder «queda fuera a
 * propósito» porque el envío no estaba cableado; ese mismo día quedó, al
 * arreglar la respuesta privada a comentarios — `POST /{page-id}/messages` es EL
 * MISMO endpoint, sólo cambia el `recipient`. Lo que sigue siendo cierto es la
 * ventana de 24 h de Meta (la etiqueta HUMAN_AGENT, que la extendería a 7 días,
 * exige App Review y hoy está pendiente). Así que el pie ahora es un redactor de
 * verdad cuando el plazo está abierto, y el cartel con el motivo cuando no —
 * ver `RedactorMessenger` acá abajo y `responder/ventanaDeMessenger.ts`.
 */

interface Mensaje {
  id: number;
  direccion: string;
  autor: string;
  texto: string | null;
  occurred_at: string;
  /**
   * Lo que mandó además del texto (una foto, un audio), ya bajado por el server al
   * llegar (`server/src/meta/adjuntosDeMeta.ts`). Tiene la misma forma que la media
   * de WhatsApp, así que se dibuja y se descarga con los mismos componentes.
   * Ausente en un server viejo y `null` en lo que entró antes del 11-sep-2026.
   */
  adjuntos?: MediaHilo[] | null;
}

/**
 * El plazo de Meta, tal como lo manda el server. `explicacion` viene ya escrita
 * de allá a propósito: es la MISMA frase para el cartel y para el error del
 * envío, y tenerla en un solo lugar evita que las dos se contradigan.
 */
interface Ventana {
  puede: boolean;
  restanteMs: number;
  explicacion: string;
}

function useHiloMessenger(canal: string, personaId: string | null) {
  return useQuery({
    queryKey: ['hilo-messenger', canal, personaId],
    queryFn: () =>
      api<{ historial: Mensaje[]; nombre: string | null; total: number; ventana?: Ventana }>(
        `/api/persona/conv/${canal}/${encodeURIComponent(personaId ?? '')}`,
      ),
    enabled: Boolean(personaId),
  });
}

export function HiloMessenger({
  conversacion,
  miVendedora,
  esDeCampana,
  onAbrirOtra,
  senales,
  onVolver,
}: {
  conversacion: Conversacion;
  /** Ver el mismo prop en `HiloWhatsapp` — viaja hasta `<BarraGestion embebida>`. */
  miVendedora?: string | null;
  esDeCampana?: boolean;
  onAbrirOtra?: (o: { clave: string; telefono: string | null }) => void;
  senales?: { registrar: number; estado: number; etiqueta: number; agendar: number };
  /** El celular: volver a la lista. Ver `CabeceraDeChat.onVolver`. */
  onVolver?: () => void;
}) {
  const { data, isPending, isError, refetch } = useHiloMessenger(conversacion.canal, conversacion.persona_id);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView();
  }, [data?.historial.length]);

  const nombre = conversacion.persona_nombre ?? data?.nombre ?? 'Conversación';
  const grupos = agruparPorDia(data?.historial ?? []);

  return (
    // En el celular ocupa la pantalla entera, con las mismas clases `max-md:`
    // que `HiloWhatsapp` (ver el comentario de su contenedor). Sin `AjusteTeclado`
    // acá: el alto queda en `100dvh`, alcanza para leer y para el redactor corto.
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-panel max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:z-30 max-md:h-dvh max-md:rounded-none max-md:shadow-none">
      {/* La misma cabecera que WhatsApp y los comentarios de FB/IG (08-sep-2026,
          pedido del dueño) — ver `CabeceraDeChat`. Acá no hay foto (Messenger
          no la trae) y el subtítulo es cuántos mensajes se capturaron, en vez
          de un teléfono. */}
      <CabeceraDeChat
        conversacion={conversacion}
        miVendedora={miVendedora}
        esDeCampana={esDeCampana}
        onAbrirOtra={onAbrirOtra}
        senales={senales}
        onVolver={onVolver}
        avatar={
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[11px] bg-secondary font-heading text-xs font-bold text-navy-ink">
            {nombre.slice(0, 2).toUpperCase()}
          </span>
        }
        nombre={nombre}
        subtitulo={<>Messenger · {data ? `${data.total} mensajes` : 'cargando…'}</>}
      />

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden bg-muted/30 p-4">
        {isPending ? (
          <SkeletonHilo />
        ) : isError ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No se pudo cargar el hilo — no es que no haya mensajes.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
            >
              Reintentar
            </button>
          </div>
        ) : !data || data.historial.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Todavía no capturamos mensajes de esta conversación.
            </p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
              La captura trae lo que Meta nos deja ver — el hilo completo vive en Business Suite.
            </p>
            <a
              href="https://business.facebook.com/latest/inbox/all"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              Verlo en Business Suite <ExternalLink size={10} />
            </a>
          </div>
        ) : (
          grupos.map((g, gi) => (
            <div key={g.clave} className="space-y-2">
              <SeparadorDia etiqueta={g.etiqueta} tinta={tintaSeparador(gi === grupos.length - 1, g.ultimo)} />
              {g.items.map((m) => (
                <div
                  key={m.id}
                  className={
                    // `group/burbuja`: Descargar aparece al pasar por ESTA fila, como en WhatsApp.
                    'group/burbuja flex items-end gap-1 ' +
                    (m.direccion === 'saliente' ? 'flex-row-reverse justify-start' : 'justify-start')
                  }
                >
                  <div
                    className={
                      'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm md:max-w-[75%] ' +
                      (m.direccion === 'saliente'
                        ? 'rounded-br-md bg-secondary text-navy-ink shadow-[0_1px_2px_rgba(14,42,82,0.06)]'
                        : 'rounded-bl-md bg-card text-foreground ring-1 ring-border')
                    }
                  >
                    {m.adjuntos?.map((a) => (
                      <div key={a.archivo} className="mb-1.5">
                        <MediaEnBurbuja media={a} cuando={m.occurred_at} />
                      </div>
                    ))}
                    {m.texto ??
                      (m.adjuntos?.length ? null : <span className="italic text-muted-foreground">(sin texto)</span>)}
                    <div className="mt-0.5 text-right font-mono text-[11px] text-muted-foreground">
                      {new Date(m.occurred_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {m.adjuntos?.map((a) => (
                    <BotonDescargarAdjunto key={a.archivo} media={a} cuando={m.occurred_at} />
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={finRef} />
      </div>

      <RedactorMessenger
        canal={conversacion.canal}
        personaId={conversacion.persona_id}
        ventana={data?.ventana}
        cargando={isPending}
      />
    </div>
  );
}

/**
 * EL REDACTOR — abierto cuando Meta deja, y explicando el motivo cuando no.
 *
 * Reemplaza al cartel que decía *«este canal todavía no está conectado para
 * envíos»*. Eso fue verdad hasta el 25-ago-2026 y dejó de serlo ese día: el
 * envío quedó cableado al arreglar la respuesta privada a comentarios, y es el
 * MISMO endpoint. Un cartel que dice «no se puede» cuando sí se puede es una
 * mentira de la interfaz, y de las caras: la vendedora se va a Business Suite a
 * hacer a mano algo que Hermes ya sabe hacer.
 *
 * ⚠️ **El plazo lo decide el SERVER, no esta pantalla.** Acá sólo se dibuja lo
 * que vino en `ventana`. Recalcularlo en el navegador crearía la segunda copia
 * de una regla que ya vive en el server (la cicatriz #37 del repo), y las dos
 * divergirían mudas — con el agravante de que el reloj del cliente lo pone el
 * usuario.
 */
const NO_SALIO = 'No se pudo enviar. Puedes intentarlo de nuevo en un momento.';

/**
 * EL MOTIVO REAL, ya traducido por el server — o el genérico cuando no dijo nada.
 *
 * 🔴 **Leía `.error` de un `ErrorApi`, que no tiene esa propiedad** (4-sep-2026):
 * el server contestaba «Esta persona no puede recibir mensajes de la página…» y
 * acá se veía siempre el genérico, que invita a reintentar contra un rechazo que
 * reintentar no cambia. Siete intentos en seis minutos, medidos en producción.
 *
 * El genérico queda SOLO para lo que no trajo texto: una caída de nginx (cuerpo
 * HTML) o un fallo de red antes de llegar al server.
 */
function motivoDelRechazo(e: unknown): string {
  if (!(e instanceof ErrorApi)) return NO_SALIO;
  const c = e.cuerpo;
  const dijoAlgo = typeof c?.error === 'string' || typeof c?.message === 'string';
  return dijoAlgo ? e.message : NO_SALIO;
}

function RedactorMessenger({
  canal,
  personaId,
  ventana,
  cargando,
}: {
  canal: string;
  personaId: string | null;
  ventana: Ventana | undefined;
  cargando: boolean;
}) {
  const [texto, setTexto] = useState('');
  const clienteDeConsultas = useQueryClient();
  const cajaRef = useRef<HTMLTextAreaElement>(null);
  const [emojisAbiertos, setEmojisAbiertos] = useState(false);
  const popoverEmojis = usePopover(emojisAbiertos, () => setEmojisAbiertos(false), { z: 'z-20' });
  const esMovil = useEsMovil();

  const enviar = useMutation({
    mutationFn: (cuerpo: string) =>
      api<{ ok: true }>(`/api/persona/conv/${canal}/${encodeURIComponent(personaId ?? '')}/mensaje`, {
        method: 'POST',
        body: JSON.stringify({ texto: cuerpo }),
      }),
    onSuccess: () => {
      setTexto('');
      // El hilo y la cola: el mensaje recién enviado tiene que aparecer en los
      // dos lados, o parece que no salió.
      void clienteDeConsultas.invalidateQueries({ queryKey: ['hilo-messenger', canal, personaId] });
      void clienteDeConsultas.invalidateQueries({ queryKey: ['cola'] });
    },
  });

  if (cargando) {
    return <footer className="h-[58px] shrink-0 border-t border-border bg-muted/40" />;
  }

  if (!ventana?.puede) {
    return (
      <footer className="shrink-0 border-t border-border bg-muted/40 px-4 py-3">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Lock size={13} className="mt-0.5 shrink-0" />
          <span>
            {ventana?.explicacion ?? 'Todavía no podemos escribirle por Messenger.'}{' '}
            <a
              href="https://business.facebook.com/latest/inbox/all"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
            >
              Ábrelo en Business Suite <ExternalLink size={10} />
            </a>
          </span>
        </p>
      </footer>
    );
  }

  const puedeMandar = Boolean(texto.trim()) && !enviar.isPending;

  function mandar() {
    setEmojisAbiertos(false);
    enviar.mutate(texto.trim());
  }

  /** El emoji entra donde está el cursor —o reemplaza lo seleccionado— y el panel queda abierto (ADR 0126). */
  function ponerEmoji(emoji: string) {
    const caja = cajaRef.current;
    const r = insertarEnCursor(texto, caja?.selectionStart ?? texto.length, caja?.selectionEnd ?? texto.length, emoji);
    setTexto(r.texto);
    caja?.focus();
    // En el frame siguiente, como en WhatsApp: React todavía no pintó el valor nuevo.
    requestAnimationFrame(() => caja?.setSelectionRange(r.cursor, r.cursor));
  }

  return (
    <footer className="shrink-0 border-t border-border bg-card px-3 py-2.5 max-md:pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (puedeMandar) mandar();
        }}
        className="relative flex items-end gap-2"
      >
        {emojisAbiertos && (
          <>
            <div {...popoverEmojis.propsOverlay} />
            <Suspense fallback={null}>
              <SelectorDeEmojis onElegir={ponerEmoji} onCerrar={() => setEmojisAbiertos(false)} />
            </Suspense>
          </>
        )}
        {/* A la izquierda de la caja, el mismo lugar que en WhatsApp; sin botón en el celular. */}
        {!esMovil && (
          <button
            type="button"
            onClick={() => setEmojisAbiertos((v) => !v)}
            disabled={enviar.isPending}
            title="Emojis"
            aria-label="Emojis"
            aria-expanded={emojisAbiertos}
            className="flex size-[38px] shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40"
          >
            <Smile size={16} />
          </button>
        )}
        <textarea
          ref={cajaRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && emojisAbiertos) {
              e.preventDefault();
              e.stopPropagation();
              setEmojisAbiertos(false);
              return;
            }
            // Enter manda, Shift+Enter hace salto de línea — lo mismo que
            // Messenger y que WhatsApp, así que no hay nada que aprender.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (puedeMandar) mandar();
            }
          }}
          rows={1}
          placeholder="Escribe por Messenger…"
          disabled={enviar.isPending}
          className="max-h-28 min-h-[38px] flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60 max-md:min-h-11 max-md:text-base"
        />
        <button
          type="submit"
          disabled={!puedeMandar}
          aria-label="Enviar por Messenger"
          className="flex size-[38px] shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 max-md:size-11"
        >
          <Send size={16} />
        </button>
      </form>

      <p className="mt-1.5 px-0.5 text-[11px] text-muted-foreground">
        {enviar.isError ? (
          <span className="font-semibold text-destructive">{motivoDelRechazo(enviar.error)}</span>
        ) : (
          ventana.explicacion
        )}
      </p>
    </footer>
  );
}
