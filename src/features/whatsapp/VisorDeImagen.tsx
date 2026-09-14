import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Copy, CornerUpLeft, Download, Loader2, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useBlobAutenticado } from '../../lib/datos/blobAutenticado';
import { SELECTOR_CAMPOS } from '../../lib/teclado/escapeDePopover';
import { usePopover } from '../../lib/teclado/usePopover';
import { urlMedia, type MensajeHilo } from './conversacionWa';
import { nombreDeDescarga } from './descargarAdjunto';
import {
  ENCUADRE_INICIAL,
  ZOOM_MAXIMO,
  encuadreDelVisor,
  vecinoEnElVisor,
  type AccionDeEncuadre,
  type Encuadre,
} from './encuadreDelVisor';

/**
 * LA IMAGEN AMPLIADA — con lo que la vendedora hace con una foto que le mandan.
 *
 * Antes era la foto sobre un velo y nada más (pedido del dueño, 11-sep-2026). Lo
 * que llega por el chat es sobre todo el voucher del pago, y con eso hay que:
 * **bajarlo** para subirlo a Cerberus, **copiarlo** para pegarlo en otro lado,
 * **acercarlo** para leer el número de operación, **girarlo** si vino sacado de
 * costado y **contestarle** («recibido») citando justo esa foto. Las flechas
 * recorren las fotos del hilo sin cerrar, como en WhatsApp.
 *
 * ── Decisiones que no se ven en la captura ─────────────────────────────────
 * · **Va en un portal sobre `body`.** Adentro del hilo un `fixed` queda atado a
 *   cualquier ancestro con `transform` —las burbujas nuevas entran animadas— y
 *   atrapado debajo del panel de al lado por su contexto de apilamiento.
 * · **Vive a nivel del HILO, no de la burbuja**: una foto sola no sabe cuáles
 *   son sus vecinas, ni puede poner la cita en la caja.
 * · **Descargar es `<a download>` sobre el blob que ya está en memoria**, el
 *   mismo camino que el documento (`DocumentoBajoDemanda`): sin `target="_blank"`,
 *   que en la cáscara manda el blob al opener del sistema y muere.
 * · **Y con el mismo nombre que la burbuja** (`nombreDeDescarga`, en
 *   `descargarAdjunto.ts`): la misma foto no se guarda con dos nombres.
 * · **Copiar solo se ofrece si hay portapapeles de imágenes** (`ClipboardItem`):
 *   un botón que no puede copiar y dice «Copiada» es peor que no tenerlo.
 */

interface Props {
  /** Las fotos que recorren las flechas, ya filtradas (`imagenesDelHilo`). */
  imagenes: MensajeHilo[];
  indice: number;
  onIndice: (indice: number) => void;
  /** Quién mandó cada foto, con la misma lectura que ya usa el hilo. */
  autorDe: (m: MensajeHilo) => string;
  /** `null` en modo revisión: ahí se aprueba un texto preparado, no se compone uno. */
  onResponder: ((m: MensajeHilo) => void) | null;
  onCerrar: () => void;
}

/** Un clic en la barra o en la foto no puede llegar al velo, que cierra. */
function sinCerrar(e: MouseEvent) {
  e.stopPropagation();
}

