import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Lock, Send } from 'lucide-react';
import { api } from '../../lib/datos/cliente';
import { agruparPorDia, SeparadorDia, SkeletonHilo, tintaSeparador } from '../whatsapp/HiloWhatsapp';
import type { Conversacion } from '../../dominio/conversaciones';

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

export function HiloMessenger({ conversacion }: { conversacion: Conversacion }) {
  const { data, isPending, isError, refetch } = useHiloMessenger(conversacion.canal, conversacion.persona_id);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView();
  }, [data?.historial.length]);

  const nombre = conversacion.persona_nombre ?? data?.nombre ?? 'Conversación';
  const grupos = agruparPorDia(data?.historial ?? []);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-panel">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-[11px] bg-secondary font-heading text-xs font-bold text-navy-ink">
          {nombre.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate font-heading text-sm font-bold text-foreground">{nombre}</div>
          <div className="text-xs text-muted-foreground">
            Messenger · {data ? `${data.total} mensajes` : 'cargando…'}
          </div>
        </div>
      </header>

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
                <div key={m.id} className={'flex ' + (m.direccion === 'saliente' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={
                      'max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ' +
                      (m.direccion === 'saliente'
                        ? 'rounded-br-md bg-secondary text-navy-ink shadow-[0_1px_2px_rgba(14,42,82,0.06)]'
                        : 'rounded-bl-md bg-card text-foreground ring-1 ring-border')
                    }
                  >
                    {m.texto ?? <span className="italic text-muted-foreground">(sin texto)</span>}
                    <div className="mt-0.5 text-right font-mono text-[11px] text-muted-foreground">
                      {new Date(m.occurred_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
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

  return (
    <footer className="shrink-0 border-t border-border bg-card px-3 py-2.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (puedeMandar) enviar.mutate(texto.trim());
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter manda, Shift+Enter hace salto de línea — lo mismo que
            // Messenger y que WhatsApp, así que no hay nada que aprender.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (puedeMandar) enviar.mutate(texto.trim());
            }
          }}
          rows={1}
          placeholder="Escribe por Messenger…"
          disabled={enviar.isPending}
          className="max-h-28 min-h-[38px] flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!puedeMandar}
          aria-label="Enviar por Messenger"
          className="flex size-[38px] shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Send size={16} />
        </button>
      </form>

      <p className="mt-1.5 px-0.5 text-[11px] text-muted-foreground">
        {enviar.isError ? (
          // El motivo REAL, ya traducido por el server. Un «error al enviar»
          // genérico deja a la vendedora sin saber si reintentar sirve.
          <span className="font-semibold text-destructive">
            {(enviar.error as { error?: string } | undefined)?.error ??
              'No se pudo enviar. Puedes intentarlo de nuevo en un momento.'}
          </span>
        ) : (
          ventana.explicacion
        )}
      </p>
    </footer>
  );
}
