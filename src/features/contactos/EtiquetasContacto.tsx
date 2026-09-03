import { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';
import { usePopover } from '../../lib/teclado/usePopover';
import { useCategorias, useMutacionesCategorias, usePuedeAdministrarCategorias, type Categoria } from '../gestion/categorias';
import {
  COLORES,
  NOMBRE_COLOR,
  claseBorde,
  CLASE_FONDO,
  CLASE_TEXTO,
  normalizarNombre,
  resolverColor,
  type ColorCategoria,
} from '../../dominio/paletaCategorias';

/**
 * LAS ETIQUETAS DE UN CONTACTO — el panel Y ahora también la tabla/cuadrícula
 * (pedido del 24-ago-2026: asignar no puede depender de abrir la ficha).
 *
 * No es un componente nuevo de verdad: es `EtiquetasInline` de
 * `BarraGestion.tsx` (el editor del chat) — MISMO endpoint
 * (`/api/gestiones/etiquetas`, abierto a cualquiera del equipo), MISMO
 * catálogo (`/api/categorias`, `useCategorias`) y MISMA regla de la casa
 * (píldora de BORDE, nunca sombra, nunca oro). Acá se factorizó en dos: la
 * MUTACIÓN (`useEtiquetasMutaciones`) y el BOTÓN+popover (`BotonAsignarEtiqueta`)
 * — para que la tabla pueda usar el mismo gesto sin abrir el panel.
 */

/**
 * LAS ETIQUETAS DE MUCHOS CONTACTOS A LA VEZ — para la columna de la tabla y
 * el filtro. `/api/gestiones/etiquetas?claves=` ya acepta varias separadas
 * por coma (lo usa `dashboard.ts` del lado del server); acá se pide UNA vez
 * por toda la lista visible, no una por fila.
 */
export function useEtiquetasDeVarios(claves: readonly string[]) {
  const clave = [...claves].sort().join(',');
  return useQuery({
    queryKey: ['etiquetas', 'lote', clave],
    queryFn: () =>
      api<{ etiquetas: Record<string, string[]> }>(`/api/gestiones/etiquetas?claves=${encodeURIComponent(clave)}`),
    select: (d) => d.etiquetas,
    enabled: claves.length > 0,
  });
}

/** Asignar/quitar, con la MISMA invalidación siempre — la fila, la tarjeta y el panel leen del mismo caché. */
export function useEtiquetasMutaciones(clave: string) {
  const qc = useQueryClient();
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['etiquetas', clave] });
    void qc.invalidateQueries({ queryKey: ['etiquetas', 'lote'] });
    void qc.invalidateQueries({ queryKey: ['contactos-registrados'] });
  };
  const asignar = useMutation({
    mutationFn: (etiqueta: string) =>
      api('/api/gestiones/etiquetas', { method: 'POST', body: JSON.stringify({ clave, etiqueta }) }),
    onSuccess: invalidar,
  });
  const quitar = useMutation({
    mutationFn: (etiqueta: string) =>
      api('/api/gestiones/etiquetas', { method: 'DELETE', body: JSON.stringify({ clave, etiqueta }) }),
    onSuccess: invalidar,
  });
  return { asignar, quitar };
}

/**
 * EL "+" Y SU POPOVER — elegir del catálogo, o crear una etiqueta nueva
 * (`puedeAdministrar`, misma bandera que `BarraGestion.tsx`: nunca un rol
 * calculado en el front). `compacto` es solo el ícono, para una fila angosta.
 */
