import { describe, expect, test } from 'vitest';
import {
  chipsDeColumnaVisibles,
  claveDelRango,
  limitesDelRango,
  MESA_INICIAL,
  mesaSiguiente,
  origenDelVacio,
  recorteDeLaColumna,
  type EstadoDeMesa,
} from './mesa';

/** La mesa con el rango en 30 días: donde viven los chips de columna y la franja. */
const EN_30_DIAS: EstadoDeMesa = { ...MESA_INICIAL, rango: 'cola' };

/**
 * LA MESA DEL PIPELINE — qué recortes pueden estar puestos a la vez, dicho UNA vez.
 *
 * Hay cuatro ejes: el rango global (Hoy · 7 d · 30 d), el recorte de la mesa (una
 * luz o un recorte del día), el recorte de cada columna y la franja de «Nunca
 * contestaron». La regla que los ordena es la de ADR 0069: **un botón promete el
 * número de la lista que aparece cuando lo tocas**. Los números de la leyenda y de
 * los chips salen del desglose, y el desglose NO se recorta por la franja (tampoco
 * con `franjaEn=*`): lo que cuenta sobre él no puede convivir con un rango.
 */

describe('mesaSiguiente — un eje por vez', () => {
  test('🔴 la mesa ARRANCA en «Hoy»: lo que se trabaja al entrar es lo de hoy', () => {
    expect(MESA_INICIAL.rango).toBe('hoy');
  });

  test('un rango apaga los recortes de columna y la franja de columna: cuentan sobre el desglose, que el rango no recorta', () => {
    const antes: EstadoDeMesa = {
      rango: 'cola',
      recorte: 'todas',
      deColumna:{ cotizado: 'seguir' },
      franja: { tipo: 'preset', id: 'h1' },
    };
    expect(mesaSiguiente(antes, { tipo: 'rango', rango: 'hoy' })).toEqual({
      rango: 'hoy',
      recorte: 'todas',
      deColumna:{},
      franja: null,
    });
  });

  test('🔴 cambiar el rango CONSERVA la luz: «Verdes» sigue puesto al pasar de Hoy a 7 d', () => {
    const antes: EstadoDeMesa = { ...MESA_INICIAL, rango: 'hoy', recorte: 'verde' };
    expect(mesaSiguiente(antes, { tipo: 'rango', rango: 'd7' })).toMatchObject({ rango: 'd7', recorte: 'verde' });
  });

  test('tocar el rango que ya está puesto no cambia nada: no es un «apagar»', () => {
    const antes: EstadoDeMesa = { ...EN_30_DIAS, recorte: 'verde' };
    expect(mesaSiguiente(antes, { tipo: 'rango', rango: 'cola' })).toBe(antes);
  });

  test('un rango CONSERVA el recorte del día: su número lo da el server, que cruza los dos', () => {
    const antes: EstadoDeMesa = { ...MESA_INICIAL, recorte: 'escribioHoy' };
    expect(mesaSiguiente(antes, { tipo: 'rango', rango: 'd7' })).toMatchObject({ rango: 'd7', recorte: 'escribioHoy' });
  });

  test('🔴 tocar una luz NO cambia el rango: marcar Hoy y tocar Verdes deja los verdes de hoy', () => {
    for (const rango of ['hoy', 'd7', 'cola'] as const) {
      const antes: EstadoDeMesa = { ...MESA_INICIAL, rango };
      expect(mesaSiguiente(antes, { tipo: 'luz', luz: 'verde' })).toMatchObject({ rango, recorte: 'verde' });
    }
  });

  test('tocar la luz que ya está puesta la apaga', () => {
    const antes: EstadoDeMesa = { ...MESA_INICIAL, recorte: 'verde' };
    expect(mesaSiguiente(antes, { tipo: 'luz', luz: 'verde' }).recorte).toBe('todas');
  });

  test('una luz limpia los recortes de columna y la franja (es el mismo eje)', () => {
    const antes: EstadoDeMesa = { ...EN_30_DIAS, deColumna:{ cotizado: 'seguir' }, franja: { tipo: 'preset', id: 'hoy' } };
    expect(mesaSiguiente(antes, { tipo: 'luz', luz: 'rojo' })).toEqual({ ...EN_30_DIAS, recorte: 'rojo' });
  });

  test('un recorte del día reemplaza la luz y limpia los de columna; quitarlo vuelve a «todas»', () => {
    const antes: EstadoDeMesa = { ...EN_30_DIAS, recorte: 'verde', deColumna:{ cotizado: 'seguir' } };
    const puesto = mesaSiguiente(antes, { tipo: 'recorteDelDia', recorte: 'escribioHoy' });
    expect(puesto).toEqual({ ...EN_30_DIAS, recorte: 'escribioHoy' });
    expect(mesaSiguiente(puesto, { tipo: 'recorteDelDia', recorte: null }).recorte).toBe('todas');
  });

  test('franja y recorte de «Nunca contestaron» se siguen apagando entre sí (ADR 0069)', () => {
    const conRecorte = mesaSiguiente(EN_30_DIAS, { tipo: 'recorteDeColumna', etapa: 'sin_respuesta', recorte: 'seguir' });
    const conFranja = mesaSiguiente(conRecorte, { tipo: 'franjaDeColumna', franja: { tipo: 'preset', id: 'hoy' } });
    expect(conFranja.deColumna.sin_respuesta).toBe('todas');
    expect(mesaSiguiente(conFranja, { tipo: 'recorteDeColumna', etapa: 'sin_respuesta', recorte: 'precio' }).franja).toBeNull();
  });

  test('el puente arranca de cero, y en 30 días: las cifras del Dashboard son de 30 días', () => {
    const antes: EstadoDeMesa = { rango: 'd7', recorte: 'rojo', deColumna:{ cotizado: 'seguir' }, franja: null };
    expect(mesaSiguiente(antes, { tipo: 'abrir', luz: 'verde' })).toEqual({ ...EN_30_DIAS, recorte: 'verde' });
    expect(mesaSiguiente(antes, { tipo: 'abrir', luz: null })).toEqual(EN_30_DIAS);
  });
});

