import { Columnas } from '../../components/graficos/Columnas';
import { sectionLabel } from '../../lib/styles';
import { serieDeLeads, type DatosSeries } from './series';

/**
 * «LOS ÚLTIMOS 14 DÍAS» — la tendencia, en una tira angosta arriba de «El negocio».
 *
 * Vivía en el riel de «Mi turno» y se mudó con ADR 0104: es medición del negocio, y
 * «Mi turno» dejó de existir. Es UNA serie (los leads del día), así que no lleva
 * leyenda: el título la nombra y el desglose (chats · comentarios · formularios)
 * aparece al pasar el mouse por cada columna (`Columnas`).
 */
export function TiraCatorceDias({ series, cargando }: { series?: DatosSeries; cargando: boolean }) {
  const { puntos, resumen } = serieDeLeads(series?.leads_dia ?? []);

  return (
    <section
      aria-label="Los últimos 14 días"
      className="flex shrink-0 flex-col gap-1 rounded-2xl bg-card px-4 py-2 shadow-panel sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="shrink-0 sm:w-44">
        <h3 className={sectionLabel}>Los últimos 14 días</h3>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Gente que escribió o dejó sus datos, por día.</p>
      </div>
      <div className="min-w-0 flex-1">
        {cargando && puntos.length === 0 ? (
          <div className="flex h-12 items-end gap-[2px]" aria-busy="true">
            {Array.from({ length: 14 }, (_, i) => (
              <div key={i} className="min-w-0 flex-1 animate-pulse rounded-t-[2px] bg-muted" style={{ height: `${30 + ((i * 37) % 60)}%` }} />
            ))}
          </div>
        ) : puntos.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">La serie de los últimos 14 días todavía no llega.</p>
        ) : (
          <Columnas puntos={puntos} resumen={resumen} unidad="leads" alto={36} />
        )}
      </div>
    </section>
  );
}
