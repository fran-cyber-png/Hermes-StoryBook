import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FileText,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Search,
  SlidersHorizontal,
  Timer,
  X,
} from 'lucide-react';
import { cardClass, sectionLabel } from '../../lib/styles';
import { usePopover } from '../../lib/teclado/usePopover';
import { DetalleLlamada } from './DetalleLlamada';
import {
  LeyendaResultadoLlamadas,
  LlamadasPorHora,
  LlamadasPorMes,
  RendimientoDeLlamadas,
  ResultadoDeLlamadas,
  TendenciaDeResultado,
  type GranularidadRendimiento,
} from './GraficosLlamadas';
import { comoFiltroDeFechas, RANGO_INICIAL, type IdPreset, type RangoFechas } from './rangoFechas';
import {
  comoDuracion,
  comoFechaHora,
  comoReloj,
  COLOR_RESULTADO,
  FILTROS_VACIOS,
  porcentajeDe,
  POR_PAGINA,
  ROTULO_RESULTADO,
  useRegistroDeLlamadas,
  type FilaLlamada,
  type FiltrosRegistro,
  type ResultadoLlamada,
} from './registro';
import { SelectorRangoFechas } from './SelectorRangoFechas';

/**
 * LLAMADAS — el registro de la línea vinculada por QR.
 *
 * Qué contesta esta pantalla, en este orden: cuántas llamadas hubo y cuántas
 * conectaron (la fila de arriba), a qué hora conviene llamar (el área), en qué
 * se van las que no conectan (la dona) y qué pasó con UNA llamada puntual (la
 * tabla). El modal de Detalle es la misma pregunta estirada en meses.
 *
 * 🔴 **NINGÚN número de esta pantalla se calcula acá.** Los cinco de la cabecera
 * y las series de los gráficos vienen ya sumados del server, sobre el rango
 * ENTERO. La tabla, en cambio, es UNA página de 50. Contar sobre `filas` daría
 * un número más chico y creíble — que es la peor clase de número equivocado.
 *
 * ⚠️ **La fuente es la línea del QR (`wa_call_log`), no la Cloud API.** Son dos
 * números distintos; el registro de la Cloud API vive aparte y se ve en el
 * timeline de la conversación (`useLlamadas.ts`). Cuando se unan, la tabla va a
 * necesitar una columna que diga de cuál vino.
 */

/**
 * De ese mismo rango a la granularidad del gráfico «Rendimiento de llamadas»
 * del modal — sin un selector propio: el rango de arriba YA dice qué tan de
 * cerca se está mirando, y el gráfico solo sigue esa misma decisión.
 *
 * Los presets cortos (`hoy`/`7 días`) entran en el tope diario del server
 * (`RANGO_DIARIO_MAX_DIAS` en `consultarRegistro.ts`), así que ahí hay días
 * de sobra para dibujar. `30 días` (y un mes elegido a mano, que dura lo
 * mismo) cruza semanas ISO completas — partirlo por mes dejaría dos barras
 * huérfanas y la semana lo cuenta mejor. `8m`/`todo` siguen en mes: una
 * semana por cada una de las últimas ~35 no cabe en un gráfico que se lee de
 * un vistazo. Un día puntual va directo a día; un rango a mano (el calendario
 * libre) mide su propio ancho porque no viene con una etiqueta que lo diga.
 */
const GRANULARIDAD_POR_PRESET: Record<IdPreset, GranularidadRendimiento> = {
  hoy: 'dia',
  '7': 'dia',
  '30': 'semana',
  '8m': 'mes',
  todo: 'mes',
};

/** Sobre esto, un rango a mano ya cuenta la misma historia con menos barras. */
const RANGO_A_MANO_DIA_MAX_DIAS = 9;
const RANGO_A_MANO_SEMANA_MAX_DIAS = 90;

