import { describe, expect, it } from 'vitest';
import { cuantoFaltaParaSoltar, lecturaDeTenencia, puedoEscribir } from './tenencia';

const AHORA = new Date('2026-08-24T15:00:00Z');
const enMin = (m: number) => new Date(AHORA.getTime() + m * 60_000).toISOString();

const YO = { yo: 'sindy', activo: true };

describe('lecturaDeTenencia', () => {
  it('sin dueño no dibuja nada y deja escribir', () => {
    expect(lecturaDeTenencia({}, YO, AHORA)).toBeNull();
    expect(puedoEscribir({ asignada_a: null }, YO, AHORA)).toBe(true);
  });

  it('lo propio NO se rotula — el dueño no se ve el borde a sí mismo', () => {
    const fila = { asignada_a: 'sindy', asignada_hasta: enMin(5) };
    expect(lecturaDeTenencia(fila, YO, AHORA)).toBeNull();
    expect(puedoEscribir(fila, YO, AHORA)).toBe(true);
  });

  it('un chat ajeno y vigente se rotula con el reloj y bloquea', () => {
    const l = lecturaDeTenencia({ asignada_a: 'luz', asignada_hasta: enMin(6) }, YO, AHORA);
    expect(l?.texto).toBe('activo con Luz · 6 min');
    expect(l?.falta).toBe('6 min');
    expect(puedoEscribir({ asignada_a: 'luz', asignada_hasta: enMin(6) }, YO, AHORA)).toBe(false);
  });

  /**
   * 🔴 `null` en `asignada_hasta` es «no vence», jamás «está libre». Es el caso
   * del dueño que contestó y espera al lead — el más trabado de los tres, y el
   * que colapsar los dos vacíos dejaría abierto.
   */
  it('🔴 sin vencimiento sigue bloqueando, y sin reloj', () => {
    const fila = { asignada_a: 'luz', asignada_hasta: null };
    const l = lecturaDeTenencia(fila, YO, AHORA);
    expect(l?.texto).toBe('activo con Luz');
    expect(l?.falta).toBeNull();
    expect(puedoEscribir(fila, YO, AHORA)).toBe(false);
  });

  /**
   * 🔴 La cola sirve sólo tenencias vigentes, pero esa respuesta se persiste en
   * IndexedDB (ADR 0007) y se rehidrata antes del primer render. Sin volver a
   * juzgar el vencimiento acá, el bloqueo dura lo que dure el caché.
   */
  it('🔴 una tenencia vencida en el caché ya no bloquea', () => {
    const fila = { asignada_a: 'luz', asignada_hasta: enMin(-1) };
    expect(lecturaDeTenencia(fila, YO, AHORA)).toBeNull();
    expect(puedoEscribir(fila, YO, AHORA)).toBe(true);
  });

  /**
   * 🔴 Sin este default, un N4 desplegado antes que N5 bloquearía todo lo que
   * tenga dueño — 3.637 conversaciones en producción.
   */
  it('🔴 con el server viejo (sin `activo`) no bloquea nada', () => {
    const fila = { asignada_a: 'luz', asignada_hasta: enMin(6) };
    expect(lecturaDeTenencia(fila, { yo: 'sindy' }, AHORA)).toBeNull();
    expect(puedoEscribir(fila, { yo: 'sindy' }, AHORA)).toBe(true);
    expect(puedoEscribir(fila, { yo: 'sindy', activo: false }, AHORA)).toBe(true);
  });

  /** La cicatriz `Luz`/`luz`: comparar exacto le bloquea a Luz lo suyo. */
  it('🔴 las dos grafías del mismo humano son la misma persona', () => {
    const fila = { asignada_a: 'Luz', asignada_hasta: enMin(5) };
    expect(lecturaDeTenencia(fila, { yo: 'luz', activo: true }, AHORA)).toBeNull();
  });

  it('una fecha ilegible se trata como «no vence», nunca como libre', () => {
    const fila = { asignada_a: 'luz', asignada_hasta: 'ayer por la tarde' };
    expect(puedoEscribir(fila, YO, AHORA)).toBe(false);
    expect(lecturaDeTenencia(fila, YO, AHORA)?.falta).toBeNull();
  });

  it('usa el nombre de `equipo` cuando lo hay, y el id si no', () => {
    const fila = { asignada_a: 'ventas11@grupogoberna.com', asignada_hasta: enMin(3) };
    const l = lecturaDeTenencia(fila, YO, AHORA, { 'ventas11@grupogoberna.com': 'Tracy' });
    expect(l?.nombre).toBe('Tracy');
    expect(l?.duena).toBe('ventas11@grupogoberna.com');
  });
});

/**
 * Redondea para ARRIBA, al revés que `ventana.ts:cuantoFalta`. Acá el error caro
 * es decir «ya se libera» antes de tiempo y que alguien apriete enviar para
 * comerse un 409.
 */
describe('cuantoFaltaParaSoltar', () => {
  it('redondea para arriba y nunca dice cero', () => {
    expect(cuantoFaltaParaSoltar(5 * 60_000 + 10_000)).toBe('6 min');
    expect(cuantoFaltaParaSoltar(1000)).toBe('1 min');
    expect(cuantoFaltaParaSoltar(10 * 60_000)).toBe('10 min');
  });

  it('pasa a horas para el plazo de primer signo de vida', () => {
    expect(cuantoFaltaParaSoltar(23 * 3_600_000)).toBe('23 h');
  });
});