export function BotonAsignarEtiqueta({
  clave,
  asignadas,
  compacto = false,
}: {
  clave: string;
  /** Lo ya asignado, para no ofrecerlo de nuevo — la trae quien llama (evita repetir el fetch). */
  asignadas: readonly string[];
  compacto?: boolean;
}) {
  const { data: categorias = [] } = useCategorias();
  const { data: puedeAdministrar = false } = usePuedeAdministrarCategorias();
  const { crear } = useMutacionesCategorias();
  const { asignar } = useEtiquetasMutaciones(clave);
  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const [colorNuevo, setColorNuevo] = useState<ColorCategoria>('azul');
  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-20' });

  const asignadasSet = new Set(asignadas);
  const disponibles = categorias.filter((c: Categoria) => !asignadasSet.has(c.nombre));

  function crearYAsignar() {
    if (!puedeAdministrar) return; // el formulario ya está oculto; red de más.
    const limpio = normalizarNombre(nuevo);
    if (!limpio) return;
    // `onSuccess`, no `onSettled`: si `crear` falla (409 duplicada, 403 sin
    // permiso) no hay que seguir de largo a asignar un nombre que el server
    // nunca dio de alta.
    crear.mutate(
      { nombre: limpio, color: colorNuevo },
      {
        onSuccess: () => {
          asignar.mutate(limpio);
          setNuevo('');
          setAbierto(false);
        },
      },
    );
  }

  return (
    <span className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Agregar etiqueta"
        title="Agregar etiqueta"
        className={
          'flex items-center gap-1 rounded-full border border-dashed transition-colors ' +
          (compacto ? 'p-0.5' : 'px-2 py-0.5 text-[11px] font-semibold') +
          ' ' +
          (abierto
            ? 'border-primary text-foreground'
            : 'border-border text-muted-foreground hover:border-primary hover:text-foreground')
        }
      >
        <Plus size={compacto ? 10 : 11} /> {!compacto && 'Agregar'}
      </button>
      {abierto && (
        <>
          <span {...propsOverlay} />
          <div className="absolute right-0 top-6 z-30 w-56 rounded-xl bg-card p-2 shadow-panel">
            {disponibles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {disponibles.map((c) => {
                  const color = resolverColor(c.nombre, categorias);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        asignar.mutate(c.nombre);
                        setAbierto(false);
                      }}
                      className={
                        'inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] font-semibold transition-transform hover:scale-105 ' +
                        claseBorde(color) +
                        (color ? ' ' + CLASE_TEXTO[color] : ' text-muted-foreground')
                      }
                    >
                      {color && <span className={'h-1.5 w-1.5 rounded-full ' + CLASE_FONDO[color]} />}
                      {c.nombre}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Crear una etiqueta nueva es de quien administra el catálogo
                del módulo (supervisor o candidato) — cualquiera sigue
                pudiendo elegir de las de arriba. */}
            {puedeAdministrar ? (
              <div className="rounded-lg border border-border p-1.5">
                <div className="flex items-center gap-1">
                  <input
                    value={nuevo}
                    maxLength={30}
                    onChange={(e) => setNuevo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') crearYAsignar();
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setAbierto(false);
                      }
                    }}
                    autoFocus
                    placeholder="nueva etiqueta…"
                    className="min-w-0 flex-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    aria-label="Crear y asignar"
                    onClick={crearYAsignar}
                    disabled={!normalizarNombre(nuevo) || crear.isPending}
                    className="flex items-center rounded-md bg-primary p-1 text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
                  >
                    {crear.isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Elegir color">
                  {COLORES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={NOMBRE_COLOR[c]}
                      aria-pressed={colorNuevo === c}
                      title={NOMBRE_COLOR[c]}
                      onClick={() => setColorNuevo(c)}
                      className={
                        'h-4 w-4 rounded-full transition-transform ' +
                        CLASE_FONDO[c] +
                        (colorNuevo === c ? ' scale-110 ring-2 ring-navy ring-offset-1 ring-offset-card' : ' hover:scale-110')
                      }
                    />
                  ))}
                </div>
              </div>
            ) : (
              disponibles.length === 0 && (
                <p className="px-1 text-[11px] text-muted-foreground">Todavía no hay etiquetas para asignar.</p>
              )
            )}
          </div>
        </>
      )}
    </span>
  );
}

/** La tarjeta de etiquetas del panel: el mismo botón de arriba + la lista, con quitar. */
export function EtiquetasContacto({ clave }: { clave: string }) {
  const { data: lista = [] } = useQuery({
    queryKey: ['etiquetas', clave],
    queryFn: () =>
      api<{ etiquetas: Record<string, string[]> }>(`/api/gestiones/etiquetas?claves=${encodeURIComponent(clave)}`),
    select: (d) => d.etiquetas[clave] ?? [],
  });
  const { data: categorias = [] } = useCategorias();
  const { quitar } = useEtiquetasMutaciones(clave);

  return (
    <section className="rounded-xl bg-card p-3 shadow-panel">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Etiquetas</h3>
        <BotonAsignarEtiqueta clave={clave} asignadas={lista} />
      </div>

      {lista.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin etiquetas todavía.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {lista.map((etq) => {
            const color = resolverColor(etq, categorias);
            return (
              <span
                key={etq}
                className={
                  'group/tag inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] font-semibold ' +
                  claseBorde(color) +
                  (color ? ' ' + CLASE_TEXTO[color] : ' text-muted-foreground')
                }
              >
                {color && <span className={'h-1.5 w-1.5 rounded-full ' + CLASE_FONDO[color]} />}
                {etq}
                <button
                  type="button"
                  aria-label={`Quitar ${etq}`}
                  onClick={() => quitar.mutate(etq)}
                  className="opacity-40 transition-opacity focus-visible:opacity-100 group-hover/tag:opacity-100"
                >
                  <X size={9} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}
