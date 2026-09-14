import { describe, expect, test } from 'vitest';
import {
  conteoDeRecorteSemaforo,
  esRecorteSemaforo,
  ordenarPorSemaforo,
  primeraParaAtender,
  recortesDeColumna,
  type ResumenColumna,
  type TarjetaTablero,
} from './tablero';

/**
 * EL SEMÁFORO EN EL TABLERO (#826, S.2) — el orden dentro de la columna y los
 * recortes por luz, puros y sin DOM.
 */

describe('ordenarPorSemaforo — verde que espera primero, rojo al fondo', () => {
  const item = (p: Partial<TarjetaTablero> & { clave: string }): TarjetaTablero => ({
    respondida: true,
    referencia: '2026-09-08T00:00:00Z',
    ...p,
  });

  test('el orden general: verde, ámbar, gris, rojo', () => {
    const items = [
      item({ clave: 'rojo', luz: 'rojo' }),
      item({ clave: 'gris', luz: 'gris' }),
      item({ clave: 'ambar', luz: 'ambar' }),
      item({ clave: 'verde', luz: 'verde' }),
    ];
    expect(ordenarPorSemaforo(items).map((i) => i.clave)).toEqual(['verde', 'ambar', 'gris', 'rojo']);
  });

  test('un `luz` ausente se trata como gris, nunca como verde', () => {
    const items = [item({ clave: 'sin-luz' }), item({ clave: 'rojo', luz: 'rojo' })];
    expect(ordenarPorSemaforo(items).map((i) => i.clave)).toEqual(['sin-luz', 'rojo']);
  });

  test('dentro de los VERDES, el que espera (no le respondiste) va antes que el que ya contestaste', () => {
    const items = [
      item({ clave: 'verde-silencio', luz: 'verde', respondida: true }),
      item({ clave: 'verde-espera', luz: 'verde', respondida: false }),
    ];
    expect(ordenarPorSemaforo(items).map((i) => i.clave)).toEqual(['verde-espera', 'verde-silencio']);
  });

  test('entre los verdes que esperan, el MÁS ANTIGUO primero', () => {
    const items = [
      item({ clave: 'nuevo', luz: 'verde', respondida: false, referencia: '2026-09-08T12:00:00Z' }),
      item({ clave: 'viejo', luz: 'verde', respondida: false, referencia: '2026-09-08T03:00:00Z' }),
    ];
    expect(ordenarPorSemaforo(items).map((i) => i.clave)).toEqual(['viejo', 'nuevo']);
  });

  test('🔴 ámbar y gris NO se reordenan por antigüedad: se quedan en el orden que ya traían', () => {
    // El sort es estable: dos ámbar con fechas cruzadas a propósito no cambian
    // de posición, porque ese eje solo aplica a verde.
    const items = [
      item({ clave: 'ambar-nuevo', luz: 'ambar', referencia: '2026-09-08T12:00:00Z' }),
      item({ clave: 'ambar-viejo', luz: 'ambar', referencia: '2026-09-08T03:00:00Z' }),
    ];
    expect(ordenarPorSemaforo(items).map((i) => i.clave)).toEqual(['ambar-nuevo', 'ambar-viejo']);
  });
});

describe('esRecorteSemaforo / conteoDeRecorteSemaforo', () => {
  const resumen: ResumenColumna = {
    total: 1144,
    conPrecio: 0,
    enVentana: 0,
    paraSeguir: 0,
    seCallo: 0,
    verdes: 602,
    ambar: 413,
    grises: 129,
    rojos: 0,
  };

  test('las cuatro luces son recortes de semáforo; el resto no', () => {
    expect(esRecorteSemaforo('verde')).toBe(true);
    expect(esRecorteSemaforo('ambar')).toBe(true);
    expect(esRecorteSemaforo('gris')).toBe(true);
    expect(esRecorteSemaforo('rojo')).toBe(true);
    expect(esRecorteSemaforo('todas')).toBe(false);
    expect(esRecorteSemaforo('precio')).toBe(false);
  });

  test('cada luz lee su propio conteo del resumen', () => {
    expect(conteoDeRecorteSemaforo(resumen, 'verde')).toBe(602);
    expect(conteoDeRecorteSemaforo(resumen, 'ambar')).toBe(413);
    expect(conteoDeRecorteSemaforo(resumen, 'gris')).toBe(129);
    expect(conteoDeRecorteSemaforo(resumen, 'rojo')).toBe(0);
  });
});

