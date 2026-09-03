import { useMemo } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { useTema } from '../../lib/tema';
import {
  COLOR_RESULTADO,
  comoFechaCorta,
  comoMes,
  porcentajeDe,
  ROTULO_RESULTADO,
  type DiaDelRegistro,
  type MesDelRegistro,
  type SemanaDelRegistro,
  type TotalesLlamadas,
} from './registro';

/**
 * LOS GRÁFICOS DEL REGISTRO — MUI X Charts, aislado en este archivo.
 *
 * ⚠️ **Todo lo de MUI vive acá adentro y no se derrama al resto de Hermes.** El
 * repo es Tailwind puro; MUI trae su propio motor de estilos (emotion) y su
 * propio sistema de tema. Mezclarlos por toda la vista dejaría dos formas de
 * pintar un borde y la siguiente persona no sabría cuál usar. Acá MUI dibuja
 * SVG adentro de una caja, y la caja la sigue haciendo Tailwind.
 *
 * 🔴 **Y por eso la vista viaja PEREZOSA** (`lazy()` en `App.tsx`): MUI +
 * emotion son varios cientos de KB, y el presupuesto de chunks
 * (`npm run presupuesto`) mide el cierre de imports ESTÁTICOS del arranque. Un
 * import normal de esta vista le cobraría ese peso a todo el equipo, incluida la
 * gente que nunca abre Llamadas.
 *
 * ── EL TEMA ─────────────────────────────────────────────────────────────────
 * MUI no sabe nada de `data-theme`, que es lo único que mira el CSS de Hermes
 * (`lib/tema.ts`). Sin este puente los gráficos dibujarían ejes y rótulos en
 * gris oscuro sobre fondo negro — legibles en claro, invisibles en oscuro. El
 * `ThemeProvider` traduce nuestra perilla a la suya, y nada más: los colores de
 * las series siguen saliendo de las variables CSS del tema (`COLOR_RESULTADO`).
 */
function useTemaDeGraficos() {
  const { tema } = useTema();
  return useMemo(
    () =>
      createTheme({
        palette: { mode: tema === 'oscuro' ? 'dark' : 'light' },
        // La fuente se nombra de verdad y no como `'inherit'`: MUI mide el texto
        // de los ejes con este valor para decidir cuántos rótulos entran sin
        // pisarse, y `'inherit'` no es algo que se pueda medir.
        typography: { fontFamily: 'Montserrat, ui-sans-serif, system-ui, sans-serif', fontSize: 11 },
      }),
    [tema],
  );
}

const ALTO = 260;

/**
 * 🔴 EL TOOLTIP SE DIBUJA EN EL `<body>`, NO ADENTRO DEL GRÁFICO.
 *
 * Por defecto MUI lo mete en la capa del propio gráfico
 * (`container: other.container ?? chartsLayerContainerRef.current`), así que
 * hereda el recorte de CUALQUIER ancestro que tenga `overflow`. Y los dos
 * lugares donde viven estos gráficos lo tienen: el modal de Detalle
 * (`overflow-y-auto`, para poder scrollear) y la vista entera.
 *
 * ⚠️ **Y basta con UN eje.** El modal solo pide `overflow-y-auto`, pero el CSS
 * dice que si un eje deja de ser `visible`, el otro se computa como `auto`
 * también — o sea que pedir scroll vertical trae recorte HORIZONTAL de regalo.
 * Por eso el tooltip se cortaba justo contra el borde derecho del modal: la
 * columna de números quedaba afuera y el cuadro parecía romperse al mover el
 * mouse hacia la derecha.
 *
 * `container` va como FUNCIÓN y no como `document.body` pelado: así no se toca
 * el documento al cargar el módulo.
 */
const TOOLTIP_SUELTO = { tooltip: { container: () => document.body } } as const;

/** Sin datos no se dibuja un eje vacío: se dice que no hay nada. */
function Vacio({ children }: { children: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-[11px] text-muted-foreground">
      {children}
    </div>
  );
}

/**
 * LLAMADAS POR HORA DEL DÍA — 24 puntos, siempre.
 *
 * Es un área y no barras a propósito: la pregunta que responde es «¿a qué hora
 * conviene llamar?», o sea la FORMA de la jornada, no cuánto vale cada hora
 * suelta. El área hace ver la meseta de la mañana de un vistazo.
 */
