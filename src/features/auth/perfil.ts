import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '../../config';
import { api, ErrorApi } from '../../lib/datos/cliente';
import { tokenGuardado } from '../../lib/datos/token';

/**
 * EL PERFIL QUE LA VENDEDORA EDITA DE SÍ MISMA — nombre para mostrar, apodo,
 * foto. `server/src/perfil/` es el seam; acá los hooks.
 */

export const TOPE_NOMBRE = 60;
export const TOPE_APODO = 30;

export interface Perfil {
  nombre: string | null;
  apodo: string | null;
  fotoUrl: string | null;
}

export function usePerfil() {
  return useQuery({
    queryKey: ['perfil'],
    queryFn: () => api<{ ok: true; perfil: Perfil }>('/api/perfil'),
    select: (d) => d.perfil,
  });
}

export function useGuardarPerfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (campos: { nombre?: string; apodo?: string }) =>
      api<{ ok: true; perfil: Perfil }>('/api/perfil', { method: 'PATCH', body: JSON.stringify(campos) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['perfil'] }),
  });
}

/**
 * Subir la foto. Fetch crudo y no `api()` — mismo motivo que
 * `whatsapp/conversacionWa.ts` (`enviar-media`): el cuerpo es el archivo tal
 * cual, con su propio `Content-Type`, no JSON.
 */
export function useSubirFotoDePerfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (archivo: File) => {
      const token = tokenGuardado();
      const res = await fetch(`${API_URL}/api/perfil/foto`, {
        method: 'POST',
        headers: {
          'content-type': archivo.type || 'application/octet-stream',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: archivo,
      });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}));
        throw new ErrorApi(cuerpo.message ?? `Error ${res.status}`, res.status);
      }
      return res.json() as Promise<{ ok: true; fotoUrl: string }>;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['perfil'] }),
  });
}

/** Quitar la foto: vuelve al respaldo (la primera letra del nombre). */
export function useQuitarFotoDePerfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>('/api/perfil/foto', { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['perfil'] }),
  });
}
