import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, ImageIcon, LayoutTemplate, Loader2, Search, Send, X } from 'lucide-react';
import {
  contarHuecos,
  filtrarPlantillas,
  restoDePlantilla,
  tituloDePlantilla,
  variablesNumeradas,
  type CatalogoAMano,
  type PlantillaAMano,
} from './plantillasAMano';

/**
 * EL CAJÓN DE PLANTILLAS APROBADAS, AL LADO DEL CLIP (ADR 0062).
 *
 * ── Por qué NO es el selector de `/` ────────────────────────────────────────
 * `SelectorRapido` se abre tipeando y **no maneja el teclado a propósito**: el
 * foco se queda en el textarea para poder seguir filtrando, así que las flechas
 * las intercepta la caja. Acá el gesto es otro —se abre con un BOTÓN— y por lo
 * tanto el foco viene a este panel: la búsqueda es un campo propio y las teclas
 * las maneja él. Compartir componente habría obligado a que uno de los dos
 * mintiera sobre dónde vive el foco.
 *
 * ⚠️ Y por eso el Escape se maneja **acá adentro** y no solo con `usePopover`:
 * ese hook ignora el Escape cuando el foco está en un campo
 * (`escapeDePopover.ts`), que es justo nuestro caso mientras se escribe en la
 * búsqueda. El hook sigue puesto del lado del composer para el clic afuera y para
 * el Escape cuando el foco está en otro lado.
 *
 * ── Los tres estados que NO se pueden colapsar ──────────────────────────────
 * Pidiendo · no se pudo preguntar · el catálogo está vacío. Un fallo de Meta
 * dibujado como «no hay plantillas» manda a escribir una que ya existe — es la
 * cicatriz de ADR 0023, y del lado del server la ruta ya se niega a servir una
 * lista vacía justamente para que acá se pueda distinguir.
 */

interface Props {
  consulta: string;
  onConsulta: (v: string) => void;
  indice: number;
  onIndice: (i: number) => void;
  onElegir: (p: PlantillaAMano) => void;
  onCerrar: () => void;
  catalogo: CatalogoAMano | undefined;
  cargando: boolean;
  error: { message: string } | null;
  /**
   * ¿Se puede ofrecer «enviar como plantilla real» (ADR 0072)? Solo con la
   * ventana de 24 h cerrada y la línea en Cloud API — con la ventana abierta,
   * pegar como texto ya sirve y es más flexible (se puede editar antes de
   * mandar), así que no se ofrecen las dos a la vez.
   */
  puedeEnviarComoReal?: boolean;
  onEnviarComoReal?: (p: PlantillaAMano) => void;
}

