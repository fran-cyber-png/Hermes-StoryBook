import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { BarraSegmentada } from '../../components/graficos/BarraSegmentada';
import { LineasHora } from '../../components/graficos/LineasHora';
import { sectionLabel } from '../../lib/styles';
import { raizDePanel, selectDeBanda, tarjetasAngostas, terceraTarjetaAngosta } from './disposicion';
import { ETAPA_ROTULO } from '../../lib/etapas';
import {
  CLAVES_PERIODO,
  DIMENSIONES,
  HORA_APERTURA,
  HORA_CIERRE,
  bucketsDeFila,
  cuantoMasLento,
  formatearDemora,
  fueraDeHorario,
  pct,
  rotuloRango,
  type CeldaDelDesglose,
  type ClavePeriodo,
  type DatosNegocio,
  type Dimension,
  type FilaNegocio,
} from './negocio';
import type { DatosSeries } from './series';
import { TiraCatorceDias } from './TiraCatorceDias';
import { PorQueSePierden } from './PorQueSePierden';

/**
 * EL PANEL DEL NEGOCIO — la lectura del que pone la plata (#128, #126).
 *
 * El Pipeline contesta «¿a quién atiendo ahora?». Esto contesta «¿qué curso se está
 * vendiendo, cuál estoy dejando pasar, y en qué anuncio conviene invertir?».
 *
 * POR QUÉ SON DOS PANTALLAS Y NO UNA: son dos personas con dos preguntas y dos
 * ritmos. La vendedora mira el radar cada cinco minutos; el dueño mira esto una
 * vez al día y cambia de período. Apiladas en una sola vista, en una app de
 * escritorio que NO scrollea, las dos quedan apretadas y ninguna se lee. El
 * conmutador vive en la banda de arriba, en el mismo lugar siempre, y en escritorio
 * la banda cambia de contenido pero no de altura: cero salto de layout. En pantalla
 * angosta sí crece y la vista hace scroll, porque recortar era peor (#968).
 *
 * ORDEN VERTICAL = orden de importancia:
 *   0 · LA TENDENCIA — los últimos 14 días, en una tira angosta. Vivía en el riel
 *       de «Mi turno» y se mudó acá con ADR 0104: es medición del negocio.
 *   1 · LA ATENCIÓN — la cifra héroe (cuánta gente está esperando AHORA), las
 *       dos medianas de primera respuesta y la cobertura horaria. Es lo primero
 *       porque es lo único accionable hoy mismo.
 *   2 · LA TABLA — por curso o por anuncio, ordenable por donde se está perdiendo
 *       plata. Con la cobertura del dato dicha arriba, no escondida.
 *
 * EL ORO, una sola vez y por su significado: el punto de la cifra héroe y el
 * segmento «esperando» de cada barra. Las dos cosas son «se le está acabando el
 * tiempo a esta persona». Rojo es «ya se acabó» (jamás respondida). Ningún oro
 * decorativo, ningún oro en franjas horarias ni en bordes.
 */

/**
 * LAS TRES LECTURAS, EN UN SOLO LUGAR — el segmentado, el encabezado de la
 * primera columna, el vacío y el rótulo del detalle salen todos de acá. Agregar
 * una cuarta dimensión es agregar una entrada, no tocar cinco `if`.
 *
 * `detalle` es cómo se llama la OTRA dimensión: la que aparece al abrir una
 * fila. Por curso y por anuncio es la vendedora; por vendedora es el curso.
 */
const TITULO_DIMENSION: Record<
  Dimension,
  { titulo: string; columna: string; sinAtribuir: string; detalle: string; sinDetalle: string; ayuda: string }