describe('qué se ofrece y qué rige', () => {
  test('🔴 los chips de columna sólo se ofrecen sin recorte de mesa y con el rango en 30 días', () => {
    expect(chipsDeColumnaVisibles(EN_30_DIAS)).toBe(true);
    expect(chipsDeColumnaVisibles({ ...EN_30_DIAS, recorte: 'verde' })).toBe(false);
    expect(chipsDeColumnaVisibles({ ...EN_30_DIAS, recorte: 'sinRespuesta24h' })).toBe(false);
    expect(chipsDeColumnaVisibles({ ...EN_30_DIAS, rango: 'hoy' })).toBe(false);
  });

  test('el recorte de la mesa le gana al de la columna', () => {
    expect(recorteDeLaColumna({ ...MESA_INICIAL, deColumna:{ cotizado: 'seguir' } }, 'cotizado')).toBe('seguir');
    expect(recorteDeLaColumna({ ...MESA_INICIAL, recorte: 'escribioHoy', deColumna:{ cotizado: 'seguir' } }, 'cotizado')).toBe(
      'escribioHoy',
    );
    expect(recorteDeLaColumna(MESA_INICIAL, 'cotizado')).toBe('todas');
  });

  test('🔴 el vacío de una columna nombra al control que la vació: arriba, el rango, la franja o su chip', () => {
    expect(origenDelVacio({ ...MESA_INICIAL, recorte: 'escribioHoy', rango: 'hoy' }, 'cotizado')).toBe('mesa');
    expect(origenDelVacio({ ...MESA_INICIAL, rango: 'd7' }, 'cotizado')).toBe('rango');
    const conFranja: EstadoDeMesa = { ...EN_30_DIAS, franja: { tipo: 'preset', id: 'hoy' } };
    expect(origenDelVacio(conFranja, 'sin_respuesta')).toBe('franja');
    // La franja es de «Nunca contestaron»: a otra columna no la vacía.
    expect(origenDelVacio(conFranja, 'cotizado')).toBe('columna');
  });
});

describe('limitesDelRango — los instantes que viajan con franjaEn=*', () => {
  const ahora = new Date(2026, 8, 10, 15, 42, 17);

  test('30 días no manda franja: es el universo de la cola', () => {
    expect(limitesDelRango('cola', ahora)).toBeNull();
  });

  test('🔴 «Hoy» es desde la medianoche LOCAL, sin borde de arriba, y viaja como instante con zona', () => {
    const l = limitesDelRango('hoy', ahora)!;
    const d = new Date(l.desde);
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([10, 0, 0]);
    expect(l.hasta).toBeNull();
    // `toISOString()`: una fecha pelada se leería como medianoche UTC —las 7 de la
    // noche del día anterior en Lima—, la clase de bug de #421.
    expect(l.desde).toMatch(/T.*Z$/);
  });

  test('«7 d» es desde hace siete días, recortado al minuto', () => {
    const l = limitesDelRango('d7', ahora)!;
    expect(new Date(l.desde).getTime()).toBe(new Date(2026, 8, 3, 15, 42, 0).getTime());
  });
});

/**
 * LO QUE ENTRA A LA `queryKey` DEL TABLERO — el rango, no sus instantes (revisión
 * cruzada de #956). Con el instante adentro, «7 d» cambiaba de clave cada minuto y
 * el tablero entero se volvía a pedir en frío.
 */
describe('claveDelRango', () => {
  test('30 d no tiene clave: no manda franja', () => {
    expect(claveDelRango('cola', new Date(2026, 8, 10, 15, 0))).toBeNull();
  });

  test('🔴 «7 d» es la MISMA clave aunque pase el tiempo: el instante se resuelve al pedir', () => {
    expect(claveDelRango('d7', new Date(2026, 8, 10, 15, 0))).toBe(claveDelRango('d7', new Date(2026, 8, 12, 9, 31)));
  });

  test('🔴 «Hoy» cambia de clave a la medianoche, y no antes: el hoy de ayer no se sirve de la caché', () => {
    expect(claveDelRango('hoy', new Date(2026, 8, 10, 0, 1))).toBe(claveDelRango('hoy', new Date(2026, 8, 10, 23, 59)));
    expect(claveDelRango('hoy', new Date(2026, 8, 10, 23, 59))).not.toBe(claveDelRango('hoy', new Date(2026, 8, 11, 0, 1)));
  });
});
