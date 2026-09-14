import { useState } from 'react';
import { Search, SquarePen, SlidersHorizontal, Tag } from 'lucide-react';
import type { Conversacion } from '../../dominio/conversaciones';
import type { LineaWhatsapp } from '../../dominio/lineas';
import { FilaConversacion } from '../canales/FilaConversacion';
import { HeaderMovil } from './HeaderMovil';
import { RielDeCanales, type CanalDelRiel } from './RielDeCanales';

/**
 * LA BANDEJA EN EL TELÉFONO — la primera de las dos pantallas de Mensajes.
 *
 * ══ POR QUÉ ES UNA PANTALLA Y NO UNA COLUMNA ════════════════════════════════
 *
 * En escritorio Mensajes son TRES columnas que conviven: la cola, el hilo y la
 * ficha. A 430 px no entran —medido: el layout de escritorio desborda a 906 px
 * dentro de una ventana de 430—, así que se parten en dos pantallas y aparece
 * algo que en escritorio nadie necesitó: **volver**.
 *
 * ══ LO QUE ESTA PANTALLA NO REIMPLEMENTA ════════════════════════════════════
 *
 * La fila es `FilaConversacion`, la MISMA de la cola de escritorio: la banda de
 * temperatura, la píldora de canal, el globito, el chip «Preguntó» y la ventana
 * ya están resueltos ahí, con sus tests. Reescribirla acá sería la segunda
 * implementación de la misma regla, que en este repo siempre termina divergiendo
 * (#37, la urgencia contada dos veces).
 *
 * ⚠️ **La barra de filtros SÍ está escrita acá**, y es deuda a propósito. La de
 * escritorio (`BarraFiltros.tsx`) recibe conteos, catálogo y línea, y reflowea a
 * un ancho que todavía no verifiqué a 430. Esta es la versión de la maqueta —
 * dos renglones, sin conteos— y el día que se cablee de verdad, el camino es
 * hacer que `BarraFiltros` sepa ser angosta, no dejar dos barras vivas.
 */
export function BandejaMovil({
  conversaciones,
  lineas = [],
  avisoDelBot,
  onAbrir,
  onVolver,
}: {
  conversaciones: readonly Conversacion[];
  lineas?: readonly LineaWhatsapp[];
  /** El estado del bot para el chip del header. Ausente = no se dibuja. */
  avisoDelBot?: string | null;
  onAbrir: (c: Conversacion) => void;
  onVolver?: () => void;
}) {
  const [pestana, setPestana] = useState<'todo' | 'no-leidos' | 'favoritos'>('todo');
  const [canal, setCanal] = useState<CanalDelRiel>('todos');

  return (
    /* `h-full` y no `min-h-screen`: esto vive dentro del alto que le dé quien lo
       monte. En un teléfono eso es el viewport; en la galería, el marco. */
    <div className="flex h-full flex-col bg-background">
      <HeaderMovil titulo="Mensajes" onVolver={onVolver} aviso={avisoDelBot} />

      {/* ── Buscar, y empezar una conversación nueva ── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 pb-2 pt-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5">
          <Search size={13} className="shrink-0 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar nombre, teléfono o texto…"
            aria-label="Buscar nombre, teléfono o texto"
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <button
          type="button"
          aria-label="Conversación nueva"
          className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground transition-[background-color,transform] duration-200 ease-house hover:bg-primary-hover active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <SquarePen size={16} />
        </button>
      </div>

      {/* ── Las tres pestañas de la cola ── */}
      <div className="flex shrink-0 items-center gap-1 bg-card px-3 pb-1 pt-2">
        {(
          [
            ['todo', 'Todo'],
            ['no-leidos', 'No leídos'],
            ['favoritos', 'Favoritos'],
          ] as const
        ).map(([id, rotulo]) => {
          const puesta = pestana === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={puesta}
              onClick={() => setPestana(id)}
              className={
                'rounded-full px-2.5 py-[5px] font-heading text-xs transition-colors duration-200 ease-house focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ' +
                (puesta ? 'bg-secondary font-bold text-foreground' : 'font-semibold text-muted-foreground')
              }
            >
              {rotulo}
            </button>
          );
        })}
      </div>

      {/* ── Los filtros: la línea arriba, las categorías abajo ── */}
      <div className="flex shrink-0 flex-col gap-1.5 bg-card px-3 pb-2.5 pt-1">
        <div className="flex items-center gap-1.5 overflow-x-auto [&>*]:shrink-0">
          <SlidersHorizontal size={13} className="text-muted-foreground" />
          <span className="rounded-full bg-primary px-2.5 py-1 font-heading text-[11px] font-bold text-primary-foreground">
            Todas
          </span>
          <span className="rounded-full border border-border bg-card px-2.5 py-1 font-heading text-[11px] font-medium text-navy-ink">
            51987654321
          </span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto [&>*]:shrink-0">
          {[
            ['Interesada', 'var(--cat-azul)'],
            ['Precio', 'var(--cat-naranja)'],
            ['Reclamo', 'var(--cat-rojo)'],
          ].map(([rotulo, color]) => (
            <span
              key={rotulo}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-2.5 pr-2.5 font-heading text-[11px] font-medium text-navy-ink"
            >
              <span className="size-1.5 rounded-full" style={{ background: color }} />
              {rotulo}
            </span>
          ))}
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-heading text-[11px] font-medium text-muted-foreground">
            <Tag size={11} />
            Listas
          </span>
        </div>
      </div>

      {/* ── La lista. Es lo único que scrollea: header y riel se quedan. ── */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-card">
        {conversaciones.map((c, i) => (
          <FilaConversacion
            key={c.clave}
            c={c}
            seleccionada={i === 1}
            onAbrir={onAbrir}
            indice={i}
            lineas={lineas}
          />
        ))}
      </div>

      <RielDeCanales activo={canal} onElegir={setCanal} />
    </div>
  );
}
