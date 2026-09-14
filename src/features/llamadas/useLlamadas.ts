import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';

export interface LlamadaEnTimeline {
  id: string;
  direccion: string;
  estado: string;
  duracion?: number;
  occurredAt: string;
  remitente?: string;
}

interface HistorialLlamadas {
  llamadas: LlamadaEnTimeline[];
  total: number;
}

export function useHistorialLlamadas(personaId: string | null, activo = true) {
  return useQuery({
    queryKey: ['llamadas', personaId],
    enabled: activo && personaId != null && personaId !== '',
    queryFn: () => api<HistorialLlamadas>(`/api/llamadas/historial/${personaId}`),
    staleTime: 30_000,
  });
}
