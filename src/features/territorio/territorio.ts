import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';

/**
 * EL TERRITORIO DE UNA CAMPAÑA, DEL LADO DEL CLIENTE (ADR 0063).
 *
 * ⚠️ **Esto sólo existe en el módulo de campañas.** `/api/territorio` contesta
 * **403** a una vendedora de la Escuela (`modulos/modulo.ts`), así que el hook se
 * llama con `activo` y el panel lo apaga: pedirlo desde ventas sería un error
 * garantizado en cada ficha que se abre.
 */

export interface Distrito {
  id: number;
  nombre: string;
  zona: string | null;
  orden: number;
}

export interface RespuestaTerritorio {
  distritos: Distrito[];
  /** Cuánta gente cayó en cada distrito. La clave es el id, en texto (viene de JSON). */
  conteos: Record<string, number>;
  /**
   * Dónde vota ESTA conversación. `null` = todavía no se le preguntó.
   *
   * Desde ADR 0088, `direccion`/`lat`/`lon` son el dato primario (lo que
   * marcó el mapa); `distritoId` es lo que el servidor clasificó SOLO por
   * nombre contra el catálogo — puede venir `null` sin que eso sea un error.
   */
  actual?: {
    distritoId: number | null;
    direccion: string | null;
    lat: number | null;
    lon: number | null;
    anotadoPor: string | null;
  } | null;
  /** No hay línea de campaña asignada todavía. No es un error: es un alta a medias. */
  sinLinea?: boolean;
  /** La línea existe y nadie cargó distritos (o falta la migración). Ya NO bloquea anotar (ADR 0088). */
  sinCatalogo?: boolean;
  /**
   * La línea de campaña de quien pregunta, cruda. `null` = sin línea asignada.
   * Opcional: ausente en un server viejo que todavía no la manda (N4/N5) o en
   * una respuesta rehidratada del caché de IndexedDB (ADR 0007).
   */
  linea?: string | null;
}

/** Una sugerencia del buscador de direcciones (Nominatim/OSM, ADR 0088). */
export interface DireccionSugerida {
  displayName: string;
  lat: number;
  lon: number;
}

export function useTerritorio(clave: string, activo: boolean) {
  return useQuery({
    queryKey: ['territorio', clave],
    queryFn: () => api<RespuestaTerritorio>(`/api/territorio?clave=${encodeURIComponent(clave)}`),
    enabled: activo && Boolean(clave),
    staleTime: 60_000,
  });
}

/**
 * EL CATÁLOGO Y MI LÍNEA, SIN ATARLO A NINGUNA CONVERSACIÓN — para el filtro
 * "Ubicación" de Contactos de campaña y para "Nuevo contacto", que necesita el
 * número de línea ANTES de que exista una conversación con la que pedir
 * `useTerritorio`. Mismo endpoint, sin `?clave=`; misma `queryKey` para las
 * dos formas de leerlo, así que comparten el caché y no duplican el pedido.
 */
function useCatalogoDeCampana(activo: boolean) {
  return useQuery({
    queryKey: ['territorio', 'catalogo'],
    queryFn: () => api<RespuestaTerritorio>('/api/territorio'),
    enabled: activo,
    staleTime: 60_000,
  });
}

export function useMiLineaDeCampana(activo: boolean) {
  return useCatalogoDeCampana(activo).data?.linea;
}

/** Los distritos de la línea de campaña de quien mira — para el filtro "Ubicación". */
export function useDistritosDeCampana(activo: boolean) {
  const { data } = useCatalogoDeCampana(activo);
  return data?.distritos ?? [];
}

/**
 * Anotar o sacar dónde vota.
 *
 * ⚠️ **NO es optimista, al revés de marcar leído.** Ahí el peor caso es un
 * punto que se vuelve a encender; acá es dato de campo que la operadora acaba de
 * preguntarle a una persona en la puerta de su casa, y darlo por guardado
 * mientras el server lo rechaza le hace perder el único momento en que lo tenía.
 * Se invalida al confirmar.
 *
 * Desde ADR 0088, `anotar` recibe la dirección elegida en el mapa
 * (`direccion`/`lat`/`lon`) — el servidor clasifica sola el distrito de
 * catálogo, si hay uno parecido. `{ distritoId }` sigue vivo (unión en el
 * servidor) porque `FichaRapida` — el alta de "Nuevo contacto", que elige
 * ANTES de que exista una conversación con la que abrir un mapa — todavía lo
 * manda por su propio `<select>`.
 */
