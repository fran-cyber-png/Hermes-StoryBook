import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { MapLibreMap } from 'maplibre-gl';
import {
  AlertTriangle,
  CircleHelp,
  Download,
  Flame,
  Gauge,
  Globe2,
  Map as MapIcon,
  MapPin,
  Mountain,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  Waypoints,
  X,
} from 'lucide-react';
import { useEscape } from '../../lib/teclado/useEscape';
import { MapaContactosLienzo, type VistaMapaId } from './MapaContactosLienzo';
import { locacionDe, nombreVisible, type ContactoRegistrado } from './contactosRegistrados';
import { useKpisMapa } from './kpisMapa';

/**
 * EL PANEL «MAPAS» DE PANTALLA COMPLETA (pedido del 4-sep-2026) — el cascarón
 * alrededor de `MapaContactosLienzo`: header, sidebar de «Vistas de mapa» y el
 * área donde vive el mapa mismo. Reemplaza al modal centrado anterior a
 * propósito («que no sea modal»): sin fondo oscurecido ni tarjeta chica, es
 * una pantalla propia que se abre y se cierra con el botón «Detalles» / la X
 * / Escape — el mismo patrón de apertura, otra sensación al estar adentro.
 *
 * ══ POR QUÉ ESTE ARCHIVO NO TOCA EL MAPA ════════════════════════════════════
 * El lienzo (`MapaContactosLienzo.tsx`) sigue siendo uno solo — geometría,
 * drill-down, popup, base OSM+terreno — y este panel solo le pasa una prop,
 * `vista` (ver `VistaMapaId`), que alterna QUÉ CAPA representa a los
 * contactos (pines / relieve+pines / calor / clústeres) sobre la MISMA
 * instancia de mapa, sin recrearla — centro/zoom/drill-down sobreviven el
 * cambio de vista.
 *
 * ══ LAS CUATRO VISTAS ═══════════════════════════════════════════════════════
 * Las cuatro tienen lienzo propio — `satélite`/`límites`/`cobertura` (que
 * estaban en la lista como «Próximamente») se sacaron del todo el 4-sep-2026
 * a pedido: sin lienzo real, no tenía sentido dejarlas ahí. `calor` y
 * `clústeres` reusan la MISMA infraestructura que ya tenían minimalista/
 * relieve — el pin (`IMAGEN_PIN`), la paleta (`ROJO_PERU`/`HOVER_TEAL`), el
 * popup y el patrón de capas perezosas — no un lienzo aparte.
 */

interface DefinicionVista {
  id: VistaMapaId;
  nombre: string;
  descripcion: string;
  Icono: typeof MapIcon;
}

const VISTAS: DefinicionVista[] = [
  { id: 'minimalista', nombre: 'Mapa minimalista', descripcion: 'Vista limpia y simple, sin relieve ni elevaciones.', Icono: MapIcon },
  { id: 'relieve', nombre: 'Mapa de relieve', descripcion: 'Vista con relieve del terreno y elevaciones.', Icono: Mountain },
  { id: 'calor', nombre: 'Mapa de calor', descripcion: 'Representa la densidad de contactos en el área.', Icono: Flame },
  { id: 'clusteres', nombre: 'Mapa de clústeres', descripcion: 'Agrupa contactos cercanos según su densidad.', Icono: Waypoints },
];

/** Cuál de las 4 tarjetas del resumen está desplegada — una a la vez, como un acordeón (pedido: «presionables», no un modal aparte por tarjeta). */
type TarjetaKpiId = 'total' | 'ubicacion' | 'departamentos' | 'prioridad';

/**
 * LA DONA DE «% con ubicación» — el único KPI de esta ventana que es
 * genuinamente una proporción de un todo (con vs. sin), así que es el que
 * gana el gráfico circular; el resto (ranking, prioridad) ya se lee mejor
 * como barras. Mismo patrón que `Chispa.tsx` (`components/graficos/`): SVG
 * a mano, sin librería, tiñe con `currentColor` para heredar el color de
 * quien la use.
 */