export function LlamadasPorHora({ porHora }: { porHora: number[] }) {
  const tema = useTemaDeGraficos();
  if (porHora.every((n) => n === 0)) return <Vacio>Sin llamadas en este rango.</Vacio>;

  return (
    <ThemeProvider theme={tema}>
      <LineChart
        height={ALTO}
        series={[{ data: porHora, label: 'Llamadas', area: true, color: 'var(--primary)', showMark: false }]}
        xAxis={[
          {
            /**
             * 🔴 **La hora se formatea ACÁ, en el dato, y NUNCA con un
             * `valueFormatter` que devuelva `''` para saltear etiquetas.**
             *
             * MUI decide solo cuáles rótulos entran para que no se pisen, y con
             * 24 horas elige uno de cada dos — los de índice IMPAR. Un formatter
             * del tipo «devuelvo texto en las pares y `''` en las impares»
             * vacía exactamente las que MUI eligió mostrar, y el eje queda con
             * sus marquitas y sin una sola hora escrita. Los `<text>` están en
             * el DOM, con su `fill` blanco y su `font-size` — vacíos. Se ve como
             * un gráfico prolijo al que le falta algo, no como un error, y por
             * eso cuesta una tarde encontrarlo.
             *
             * Si algún día hay que elegir otras horas, se hace con
             * `tickLabelInterval`, no vaciando texto.
             */
            data: porHora.map((_, h) => `${String(h).padStart(2, '0')}:00`),
            scaleType: 'point',
          },
        ]}
        // ⚠️ `bottom` tiene que dejar sitio para las etiquetas del eje: MUI no
        // reserva ese alto solo. Con `bottom: 8` el eje dibujaba sus marquitas y
        // los rótulos quedaban RECORTADOS — un gráfico de horas sin horas, que
        // se ve prolijo y no dice nada.
        margin={{ left: 8, right: 12, top: 12, bottom: 24 }}
        slotProps={TOOLTIP_SUELTO}
        hideLegend
      />
    </ThemeProvider>
  );
}

/**
 * ⚠️ Las categorías con cero NO entran. Una porción de tamaño cero igual reserva
 * su entrada en la leyenda con un «0.0 %» al lado, y eso hace buscar en el
 * gráfico una porción que no existe.
 */
function porcionesDeResultado(totales: TotalesLlamadas) {
  return [
    { key: 'conectada' as const, value: totales.conectadas },
    { key: 'no_conectada' as const, value: totales.noConectadas },
    { key: 'cancelada' as const, value: totales.canceladas },
    { key: 'desconocido' as const, value: totales.desconocidas },
  ].filter((p) => p.value > 0);
}

/**
 * RESULTADO DE LLAMADAS — la dona, con el total en el hueco.
 *
 * La leyenda vive aparte, en `LeyendaResultadoLlamadas`: así el llamador puede
 * ubicarla FUERA del padding de la tarjeta —al ras del borde, igual que
 * `TablaResumenPorHora` en «Llamadas por hora»— en vez de quedar encerrada
 * junto con el gráfico.
 */
