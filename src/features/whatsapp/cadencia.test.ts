import { describe, expect, it } from 'vitest';
import { RED_CON_STREAM_MS } from '../../lib/datos/latido';
import {
  CADENCIA_HILO_FRIO_MS,
  CADENCIA_HILO_TIBIO_MS,
  CADENCIA_HILO_VIVO_MS,
  CADENCIA_SESION_MS,
  esLineaQueNoCorre,
  intervaloDeLaSesion,
  intervaloDelHilo,
} from './cadencia';

const AHORA = new Date('2026-08-19T12:00:00.000Z').getTime();
const haceMs = (ms: number) => new Date(AHORA - ms).toISOString();

describe('intervaloDelHilo — los tres escalones, sin stream', () => {
  it('un mensaje de recién: el ritmo de siempre', () => {
    expect(intervaloDelHilo(haceMs(1_000), AHORA, false)).toBe(CADENCIA_HILO_VIVO_MS);
    expect(intervaloDelHilo(haceMs(119_000), AHORA, false)).toBe(CADENCIA_HILO_VIVO_MS);
  });

  it('de hace media hora: tibio', () => {
    expect(intervaloDelHilo(haceMs(30 * 60_000), AHORA, false)).toBe(CADENCIA_HILO_TIBIO_MS);
  });

  it('de ayer: frío', () => {
    expect(intervaloDelHilo(haceMs(24 * 60 * 60_000), AHORA, false)).toBe(CADENCIA_HILO_FRIO_MS);
  });

  /**
   * Los bordes exactos, porque «< 2 min» y «<= 2 min» se leen igual y no son lo
   * mismo: a los 2 minutos clavados el hilo ya no es un ping-pong.
   */
  it('los bordes están donde dicen', () => {
    expect(intervaloDelHilo(haceMs(2 * 60_000 - 1), AHORA, false)).toBe(CADENCIA_HILO_VIVO_MS);
    expect(intervaloDelHilo(haceMs(2 * 60_000), AHORA, false)).toBe(CADENCIA_HILO_TIBIO_MS);
    expect(intervaloDelHilo(haceMs(60 * 60_000 - 1), AHORA, false)).toBe(CADENCIA_HILO_TIBIO_MS);
    expect(intervaloDelHilo(haceMs(60 * 60_000), AHORA, false)).toBe(CADENCIA_HILO_FRIO_MS);
  });
});

/**
 * 🔴 CON EL STREAM VIVO, SÓLO EL ESCALÓN FRÍO SE ESPACIA (docs/plan-borrar-el-
 * -polling.md §6 PR 4). Vivo y tibio son baratos y hacen que un chat que está
 * pasando AHORA no dependa de nada — ni siquiera del push.
 */
describe('intervaloDelHilo — con el stream vivo, sólo el frío cambia', () => {
  it('vivo y tibio no se tocan', () => {
    expect(intervaloDelHilo(haceMs(1_000), AHORA, true)).toBe(CADENCIA_HILO_VIVO_MS);
    expect(intervaloDelHilo(haceMs(30 * 60_000), AHORA, true)).toBe(CADENCIA_HILO_TIBIO_MS);
  });

  it('el frío se espacia a la red de 5 minutos', () => {
    expect(intervaloDelHilo(haceMs(24 * 60 * 60_000), AHORA, true)).toBe(RED_CON_STREAM_MS);
  });
});

/**
 * 🔴 EL CANDADO DEL FRENTE: LA CADENCIA DEGRADA HACIA MÁS FRECUENTE.
 *
 * Un hilo que se pide de más cuesta 21 ms; uno que se pide de menos le esconde
 * a la vendedora el mensaje que está esperando. Todos los casos en los que «no
 * se sabe» tienen que caer en el escalón más CORTO — y `NaN` es el que muerde
 * en silencio: con él las dos comparaciones dan `false` y el hilo se iría solo
 * al escalón más lento.
 */