function DonaMini({ porcentaje, tamano = 56, grosor = 7 }: { porcentaje: number; tamano?: number; grosor?: number }) {
  const radio = (tamano - grosor) / 2;
  const centro = tamano / 2;
  const circunferencia = 2 * Math.PI * radio;
  const relleno = (Math.max(0, Math.min(100, porcentaje)) / 100) * circunferencia;
  return (
    <svg width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`} role="img" aria-label={`${porcentaje}% con ubicación`}>
      <circle cx={centro} cy={centro} r={radio} fill="none" strokeWidth={grosor} className="stroke-muted" />
      <circle
        cx={centro}
        cy={centro}
        r={radio}
        fill="none"
        strokeWidth={grosor}
        strokeDasharray={`${relleno} ${circunferencia - relleno}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${centro} ${centro})`}
        className="stroke-primary"
      />
      <text x={centro} y={centro} textAnchor="middle" dominantBaseline="central" className="fill-foreground text-[13px] font-bold">
        {porcentaje}%
      </text>
    </svg>
  );
}

/**
 * Una barra chica con rótulo + valor arriba — el mismo patrón visual que ya
 * usan «Top departamentos» y las tarjetas desplegadas. `tooltip` es opcional
 * a propósito: solo las barras de prioridad lo usan hoy (pedido: «poder
 * visualizar qué personas se ubican en Alta y cuáles en Media»), pero
 * cualquier otra barra puede sumarlo después sin cambiar su forma.
 *
 * CSS puro (`group`/`group-hover`), sin estado de React ni listeners de
 * mouse — un hover no necesita re-render, y así no compite con el clic que
 * despliega la tarjeta entera un nivel más arriba.
 */
function BarraMini({
  etiqueta,
  valor,
  maximo,
  clase = 'bg-primary',
  tooltip,
}: {
  etiqueta: string;
  valor: number;
  maximo: number;
  clase?: string;
  tooltip?: ReactNode;
}) {
  return (
    <div className={tooltip ? 'group relative' : undefined}>
      <div className="mb-0.5 flex items-baseline justify-between text-xs">
        <span className="truncate text-foreground">{etiqueta}</span>
        <span className="shrink-0 pl-2 font-semibold text-foreground">{valor}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className={'h-full rounded-full ' + clase} style={{ width: `${maximo > 0 ? (valor / maximo) * 100 : 0}%` }} />
      </div>
      {tooltip && (
        <div className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-64 rounded-lg border border-border bg-card p-2.5 text-xs opacity-0 shadow-panel transition-opacity duration-150 group-hover:opacity-100">
          {tooltip}
        </div>
      )}
    </div>
  );
}

/**
 * EL CONTENIDO DEL HOVER DE PRIORIDAD — quiénes son, no solo cuántos son.
 *
 * ⚠️ **No inventa un criterio que no existe**: `prioridad` es un campo que se
 * elige a mano en la ficha del contacto (`FichaRapida.tsx`, los botones
 * Alta/Media/Baja) — no hay ningún cálculo ni regla detrás que explique
 * «por qué» quedó ahí. La nota del final lo dice así de directo en vez de
 * fabricar una justificación (un score, una fecha límite) que el dato no
 * tiene.
 */
function TooltipPrioridad({ contactos }: { contactos: ContactoRegistrado[] }) {
  if (contactos.length === 0) {
    return <p className="text-muted-foreground">Nadie en este nivel todavía.</p>;
  }
  const MAX_VISIBLES = 6;
  const visibles = contactos.slice(0, MAX_VISIBLES);
  return (
    <>
      <ul className="space-y-1">
        {visibles.map((c) => (
          <li key={c.clave} className="flex items-baseline justify-between gap-2">
            <span className="truncate text-foreground">{nombreVisible(c)}</span>
            <span className="shrink-0 truncate text-[11px] text-muted-foreground">{locacionDe(c) ?? '—'}</span>
          </li>
        ))}
      </ul>
      {contactos.length > MAX_VISIBLES && (
        <p className="mt-1 text-[11px] text-muted-foreground">+{contactos.length - MAX_VISIBLES} más</p>
      )}
      <p className="mt-2 border-t border-border pt-1.5 text-[10.5px] italic leading-snug text-muted-foreground">
        La prioridad se elige a mano en la ficha de cada contacto — no hay un criterio automático detrás.
      </p>
    </>
  );
}

export function PanelMapaContactos({
  contactos,
  onCerrar,
  onRefrescar,
}: {
  contactos: ContactoRegistrado[];
  onCerrar: () => void;
  /** Ver el comentario en `MapaContactosLienzo` — el botón junto al buscador que vuelve a pedir los contactos al server. */
  onRefrescar?: () => void | Promise<unknown>;
}) {
  useEscape(onCerrar);
  const [vistaActiva, setVistaActiva] = useState<VistaMapaId>('minimalista');
  const [sidebarColapsado, setSidebarColapsado] = useState(false);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  // Qué dibuja el cuerpo de la sidebar — se INTERCALA con el toggle de abajo,
  // nunca conviven: «vistas» es la lista de siempre (minimalista/relieve/
  // calor/clústeres), «kpis» reemplaza esa lista por los números del mapa.
  // Colapsado siempre gana «vistas» (los íconos de siempre) — no hay ancho
  // para dibujar barras y números ahí adentro.
  const [modoSidebar, setModoSidebar] = useState<'vistas' | 'kpis'>('vistas');
  // Cuál tarjeta del resumen está desplegada — un acordeón: clickear la misma
  // la cierra, clickear otra reemplaza cuál se ve (pedido: «presionables...
  // que me muestres información extra», nunca las cuatro a la vez).
  const [tarjetaExpandida, setTarjetaExpandida] = useState<TarjetaKpiId | null>(null);
  const kpis = useKpisMapa(contactos);
  const mostrarVistas = sidebarColapsado || modoSidebar === 'vistas';
  // Quiénes están en cada nivel de prioridad — el detalle detrás del hover de
  // las barras de «Contactos por prioridad» (los conteos ya viven en `kpis`,
  // pero mostrar los NOMBRES no hace falta recalcularlo en `kpisMapa.ts`:
  // ya tenemos `contactos` acá mismo).
  const contactosPorPrioridad = useMemo(() => {
    const grupos: Record<'alta' | 'media' | 'baja' | 'sinDato', ContactoRegistrado[]> = {
      alta: [],
      media: [],
      baja: [],
      sinDato: [],
    };
    for (const c of contactos) {
      if (c.prioridad === 'alta') grupos.alta.push(c);
      else if (c.prioridad === 'media') grupos.media.push(c);
      else if (c.prioridad === 'baja') grupos.baja.push(c);
      else grupos.sinDato.push(c);
    }
    return grupos;
  }, [contactos]);
  // Para «Exportar vista»: el lienzo guarda su propia instancia de mapa
  // (`mapaRef`, privada de `MapaContactosLienzo`) — esto es la única forma de
  // llegar al `<canvas>` desde acá sin que el lienzo tenga que saber que
  // existe un botón de exportar.
  const mapaActualRef = useRef<MapLibreMap | null>(null);

  const vista = VISTAS.find((v) => v.id === vistaActiva) ?? VISTAS[0];

  function exportarVista() {
    const mapa = mapaActualRef.current;
    if (!mapa) return;
    try {
      const url = mapa.getCanvas().toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `mapa-contactos-${vista.id}-${Date.now()}.png`;
      a.click();
    } catch {
      // Un tile de otro origen sin cabecera CORS deja el lienzo WebGL
      // «tainted» — el navegador se niega a leerlo, no es un bug de acá.
      window.alert('No se pudo exportar: el navegador bloqueó la lectura del mapa por seguridad.');
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Mapas" className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="relative flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MapIcon size={17} />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-base font-bold leading-tight text-foreground">Mapas</h1>
            <p className="truncate text-xs text-muted-foreground">Explora los contactos registrados en distintas vistas geográficas</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={exportarVista}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary"
          >
            <Download size={14} /> Exportar vista
          </button>
          <button
            type="button"
            aria-label="Ayuda"
            aria-expanded={ayudaAbierta}
            onClick={() => setAyudaAbierta((v) => !v)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CircleHelp size={16} />
          </button>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {ayudaAbierta && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setAyudaAbierta(false)} aria-hidden="true" />
            <div className="absolute right-20 top-16 z-40 w-72 rounded-xl border border-border bg-card p-4 text-xs shadow-panel">
              <p className="mb-1 font-semibold text-foreground">Cómo usar este panel</p>
              <p className="text-muted-foreground">
                Elegí una vista en el panel izquierdo para cambiar cómo se dibuja el mapa. Los controles de zoom,
                ubicación, capas y escala están siempre en la esquina superior derecha del mapa.
              </p>
            </div>
          </>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={
            'flex shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ' +
            (sidebarColapsado ? 'w-14' : 'w-72')
          }
        >
          <div className="min-h-0 flex-1 overflow-y-auto py-3">
            {sidebarColapsado ? (
              <div className="flex justify-center pb-2">
                <button
                  type="button"
                  title="KPIs del mapa"
                  aria-label="KPIs del mapa"
                  onClick={() => {
                    setSidebarColapsado(false);
                    setModoSidebar('kpis');
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Gauge size={15} />
                </button>
              </div>
            ) : (
              <div className="px-3 pb-3">
                <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
                  <button
                    type="button"
                    onClick={() => setModoSidebar('vistas')}
                    aria-current={modoSidebar === 'vistas' ? 'true' : undefined}
                    className={
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors ' +
                      (modoSidebar === 'vistas'
                        ? 'bg-card text-primary shadow-sm'
                        : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    <MapIcon size={13} /> Vistas
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoSidebar('kpis')}
                    aria-current={modoSidebar === 'kpis' ? 'true' : undefined}
                    className={
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors ' +
                      (modoSidebar === 'kpis'
                        ? 'bg-card text-primary shadow-sm'
                        : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    <Gauge size={13} /> KPIs
                  </button>
                </div>
              </div>
            )}

            {mostrarVistas ? (
              <nav className="flex flex-col gap-1 px-2">
                {VISTAS.map((v) => {
                  const activa = v.id === vistaActiva;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      title={sidebarColapsado ? v.nombre : undefined}
                      onClick={() => setVistaActiva(v.id)}
                      aria-current={activa ? 'true' : undefined}
                      className={
                        'relative flex items-center gap-3 rounded-lg py-2.5 text-left transition-colors ' +
                        (sidebarColapsado ? 'justify-center px-0' : 'px-3') +
                        ' ' +
                        (activa ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted')
                      }
                    >
                      {activa && (
                        <span className="absolute bottom-1 left-0 top-1 w-[3px] rounded-full bg-primary" aria-hidden="true" />
                      )}
                      <span
                        className={
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ' +
                          (activa ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')
                        }
                      >
                        <v.Icono size={16} />
                      </span>
                      {!sidebarColapsado && (
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{v.nombre}</span>
                          <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">{v.descripcion}</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            ) : (
              <div className="space-y-3 px-4">
                {/* El resumen ejecutivo — cuatro números, un vistazo. Cada
                    tarjeta es un botón: clickearla despliega su propio
                    detalle gráfico debajo (pedido: «presionables... que me
                    muestres información extra de manera gráfica»). */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={tarjetaExpandida === 'total'}
                    onClick={() => setTarjetaExpandida((v) => (v === 'total' ? null : 'total'))}
                    className={
                      'rounded-lg border p-2.5 text-left transition-colors ' +
                      (tarjetaExpandida === 'total'
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-card hover:border-primary/30')
                    }
                  >
                    <span className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Users size={13} />
                    </span>
                    <p className="text-lg font-bold leading-none text-foreground">{kpis.total}</p>
                    <p className="mt-1 text-[10.5px] leading-tight text-muted-foreground">Contactos registrados</p>
                  </button>

                  <button
                    type="button"
                    aria-pressed={tarjetaExpandida === 'ubicacion'}
                    onClick={() => setTarjetaExpandida((v) => (v === 'ubicacion' ? null : 'ubicacion'))}
                    className={
                      'rounded-lg border p-2.5 text-left transition-colors ' +
                      (tarjetaExpandida === 'ubicacion'
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-card hover:border-primary/30')
                    }
                  >
                    <span className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <MapPin size={13} />
                    </span>
                    <p className="text-lg font-bold leading-none text-foreground">{kpis.porcentajeConUbicacion}%</p>
                    <p className="mt-1 text-[10.5px] leading-tight text-muted-foreground">
                      {kpis.conUbicacion} con ubicación
                    </p>
                  </button>

                  <button
                    type="button"
                    aria-pressed={tarjetaExpandida === 'departamentos'}
                    onClick={() => setTarjetaExpandida((v) => (v === 'departamentos' ? null : 'departamentos'))}
                    className={
                      'rounded-lg border p-2.5 text-left transition-colors ' +
                      (tarjetaExpandida === 'departamentos'
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-card hover:border-primary/30')
                    }
                  >
                    <span className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Globe2 size={13} />
                    </span>
                    <p className="text-lg font-bold leading-none text-foreground">
                      {kpis.departamentosCubiertos}
                      <span className="text-xs font-medium text-muted-foreground">/{kpis.totalDepartamentos || '—'}</span>
                    </p>
                    <p className="mt-1 text-[10.5px] leading-tight text-muted-foreground">Departamentos cubiertos</p>
                  </button>

                  <button
                    type="button"
                    aria-pressed={tarjetaExpandida === 'prioridad'}
                    onClick={() => setTarjetaExpandida((v) => (v === 'prioridad' ? null : 'prioridad'))}
                    className={
                      'rounded-lg border p-2.5 text-left transition-colors ' +
                      (tarjetaExpandida === 'prioridad'
                        ? 'border-destructive/40 bg-destructive/5'
                        : kpis.prioridadAlta > 0
                          ? 'border-destructive/30 bg-destructive/5'
                          : 'border-border bg-card hover:border-primary/30')
                    }
                  >
                    <span
                      className={
                        'mb-1.5 flex h-6 w-6 items-center justify-center rounded-md ' +
                        (kpis.prioridadAlta > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')
                      }
                    >
                      <AlertTriangle size={13} />
                    </span>
                    <p
                      className={
                        'text-lg font-bold leading-none ' +
                        (kpis.prioridadAlta > 0 ? 'text-destructive' : 'text-foreground')
                      }
                    >
                      {kpis.prioridadAlta}
                    </p>
                    <p className="mt-1 text-[10.5px] leading-tight text-muted-foreground">Prioridad alta</p>
                  </button>
                </div>

                {/* El detalle gráfico de la tarjeta activa — un acordeón, nunca las cuatro a la vez. */}
                {tarjetaExpandida && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    {tarjetaExpandida === 'total' && (
                      <>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Quién registró más
                        </p>
                        {kpis.porRegistrador.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sin contactos registrados todavía.</p>
                        ) : (
                          <div className="space-y-2">
                            {kpis.porRegistrador.slice(0, 5).map((r) => (
                              <BarraMini key={r.nombre} etiqueta={r.nombre} valor={r.cuantos} maximo={kpis.porRegistrador[0].cuantos} />
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {tarjetaExpandida === 'ubicacion' && (
                      <>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Cobertura de ubicación
                        </p>
                        <div className="flex items-center gap-4">
                          <DonaMini porcentaje={kpis.porcentajeConUbicacion} />
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center gap-1.5 text-foreground">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                              {kpis.conUbicacion} con ubicación
                            </div>
                            <div className="flex items-center gap-1.5 text-foreground">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                              {kpis.sinUbicacion} sin ubicación
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {tarjetaExpandida === 'departamentos' && (
                      <>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Departamentos sin cubrir
                        </p>
                        {kpis.totalDepartamentos === 0 ? (
                          <p className="text-xs text-muted-foreground">Cargando geografía…</p>
                        ) : kpis.departamentosSinCobertura.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Los 25 departamentos tienen al menos un contacto.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {kpis.departamentosSinCobertura.map((d) => (
                              <span key={d} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground">
                                {d}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {tarjetaExpandida === 'prioridad' && (
                      <>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Contactos por prioridad
                        </p>
                        <div className="space-y-2">
                          <BarraMini
                            etiqueta="Alta"
                            valor={kpis.porPrioridad.alta}
                            maximo={kpis.total}
                            clase="bg-destructive"
                            tooltip={<TooltipPrioridad contactos={contactosPorPrioridad.alta} />}
                          />
                          <BarraMini
                            etiqueta="Media"
                            valor={kpis.porPrioridad.media}
                            maximo={kpis.total}
                            clase="bg-warning"
                            tooltip={<TooltipPrioridad contactos={contactosPorPrioridad.media} />}
                          />
                          <BarraMini
                            etiqueta="Baja"
                            valor={kpis.porPrioridad.baja}
                            maximo={kpis.total}
                            clase="bg-muted-foreground"
                            tooltip={<TooltipPrioridad contactos={contactosPorPrioridad.baja} />}
                          />
                          <BarraMini
                            etiqueta="Sin dato"
                            valor={kpis.porPrioridad.sinDato}
                            maximo={kpis.total}
                            clase="bg-muted"
                            tooltip={<TooltipPrioridad contactos={contactosPorPrioridad.sinDato} />}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Con/sin ubicación, en detalle — la franja que ya traía el diseño anterior, ahora debajo del resumen. */}
                <div>
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${kpis.porcentajeConUbicacion}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[10.5px] text-muted-foreground">
                    <span>{kpis.conUbicacion} con ubicación</span>
                    <span>{kpis.sinUbicacion} sin ubicación</span>
                  </div>
                </div>

                <div className="h-px bg-border" aria-hidden="true" />

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Top departamentos
                  </p>
                  {kpis.porDepartamento.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin contactos con ubicación registrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {kpis.porDepartamento.slice(0, 5).map((d, i) => (
                        <div key={d.nombre} className="flex items-center gap-2">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-baseline justify-between text-xs">
                              <span className="truncate text-foreground">{d.nombre}</span>
                              <span className="shrink-0 pl-2 font-semibold text-foreground">{d.cuantos}</span>
                            </div>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${(d.cuantos / kpis.porDepartamento[0].cuantos) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {kpis.porDepartamento.length > 5 && (
                    <p className="mt-1.5 pl-6 text-[11px] text-muted-foreground">
                      +{kpis.porDepartamento.length - 5} departamento{kpis.porDepartamento.length - 5 === 1 ? '' : 's'} más
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/15 text-primary">
                      <Waypoints size={11} />
                    </span>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Más concentrado
                    </p>
                  </div>
                  {kpis.clusterMasGrande ? (
                    <p className="text-xs leading-snug text-foreground">
                      <span className="text-base font-bold text-primary">{kpis.clusterMasGrande.cuantos}</span>{' '}
                      contactos a menos de 15 km entre sí
                      {kpis.clusterMasGrande.departamento && <> — {kpis.clusterMasGrande.departamento}</>}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Ningún grupo de contactos concentrados entre sí.</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSidebarColapsado((v) => !v)}
            aria-label={sidebarColapsado ? 'Expandir panel' : 'Colapsar panel'}
            className={
              'flex shrink-0 items-center gap-2 border-t border-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground ' +
              (sidebarColapsado ? 'justify-center px-0' : 'px-4')
            }
          >
            {sidebarColapsado ? <PanelLeftOpen size={14} /> : (
              <>
                <PanelLeftClose size={14} /> Colapsar panel
              </>
            )}
          </button>
        </aside>

        <main className="relative min-w-0 flex-1">
          <MapaContactosLienzo
            contactos={contactos}
            vista={vista.id}
            onMapaListo={(mapa) => {
              mapaActualRef.current = mapa;
            }}
            onRefrescar={onRefrescar}
          />
        </main>
      </div>
    </div>
  );
}
