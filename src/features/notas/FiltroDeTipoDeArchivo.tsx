import { useEffect, useRef, useState } from 'react';
import { Check, FileText, FileType, Files, Filter, Star } from 'lucide-react';
import type { ClaseDeArchivo } from './notas';
import type { Espacio } from './espacios';
import { iconoDeEspacio } from './iconosDeEspacio';

/**
 * EL FILTRO FIJO DE LA LIBRETA (03-sep-2026) — un botón al final del
 * buscador que despliega DOS grupos de checkboxes: DÓNDE buscar (mi
 * libreta entera, solo Favoritas, o un espacio puntual — se puede marcar
 * más de uno a la vez) y QUÉ TIPO de fila (página de texto, PDF, Word,
 * texto plano). Los tres —texto, alcance y tipo— se aplican juntos, ver el
 * armado en `Libreta.tsx` (`notas`/`notasDeAlcance`/`notasDelTermino`).
 *
 * Vacío en cualquiera de los dos grupos = sin esa restricción — no hay un
 * estado "nada elegido" que muestre una lista vacía por accidente.
 *
 * Mismo patrón de "clic afuera cierra" que `NuevaPagina.tsx` / `SelectorDeIconoDeEspacio.tsx`.
 */

/** `'todas'`/`'favoritas'` son de mi libreta privada; un `number` es el id de un espacio. */
export type AlcanceDeFiltro = 'todas' | 'favoritas' | number;

const TIPOS: { clave: ClaseDeArchivo; etiqueta: string; Icono: typeof FileText }[] = [
  { clave: 'texto', etiqueta: 'Páginas', Icono: FileText },
  { clave: 'pdf', etiqueta: 'PDF', Icono: FileType },
  { clave: 'word', etiqueta: 'Word', Icono: FileType },
  { clave: 'txt', etiqueta: 'Texto plano', Icono: FileType },
];

function FilaDeOpcion({
  Icono,
  etiqueta,
  elegido,
  onTocar,
}: {
  Icono: typeof FileText;
  etiqueta: string;
  elegido: boolean;
  onTocar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTocar}
      aria-pressed={elegido}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
    >
      <Icono className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{etiqueta}</span>
      {elegido && <Check className="size-3.5 shrink-0 text-primary" />}
    </button>
  );
}

export function FiltroDeTipoDeArchivo({
  elegidos,
  onCambiar,
  espacios,
  alcance,
  onCambiarAlcance,
  onAbrir,
}: {
  elegidos: ReadonlySet<ClaseDeArchivo>;
  onCambiar: (v: Set<ClaseDeArchivo>) => void;
  /** Para ofrecer cada espacio como una opción más de "dónde buscar". */
  espacios: readonly Espacio[];
  alcance: ReadonlySet<AlcanceDeFiltro>;
  onCambiarAlcance: (v: Set<AlcanceDeFiltro>) => void;
  /** El panel de "Páginas" tiene que abrirse solo al usar el filtro — no hace falta ir a tocar el riel primero. */
  onAbrir?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const hayFiltro = elegidos.size > 0 || alcance.size > 0;

  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', afuera, true);
    return () => document.removeEventListener('pointerdown', afuera, true);
  }, [abierto]);

  const alternarTipo = (clave: ClaseDeArchivo) => {
    const v = new Set(elegidos);
    if (v.has(clave)) v.delete(clave);
    else v.add(clave);
    onCambiar(v);
    onAbrir?.();
  };

  const alternarAlcance = (clave: AlcanceDeFiltro) => {
    const v = new Set(alcance);
    if (v.has(clave)) v.delete(clave);
    else v.add(clave);
    onCambiarAlcance(v);
    onAbrir?.();
  };

  return (
    <div ref={caja} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Filtrar por dónde buscar y tipo de archivo"
        aria-expanded={abierto}
        // `size-[42px]` — el mismo alto que el buscador de al lado, que a su
        // vez toma el de la caja de "Nueva página" (`Libreta.tsx`).
        className={`flex size-[42px] shrink-0 items-center justify-center rounded-lg border transition ${
          hayFiltro
            ? 'border-primary bg-secondary text-foreground'
            : 'border-input text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <Filter className="size-3.5" />
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 max-h-[75vh] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
          <p className="px-2 pb-1 pt-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Dónde buscar
          </p>
          <FilaDeOpcion
            Icono={Files}
            etiqueta="Todas las páginas"
            elegido={alcance.has('todas')}
            onTocar={() => alternarAlcance('todas')}
          />
          <FilaDeOpcion
            Icono={Star}
            etiqueta="Favoritas"
            elegido={alcance.has('favoritas')}
            onTocar={() => alternarAlcance('favoritas')}
          />
          {espacios.map((e) => (
            <FilaDeOpcion
              key={e.id}
              Icono={iconoDeEspacio(e.icono)}
              etiqueta={e.nombre}
              elegido={alcance.has(e.id)}
              onTocar={() => alternarAlcance(e.id)}
            />
          ))}

          <p className="mt-1 border-t border-border px-2 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Tipo de archivo
          </p>
          {TIPOS.map(({ clave, etiqueta, Icono }) => (
            <FilaDeOpcion
              key={clave}
              Icono={Icono}
              etiqueta={etiqueta}
              elegido={elegidos.has(clave)}
              onTocar={() => alternarTipo(clave)}
            />
          ))}

          {hayFiltro && (
            <button
              type="button"
              onClick={() => {
                onCambiar(new Set());
                onCambiarAlcance(new Set());
              }}
              className="mt-1 flex w-full items-center rounded-md border-t border-border px-2 pt-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              Quitar filtro
            </button>
          )}
        </div>
      )}
    </div>
  );
}
