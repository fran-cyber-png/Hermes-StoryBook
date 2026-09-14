import { ChartNoAxesColumn, MessageCircleMore, type LucideIcon } from 'lucide-react';

/**
 * LA PÍLDORA DE ABAJO EN EL CELULAR — Mensajes y Pipeline, sólo para campaña.
 *
 * ══ POR QUÉ EXISTE, Y POR QUÉ SÓLO PARA CAMPAÑA ═════════════════════════════
 *
 * En el celular no hay riel de vistas (no entra a 390 px), así que hasta el
 * 12-sep-2026 Mensajes era la única pantalla. Un comando de campaña trabaja
 * dos cosas desde el teléfono: contestar y ver cómo va el embudo del candidato.
 * Pedido del dueño (ADR 0113): una píldora abajo con esas dos y nada más. Las
 * vendedoras de la Escuela no la ven —para ventas el celular sigue siendo
 * Mensajes—: quien la monta decide (`App.tsx`, con `esDeCampana`), no este
 * componente.
 *
 * ══ LA FORMA ════════════════════════════════════════════════════════════════
 *
 * Una píldora **flotante**, centrada y al ancho de su contenido, encima de la
 * lista: la fila de abajo se ve detrás, desvanecida por el degradado. Dos
 * destinos separados por una línea fina. La activa va en el azul de la marca —
 * ícono y rótulo—; la otra en gris. Nada más la distingue: el dueño sacó el
 * punto de debajo del rótulo al verla (12-sep-2026). Sin fondo lleno, sin
 * globos ni conteos: es navegación, no una alarma. El pie lleva el
 * `safe-area-inset-bottom` para que la barra de gestos del teléfono quede
 * debajo de la píldora y no encima.
 *
 * ⚠️ **Flota, así que lo de atrás tiene que dejarle lugar.** El envoltorio es
 * `absolute` sobre la columna de contenido y NO recibe toques
 * (`pointer-events-none`): a los costados de la píldora la lista se sigue
 * tocando. Y para que la última fila se pueda leer, quien monta la barra
 * publica `--piso-movil` (`App.tsx`) y los contenedores que scrollean lo suman a
 * su padding de abajo. Un `fixed` obligaría a lo mismo, con un marco peor.
 */

export type DestinoMovil = 'bandeja' | 'embudo';

const DESTINOS: readonly { id: DestinoMovil; rotulo: string; icono: LucideIcon }[] = [
  { id: 'bandeja', rotulo: 'Mensajes', icono: MessageCircleMore },
  { id: 'embudo', rotulo: 'Pipeline', icono: ChartNoAxesColumn },
];

/** Cuánto lugar necesita abajo lo que scrollea detrás: la píldora, su aire y el degradado. */
export const PISO_MOVIL = '5.75rem';

export function BarraDeNavegacionMovil({
  activa,
  onElegir,
  hidden,
}: {
  activa: DestinoMovil;
  onElegir: (destino: DestinoMovil) => void;
  /** Con un chat encima, la barra sale del foco y del lector de pantalla. */
  hidden?: boolean;
}) {
  return (
    <nav
      aria-label="Secciones"
      hidden={hidden}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-background via-background/80 to-transparent pt-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div
        data-pildora
        className="pointer-events-auto flex w-fit divide-x divide-border rounded-full bg-card px-2 py-1.5 shadow-[0_6px_24px_-6px_rgba(22,33,58,0.28),0_1px_3px_rgba(22,33,58,0.08)]"
      >
        {DESTINOS.map((d) => {
          const puesta = d.id === activa;
          const Icono = d.icono;
          return (
            <button
              key={d.id}
              type="button"
              aria-current={puesta ? 'page' : undefined}
              onClick={() => onElegir(d.id)}
              className={
                'flex min-w-[5.5rem] flex-col items-center gap-0.5 px-3 py-1.5 font-heading text-[11px] font-semibold transition-[color,transform] duration-200 ease-house active:scale-[0.97] focus-visible:rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
                (puesta ? 'text-primary' : 'text-muted-foreground')
              }
            >
              <Icono size={22} strokeWidth={puesta ? 2.2 : 1.9} aria-hidden="true" />
              {d.rotulo}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
