/**
 * EL RANGO DE FECHAS del registro de llamadas — separado de `registro.ts`
 * porque ahí vive la forma que entiende el SERVER (`desde`/`hasta` en ISO) y
 * acá vive la forma que entiende la VENDEDORA (un preset, un día, un mes o un
 * rango elegido a mano). `comoFiltroDeFechas` es el único puente entre las dos.
 */

export type IdPreset = 'hoy' | '7' | '30' | '8m' | 'todo';

export type RangoFechas =
  | { tipo: 'preset'; id: IdPreset }
  | { tipo: 'dia'; fecha: Date }
  | { tipo: 'mes'; anio: number; mes: number }
  | { tipo: 'rango'; desde: Date; hasta: Date };

export const RANGO_INICIAL: RangoFechas = { tipo: 'preset', id: 'todo' };

/**
 * El orden en que se ven los atajos — y la ÚNICA fuente de ese orden.
 *
 * 🔴 No se deriva de `Object.keys` de un `Record<IdPreset, string>`: JS
 * reordena solo las claves que PARECEN índice de array (`'7'`, `'30'`) antes
 * que el resto, así que ese camino mostraba «7 días, 30 días, Hoy, 8 meses,
 * Todo» en vez del orden cronológico que se quería escribir.
 */
export const PRESETS: { id: IdPreset; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7', label: 'Últimos 7 días' },
  { id: '30', label: 'Últimos 30 días' },
  { id: '8m', label: 'Últimos 8 meses' },
  { id: 'todo', label: 'Todo el historial' },
];

const ROTULO_PRESET: Record<IdPreset, string> = Object.fromEntries(
  PRESETS.map((p) => [p.id, p.label]),
) as Record<IdPreset, string>;

function medianoche(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function finDelDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * De un preset a la fecha de corte.
 *
 * `hoy` corta a la medianoche local, no a «hace 24 horas»: la vendedora que
 * pregunta «¿cuántas llamé hoy?» quiere el día calendario, no una ventana móvil
 * que a las 9 a.m. todavía incluye las de ayer a la tarde.
 */
function desdeDePreset(id: IdPreset): string | undefined {
  const ahora = new Date();
  switch (id) {
    case 'hoy':
      return medianoche(ahora).toISOString();
    case '7':
    case '30': {
      const d = new Date(ahora);
      d.setDate(d.getDate() - Number(id));
      return d.toISOString();
    }
    case '8m': {
      const d = new Date(ahora);
      d.setMonth(d.getMonth() - 8);
      return d.toISOString();
    }
    case 'todo':
      return undefined;
  }
}

/** El rango elegido, como los `desde`/`hasta` que entiende el server (ISO). */
export function comoFiltroDeFechas(rango: RangoFechas): { desde?: string; hasta?: string } {
  switch (rango.tipo) {
    case 'preset':
      return { desde: desdeDePreset(rango.id) };
    case 'dia':
      return { desde: medianoche(rango.fecha).toISOString(), hasta: finDelDia(rango.fecha).toISOString() };
    case 'mes': {
      const desde = new Date(rango.anio, rango.mes, 1);
      const hasta = new Date(rango.anio, rango.mes + 1, 0, 23, 59, 59, 999);
      return { desde: desde.toISOString(), hasta: hasta.toISOString() };
    }
    case 'rango':
      return { desde: medianoche(rango.desde).toISOString(), hasta: finDelDia(rango.hasta).toISOString() };
  }
}

function primeraMayuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const comoFechaCorta = (d: Date) =>
  d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });

/** La etiqueta del botón que abre el calendario. */
export function etiquetaDeRango(rango: RangoFechas): string {
  switch (rango.tipo) {
    case 'preset':
      return ROTULO_PRESET[rango.id];
    case 'dia':
      return comoFechaCorta(rango.fecha);
    case 'mes':
      return primeraMayuscula(
        new Date(rango.anio, rango.mes, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }),
      );
    case 'rango':
      return `${comoFechaCorta(rango.desde)} – ${comoFechaCorta(rango.hasta)}`;
  }
}
