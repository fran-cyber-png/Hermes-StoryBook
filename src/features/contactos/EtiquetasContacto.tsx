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
 * el filtro. Se pide UNA vez por toda la lista FILTRADA (no solo la página
 * visible: el filtro "Etiquetas" necesita saber la de cada contacto que
 * matchea los demás filtros antes de paginar), en vez de una por fila.
 *
 * 🔴 **Va por `POST /api/gestiones/etiquetas/lote`, NUNCA por el `GET
 * ?claves=` de arriba** (3-sep-2026). El padrón real de una campaña tiene
 * miles de contactos: la URL de un GET con esas claves separadas por coma
 * superaba el límite de campo de cabecera de HTTP/2 (nginx), que corta el
 * STREAM a nivel de protocolo en vez de contestar un 414 legible — y como el
 * navegador multiplexa varios pedidos en la misma conexión HTTP/2, se
 * llevaba puestos otros pedidos en vuelo (`/api/contactos/registrados`,
 * `/api/stream`). Eso era, en producción, "No se pudieron traer los
 * contactos". El cuerpo de un POST no tiene ese techo.
 *
 * ⚠️ **Ordenadas alfabéticamente acá, no en el server.** `etiquetasPorClave`
 * (`server/src/gestiones/bitacoraComercial.ts`) no lleva `ORDER BY`: sin este
 * `.sort()` el orden dependía del orden físico de la tabla, así que la misma
 * fila podía mostrar las etiquetas en un orden distinto entre una carga y la
 * siguiente — la columna se veía "desordenada".
 */
export function useEtiquetasDeVarios(claves: readonly string[]) {
  const clave = [...claves].sort().join(',');
  return useQuery({
    queryKey: ['etiquetas', 'lote', clave],
    queryFn: () =>
      api<{ etiquetas: Record<string, string[]> }>('/api/gestiones/etiquetas/lote', {
        method: 'POST',
        body: JSON.stringify({ claves: [...claves] }),
      }),
    select: (d) =>
      Object.fromEntries(
        Object.entries(d.etiquetas).map(([k, v]) => [k, [...v].sort((a, b) => a.localeCompare(b, 'es'))]),
      ),
    enabled: claves.length > 0,
  });
}

/**
 * Asignar/quitar, con la MISMA invalidación siempre — la fila, la tarjeta y el panel leen del mismo caché.
 *
 * 🔴 **NO invalida `contactos-registrados`** (3-sep-2026): ese endpoint no
 * devuelve ni un campo de etiquetas (`ContactoRegistrado` no las tiene), así
 * que invalidarlo acá no traía ningún dato nuevo — solo forzaba un refetch de
 * `/api/contactos/registrados`, que no lleva `LIMIT` y trae toda la historia
 * de conversaciones de las líneas de la vendedora. Ese refetch + el
 * recálculo en cascada de los 7 `useMemo` de `VistaContactosCampana` sobre el
 * padrón entero es lo que congelaba la pantalla al tocar CUALQUIER píldora
 * de etiqueta, que es el gesto más común de la vista. Candado:
 * `EtiquetasContacto.test.tsx`.
 */
export function useEtiquetasMutaciones(clave: string) {
  const qc = useQueryClient();
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['etiquetas', clave] });
    void qc.invalidateQueries({ queryKey: ['etiquetas', 'lote'] });
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
  abrirALaIzquierda = false,
}: {
  clave: string;
  /** Lo ya asignado, para no ofrecerlo de nuevo — la trae quien llama (evita repetir el fetch). */
  asignadas: readonly string[];
  compacto?: boolean;
  /**
   * La fila de la tabla y la tarjeta tienen aire a la derecha: el popover abre
   * hacia allá (pedido del 1-sep-2026). La ficha NO — es un panel fijo pegado
   * al borde derecho de la pantalla (`PanelContacto`, `w-[25rem]`), así que el
   * mismo popover ahí se salía del viewport. Quien vive pegado a ese borde
   * pasa esto en `true` para abrir hacia la izquierda, donde sí hay espacio.
   */
  abrirALaIzquierda?: boolean;
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
          // 🔴 El compacto pasó de p-0.5 a p-1.5 (pedido del 01-sep-2026: el
          // blanco de clic de la tabla era demasiado chico para apuntarle bien).
          'flex items-center gap-1 rounded-full border border-dashed transition-colors ' +
          (compacto ? 'p-1.5' : 'px-2 py-0.5 text-[11px] font-semibold') +
          ' ' +
          (abierto
            ? 'border-primary text-foreground'
            : 'border-border text-muted-foreground hover:border-primary hover:text-foreground')
        }
      >
        <Plus size={compacto ? 13 : 11} /> {!compacto && 'Agregar'}
      </button>
      {abierto && (
        <>
          <span {...propsOverlay} />
          <div className={'absolute top-6 z-30 w-56 rounded-xl bg-card p-2 shadow-panel ' + (abrirALaIzquierda ? 'right-0' : 'left-0')}>
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

/**
 * LA PÍLDORA DE UNA ETIQUETA YA ASIGNADA, con su quitar — MISMO look en el
 * panel de la ficha, la fila de la tabla y la tarjeta (pedido del 1-sep-2026:
 * quitar una etiqueta pedía abrir la ficha, pasar el mouse por encima de la
 * píldora para que apareciera la «X» — oculta a `opacity-40` — y recién ahí
 * hacer clic. Acá la «X» queda SIEMPRE visible, y además se puede quitar sin
 * abrir la ficha, desde donde ya se puede asignar.
 */
export function PildoraEtiqueta({
  clave,
  etiqueta,
  color,
  compacto = false,
}: {
  clave: string;
  etiqueta: string;
  color: ColorCategoria | null;
  compacto?: boolean;
}) {
  const { quitar } = useEtiquetasMutaciones(clave);
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-full border bg-card font-semibold ' +
        (compacto ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]') +
        ' ' +
        claseBorde(color) +
        (color ? ' ' + CLASE_TEXTO[color] : ' text-muted-foreground')
      }
    >
      {color && <span className={'h-1.5 w-1.5 rounded-full ' + CLASE_FONDO[color]} />}
      {etiqueta}
      <button
        type="button"
        aria-label={`Quitar ${etiqueta}`}
        onClick={(e) => {
          e.stopPropagation(); // la fila/tarjeta abre la ficha al clic — esto no.
          quitar.mutate(etiqueta);
        }}
        className="text-current/60 transition-colors hover:text-destructive focus-visible:text-destructive"
      >
        <X size={compacto ? 8 : 9} />
      </button>
    </span>
  );
}

/** La tarjeta de etiquetas del panel: el mismo botón de arriba + la lista, con quitar. */
export function EtiquetasContacto({ clave }: { clave: string }) {
  const { data: lista = [] } = useQuery({
    queryKey: ['etiquetas', clave],
    queryFn: () =>
      api<{ etiquetas: Record<string, string[]> }>(`/api/gestiones/etiquetas?claves=${encodeURIComponent(clave)}`),
    select: (d) => [...(d.etiquetas[clave] ?? [])].sort((a, b) => a.localeCompare(b, 'es')),
  });
  const { data: categorias = [] } = useCategorias();

  return (
    <section className="rounded-xl bg-card p-3 shadow-panel">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Etiquetas</h3>
        <BotonAsignarEtiqueta clave={clave} asignadas={lista} abrirALaIzquierda />
      </div>

      {lista.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin etiquetas todavía.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {lista.map((etq) => (
            <PildoraEtiqueta key={etq} clave={clave} etiqueta={etq} color={resolverColor(etq, categorias)} />
          ))}
        </div>
      )}
    </section>
  );
}
