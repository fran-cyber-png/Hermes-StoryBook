import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { usePopover } from '../../lib/teclado/usePopover';
import type { Recordatorio } from './agenda';
import { mismaFecha } from './fechas';
import { BARRA_TIPO, tipoDeActividad } from './tipoDeNota';

/**
 * EL SELECTOR DE FECHA Y HORA de «otra fecha» — reemplaza al `<input
 * type="datetime-local">` nativo. Ese input delega el picker al sistema
 * operativo/navegador, y su diseño varía (y en algunos casos es feo o
 * confuso) según dónde corra la app. Éste es siempre el mismo.
 *
 * ── Dos cosas injertadas de la rama de Einyehl322 (#447) ───────────────────
 * Ese PR construyó un calendario propio (`SelectorDeCuando`) el 19-ago, y el
 * rediseño de esta pantalla entró el 20 y reescribió el mismo archivo. En vez
 * de elegir uno, se conservó ESTE —que ya está en producción— y se le trajeron
 * las dos capacidades que no tenía:
 *
 * 🔴 **PINTA LO QUE YA HAY ESE DÍA** (un punto por actividad, del color de su
 * tipo). El input nativo no decía nada, y con él «se agendaban tres llamadas a
 * la misma hora sin enterarse» — el motivo textual de #447. Es opcional
 * (`porDia`): sin el mapa, el calendario se dibuja igual que antes.
 *
 * 🔴 **EL PASADO NO SE PUEDE ELEGIR.** «Una promesa para ayer no es una
 * promesa», y el input nativo lo aceptaba sin chistar. Se compara por DÍA y no
 * por instante: hoy sigue siendo elegible hasta las 23:59, que es cuando una
 * vendedora agenda «para hoy más tarde».
 *
 * ⚠️ **Los puntos heredan el defecto de `BARRA_TIPO` en tema oscuro, y por eso
 * NO se arregla acá** (la advertencia es de #447 y se conserva entera):
 * `seguimiento` (`bg-navy-muted/60`) y `recordatorio`/`otro` (`bg-navy/30`)
 * sobre `--card` oscuro quedan casi invisibles. Es el MISMO mapa que pinta las
 * barras de `VistaAgenda`, así que corregirlo es corregir los dos a la vez en
 * `tipoDeNota.ts`; parcharlo sólo acá dejaría dos lugares diciendo colores
 * distintos de la misma actividad.
 */

const DIAS_SEMANA = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];
const MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const HORAS = Array.from({ length: 24 }, (_, i) => i);
const MINUTOS = Array.from({ length: 60 }, (_, i) => i);

function componer(dia: Date, hora: number, minuto: number): Date {
  const d = new Date(dia);
  d.setHours(hora, minuto, 0, 0);
  return d;
}

function primeraMayuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatoCorto(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Las 42 celdas del mes (6 semanas, domingo primero) — el mismo patrón que `MiniCalendario`. */
function diasDelMes(mes: Date): Date[] {
  const primerDia = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const desde = new Date(primerDia);
  desde.setDate(desde.getDate() - desde.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(desde);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function ColumnaNumeros({
  etiqueta,
  valores,
  seleccionado,
  onElegir,
}: {
  etiqueta: string;
  valores: number[];
  seleccionado: number;
  onElegir: (n: number) => void;
}) {
  const refSeleccionado = useRef<HTMLButtonElement>(null);

  // Centra el valor elegido apenas se abre — sin esto arranca en «00», lejos
  // de una hora que ya se había tocado antes.
  useEffect(() => {
    refSeleccionado.current?.scrollIntoView({ block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1">
      <div className="mb-1 text-center text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {etiqueta}
      </div>
      <div className="h-[198px] overflow-y-auto">
        {valores.map((n) => (
          <button
            key={n}
            ref={n === seleccionado ? refSeleccionado : undefined}
            type="button"
            onClick={() => onElegir(n)}
            className={
              'block w-full rounded-md py-1 text-center text-[12px] font-semibold tabular-nums transition-colors ' +
              (n === seleccionado ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted')
            }
          >
            {String(n).padStart(2, '0')}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SelectorFechaHora({
  valor,
  onSeleccionar,
  porDia,
  hoy,
}: {
  valor: Date | null;
  /** `null` = se borró la elección (vía «Borrar»). */
  onSeleccionar: (d: Date | null) => void;
  /** Lo ya agendado, por día local (`agruparPorDia`). Ausente = no se pintan puntos. */
  porDia?: Map<string, Recordatorio[]>;
  /** Inyectable SOLO para los tests: sin esto, «el pasado» dependería del reloj del runner. */
  hoy?: Date;
}) {
  const [abierto, setAbierto] = useState(false);
  // `hoy` entra ACÁ y no sólo en `arranqueDeHoy`: si el mes inicial mirara el
  // reloj real, un test con `hoy` congelado abriría en el mes de HOY DE
  // VERDAD y ninguna celda del mes congelado existiría en el DOM — pasaba por
  // coincidencia mientras el reloj real seguía en el mismo mes que `hoy`.
  const [mesVista, setMesVista] = useState(() => valor ?? hoy ?? new Date());
  /** El header alterna entre la grilla de días y una grilla de meses para saltar de año rápido. */
  const [vistaMeses, setVistaMeses] = useState(false);
  const [dia, setDia] = useState<Date | null>(valor);
  const [hora, setHora] = useState(() => (valor ?? new Date()).getHours());
  const [minuto, setMinuto] = useState(() => (valor ?? new Date()).getMinutes());

  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-40' });

  function elegirDia(fecha: Date) {
    setDia(fecha);
    onSeleccionar(componer(fecha, hora, minuto));
  }

  function elegirHora(h: number) {
    setHora(h);
    const base = dia ?? new Date();
    if (!dia) setDia(base);
    onSeleccionar(componer(base, h, minuto));
  }

  function elegirMinuto(m: number) {
    setMinuto(m);
    const base = dia ?? new Date();
    if (!dia) setDia(base);
    onSeleccionar(componer(base, hora, m));
  }

  function limpiar() {
    setDia(null);
    onSeleccionar(null);
  }

  function irAHoy() {
    const hoy = new Date();
    setMesVista(hoy);
    setDia(hoy);
    setVistaMeses(false);
    onSeleccionar(componer(hoy, hora, minuto));
  }

  function elegirMes(i: number) {
    setMesVista(new Date(mesVista.getFullYear(), i, 1));
    setVistaMeses(false);
  }

  const dias = diasDelMes(mesVista);
  // El corte del pasado es el ARRANQUE de hoy: el día de hoy entero sigue siendo
  // elegible. Se calcula una vez por render y no por celda.
  const arranqueDeHoy = (() => {
    const d = new Date(hoy ?? new Date());
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const valorMostrado = dia ? componer(dia, hora, minuto) : null;

  return (
    // Sin `relative`: el panel se ancla al ANCESTRO POSICIONADO más cercano, que
    // es el popover entero de `AgendarRapido` — así cae debajo de TODO el
    // popover (pie incluido) y no encima de sus propios botones.
    <span className="min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Elegir fecha"
        className="flex w-full min-w-0 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-[11px] outline-none transition-colors hover:border-primary focus:border-primary"
      >
        <CalendarDays size={12} className="shrink-0 text-muted-foreground" />
        <span className={'truncate ' + (valorMostrado ? 'text-foreground' : 'text-muted-foreground')}>
          {valorMostrado ? formatoCorto(valorMostrado) : 'Elegir fecha'}
        </span>
      </button>

      {abierto && (
        <>
          <span {...propsOverlay} />
          <div className="absolute right-0 top-full z-40 mt-1 flex rounded-xl bg-card shadow-panel">
            {/* EL MES — grilla de días (domingo primero) o, con el header tocado, grilla de meses. */}
            <div className="w-56 border-r border-border p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setVistaMeses((v) => !v)}
                  aria-expanded={vistaMeses}
                  className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted"
                >
                  <CalendarDays size={12} className="shrink-0 text-muted-foreground" />
                  {vistaMeses
                    ? mesVista.getFullYear()
                    : primeraMayuscula(mesVista.toLocaleDateString('es', { month: 'long', year: 'numeric' }))}
                  <ChevronDown
                    size={11}
                    className={'shrink-0 text-muted-foreground transition-transform ' + (vistaMeses ? 'rotate-180' : '')}
                  />
                </button>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={vistaMeses ? 'Año anterior' : 'Mes anterior'}
                    onClick={() =>
                      setMesVista((m) =>
                        vistaMeses
                          ? new Date(m.getFullYear() - 1, m.getMonth(), 1)
                          : new Date(m.getFullYear(), m.getMonth() - 1, 1),
                      )
                    }
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={vistaMeses ? 'Año siguiente' : 'Mes siguiente'}
                    onClick={() =>
                      setMesVista((m) =>
                        vistaMeses
                          ? new Date(m.getFullYear() + 1, m.getMonth(), 1)
                          : new Date(m.getFullYear(), m.getMonth() + 1, 1),
                      )
                    }
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>

              {vistaMeses ? (
                <div className="grid grid-cols-3 gap-1">
                  {MESES_ABREV.map((m, i) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => elegirMes(i)}
                      className={
                        'rounded-lg py-2 text-[11px] font-semibold transition-colors ' +
                        (i === mesVista.getMonth() ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted')
                      }
                    >
                      {m}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-y-0.5 text-center">
                  {DIAS_SEMANA.map((d) => (
                    <div key={d} className="pb-1 text-[9px] font-bold text-muted-foreground">
                      {d}
                    </div>
                  ))}
                  {dias.map((fecha) => {
                    const delMes = fecha.getMonth() === mesVista.getMonth();
                    const seleccionado = dia != null && mismaFecha(fecha, dia);
                    const pasado = fecha < arranqueDeHoy;
                    // Tope de tres: con más, los puntos no entran en la celda y
                    // dejan de leerse. Lo que importa es «hay algo», no cuánto.
                    const delDia = (porDia?.get(fecha.toDateString()) ?? []).slice(0, 3);
                    return (
                      <button
                        key={fecha.toISOString()}
                        // Ancla estable para los tests: buscar la celda por su
                        // NÚMERO agarra el día homónimo del mes vecino (la grilla
                        // son 42 celdas), y eso hacía pasar un test por el motivo
                        // equivocado — el «31» que encontraba era el del mes pasado.
                        data-dia={fecha.toDateString()}
                        type="button"
                        disabled={pasado}
                        onClick={() => elegirDia(fecha)}
                        title={delDia.length ? `${delDia.length} ya agendado(s)` : undefined}
                        className={
                          'relative flex h-7 w-full items-center justify-center rounded-lg text-[11px] font-semibold transition-colors ' +
                          (pasado
                            ? 'cursor-not-allowed text-muted-foreground/25'
                            : seleccionado
                              ? 'bg-primary text-primary-foreground'
                              : delMes
                                ? 'text-foreground hover:bg-muted'
                                : 'text-muted-foreground/40 hover:bg-muted/50')
                        }
                      >
                        <span className="leading-none">{fecha.getDate()}</span>
                        {/* Los puntos van SIEMPRE en el DOM cuando hay algo, aunque
                            el día esté seleccionado: si desaparecieran al elegir,
                            la vendedora perdería justo el dato que la hizo dudar.
                            ⚠️ Y van ABSOLUTOS, no en el flujo: en columna, un día con
                            actividad corría su número hacia arriba, y como algunos
                            tipos son casi invisibles (el defecto de `BARRA_TIPO` de
                            arriba) el resultado era un número descolocado sin causa
                            visible. Se ve en la primera captura de este frente. */}
                        {delDia.length > 0 && (
                          <span
                            className="pointer-events-none absolute bottom-[3px] left-0 right-0 flex items-center justify-center gap-[2px]"
                            aria-hidden="true"
                          >
                            {delDia.map((r) => (
                              <span key={r.id} className={'h-1 w-1 rounded-full ' + BARRA_TIPO[tipoDeActividad(r)]} />
                            ))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5">
                <button
                  type="button"
                  onClick={limpiar}
                  className="rounded px-1 text-[11px] font-semibold text-primary transition-colors hover:text-primary-hover"
                >
                  Borrar
                </button>
                <button
                  type="button"
                  onClick={irAHoy}
                  className="rounded px-1 text-[11px] font-semibold text-primary transition-colors hover:text-primary-hover"
                >
                  Hoy
                </button>
              </div>
            </div>

            {/* LA HORA — dos columnas independientes, cada una se cierra sobre su
                valor. Alto igual a la grilla de días (7 filas), para que las dos
                mitades del panel terminen a la misma altura. */}
            <div className="w-28 p-2.5">
              <div className="mb-2 flex items-center gap-1 text-[11px] font-bold text-foreground">
                <Clock size={12} className="shrink-0 text-muted-foreground" />
                Hora
              </div>
              <div className="flex gap-1">
                <ColumnaNumeros etiqueta="Hora" valores={HORAS} seleccionado={hora} onElegir={elegirHora} />
                <ColumnaNumeros etiqueta="Min" valores={MINUTOS} seleccionado={minuto} onElegir={elegirMinuto} />
              </div>
            </div>
          </div>
        </>
      )}
    </span>
  );
}
