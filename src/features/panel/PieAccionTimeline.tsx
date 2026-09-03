import { ShoppingCart, UserRoundPen } from 'lucide-react';
import type { EstadoContacto } from './estadoContacto';

interface PropsPieAccion {
  estado: EstadoContacto;
  /** Abre el registro de la venta. Sin esto no hay botón — nunca un no-op (MVP-7). */
  onVender?: () => void;
  /**
   * LA ACCIÓN PRIMARIA DE CAMPAÑA: abrir la ficha rápida.
   *
   * 🔴 **En campaña este pie no dibujaba NADA**, porque su único botón era
   * «Registrar venta» y ahí no se le pasa `onVender` (registrar una venta es
   * superficie de `ventas`). El resultado: la columna entera terminaba en una
   * acción fantasma punteada flotando en el medio del panel, con media pantalla
   * de vacío debajo y ningún lugar donde la mano vaya sola.
   *
   * ⚠️ **No es una acción inventada para llenar el hueco.** ADR 0080 lo dice con
   * esas palabras: anotar quién es la persona que acaba de escribir es «la acción
   * central del trabajo» del comando de campaña — y midió que en 73
   * conversaciones se había registrado **cero** veces, porque la ruta estaba
   * vedada. Destrabada la ruta, faltaba el lugar donde apretarla.
   */
  onAnotarQuienEs?: () => void;
  /** ¿Ya hay ficha? Cambia el verbo, no la acción: anotar la primera vez, editar después. */
  tieneFicha?: boolean;
}

/**
 * EL PIE DEL PANEL — la acción primaria del módulo, y **siempre está**.
 *
 * ══ QUÉ ESTABA MAL ═══════════════════════════════════════════════════════
 *
 * Este pie exigía un handler para dibujar el botón (bien: nunca un no-op) y
 * `PanelDerecho` lo montaba **sin pasarle ninguno**. La guarda hacía justo lo
 * que promete, así que el botón **no podía aparecer en ningún estado** — ni
 * siquiera para un cliente. Nadie llegó a cablearlo cuando el rediseño del
 * timeline reemplazó a `AccionesContacto`, y el `CLAUDE.md` siguió diciendo que
 * estaba «al pie y siempre visible».
 *
 * ══ Y POR QUÉ AHORA NO DEPENDE DEL ESTADO ════════════════════════════════
 *
 * Antes el botón salía solo con la ficha en `cliente`, y para un lead nuevo
 * decía «Marcar como interesado». Eso invierte el orden real de los hechos: una
 * venta puede caer en CUALQUIER conversación, y el estado de la ficha es
 * justamente lo que la vendedora no puede adivinar antes de necesitarlo. Si el
 * botón aparece y desaparece según un dato que llega de Cerberus con hasta 12
 * segundos de retraso, deja de ser un lugar donde la mano va sola.
 *
 * Decisión del dueño (4-ago-2026): *«que siempre esté ahí el botón para
 * comprar»*. Lo que cambia según el estado es **a dónde lleva**
 * (`VentaDesdeElPanel`), no si existe.
 *
 * ⚠️ **Los dos módulos tienen pie, y cada uno el suyo** (24-ago-2026). Sigue
 * siendo UN botón: no se apilan dos acciones primarias — una conversación
 * pertenece a un módulo, así que sólo puede llegar uno de los dos handlers.
 *
 * Clavado y no al final del scroll por la lección de ADR 0017: a 1280×720 con
 * dos respuestas cargadas, el reparto flex lo empujaba fuera del panel.
 */
/**
 * ⚠️ **`group` + `transform`/`opacity` y nada más.** El ícono se corre un pixel
 * al pasar por encima y el botón se hunde al apretarlo: es la diferencia entre
 * un rectángulo azul y algo que se siente como un control. Nunca se anima
 * `width`, `height`, `top` ni `left` — eso dispara layout en cada frame.
 *
 * La curva es `ease-house` (`cubic-bezier(0.32, 0.72, 0, 1)`, en `index.css`),
 * la misma de toda la app: una salida rápida que frena despacio, que es cómo se
 * mueve algo con masa. `ease-in-out` se ve como una animación; esto se siente
 * como un objeto.
 *
 * ⚠️ Y no hace falta apagarlo a mano para quien pidió menos movimiento:
 * `index.css` ya colapsa toda `transition-duration` bajo
 * `prefers-reduced-motion`.
 */
const CLASE_BOTON =
  'group flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold ' +
  'transition-[background-color,transform] duration-200 ease-house ' +
  'active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const CLASE_ICONO =
  'transition-transform duration-200 ease-house group-hover:-translate-y-px group-active:translate-y-0';

export function PieAccionTimeline({ estado, onVender, onAnotarQuienEs, tieneFicha }: PropsPieAccion) {
  if (!onVender && !onAnotarQuienEs) return null;

  return (
    <div className="shrink-0 border-t border-border px-4 py-3">
      {onVender ? (
        <button
          type="button"
          onClick={onVender}
          title={
            estado.tono === 'cliente'
              ? 'Ya es cliente en Cerberus: abre el formulario con el precio cargado'
              : 'Registrar una venta de esta persona'
          }
          className={CLASE_BOTON + ' bg-primary text-primary-foreground hover:bg-primary-hover'}
        >
          <ShoppingCart size={15} aria-hidden className={CLASE_ICONO} />
          Registrar venta
        </button>
      ) : (
        <button
          type="button"
          onClick={onAnotarQuienEs}
          title="Nombre, apellido, correo y prioridad de esta persona"
          className={CLASE_BOTON + ' bg-primary text-primary-foreground hover:bg-primary-hover'}
        >
          <UserRoundPen size={15} aria-hidden className={CLASE_ICONO} />
          {tieneFicha ? 'Editar la ficha' : 'Anotar quién es'}
        </button>
      )}
    </div>
  );
}
