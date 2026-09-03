import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';

/**
 * EL REGISTRO DE LLAMADAS, del lado de la pantalla.
 *
 * 🔴 **Acá NO se vuelve a decidir qué es una llamada conectada.** El `resultado`
 * de cada fila y los cinco números de la cabecera vienen ya calculados del
 * server (`server/src/llamadas/registro.ts`), y este archivo solo los pinta.
 *
 * La tentación obvia es contar las conectadas acá con un `filter` sobre las
 * filas —se ven ahí mismo, es una línea— y esa línea sería un segundo lugar
 * donde vive la misma regla. Además daría un número distinto: la tabla trae UNA
 * página de 50 y la cabecera habla del rango entero.
 */

export type ResultadoLlamada = 'conectada' | 'no_conectada' | 'cancelada' | 'desconocido';

export interface FilaLlamada {
  id: string;
  cuando: string;
  telefono: string;
  contacto: string | null;
  entrante: boolean;
  video: boolean;
  duracion: number | null;
  resultado: ResultadoLlamada;
  estado: string;
  linea: string | null;
  /** Quién era dueña de la línea al momento de la llamada. No se muestra en
   *  la tabla a propósito (queda para métricas futuras); sí va en el CSV. */
  agente: string | null;
}

export interface TotalesLlamadas {
  total: number;
  conectadas: number;
  noConectadas: number;
  canceladas: number;
  desconocidas: number;
  duracionTotal: number;
  duracionPromedio: number | null;
}

export interface MesDelRegistro {
  mes: string;
  total: number;
  conectadas: number;
  noConectadas: number;
  canceladas: number;
}

export interface DiaDelRegistro {
  dia: string;
  total: number;
  conectadas: number;
  noConectadas: number;
  canceladas: number;
}

export interface SemanaDelRegistro {
  /** El lunes de esa semana, `2026-08-24`. */
  semana: string;
  total: number;
  conectadas: number;
  noConectadas: number;
  canceladas: number;
}

export interface RegistroDeLlamadas {
  filas: FilaLlamada[];
  cuantas: number;
  totales: TotalesLlamadas;
  porHora: number[];
  porMes: MesDelRegistro[];
  porSemana: SemanaDelRegistro[];
  /** Día a día, solo cuando el rango elegido es corto — ver `consultarRegistro.ts`. */
  porDia: DiaDelRegistro[];
}

export interface FiltrosRegistro {
  desde?: string;
  hasta?: string;
  q?: string;
  resultado?: ResultadoLlamada;
  direccion?: 'entrante' | 'saliente';
  pagina?: number;
}

export const FILTROS_VACIOS: FiltrosRegistro = { pagina: 1 };

/** Cuántas filas trae una página. Coincide con el default del server. */
export const POR_PAGINA = 50;

export const ROTULO_RESULTADO: Record<ResultadoLlamada, string> = {
  conectada: 'Conectada',
  no_conectada: 'No conectada',
  cancelada: 'Cancelada',
  desconocido: 'Sin clasificar',
};

/**
 * El color de cada categoría, como variable del tema y no como hex.
 *
 * Escrito así los gráficos y las píldoras siguen al modo oscuro sin una segunda
 * paleta: `var(--success)` ya cambia de valor en `.dark`. Un `#16A34A` clavado
 * acá se vería igual de verde sobre fondo negro y perdería contraste.
 */
export const COLOR_RESULTADO: Record<ResultadoLlamada, string> = {
  conectada: 'var(--success)',
  no_conectada: 'var(--destructive)',
  cancelada: 'var(--warning)',
  desconocido: 'var(--muted-foreground)',
};

/** Segundos a `HH:MM:SS`. Sin dato dice «—», nunca `00:00:00`. */
export function comoReloj(segundos: number | null | undefined): string {
  if (segundos == null) return '—';
  const s = Math.max(0, Math.round(segundos));
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(Math.floor(s / 3600))}:${dos(Math.floor((s % 3600) / 60))}:${dos(s % 60)}`;
}

/** La duración de UNA llamada, en corto: `4m 26s`. */
export function comoDuracion(segundos: number | null | undefined): string {
  if (segundos == null || segundos <= 0) return '—';
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return m === 0 ? `${s}s` : `${m}m ${s}s`;
}

/** `11 jun 2026, 4:15 p.m.` — el formato de la columna Fecha / hora. */
export function comoFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** `2026-08` → `ago 2026`, para el eje del modal. */
export function comoMes(mes: string): string {
  const [anio, m] = mes.split('-');
  const d = new Date(Number(anio), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return mes;
  return d.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' });
}

/**
 * `2026-08-24` → `24 ago`, para el eje del modal cuando agrupa por día o por
 * semana (el lunes de esa semana usa el mismo formato: es una fecha más).
 */
export function comoFechaCorta(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

/** El porcentaje de una tarjeta. `null` sobre total 0 — no «0.0 % del total». */
export function porcentajeDe(parte: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((parte / total) * 1000) / 10;
}

function comoQuery(f: FiltrosRegistro): string {
  const p = new URLSearchParams();
  if (f.desde) p.set('desde', f.desde);
  if (f.hasta) p.set('hasta', f.hasta);
  if (f.q?.trim()) p.set('q', f.q.trim());
  if (f.resultado) p.set('resultado', f.resultado);
  if (f.direccion) p.set('direccion', f.direccion);
  p.set('pagina', String(f.pagina ?? 1));
  p.set('porPagina', String(POR_PAGINA));
  return p.toString();
}

/**
 * El registro para los filtros dados.
 *
 * `placeholderData` conserva la tanda anterior mientras llega la nueva: sin eso,
 * cambiar de página o tocar un filtro vacía la tabla y los cinco números
 * parpadean a «—» por un instante. Con 480 filas eso es medio segundo de
 * pantalla rota en cada clic.
 */
export function useRegistroDeLlamadas(filtros: FiltrosRegistro) {
  return useQuery({
    queryKey: ['llamadas', 'registro', filtros],
    queryFn: () => api<RegistroDeLlamadas>(`/api/llamadas/registro?${comoQuery(filtros)}`),
    placeholderData: (anterior) => anterior,
    staleTime: 30_000,
  });
}

// ── El texto de una llamada (server/src/llamadas/notas.ts) ─────────────────

export interface NotaLlamada {
  texto: string;
  vendedoraId: string;
  creadoAt: string;
  actualizadoAt: string;
}

/**
 * La nota de UNA llamada puntual — se pide recién cuando se abre el detalle
 * (`enabled`), no junto con la página de 50: la inmensa mayoría de las
 * llamadas nunca se abren, y pedir 50 notas por cada carga de página sería
 * 50 requests para un dato que en general no existe.
 */
export function useNotaLlamada(callId: string | null) {
  return useQuery({
    queryKey: ['llamadas', 'nota', callId],
    queryFn: () => api<{ ok: true; nota: NotaLlamada | null }>(`/api/llamadas/${callId}/nota`),
    enabled: callId != null,
    staleTime: 10_000,
  });
}

export function useGuardarNotaLlamada(callId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (texto: string) =>
      api<{ ok: true; nota: NotaLlamada }>(`/api/llamadas/${callId}/nota`, {
        method: 'PUT',
        body: JSON.stringify({ texto }),
      }),
    onSuccess: (r) => qc.setQueryData(['llamadas', 'nota', callId], r),
  });
}

export function useBorrarNotaLlamada(callId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/api/llamadas/${callId}/nota`, { method: 'DELETE' }),
    onSuccess: () => qc.setQueryData(['llamadas', 'nota', callId], { ok: true, nota: null }),
  });
}
