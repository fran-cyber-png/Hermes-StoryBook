import { useState } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import {
  explicarMotivo,
  haceCuanto,
  useHistorialDeRuteo,
  type LoQueCayo,
  type TableroDeRuteo,
} from './routing';

/**
 * QUÉ REPARTIÓ EL RUTEO DE VERDAD — la franja que contesta «¿está funcionando?».
 *
 * ══ 🔴 POR QUÉ ESTA PANTALLA NO PODÍA CONTESTAR ESO ═════════════════════════
 *
 * Routing mostraba a quién le CORRESPONDE cada campaña. Nunca a quién le CAYÓ.
 * Son dos preguntas distintas y la segunda es la única que dice si la
 * configuración sirve: medido el 21-ago-2026, había 3.637 asignaciones y **cero**
 * con motivo `campana`. O sea, el ruteo estaba configurado y no aplicándose, y la
 * pantalla se veía igual en los dos casos.
 *
 * `docs/plan-routing-el-flujo.md` §6 ya había dejado anotado qué medir —«cuántos
 * leads cambian de dueño la primera semana con cables puestos… eso solo se ve
 * contando `conversacion_asignada.motivo`»— y nadie lo construyó. Contar a mano
 * en producción no es monitoreo: es una consulta que alguien tiene que acordarse
 * de correr.
 *
 * ══ DOS NIVELES, Y EL SEGUNDO SE PIDE ══════════════════════════════════════
 *
 * El resumen (motivo × persona) viaja con el tablero y siempre está. El detalle
 * fila por fila se pide **sólo al abrirlo**: son las últimas 50 decisiones y no
 * hacen falta para la pregunta de portada.
 */

/** Cuando no cayó NADA la franja no se dibuja. Ver §El cero. */
export function Monitoreo({ tablero }: { tablero: TableroDeRuteo | undefined }) {
  const [abierto, setAbierto] = useState(false);
  const historial = useHistorialDeRuteo(abierto);

  const cayo = tablero?.cayo ?? [];
  /**
   * 🔴 **EL CERO NO SE MUESTRA, y no es pereza.** «0 conversaciones» es una
   * afirmación sobre el negocio —«no está entrando nadie»— cuando lo que puede
   * estar pasando es que la migración no corrió, que la línea cambió, o que
   * quien mira sólo ve lo suyo y no le tocó nada. Tres causas opuestas con el
   * mismo cartel. Sin datos, la franja se calla.
   */
  if (cayo.length === 0) return null;

  const total = cayo.reduce((n, f) => n + f.conversaciones, 0);
  const dias = tablero?.ventanaDias ?? 30;

  return (
    <section className="border-b border-border bg-muted/30 px-4 py-2 text-[11px]">
      <button
        type="button"
        onClick={() => setAbierto((y) => !y)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 text-left transition-colors duration-200 ease-house hover:text-navy-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Activity size={13} strokeWidth={2} className="shrink-0 text-muted-foreground" aria-hidden />
        <span className="font-medium text-foreground">
          Cayeron {total} en {dias} días
        </span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {resumen(cayo)}
        </span>
        {/**
         * ⚠️ **Se DICE que está recortado.** Un desglose de una sola fila sin
         * explicación se lee como «casi no está cayendo nada» — una afirmación
         * sobre el negocio en vez de sobre un permiso.
         */}
        {tablero?.recortado && (
          <span className="shrink-0 rounded-full border border-navy/30 bg-background px-1.5 py-0.5 text-[10px] font-medium text-navy-ink">
            sólo lo tuyo
          </span>
        )}
        <ChevronDown
          size={13}
          strokeWidth={2}
          aria-hidden
          className={
            'shrink-0 text-muted-foreground transition-transform duration-200 ease-house ' +
            (abierto ? 'rotate-180' : '')
          }
        />
      </button>

      {abierto && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-background">
          {historial.isPending && (
            <p className="px-3 py-4 text-center text-muted-foreground">Buscando…</p>
          )}
          {/**
           * 🔴 **«No se pudo preguntar» ≠ «no hay nada».** Es la misma regla que
           * la apertura de una campaña ya respeta: decir «no cayó nada» cuando la
           * consulta falló es afirmar algo falso sobre el reparto, y sobre eso se
           * decide si un cable se saca.
           */}
          {historial.isError && (
            <p className="px-3 py-4 text-center text-muted-foreground">
              No se pudo traer el historial.
            </p>
          )}
          {historial.data?.sinMigracion && (
            <p className="px-3 py-4 text-center text-muted-foreground">
              Falta aplicar la migración de la bitácora.
            </p>
          )}
          {historial.data && !historial.data.sinMigracion && historial.data.filas.length === 0 && (
            <p className="px-3 py-4 text-center text-muted-foreground">
              Todavía no se anotó ninguna decisión.
            </p>
          )}
          {historial.data?.filas.map((f) => (
            <div
              key={f.id}
              className="flex items-baseline gap-2 border-b border-border/60 px-3 py-1.5 last:border-b-0"
            >
              <span className="w-16 shrink-0 text-muted-foreground">{haceCuanto(f.ocurrioEn) ?? '—'}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-foreground">{f.vendedoraId}</span>
                <span className="text-muted-foreground"> · {explicarMotivo(f.motivo)}</span>
                {/* La regla concreta, cuando la hubo. Es la diferencia entre
                    «cayó por producto» y «cayó por DIPICOT». */}
                {f.regla && <span className="text-muted-foreground"> «{f.regla}»</span>}
              </span>
              {/* Una vencida que volvió no es un lead nuevo, y se dice. */}
              {f.tipo === 'revencida' && (
                <span className="shrink-0 text-[10px] text-muted-foreground">volvió</span>
              )}
              {f.decididaPor && (
                <span className="shrink-0 text-[10px] text-muted-foreground">por {f.decididaPor}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * EL RESUMEN DE UNA LÍNEA: los tres motivos que más pesan.
 *
 * ⚠️ **Agrupa por MOTIVO y no por persona.** La pregunta de portada es «¿el ruteo
 * que configuré se está aplicando?», y eso lo contesta ver cuánto entró por
 * `producto` contra cuánto por `round-robin`. Por persona contesta otra cosa —el
 * reparto— y para eso está el detalle.
 */
export function resumen(cayo: readonly LoQueCayo[]): string {
  const porMotivo = new Map<string, number>();
  for (const f of cayo) {
    porMotivo.set(f.motivo, (porMotivo.get(f.motivo) ?? 0) + f.conversaciones);
  }
  return [...porMotivo.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([motivo, n]) => `${n} ${explicarMotivo(motivo)}`)
    .join(' · ');
}