/**
 * 🔴 EL SEMÁFORO YA NO ES UN CHIP DE COLUMNA (10-sep-2026).
 *
 * Medido en producción sobre 12.531 conversaciones: ámbar es el 93 % de «Saben
 * el precio» y el 89 % de «Contestaron», y verdes hay 278 en toda la mesa. Cuatro
 * chips por columna eran veinte botones que casi no recortaban nada. La luz se
 * recorta UNA vez, arriba, para las cinco columnas (`resumen.ts#leyendaDelTablero`,
 * con la misma regla del cero — `seOfreceRecorte`).
 */
describe('recortesDeColumna — las luces ya no son chips de columna', () => {
  test('🔴 ninguna columna ofrece Verdes · Ámbar · Grises · Rojos, aunque recorten algo', () => {
    const resumen: ResumenColumna = {
      total: 1144,
      conPrecio: 0,
      enVentana: 0,
      paraSeguir: 0,
      seCallo: 0,
      verdes: 602,
      ambar: 413,
      grises: 129,
      rojos: 5,
    };
    for (const etapa of ['interesado', 'sin_respuesta', 'contactado', 'cotizado'] as const) {
      const ids = recortesDeColumna(etapa, resumen, 'todas').map((o) => o.id);
      for (const luz of ['verde', 'ambar', 'gris', 'rojo'] as const) {
        expect(ids, `«${etapa}» ofrece «${luz}»`).not.toContain(luz);
      }
    }
  });
});

describe('primeraParaAtender — la precedencia de «Atender siguiente» (#807, S.3)', () => {
  const item = (p: Partial<TarjetaTablero> & { clave: string }): TarjetaTablero => ({
    respondida: true,
    referencia: '2026-09-08T00:00:00Z',
    ...p,
  });

  test('abre el primer VERDE que espera, el más antiguo primero', () => {
    const items = [
      item({ clave: 'verde-nuevo', luz: 'verde', respondida: false, referencia: '2026-09-08T12:00:00Z' }),
      item({ clave: 'verde-viejo', luz: 'verde', respondida: false, referencia: '2026-09-08T03:00:00Z' }),
      item({ clave: 'ambar-espera', luz: 'ambar', respondida: false, referencia: '2026-09-08T01:00:00Z' }),
    ];
    expect(primeraParaAtender(items)?.clave).toBe('verde-viejo');
  });

  test('sin verdes que esperen, cae a ÁMBAR que espera', () => {
    const items = [
      item({ clave: 'verde-silencio', luz: 'verde', respondida: true }),
      item({ clave: 'ambar-espera', luz: 'ambar', respondida: false }),
      item({ clave: 'gris-espera', luz: 'gris', respondida: false }),
    ];
    expect(primeraParaAtender(items)?.clave).toBe('ambar-espera');
  });

  test('sin verde ni ámbar que esperen, cae a GRIS que espera', () => {
    const items = [
      item({ clave: 'gris-silencio', luz: 'gris', respondida: true }),
      item({ clave: 'gris-espera', luz: 'gris', respondida: false }),
      item({ clave: 'rojo-espera', luz: 'rojo', respondida: false }),
    ];
    expect(primeraParaAtender(items)?.clave).toBe('gris-espera');
  });

  test('🔴 NUNCA abre un rojo, aunque sea lo único que espera', () => {
    const items = [
      item({ clave: 'rojo-espera', luz: 'rojo', respondida: false }),
      item({ clave: 'verde-silencio', luz: 'verde', respondida: true }),
    ];
    expect(primeraParaAtender(items)).toBeNull();
  });

  test('sin nada que espere, no hay nada que atender', () => {
    const items = [item({ clave: 'verde-silencio', luz: 'verde', respondida: true })];
    expect(primeraParaAtender(items)).toBeNull();
  });

  test('una lista vacía no revienta: no hay nada que atender', () => {
    expect(primeraParaAtender([])).toBeNull();
  });

  test('`luz` ausente cuenta como gris, no como verde', () => {
    const items = [
      item({ clave: 'sin-luz', respondida: false }),
      item({ clave: 'ambar-espera', luz: 'ambar', respondida: false }),
    ];
    expect(primeraParaAtender(items)?.clave).toBe('ambar-espera');
  });
});