function granularidadDe(rango: RangoFechas): GranularidadRendimiento {
  switch (rango.tipo) {
    case 'preset':
      return GRANULARIDAD_POR_PRESET[rango.id];
    case 'dia':
      return 'dia';
    case 'mes':
      return 'semana';
    case 'rango': {
      const dias = (rango.hasta.getTime() - rango.desde.getTime()) / 86_400_000;
      if (dias <= RANGO_A_MANO_DIA_MAX_DIAS) return 'dia';
      if (dias <= RANGO_A_MANO_SEMANA_MAX_DIAS) return 'semana';
      return 'mes';
    }
  }
}

const ETIQUETA_GRANULARIDAD: Record<GranularidadRendimiento, string> = {
  dia: 'día a día',
  semana: 'semana a semana',
  mes: 'mes a mes',
};

export function VistaLlamadas({ miVendedoraId }: { miVendedoraId: string }) {
  const [rango, setRango] = useState<RangoFechas>(RANGO_INICIAL);
  const [filtros, setFiltros] = useState<FiltrosRegistro>(FILTROS_VACIOS);
  const [busqueda, setBusqueda] = useState('');
  const [verFiltros, setVerFiltros] = useState(false);
  const [verDetalle, setVerDetalle] = useState(false);
  /** La fila cuyo «Ver contenido» está abierto — null = ningún detalle abierto. */
  const [contenido, setContenido] = useState<FilaLlamada | null>(null);

  const consulta = useMemo<FiltrosRegistro>(
    () => ({ ...filtros, q: busqueda, ...comoFiltroDeFechas(rango) }),
    [filtros, busqueda, rango],
  );

  const { data, isPending, isError, error, refetch } = useRegistroDeLlamadas(consulta);

  const totales = data?.totales;
  const resumenPorHora = useMemo(() => resumenDeHoras(data?.porHora ?? []), [data?.porHora]);
  const pagina = filtros.pagina ?? 1;
  const desdeFila = (pagina - 1) * POR_PAGINA;
  const hastaFila = desdeFila + (data?.filas.length ?? 0);
  const hayMas = hastaFila < (data?.cuantas ?? 0);

  /** Cambiar cualquier filtro vuelve a la página 1 — quedarse en la 7 de un
      resultado que ahora tiene 2 páginas muestra una tabla vacía sin explicar
      por qué. */
  const cambiar = (parcial: Partial<FiltrosRegistro>) =>
    setFiltros((f) => ({ ...f, ...parcial, pagina: 1 }));

  /**
   * La serie diaria SOLO existe cuando el server la calculó (rango corto — ver
   * el 🔴 de `consultarRegistro.ts`). Con un rango largo `porDia` viene vacío
   * a propósito, y ahí el minigráfico cae al mes: sin este `??`, elegir
   * "Últimos 7 días" mostraría el mes entero y el punto de arriba sobre
   * `RANGO_DIARIO_MAX_DIAS` volvería a mostrar nada.
   */
  const serieTendencia = data && data.porDia.length >= 2 ? data.porDia : (data?.porMes ?? []);
  const tendencia = (campo: 'conectadas' | 'noConectadas', color: string) =>
    isPending ? undefined : (
      <TendenciaDeResultado valores={serieTendencia.map((s) => s[campo])} color={color} />
    );

  if (isError) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-xs font-medium text-foreground">No se pudo leer el registro de llamadas</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {error instanceof Error ? error.message : 'El servidor no respondió.'}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background px-5 py-4">
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-bold text-navy-ink">Registro de llamadas</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Consulta y analiza el historial de llamadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setVerFiltros((v) => !v)}
            aria-pressed={verFiltros}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            <SlidersHorizontal size={13} /> Filtros
          </button>

          <button
            type="button"
            onClick={() => setVerDetalle(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ChartNoAxesCombined size={13} /> Detalle
          </button>
        </div>
      </div>

      {verFiltros && (
        <Filtros
          filtros={filtros}
          onCambiar={cambiar}
          rango={rango}
          onCambiarRango={(r) => {
            setRango(r);
            setFiltros((f) => ({ ...f, pagina: 1 }));
          }}
          onLimpiar={() => {
            setFiltros(FILTROS_VACIOS);
            setBusqueda('');
            setRango(RANGO_INICIAL);
          }}
        />
      )}

      {/* ── Los cinco números ────────────────────────────────────────────── */}
      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Tarjeta
          icono={<PhoneCall size={15} />}
          tinte="var(--primary)"
          titulo="Total llamadas"
          valor={isPending ? null : String(totales?.total ?? 0)}
          pie={
            totales && totales.total > 0 ? '100% del total' : 'Sin llamadas en este rango'
          }
        />
        <Tarjeta
          icono={<PhoneIncoming size={15} />}
          tinte={COLOR_RESULTADO.conectada}
          titulo="Llamadas conectadas"
          valor={isPending ? null : String(totales?.conectadas ?? 0)}
          pie={pieDePorcentaje(totales?.conectadas, totales?.total)}
          grafico={tendencia('conectadas', COLOR_RESULTADO.conectada)}
        />
        <Tarjeta
          icono={<PhoneMissed size={15} />}
          tinte={COLOR_RESULTADO.no_conectada}
          titulo="Llamadas no conectadas"
          valor={isPending ? null : String(totales?.noConectadas ?? 0)}
          pie={pieDePorcentaje(totales?.noConectadas, totales?.total)}
          grafico={tendencia('noConectadas', COLOR_RESULTADO.no_conectada)}
        />
        <Tarjeta
          icono={<Timer size={15} />}
          tinte="var(--primary)"
          titulo="Duración total"
          valor={isPending ? null : comoReloj(totales?.duracionTotal ?? null)}
          pie="Solo las conectadas"
        />
        <Tarjeta
          icono={<Timer size={15} />}
          tinte="var(--gold-ink)"
          titulo="Duración promedio"
          valor={isPending ? null : comoReloj(totales?.duracionPromedio)}
          pie="Por llamada conectada"
        />
      </div>

      {/* ── Los dos gráficos ─────────────────────────────────────────────── */}
      <div className="mb-3 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <section className={cardClass}>
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h3 className="font-heading text-xs font-bold text-navy-ink">Llamadas por hora</h3>
            <span className={sectionLabel}>Por hora del día</span>
          </header>
          <div className="px-2 py-2">
            {isPending ? <Esqueleto /> : <LlamadasPorHora porHora={data?.porHora ?? []} />}
          </div>
          {!isPending && resumenPorHora && <TablaResumenPorHora resumen={resumenPorHora} />}
        </section>

        <section className={cardClass}>
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h3 className="font-heading text-xs font-bold text-navy-ink">Resultado de llamadas</h3>
          </header>
          {/* `py-2`, no `py-3`: el mismo padding vertical que el contenedor del
              gráfico de «Llamadas por hora» — si no, el separador de abajo
              queda 8px más abajo que el de al lado. */}
          <div className="px-4 py-2">
            {isPending || !totales ? <Esqueleto /> : <ResultadoDeLlamadas totales={totales} />}
          </div>
          {!isPending && totales && <LeyendaResultadoLlamadas totales={totales} />}
        </section>
      </div>

      {/* ── La tabla ─────────────────────────────────────────────────────── */}
      <section className={cardClass}>
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <h3 className="font-heading text-xs font-bold text-navy-ink">Historial de llamadas</h3>
          <div className="relative">
            <Search
              size={13}
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setFiltros((f) => ({ ...f, pagina: 1 }));
              }}
              placeholder="Buscar por nombre o número…"
              className="h-8 w-56 rounded-lg border border-border bg-muted pl-7 pr-3 text-[11px] outline-none focus:border-primary"
            />
          </div>
        </header>

        {isPending ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : (data?.filas.length ?? 0) === 0 ? (
          <p className="px-4 py-14 text-center text-[11px] text-muted-foreground">
            Aún no hay llamadas registradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <Th>Fecha / hora</Th>
                  <Th>Contacto</Th>
                  <Th>Número</Th>
                  <Th>Dirección</Th>
                  <Th>Duración</Th>
                  <Th>Resultado</Th>
                  <Th>Contenido</Th>
                </tr>
              </thead>
              <tbody>
                {data?.filas.map((f) => (
                  <Fila key={f.id} fila={f} onVerContenido={() => setContenido(f)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          <span>
            Mostrando {data ? Math.min(desdeFila + 1, data.cuantas) : 0}–{hastaFila} de{' '}
            {data?.cuantas ?? 0} registros
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Página anterior"
              disabled={pagina <= 1}
              onClick={() => setFiltros((f) => ({ ...f, pagina: Math.max(1, pagina - 1) }))}
              className="rounded-md border border-border p-1 transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              type="button"
              aria-label="Página siguiente"
              disabled={!hayMas}
              onClick={() => setFiltros((f) => ({ ...f, pagina: pagina + 1 }))}
              className="rounded-md border border-border p-1 transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight size={13} />
            </button>
          </span>
        </footer>
      </section>

      {verDetalle && data && (
        <ModalDetalle registro={data} rango={rango} onCerrar={() => setVerDetalle(false)} />
      )}
      {contenido && (
        <DetalleLlamada fila={contenido} miVendedoraId={miVendedoraId} onCerrar={() => setContenido(null)} />
      )}
    </div>
  );
}

/** El pie de una tarjeta: el porcentaje, o el aviso de que no hay nada que medir. */
function pieDePorcentaje(parte: number | undefined, total: number | undefined): string {
  const pct = porcentajeDe(parte ?? 0, total ?? 0);
  return pct == null ? '—' : `${pct}% del total`;
}

function Esqueleto() {
  return <div className="h-[260px] animate-pulse rounded-lg bg-muted" />;
}

type ResumenDeHoras = {
  total: number;
  horaPico: string;
  maximoPorHora: number;
  promedioPorHora: number;
  horarioActivo: string;
};

/**
 * Los cinco números que explican el área de arriba en palabras.
 *
 * `null` cuando no hay ninguna hora con llamadas: ahí el área ya dice «Sin
 * llamadas en este rango», y una fila de ceros al lado no suma nada.
 *
 * ⚠️ El promedio se divide por las horas CON llamadas, no por el ancho del
 * `horarioActivo`: ese rango es primera-a-última hora activa, así que puede
 * tener huecos en cero adentro que no cuentan como «hora trabajada».
 */
function resumenDeHoras(porHora: number[]): ResumenDeHoras | null {
  const activas = porHora.flatMap((n, h) => (n > 0 ? [h] : []));
  if (activas.length === 0) return null;

  const total = porHora.reduce((suma, n) => suma + n, 0);
  const maximoPorHora = Math.max(...porHora);
  const comoHora = (h: number) => `${String(h).padStart(2, '0')}:00`;

  return {
    total,
    horaPico: comoHora(porHora.indexOf(maximoPorHora)),
    maximoPorHora,
    promedioPorHora: total / activas.length,
    horarioActivo: `${comoHora(activas[0])} – ${comoHora(activas[activas.length - 1])}`,
  };
}

function TablaResumenPorHora({ resumen }: { resumen: ResumenDeHoras }) {
  const filas: { icono: string; titulo: string; valor: string }[] = [
    { icono: '📞', titulo: 'Total de llamadas', valor: String(resumen.total) },
    { icono: '📈', titulo: 'Hora pico', valor: resumen.horaPico },
    {
      icono: '🔥',
      titulo: 'Máximo por hora',
      valor: `${resumen.maximoPorHora} ${resumen.maximoPorHora === 1 ? 'llamada' : 'llamadas'}`,
    },
    { icono: '⏱️', titulo: 'Promedio por hora', valor: resumen.promedioPorHora.toFixed(1) },
    { icono: '🕐', titulo: 'Horario activo', valor: resumen.horarioActivo },
  ];

  return (
    <ul className="grid grid-cols-5 divide-x divide-border border-t border-border">
      {filas.map((f) => (
        <li key={f.titulo} className="flex flex-col items-center gap-1 px-2 py-3 text-center">
          <span aria-hidden className="text-base leading-none">
            {f.icono}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">{f.titulo}</span>
          <span className="font-heading text-sm font-bold tabular-nums text-navy-ink">{f.valor}</span>
        </li>
      ))}
    </ul>
  );
}

function Th({ children }: { children: string }) {
  return <th className="px-4 py-2 font-semibold">{children}</th>;
}

function Tarjeta({
  icono,
  tinte,
  titulo,
  valor,
  pie,
  grafico,
}: {
  icono: React.ReactNode;
  tinte: string;
  titulo: string;
  valor: string | null;
  pie: string;
  grafico?: React.ReactNode;
}) {
  return (
    <div className={`${cardClass} flex items-center gap-3 px-4 py-3`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: `color-mix(in srgb, ${tinte} 14%, transparent)`, color: tinte }}
          >
            {icono}
          </span>
          <span className={sectionLabel}>{titulo}</span>
        </div>
        {valor == null ? (
          <div className="mt-2 h-7 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <p className="mt-1.5 font-heading text-xl font-bold tabular-nums text-navy-ink">{valor}</p>
        )}
        <p className="mt-0.5 text-[10px] text-muted-foreground">{pie}</p>
      </div>
      {/* Centrado contra la altura ENTERA de la card, no contra la fila del
          título: por eso vive afuera de esa fila y no adentro con `ml-auto`. */}
      {grafico && <div className="shrink-0">{grafico}</div>}
    </div>
  );
}

function Fila({ fila, onVerContenido }: { fila: FilaLlamada; onVerContenido: () => void }) {
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/50">
      <td className="px-4 py-2 text-muted-foreground">{comoFechaHora(fila.cuando)}</td>
      <td className="px-4 py-2 font-medium text-foreground">
        {/* Un número que todavía no está en el padrón NO se esconde: se muestra
            como «Sin registrar», que es información — hay alguien llamando que
            nadie dio de alta. */}
        {fila.contacto ?? <span className="italic text-muted-foreground">Sin registrar</span>}
      </td>
      <td className="px-4 py-2 tabular-nums text-muted-foreground">{fila.telefono}</td>
      <td className="px-4 py-2">
        <span className="flex items-center gap-1 text-muted-foreground">
          {fila.entrante ? <PhoneIncoming size={12} /> : <PhoneOutgoing size={12} />}
          {fila.entrante ? 'Entrante' : 'Saliente'}
          {fila.video && <span className="text-[10px] uppercase text-muted-foreground">· video</span>}
        </span>
      </td>
      {/* La columna Agente se quitó de la vista a propósito (queda solo para
          métricas futuras vía el CSV y la base): ver `registro.ts`. */}
      <td className="px-4 py-2 tabular-nums text-muted-foreground">{comoDuracion(fila.duracion)}</td>
      <td className="px-4 py-2">
        <span
          className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: `color-mix(in srgb, ${COLOR_RESULTADO[fila.resultado]} 14%, transparent)`,
            color: COLOR_RESULTADO[fila.resultado],
          }}
          title={`Estado de WhatsApp: ${fila.estado || 'sin dato'}`}
        >
          {ROTULO_RESULTADO[fila.resultado]}
        </span>
      </td>
      <td className="px-4 py-2">
        <button
          type="button"
          onClick={onVerContenido}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:underline"
        >
          <FileText size={12} /> Ver contenido
        </button>
      </td>
    </tr>
  );
}

const RESULTADOS: ResultadoLlamada[] = ['conectada', 'no_conectada', 'cancelada', 'desconocido'];

function Filtros({
  filtros,
  onCambiar,
  rango,
  onCambiarRango,
  onLimpiar,
}: {
  filtros: FiltrosRegistro;
  onCambiar: (parcial: Partial<FiltrosRegistro>) => void;
  rango: RangoFechas;
  onCambiarRango: (r: RangoFechas) => void;
  onLimpiar: () => void;
}) {
  return (
    // Sin `overflow-hidden` (a diferencia de `cardClass`): el calendario de
    // fecha se abre en un popover ABSOLUTO que cuelga por debajo de esta barra,
    // y con las esquinas redondeadas por `overflow-hidden` el popover se
    // recortaba a la mitad en vez de flotar encima del contenido de abajo.
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5">
      <span className="flex items-center gap-1">
        <CircleCheck size={13} className="text-muted-foreground" />
        <span className={sectionLabel}>Resultado</span>
      </span>
      <select
        value={filtros.resultado ?? ''}
        onChange={(e) => onCambiar({ resultado: (e.target.value || undefined) as ResultadoLlamada })}
        className="h-8 rounded-lg border border-border bg-muted px-2 text-[11px] outline-none focus:border-primary"
      >
        <option value="">Todos</option>
        {RESULTADOS.map((r) => (
          <option key={r} value={r}>
            {ROTULO_RESULTADO[r]}
          </option>
        ))}
      </select>

      <span className="ml-2 flex items-center gap-1">
        <ArrowLeftRight size={13} className="text-muted-foreground" />
        <span className={sectionLabel}>Dirección</span>
      </span>
      <select
        value={filtros.direccion ?? ''}
        onChange={(e) =>
          onCambiar({ direccion: (e.target.value || undefined) as 'entrante' | 'saliente' })
        }
        className="h-8 rounded-lg border border-border bg-muted px-2 text-[11px] outline-none focus:border-primary"
      >
        <option value="">Todas</option>
        <option value="entrante">Entrantes</option>
        <option value="saliente">Salientes</option>
      </select>

      <span className="ml-2 flex items-center gap-1">
        <CalendarDays size={13} className="text-muted-foreground" />
        <span className={sectionLabel}>Fecha</span>
      </span>
      <SelectorRangoFechas valor={rango} onCambiar={onCambiarRango} />

      <button
        type="button"
        onClick={onLimpiar}
        className="ml-auto rounded-lg px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-muted"
      >
        Limpiar
      </button>
    </div>
  );
}

function ModalDetalle({
  registro,
  rango,
  onCerrar,
}: {
  registro: {
    porMes: import('./registro').MesDelRegistro[];
    porSemana: import('./registro').SemanaDelRegistro[];
    porDia: import('./registro').DiaDelRegistro[];
  };
  rango: RangoFechas;
  onCerrar: () => void;
}) {
  // Escape y clic afuera cierran, como toda capa de Hermes (ADR 0024): el
  // cableado va por `usePopover` y no por un `onKeyDown` local, que es
  // exactamente el defecto que ese ADR vino a arreglar.
  const { propsOverlay } = usePopover(true, onCerrar, { z: 'z-40' });

  return (
    <>
      <div {...propsOverlay} className={`${propsOverlay.className} bg-navy-ink/30`} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de llamadas"
        className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(56rem,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card shadow-panel"
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <h3 className="font-heading text-sm font-bold text-navy-ink">Detalle</h3>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted"
          >
            <X size={15} />
          </button>
        </header>

        <div className="space-y-6 px-5 py-4">
          <section>
            <h4 className="font-heading text-xs font-bold text-navy-ink">Llamadas por mes</h4>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Cantidad de llamadas por mes en el rango elegido.
            </p>
            <LlamadasPorMes meses={registro.porMes} />
          </section>

          <section>
            <h4 className="font-heading text-xs font-bold text-navy-ink">Rendimiento de llamadas</h4>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Comparativo de conectadas, no conectadas y canceladas — {ETIQUETA_GRANULARIDAD[granularidadDe(rango)]}, según el rango elegido arriba.
            </p>
            <RendimientoDeLlamadas
              granularidad={granularidadDe(rango)}
              dias={registro.porDia}
              semanas={registro.porSemana}
              meses={registro.porMes}
            />
          </section>
        </div>
      </div>
    </>
  );
}
