import { Columnas, type PuntoDia } from '../../components/graficos/Columnas';
import { sectionLabel } from '../../lib/styles';
import {
  esperaEnPalabras,
  franjaEnProblemas,
  ROTULO_FRANJA,
  type DatosCampana,
  type PuntoFranja,
} from './campana';

/**
 * EL PANEL DE LA CAMPAÑA — la tercera lectura del Dashboard, sólo del módulo
 * `campana` (ADR 0063).
 *
 * Contesta la pregunta del jefe de campaña, que no es la de la vendedora ni la
 * del que pone la plata: **«¿a cuánta gente le contestamos y a cuánta la
 * dejamos esperando?»**
 *
 * ── EL ORDEN ES EL DE LA PREGUNTA ────────────────────────────────────────────
 *   A · LA GENTE — cuántos escribieron, cuántos siguen sin respuesta. La cifra
 *       héroe es la MALA (`sin_responder`), porque es la única sobre la que hay
 *       algo que hacer hoy.
 *   B · LAS FRANJAS — el hallazgo que ninguna otra pantalla muestra: la espera
 *       no depende del volumen, depende de la HORA. Cuatro barras y se ve.
 *   C · LA PAUTA — quién abrió el chat desde un anuncio y se quedó sin que le
 *       preguntaran nada.
 *   D · QUIÉN ATIENDE + la serie diaria.
 *
 * ⚠️ **La cifra héroe es la única de la vista**, igual que en «El negocio»: dos
 * números gigantes compitiendo no son dos titulares, son ninguno.
 */

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{children}</p>;
}

function Cifra({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={'font-mono tabular-nums text-foreground ' + className}>{n.toLocaleString('es-PE')}</span>
  );
}

