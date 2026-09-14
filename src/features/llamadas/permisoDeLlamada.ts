import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';

/**
 * EL PERMISO PARA LLAMAR A UN LEAD, Y PEDIRLO — compartido entre `PanelLlamada` y `BotonLlamar`
 * (ADR 0123).
 *
 * Antes de esto cada superficie tenía su propia consulta a `GET /api/llamadas/permiso` y su
 * propia mutación a `POST /api/llamadas/pedir-permiso`: mismo endpoint, mismo cuerpo, dos copias
 * que un día iban a divergir (candado #3). Con una sola función acá, panel y botón comparten la
 * MISMA `queryKey` — pedir el permiso desde cualquiera de los dos invalida al otro.
 */

export type EstadoDePermiso = 'sin_permiso' | 'temporal' | 'permanente' | 'desconocido';

export interface Permiso {
  estado: EstadoDePermiso;
  /** ISO. Solo en un permiso temporal. */
  venceEn: string | null;
  /** ¿Se le puede mandar hoy un pedido de permiso? `null` = Meta no lo dijo. */
  puedePedir: boolean | null;
  /** ¿Se lo puede llamar ahora? Pide permiso vigente y que Meta no lo haya frenado. */
  puedeLlamar: boolean;
}

/** La misma clave para el panel y el botón: pedir en cualquiera invalida a los dos. */
export function clavePermiso(clave: string) {
  return ['llamadas', 'permiso', clave] as const;
}

/**
 * `habilitado` es del llamador (no alcanza con `clave !== ''`): sin conversación llamable,
 * `BotonLlamar` no tiene por qué preguntarle nada a Meta.
 */
export function usePermisoDeLlamada(clave: string, { habilitado }: { habilitado: boolean }) {
  return useQuery({
    queryKey: clavePermiso(clave),
    queryFn: () =>
      api<{ ok: true; permiso: Permiso }>(`/api/llamadas/permiso?clave=${encodeURIComponent(clave)}`).then(
        (r) => r.permiso,
      ),
    enabled: habilitado,
    staleTime: 30_000,
    retry: false,
  });
}

export function usePedirPermisoDeLlamada(clave: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ ok: true; mensaje: string }>('/api/llamadas/pedir-permiso', {
        method: 'POST',
        body: JSON.stringify({ clave }),
      }),
    onSettled: () => void qc.invalidateQueries({ queryKey: clavePermiso(clave) }),
  });
}
