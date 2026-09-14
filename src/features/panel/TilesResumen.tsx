import { Clock, RefreshCw, ShoppingBag } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ResumenCompras } from '../cerberus/ficha';
import { IconoDeNegocio } from '../cerberus/FichaContacto';
import type { ActividadTile } from './resumenDetalle';
import type { CompraUnificada } from './comprasUnificadas';

/**
 * #887 — EL RESUMEN DEL CONTACTO, EN UNA SOLA TARJETA.
 *
 * Eran tres tiles —última actividad, compras, monto total— y el dueño pidió
 * (13-sep-2026) «estas 3 cards pueden ser 1, minimalista pero entendible». Ahora
 * son dos renglones de la misma tarjeta, cada uno con su ícono y su rótulo
 * chiquito, que es lo que lo hace entendible sin la caja alrededor:
 *
 *   · **Última actividad** — qué fue (con el chip «Señal» si es automática), su
 *     valor al lado y cuándo, a la derecha.
 *   · **Compras** — la ÚLTIMA compra por su producto, y debajo cuántas son y
 *     cuánto suman. Mismo día: «sería mejor que muestres el producto que compró
 *     en un componente más claro». «1 compra · PEN 300» decía cuánto, no qué.
 *
 * 🔴 **El renglón de compras dice la verdad de la ficha, no un cero.** Mientras
 * viaja hay esqueleto; si no cargó dice «Las compras no cargaron» con
 * «Reintentar». Hasta el 13-sep-2026 una ficha caída se leía acá «Sin compras»
 * —afirmar lo que no se sabe— y arriba un chip «No se pudo saber» sin salida.
 */
function fechaCorta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

/** «Hoy · 12:24» o «14 ago. · 09:10»: el día que se lee de un vistazo, y la hora si la hay. */
function cuando(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dia = d.toDateString() === new Date().toDateString() ? 'Hoy' : fechaCorta(iso);
  if (!/T\d{2}:\d{2}/.test(iso)) return dia;
  return `${dia} · ${d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

function Renglon({
  icono: Icono,
  rotulo,
  derecha,
  children,
}: {
  icono: typeof Clock;
  rotulo: string;
  derecha?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2">
      <Icono size={14} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex min-h-4 items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{rotulo}</p>
          {derecha}
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * LA ÚLTIMA COMPRA, POR SU PRODUCTO. El nombre va solo en su renglón y en negrita
 * —es lo que se lee—; el ícono del negocio a la izquierda (el mismo de la pestaña
 * Compras) y abajo, chico, cuánto, cuándo y de qué negocio. Sin productos cargados
 * se nombra por el folio: un renglón vacío se lee como un dato que no llegó.
 */
function UltimaCompra({ compra }: { compra: CompraUnificada }) {
  const nombre = compra.productos.length > 0 ? compra.productos.join(', ') : (compra.folio ?? 'Compra');
  const fecha = fechaCorta(compra.fecha);
  return (
    <div className="mt-1.5 flex items-start gap-2.5 rounded-lg border border-border/70 bg-card px-2.5 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <IconoDeNegocio negocios={compra.negocios} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p data-producto className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground" title={nombre}>
          {nombre}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground">
          {compra.monto && (
            <span className="font-semibold text-foreground/80">
              {compra.monto} {compra.moneda}
            </span>
          )}
          {fecha && <span>· {fecha}</span>}
          {compra.negocios.map((n) => (
            <span key={n} className="rounded-full border border-border px-1.5 text-[10px] font-medium">
              {n}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

export type EstadoCompras = 'listo' | 'cargando' | 'error';

export function TilesResumen({
  actividad,
  compra,
  totalCompras,
  montoTotal = null,
  estadoCompras = 'listo',
  onVerTodasLasCompras,
  onReintentar,
  conCompras = true,
}: {
  actividad: ActividadTile | null;
  /** La última compra: se muestra por su producto. */
  compra: CompraUnificada | null;
  totalCompras: number;
  /** La suma de las compras en una sola moneda (`resumenCompras`: nunca suma dos). */
  montoTotal?: ResumenCompras | null;
  /** Cómo está la ficha de la que salen las compras. Ausente = ya contestó. */
  estadoCompras?: EstadoCompras;
  /** Sin handler no se dibuja «Ver todas» — nunca un no-op (patrón de la casa). */
  onVerTodasLasCompras?: () => void;
  /** Vuelve a pedir la ficha. Sin handler, el renglón dice que no cargó y nada más. */
  onReintentar?: () => void;
  /**
   * 🔴 **`false` en campaña: el renglón de compras no se dibuja** (regla del
   * dueño, 11-sep-2026). Con la ficha de Cerberus apagada decía «Sin compras»
   * y un 0 — le afirmaba a un comando de campaña que su contacto nunca
   * compró, sobre un negocio que no es el suyo. La última actividad se queda:
   * es del contacto, no del ERP. Ausente = ventas, el Resumen de siempre.
   */
  conCompras?: boolean;
}) {
  const conVerTodas = onVerTodasLasCompras && estadoCompras === 'listo' && totalCompras > 0;

  return (
    <section
      aria-label="Resumen del contacto"
      className="divide-y divide-border/60 rounded-xl border border-border/80 bg-muted/30"
    >
      <Renglon
        icono={Clock}
        rotulo="Última actividad"
        derecha={
          actividad && (
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {cuando(actividad.timestamp) ?? 'Sin fecha'}
            </span>
          )
        }
      >
        {actividad ? (
          <p className="flex min-w-0 items-center gap-1.5 text-[13px] leading-snug text-foreground">
            <span className="truncate font-semibold">{actividad.rotulo}</span>
            {actividad.esSenal && (
              <span className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-warning">
                Señal
              </span>
            )}
            {/* El valor del hecho (el monto de una compra, el curso de un interés):
                se lee sin abrir Actividad. */}
            {actividad.valor && (
              <span className="min-w-0 truncate tabular-nums text-muted-foreground" title={actividad.valor}>
                · {actividad.valor}
              </span>
            )}
          </p>
        ) : (
          <p className="text-[12.5px] text-muted-foreground">Sin actividad todavía</p>
        )}
      </Renglon>

      {conCompras && (
        <Renglon
          icono={ShoppingBag}
          rotulo="Compras"
          derecha={
            conVerTodas && (
              <button
                type="button"
                onClick={onVerTodasLasCompras}
                className="shrink-0 text-[11px] font-semibold text-primary hover:underline"
              >
                Ver todas
              </button>
            )
          }
        >
          {estadoCompras === 'cargando' ? (
            <span aria-hidden data-esqueleto="compras" className="mt-1.5 block h-12 animate-pulse rounded-lg bg-muted" />
          ) : estadoCompras === 'error' ? (
            <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted-foreground">
              Las compras no cargaron.
              {onReintentar && (
                <button
                  type="button"
                  onClick={onReintentar}
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  <RefreshCw size={11} aria-hidden /> Reintentar
                </button>
              )}
            </p>
          ) : totalCompras > 0 ? (
            <>
              {compra && <UltimaCompra compra={compra} />}
              <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
                <span className="font-semibold tabular-nums text-foreground/80">
                  {totalCompras} {totalCompras === 1 ? 'compra' : 'compras'}
                </span>
                {montoTotal && (
                  <>
                    {' · '}
                    <span className="font-semibold tabular-nums text-success">
                      {montoTotal.moneda} {montoTotal.total}
                    </span>{' '}
                    en total
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="text-[12.5px] text-muted-foreground">Sin compras</p>
          )}
        </Renglon>
      )}
    </section>
  );
}