export function SelectorPlantillas({
  consulta,
  onConsulta,
  indice,
  onIndice,
  onElegir,
  onCerrar,
  catalogo,
  cargando,
  error,
  puedeEnviarComoReal,
  onEnviarComoReal,
}: Props) {
  const listaRef = useRef<HTMLDivElement>(null);
  const buscarRef = useRef<HTMLInputElement>(null);
  const plantillas = filtrarPlantillas(catalogo?.plantillas ?? [], consulta);
  const marcado = Math.min(indice, Math.max(0, plantillas.length - 1));

  // El foco entra al panel apenas se abre: se abrió para elegir, y tipear tiene
  // que filtrar sin tener que ir a buscar la cajita con el mouse.
  useEffect(() => {
    buscarRef.current?.focus();
  }, []);

  // La marcada se trae a la vista tocando SOLO `scrollTop` (la lección de
  // `BarraFiltros.tsx`: `scrollIntoView` se lleva los ancestros, o sea el hilo).
  useEffect(() => {
    const cont = listaRef.current;
    const el = cont?.children[marcado] as HTMLElement | undefined;
    if (!cont || !el) return;
    const caja = cont.getBoundingClientRect();
    const fila = el.getBoundingClientRect();
    if (fila.top < caja.top) cont.scrollTop -= caja.top - fila.top;
    else if (fila.bottom > caja.bottom) cont.scrollTop += fila.bottom - caja.bottom;
  }, [marcado]);

  const ocultas = (catalogo?.ocultas?.noAprobadas ?? 0) + (catalogo?.ocultas?.sinCuerpo ?? 0);

  return (
    <div
      role="listbox"
      aria-label="Plantillas aprobadas"
      className="absolute bottom-full left-0 z-30 mb-2 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-panel"
    >
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
        <LayoutTemplate size={12} className="shrink-0" />
        Plantillas aprobadas
        {catalogo && <span className="font-normal">· {catalogo.plantillas.length}</span>}
        <span className="ml-auto font-normal">↑↓ elegir · Enter pegar · Esc cerrar</span>
      </div>

      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Search size={13} className="shrink-0 text-muted-foreground" />
        <input
          ref={buscarRef}
          value={consulta}
          onChange={(e) => onConsulta(e.target.value)}
          onKeyDown={(e) => {
            const mover = (d: number) => {
              e.preventDefault();
              if (plantillas.length > 0) onIndice((marcado + d + plantillas.length) % plantillas.length);
            };
            if (e.key === 'ArrowDown') return mover(1);
            if (e.key === 'ArrowUp') return mover(-1);
            if (e.key === 'Enter') {
              e.preventDefault();
              const elegida = plantillas[marcado];
              if (elegida) onElegir(elegida);
              return;
            }
            if (e.key === 'Escape') {
              // Se corta acá: más arriba Escape suelta la cita del composer, y
              // cerrar dos cosas con una tecla es perder la que no se quería.
              e.preventDefault();
              e.stopPropagation();
              onCerrar();
            }
          }}
          placeholder="Buscar en el nombre o en el texto…"
          className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>

      {cargando ? (
        <p className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
          <Loader2 size={13} className="animate-spin" /> Preguntándole a Meta cuáles están aprobadas…
        </p>
      ) : error ? (
        /* NO se dibuja como «no hay plantillas»: son dos cosas distintas y la
           reacción razonable a la segunda es ir a crear una que ya existe. */
        <p className="flex items-start gap-2 px-3 py-3 text-xs text-destructive">
          <AlertTriangle size={13} className="mt-px shrink-0" />
          <span>
            <b>No se pudo preguntar por las plantillas.</b> {error.message}
          </span>
        </p>
      ) : plantillas.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">
          {consulta.trim() ? (
            <>
              Ninguna plantilla dice <span className="font-semibold text-foreground">{consulta.trim()}</span>.
            </>
          ) : (
            <>No hay ninguna plantilla aprobada en Meta.</>
          )}
        </p>
      ) : (
        <div ref={listaRef} className="max-h-72 overflow-y-auto">
          {plantillas.map((p, i) => {
            const huecos = contarHuecos(p.cuerpo);
            const resto = restoDePlantilla(p.cuerpo);
            return (
              // `<div>` y no `<button>`: con la acción de «enviar como
              // plantilla real» adentro, el renglón lleva DOS botones
              // (pegar · enviar real) y HTML no admite un botón dentro de
              // otro botón. El `onClick` de PEGAR se queda en ESTE div —el
              // mismo elemento `role="option"` de siempre— para no romper el
              // contrato de quien ya lo clickea ahí; el botón nuevo corta la
              // propagación para no pegar Y abrir el formulario a la vez.
              <div
                key={`${p.nombre}:${p.idioma}`}
                role="option"
                aria-selected={i === marcado}
                onClick={() => onElegir(p)}
                onMouseEnter={() => onIndice(i)}
                className={
                  'cursor-pointer px-3 py-2 transition-colors ' +
                  (i === marcado ? 'bg-secondary' : 'hover:bg-secondary/60')
                }
              >
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-xs font-bold text-foreground">{tituloDePlantilla(p.cuerpo)}</span>
                  {/* El nombre es la identidad: es lo que se busca el día que
                      haya que cruzar esto con una campaña. */}
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">{p.nombre}</span>
                </div>
                {/* El RESTO, no el cuerpo entero: el título ya es la primera
                    línea y repetirla se lee como un defecto de dibujo. */}
                {resto && (
                  <div className="line-clamp-2 whitespace-pre-wrap text-[11px] text-muted-foreground">{resto}</div>
                )}
                {(p.headerDeImagen || huecos > 0) && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                    {/* Las dos advertencias son sobre lo que la plantilla NO trae
                        al pegarse. Sin oro: no corre ningún reloj acá. */}
                    {p.headerDeImagen && (
                      <span className="flex items-center gap-1 text-warning-foreground">
                        <ImageIcon size={10} /> lleva imagen: adjúntala tú
                      </span>
                    )}
                    {huecos > 0 && (
                      <span className="text-warning-foreground">
                        {huecos === 1 ? 'tiene 1 hueco para completar' : `tiene ${huecos} huecos para completar`}
                      </span>
                    )}
                  </div>
                )}
                {puedeEnviarComoReal && onEnviarComoReal && (
                  <button
                    type="button"
                    onClick={(e) => {
                      // No es un clic más adentro del mismo renglón: abre OTRA
                      // pantalla (el mini-formulario), no pega nada acá.
                      e.stopPropagation();
                      onEnviarComoReal(p);
                    }}
                    className="mt-1.5 flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/10"
                  >
                    <Send size={10} /> Enviar como plantilla real (reabre la conversación)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        Se pega en la caja: <b className="font-semibold text-foreground">la mandas tú</b>.
        {/* Que falten se DICE. Una plantilla que ayer estaba y hoy no dejaría a
            la vendedora buscándola sin saber que el catálogo la escondió. */}
        {ocultas > 0 && (
          <>
            {' '}
            {ocultas === 1 ? 'Hay 1 que Meta no tiene aprobada' : `Hay ${ocultas} que Meta no tiene aprobadas`} y no
            se ofrece{ocultas === 1 ? '' : 'n'} acá.
          </>
        )}
      </div>
    </div>
  );
}

/**
 * EL MINI-FORMULARIO PARA MANDAR COMO HSM REAL (ADR 0072).
 *
 * Aparece SOLO cuando `SelectorPlantillas` ofreció «enviar como plantilla
 * real» — o sea, ventana cerrada y línea Cloud API — y reemplaza al cajón
 * de arriba (no coexisten, mismo lugar, mismo ancho).
 *
 * Un input por cada `{{n}}` numerado (nunca el `HUECO` genérico del pegado:
 * acá hace falta saber CUÁNTOS son y en qué orden, que es lo que
 * `armarComponentesPlantilla` del server valida). La imagen es obligatoria
 * si `headerDeImagen` — sin ella Meta rechaza la HSM entera, no solo el
 * header.
 */
export function FormularioHsmReal({
  plantilla,
  enviando,
  error,
  onCancelar,
  onEnviar,
}: {
  plantilla: PlantillaAMano;
  enviando: boolean;
  error: string | null;
  onCancelar: () => void;
  onEnviar: (input: { variables: string[]; imagen: File | null }) => void;
}) {
  const nHuecos = variablesNumeradas(plantilla.cuerpo);
  const [variables, setVariables] = useState<string[]>(() => Array(nHuecos).fill(''));
  const [imagen, setImagen] = useState<File | null>(null);

  const faltaAlgunaVariable = variables.some((v) => !v.trim());
  const faltaImagen = plantilla.headerDeImagen && !imagen;
  const listo = !faltaAlgunaVariable && !faltaImagen;

  return (
    <div className="absolute bottom-full left-0 z-30 mb-2 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card p-3 shadow-panel">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
        <Send size={12} className="shrink-0 text-primary" />
        <span className="truncate">Enviar «{tituloDePlantilla(plantilla.cuerpo)}» como plantilla real</span>
        <button
          type="button"
          onClick={onCancelar}
          aria-label="Cancelar"
          className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
        >
          <X size={12} />
        </button>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Esta vía SÍ atraviesa la ventana de 24 h cerrada: sale como plantilla aprobada de Meta, no
        como texto libre.
      </p>

      {Array.from({ length: nHuecos }, (_, i) => (
        <div key={i} className="mb-2">
          <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">
            Variable {i + 1}
          </label>
          <input
            value={variables[i] ?? ''}
            onChange={(e) => setVariables((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
            className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-primary"
          />
        </div>
      ))}

      {plantilla.headerDeImagen && (
        <div className="mb-2">
          <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">
            Imagen del header (obligatoria — se sube fresca, no se reusa)
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => setImagen(e.target.files?.[0] ?? null)}
            className="w-full text-[11px]"
          />
        </div>
      )}

      {error && <p className="mb-2 text-[11px] text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!listo || enviando}
          onClick={() => onEnviar({ variables, imagen })}
          className="rounded-md bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

/** El botón que lo abre. Vive al lado del clip: las dos son «traer algo de afuera». */
export function BotonPlantillas({
  abierto,
  onAlternar,
  disabled,
}: {
  abierto: boolean;
  onAlternar: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onAlternar}
      disabled={disabled}
      aria-expanded={abierto}
      aria-label="Plantillas aprobadas"
      title="Plantillas aprobadas — se pegan en la caja, no se mandan solas"
      className={
        'flex size-10 shrink-0 items-center justify-center rounded-xl border border-border transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:opacity-40 ' +
        (abierto ? 'bg-muted text-foreground' : 'text-muted-foreground')
      }
    >
      <LayoutTemplate size={16} />
    </button>
  );
}
