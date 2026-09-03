import { FileText, Paperclip, Workflow, X } from 'lucide-react';
import { tituloDeNota, useNotaPorId } from './notas';
import type { RefPestana } from './pestanas';

/**
 * LA FILA DE PESTAÑAS (26-ago-2026) — arriba de todo, a la altura de «Mi
 * libreta», igual que la barra de un navegador. Cada una resuelve su propio
 * título con `useNotaPorId`: el mismo camino que ya usa la mitad derecha de
 * `PantallaDividida.tsx` para mostrar una página que puede no estar en la
 * lista cargada (una pestaña de OTRO espacio, por ejemplo). Cachea por id, así
 * que dos pestañas de la misma página no piden dos veces.
 */

const ICONO_POR_TIPO = { texto: FileText, diagrama: Workflow, archivo: Paperclip } as const;

function Pestana({
  pestana,
  activa,
  onActivar,
  onCerrar,
}: {
  pestana: RefPestana;
  activa: boolean;
  onActivar: () => void;
  onCerrar: () => void;
}) {
  const nota = useNotaPorId(pestana.id);
  const Icono = ICONO_POR_TIPO[nota.data?.tipo ?? pestana.tipo];
  const titulo = nota.data ? tituloDeNota(nota.data) || 'Sin título' : '…';

  return (
    <div
      className={`group/pestana flex h-8 shrink-0 items-center gap-1.5 rounded-t-lg border-x border-t px-2.5 text-xs transition ${
        activa
          ? 'border-border bg-card text-foreground'
          : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <button type="button" onClick={onActivar} className="flex min-w-0 max-w-40 items-center gap-1.5">
        <Icono className="size-3.5 shrink-0" />
        <span className="truncate">{titulo}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          // No propaga a `onActivar`: cerrar una pestaña que NO es la activa
          // no tiene por qué llevarte a mirarla primero.
          e.stopPropagation();
          onCerrar();
        }}
        aria-label={`Cerrar «${titulo}»`}
        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-secondary hover:text-foreground group-hover/pestana:opacity-100"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

export function BarraDePestanas({
  abiertas,
  activaId,
  onActivar,
  onCerrar,
}: {
  abiertas: RefPestana[];
  /** `null` cuando lo que se ve es la lista, no una página abierta — ninguna
   *  pestaña se marca activa en ese caso. */
  activaId: number | null;
  onActivar: (ref: RefPestana) => void;
  onCerrar: (id: number) => void;
}) {
  if (abiertas.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="Páginas abiertas"
      className="flex shrink-0 items-end gap-0.5 overflow-x-auto border-b border-border bg-muted px-2 pt-1.5"
    >
      {abiertas.map((r) => (
        <Pestana
          key={r.id}
          pestana={r}
          activa={r.id === activaId}
          onActivar={() => onActivar(r)}
          onCerrar={() => onCerrar(r.id)}
        />
      ))}
    </div>
  );
}
