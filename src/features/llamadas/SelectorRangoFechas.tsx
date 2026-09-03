import { useState } from 'react';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { usePopover } from '../../lib/teclado/usePopover';
import { etiquetaDeRango, PRESETS, type RangoFechas } from './rangoFechas';

/**
 * EL CALENDARIO del filtro de fechas — reemplaza el `<select>` de presets por
 * un popover que además deja elegir un DÍA puntual, un MES o un RANGO a mano.
 *
 * El patrón (grilla de 42 celdas domingo-primero, popover con `usePopover`,
 * `shadow-panel` sin borde) es el mismo que `SelectorFechaHora` de Agenda —
 * ver ese archivo para el porqué de cada pieza. Acá NO hay corte de «el pasado
 * no se puede elegir»: el registro de llamadas mira para atrás, no agenda.
 */

const DIAS_SEMANA = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];
const MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

type Modo = 'dia' | 'mes' | 'rango';

function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Las 42 celdas del mes (6 semanas, domingo primero) — el mismo patrón que `SelectorFechaHora`. */
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

function primeraMayuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** El mes/año de arranque del calendario, según lo último elegido. */
function mesDeArranque(valor: RangoFechas): Date {
  if (valor.tipo === 'dia') return valor.fecha;
  if (valor.tipo === 'mes') return new Date(valor.anio, valor.mes, 1);
  if (valor.tipo === 'rango') return valor.hasta;
  return new Date();
}

