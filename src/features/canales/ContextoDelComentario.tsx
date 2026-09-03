import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Newspaper } from 'lucide-react';
import { api } from '../../lib/datos/cliente';

/**
 * DE QUÉ SE TRATA ESTE COMENTARIO, Y QUÉ SE PUEDE HACER CON ÉL.
 *
 * Tres pedidos del dueño del 25-ago-2026 que resultaron ser el mismo lugar:
 *
 * 1. *«que tengan permitido ocultar el comentario en Facebook con un botón, por
 *    ejemplo cuando es de odio»* — y borrarlo.
 * 2. *«que también podamos ver un preview del post»*.
 * 3. *«el comentario cuando es un sticker o imagen no se ve»* — porque Meta manda
 *    `message: ""` y el contenido vive en `attachment`, que no se pedía.
 *
 * ⚠️ **Todo viene de UN pedido al server** (`/api/comentario/:id/contexto`), que
 * lo trae en vivo de Meta. Partirlo daría tres estados de carga en la misma
 * tarjeta. El porqué de que no se guarde está en el server: el webhook descarta
 * el aviso de «ocultado» y las URLs del CDN de Facebook vencen.
 */

interface Adjunto {
  imagen: string;
  ancho: number | null;
  alto: number | null;
  enlace: string | null;
  titulo: string | null;
}

interface Post {
  texto: string | null;
  imagen: string | null;
  enlace: string | null;
  /** Quién publicó. Ausente en un server viejo, y `null` si Meta no lo mandó. */
  autor?: string | null;
  avatar?: string | null;
  /** El INSTANTE en ISO, no «hace 3 meses»: el texto envejece en el caché. */
  publicadoEn?: string | null;
}

interface Contexto {
  estado: { can_hide?: boolean; is_hidden?: boolean; can_remove?: boolean };
  enlace: string | null;
  adjunto: Adjunto | null;
  post: Post | null;
  degradado?: boolean;
}

export function useContextoDelComentario(interactionId: number, activo: boolean) {
  return useQuery({
    queryKey: ['comentario-contexto', interactionId],
    queryFn: () => api<Contexto>(`/api/comentario/${interactionId}/contexto`),
    enabled: activo,
    // El estado en Meta cambia por fuera de Hermes (alguien oculta desde el
    // celular). No se cachea largo: se vuelve a pedir al reabrir.
    staleTime: 0,
  });
}

/**
 * EL ADJUNTO — va arriba de todo porque, cuando el comentario no tiene texto,
 * **el adjunto ES el comentario**. Ponerlo abajo dejaría la cita vacía arriba y
 * la respuesta a «¿qué dijo?» tres bloques más abajo.
 */
export function AdjuntoDelComentario({ adjunto }: { adjunto: Adjunto }) {
  const contenido = (
    <img
      src={adjunto.imagen}
      alt={adjunto.titulo ?? 'Imagen del comentario'}
      // Chico de verdad: los stickers vienen en 59×59 y estirarlos los deja
      // borrosos. `max-w` con `h-auto` respeta lo que Meta mandó.
      className="max-h-48 max-w-full rounded-lg object-contain"
      loading="lazy"
    />
  );

  return (
    <figure className="mt-2">
      {adjunto.enlace ? (
        <a href={adjunto.enlace} target="_blank" rel="noreferrer" className="inline-block">
          {contenido}
        </a>
      ) : (
        contenido
      )}
      {adjunto.titulo && (
        <figcaption className="mt-1 text-xs text-muted-foreground">{adjunto.titulo}</figcaption>
      )}
    </figure>
  );
}

