import type { MensajeHilo } from './conversacionWa';

/**
 * EL VISOR DE IMÁGENES DEL HILO — lo que se decide, sin el dibujo.
 *
 * La foto ampliada era solo eso: una imagen sobre un velo, que se cerraba con un
 * clic. La vendedora no podía bajar el voucher para subirlo a Cerberus, ni leer
 * el número de operación de una captura chica, ni enderezar una foto sacada de
 * costado (pedido del dueño, 11-sep-2026). El dibujo vive en `VisorDeImagen.tsx`;
 * acá queda lo que se puede equivocar sin que se note en una captura.
 */

/**
 * Qué fotos recorren las flechas: las del hilo, en su orden, que la burbuja
 * todavía muestra. Un mensaje eliminado u ocultado ya no dibuja su adjunto, así
 * que tampoco puede aparecer al pasar de una foto a otra.
 */
export function imagenesDelHilo(mensajes: MensajeHilo[]): MensajeHilo[] {
  return mensajes.filter(
    (m) => !m.eliminado && (m.media?.clase === 'imagen' || m.media?.clase === 'sticker'),
  );
}

/** La foto de al lado, o `null` en el borde: el recorrido no da la vuelta. */
export function vecinoEnElVisor(indice: number, total: number, paso: 1 | -1): number | null {
  const siguiente = indice + paso;
  return siguiente < 0 || siguiente >= total ? null : siguiente;
}

export const ZOOM_MAXIMO = 4;
const PASO_DE_ZOOM = 0.5;

export interface Encuadre {
  zoom: number;
  /** Desplazamiento en píxeles de pantalla. Solo existe con zoom. */
  x: number;
  y: number;
  giro: 0 | 90 | 180 | 270;
}

export const ENCUADRE_INICIAL: Encuadre = { zoom: 1, x: 0, y: 0, giro: 0 };

export type AccionDeEncuadre =
  | { tipo: 'acercar' }
  | { tipo: 'alejar' }
  | { tipo: 'alternar' }
  | { tipo: 'girar' }
  | { tipo: 'restablecer' }
  | { tipo: 'mover'; dx: number; dy: number };

/** Con zoom 1 no hay nada que mover: se centra, para que la foto no quede corrida sin forma de volver. */
function conZoom(e: Encuadre, zoom: number): Encuadre {
  const acotado = Math.min(ZOOM_MAXIMO, Math.max(1, zoom));
  return acotado === 1 ? { ...e, zoom: 1, x: 0, y: 0 } : { ...e, zoom: acotado };
}

export function encuadreDelVisor(e: Encuadre, accion: AccionDeEncuadre): Encuadre {
  switch (accion.tipo) {
    case 'acercar':
      return conZoom(e, e.zoom + PASO_DE_ZOOM);
    case 'alejar':
      return conZoom(e, e.zoom - PASO_DE_ZOOM);
    case 'alternar':
      return conZoom(e, e.zoom === 1 ? 2 : 1);
    case 'girar':
      return { ...e, giro: ((e.giro + 90) % 360) as Encuadre['giro'] };
    case 'restablecer':
      return ENCUADRE_INICIAL;
    case 'mover':
      return e.zoom === 1 ? e : { ...e, x: e.x + accion.dx, y: e.y + accion.dy };
  }
}