describe('sin datos, el escalón más rápido', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['una cadena que no es fecha', 'la semana pasada'],
    ['una cadena vacía', ''],
  ])('%s → 5 s', (_que, valor) => {
    expect(intervaloDelHilo(valor as string | null | undefined, AHORA, false)).toBe(CADENCIA_HILO_VIVO_MS);
  });

  it('una fecha del FUTURO se lee como «recién», no como frío', () => {
    // El reloj del server puede ir adelante del nuestro: transcurrido negativo.
    expect(intervaloDelHilo(new Date(AHORA + 10 * 60_000).toISOString(), AHORA, false)).toBe(
      CADENCIA_HILO_VIVO_MS,
    );
  });

  it('acepta Date y número, no sólo la cadena ISO del server', () => {
    expect(intervaloDelHilo(new Date(AHORA - 1000), AHORA, false)).toBe(CADENCIA_HILO_VIVO_MS);
    expect(intervaloDelHilo(AHORA - 1000, new Date(AHORA), false)).toBe(CADENCIA_HILO_VIVO_MS);
  });
});

/**
 * ⚠️ EL TECHO DE 60 s SIGUE SIENDO EL RITMO SIN STREAM — ya no es absoluto
 * (con el stream vivo el frío se espacia a 5 min, PR 4), pero sin push sigue
 * siendo lo que tarda un tilde en aparecer si el aviso del webhook se perdiera.
 */
describe('el techo del escalón más lento — sin stream', () => {
  it('nunca pasa de un minuto sin stream', () => {
    expect(CADENCIA_HILO_FRIO_MS).toBeLessThanOrEqual(60_000);
    const deHaceUnAno = new Date(AHORA - 365 * 24 * 60 * 60_000).toISOString();
    expect(intervaloDelHilo(deHaceUnAno, AHORA, false)).toBeLessThanOrEqual(60_000);
  });

  it('y los escalones están ordenados: más viejo nunca es más frecuente', () => {
    const escalones = [
      intervaloDelHilo(haceMs(1_000), AHORA, false),
      intervaloDelHilo(haceMs(30 * 60_000), AHORA, false),
      intervaloDelHilo(haceMs(24 * 60 * 60_000), AHORA, false),
    ];
    expect(escalones).toEqual([...escalones].sort((a, b) => a - b));
  });
});

/**
 * EL 404 DE LA SESIÓN: «esa línea no está corriendo» es estable, no transitorio.
 *
 * 19.313 de los 58.429 pedidos del 18-ago terminaron ahí, repreguntando cada
 * 10 s una respuesta que sólo cambia cuando alguien monta la línea — y cuando
 * eso pasa, el server lo empuja por el SSE.
 */
describe('intervaloDeLaSesion', () => {
  it('sin error y sin stream, repregunta cada minuto', () => {
    expect(intervaloDeLaSesion(undefined, false)).toBe(CADENCIA_SESION_MS);
    expect(intervaloDeLaSesion(null, false)).toBe(CADENCIA_SESION_MS);
  });

  /**
   * 🔴 CON EL STREAM VIVO, LA RED SE ESPACIA A 5 MINUTOS — el poll de 60 s ya
   * era la red por escrito del evento `estado`; con el push confirmado vivo,
   * la misma red que el resto de los polls de la raíz.
   */
  it('sin error y con el stream vivo, la red se espacia a 5 minutos', () => {
    expect(intervaloDeLaSesion(undefined, true)).toBe(RED_CON_STREAM_MS);
  });

  it('un 404 congela el poll — CON o SIN el stream vivo', () => {
    expect(intervaloDeLaSesion({ status: 404 }, false)).toBe(false);
    expect(intervaloDeLaSesion({ status: 404 }, true)).toBe(false);
  });

  /**
   * 🔴 Y CUALQUIER OTRO ERROR SIGUE REPREGUNTANDO. Un 503 o una red caída sí se
   * arreglan solos: congelar ahí dejaría el semáforo del header apagado hasta
   * que llegue un evento del stream… que con el server caído tampoco llega.
   */
  it.each([[401], [403], [500], [502], [503]])('un %i sigue repreguntando', (status) => {
    expect(intervaloDeLaSesion({ status }, false)).toBe(CADENCIA_SESION_MS);
  });

  it('reconoce el 404 por su `status`, sin importar de qué clase sea el error', () => {
    class ErrorCualquiera extends Error {
      status = 404;
    }
    expect(esLineaQueNoCorre(new ErrorCualquiera('esa línea no está corriendo'))).toBe(true);
    expect(esLineaQueNoCorre(new Error('sin status'))).toBe(false);
    expect(esLineaQueNoCorre('404')).toBe(false);
    expect(esLineaQueNoCorre(null)).toBe(false);
  });
});
