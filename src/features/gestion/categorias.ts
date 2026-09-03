import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';
import type { ColorCategoria } from '../../dominio/paletaCategorias';

/**
 * LOS DATOS DE CATEGORÍAS — el catálogo con color, GLOBAL dentro de cada
 * módulo desde el 22-ago-2026 (nació por vendedora en #48; el dueño pidió que
 * todo el equipo vea el mismo catálogo y que solo el supervisor lo administre).
 *
 * El CATÁLOGO (nombre + color + favorita + orden + conteo) vive en
 * `/api/categorias`. Las MUTACIONES de la asignación siguen en `EtiquetasInline`
 * (`/api/gestiones/etiquetas`), y ésas sí son de cualquiera — etiquetar una
 * conversación no cambió. El color de cada píldora se resuelve en el front
 * uniendo por nombre con este catálogo.
 *
 * 🔴 **LA LECTURA de la asignación SÍ vive acá, y se mudó a propósito
 * (24-ago-2026).** Este docblock decía «la asignación NO está acá» y era cierto
 * mientras hubo UN solo lector: `EtiquetasInline`, adentro de `BarraGestion`.
 * Desde que el panel derecho también las dibuja son DOS, y dos `useQuery` con
 * la misma `queryKey` escritos por separado es #37 en su forma más silenciosa:
 * no rompen —React Query los deduplica por la clave— hasta el día que uno de
 * los dos le cambia el `select` o la URL, y entonces la misma conversación
 * muestra etiquetas distintas en dos lugares de la misma pantalla. Un solo
 * `useEtiquetasDe` no lo permite.
 *
 * ⚠️ **`supervisor` viaja en la respuesta y decide quién ve los controles de
 * edición** (crear/renombrar/recolorear/reordenar/borrar) — el front NUNCA
 * mantiene su propia lista de quién administra, mismo patrón que
 * `padron.ts`/`dashboard.ts`. Sin ese campo (server viejo, caché de IndexedDB
 * de ADR 0007) se lee `false`: fail-closed, nadie ve controles que el server
 * todavía no sabe que puede aceptar.
 */

export interface Categoria {
  id: number;
  nombre: string;
  color: string;
  esFavorito: boolean;
  orden: number;
  /** Conversaciones que hoy llevan esta categoría (alimenta el modo Listas, #49). */
  conteo: number;
}

function pedirCategorias() {
  return api<{ categorias: Categoria[]; supervisor?: boolean }>('/api/categorias');
}

/** El catálogo del módulo de quien mira (ventas o campaña), ordenado y con conteo. */
export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: pedirCategorias,
    select: (d) => d.categorias,
  });
}

/**
 * ¿Puede ESTA persona administrar el catálogo (crear/renombrar/recolorear/
 * reordenar/borrar)? Comparte la MISMA queryKey que `useCategorias` — react-query
 * dedupea el pedido, no hay dos requests — y solo cambia el `select`. Fail-closed:
 * sin el campo (server viejo, caché de IndexedDB de ADR 0007) es `false`.
 */
export function usePuedeAdministrarCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: pedirCategorias,
    select: (d) => d.supervisor ?? false,
  });
}

export interface PatchCategoria {
  id: number;
  nombre?: string;
  color?: ColorCategoria;
  esFavorito?: boolean;
  orden?: number;
}

/** Crear / editar / borrar categorías, invalidando el catálogo al terminar. */
export function useMutacionesCategorias() {
  const qc = useQueryClient();
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['categorias'] });
  };

  const crear = useMutation({
    mutationFn: (nueva: { nombre: string; color: ColorCategoria }) =>
      api<{ categoria: Categoria }>('/api/categorias', { method: 'POST', body: JSON.stringify(nueva) }),
    onSuccess: invalidar,
  });

  const editar = useMutation({
    mutationFn: ({ id, ...patch }: PatchCategoria) =>
      api(`/api/categorias/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: invalidar,
  });

  const borrar = useMutation({
    mutationFn: (id: number) => api(`/api/categorias/${id}`, { method: 'DELETE' }),
    onSuccess: invalidar,
  });

  return { crear, editar, borrar };
}

/**
 * LAS ETIQUETAS ASIGNADAS A UNA CONVERSACIÓN — solo lectura.
 *
 * La misma `queryKey` que invalidan las mutaciones de `EtiquetasInline`, así
 * que poner o quitar una etiqueta desde la barra del chat refresca el panel
 * derecho sin que nadie los cablee entre sí.
 *
 * ⚠️ `activo` para el mismo caso de siempre: la galería monta el panel sin
 * server, y un `enabled: false` no dispara nada.
 */
export function useEtiquetasDe(clave: string | null, activo = true) {
  return useQuery({
    queryKey: ['etiquetas', clave],
    enabled: activo && clave != null,
    queryFn: () =>
      api<{ etiquetas: Record<string, string[]> }>(
        `/api/gestiones/etiquetas?claves=${encodeURIComponent(clave!)}`,
      ),
    select: (d) => d.etiquetas[clave!] ?? [],
  });
}
