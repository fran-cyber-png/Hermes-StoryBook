import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';
import type { PuntoDia } from '../../components/graficos/Columnas';
import type { PuntoLeadsDia } from './dashboard';

/**
 * «LOS ÚLTIMOS 14 DÍAS» — la tendencia que se mudó de «Mi turno» a «El negocio»
 * (ADR 0104). El server la sirve aparte (`GET /api/dashboard/series`) con la misma
 * forma que traía el radar: siempre 14 puntos, los días sin datos en cero.
 */

export interface DatosSeries {
  leads_dia: PuntoLeadsDia[];
  envios_dia: { dia: string; n: number }[];
  ventas_dia: { dia: string; n: number }[];
}

/**
 * La serie se pide cuando alguien mira «El negocio». Cambia una vez por día, así que
 * no lleva latido ni la refresca el SSE (`lib/datos/tiempoReal.ts`).
 */
export function useSeriesDashboard({ activo }: { activo: boolean }) {
  return useQuery({
    queryKey: ['dashboard', 'series'],
    queryFn: () => api<DatosSeries>('/api/dashboard/series'),
    enabled: activo,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (previo) => previo,
  });
}

/**
 * Los puntos de la tira y su resumen. Cada columna suma chats, comentarios y
 * formularios, y su desglose en palabras aparece al pasar el mouse; lo que da cero
 * no se nombra. El resumen compara la última semana con la anterior.
 */
export function serieDeLeads(serie: readonly PuntoLeadsDia[]): { puntos: PuntoDia[]; resumen: string } {
  const puntos: PuntoDia[] = serie.map((d) => {
    const partes = [
      d.chats > 0 ? `${d.chats} ${d.chats === 1 ? 'chat' : 'chats'}` : null,
      d.comentarios > 0 ? `${d.comentarios} ${d.comentarios === 1 ? 'comentario' : 'comentarios'}` : null,
      d.formularios > 0 ? `${d.formularios} ${d.formularios === 1 ? 'formulario' : 'formularios'}` : null,
    ].filter((p): p is string => p !== null);
    return {
      dia: d.dia,
      total: d.chats + d.comentarios + d.formularios,
      detalle: partes.length > 0 ? partes.join(' · ') : undefined,
    };
  });
  const suma = (ps: readonly PuntoDia[]) => ps.reduce((n, p) => n + p.total, 0);
  return {
    puntos,
    resumen: `Esta semana cayeron ${suma(puntos.slice(-7))}; la pasada, ${suma(puntos.slice(-14, -7))}.`,
  };
}
