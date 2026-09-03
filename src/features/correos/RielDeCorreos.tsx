import {
  Archive,
  CalendarClock,
  Clock,
  FileText,
  Inbox,
  Send,
  ShieldAlert,
  Star,
  Tag,
  Trash2,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { RIEL, type Riel } from '../../dominio/correo';
import { CLASE_TEXTO, esColorCategoria } from '../../dominio/paletaCategorias';
import type { EtiquetaDeCorreo } from './tipos';

/**
 * EL RIEL DE CARPETAS — la columna izquierda de la bandeja.
 *
 * ══ POR QUÉ LOS RÓTULOS NO ESTÁN ACÁ ════════════════════════════════════════
 *
 * Salen de `RIEL` (`src/dominio/correo.ts`), que es el catálogo cruzado contra
 * el del server por `rielEnParidad.test.ts`. Escribir «Recibidos» en este archivo
 * dejaría al riel dibujando una carpeta cuyo id el server no reconoce: la entrada
 * se ve perfecta y al tocarla contesta 400 `riel_desconocido`. Acá sólo viven el
 * ÍCONO y el dibujo.
 *
 * ⚠️ **El ícono sí vive acá, y a propósito.** Es la única parte de una entrada
 * que no significa nada del otro lado: el server no dibuja. Meterlo en el
 * catálogo obligaría a que `dominio/` —capa 1— importara `lucide-react`, que es
 * una dependencia de dibujo.
 */

const ICONO: Record<Riel, LucideIcon> = {
  recibidos: Inbox,
  destacados: Star,
  pospuestos: Clock,
  enviados: Send,
  borradores: FileText,
  programados: CalendarClock,
  archivados: Archive,
  papelera: Trash2,
  spam: ShieldAlert,
};

interface RielDeCorreosProps {
  actual: Riel;
  onElegir: (riel: Riel) => void;
  etiquetas: EtiquetaDeCorreo[];
  /** La etiqueta por la que se está filtrando, si hay alguna. */
  etiquetaActual: number | null;
  onElegirEtiqueta: (id: number | null) => void;
  onNuevaEtiqueta: () => void;
  /**
   * Cuántos hilos sin leer hay en cada carpeta. Ausente = todavía no se sabe.
   *
   * ⚠️ **Un conteo ausente NO se dibuja como cero.** «Recibidos 0» afirma que no
   * llegó nada; la ausencia del número no afirma nada, que es lo cierto mientras
   * la consulta viaja. Es el mismo criterio que `ritmo` en el composer: el campo
   * que no se pudo calcular no viaja en cero.
   */
  sinLeerPorRiel?: Partial<Record<Riel, number>>;
}

export function RielDeCorreos({
  actual,
  onElegir,
  etiquetas,
  etiquetaActual,
  onElegirEtiqueta,
  onNuevaEtiqueta,
  sinLeerPorRiel,
}: RielDeCorreosProps) {
  return (
    <nav
      aria-label="Carpetas de correo"
      className="flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border py-2 pl-2 pr-1"
    >
      {RIEL.map((entrada) => {
        const Icono = ICONO[entrada.id];
        const activo = actual === entrada.id && etiquetaActual === null;
        const sinLeer = sinLeerPorRiel?.[entrada.id];

        return (
          <button
            key={entrada.id}
            type="button"
            onClick={() => onElegir(entrada.id)}
            aria-current={activo ? 'page' : undefined}
            className={
              'flex items-center gap-3 rounded-full py-1.5 pl-3 pr-3 text-left text-[13px] transition-colors ' +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
              (activo
                ? 'bg-primary/15 font-bold text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')
            }
          >
            <Icono size={16} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{entrada.rotulo}</span>
            {/* ⚠️ El cero no se dibuja: una carpeta sin novedades no lleva número,
                igual que en la referencia. Dibujar «0» le da peso visual a la
                ausencia de trabajo, que es justo lo contrario de lo que sirve. */}
            {sinLeer !== undefined && sinLeer > 0 && (
              <span className="shrink-0 font-mono text-[11px] font-bold text-foreground">{sinLeer}</span>
            )}
          </button>
        );
      })}

      {/* ── Etiquetas ──
          Van abajo y separadas, como en la referencia: las carpetas son el
          esqueleto (siempre las mismas nueve) y las etiquetas son datos que el
          equipo crea. Mezclarlas haría que el riel cambie de largo según lo que
          alguien haya inventado esa semana. */}
      <div className="mt-4 flex items-center justify-between pl-3 pr-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Etiquetas
        </span>
        <button
          type="button"
          onClick={onNuevaEtiqueta}
          aria-label="Nueva etiqueta"
          title="Nueva etiqueta"
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Plus size={14} />
        </button>
      </div>

      {etiquetas.length === 0 ? (
        /* ⚠️ Una lista vacía se lee «se rompió», no «todavía no creaste ninguna»
           — el mismo criterio que `sinRemitentes` en el composer. */
        <p className="px-3 py-1 text-[11px] leading-relaxed text-muted-foreground">
          Sin etiquetas todavía.
        </p>
      ) : (
        etiquetas.map((e) => {
          const activo = etiquetaActual === e.id;
          const color = esColorCategoria(e.color) ? e.color : null;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onElegirEtiqueta(activo ? null : e.id)}
              aria-current={activo ? 'page' : undefined}
              className={
                'flex items-center gap-3 rounded-full py-1.5 pl-3 pr-3 text-left text-[13px] transition-colors ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
                (activo
                  ? 'bg-primary/15 font-bold text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')
              }
            >
              {/* La etiqueta lleva su color en el ÍCONO, no en el fondo: el fondo
                  ya lo usa el estado activo, y dos fondos compitiendo en el mismo
                  renglón hacen que no se distinga cuál está seleccionada. */}
              <Tag size={16} className={'shrink-0 ' + (color ? CLASE_TEXTO[color] : '')} />
              <span className="min-w-0 flex-1 truncate">{e.nombre}</span>
            </button>
          );
        })
      )}
    </nav>
  );
}
