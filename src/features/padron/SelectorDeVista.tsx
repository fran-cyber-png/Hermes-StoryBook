import { useState } from 'react';
import { Check, ChevronDown, Rows3 } from 'lucide-react';
import { cifra } from '../../lib/formato';
import { controlDeBarraClass } from '../../lib/styles';
import { usePopover } from '../../lib/teclado/usePopover';
import type { VistaDelPadron } from './vistasDelPadron';

/**
 * «SIN ASIGNAR ▾» — EL SELECTOR DE VISTA DEL PADRÓN (ADR 0102).
 *
 * Es la franja «Para repartir hoy» metida en un menú: las mismas vistas, con sus
 * cifras, y con la misma semántica —elegir una REEMPLAZA el recorte, no se suma—.
 * Lo que cambió es el lugar: ya no ocupa una fila entera de la pantalla, y el
 * disparador dice qué vista está puesta, derivada de los filtros
 * (`vistaVigente`), así que tocar el panel lateral lo actualiza solo.
 *
 * ⚠️ **«Asignado a» distingue tres estados**: todavía contando, no se pudo leer
 * el reparto, y de verdad nadie tiene nada. La franja vieja los dibujaba iguales
 * —«Todavía nadie tiene nada asignado»—, y en producción esa frase salía siempre,
 * con miles repartidos (ver `vistasDelPadron.ts`).
 *
 * Escape y clic afuera los pone `usePopover`, no una copia a mano: las nueve
 * copias que ese hook reemplazó ya habían divergido (#12), y la que había acá
 * se comía el Escape aunque el foco estuviera en un campo.
 */
export function SelectorDeVista({
  vistas,
  vigente,
  onElegir,
  estadoDelReparto,
}: {
  vistas: VistaDelPadron[];
  vigente: VistaDelPadron | null;
  onElegir: (vista: VistaDelPadron) => void;
  /** Cómo está la carga del reparto, de donde salen las vistas «Asignado a». */
  estadoDelReparto: 'cargando' | 'error' | 'listo';
}) {
  const [abierto, setAbierto] = useState(false);
  const { propsOverlay } = usePopover(abierto, () => setAbierto(false));

  const titulo = vigente?.titulo ?? 'Todos los contactos';
  const deGrupo = (grupo: VistaDelPadron['grupo']) => vistas.filter((v) => v.grupo === grupo);
  const asignadas = deGrupo('asignado');
  const elegir = (vista: VistaDelPadron) => {
    onElegir(vista);
    setAbierto(false);
  };
  const opciones = (lista: VistaDelPadron[]) =>
    lista.map((v) => <OpcionDeVista key={v.id} vista={v} puesta={v.id === vigente?.id} onElegir={elegir} />);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={`Vista: ${titulo}`}
        className={controlDeBarraClass}
      >
        <Rows3 size={13} className="text-muted-foreground" />
        <span className="max-w-[14rem] truncate">{titulo}</span>
        <ChevronDown size={13} className={`text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <>
          <div {...propsOverlay} />
          {/* Flota: sombra y no borde (`lib/styles.ts`). */}
          <div className="absolute left-0 top-full z-30 mt-1.5 w-72 overflow-hidden rounded-xl bg-card shadow-panel">
            <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-1">
              {opciones(deGrupo('general'))}

              <div className="mt-1 border-t border-border pt-1">
                <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold text-muted-foreground">Para repartir hoy</p>
                {opciones(deGrupo('para_repartir'))}
              </div>

              <div className="mt-1 border-t border-border pt-1">
                <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold text-muted-foreground">Asignado a</p>
                {asignadas.length > 0 ? (
                  opciones(asignadas)
                ) : (
                  <p className="px-2 pb-2 text-xs text-muted-foreground">
                    {estadoDelReparto === 'cargando'
                      ? 'Contando…'
                      : estadoDelReparto === 'error'
                        ? 'No se pudo leer el reparto.'
                        : 'Todavía nadie tiene contactos asignados.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function OpcionDeVista({
  vista,
  puesta,
  onElegir,
}: {
  vista: VistaDelPadron;
  puesta: boolean;
  onElegir: (vista: VistaDelPadron) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onElegir(vista)}
      aria-pressed={puesta}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted ${
        puesta ? 'bg-muted font-semibold' : ''
      }`}
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-primary">
        {puesta && <Check size={13} strokeWidth={2.5} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">{vista.rotulo}</span>
      {/* La cifra es la que la tabla va a devolver: sin cifra todavía, no se
          dibuja un cero que se leería «no hay». */}
      {vista.contactos !== undefined && (
        <span className="shrink-0 tabular-nums text-muted-foreground">{cifra(vista.contactos)}</span>
      )}
    </button>
  );
}