export function SelectorRangoFechas({
  valor,
  onCambiar,
}: {
  valor: RangoFechas;
  onCambiar: (r: RangoFechas) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<Modo>(valor.tipo === 'mes' ? 'mes' : valor.tipo === 'rango' ? 'rango' : 'dia');
  const [mesVista, setMesVista] = useState(() => mesDeArranque(valor));
  const [inicioRango, setInicioRango] = useState<Date | null>(valor.tipo === 'rango' ? valor.desde : null);
  const [finRango, setFinRango] = useState<Date | null>(valor.tipo === 'rango' ? valor.hasta : null);
  const [diaHover, setDiaHover] = useState<Date | null>(null);

  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-40' });

  function cambiarModo(m: Modo) {
    setModo(m);
    if (m !== 'rango') {
      setInicioRango(null);
      setFinRango(null);
    }
  }

  function elegirDia(fecha: Date) {
    if (modo === 'dia') {
      onCambiar({ tipo: 'dia', fecha });
      setAbierto(false);
      return;
    }
    // modo === 'rango'
    if (!inicioRango || (inicioRango && finRango)) {
      setInicioRango(fecha);
      setFinRango(null);
    } else if (fecha < inicioRango) {
      setFinRango(inicioRango);
      setInicioRango(fecha);
    } else {
      setFinRango(fecha);
    }
  }

  function aplicarRango() {
    if (!inicioRango || !finRango) return;
    onCambiar({ tipo: 'rango', desde: inicioRango, hasta: finRango });
    setAbierto(false);
  }

  function elegirMes(i: number) {
    onCambiar({ tipo: 'mes', anio: mesVista.getFullYear(), mes: i });
    setAbierto(false);
  }

  function elegirPreset(id: (typeof PRESETS)[number]['id']) {
    onCambiar({ tipo: 'preset', id });
    setAbierto(false);
  }

  const dias = diasDelMes(mesVista);
  const finVisible = modo === 'rango' && inicioRango && !finRango ? diaHover : finRango;

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
      >
        {etiquetaDeRango(valor)}
        <ChevronDown size={11} className={'text-muted-foreground transition-transform ' + (abierto ? 'rotate-180' : '')} />
      </button>

      {abierto && (
        <>
          <span {...propsOverlay} />
          <div className="absolute left-0 top-full z-40 mt-1 flex rounded-xl bg-card shadow-panel">
            {/* LOS ATAJOS — presets de siempre, más los tres modos de elegir a mano;
                separados en dos secciones rotuladas para que no se lean como una
                sola lista de nueve opciones sueltas. */}
            <div className="w-44 shrink-0 space-y-0.5 border-r border-border p-2">
              <div className="px-2 pb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                Atajos
              </div>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => elegirPreset(p.id)}
                  className={
                    'block w-full rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-colors ' +
                    (valor.tipo === 'preset' && valor.id === p.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-muted')
                  }
                >
                  {p.label}
                </button>
              ))}

              <div className="my-1.5 border-t border-border" />

              <div className="px-2 pb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                Elegir a mano
              </div>
              {(
                [
                  ['dia', Calendar, 'Un día'],
                  ['mes', CalendarDays, 'Un mes'],
                  ['rango', CalendarRange, 'Rango de fechas'],
                ] as [Modo, typeof Calendar, string][]
              ).map(([m, Icono, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => cambiarModo(m)}
                  aria-pressed={modo === m}
                  className={
                    'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-colors ' +
                    (modo === m ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')
                  }
                >
                  <Icono size={12} className="shrink-0" />
                  {label}
                </button>
              ))}
            </div>

            {/* EL CALENDARIO — día/rango comparten la grilla; mes tiene la suya. */}
            <div className="w-64 p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="px-1 text-[11px] font-bold text-foreground">
                  {modo === 'mes'
                    ? mesVista.getFullYear()
                    : primeraMayuscula(mesVista.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }))}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={modo === 'mes' ? 'Año anterior' : 'Mes anterior'}
                    onClick={() =>
                      setMesVista((v) =>
                        modo === 'mes'
                          ? new Date(v.getFullYear() - 1, v.getMonth(), 1)
                          : new Date(v.getFullYear(), v.getMonth() - 1, 1),
                      )
                    }
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={modo === 'mes' ? 'Año siguiente' : 'Mes siguiente'}
                    onClick={() =>
                      setMesVista((v) =>
                        modo === 'mes'
                          ? new Date(v.getFullYear() + 1, v.getMonth(), 1)
                          : new Date(v.getFullYear(), v.getMonth() + 1, 1),
                      )
                    }
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>

              {modo === 'mes' ? (
                <div className="grid grid-cols-3 gap-1">
                  {MESES_ABREV.map((m, i) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => elegirMes(i)}
                      className={
                        'rounded-lg py-2.5 text-[11px] font-semibold transition-colors ' +
                        (valor.tipo === 'mes' && valor.anio === mesVista.getFullYear() && valor.mes === i
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted')
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
                    const esInicio = inicioRango != null && mismoDia(fecha, inicioRango);
                    const esFin =
                      modo === 'rango' ? finVisible != null && mismoDia(fecha, finVisible) : false;
                    const esUnDia = modo === 'dia' && valor.tipo === 'dia' && mismoDia(fecha, valor.fecha);
                    const enRango =
                      modo === 'rango' &&
                      inicioRango != null &&
                      finVisible != null &&
                      fecha > inicioRango &&
                      fecha < finVisible;
                    return (
                      <button
                        key={fecha.toISOString()}
                        type="button"
                        onClick={() => elegirDia(fecha)}
                        onMouseEnter={() => modo === 'rango' && setDiaHover(fecha)}
                        className={
                          'relative h-7 w-full text-[11px] font-semibold transition-colors ' +
                          (esInicio || esFin || esUnDia
                            ? 'rounded-lg bg-primary text-primary-foreground'
                            : enRango
                              ? 'bg-primary/10 text-foreground'
                              : delMes
                                ? 'rounded-lg text-foreground hover:bg-muted'
                                : 'rounded-lg text-muted-foreground/40 hover:bg-muted/50')
                        }
                      >
                        {fecha.getDate()}
                      </button>
                    );
                  })}
                </div>
              )}

              {modo === 'rango' && (
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                  <span className="text-[10px] text-muted-foreground">
                    {inicioRango && finRango
                      ? 'Rango listo'
                      : inicioRango
                        ? 'Elige la fecha final'
                        : 'Elige la fecha inicial'}
                  </span>
                  <button
                    type="button"
                    disabled={!inicioRango || !finRango}
                    onClick={aplicarRango}
                    className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Aplicar
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </span>
  );
}
