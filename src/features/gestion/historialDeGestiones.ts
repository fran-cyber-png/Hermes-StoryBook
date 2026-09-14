import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';

/** Lo que devuelve `GET /api/gestiones/de/:clave` (`server/src/gestiones/bitacoraComercial.ts`). */
export interface HistorialDeGestiones {
  etapa: string | null;
  /** La razón de la pérdida vigente (ADR 0107). Ausente = server viejo o caché rehidratado (ADR 0007). */
  perdida?: { motivo: string | null; detalle: string | null } | null;
}

/**
 * EL HISTORIAL DE GESTIONES DE UNA CONVERSACIÓN — lo que la ficha lee para decir por qué se
 * perdió (ADR 0107).
 *
 * ⚠️ **Misma `queryKey` que `BarraGestion`** (`['gestiones', clave]`): cuando alguien declara
 * «Dijo que no» desde el chat, la barra invalida esa clave y la ficha abierta al lado se
 * entera sola. Con otra clave, la ficha seguiría diciendo el motivo viejo hasta recargar.
 *
 * `activo` existe porque casi ninguna conversación está perdida: la ficha lo pide sólo con
 * `etapa_efectiva === 'perdido'`, en vez de sumar una consulta a cada ficha que se abre.
 */
export function useHistorialDeGestiones(clave: string, activo = true) {
  return useQuery({
    queryKey: ['gestiones', clave],
    queryFn: () => api<HistorialDeGestiones>(`/api/gestiones/de/${encodeURIComponent(clave)}`),
    enabled: activo,
  });
}