> = {
  curso: {
    titulo: 'Por curso',
    columna: 'Curso',
    sinAtribuir: 'Sin curso identificado',
    detalle: 'Vendedora',
    sinDetalle: 'Nadie contestó desde Hermes',
    ayuda:
      'El curso sale del interés que la vendedora registró, del formulario que la persona llenó o ' +
      'del anuncio por el que escribió — en ese orden, el mismo del chip de la cola.',
  },
  anuncio: {
    titulo: 'Por anuncio',
    columna: 'Anuncio',
    sinAtribuir: 'Sin anuncio registrado',
    detalle: 'Vendedora',
    sinDetalle: 'Nadie contestó desde Hermes',
    ayuda: 'El anuncio sale del click-to-WhatsApp del primer mensaje. Para la campaña, ver "Por campaña".',
  },
  vendedora: {
    titulo: 'Por vendedora',
    columna: 'Vendedora',
    sinAtribuir: 'Sin vendedora — nadie contestó desde Hermes',
    detalle: 'Curso',
    sinDetalle: 'Sin curso identificado',
    ayuda:
      'La vendedora es la que le escribió PRIMERO a esa conversación desde Hermes, así que es la ' +
      'dueña de su tiempo de primera respuesta. La auto-respuesta no cuenta como persona. ' +
      '⚠️ Un comentario de Facebook o Instagram se contesta por un camino que todavía no registra ' +
      'quién fue, así que cae en la fila sin nombre: la cobertura es de WhatsApp.',
  },
  campana: {
    titulo: 'Por campaña',
    columna: 'Campaña',
    sinAtribuir: 'Sin campaña identificada',
    detalle: 'Vendedora',
    sinDetalle: 'Nadie contestó desde Hermes',
    ayuda:
      'El nombre de la campaña sale del ruteo (la tabla que decide a quién le cae el lead) cuando existe; ' +
      'si no, del caché que resuelve el nombre del anuncio; si tampoco, de lo que Meta mandó con el ' +
      'formulario. La fuente exacta de cada fila se ve al pasar el mouse.',
  },
  linea: {
    titulo: 'Por línea',
    columna: 'Línea',
    sinAtribuir: 'Sin línea identificada',
    detalle: 'Vendedora',
    sinDetalle: 'Nadie contestó desde Hermes',
    ayuda: 'El número propio de WhatsApp que recibió la conversación.',
  },
  canal: {
    titulo: 'Por canal',
    columna: 'Canal',
    sinAtribuir: 'Sin canal identificado',
    detalle: 'Vendedora',
    sinDetalle: 'Nadie contestó desde Hermes',
    ayuda: 'WhatsApp, Messenger, comentario de Facebook o Instagram — por dónde entró la conversación.',
  },
};

const ETIQUETA_PERIODO: Record<ClavePeriodo, string> = { hoy: 'Hoy', '7d': '7 días', '30d': '30 días', '90d': '90 días' };

/** Los tres estados de la barra, con su color y su significado. Legend + bar leen de acá. */
const ESTADOS = [
  { id: 'alDia', label: 'Al día', color: 'bg-primary', ayuda: 'la última palabra es nuestra' },
  { id: 'esperanTrasRespuesta', label: 'Esperando', color: 'bg-gold-ink', ayuda: 'contestamos, y volvió a escribir' },
  { id: 'jamas', label: 'Jamás respondida', color: 'bg-destructive', ayuda: 'nadie contestó nunca' },
] as const;

export interface FiltrosNegocioState {
  periodo: ClavePeriodo;
  numero: string | null;
  dimension: Dimension;
}

// ── La banda de filtros (vive en la banda superior de la vista) ───────────────

/**
 * UNA sola fila de filtros, arriba de todo lo que gobierna — nunca un filtro
 * adentro de una tarjeta. El rango en letras va debajo del preset porque
 * «7 días» sin fechas obliga a confiar; con fechas, se verifica.
 */
