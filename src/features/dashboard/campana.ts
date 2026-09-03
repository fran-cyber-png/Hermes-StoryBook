import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';
import type { ClavePeriodo } from './negocio';

/**
 * EL PANEL DE LA CAMPAÑA — la lectura propia del módulo `campana` (ADR 0063).
 *
 * El server (`server/src/dashboard/campana.ts`) manda los conteos crudos; acá
 * viven sólo las derivaciones de PRESENTACIÓN — el rótulo de cada franja y el
 * formato de una espera en minutos. Nada de aritmética de negocio: si la
 * pantalla necesitara recalcular una métrica, el seam estaría incompleto.
 *
 * 🔴 **Este panel NO sabe de territorio ni de temas, y es a propósito**: eso
 * necesita un diccionario de nombres propios que es de UNA candidatura, y
 * clavarlo acá rompería la promesa de ADR 0063 (que la segunda campaña entre
 * sin tocar código). El porqué largo está en el docblock del server.
 */

export const FRANJAS = ['madrugada', 'manana', 'tarde', 'noche'] as const;
export type Franja = (typeof FRANJAS)[number];

/** Cómo se llama y a qué horas va cada franja, para la pantalla. */
export const ROTULO_FRANJA: Record<Franja, { nombre: string; horas: string }> = {
  madrugada: { nombre: 'Madrugada', horas: '12 a 6 a. m.' },
  manana: { nombre: 'Mañana', horas: '6 a. m. a 12 m.' },
  tarde: { nombre: 'Tarde', horas: '12 m. a 6 p. m.' },
  noche: { nombre: 'Noche', horas: '6 p. m. a 12 p. m.' },
};

export interface PuntoFranja {
  franja: Franja;
  personas: number;
  atendidas: number;
  demora_mediana_min: number | null;
  entrantes: number;
}

export interface Apertura {
  texto: string;
  personas: number;
  solo_eso: number;
}

export interface FilaEquipoCampana {
  operador: string;
  envios: number;
  personas: number;
  leidos: number;
  automaticos: number;
}

export interface DatosCampana {
  rango: { desde: string; hasta: string };
  periodo: ClavePeriodo | 'libre';
  lineas: string[];
  gente: { escribieron: number; respondidas: number; sin_responder: number; nuevas: number };
  mensajes: { entrantes: number; salientes: number; entrantes_sin_texto: number };
  franjas: PuntoFranja[];
  dias: { dia: string; entrantes: number; salientes: number }[];
  aperturas: Apertura[];
  equipo: FilaEquipoCampana[];
}

export function useCampana(params: {
  periodo: ClavePeriodo;
  /** El panel escanea el histórico de las líneas: no se pide si nadie lo mira. */
  activo: boolean;
}) {
  return useQuery({
    queryKey: ['dashboard', 'campana', params.periodo],
    queryFn: () => api<DatosCampana>(`/api/dashboard/campana?periodo=${params.periodo}`),
    enabled: params.activo,
    // Mismo criterio que «El negocio»: se mira, se piensa y se cambia de
    // período. Un número que se mueve solo mientras lo lees es ruido.
    staleTime: 60_000,
    placeholderData: (previo) => previo,
  });
}

// ── Derivaciones de presentación ─────────────────────────────────────────────

/**
 * UNA ESPERA, EN CASTELLANO. Minutos hasta la hora; de ahí, horas con un decimal.
 *
 * ⚠️ No redondea a «1 h» una espera de 95 minutos: la diferencia entre hora y
 * media y once horas es toda la información que este panel tiene para dar.
 */
export function esperaEnPalabras(minutos: number | null): string {
  if (minutos === null) return '—';
  if (minutos < 1) return 'al toque';
  if (minutos < 60) return `${Math.round(minutos)} min`;
  const horas = minutos / 60;
  return horas >= 10 ? `${Math.round(horas)} h` : `${horas.toFixed(1).replace('.', ',')} h`;
}

/**
 * ¿ESTA FRANJA ESTÁ EN PROBLEMAS? — el umbral que pinta la barra de rojo.
 *
 * Media hora es el criterio del comando: más que eso y la persona ya se fue a
 * hacer otra cosa. Vive acá, en un solo lugar, y no repetido en el JSX.
 */
export const ESPERA_QUE_PREOCUPA_MIN = 30;

export function franjaEnProblemas(p: PuntoFranja): boolean {
  return p.demora_mediana_min !== null && p.demora_mediana_min > ESPERA_QUE_PREOCUPA_MIN;
}
