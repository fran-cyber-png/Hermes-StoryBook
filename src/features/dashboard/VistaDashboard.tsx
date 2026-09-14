import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { SelloDeAntes } from '../../components/SelloDeAntes';
import { useSelloDeViejo } from '../../lib/datos/useSelloDeViejo';
import { useCampana } from './campana';
import { rotuloDeActualizacion, useHoy, type PuenteAlPipeline } from './hoy';
import { useNegocio } from './negocio';
import { PanelCampana } from './PanelCampana';
import { PanelHoy } from './PanelHoy';
import { FiltrosNegocio, PanelNegocio, type FiltrosNegocioState } from './PanelNegocio';
import { useSeriesDashboard } from './series';

/**
 * EL DASHBOARD — LO QUE SE MIDE (ADR 0104).
 *
 * La regla que lo separa del Pipeline, decidida el 10-sep-2026: **lo que se TRABAJA
 * está en el Pipeline; lo que se MIDE está en el Dashboard; ninguna cifra vive en
 * los dos**. Por eso de acá se fueron el radar, los cuatro números grandes, el
 * embudo, «Qué piden», la ficha al costado, las píldoras de la agenda y el botón
 * «Atender a…»: todo eso es trabajo, y sus cifras ya estaban en el Pipeline.
 *
 * Las lecturas van en un conmutador que se DERIVA de la lista `lecturas`:
 *   · **Hoy** (default) — la operación del día (`PanelHoy`): quién escribió por
 *     primera vez, a quién se le debe respuesta desde hace más de un día, qué
 *     calientes no tienen dueña y qué hizo cada persona. Cada cifra abre el Pipeline
 *     con su recorte (`onAbrirPipeline`).
 *   · **El negocio** — sólo supervisión y sólo ventas (`PanelNegocio`), con la tira de
 *     los últimos 14 días que antes vivía en el riel.
 *   · **La campaña** — sólo el módulo de campaña (ADR 0085).
 *
 * La BANDA de arriba es la bisagra: a la izquierda el conmutador, a la derecha lo que
 * cada lectura necesita. En escritorio mide lo mismo en las tres lecturas (`min-h-16`).
 * En pantalla angosta pasa a otra línea en vez de recortar, así que crece con lo que
 * pone cada lectura (#968).
 */

type Lectura = 'hoy' | 'negocio' | 'campana';