export function FiltrosNegocio({
  valor,
  onCambio,
  datos,
  soloPeriodo = false,
  rango,
}: {
  valor: FiltrosNegocioState;
  onCambio: (v: FiltrosNegocioState) => void;
  datos?: DatosNegocio;
  /**
   * Deja sólo el período y esconde la dimensión y el selector de línea.
   *
   * Lo usa «La campaña» (ADR 0063), que comparte la pregunta «¿de cuándo?» con
   * «El negocio» pero no las otras dos: no tiene cursos ni anuncios que cruzar,
   * y **sus líneas salen del token, no de la pantalla** — un selector de línea
   * ahí sería ofrecer elegir algo que el server va a ignorar.
   */
  soloPeriodo?: boolean;
  /**
   * El rango que se está mirando, cuando NO sale de `datos`. «La campaña» tiene
   * el suyo propio; sin esto el rótulo de abajo del período diría «—» aunque el
   * panel de al lado esté mostrando un rango perfectamente conocido.
   */
  rango?: { desde: string; hasta: string };
}) {
  const numeros = soloPeriodo ? [] : (datos?.numeros ?? []);
  return (
    // Angosto, los filtros toman su propia línea de la banda y se acomodan adentro (#968).
    <div className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 md:w-auto md:flex-1">
      <div className="flex shrink-0 flex-col">
        <div className="flex rounded-full border border-border p-0.5">
          {CLAVES_PERIODO.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onCambio({ ...valor, periodo: p })}
              aria-pressed={valor.periodo === p}
              className={
                'rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ' +
                (valor.periodo === p ? 'bg-navy text-white' : 'text-muted-foreground hover:text-foreground')
              }
            >
              {ETIQUETA_PERIODO[p]}
            </button>
          ))}
        </div>
        <span className="mt-0.5 pl-2 font-mono text-[10px] tabular-nums text-muted-foreground">
          {(() => { const r = rango ?? datos?.rango; return r ? rotuloRango(r) : '—'; })()}
        </span>
      </div>

      {/* Por debajo de 640 px las seis pastillas no entran (492 px contra unos 358): va el mismo
          control como `<select>` nativo, que en el teléfono abre la lista del sistema (#968). */}
      <label className={'relative shrink-0 items-center ' + (soloPeriodo ? 'hidden' : 'flex sm:hidden')}>
        <span className="sr-only">Agrupar la tabla por</span>
        <select
          value={valor.dimension}
          onChange={(e) => onCambio({ ...valor, dimension: DIMENSIONES.find((d) => d === e.target.value) ?? valor.dimension })}
          className={`${selectDeBanda} font-semibold`}
        >
          {DIMENSIONES.map((d) => (
            <option key={d} value={d}>
              {TITULO_DIMENSION[d].titulo}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute right-2.5 text-muted-foreground" />
      </label>
      <div className={'shrink-0 rounded-full border border-border p-0.5 ' + (soloPeriodo ? 'hidden' : 'hidden sm:flex')}>
        {DIMENSIONES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onCambio({ ...valor, dimension: d })}
            aria-pressed={valor.dimension === d}
            title={TITULO_DIMENSION[d].ayuda}
            className={
              'rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ' +
              (valor.dimension === d ? 'bg-navy text-white' : 'text-muted-foreground hover:text-foreground')
            }
          >
            {TITULO_DIMENSION[d].titulo}
          </button>
        ))}
      </div>

      {/* Con un número solo el selector no molesta: dice cuál es. Con varios (#50)
          se vuelve el filtro que separa el desempeño de cada línea. */}
      {numeros.length > 1 ? (
        <label className="relative flex shrink-0 items-center">
          <span className="sr-only">Número propio</span>
          <select
            value={valor.numero ?? ''}
            onChange={(e) => onCambio({ ...valor, numero: e.target.value || null })}
            className={`${selectDeBanda} font-mono tabular-nums`}
          >
            <option value="">Todos los números</option>
            {numeros.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2.5 text-muted-foreground" />
        </label>
      ) : numeros.length === 1 ? (
        <span className="shrink-0 text-[11px] text-muted-foreground" title="El único número propio vinculado (#50 trae los demás)">
          Número <span className="font-mono tabular-nums text-foreground">{numeros[0]}</span>
        </span>
      ) : null}
    </div>
  );
}

// ── El panel ─────────────────────────────────────────────────────────────────

type Columna = 'llegaron' | 'esperan' | 'nunca_respondidos' | 'demora_mediana_min' | 'cerrados';

