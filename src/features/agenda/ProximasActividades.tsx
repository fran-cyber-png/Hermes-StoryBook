import { useState } from 'react';
import { ChevronDown, ChevronUp, ListChecks } from 'lucide-react';
import type { Recordatorio } from './agenda';
import { agruparProximas, pendientesFuturas } from './proximas';
import { horaDe } from './fechas';
import { barraDeNota } from './tipoDeNota';
import { colorPuntoImportancia } from './importancia';
import { formatoTelefono } from '../../lib/formato';
import { BadgeCanal } from '../../components/BadgeCanal';

/**
 * PRÓXIMAS ACTIVIDADES — el resumen en la COLUMNA IZQUIERDA, bajo el mini.
 *
 * La grilla responde «¿qué hay el 18?»; esto responde **«¿qué sigue?»**, que es
 * la pregunta con la que se abre la agenda. Cada renglón abre el mismo detalle
 * que un chip del calendario: es otra puerta a lo mismo, nunca una segunda
 * pantalla con sus propias acciones.
 *
 * ⚠️ VIVE EN UNA COLUMNA DE 288 px, no en una franja ancha. Por eso los grupos
 * se APILAN y el scroll es vertical: cuando iba al pie del calendario los ponía
 * en fila con scroll lateral, y ahí adentro eso esconde todo menos el primero.
 * El alto lo pone la columna (`flex-1` + `min-h-0`), así que crecer no empuja
 * al minicalendario ni le roba alto a la grilla — que no se toca.
 *
 * El agrupado vive puro en `proximas.ts`. Acá solo se dibuja.
 */

const TOPE = 12;

function Renglon({
  r,
  vencido,
  onVer,
}: {
  r: Recordatorio;
  vencido: boolean;
  onVer: (r: Recordatorio) => void;
}) {
  const quien = r.personaNombre ?? (r.personaId ? formatoTelefono(r.personaId) : 'sin conversación atada');
  return (
    <button
      type="button"
      onClick={() => onVer(r)}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary/40"
    >
      <span aria-hidden className={'h-7 w-1 shrink-0 rounded-full ' + barraDeNota(r, vencido, false)} />
      <span className="w-11 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">{horaDe(r)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {r.importancia && <span className={`size-1.5 shrink-0 rounded-full ${colorPuntoImportancia(r.importancia)}`} />}
          <span className={'block truncate text-xs font-semibold ' + (vencido ? 'text-destructive' : 'text-foreground')}>
            {r.nota}
          </span>
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <BadgeCanal canal={r.canal} size={10} />
          <span className="truncate">{quien}</span>
        </span>
      </span>
    </button>
  );
}

export function ProximasActividades({
  recordatorios,
  ahora,
  onVer,
}: {
  recordatorios: Recordatorio[];
  ahora: Date;
  onVer: (r: Recordatorio) => void;
}) {
  const [abierto, setAbierto] = useState(true);
  const grupos = agruparProximas(recordatorios, ahora, TOPE);
  const totalFuturas = pendientesFuturas(recordatorios, ahora);
  const mostradas = grupos.filter((g) => !g.vencido).reduce((n, g) => n + g.recordatorios.length, 0);
  const restantes = totalFuturas - mostradas;
  const vencidas = grupos.find((g) => g.vencido)?.recordatorios.length ?? 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full shrink-0 items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-secondary/20"
      >
        <ListChecks size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-heading text-xs font-bold text-foreground">Próximas actividades</span>
            {vencidas > 0 && (
              <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                {vencidas} vencida{vencidas === 1 ? '' : 's'}
              </span>
            )}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {totalFuturas === 0 ? 'nada pendiente por delante' : `${totalFuturas} por delante`}
          </span>
        </span>
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {abierto ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </span>
      </button>

      {abierto && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-border">
          {grupos.length === 0 ? (
            <p className="px-4 py-4 text-center text-[11px] text-muted-foreground">
              No queda nada pendiente. Clic en cualquier día para agendar el próximo seguimiento.
            </p>
          ) : (
            /* Apilados y con scroll PROPIO: el alto lo pone la columna, así que
               el resumen no empuja al minicalendario ni desplaza la grilla. */
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
              {grupos.map((g) => (
                <div key={g.etiqueta + (g.dia?.toISOString() ?? '')}>
                  <div
                    className={
                      'mb-1 px-2 font-mono text-[10px] font-semibold uppercase tracking-wider ' +
                      (g.vencido ? 'text-destructive' : 'text-muted-foreground')
                    }
                  >
                    {g.etiqueta} · {g.recordatorios.length}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {g.recordatorios.map((r) => (
                      <Renglon key={r.id} r={r} vencido={g.vencido} onVer={onVer} />
                    ))}
                  </div>
                </div>
              ))}
              {restantes > 0 && (
                <div className="px-2 pb-1 text-center text-[11px] text-muted-foreground">
                  +{restantes} más adelante
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
