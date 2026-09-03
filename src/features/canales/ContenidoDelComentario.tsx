import { EyeOff } from 'lucide-react';
import { claseDeComentario, emojisQueEntranGrandes } from '../../dominio/comentario';

/**
 * EL COMENTARIO, DIBUJADO SEGÚN DE QUÉ ESTÁ HECHO — fases 5 y 14.
 *
 * La clasificación es pura y vive en `dominio/comentario.ts`; acá sólo se elige
 * la forma. La división es la de siempre en este repo (`dueno.ts`, `cliente.ts`,
 * `ventana.ts`): la regla se puede interrogar sobre el caso raro, el dibujo no.
 *
 * ══ LAS CUATRO FORMAS ═══════════════════════════════════════════════════════
 *
 * · **Texto** — burbuja, como en Facebook. Antes era una cita editorial con una
 *   comilla gigante: elegante, y ajena a lo que la persona está mirando. La
 *   fase 9 pide aprovechar los patrones que ya conoce.
 * · **Sólo emojis** — grandes y sin burbuja, como Messenger. Un «😂😂😂» en
 *   cuerpo 16 alineado a la izquierda se lee como un error de renderizado.
 * · **Imagen o GIF** — lo pone `AdjuntoDelComentario`, que ya existía.
 * · **Nada** — el sticker cuyo `message` viene vacío y sin adjunto legible.
 *
 * ⚠️ **`emojisQueEntranGrandes` es un tope, no un capricho**: veinte emojis en
 * cuerpo 40 rompen el alto de la tarjeta que la fase 11 pide cuidar. Pasado el
 * tope se dibujan como texto normal, que sigue siendo legible.
 */
export function ContenidoDelComentario({
  texto,
  fileteCanal,
}: {
  texto: string | null | undefined;
  /** El color del filete lateral, que dice por qué canal entró. */
  fileteCanal: string;
}) {
  const clase = claseDeComentario(texto);
  if (clase === 'vacio') return null;

  const limpio = (texto ?? '').trim();

  if (clase === 'emoji' && emojisQueEntranGrandes(limpio)) {
    return (
      // `leading-none` y no el de por defecto: con interlineado de párrafo, una
      // línea de emojis en cuerpo 40 deja un hueco arriba y abajo más alto que
      // los emojis mismos.
      <p className="py-1 text-[40px] leading-none">{limpio}</p>
    );
  }

  return (
    <figure className={`rounded-xl border-l-4 ${fileteCanal} bg-muted/50 py-3 pl-4 pr-5`}>
      {/*
        `whitespace-pre-line`: un comentario con saltos de línea los tenía y se
        dibujaba como un párrafo corrido, pegando frases que la persona separó.
      */}
      <p className="whitespace-pre-line break-words font-heading text-base leading-snug text-foreground">
        {limpio}
      </p>
    </figure>
  );
}

/**
 * ESTÁ OCULTO EN FACEBOOK — fase 14.
 *
 * 🔴 **Se dice arriba del comentario y no en la card de moderación**, porque es
 * un hecho sobre el comentario y no sobre lo que se puede hacer con él: quien
 * abre la conversación tiene que enterarse aunque no mire las acciones. Y lo
 * ocultó cualquiera —también desde el celular con Business Suite, que Hermes no
 * ve pasar (el webhook descarta ese aviso)—, así que puede ser una sorpresa.
 *
 * ⚠️ **«Oculto» no es «borrado», y decirlo evita la pregunta que sigue**: el
 * comentario le sigue apareciendo a quien lo escribió y a sus amigos. Por eso
 * nadie se entera de que lo ocultaron, y por eso alguien podría usar ocultar
 * creyendo que borra.
 */
export function AvisoDeOculto() {
  return (
    <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-gold/10 px-2.5 py-1.5 text-[11px] leading-snug text-gold-ink">
      <EyeOff size={12} className="mt-px shrink-0" />
      <span>
        <strong>Este comentario está oculto en Facebook.</strong> No se ve en la publicación, pero
        quien lo escribió lo sigue viendo.
      </span>
    </p>
  );
}
