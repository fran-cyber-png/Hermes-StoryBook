import { AlertTriangle, Loader2, Smartphone, X } from 'lucide-react';
import { useEscape } from '../../lib/teclado/useEscape';
import { ErrorApi } from '../../lib/datos/cliente';
import { useDesvincularMiLinea } from './miLinea';

/**
 * DESVINCULAR MI WHATSAPP — el reverso de `VincularMiWhatsapp` (decisión del
 * dueño, 22-ago-2026): una vez que la línea auto-vinculada está conectada, el
 * botón verde de "Vincular tu WhatsApp" se reemplaza por uno rojo de
 * "Desvincular WhatsApp" (`ConfiguracionPerfil.tsx`), y este es el modal de
 * confirmación que abre.
 *
 * No es solo un "¿estás segura?": la elección real es SI SE ELIMINAN LOS
 * CHATS o se mantienen (`routes/miLinea.ts:POST /desvincular`). "Eliminar" NO
 * borra un mensaje — el event store es append-only — retira la asignación
 * (`numero_vendedora`) para que el número deje de figurar como tuyo; el
 * comentario completo vive en el server, que es quien decide de verdad.
 *
 * ⚠️ **Las dos opciones cierran la sesión, así que las dos ocultan la
 * previsualización** (bandeja Y conversación) mientras dura — la diferencia
 * NO es "se ve" vs "no se ve", es si el número sigue siendo tuyo. "Mantener
 * los chats" no borra ni suelta nada: todo vuelve solo, completo, en cuanto
 * vuelves a escanear el QR (7-sep-2026).
 */
export function DesvincularMiWhatsapp({ onCerrar }: { onCerrar: () => void }) {
  useEscape(onCerrar);
  const desvincular = useDesvincularMiLinea();

  async function confirmar(eliminarChats: boolean) {
    try {
      await desvincular.mutateAsync(eliminarChats);
      onCerrar();
    } catch {
      /* el error lo muestra desvincular.error, abajo */
    }
  }

  const cargando = desvincular.isPending;
  // Cuál de los dos botones está en vuelo — para no prender el spinner de los DOS.
  const eligiendoEliminar = cargando && desvincular.variables === true;
  const eligiendoMantener = cargando && desvincular.variables === false;

  return (
    <>
      {/* Mismo arreglo que `VincularMiWhatsapp`/`ConfiguracionPerfil`: el
          contenedor de z-58 cubre toda la pantalla y tapaba el overlay de
          abajo — el click afuera nunca llegaba.
          🔴 z-55/z-58 — mismo motivo que en `VincularMiWhatsapp` (ver su
          docblock): este modal se abre SIEMPRE desde `ConfiguracionPerfil`,
          que ya ocupa z-40/z-50, y con esos mismos números su tarjeta quedaba
          por encima del velo de ESTE modal — Configuración se veía sin
          atenuar detrás. Por debajo de z-[60] a propósito: ahí viven las
          notificaciones de `Avisos.tsx`. */}
      <div className="fixed inset-0 z-[55] bg-navy/30 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="fixed inset-0 z-[58] flex items-center justify-center p-4" onClick={onCerrar}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Desvincular WhatsApp"
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-card shadow-panel"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border bg-destructive px-5 py-3 text-white">
            <div className="flex items-center gap-2 font-heading text-sm font-bold">
              <Smartphone size={16} /> Desvincular WhatsApp
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onCerrar}
              disabled={cargando}
              className="rounded-lg p-1 hover:bg-white/10 disabled:opacity-40"
            >
              <X size={16} />
            </button>
          </header>

          <div className="flex flex-col gap-3 p-5">
            <p className="text-sm leading-snug text-muted-foreground">
              Se cierra la sesión de WhatsApp de este número — vas a necesitar escanear un QR nuevo para
              volver a usarlo. Elegí qué pasa con los chats que ya tenías.
            </p>

            {desvincular.error && (
              <p className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-2 text-[12px] leading-snug text-destructive">
                <AlertTriangle size={13} className="mt-px shrink-0" />
                {desvincular.error instanceof ErrorApi
                  ? desvincular.error.message
                  : 'No se pudo desvincular — probá de nuevo.'}
              </p>
            )}

            <button
              type="button"
              onClick={() => void confirmar(false)}
              disabled={cargando}
              className="flex items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
            >
              {eligiendoMantener && <Loader2 size={14} className="animate-spin" />}
              Desvincular y mantener los chats
            </button>
            <button
              type="button"
              onClick={() => void confirmar(true)}
              disabled={cargando}
              className="flex items-center justify-center gap-2 rounded-lg bg-destructive py-2 text-sm font-bold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-40"
            >
              {eligiendoEliminar && <Loader2 size={14} className="animate-spin" />}
              Desvincular y eliminar los chats
            </button>
            <button
              type="button"
              onClick={onCerrar}
              disabled={cargando}
              className="text-[12px] font-semibold text-muted-foreground underline underline-offset-2 disabled:opacity-40"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
