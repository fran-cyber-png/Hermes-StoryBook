import { useState } from 'react';
import { CalendarRange, Check, ChevronDown, Clock3 } from 'lucide-react';
import { usePopover } from '../../lib/teclado/usePopover';
import {
  DIAS_DE_LA_COLA,
  GRUPOS_DE_FRANJAS,
  pisoDelRango,
  rangoDeFechas,
  rotuloDeFranja,
  type Franja,
} from './franja';

/**
 * ══ «¿A QUIÉNES LES ESCRIBÍ HOY?» — EL FILTRO DE TIEMPO DE UNA COLUMNA ═══════
 *
 * Vive en la fila de chips de la cabecera, al lado de «Para seguir» y «Con
 * precio», porque contesta una pregunta de la misma familia: **qué parte de esta
 * pila es el trabajo de ahora**. La política —qué franjas existen, qué instantes
 * significan y por qué no hay «últimos 30 días»— vive en `franja.ts`, que es puro
 * y tiene tests. Acá solo se dibuja.
 *
 * ── UN CHIP Y NO TRES SELECTORES ─────────────────────────────────────────
 * La maqueta traía tres desplegables en fila (Fecha · Hora · Minutos). Acá son
 * **un chip que abre los tres grupos**, y el motivo es medible: la columna de
 * «Nunca contestaron» mide `minmax(180px, 0.75fr)` —la más angosta del tablero,
 * ~200 px a 1280— y tres botones con su flecha no entran ni en dos renglones sin
 * empujar las tarjetas fuera de la pantalla. El panel, en cambio, se dibuja
 * `absolute` y puede ser más ancho que su columna.
 *
 * Y hay una razón que no es de ancho: los tres menús son **un solo valor**
 * (`franja.ts`), así que un control que muestra el valor actual —«Últimos 30
 * minutos»— dice la verdad, mientras que tres cajas vacías al lado de una llena
 * invitan a cruzarlas.
 */
export function FiltroCuando({
  franja,
  onElegir,
  ahora,
}: {
  franja: Franja | null;
  /** `null` = «Todas»: se apaga la franja y vuelve el universo de la columna. */
  onElegir: (f: Franja | null) => void;
  /** El reloj de quien mira. Llega por prop para que la galería pueda fotografiarlo. */
  ahora: Date;
}) {
  const [abierto, setAbierto] = useState(false);
  const [rango, setRango] = useState(false);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-20' });

  const activo = franja != null;
  const piso = pisoDelRango(ahora);
  const elegir = (f: Franja | null) => {
    onElegir(f);
    setAbierto(false);
    setRango(false);
  };
  const rangoElegido = rangoDeFechas(desde, hasta);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-pressed={activo}
        title="Filtrar por cuándo le escribiste — la persona todavía no contestó"
        className={
          'inline-flex items-center gap-1 rounded-full border px-2 py-px text-[11px] font-semibold transition-colors ' +
          (activo
            ? 'border-navy bg-navy text-white'
            : 'border-border text-muted-foreground hover:text-foreground')
        }
      >
        <Clock3 size={10} />
        {rotuloDeFranja(franja)}
        <ChevronDown size={10} className={abierto ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {abierto && (
        <>
          <span {...propsOverlay} />
          <div
            role="menu"
            aria-label="Cuándo le escribiste"
            className="absolute left-0 top-6 z-30 w-60 rounded-xl border border-border bg-card p-1.5 shadow-panel"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => elegir(null)}
              className={
                'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-semibold transition-colors hover:bg-muted/50 ' +
                (activo ? 'text-foreground' : 'text-navy-ink')
              }
            >
              Todas las fechas
              {!activo && <Check size={13} className="shrink-0 text-navy-ink" />}
            </button>

            {GRUPOS_DE_FRANJAS.map((grupo) => (
              <div key={grupo.titulo} className="mt-1 border-t border-border/60 pt-1">
                <p className="px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {grupo.titulo}
                </p>
                {grupo.opciones.map((o) => {
                  const puesto = franja?.tipo === 'preset' && franja.id === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="menuitem"
                      onClick={() => elegir({ tipo: 'preset', id: o.id })}
                      className={
                        'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-[12px] transition-colors hover:bg-muted/50 ' +
                        (puesto ? 'font-bold text-navy-ink' : 'font-medium text-foreground')
                      }
                    >
                      {o.label}
                      {puesto && <Check size={13} className="shrink-0 text-navy-ink" />}
                    </button>
                  );
                })}
              </div>
            ))}

            <div className="mt-1 border-t border-border/60 pt-1">
              {!rango ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setRango(true)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50"
                >
                  <CalendarRange size={12} className="shrink-0 text-muted-foreground" />
                  Elegir rango…
                </button>
              ) : (
                <div className="flex flex-col gap-1 px-2 py-1">
                  <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    Desde
                    <input
                      type="date"
                      value={desde}
                      min={piso}
                      onChange={(e) => setDesde(e.target.value)}
                      className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    Hasta
                    <input
                      type="date"
                      value={hasta}
                      min={desde || piso}
                      onChange={(e) => setHasta(e.target.value)}
                      className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] text-foreground"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!rangoElegido}
                    onClick={() => rangoElegido && elegir(rangoElegido)}
                    className="mt-0.5 rounded-lg bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                  >
                    Aplicar
                  </button>
                </div>
              )}
            </div>

            {/*
              🔴 EL TECHO ESTÁ ESCRITO DONDE SE ELIGE. La cola mira 30 días
              (`consultarCola.ts`), así que más atrás no hay tarjetas: sin este
              renglón, un rango de mayo devolvería cero y se leería como «no le
              escribiste a nadie» en vez de «eso no está en la mesa».
            */}
            <p className="mt-1 border-t border-border/60 px-2 pt-1 text-[10px] leading-snug text-muted-foreground">
              El tablero mira los últimos {DIAS_DE_LA_COLA} días.
            </p>
          </div>
        </>
      )}
    </span>
  );
}