/** El post al que el comentario pertenece. */
/**
 * LA PUBLICACIÓN ORIGINAL — fases 2 y 3 del rediseño (25-ago-2026).
 *
 * ══ POR QUÉ VA PRIMERA Y NO AL PIE ══════════════════════════════════════════
 *
 * Antes era un renglón chiquito DEBAJO del comentario («Comentó en: …»), y eso
 * invertía el orden en que se lee: nadie puede juzgar «C👏👏👏» sin saber sobre
 * qué se comentó. La publicación es el contexto, y el contexto va antes.
 *
 * ══ IMAGEN A LA IZQUIERDA, TEXTO A LA DERECHA ═══════════════════════════════
 *
 * Pedido explícito del diseño, y tiene un motivo de espacio: apilados, la imagen
 * empuja el texto y el comentario fuera de la pantalla — que es justo lo que la
 * fase 11 («sin scroll interno») viene a evitar. En columnas, la tarjeta entera
 * mide lo que mide la imagen.
 *
 * ⚠️ **`object-contain` y no `object-cover`.** El diseño pide que la imagen «no
 * se deforme», y en un post de campaña la imagen ES el mensaje: recortarla al
 * cuadrado le corta el título al candidato. Se paga con bandas laterales.
 *
 * ⚠️ **La fecha se dibuja del INSTANTE que manda el server**, y se degrada sola:
 * un server viejo no manda `publicadoEn` y la línea simplemente no aparece.
 */
function fechaDePublicacion(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export function PublicacionOriginal({ post }: { post: Post }) {
  const [expandido, setExpandido] = useState(false);
  const fecha = post.publicadoEn ? fechaDePublicacion(post.publicadoEn) : null;
  /**
   * «Ver más» a los 280 caracteres. El número sale de mirar los posts reales de
   * la campaña: los de una línea entran enteros y los que llevan bloque de
   * hashtags se cortan justo antes de ellos, que es donde deja de haber
   * información y empieza el ruido.
   */
  const largo = (post.texto?.length ?? 0) > 280;
  const texto = post.texto && largo && !expandido ? `${post.texto.slice(0, 280)}…` : post.texto;

  return (
    <section className="rounded-2xl border border-border bg-card p-3">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Newspaper size={12} /> Publicación original
      </h3>

      {(post.autor || fecha) && (
        <header className="mb-2.5 flex items-center gap-2">
          {post.avatar ? (
            <img src={post.avatar} alt="" className="size-8 shrink-0 rounded-full object-cover" loading="lazy" />
          ) : (
            <div aria-hidden className="size-8 shrink-0 rounded-full bg-secondary" />
          )}
          <div className="min-w-0">
            {post.autor && (
              <div className="truncate font-heading text-sm font-bold text-foreground">{post.autor}</div>
            )}
            {fecha && <div className="text-[11px] text-muted-foreground">{fecha}</div>}
          </div>
        </header>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {post.imagen && (
          <img
            src={post.imagen}
            alt=""
            loading="lazy"
            /* Sin texto al lado, la imagen toma el ancho entero: con `sm:w-2/5`
               fijo, un post que es sólo la pieza dejaba media tarjeta vacía. */
            className={
              'max-h-44 w-full shrink-0 rounded-xl bg-muted object-contain ' +
              (post.texto ? 'sm:w-2/5' : '')
            }
          />
        )}
        <div className="min-w-0 flex-1">
          {texto && <p className="whitespace-pre-line text-xs leading-relaxed text-foreground">{texto}</p>}
          {largo && (
            <button
              type="button"
              onClick={() => setExpandido((v) => !v)}
              className="mt-1 text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
            >
              {expandido ? 'Ver menos' : 'Ver más'}
            </button>
          )}
        </div>
      </div>

      {/*
        🔴 EL ÚNICO «Ver en Facebook» DE LA PANTALLA (fase 3). Antes había dos
        enlaces —uno al post, otro al comentario— y ninguno decía a cuál de los
        dos llevaba. El del comentario es el que sirve para moderar, así que el
        de acá se rotula por su destino y no por la red.
      */}
      {post.enlace && (
        <a
          href={post.enlace}
          target="_blank"
          rel="noreferrer"
          className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
        >
          Ver la publicación en Facebook <ExternalLink size={11} />
        </a>
      )}
    </section>
  );
}