/** Una franja: el nombre, la espera y la barra. El largo dice cuánto se espera. */
function BarraDeFranja({ p, max }: { p: PuntoFranja; max: number }) {
  const rotulo = ROTULO_FRANJA[p.franja];
  const mal = franjaEnProblemas(p);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">
          {rotulo.nombre} <span className="text-muted-foreground/70">· {rotulo.horas}</span>
        </span>
        <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">
          {esperaEnPalabras(p.demora_mediana_min)}
        </span>
      </div>
      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <span
          /* Rojo sólo cuando pasa el umbral: acá el color NO duplica al largo
             como en «El negocio», porque este panel se mira para encontrar el
             hueco, no para comparar dos medianas entre sí. */
          className={'block h-full rounded-full ' + (mal ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${Math.round(((p.demora_mediana_min ?? 0) / max) * 100)}%` }}
        />
      </span>
      <p className="mt-1 text-[10px] text-muted-foreground">
        <Cifra n={p.personas} /> escribieron por primera vez · <Cifra n={p.atendidas} /> atendidas
      </p>
    </div>
  );
}

export function PanelCampana({
  datos,
  cargando,
  actualizando,
}: {
  datos?: DatosCampana;
  cargando: boolean;
  actualizando: boolean;
}) {
  const g = datos?.gente;
  const franjas = datos?.franjas ?? [];
  const maxEspera = Math.max(1, ...franjas.map((f) => f.demora_mediana_min ?? 0));
  const apertura = datos?.aperturas[0];
  const dias: PuntoDia[] = (datos?.dias ?? []).map((d) => ({
    dia: d.dia,
    total: d.entrantes,
    detalle: `${d.entrantes} recibidos · ${d.salientes} enviados`,
  }));
  const sinLineas = datos !== undefined && datos.lineas.length === 0;

  if (sinLineas) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="max-w-md text-center text-sm leading-relaxed text-muted-foreground">
          Todavía no hay ninguna línea de campaña asignada a tu usuario, así que este panel no tiene
          nada que resumir. Pídele a quien administra los números que te asigne la tuya.
        </p>
      </div>
    );
  }

  return (
    <div className={'flex min-h-0 flex-1 flex-col gap-2.5 transition-opacity ' + (actualizando ? 'opacity-60' : '')}>
      {/* ═══ A · LA GENTE ═══ */}
      <section aria-label="La gente" className="grid shrink-0 grid-cols-[minmax(190px,0.85fr)_minmax(210px,1fr)_1.5fr] gap-2.5">
        <article className="rounded-2xl bg-card p-3.5 shadow-panel">
          <h3 className={sectionLabel}>Siguen sin respuesta</h3>
          {cargando ? (
            <div className="mt-2 h-12 w-24 animate-pulse rounded-lg bg-muted" />
          ) : (
            <>
              <p className="mt-1 flex items-center gap-2">
                {/* Rojo, no oro: acá el tiempo no se está acabando, ya se acabó. */}
                <span className="size-2 shrink-0 rounded-full bg-destructive" />
                <span className="font-heading text-[44px] font-bold leading-none text-foreground">
                  {g?.sin_responder ?? 0}
                </span>
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                de <Cifra n={g?.escribieron ?? 0} /> personas que escribieron en el período. Nadie les
                contestó nunca.
              </p>
              <dl className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted-foreground">Recibieron respuesta</dt>
                  <dd className="ml-auto"><Cifra n={g?.respondidas ?? 0} /></dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted-foreground">Escriben por primera vez</dt>
                  <dd className="ml-auto"><Cifra n={g?.nuevas ?? 0} /></dd>
                </div>
              </dl>
            </>
          )}
        </article>

        {/* B · LAS FRANJAS — el hueco de cobertura, que no se ve en ninguna otra parte. */}
        <article className="flex flex-col rounded-2xl bg-card p-3.5 shadow-panel">
          <h3 className={sectionLabel}>Cuánto esperan, según la hora en que escriben</h3>
          {cargando ? (
            <div className="mt-3 space-y-3">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-6 animate-pulse rounded bg-muted" />)}
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-2.5">
              {franjas.map((p) => <BarraDeFranja key={p.franja} p={p} max={maxEspera} />)}
            </div>
          )}
        </article>

        {/* C · LA PAUTA — el embudo de la apertura repetida. */}
        <article className="flex flex-col rounded-2xl bg-card p-3.5 shadow-panel">
          <h3 className={sectionLabel}>Los que llegaron por un anuncio</h3>
          {cargando ? (
            <div className="mt-3 h-16 animate-pulse rounded bg-muted" />
          ) : apertura ? (
            <>
              <p className="mt-2 line-clamp-2 rounded-lg bg-muted px-2.5 py-1.5 text-[11px] italic leading-relaxed text-muted-foreground">
                «{apertura.texto}»
              </p>
              <dl className="mt-2 flex flex-col gap-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <dt className="text-muted-foreground">Abrieron el chat con ese texto</dt>
                  <dd className="ml-auto"><Cifra n={apertura.personas} /></dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-gold-ink" />
                  <dt className="text-muted-foreground">No escribieron nada más</dt>
                  <dd className="ml-auto"><Cifra n={apertura.solo_eso} className="font-semibold" /></dd>
                </div>
              </dl>
              <p className="mt-2 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground">
                Abrieron la conversación y se quedaron esperando que les preguntes. Un mensaje de
                vuelta los convierte en un contacto con nombre y distrito.
              </p>
            </>
          ) : (
            <Vacio>
              Ningún texto de apertura se repite lo suficiente como para ser un anuncio. Cuando una
              pauta de clic-a-WhatsApp empiece a traer gente, aparece acá sola.
            </Vacio>
          )}
        </article>
      </section>

      {/* ═══ D · QUIÉN ATIENDE + LA SERIE ═══ */}
      <section aria-label="La operación" className="grid min-h-0 flex-1 grid-cols-[1.4fr_1fr] gap-2.5">
        <article className="flex min-h-0 flex-col rounded-2xl bg-card p-3.5 shadow-panel">
          <h3 className={sectionLabel}>Quién atiende</h3>
          {cargando ? (
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-5 animate-pulse rounded bg-muted" />)}
            </div>
          ) : datos && datos.equipo.length > 0 ? (
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-muted-foreground">
                    <th className="pb-1.5 text-left font-medium">Operador</th>
                    <th className="pb-1.5 text-right font-medium">Envíos</th>
                    <th className="pb-1.5 text-right font-medium">Personas</th>
                    <th className="pb-1.5 text-right font-medium">Leídos</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.equipo.map((e) => (
                    <tr key={e.operador} className="border-t border-border/60">
                      <td className="truncate py-1.5 pr-2 text-foreground" title={e.operador}>
                        {e.operador}
                        {e.automaticos > 0 && (
                          <span className="ml-1.5 text-muted-foreground">· {e.automaticos} automáticos</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right"><Cifra n={e.envios} /></td>
                      <td className="py-1.5 text-right"><Cifra n={e.personas} /></td>
                      <td className="py-1.5 text-right"><Cifra n={e.leidos} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Vacio>Nadie mandó un mensaje desde estas líneas en el período elegido.</Vacio>
          )}
        </article>

        <article className="flex min-h-0 flex-col rounded-2xl bg-card p-3.5 shadow-panel">
          <h3 className={sectionLabel}>Lo que llega, día a día</h3>
          {cargando ? (
            <div className="mt-3 h-16 animate-pulse rounded bg-muted" />
          ) : dias.length > 0 ? (
            <div className="mt-2">
              <Columnas
                puntos={dias}
                unidad="mensajes"
                resumen={`${datos?.mensajes.entrantes ?? 0} recibidos y ${datos?.mensajes.salientes ?? 0} enviados en el período.`}
              />
              {(datos?.mensajes.entrantes_sin_texto ?? 0) > 0 && (
                <p className="mt-2 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground">
                  <Cifra n={datos?.mensajes.entrantes_sin_texto ?? 0} /> de los recibidos son audios,
                  fotos o stickers: nadie los está transcribiendo.
                </p>
              )}
            </div>
          ) : (
            <Vacio>Todavía no entró ningún mensaje en el período elegido.</Vacio>
          )}
        </article>
      </section>
    </div>
  );
}