export function PanelNegocio({
  datos,
  cargando,
  actualizando,
  dimension,
  series,
  cargandoSeries = false,
}: {
  datos?: DatosNegocio;
  cargando: boolean;
  actualizando: boolean;
  dimension: Dimension;
  /** La serie de los últimos 14 días (`/api/dashboard/series`). */
  series?: DatosSeries;
  cargandoSeries?: boolean;
}) {
  const [orden, setOrden] = useState<Columna>('llegaron');
  /**
   * QUÉ FILA ESTÁ ABIERTA. Una sola a la vez: el detalle contesta «¿y acá dentro
   * quién?», que es una pregunta que se hace de a una — dos abiertas obligan a
   * comparar de memoria entre dos bloques separados por otras filas.
   */
  const [abierta, setAbierta] = useState<string | null>(null);
  const textos = TITULO_DIMENSION[dimension];
  const a = datos?.atencion;

  // Sin atribuir va SIEMPRE al final, ordene por lo que ordene: no compite con
  // los cursos reales por el primer puesto, pero tampoco se esconde.
  const filas = useMemo(() => {
    const lista = [...(datos?.filas ?? [])];
    lista.sort((x, y) => {
      if ((x.clave === null) !== (y.clave === null)) return x.clave === null ? 1 : -1;
      const vx = x[orden] ?? -1;
      const vy = y[orden] ?? -1;
      return vy - vx || y.llegaron - x.llegaron;
    });
    return lista;
  }, [datos, orden]);

  /**
   * El desglose, indexado por fila y ya ordenado por volumen. Ausente = server
   * viejo o una respuesta rehidratada del caché de IndexedDB (ADR 0007): ahí el
   * mapa queda vacío y las filas simplemente no se abren, que es el
   * comportamiento de antes y no un hueco.
   */
  const desglosePorFila = useMemo(() => {
    const m = new Map<string, CeldaDelDesglose[]>();
    for (const c of datos?.desglose ?? []) {
      const k = c.fila ?? '';
      const lista = m.get(k);
      if (lista) lista.push(c);
      else m.set(k, [c]);
    }
    for (const lista of m.values()) lista.sort((x, y) => y.llegaron - x.llegaron);
    return m;
  }, [datos]);

  const hueco = a ? fueraDeHorario(a.cobertura, HORA_APERTURA, HORA_CIERRE) : { entran: 0, salen: 0 };
  const veces = cuantoMasLento(a?.demora_mediana_en_horario_min ?? null, a?.demora_mediana_fuera_min ?? null);
  const subregistrado = datos ? datos.subregistro.precio_mencionado > datos.subregistro.cotizados : false;

  return (
    // Angosto, el panel toma su alto y la vista hace scroll (`disposicion.ts`, #968).
    <div className={raizDePanel + (actualizando ? ' opacity-60' : '')}>
      <TiraCatorceDias series={series} cargando={cargandoSeries} />

      {/* ═══ 1 · LA ATENCIÓN ═══ */}
      {/* Una columna en el teléfono, dos en sm y las tres de siempre desde md (#968): con las tres
          fijas, a 390 px las columnas quedaban en 190 · 190 · 28 px y la cobertura, fuera. */}
      <section aria-label="La atención" className={`${tarjetasAngostas} md:grid-cols-[minmax(190px,0.85fr)_minmax(190px,0.85fr)_2.4fr]`}>
        {/* 1A · La cifra héroe: la única de la vista. */}
        <article className="rounded-2xl bg-card p-3.5 shadow-panel">
          <h3 className={sectionLabel}>Esperan respuesta</h3>
          {cargando ? (
            <div className="mt-2 h-12 w-24 animate-pulse rounded-lg bg-muted" />
          ) : (
            <>
              <p className="mt-1 flex items-center gap-2">
                {/* El oro no puede ser el número: #CAA106 sobre blanco da 2,44:1 y no
                    llega ni al mínimo de texto grande. Va como punto —una marca, no
                    tinta— y el número lleva la tinta de la casa. */}
                <span className="size-2 shrink-0 rounded-full bg-gold-ink" />
                <span className="font-heading text-[44px] font-bold leading-none text-foreground">{a?.esperan ?? 0}</span>
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                de <span className="font-mono tabular-nums text-foreground">{a?.conversaciones ?? 0}</span> conversaciones
                que empezaron en el período. La última palabra es de la persona.
              </p>
              <dl className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
                  <dt className="text-muted-foreground">Jamás respondidas</dt>
                  <dd className="ml-auto font-mono tabular-nums text-foreground">
                    {a?.nunca_respondidos ?? 0}{' '}
                    <span className="text-muted-foreground">({pct(a?.nunca_respondidos ?? 0, a?.conversaciones ?? 0)}%)</span>
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  <dt className="text-muted-foreground">Sin atender hace +24 h</dt>
                  <dd className="ml-auto font-mono tabular-nums text-foreground">{a?.sin_atender_24h ?? 0}</dd>
                </div>
              </dl>
            </>
          )}
        </article>

        {/* 1B · Las dos medianas. Dos barras del MISMO color: la diferencia la
            dice el largo, no el tono — pintar la mala de rojo sería codificar
            dos veces lo que la longitud ya muestra. */}
        <article className="flex flex-col rounded-2xl bg-card p-3.5 shadow-panel">
          <h3 className={sectionLabel}>Primera respuesta</h3>
          {cargando ? (
            <div className="mt-3 space-y-3">
              <div className="h-6 animate-pulse rounded bg-muted" />
              <div className="h-6 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <>
              <div className="mt-2 flex flex-col gap-2.5">
                {[
                  { label: `En horario (${HORA_APERTURA}–${HORA_CIERRE} h)`, min: a?.demora_mediana_en_horario_min ?? null },
                  { label: 'Fuera de horario', min: a?.demora_mediana_fuera_min ?? null },
                ].map((d, i, todos) => {
                  const max = Math.max(1, ...todos.map((t) => t.min ?? 0));
                  return (
                    <div key={d.label}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[11px] text-muted-foreground">{d.label}</span>
                        <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">
                          {formatearDemora(d.min)}
                        </span>
                      </div>
                      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(d.min ? 3 : 0, ((d.min ?? 0) / max) * 100)}%` }}
                          aria-hidden="true"
                        />
                      </span>
                      {i === 0 && <span className="sr-only">mediana</span>}
                    </div>
                  );
                })}
              </div>
              {/* El remate: dos medianas son dos datos; «50× más lento» es una decisión. */}
              {veces !== null && (
                <p className="mt-3 text-xs leading-snug text-foreground">
                  <span className="font-heading text-xl font-bold tabular-nums">{veces}×</span> más lento cuando la persona
                  escribe de noche.
                </p>
              )}
              <p className="mt-auto border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-mono tabular-nums text-foreground">
                  {pct(a?.llegaron_fuera_de_horario ?? 0, a?.conversaciones ?? 0)}%
                </span>{' '}
                de los leads llega cuando no hay nadie ({a?.llegaron_fuera_de_horario ?? 0} de {a?.conversaciones ?? 0}).
              </p>
            </>
          )}
        </article>

        {/* 1C · La cobertura horaria: el gráfico que explica las dos medianas. */}
        <article className={`flex min-w-0 flex-col rounded-2xl bg-card p-3.5 shadow-panel ${terceraTarjetaAngosta}`}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className={sectionLabel}>Cobertura horaria</h3>
            {!cargando && (
              <span className="truncate font-mono text-[10px] tabular-nums text-muted-foreground">
                fuera de horario: {hueco.entran} entran · {hueco.salen} salen
              </span>
            )}
          </div>
          {cargando ? (
            <div className="mt-2 flex h-32 items-end gap-1">
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className="min-w-0 flex-1 animate-pulse rounded-t bg-muted" style={{ height: `${20 + ((i * 37) % 70)}%` }} />
              ))}
            </div>
          ) : (
            <div className="mt-1.5 flex min-h-0 flex-1 flex-col">
              <LineasHora puntos={a?.cobertura ?? []} apertura={HORA_APERTURA} cierre={HORA_CIERRE} alto={120} />
            </div>
          )}
        </article>
      </section>

      {/* ═══ 1b · POR QUÉ SE PIERDEN (ADR 0107) ═══
          Antes de la tabla porque cuenta la MISMA cohorte, y son a lo sumo seis chips. */}
      <PorQueSePierden perdidas={datos?.perdidas} llegaron={a?.conversaciones ?? 0} />

      {/* ═══ 2 · LA TABLA DEL NEGOCIO ═══ */}
      <section aria-label={textos.titulo} className="flex min-h-0 flex-1 flex-col rounded-2xl bg-card shadow-panel">
        <header className="shrink-0 border-b border-border px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="font-heading text-sm font-bold text-navy-ink">{textos.titulo}</h3>
            <div className="flex items-center gap-3">
              {ESTADOS.map((e) => (
                <span key={e.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground" title={e.ayuda}>
                  <span className={'size-2 shrink-0 rounded-[2px] ' + e.color} />
                  {e.label}
                </span>
              ))}
            </div>
          </div>

          {/* HONESTIDAD DEL DATO — arriba, no en una nota al pie que nadie lee. */}
          {!cargando && datos && (
            <div className="mt-1 flex flex-col gap-0.5">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {textos.ayuda}{' '}
                {datos.sin_atribuir > 0 && (
                  <>
                    <span className="font-mono tabular-nums text-foreground">{datos.sin_atribuir}</span> de{' '}
                    <span className="font-mono tabular-nums text-foreground">{a?.conversaciones ?? 0}</span> conversaciones (
                    {pct(datos.sin_atribuir, a?.conversaciones ?? 0)}%) no se pudieron atribuir — van en su propia fila, no
                    repartidas.
                  </>
                )}
              </p>
              {subregistrado && (
                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-warning-foreground">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0 text-warning" />
                  <span>
                    <span className="font-mono tabular-nums">{datos.subregistro.cotizados}</span> asentadas a mano contra{' '}
                    <span className="font-mono tabular-nums">{datos.subregistro.precio_mencionado}</span> conversaciones donde
                    se mencionó un precio: la compuerta de «{ETAPA_ROTULO.cotizado.varios}» pide tipear el interés a mano, así
                    que esta columna está <b>subregistrada</b>. Lo de la derecha es una estimación por el texto, no una
                    cotización asentada.
                  </span>
                </p>
              )}
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {cargando ? (
            <div className="p-4">
              {['w-1/3', 'w-2/5', 'w-1/4', 'w-1/2', 'w-1/3'].map((w, i) => (
                <div key={i} className="mb-2.5 flex items-center gap-3">
                  <div className={'h-3 animate-pulse rounded bg-muted ' + w} />
                  <div className="ml-auto h-2 w-32 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : filas.length === 0 ? (
            <p className="px-6 py-14 text-center text-xs leading-relaxed text-muted-foreground">
              Nadie escribió por primera vez en este período. Prueba con una ventana más larga.
            </p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border text-[11px] text-muted-foreground">
                  <th scope="col" className="px-4 py-1.5 text-left font-medium">
                    {textos.columna}
                  </th>
                  <th scope="col" className="w-36 px-2 py-1.5 text-left font-medium">
                    Cómo quedaron
                  </th>
                  {(
                    [
                      ['llegaron', 'Llegaron', 'w-20'],
                      ['esperan', 'Esperan', 'w-20'],
                      ['nunca_respondidos', 'Jamás', 'w-20'],
                      ['demora_mediana_min', '1ª resp.', 'w-28 min-w-[100px]'],
                    ] as const
                  ).map(([col, label, ancho]) => (
                    <Encabezado key={col} col={col} label={label} orden={orden} onOrden={setOrden} ancho={ancho} />
                  ))}
                  <th scope="col" className="w-24 px-2 py-1.5 text-right font-medium whitespace-nowrap" title="Estimado por el texto del chat">
                    Precio dicho
                  </th>
                  {/* Las dos últimas SON las etapas del embudo (`etapa_efectiva`
                      'cotizado' y 'cierre'), así que van por el rótulo canónico:
                      con un nombre propio acá, la misma conversación se llamaba
                      de dos formas según la pantalla (ADR 0049).
                      ⚠️ «Precio dicho» NO es lo mismo y por eso conviven: cuenta
                      a todos los que recibieron un precio, incluidos los envíos
                      masivos; ésta pide además que la persona haya hablado. La
                      diferencia entre las dos columnas ES el hallazgo de ADR 0044. */}
                  <th
                    scope="col"
                    className="w-28 px-2 py-1.5 text-right font-medium whitespace-nowrap"
                    title="Recibieron el precio Y además hablaron — «Precio dicho» no exige lo segundo"
                  >
                    {ETAPA_ROTULO.cotizado.varios}
                  </th>
                  <Encabezado
                    col="cerrados"
                    label={ETAPA_ROTULO.cierre.varios}
                    orden={orden}
                    onOrden={setOrden}
                    ancho="w-24"
                  />
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const id = `${f.clave ?? 'sin'}-${f.ad_id ?? ''}`;
                  const celdas = desglosePorFila.get(f.clave ?? '') ?? [];
                  return (
                    <Fila
                      key={id}
                      fila={f}
                      sinAtribuir={textos.sinAtribuir}
                      celdas={celdas}
                      rotuloDetalle={textos.detalle}
                      sinDetalle={textos.sinDetalle}
                      abierta={abierta === id}
                      onAbrir={() => setAbierta((v) => (v === id ? null : id))}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function Encabezado({
  col,
  label,
  orden,
  onOrden,
  ancho,
}: {
  col: Columna;
  label: string;
  orden: Columna;
  onOrden: (c: Columna) => void;
  ancho: string;
}) {
  const activo = orden === col;
  return (
    <th scope="col" className={ancho + ' px-2 py-1.5 text-right font-medium whitespace-nowrap'} aria-sort={activo ? 'descending' : 'none'}>
      <button
        type="button"
        onClick={() => onOrden(col)}
        className={
          'rounded px-1 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
          (activo ? 'font-bold text-navy-ink' : 'hover:text-foreground')
        }
      >
        {label}
        {activo && ' ↓'}
      </button>
    </th>
  );
}

/** De dónde salió el nombre de la campaña, en palabras — ver `FuenteCampana`. */
const ROTULO_FUENTE_CAMPANA: Record<NonNullable<FilaNegocio['fuente_campana']>, string> = {
  ruteo: 'del ruteo (la tabla que decide a quién le cae el lead)',
  resuelto: 'del caché que resuelve el nombre del anuncio',
  formulario: 'de lo que Meta mandó con el formulario',
};

function Fila({
  fila,
  sinAtribuir,
  celdas,
  rotuloDetalle,
  sinDetalle,
  abierta,
  onAbrir,
}: {
  fila: FilaNegocio;
  sinAtribuir: string;
  /** El cruce de ESTA fila con la otra dimensión. Vacío = no hay nada que abrir. */
  celdas: CeldaDelDesglose[];
  rotuloDetalle: string;
  sinDetalle: string;
  abierta: boolean;
  onAbrir: () => void;
}) {
  const b = bucketsDeFila(fila);
  const anonima = fila.clave === null;
  // Con una sola celda el detalle no dice nada nuevo: sería la misma fila
  // repetida un renglón más abajo. Ahí no se ofrece abrir.
  const sePuedeAbrir = celdas.length > 1;

  return (
    <>
      <tr className="border-b border-border/70 last:border-b-0 hover:bg-accent">
        <th scope="row" className="max-w-0 px-4 py-1.5 text-left font-medium">
          <span className="flex items-center gap-1">
            {/* El disparador es un botón de verdad y no la fila entera: la fila
                tiene ocho celdas de números que se seleccionan para copiar, y
                hacerla clickeable entera convierte cada intento de copiar en un
                despliegue. */}
            {sePuedeAbrir ? (
              <button
                type="button"
                onClick={onAbrir}
                aria-expanded={abierta}
                title={`Ver por ${rotuloDetalle.toLowerCase()}`}
                className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-navy-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              >
                <ChevronDown
                  size={12}
                  className={'transition-transform duration-200 ease-house ' + (abierta ? 'rotate-0' : '-rotate-90')}
                />
              </button>
            ) : (
              <span className="size-[13px] shrink-0" aria-hidden="true" />
            )}
            <span
              className={'block truncate ' + (anonima ? 'italic text-muted-foreground' : 'text-foreground')}
              title={
                fila.fuente_campana
                  ? `${fila.clave} — el nombre sale ${ROTULO_FUENTE_CAMPANA[fila.fuente_campana]}`
                  : (fila.clave ?? sinAtribuir)
              }
            >
              {fila.clave ?? sinAtribuir}
            </span>
          </span>
          {fila.ad_id && <span className="block truncate pl-[18px] font-mono text-[10px] text-muted-foreground">{fila.ad_id}</span>}
        </th>
        <td className="px-2 py-1.5">
          <BarraSegmentada
            segmentos={ESTADOS.map((e) => ({ id: e.id, n: b[e.id], color: e.color, label: e.label }))}
          />
        </td>
        <td className="px-2 py-1.5 text-right font-mono font-semibold tabular-nums text-foreground">{fila.llegaron}</td>
        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">{fila.esperan}</td>
        <td className={'px-2 py-1.5 text-right font-mono tabular-nums ' + (fila.nunca_respondidos > 0 ? 'text-destructive' : 'text-muted-foreground')}>
          {fila.nunca_respondidos}
        </td>
        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground whitespace-nowrap">{formatearDemora(fila.demora_mediana_min)}</td>
        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">{fila.precio_mencionado}</td>
        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">{fila.cotizados}</td>
        <td className={'px-2 py-1.5 text-right font-mono tabular-nums ' + (fila.cerrados > 0 ? 'font-bold text-success' : 'text-muted-foreground')}>
          {fila.cerrados}
        </td>
      </tr>

      {abierta &&
        celdas.map((c) => {
          const bc = bucketsDeFila({
            llegaron: c.llegaron,
            esperan: c.esperan,
            nunca_respondidos: c.nunca_respondidos,
          });
          return (
            <tr key={`${c.fila ?? ''}-${c.parte ?? 'sin'}`} className="border-b border-border/70 bg-muted/40 text-[11px]">
              {/* La sangría dice de quién es este renglón sin repetir el nombre
                  de la fila: se lee como una lista adentro de su celda. */}
              <th scope="row" className="max-w-0 py-1 pl-9 pr-4 text-left font-normal">
                <span
                  className={'block truncate ' + (c.parte === null ? 'italic text-muted-foreground' : 'text-foreground')}
                  title={c.parte ?? sinDetalle}
                >
                  {c.parte ?? sinDetalle}
                </span>
              </th>
              <td className="px-2 py-1">
                <BarraSegmentada
                  segmentos={ESTADOS.map((e) => ({ id: e.id, n: bc[e.id], color: e.color, label: e.label }))}
                />
              </td>
              <td className="px-2 py-1 text-right font-mono tabular-nums text-foreground">{c.llegaron}</td>
              <td className="px-2 py-1 text-right font-mono tabular-nums text-foreground">{c.esperan}</td>
              <td className={'px-2 py-1 text-right font-mono tabular-nums ' + (c.nunca_respondidos > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                {c.nunca_respondidos}
              </td>
              {/* 🔴 La mediana del detalle NO se hereda ni se prorratea: la
                  recalcula el server por celda. Una mediana repartida entre
                  subgrupos es un número inventado. */}
              <td className="px-2 py-1 text-right font-mono tabular-nums text-foreground whitespace-nowrap">
                {formatearDemora(c.demora_mediana_min)}
              </td>
              {/* «Precio dicho» y «Cotizados» no viajan en el cruce: el detalle
                  contesta quién atiende y cuánto tarda, no el subregistro. Van
                  vacías en vez de en cero — un cero acá sería un dato falso. */}
              <td className="px-2 py-1 text-right text-muted-foreground">·</td>
              <td className="px-2 py-1 text-right text-muted-foreground">·</td>
              <td className={'px-2 py-1 text-right font-mono tabular-nums ' + (c.cerrados > 0 ? 'font-bold text-success' : 'text-muted-foreground')}>
                {c.cerrados}
              </td>
            </tr>
          );
        })}
    </>
  );
}
