import { useState } from 'react';
import { Columnas, type PuntoDia } from '../../components/graficos/Columnas';
import { sectionLabel } from '../../lib/styles';
import { raizDePanel, tarjetasAngostas, terceraTarjetaAngosta } from './disposicion';
import {
  canalEfectivo,
  esperaEnPalabras,
  explicacionDelUniverso,
  franjaEnProblemas,
  nadieRespondio,
  nombreDeOperador,
  numero,
  operadorSinAlta,
  porcentajeQueNoEscribioNada,
  ROTULO_FRANJA,
  type CanalEscucha,
  type DatosCampana,
  type PuntoFranja,
} from './campana';
import { ChipsDeCanal, PanelEscucha } from './PanelEscucha';

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
 *   D · LA ESCUCHA (4-sep-2026) — qué piden, desde qué provincia y con qué
 *       ánimo. Va DESPUÉS de la operación porque se lee, no se acciona: primero
 *       a quién hay que contestarle hoy, después qué está diciendo la región.
 *   E · QUIÉN ATIENDE + la serie diaria.
 *
 * ⚠️ **La cifra héroe es la única de la vista**, igual que en «El negocio»: dos
 * números gigantes compitiendo no son dos titulares, son ninguno.
 */

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{children}</p>;
}

function Cifra({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={'font-mono tabular-nums text-foreground ' + className}>{numero(n)}</span>
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
  const sinEscribir = apertura ? porcentajeQueNoEscribioNada(apertura) : null;
  /**
   * El canal elegido para la escucha. Vive acá y no en la URL: el Dashboard no
   * tiene router (ADR 0002), y un filtro que sobrevive a un cambio de vista
   * confundiría más de lo que ayuda — se vuelve a «Todos» cada vez.
   */
  const [canal, setCanal] = useState<CanalEscucha>('todas');
  /**
   * 🔴 EL CANAL QUE SE DIBUJA NO ES SIEMPRE EL ELEGIDO. Un canal con mensajes en
   * «90 días» puede no tener ninguno en «Hoy», y entonces su chip deja de
   * ofrecerse mientras la elección sigue viva en el estado: quedaban las tres
   * tarjetas en cero, ningún chip prendido y nada que explicara el vacío. Se
   * deriva —no se corrige con un `useEffect`— así que volver al período donde el
   * canal sí tiene algo devuelve la elección intacta. Ver `canalEfectivo`.
   */
  const canalVisible = canalEfectivo(datos?.escucha, canal);
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
    // Angosto, el panel toma su alto y la vista hace scroll (`disposicion.ts`, #968).
    <div className={raizDePanel + (actualizando ? ' opacity-60' : '')}>
      {/* ═══ A · LA GENTE ═══ */}
      {/* Una columna en el teléfono, dos en sm y las tres de siempre desde md (#968): con las
          tres fijas, a 390 px la tercera tarjeta quedaba fuera de la pantalla. */}
      <section aria-label="La gente" className={`${tarjetasAngostas} md:grid-cols-[minmax(190px,0.85fr)_minmax(210px,1fr)_1.5fr]`}>
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
                  {/* La cifra más grande de la vista tampoco se escapa de `numero`:
                      con la línea de Betto en 90 días son cuatro dígitos. */}
                  {numero(g?.sin_responder ?? 0)}
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
            <>
              {nadieRespondio(franjas) && (
                <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                  Nadie contestó en el período, así que no hay ninguna espera que medir: las cuatro
                  franjas van en «—» a propósito.
                </p>
              )}
              <div className="mt-2 flex flex-col gap-2.5">
                {franjas.map((p) => <BarraDeFranja key={p.franja} p={p} max={maxEspera} />)}
              </div>
            </>
          )}
        </article>

        {/* C · LA PAUTA — el embudo de la apertura repetida. */}
        <article className={`flex flex-col rounded-2xl bg-card p-3.5 shadow-panel ${terceraTarjetaAngosta}`}>
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
                  <dd className="ml-auto">
                    {/*
                      🔴 LA PROPORCIÓN, NO SÓLO EL NÚMERO. Medido el 4-sep-2026 en la
                      campaña de Betto: 161 de 224, o sea el **72 %**. «161» a secas no
                      dice si eso es mucho o poco; «72 %» dice que el mecanismo de
                      captación está perdiendo a siete de cada diez que quisieron hablar,
                      y eso es lo más barato que esta pantalla tiene para arreglar.
                    */}
                    <Cifra n={apertura.solo_eso} className="font-semibold" />
                    {sinEscribir !== null && (
                      // El separador NO es cosmética: sin él se lee «6 29 %», que
                      // parece un número solo y no dos cifras distintas.
                      <span className="ml-1.5 border-l border-border pl-1.5 font-mono text-[11px] tabular-nums text-gold-ink">
                        {sinEscribir} %
                      </span>
                    )}
                  </dd>
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

      {/* ═══ D · LA ESCUCHA — qué piden, desde dónde, con qué ánimo ═══ */}
      {datos?.escucha?.estado === 'ok' && (
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className={sectionLabel}>Qué está diciendo la región</h3>
            {/*
              🔴 SIN ESTA LÍNEA, LOS DOS UNIVERSOS SE LEEN COMO UN ERROR. Arriba
              dice «3 recibidos» y acá abajo el chip «Todos» dice 116, en la
              misma pantalla y sin nada en el medio: el primer reflejo es que uno
              de los dos está mal. No lo está — que sean dos universos es
              deliberado (ADR 0092): meter los 4.543 comentarios del muro en
              «Siguen sin respuesta» la volvería una alarma de 4.000 que nadie
              puede accionar, porque un muro no se contesta comentario por
              comentario. Lo que faltaba era decirlo donde se ve la diferencia.
            */}
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
              {explicacionDelUniverso(datos.escucha)}
            </p>
          </div>
          <ChipsDeCanal escucha={datos.escucha} canal={canalVisible} onCanal={setCanal} />
        </div>
      )}
      <PanelEscucha escucha={datos?.escucha} canal={canalVisible} cargando={cargando} />

      {/* ═══ E · QUIÉN ATIENDE + LA SERIE ═══ */}
      <section aria-label="La operación" className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 md:grid-cols-[1.4fr_1fr]">
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
                      {/*
                        El `title` lleva el id SIEMPRE: el nombre es para
                        reconocer a la persona, el id es lo que hay que buscar
                        cuando algo no cuadra y alguien va a mirar la base.
                      */}
                      <td className="truncate py-1.5 pr-2 text-foreground" title={e.operador}>
                        {/*
                          🔴 QUIEN NO TIENE ALTA SE MUESTRA EN MONOESPACIADA, y
                          no con un símbolo al lado. Un nombre se ve como nombre
                          («Andrea»); un usuario se ve como lo que es, un
                          identificador («usuario4»). La diferencia se lee sin
                          leyenda y sin tooltip.

                          ⚠️ La primera versión ponía un «·» y la galería mostró
                          por qué no servía: `bot` no tiene alta Y manda
                          automáticos, así que salía **«bot·· 49 automáticos»**
                          — dos puntos pegados, uno de cada cosa. Un símbolo
                          suelto compite con los separadores que ya existen.
                        */}
                        <span
                          className={operadorSinAlta(e) ? 'font-mono text-muted-foreground' : ''}
                          title={operadorSinAlta(e) ? 'No está dado de alta en el equipo: se muestra su usuario' : undefined}
                        >
                          {nombreDeOperador(e)}
                        </span>
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
                // Con `numero`, igual que las demás cifras del panel: acá se leía
                // «1372 recibidos» al lado de un «1,372» en el chip de WhatsApp.
                resumen={`${numero(datos?.mensajes.entrantes ?? 0)} recibidos y ${numero(datos?.mensajes.salientes ?? 0)} enviados en el período.`}
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
