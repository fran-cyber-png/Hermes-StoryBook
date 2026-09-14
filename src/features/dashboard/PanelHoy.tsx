import { useState } from 'react';
import { Info } from 'lucide-react';
import { FallaConReintento } from '../../components/FallaConReintento';
import { iniciales } from '../../lib/iniciales';
import { sectionLabel } from '../../lib/styles';
import {
  atiendeDesde,
  ayudaDeLinea,
  type Cifra,
  type CifraPorLinea,
  type DatosHoy,
  filasDelEquipo,
  notaSinAtribuir,
  type PuenteAlPipeline,
  puenteDe,
  rotuloDeLinea,
  seAbreEnElPipeline,
  sinDuena24h,
  textoPrimeraRespuesta,
} from './hoy';

/**
 * «HOY» — la pantalla de control del día (ADR 0104).
 *
 * Dos bloques, en el orden en que se lee la mañana:
 *   1 · LA TIRA — tres cifras y su desglose por línea: quién escribió por primera
 *       vez, a quién le debemos una respuesta desde hace más de un día, y qué
 *       verdes no tienen dueña. Es UNA tira, no tres tarjetas: son tres lecturas del
 *       mismo día y separarlas en cajas las haría competir.
 *   2 · EL EQUIPO — una fila por persona con la línea desde la que atiende. Sin esa
 *       columna, la tabla vieja marcaba 0 · 0 · 0 para todas: contaba solo lo que
 *       salía desde Hermes, y casi nadie contesta desde Hermes.
 *
 * 🔴 **Cada cifra es un enlace al Pipeline con su recorte** (`puenteDe`, en
 * `hoy.ts`). Lo que se trabaja se trabaja allá; acá se mide y se abre.
 *
 * COLOR, por lo que significa y siempre con su palabra al lado: azul lo que llegó,
 * rojo lo que ya pasó del día de gracia, y el verde del semáforo para las calientes
 * (el mismo punto que en la tarjeta del Pipeline). **No hay oro**: en Hermes el oro
 * es tiempo que SE ACABA, y ninguna de estas cifras tiene un plazo corriendo, las de
 * más de 24 h ya lo vencieron.
 *
 * ⚠️ **En campaña no se dibujan ni «calientes» ni «ventas»**: sin precio no hay
 * semáforo que las pinte, y una venta de la Escuela no hace a nadie persona del
 * comando. Las dos son la misma no-cifra, y un cero ahí se leería como un dato.
 */

/** Cuántos chips de línea se muestran antes de «ver todas». */
const LINEAS_A_LA_VISTA = 4;