export function VistaDashboard({
  esDeCampana,
  onAbrirPipeline,
}: {
  /** ¿Quien mira trabaja en el módulo de campaña? Sale del token (ADR 0063). */
  esDeCampana?: boolean;
  /** Abre el Pipeline con el recorte de la cifra que se tocó (`lib/puente.ts`). */
  onAbrirPipeline: (p: PuenteAlPipeline) => void;
}) {
  const [lectura, setLectura] = useState<Lectura>('hoy');
  const [filtros, setFiltros] = useState<FiltrosNegocioState>({ periodo: '7d', numero: null, dimension: 'curso' });

  /**
   * «Hoy» se pide mientras se lo mira. También cuando la lectura elegida no le toca
   * a este módulo (una puerta que ya se sabe cerrada cae de vuelta en «Hoy», y ahí
   * tiene que haber algo que ver).
   */
  const hoyActivo =
    lectura === 'hoy' || (lectura === 'negocio' && esDeCampana === true) || (lectura === 'campana' && esDeCampana !== true);
  const hoy = useHoy({ activo: hoyActivo });

  /**
   * ¿VE «EL NEGOCIO»? Lo decide el SERVER (`supervisor` en la respuesta de «Hoy») y
   * nunca en campaña, que es superficie de `ventas` (ADR 0085).
   *
   * ⚠️ **`?? true` y no `?? false`**: el campo falta en un server viejo y en una
   * respuesta rehidratada del caché (ADR 0007). Con `false` por default, «El
   * negocio» desaparecería para el supervisor en la ventana entre N4 y N5. El 403
   * del server sigue siendo la frontera.
   */
  const puedeVerNegocio = !esDeCampana && (hoy.data?.supervisor ?? true);
  const puedeVerCampana = esDeCampana === true;

  const negocio = useNegocio({ ...filtros, activo: lectura === 'negocio' && puedeVerNegocio });
  const series = useSeriesDashboard({ activo: lectura === 'negocio' && puedeVerNegocio });
  const campana = useCampana({ periodo: filtros.periodo, activo: lectura === 'campana' && puedeVerCampana });

  // Si la lectura elegida no le toca (el caché pintó antes de que llegara lo
  // fresco, y lo fresco dice otra cosa), vuelve a «Hoy».
  const lecturaEfectiva: Lectura =
    (lectura === 'negocio' && !puedeVerNegocio) || (lectura === 'campana' && !puedeVerCampana) ? 'hoy' : lectura;

  const lecturas = [
    ['hoy', 'Hoy'] as const,
    ...(puedeVerNegocio ? [['negocio', 'El negocio'] as const] : []),
    ...(puedeVerCampana ? [['campana', 'La campaña'] as const] : []),
  ];

  // Al abrir la app, «Hoy» puede venir del caché persistido: mientras eso sea lo que
  // se ve, el sello dice de cuándo es (`lib/datos/persistencia.ts`).
  const deAntes = useSelloDeViejo(hoy.dataUpdatedAt);

  /**
   * El reloj del rótulo «actualizado hace N min»: late cada minuto y NO pide nada.
   * Pedir es cosa del latido de `useHoy` y del botón: cada pedido arma la mesa
   * entera en el server, y un rótulo no puede costar eso.
   */
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const actualizado = rotuloDeActualizacion(hoy.dataUpdatedAt, ahora);

  return (
    // `overflow-y-auto` y no `hidden` (#968): angosto, las tarjetas se apilan y la banda crece, y
    // con `hidden` lo de abajo quedaba recortado sin forma de llegar. En escritorio todo entra y
    // no aparece ninguna barra.
    <div className="relative flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3">
      {/* ═══ LA BANDA — el conmutador fijo + lo que cada lectura necesita. ═══ */}
      {/* 🔴 Pasa a otra línea cuando no entra, y no recorta (#968). Con `h-16` y `overflow-hidden`,
          a 390 px la dimensión y el número quedaban FUERA de la pantalla, y a 768 no se podía
          elegir «Por línea», «Por canal» ni un número: un control recortado no se puede tocar. */}
      <section className="flex min-h-16 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-card px-4 py-2 shadow-panel">
        {/* Con una sola lectura, un segmentado de un segmento sería un botón que no
            hace nada: va el rótulo de lo que se está mirando. */}
        {lecturas.length > 1 ? (
          <div className="flex shrink-0 rounded-full bg-muted p-0.5">
            {lecturas.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLectura(id)}
                aria-pressed={lecturaEfectiva === id}
                className={
                  'rounded-full px-3 py-1 text-xs font-bold transition-[background-color,color] duration-200 ease-house ' +
                  (lecturaEfectiva === id ? 'bg-card text-navy-ink shadow-panel' : 'text-muted-foreground hover:text-foreground')
                }
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <h2 className="shrink-0 font-heading text-xs font-bold text-navy-ink">Hoy</h2>
        )}
        {/* Angosto, los filtros bajan a su propia línea y este divisor quedaría colgando. */}
        <span className="hidden h-7 w-px shrink-0 bg-border md:block" aria-hidden="true" />

        {lecturaEfectiva === 'hoy' ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-xs text-muted-foreground">
              Desde las 00:00 de hoy{actualizado ? ` · ${actualizado}` : ''}
            </span>
            {deAntes && <SelloDeAntes texto={deAntes} actualizando={hoy.isFetching} />}
            {/* 🔴 `cancelRefetch: false`: con `refetch()` a secas, react-query CANCELA el
                pedido en vuelo y lanza otro, pero el primero ya salió, así que dos
                clics impacientes son dos `todo` armadas en el server. Así, el segundo
                clic se suma al pedido que ya está en camino. */}
            <button
              type="button"
              onClick={() => void hoy.refetch({ cancelRefetch: false })}
              aria-label="Actualizar las cifras de hoy"
              aria-busy={hoy.isFetching}
              className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <RefreshCw size={12} aria-hidden="true" className={hoy.isFetching ? 'motion-safe:animate-spin' : ''} />
              Actualizar
            </button>
          </div>
        ) : (
          /* El mismo control de período para las dos lecturas de conjunto: es la misma
             pregunta («¿de cuándo?»). En campaña viajan sólo los presets. */
          <FiltrosNegocio
            valor={filtros}
            onCambio={setFiltros}
            datos={negocio.data}
            soloPeriodo={lecturaEfectiva === 'campana'}
            rango={lecturaEfectiva === 'campana' ? campana.data?.rango : undefined}
          />
        )}
      </section>

      {/* `actualizando` es `isPlaceholderData`, no `isFetching`: se atenúa sólo cuando
          lo que se ve es de OTRA clave mientras llega la pedida, no en cada
          revalidación de fondo (el parpadeo que reportó el dueño el 8-sep-2026). */}
      {lecturaEfectiva === 'hoy' && (
        <PanelHoy
          datos={hoy.data}
          cargando={hoy.isPending}
          actualizando={hoy.isPlaceholderData}
          onAbrirPipeline={onAbrirPipeline}
          // Un 503 `lineas_no_leidas` (ADR 0108) se dice y se reintenta con el mismo `cancelRefetch:
          // false` del botón «Actualizar»: dos toques impacientes no pueden ser dos `todo` en el server.
          falla={
            hoy.isError
              ? { error: hoy.error, reintentar: () => void hoy.refetch({ cancelRefetch: false }), reintentando: hoy.isFetching }
              : undefined
          }
        />
      )}

      {lecturaEfectiva === 'negocio' && (
        <PanelNegocio
          datos={negocio.data}
          cargando={negocio.isPending || (negocio.isFetching && !negocio.data)}
          actualizando={negocio.isPlaceholderData}
          dimension={filtros.dimension}
          series={series.data}
          cargandoSeries={series.isPending}
        />
      )}

      {lecturaEfectiva === 'campana' && (
        <PanelCampana
          datos={campana.data}
          cargando={campana.isPending || (campana.isFetching && !campana.data)}
          actualizando={campana.isPlaceholderData}
        />
      )}
    </div>
  );
}