export function ResultadoDeLlamadas({ totales }: { totales: TotalesLlamadas }) {
  const tema = useTemaDeGraficos();
  const porciones = porcionesDeResultado(totales);

  if (porciones.length === 0) return <Vacio>Sin llamadas en este rango.</Vacio>;

  return (
    <div className="relative">
      <ThemeProvider theme={tema}>
        <PieChart
          height={ALTO}
          series={[
            {
              innerRadius: 64,
              outerRadius: 100,
              paddingAngle: 1,
              cornerRadius: 3,
              data: porciones.map((p) => ({
                id: p.key,
                value: p.value,
                label: ROTULO_RESULTADO[p.key],
                color: COLOR_RESULTADO[p.key],
              })),
            },
          ]}
          slotProps={TOOLTIP_SUELTO}
          hideLegend
        />
      </ThemeProvider>

      {/* El total, en el hueco de la dona — MUI no tiene un slot para esto,
          así que se superpone a mano centrado sobre el contenedor. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-2xl font-bold text-navy-ink">{totales.total}</span>
        <span className="text-[11px] text-muted-foreground">Total llamadas</span>
      </div>
    </div>
  );
}

/**
 * La leyenda de `ResultadoDeLlamadas`, con el mismo diseño de fila de
 * estadísticas que `TablaResumenPorHora` — un vistazo, no una lista.
 *
 * Se guarda null (nada, ni el borde) cuando no hay ninguna porción: el mismo
 * criterio de `ResultadoDeLlamadas`, para que el borde superior no aparezca
 * solo, sin gráfico arriba ni datos abajo.
 */
export function LeyendaResultadoLlamadas({ totales }: { totales: TotalesLlamadas }) {
  const porciones = porcionesDeResultado(totales);
  if (porciones.length === 0) return null;

  return (
    <ul
      className="grid divide-x divide-border border-t border-border"
      style={{ gridTemplateColumns: `repeat(${porciones.length}, minmax(0, 1fr))` }}
    >
      {porciones.map((p) => {
        const pct = porcentajeDe(p.value, totales.total);
        return (
          <li key={p.key} className="flex flex-col items-center gap-1 px-2 py-3 text-center">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: COLOR_RESULTADO[p.key] }}
            />
            <span className="text-[11px] font-medium text-muted-foreground">{ROTULO_RESULTADO[p.key]}</span>
            <span className="font-heading text-sm font-bold tabular-nums text-navy-ink">
              {pct == null ? '—' : `${pct}%`} ({p.value})
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** LLAMADAS POR MES — las barras del modal de Detalle. */
export function LlamadasPorMes({ meses }: { meses: MesDelRegistro[] }) {
  const tema = useTemaDeGraficos();
  if (meses.length === 0) return <Vacio>Todavía no hay meses con llamadas.</Vacio>;

  return (
    <ThemeProvider theme={tema}>
      <BarChart
        height={280}
        series={[{ data: meses.map((m) => m.total), label: 'Llamadas', color: 'var(--primary)' }]}
        xAxis={[{ data: meses.map((m) => comoMes(m.mes)), scaleType: 'band' }]}
        margin={{ left: 8, right: 12, top: 12, bottom: 24 }}
        slotProps={TOOLTIP_SUELTO}
        hideLegend
      />
    </ThemeProvider>
  );
}

/** Qué tan fino agrupa «Rendimiento de llamadas». Lo decide `VistaLlamadas` a partir del rango de fechas ya elegido arriba — ver `granularidadDe`. */
export type GranularidadRendimiento = 'dia' | 'semana' | 'mes';

/**
 * RENDIMIENTO — las tres categorías, en la granularidad que ya trajo el rango
 * de fechas de arriba (día, semana o mes — sin un control propio: cambiar
 * «Últimos 7 días» a «Últimos 30 días» ya cambia esto solo).
 *
 * Tres líneas y no tres áreas apiladas: apiladas responderían «cuántas hubo en
 * total», que ya lo contesta el gráfico de arriba. Lo que se viene a mirar acá
 * es si la proporción de conectadas MEJORA, y eso solo se ve con las líneas
 * separadas.
 */
export function RendimientoDeLlamadas({
  granularidad,
  dias,
  semanas,
  meses,
}: {
  granularidad: GranularidadRendimiento;
  dias: DiaDelRegistro[];
  semanas: SemanaDelRegistro[];
  meses: MesDelRegistro[];
}) {
  const tema = useTemaDeGraficos();

  const filas = granularidad === 'dia' ? dias : granularidad === 'semana' ? semanas : meses;
  const etiquetas =
    granularidad === 'dia'
      ? dias.map((d) => comoFechaCorta(d.dia))
      : granularidad === 'semana'
        ? semanas.map((s) => comoFechaCorta(s.semana))
        : meses.map((m) => comoMes(m.mes));

  if (filas.length === 0) return <Vacio>Todavía no hay llamadas en este rango.</Vacio>;

  return (
    <ThemeProvider theme={tema}>
      <LineChart
        height={280}
        series={[
          { data: filas.map((f) => f.conectadas), label: 'Conectadas', color: COLOR_RESULTADO.conectada, curve: 'monotoneX' },
          { data: filas.map((f) => f.noConectadas), label: 'No conectadas', color: COLOR_RESULTADO.no_conectada, curve: 'monotoneX' },
          { data: filas.map((f) => f.canceladas), label: 'Canceladas', color: COLOR_RESULTADO.cancelada, curve: 'monotoneX' },
        ]}
        xAxis={[{ data: etiquetas, scaleType: 'point' }]}
        margin={{ left: 8, right: 12, top: 12, bottom: 24 }}
        slotProps={TOOLTIP_SUELTO}
      />
    </ThemeProvider>
  );
}

/**
 * LA TENDENCIA de una card del header — sin ejes ni tooltip.
 *
 * Va al lado del título, en el espacio en blanco que sobra a la derecha —
 * por eso `width`/`height` son fijos y chicos, y no un `%` que dependa del
 * contenedor. Recibe los VALORES ya elegidos por quien la llama (día a día
 * o mes a mes, según qué tan corto sea el rango — ver `VistaLlamadas.tsx`):
 * a esta función no le importa la granularidad, solo dibuja la lista. Con
 * un solo punto no hay tendencia que mostrar, así que no se dibuja nada.
 */
export function TendenciaDeResultado({ valores, color }: { valores: number[]; color: string }) {
  if (valores.length < 2) return null;

  return (
    <SparkLineChart
      data={valores}
      width={56}
      height={18}
      color={color}
      curve="monotoneX"
      margin={{ top: 2, bottom: 2, left: 1, right: 1 }}
    />
  );
}