export function VisorDeImagen({ imagenes, indice, onIndice, autorDe, onResponder, onCerrar }: Props) {
  const actual = imagenes[indice];
  const media = actual.media!;
  const { url: src, fallo } = useBlobAutenticado(urlMedia(media.archivo));
  const anterior = vecinoEnElVisor(indice, imagenes.length, -1);
  const siguiente = vecinoEnElVisor(indice, imagenes.length, 1);

  /**
   * El encuadre es de UNA foto: al pasar a la siguiente arranca derecho y sin
   * zoom. Se guarda junto a quién pertenece y se deriva, en vez de limpiarlo
   * con un efecto que pintaría un cuadro con el zoom de la foto anterior.
   */
  const [estado, setEstado] = useState<{ de: string; encuadre: Encuadre }>({
    de: actual.external_id,
    encuadre: ENCUADRE_INICIAL,
  });
  const encuadre = estado.de === actual.external_id ? estado.encuadre : ENCUADRE_INICIAL;
  function encuadrar(accion: AccionDeEncuadre) {
    setEstado((e) => ({
      de: actual.external_id,
      encuadre: encuadreDelVisor(e.de === actual.external_id ? e.encuadre : ENCUADRE_INICIAL, accion),
    }));
  }

  const dialogo = useRef<HTMLDivElement>(null);
  const imagen = useRef<HTMLImageElement>(null);
  const previo = useRef<HTMLElement | null>(null);
  const arrastre = useRef<{ x: number; y: number } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  // El foco entra al visor para que las flechas y el zoom de teclado le hablen a
  // él y no a la caja de escribir que quedó atrás.
  useEffect(() => {
    previo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogo.current?.focus({ preventScroll: true });
  }, []);

  /** Cerrar devuelve el foco a la miniatura. `preventScroll`: enfocar no puede mover el hilo. */
  function cerrar() {
    previo.current?.focus({ preventScroll: true });
    onCerrar();
  }
  // Escape cierra la foto y NO la conversación de atrás (captura + corte).
  usePopover(true, cerrar);

  /**
   * LAS TECLAS DEL VISOR: ← → recorren, + − acercan y alejan, 0 restablece.
   *
   * 🔴 **En la VENTANA, no en el `onKeyDown` del diálogo.** Así estaban, y la
   * captura lo desmintió: alejar hasta 1× DESHABILITA el botón «Alejar», un botón
   * deshabilitado suelta el foco al `body`, y desde ahí las flechas ya no llegaban
   * a nadie. En captura y cortando, como `usePopover`: mientras la foto está
   * abierta, estas teclas son de ella y no de los atajos de la pantalla de atrás.
   * Sin arreglo de dependencias a propósito: se vuelve a registrar en cada
   * render, que acá es por cada gesto, y así nunca lee un índice viejo.
   */
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.(SELECTOR_CAMPOS)) return;
      const accion =
        e.key === 'ArrowLeft' && anterior != null ? () => onIndice(anterior)
        : e.key === 'ArrowRight' && siguiente != null ? () => onIndice(siguiente)
        : e.key === '+' || e.key === '=' ? () => encuadrar({ tipo: 'acercar' })
        : e.key === '-' ? () => encuadrar({ tipo: 'alejar' })
        : e.key === '0' ? () => encuadrar({ tipo: 'restablecer' })
        : null;
      if (!accion) return;
      e.preventDefault();
      e.stopPropagation();
      accion();
    };
    window.addEventListener('keydown', alTeclear, true);
    return () => window.removeEventListener('keydown', alTeclear, true);
  });

  const [copia, setCopia] = useState<'copiada' | 'fallo' | null>(null);
  useEffect(() => {
    if (!copia) return;
    const t = window.setTimeout(() => setCopia(null), 1500);
    return () => window.clearTimeout(t);
  }, [copia]);
  const puedeCopiar = typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function';

  async function copiar() {
    const img = imagen.current;
    if (!img) return;
    try {
      await copiarImagen(img);
      setCopia('copiada');
    } catch {
      setCopia('fallo');
    }
  }

  const textoVigente = actual.editado?.texto ?? actual.texto;
  const fecha = new Date(actual.occurred_at);
  const cuando = `${fecha.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })} · ${fecha.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
  const girada = encuadre.giro === 90 || encuadre.giro === 270;

  return createPortal(
    <div
      ref={dialogo}
      role="dialog"
      aria-modal="true"
      aria-label="Imagen ampliada"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex animate-in flex-col bg-navy/95 outline-none backdrop-blur-sm duration-200 ease-house fade-in"
      onClick={cerrar}
    >
      {/* LA BARRA: de quién y cuándo a la izquierda, las acciones a la derecha. */}
      {/* `relative z-10`: con zoom la foto crece por encima de su escenario, y
          sin esto tapaba justo los botones de Alejar y Girar (lo mostró la
          captura, no un test). El escenario además la recorta. */}
      <div className="relative z-10 flex shrink-0 items-center gap-3 px-4 py-3 text-white" onClick={sinCerrar}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{autorDe(actual)}</p>
          {/* El contador no se corta: en angosto se achica la fecha, no «2 de 3». */}
          <p className="flex min-w-0 gap-1 font-mono text-[11px] tabular-nums text-white/70">
            <span className="truncate">{cuando}</span>
            {imagenes.length > 1 && <span className="shrink-0">· {indice + 1} de {imagenes.length}</span>}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <span className="hidden items-center gap-0.5 sm:flex">
            <BotonDelVisor etiqueta="Alejar" disabled={encuadre.zoom <= 1} onClick={() => encuadrar({ tipo: 'alejar' })}>
              <ZoomOut size={18} />
            </BotonDelVisor>
            <BotonDelVisor etiqueta="Acercar" disabled={encuadre.zoom >= ZOOM_MAXIMO} onClick={() => encuadrar({ tipo: 'acercar' })}>
              <ZoomIn size={18} />
            </BotonDelVisor>
          </span>
          <BotonDelVisor etiqueta="Girar a la derecha" onClick={() => encuadrar({ tipo: 'girar' })}>
            <RotateCw size={18} />
          </BotonDelVisor>

          <span aria-hidden className="mx-1.5 h-5 w-px bg-white/20" />

          {onResponder && (
            <BotonDelVisor
              etiqueta="Responder citando esta imagen"
              onClick={() => {
                // Sin devolver el foco a la miniatura: responder lo lleva a la caja.
                onResponder(actual);
                onCerrar();
              }}
            >
              <CornerUpLeft size={18} />
            </BotonDelVisor>
          )}
          {puedeCopiar && src && (
            <span className="relative flex">
              <BotonDelVisor etiqueta="Copiar la imagen" onClick={() => void copiar()}>
                {copia === 'copiada' ? <Check size={18} className="text-success" /> : <Copy size={18} />}
              </BotonDelVisor>
              {copia && (
                <span
                  role="status"
                  className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-navy-ink"
                >
                  {copia === 'copiada' ? 'Copiada' : 'No se pudo copiar'}
                </span>
              )}
            </span>
          )}
          {src && (
            <a
              href={src}
              download={nombreDeDescarga(media, actual.occurred_at)}
              aria-label="Descargar la imagen"
              title="Descargar la imagen"
              onClick={sinCerrar}
              className="ml-1 flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-semibold text-navy-ink transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Descargar</span>
            </a>
          )}

          <span aria-hidden className="mx-1.5 h-5 w-px bg-white/20" />

          <BotonDelVisor etiqueta="Cerrar" onClick={cerrar}>
            <X size={20} />
          </BotonDelVisor>
        </div>
      </div>

      {/* EL ESCENARIO. `container-type: size` es lo que deja que la foto girada
          se mida contra el alto y el ancho que de verdad tiene disponibles: con
          `%` el alto no se puede usar como tope del ancho. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 sm:px-20" style={{ containerType: 'size' }}>
        {fallo ? (
          <p className="text-sm text-white/80" onClick={sinCerrar}>No se pudo cargar la imagen.</p>
        ) : !src ? (
          <Loader2 size={28} className="animate-spin text-white/80" aria-label="Cargando la imagen" />
        ) : (
          <img
            ref={imagen}
            src={src}
            alt={media.nombre ?? `imagen de ${autorDe(actual)}`}
            draggable={false}
            onClick={sinCerrar}
            onDoubleClick={() => encuadrar({ tipo: 'alternar' })}
            onPointerDown={(e) => {
              if (encuadre.zoom === 1) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              arrastre.current = { x: e.clientX, y: e.clientY };
              setArrastrando(true);
            }}
            onPointerMove={(e) => {
              const desde = arrastre.current;
              if (!desde) return;
              encuadrar({ tipo: 'mover', dx: e.clientX - desde.x, dy: e.clientY - desde.y });
              arrastre.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={() => {
              arrastre.current = null;
              setArrastrando(false);
            }}
            onPointerCancel={() => {
              arrastre.current = null;
              setArrastrando(false);
            }}
            style={{
              maxWidth: girada ? '100cqh' : '100cqw',
              maxHeight: girada ? '100cqw' : '100cqh',
              transform: `translate(${encuadre.x}px, ${encuadre.y}px) scale(${encuadre.zoom}) rotate(${encuadre.giro}deg)`,
            }}
            className={
              'select-none rounded-lg object-contain shadow-2xl ' +
              (arrastrando ? '' : 'transition-transform duration-200 ease-house ') +
              (encuadre.zoom > 1 ? (arrastrando ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in')
            }
          />
        )}

        {anterior != null && (
          <BotonDeFlecha etiqueta="Imagen anterior" lado="izquierda" onClick={() => onIndice(anterior)}>
            <ChevronLeft size={24} />
          </BotonDeFlecha>
        )}
        {siguiente != null && (
          <BotonDeFlecha etiqueta="Imagen siguiente" lado="derecha" onClick={() => onIndice(siguiente)}>
            <ChevronRight size={24} />
          </BotonDeFlecha>
        )}
      </div>

      {/* El texto que vino con la foto: en un voucher suele ser «ya pagué». */}
      <div className="relative z-10 flex min-h-12 shrink-0 items-center justify-center px-6 py-3">
        {textoVigente && (
          <p onClick={sinCerrar} className="line-clamp-3 max-w-2xl whitespace-pre-wrap text-center text-sm text-white/90">
            {textoVigente}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * El PNG de la foto que ya está dibujada, al portapapeles.
 *
 * Se pasa por un lienzo porque el portapapeles solo acepta `image/png` en todos
 * los motores y lo que llega por WhatsApp es JPEG o WebP. Se dibuja el `<img>`
 * que ya está en pantalla —su `src` es un blob propio, así que el lienzo no queda
 * «contaminado»— en vez de volver a pedir el archivo. La promesa va ADENTRO del
 * `ClipboardItem` y no esperada antes: Safari descarta la escritura si el gesto
 * del clic ya terminó cuando se llama a `write`.
 */
async function copiarImagen(img: HTMLImageElement): Promise<void> {
  const png = new Promise<Blob>((listo, fallo) => {
    const lienzo = document.createElement('canvas');
    lienzo.width = img.naturalWidth;
    lienzo.height = img.naturalHeight;
    const contexto = lienzo.getContext('2d');
    if (!contexto) return fallo(new Error('sin lienzo 2d'));
    contexto.drawImage(img, 0, 0);
    lienzo.toBlob((blob) => (blob ? listo(blob) : fallo(new Error('el lienzo no dio un PNG'))), 'image/png');
  });
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

function BotonDelVisor({
  etiqueta,
  onClick,
  disabled = false,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={etiqueta}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex size-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function BotonDeFlecha({
  etiqueta,
  lado,
  onClick,
  children,
}: {
  etiqueta: string;
  lado: 'izquierda' | 'derecha';
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={etiqueta}
      aria-label={etiqueta}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={
        'absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ' +
        (lado === 'izquierda' ? 'left-3 sm:left-5' : 'right-3 sm:right-5')
      }
    >
      {children}
    </button>
  );
}
