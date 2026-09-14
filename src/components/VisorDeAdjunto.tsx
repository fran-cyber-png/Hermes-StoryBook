import { useState, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, X } from 'lucide-react';
import { usePopover } from '../lib/teclado/usePopover';

/**
 * EL VISOR — un adjunto en grande, con Descargar y Cerrar a la vista.
 *
 * Abre lo que se puede MIRAR: imagen, video y PDF. El resto de los documentos no
 * se abre acá: el navegador no sabe mostrarlos, y se descargan directo. Nació
 * porque un voucher o un comprobante no se leen ajustados a la pantalla.
 *
 * 🔴 **No es el único visor.** La foto del hilo de WhatsApp la abre
 * `VisorDeImagen` (#997), que vive en el hilo, recorre sus fotos y cita. Éste abre
 * el video y el PDF de una burbuja, la imagen de un comentario y la de su
 * publicación, y la imagen de una burbuja cuando quien la monta no le pasa
 * `onAmpliar` (el hilo de Messenger). Detalle: `docs/reglas/mensajeria-en-el-hilo.md`.
 *
 * Vive en `components/` porque lo usan los hilos de WhatsApp y Messenger y los
 * comentarios de Facebook e Instagram, y no sabe nada de ninguno: recibe qué
 * mostrar y qué hacer al descargar.
 *
 * ── En el mismo webview, nunca en una pestaña ────────────────────────────
 * En la cáscara un `blob:` en pestaña nueva muere: el shim de Tauri
 * (`enlacesExternos.ts`) lo manda al opener del sistema, que no sabe abrirlo.
 *
 * ── Cómo se cierra ───────────────────────────────────────────────────────
 * Escape, la X, o un clic en el fondo oscuro. Un clic SOBRE el adjunto no
 * cierra: en la imagen alterna el tamaño real, y en el video o el PDF es para
 * usarlos. Escape cierra el visor y NO la conversación de atrás (`usePopover`).
 *
 * ── En un portal, en `body` ──────────────────────────────────────────────
 * Se dibuja desde adentro de una burbuja, y una burbuja recién llegada entra con
 * una animación de `transform`: un ancestro con `transform` vuelve a `fixed`
 * relativo a ÉL, y el visor quedaría del tamaño de la fila en vez de la pantalla.
 *
 * Entra perezoso (`perezoso()` en `HiloWhatsapp.tsx` y `ContextoDelComentario.tsx`):
 * se abre con un clic, y el arranque tiene el techo justo (`npm run presupuesto`).
 * Si su chunk no carga, no se dibuja y lo de atrás sigue en pie (`lib/perezoso.ts`).
 *
 * ⚠️ **Descargar llega como callback, y no importando cómo se descarga.** El de
 * WhatsApp arrastraba `conversacionWa`, y un módulo del arranque importado desde
 * un chunk perezoso obliga al bundler a partirlo: medido, 1,5 KB gzip más en el
 * arranque por un import de una función de seis líneas.
 */
export function VisorDeAdjunto({
  clase,
  src,
  nombre,
  onDescargar,
  onCerrar,
}: {
  /** Qué se muestra: `documento` es un PDF (lo que no es PDF no se abre acá). */
  clase: 'imagen' | 'sticker' | 'video' | 'documento';
  /** Un blob ya bajado, o una URL que la etiqueta pueda pedir sin sesión. */
  src: string;
  /** El título, y con qué nombre se guarda. */
  nombre: string;
  /** Sin esto no hay botón. Si devuelve una promesa que falla, se dice. */
  onDescargar?: () => void | Promise<void>;
  onCerrar: () => void;
}) {
  const [tamanoReal, setTamanoReal] = useState(false);
  const [descarga, setDescarga] = useState<'lista' | 'bajando' | 'fallo'>('lista');
  usePopover(true, onCerrar);

  const esImagen = clase === 'imagen' || clase === 'sticker';

  async function descargar() {
    if (!onDescargar || descarga === 'bajando') return;
    setDescarga('bajando');
    try {
      await onDescargar();
      setDescarga('lista');
    } catch {
      setDescarga('fallo');
    }
  }
  const boton =
    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60';

  // 🔴 Un portal saca el visor del DOM de la burbuja pero NO del árbol de React:
  // sus eventos siguen subiendo hasta ella. La burbuja cita con doble clic, así
  // que un doble clic para ver la foto en tamaño real dejaba el mensaje citado.
  const cortar = (e: SyntheticEvent) => e.stopPropagation();

  return createPortal(
    <div
      role="dialog"
      aria-label={`${nombre} — Escape para cerrar`}
      className="fixed inset-0 z-50 flex flex-col bg-navy/90"
      onClick={cortar}
      onDoubleClick={cortar}
    >
      <div className="flex shrink-0 items-center gap-2 px-4 py-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{nombre}</p>
        {onDescargar && (
          <button type="button" onClick={() => void descargar()} className={boton} title={`Descargar ${nombre}`}>
            {descarga === 'bajando' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {descarga === 'fallo' ? 'No se pudo — reintentar' : 'Descargar'}
          </button>
        )}
        <button type="button" onClick={onCerrar} className={boton} title="Cerrar · Esc" aria-label="Cerrar">
          <X size={16} />
        </button>
      </div>

      {/* El fondo cierra; lo que está adentro, no. `target === currentTarget` es
          lo que distingue un clic en el fondo de uno que burbujea desde el adjunto. */}
      <div
        data-fondo-del-visor
        className={
          'flex min-h-0 flex-1 p-4 ' +
          (esImagen && tamanoReal ? 'items-start justify-start overflow-auto' : 'items-center justify-center')
        }
        onClick={(e) => {
          if (e.target === e.currentTarget) onCerrar();
        }}
      >
        {esImagen ? (
          <img
            src={src}
            alt={nombre}
            onClick={() => setTamanoReal((v) => !v)}
            title={tamanoReal ? 'Ajustar a la pantalla' : 'Ver en tamaño real'}
            className={
              'rounded-lg ' +
              (tamanoReal ? 'm-auto max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain')
            }
          />
        ) : clase === 'video' ? (
          <video src={src} controls autoPlay className="max-h-full max-w-full rounded-lg" />
        ) : (
          <iframe src={src} title={nombre} className="h-full w-full max-w-5xl rounded-lg bg-white" />
        )}
      </div>
    </div>,
    document.body,
  );
}