export function PanelHoy({
  datos,
  cargando,
  actualizando,
  onAbrirPipeline,
  falla,
}: {
  datos?: DatosHoy;
  cargando: boolean;
  /** Lo que se ve es de OTRO día mientras llega el de hoy (`isPlaceholderData`). */
  actualizando: boolean;
  onAbrirPipeline: (p: PuenteAlPipeline) => void;
  /**
   * El último pedido de «Hoy» falló, y cómo volver a pedirlo. Con un 503 `lineas_no_leidas`
   * (ADR 0108) el server no pudo leer las líneas de quien mira y cerró en vez de servir de más: se
   * dice su mensaje y se ofrece reintentar, no «se vuelve a pedir solo en un minuto». Si ya había
   * cifras, se quedan y el aviso va encima: son de antes y no pueden pasar por frescas.
   *
   * Los tres viajan juntos a propósito: un aviso de falla sin su reintento no tendría salida.
   */
  falla?: { error: unknown; reintentar: () => void; reintentando: boolean };
}) {
  if (!datos) {
    if (cargando) return <Esqueleto />;
    if (falla) {
      return (
        <div className="rounded-2xl bg-card shadow-panel">
          <FallaConReintento
            error={falla.error}
            generico="«Hoy» no llegó del servidor."
            onReintentar={falla.reintentar}
            reintentando={falla.reintentando}
          />
        </div>
      );
    }
    return (
      <p className="rounded-2xl bg-card px-6 py-14 text-center text-xs leading-relaxed text-muted-foreground shadow-panel">
        «Hoy» no llegó del servidor. Se vuelve a pedir solo en un minuto.
      </p>
    );
  }

  const abrir = (cifra: Cifra) => {
    const puente = puenteDe(cifra);
    if (puente) onAbrirPipeline(puente);
  };
  const filas = filasDelEquipo(datos);
  const sinDuena = sinDuena24h(datos);
  const calientes = datos.calientesSinDuena;
  const conVentas = datos.modulo !== 'campana';

  return (
    <div
      className={
        'flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto transition-opacity md:overflow-hidden ' +
        (actualizando ? 'opacity-60' : '')
      }
    >
      {falla && (
        // Lo que se ve es de antes: el último pedido falló, y se dice encima, igual que en la cola.
        <div className="shrink-0 rounded-2xl bg-card px-4 pb-3 shadow-panel">
          <FallaConReintento
            compacta
            error={falla.error}
            generico="No se pudo actualizar «Hoy»: lo que ves es de la última vez que llegó."
            onReintentar={falla.reintentar}
            reintentando={falla.reintentando}
          />
        </div>
      )}
      {/* ═══ 1 · LA TIRA ═══ */}
      <section
        aria-label="Hoy, en cifras"
        className={
          'grid shrink-0 grid-cols-1 divide-y divide-border rounded-2xl bg-card shadow-panel md:divide-x md:divide-y-0 ' +
          (calientes ? 'md:grid-cols-3' : 'md:grid-cols-2')
        }
      >
        <BloqueDeCifra
          titulo="Escribieron por primera vez hoy"
          punto="bg-primary"
          nota="Su primer mensaje de toda la historia llegó hoy. No cuenta a quien ya había escrito antes, ni a quien solo recibió una difusión."
          vacio="Todavía nadie escribió por primera vez hoy."
          total={datos.escribieron.total}
          frase="escribieron por primera vez hoy"
          porLinea={datos.escribieron.porLinea}
          catalogo={datos}
          onTotal={() => abrir({ tipo: 'escribieron' })}
          onLinea={(linea, canal) => abrir({ tipo: 'escribieron', linea, canal })}
        />
        <BloqueDeCifra
          titulo="Sin respuesta hace más de 24 h"
          punto="bg-destructive"
          nota="Escribieron y lo último que pasó en la conversación fue su mensaje, hace más de un día."
          vacio="Nadie espera respuesta desde hace más de un día."
          total={datos.sinRespuesta.total}
          frase="sin respuesta hace más de 24 h"
          porLinea={datos.sinRespuesta.porLinea}
          catalogo={datos}
          onTotal={() => abrir({ tipo: 'sinRespuesta' })}
          onLinea={(linea, canal) => abrir({ tipo: 'sinRespuesta', linea, canal })}
        />
        {calientes && (
          <BloqueDeCifra
            titulo="Calientes sin dueña"
            punto="bg-sem-verde"
            nota="Verdes del semáforo (preguntaron el precio o el bot las ve calientes) que nadie tiene asignadas."
            vacio="Ninguna caliente sin dueña."
            total={calientes.total}
            frase="calientes sin dueña"
            porLinea={calientes.porLinea}
            catalogo={datos}
            onTotal={() => abrir({ tipo: 'calientes' })}
            onLinea={(linea, canal) => abrir({ tipo: 'calientes', linea, canal })}
          />
        )}
      </section>

      {/* ═══ 2 · EL EQUIPO ═══ */}
      <section aria-label="El equipo hoy" className="flex flex-col rounded-2xl bg-card shadow-panel md:min-h-0 md:flex-1">
        <header className="shrink-0 border-b border-border px-4 py-2.5">
          <h3 className="font-heading text-sm font-bold text-navy-ink">{datos.supervisor ? 'El equipo hoy' : 'Tú, hoy'}</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            <b className="font-semibold text-foreground">Contestadas</b>: conversaciones a las que se les respondió una espera
            hoy, por su línea o desde Hermes. <b className="font-semibold text-foreground">1ª respuesta</b>: la mediana entre
            quienes escribieron por primera vez hoy, con cuántas ya tienen respuesta.
          </p>
        </header>

        {filas.length === 0 && sinDuena === 0 ? (
          <p className="px-6 py-10 text-center text-xs leading-relaxed text-muted-foreground">
            {datos.supervisor
              ? 'Nadie del equipo tiene líneas, conversaciones asignadas ni actividad hoy.'
              : 'Todavía no tienes líneas ni conversaciones asignadas. Acá aparece lo tuyo cuando las tengas.'}
          </p>
        ) : (
          <div className="overflow-x-auto md:min-h-0 md:flex-1 md:overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border text-[11px] text-muted-foreground">
                  <th scope="col" className="px-4 py-1.5 text-left font-medium">
                    Persona
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-left font-medium">
                    Atiende desde
                  </th>
                  <th scope="col" className="w-20 px-2 py-1.5 text-right font-medium">
                    Asignadas
                  </th>
                  <th scope="col" className="w-16 px-2 py-1.5 text-right font-medium">
                    &gt; 24 h
                  </th>
                  <th scope="col" className="w-24 px-2 py-1.5 text-right font-medium whitespace-nowrap">
                    Contestadas hoy
                  </th>
                  {/* Sin la columna de ventas (campaña) ésta es la última y lleva el aire del borde. */}
                  <th
                    scope="col"
                    className={'w-28 py-1.5 text-right font-medium whitespace-nowrap ' + (conVentas ? 'px-2' : 'pl-2 pr-4')}
                  >
                    1ª respuesta
                  </th>
                  {conVentas && (
                    <th scope="col" className="w-20 px-4 py-1.5 text-right font-medium whitespace-nowrap">
                      Ventas hoy
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const nombre = datos.supervisor ? f.nombre : 'Tú';
                  const primera = textoPrimeraRespuesta(f.persona.primeraRespuesta);
                  const desde = atiendeDesde(f.persona, datos);
                  return (
                    <tr key={f.persona.vendedora} className="border-b border-border/70 align-top last:border-b-0">
                      <th scope="row" className="px-4 py-2 text-left font-medium">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-secondary font-heading text-[11px] font-bold text-navy-ink"
                          >
                            {iniciales(f.nombre)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-foreground" title={f.persona.vendedora}>
                              {nombre}
                            </span>
                            {f.soloDeuda && (
                              <span className="block text-[10px] font-normal italic text-muted-foreground">
                                no está en el equipo de hoy
                              </span>
                            )}
                          </span>
                        </span>
                      </th>
                      <td className="px-2 py-2 text-[11px] leading-snug">
                        {desde.length === 0 ? (
                          <span className="text-muted-foreground" title="No tiene líneas en el mapa de líneas">
                            —
                          </span>
                        ) : (
                          desde.map((l) => (
                            <span key={l.numero} className="block whitespace-nowrap">
                              <span className="text-foreground">{l.etiqueta}</span>
                              <span className="text-muted-foreground"> · {l.texto}</span>
                            </span>
                          ))
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {f.soloDeuda ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Enlace
                            n={f.persona.asignadas}
                            etiqueta={`Abrir en el Pipeline: ${f.persona.asignadas} asignadas a ${f.nombre}`}
                            onAbrir={() => abrir({ tipo: 'asignadas', vendedora: f.persona.vendedora })}
                          />
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        <Enlace
                          n={f.sinRespuesta24h}
                          tono={f.sinRespuesta24h > 0 ? 'text-destructive' : undefined}
                          etiqueta={`Abrir en el Pipeline: ${f.sinRespuesta24h} sin respuesta hace más de 24 h de ${f.nombre}`}
                          onAbrir={() => abrir({ tipo: 'sinRespuestaDe', duena: f.persona.vendedora })}
                        />
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-foreground">
                        {f.soloDeuda ? <span className="text-muted-foreground">—</span> : f.persona.contestadas}
                      </td>
                      <td
                        className={'py-2 text-right whitespace-nowrap ' + (conVentas ? 'px-2' : 'pl-2 pr-4')}
                        title={
                          primera.detalle
                            ? `${primera.detalle} de quienes escribieron por primera vez hoy ya tienen respuesta`
                            : 'Hoy nadie escribió por primera vez en lo suyo'
                        }
                      >
                        <span className="font-mono tabular-nums text-foreground">{f.soloDeuda ? '—' : primera.valor}</span>
                        {!f.soloDeuda && primera.detalle && (
                          <span className="block font-mono text-[10px] tabular-nums text-muted-foreground">{primera.detalle}</span>
                        )}
                      </td>
                      {conVentas && (
                        <td
                          className={
                            'px-4 py-2 text-right font-mono tabular-nums ' +
                            ((f.persona.ventas ?? 0) > 0 ? 'font-bold text-success' : 'text-foreground')
                          }
                        >
                          {/* `null` es una cifra que no existe (#954): se dibuja como la fila sin datos, no como un 0. */}
                          {f.soloDeuda || f.persona.ventas === null ? (
                            <span className="font-normal text-muted-foreground">—</span>
                          ) : (
                            f.persona.ventas
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {sinDuena > 0 && (
                  <tr className="border-t border-border bg-muted/40">
                    <th scope="row" className="px-4 py-2 text-left font-medium italic text-muted-foreground">
                      Sin dueña
                    </th>
                    <td className="px-2 py-2 text-[11px] text-muted-foreground">nadie la tiene asignada</td>
                    <td />
                    <td className="px-2 py-2 text-right font-mono tabular-nums">
                      <Enlace
                        n={sinDuena}
                        tono="text-destructive"
                        etiqueta={`Abrir en el Pipeline: ${sinDuena} sin respuesta hace más de 24 h sin dueña`}
                        onAbrir={() => abrir({ tipo: 'sinRespuestaDe', duena: null })}
                      />
                    </td>
                    <td colSpan={conVentas ? 3 : 2} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {datos.sinAtribuir.length > 0 && (
          <ul className="shrink-0 border-t border-border px-4 py-2">
            {datos.sinAtribuir.map((item) => (
              <li key={item.linea ?? 'sin-linea'} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{notaSinAtribuir(item, datos)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Un número que abre el Pipeline. En cero no abre nada: no hay lista que mostrar. */
function Enlace({
  n,
  etiqueta,
  onAbrir,
  tono,
}: {
  n: number;
  etiqueta: string;
  onAbrir: () => void;
  tono?: string;
}) {
  if (n === 0) return <span className="text-muted-foreground">0</span>;
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={etiqueta}
      title={etiqueta}
      className={
        'rounded px-1 underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
        (tono ?? 'text-foreground')
      }
    >
      {n}
    </button>
  );
}

/**
 * UNA CIFRA DE LA TIRA — el total grande y su desglose por línea.
 *
 * El total va en cifras proporcionales (un número grande con `tabular-nums` se ve
 * suelto); los chips de línea, en `tabular-nums`, porque se leen en fila. Lo que no
 * tiene línea se abre por su canal; sin un canal que el Pipeline recorte, se escribe
 * pero no es un enlace (`seAbreEnElPipeline`, la misma regla que `puenteDe`).
 */
function BloqueDeCifra({
  titulo,
  punto,
  nota,
  vacio,
  total,
  frase,
  porLinea,
  catalogo,
  onTotal,
  onLinea,
}: {
  titulo: string;
  punto: string;
  nota: string;
  vacio: string;
  total: number;
  /** Cómo se dice la cifra en una oración, para el `aria-label` del enlace. */
  frase: string;
  porLinea: CifraPorLinea[];
  /** Las líneas y las personas: con eso se nombra cada línea y se explica de quién es. */
  catalogo: Pick<DatosHoy, 'lineas' | 'personas'>;
  onTotal: () => void;
  /** `canal` viaja sólo para lo que no tiene línea (un DM de Messenger/IG). */
  onLinea: (linea: string | null, canal?: string) => void;
}) {
  const [todas, setTodas] = useState(false);
  const visibles = todas ? porLinea : porLinea.slice(0, LINEAS_A_LA_VISTA);
  const resto = porLinea.length - visibles.length;

  return (
    <article className="flex min-w-0 flex-col px-4 py-3">
      <h3 className={sectionLabel + ' flex items-center gap-1.5'}>
        <span aria-hidden="true" className={'size-2 shrink-0 rounded-full ' + punto} />
        {titulo}
      </h3>
      <p className="mt-1.5">
        {total > 0 ? (
          <button
            type="button"
            onClick={onTotal}
            aria-label={`Abrir en el Pipeline: ${total} ${frase}`}
            title="Abrir en el Pipeline"
            className="rounded font-heading text-3xl font-bold leading-none text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {total}
          </button>
        ) : (
          <span className="font-heading text-3xl font-bold leading-none text-muted-foreground">0</span>
        )}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{total > 0 ? nota : vacio}</p>

      {porLinea.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label={`${titulo}, por línea`}>
          {visibles.map((c) => {
            const etiqueta = rotuloDeLinea(c.linea, catalogo.lineas, c.canal);
            const ayuda = ayudaDeLinea(c.linea, catalogo, c.canal);
            const contenido = (
              <>
                <span className="truncate">{etiqueta}</span>
                <span className="font-mono tabular-nums text-foreground">{c.n}</span>
              </>
            );
            return (
              <li key={`${c.linea ?? 'sin-linea'}-${c.canal ?? ''}`} className="min-w-0">
                {!seAbreEnElPipeline(c.linea, c.canal) ? (
                  <span
                    className="flex max-w-56 items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                    title={ayuda ?? undefined}
                  >
                    {contenido}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onLinea(c.linea, c.canal)}
                    aria-label={`Abrir en el Pipeline: ${c.n} ${frase} en ${etiqueta}`}
                    title={ayuda ? `${ayuda} Tócala para abrirla en el Pipeline.` : `Abrir en el Pipeline: ${etiqueta}`}
                    className="flex max-w-56 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {contenido}
                  </button>
                )}
              </li>
            );
          })}
          {(resto > 0 || todas) && porLinea.length > LINEAS_A_LA_VISTA && (
            <li>
              <button
                type="button"
                onClick={() => setTodas((v) => !v)}
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-primary hover:underline"
              >
                {todas ? 'ver menos' : `+${resto} ${resto === 1 ? 'línea' : 'líneas'}`}
              </button>
            </li>
          )}
        </ul>
      )}
    </article>
  );
}

function Esqueleto() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5" aria-busy="true">
      <div className="grid shrink-0 grid-cols-1 gap-px overflow-hidden rounded-2xl bg-card shadow-panel md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-4 py-3">
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-8 w-20 animate-pulse rounded-lg bg-muted" />
            <div className="mt-2 h-3 w-56 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-2xl bg-card p-4 shadow-panel">
        {['w-2/3', 'w-1/2', 'w-3/5', 'w-2/5'].map((w) => (
          <div key={w} className={'h-6 animate-pulse rounded bg-muted ' + w} />
        ))}
      </div>
    </div>
  );
}
