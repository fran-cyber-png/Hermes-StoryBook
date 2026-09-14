import { describe, expect, test } from 'vitest';
import {
  ENCUADRE_INICIAL,
  ZOOM_MAXIMO,
  encuadreDelVisor,
  imagenesDelHilo,
  vecinoEnElVisor,
} from './encuadreDelVisor';
import type { MensajeHilo } from './conversacionWa';

const AHORA = '2026-09-11T15:42:00.000Z';

function mensaje(id: number, extra: Partial<MensajeHilo> = {}): MensajeHilo {
  return { id, direccion: 'entrante', autor: '51987654321', texto: null, occurred_at: AHORA, external_id: `wa:${id}`, ...extra } as MensajeHilo;
}
const imagen = (archivo: string) => ({ clase: 'imagen' as const, archivo, mime: 'image/jpeg', nombre: null });

describe('las imágenes que recorre el visor', () => {
  test('son las imágenes y stickers del hilo, en el orden del hilo', () => {
    const lista = imagenesDelHilo([
      mensaje(1, { media: imagen('wa-1.jpg') }),
      mensaje(2, { texto: 'hola' }),
      mensaje(3, { media: { clase: 'sticker', archivo: 'wa-3.webp', mime: 'image/webp', nombre: null } }),
      mensaje(4, { media: { clase: 'documento', archivo: 'wa-4.pdf', mime: 'application/pdf', nombre: 'temario.pdf' } }),
      mensaje(5, { media: { clase: 'video', archivo: 'wa-5.mp4', mime: 'video/mp4', nombre: null } }),
    ]);
    expect(lista.map((m) => m.external_id)).toEqual(['wa:1', 'wa:3']);
  });

  /**
   * La burbuja de un mensaje eliminado u ocultado ya no muestra el adjunto. Si el
   * visor lo siguiera ofreciendo, las flechas mostrarían una foto que la pantalla
   * dice que ya no está.
   */
  test('🔴 un mensaje eliminado u ocultado no entra al recorrido', () => {
    const lista = imagenesDelHilo([
      mensaje(1, { media: imagen('wa-1.jpg'), eliminado: { eliminadoEn: AHORA, revocadoEnWhatsapp: true } }),
      mensaje(2, { media: imagen('wa-2.jpg'), eliminado: { eliminadoEn: AHORA, revocadoEnWhatsapp: false } }),
      mensaje(3, { media: imagen('wa-3.jpg') }),
    ]);
    expect(lista.map((m) => m.external_id)).toEqual(['wa:3']);
  });
});

describe('las flechas', () => {
  test('avanzan y retroceden de a una', () => {
    expect(vecinoEnElVisor(1, 3, 1)).toBe(2);
    expect(vecinoEnElVisor(1, 3, -1)).toBe(0);
  });

  /** Dar la vuelta haría que la última foto «siga» con la primera, y no se entiende dónde se está. */
  test('en los bordes no dan la vuelta: no hay vecino', () => {
    expect(vecinoEnElVisor(0, 3, -1)).toBeNull();
    expect(vecinoEnElVisor(2, 3, 1)).toBeNull();
  });
});

describe('el encuadre: zoom, movimiento y giro', () => {
  test('acercar y alejar van por pasos, entre 1× y el tope', () => {
    let e = ENCUADRE_INICIAL;
    e = encuadreDelVisor(e, { tipo: 'acercar' });
    expect(e.zoom).toBeGreaterThan(1);
    for (let i = 0; i < 20; i++) e = encuadreDelVisor(e, { tipo: 'acercar' });
    expect(e.zoom).toBe(ZOOM_MAXIMO);
    for (let i = 0; i < 20; i++) e = encuadreDelVisor(e, { tipo: 'alejar' });
    expect(e.zoom).toBe(1);
  });

  test('sin zoom la foto no se mueve: arrastrar no la saca del centro', () => {
    const e = encuadreDelVisor(ENCUADRE_INICIAL, { tipo: 'mover', dx: 80, dy: -40 });
    expect(e).toEqual(ENCUADRE_INICIAL);
  });

  test('con zoom, arrastrar la mueve', () => {
    const cerca = encuadreDelVisor(ENCUADRE_INICIAL, { tipo: 'acercar' });
    const movida = encuadreDelVisor(cerca, { tipo: 'mover', dx: 80, dy: -40 });
    expect([movida.x, movida.y]).toEqual([80, -40]);
  });

  /** Si al volver a 1× quedara el desplazamiento, la foto quedaría corrida y sin forma de centrarla. */
  test('🔴 al volver a 1× la foto vuelve al centro', () => {
    let e = encuadreDelVisor(ENCUADRE_INICIAL, { tipo: 'acercar' });
    e = encuadreDelVisor(e, { tipo: 'mover', dx: 120, dy: 60 });
    for (let i = 0; i < 20; i++) e = encuadreDelVisor(e, { tipo: 'alejar' });
    expect([e.zoom, e.x, e.y]).toEqual([1, 0, 0]);
  });

  test('el doble clic alterna entre 1× y 2×', () => {
    const cerca = encuadreDelVisor(ENCUADRE_INICIAL, { tipo: 'alternar' });
    expect(cerca.zoom).toBe(2);
    expect(encuadreDelVisor(cerca, { tipo: 'alternar' })).toEqual(ENCUADRE_INICIAL);
  });

  test('girar va de a 90° a la derecha y da la vuelta completa', () => {
    let e = ENCUADRE_INICIAL;
    const giros: number[] = [];
    for (let i = 0; i < 4; i++) {
      e = encuadreDelVisor(e, { tipo: 'girar' });
      giros.push(e.giro);
    }
    expect(giros).toEqual([90, 180, 270, 0]);
  });

  /** El giro es para leer un voucher fotografiado de costado: que se pierda al hacer zoom obligaría a girar de nuevo. */
  test('restablecer deja la foto como llegó, giro incluido', () => {
    let e = encuadreDelVisor(ENCUADRE_INICIAL, { tipo: 'girar' });
    e = encuadreDelVisor(e, { tipo: 'acercar' });
    expect(e.giro).toBe(90);
    expect(encuadreDelVisor(e, { tipo: 'restablecer' })).toEqual(ENCUADRE_INICIAL);
  });
});