export function useAnotarTerritorio(clave: string) {
  const qc = useQueryClient();
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['territorio', clave] });
    // La lista de Contactos de campaña muestra el distrito en la columna
    // "Dónde vota" (`contactos/registrados.ts`, un LEFT JOIN contra esta misma
    // tabla) — sin esto, anotar desde `FichaRapida` guardaba bien pero la
    // fila seguía mostrando el valor viejo hasta el próximo refresh manual.
    void qc.invalidateQueries({ queryKey: ['contactos-registrados'] });
  };
  const anotar = useMutation({
    mutationFn: (v: { direccion: string; lat: number; lon: number } | { distritoId: number }) =>
      api<{ ok: true }>(`/api/territorio/${encodeURIComponent(clave)}`, {
        method: 'PUT',
        body: JSON.stringify(v),
      }),
    onSuccess: invalidar,
  });
  const sacar = useMutation({
    mutationFn: () =>
      api<{ ok: true }>(`/api/territorio/${encodeURIComponent(clave)}`, { method: 'DELETE' }),
    onSuccess: invalidar,
  });
  return { anotar, sacar };
}

/** `valor`, pero recién actualizado `ms` después del último cambio. */
function useDebounce<T>(valor: T, ms: number): T {
  const [debounced, setDebounced] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return debounced;
}

/**
 * EL BUSCADOR DE DIRECCIONES DEL MODAL — estilo Google Maps (ADR 0088):
 * la operadora tipea y esto arma la lista de sugerencias.
 *
 * 🔴 **DEBOUNCE PROPIO, y no el de `useDeferredValue`** (a diferencia de
 * `useBuscarContactos`, que sí se apoya en eso solo): ahí cada tecla golpea
 * Postgres, que aguanta un pedido por letra sin parpadear. Acá cada tecla
 * golpearía a Nominatim, que está atado a la cola de `≥1,1 s` entre pedidos
 * (política de uso de OpenStreetMap, ver `server/.../geocodificar.ts`) — sin
 * este debounce, escribir «Javier Prado» (12 letras) encolaba hasta 10
 * pedidos y el último resultado tardaba hasta 11 s en aparecer, uno detrás de
 * otro. Con 350 ms de pausa entre tecla y pedido, typear normal dispara UN
 * pedido, no diez — más rápido para quien mira Y menos carga sobre Nominatim,
 * las dos cosas a la vez.
 */
export function useBuscarDirecciones(q: string) {
  const query = useDebounce(q.trim(), 350);
  const resultado = useQuery({
    queryKey: ['territorio', 'geocodificar', query],
    queryFn: () =>
      api<{ ok: true; resultados: DireccionSugerida[] }>(
        `/api/territorio/geocodificar?q=${encodeURIComponent(query)}`,
      ),
    enabled: query.length >= 3,
    staleTime: 60_000,
  });
  return {
    ...resultado,
    /**
     * Todavía no se disparó el pedido de ESTE texto — sin esto, mientras se
     * espera el debounce el modal mostraba «ninguna dirección coincide»
     * (el resultado de la búsqueda ANTERIOR ya resuelto) antes de buscar de
     * verdad lo que se acaba de tipear.
     */
    debounceando: q.trim() !== query,
  };
}

/**
 * EL CLIC O EL ARRASTRE MANUAL DEL PIN — imperativo, no una query: se dispara
 * en `dragend`/`click`, nunca en cada frame de un arrastre.
 */
export function useGeocodificarInverso() {
  return useMutation({
    mutationFn: (v: { lat: number; lon: number }) =>
      api<{ ok: true; direccion: DireccionSugerida | null }>(
        `/api/territorio/geocodificar/inverso?lat=${v.lat}&lon=${v.lon}`,
      ),
  });
}

/**
 * QUÉ SE LEE EN EL BLOQUE — puro, y por eso testeable sin DOM.
 *
 * ⚠️ Desde ADR 0088, anotar ya NO depende del catálogo (`sinCatalogo`
 * dejó de bloquear): la operadora marca una dirección en el mapa aunque la
 * campaña no tenga un solo distrito cargado — el catálogo es sólo lo que
 * clasifica sola en segundo plano. El único vacío que sigue bloqueando es no
 * tener línea de campaña asignada, que lo arregla un admin.
 */
export function lecturaDeTerritorio(d: RespuestaTerritorio | undefined): {
  puedeAnotar: boolean;
  vacio: string | null;
} {
  if (!d) return { puedeAnotar: false, vacio: null };
  if (d.sinLinea) {
    return { puedeAnotar: false, vacio: 'Todavía no te asignaron la línea de la campaña.' };
  }
  return { puedeAnotar: true, vacio: null };
}

/**
 * CUÁNTA GENTE HAY EN EL MISMO DISTRITO que esta conversación — `null` si
 * todavía no se anotó una dirección o si esa dirección no cayó en ningún
 * distrito del catálogo (silencioso: no es un error, ver ADR 0088).
 */
export function conteoDelDistritoActual(d: RespuestaTerritorio | undefined): number | null {
  const id = d?.actual?.distritoId;
  if (id == null) return null;
  return d?.conteos[String(id)] ?? 0;
}
