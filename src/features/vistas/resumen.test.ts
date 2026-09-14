import { describe, expect, test } from 'vitest';
import { columnasDe, type FilaDesglose } from './tablero';
import { LEYENDA_SEMAFORO, leyendaDelTablero, respondidosDeLaMesa, resumirTablero } from './resumen';

/**
 * LA FILA DE ARRIBA DEL PIPELINE — la política, sin DOM.
 *
 * El Pipeline muestra lo que se TRABAJA y el Dashboard lo que se MIDE (decisión
 * del dueño, 10-sep-2026): acá no hay KPIs ni distribución, sólo el tamaño de la
 * mesa, lo que es nuevo hoy y el semáforo como recorte.
 *
 * Los números son los MEDIDOS en producción el 10-sep-2026 (sesión supervisora,
 * 30 días, 12.531 conversaciones): Te esperan 1.109 · Nunca contestaron 7.505 ·
 * Contestaron 421 · Saben el precio 3.410 · Compraron 86.
 */

const fila = (p: Partial<FilaDesglose> & Pick<FilaDesglose, 'etapa' | 'n'>): FilaDesglose => ({
  yaLeHablamos: true,
  precio: false,
  viva: false,
  ...p,
});

const HOY: FilaDesglose[] = [
  fila({ etapa: 'interesado', n: 1109 }),
  fila({ etapa: 'sin_respuesta', n: 7505 }),
  fila({ etapa: 'contactado', n: 421 }),
  fila({ etapa: 'cotizado', n: 3410 }),
  fila({ etapa: 'cierre', n: 86 }),
  // `perdido` existe y no es columna en ningún tablero (ADR 0050): no es mesa.
  fila({ etapa: 'perdido', n: 47 }),
];

describe('resumirTablero — la mesa', () => {
  test('el total es la suma de las columnas que ESTE tablero dibuja, no de todo el desglose', () => {
    expect(resumirTablero(columnasDe('ventas'), HOY).total).toBe(12531);
  });

  /**
   * Un ejemplo trabajado a mano, fila por fila, para que cada suma tenga un
   * número que no salga de la función. `perdido` trae luz roja a propósito: si
   * se colara en la mesa, «Rojos» daría 80.
   */
  test('el semáforo suma las columnas dibujadas, y nada de afuera', () => {
    const desglose: FilaDesglose[] = [
      fila({ etapa: 'interesado', luz: 'verde', n: 10 }),
      fila({ etapa: 'interesado', luz: 'gris', n: 5 }),
      fila({ etapa: 'sin_respuesta', luz: 'gris', n: 100 }),
      fila({ etapa: 'sin_respuesta', luz: 'ambar', n: 20 }),
      fila({ etapa: 'contactado', luz: 'ambar', n: 7 }),
      fila({ etapa: 'cotizado', precio: true, luz: 'rojo', n: 30 }),
      fila({ etapa: 'cierre', luz: 'verde', n: 3 }),
      fila({ etapa: 'perdido', luz: 'rojo', n: 50 }),
    ];
    expect(resumirTablero(columnasDe('ventas'), desglose)).toMatchObject({
      total: 175,
      hayDetalle: true,
      semaforo: { verde: 13, ambar: 27, gris: 105, rojo: 30 },
    });
  });

  /**
   * El front sale a producción SIN reinicio del server (N4) y el server recién
   * en el botón (N5): entre uno y otro llegan los conteos y no el desglose. Ahí
   * la fila dice el tamaño de la mesa y calla el resto — cuatro «0» en la
   * leyenda se leerían como «no hay ningún verde», que es falso.
   */
  test('sin desglose cuenta con los conteos y CALLA el detalle', () => {
    const r = resumirTablero(columnasDe('ventas'), undefined, {
      interesado: 1109,
      sin_respuesta: 7505,
      contactado: 421,
      cotizado: 3410,
      cierre: 86,
      perdido: 47,
    });
    expect(r).toEqual({
      total: 12531,
      hayDetalle: false,
      nuevasHoy: null,
      semaforo: { verde: 0, ambar: 0, gris: 0, rojo: 0 },
    });
  });

  test('🔴 en campaña la mesa es SU escalera: una etapa de ventas no entra', () => {
    const campana: FilaDesglose[] = [
      fila({ etapa: 'interesado', n: 40 }),
      fila({ etapa: 'contactado', n: 12 }),
      fila({ etapa: 'simpatiza', n: 181 }),
      fila({ etapa: 'comprometido', n: 9 }),
      fila({ etapa: 'voluntario', n: 2 }),
      // Un `cotizado` suelto no es de este tablero: si entrara, el total da 744.
      fila({ etapa: 'cotizado', n: 500 }),
    ];
    expect(resumirTablero(columnasDe('campana'), campana).total).toBe(244);
  });
});

/**
 * «NUEVAS HOY» — el HOY que pidió el dueño el 10-sep-2026 («en el pipeline es
 * importante el HOY»). `nacioHoy` lo calcula el server en la misma pasada del
 * desglose, contra el inicio del día de la vendedora: la conversación empezó
 * hoy, con un mensaje suyo o nuestro.
 */
describe('resumirTablero — nuevas hoy', () => {
  test('cuenta las filas con `nacioHoy` de las columnas dibujadas', () => {
    const desglose: FilaDesglose[] = [
      fila({ etapa: 'interesado', nacioHoy: true, n: 12 }),
      fila({ etapa: 'interesado', nacioHoy: false, n: 100 }),
      fila({ etapa: 'contactado', nacioHoy: true, n: 3 }),
      fila({ etapa: 'perdido', nacioHoy: true, n: 40 }),
    ];
    expect(resumirTablero(columnasDe('ventas'), desglose).nuevasHoy).toBe(15);
  });

  test('🔴 un server que no manda `nacioHoy` no dice «0 nuevas hoy»: no dice nada', () => {
    // Ausente NO es cero (misma regla que `ventana`, `paraSeguir` y `luz`): es
    // un server que todavía no sabe contarlo, y un «0 hoy» se leería como un día
    // sin leads.
    expect(resumirTablero(columnasDe('ventas'), HOY).nuevasHoy).toBeNull();
  });
});

/**
 * LA LEYENDA DEL SEMÁFORO — dónde viven ahora los cuatro chips de luz que cada
 * columna repetía. Medido el 10-sep-2026: ámbar es el 93 % de «Saben el precio»
 * y el 89 % de «Contestaron», así que cuatro chips por columna no recortaban
 * nada. Una sola leyenda, con los conteos de la mesa, que aplica a las cinco.
 */
describe('la leyenda del semáforo', () => {
  test('nombra las cuatro luces en el orden del semáforo, y cada una explica qué significa', () => {
    expect(LEYENDA_SEMAFORO.map((l) => [l.luz, l.label])).toEqual([
      ['verde', 'Verdes'],
      ['ambar', 'Ámbar'],
      ['gris', 'Grises'],
      ['rojo', 'Rojos'],
    ]);
    for (const l of LEYENDA_SEMAFORO) expect(l.ayuda.length, `«${l.label}» sin ayuda`).toBeGreaterThan(20);
  });

  const MESA = {
    total: 12531,
    semaforo: { verde: 278, ambar: 5051, gris: 7172, rojo: 30 },
  };

  test('cada luz lleva el conteo de la mesa entera', () => {
    expect(leyendaDelTablero(MESA, 'todas').map((o) => [o.luz, o.n])).toEqual([
      ['verde', 278],
      ['ambar', 5051],
      ['gris', 7172],
      ['rojo', 30],
    ]);
  });

  /**
   * La leyenda se dibuja SIEMPRE entera —una leyenda con un color de menos no
   * explica el color que falta—, pero sólo se TOCA lo que cambia la mesa. Es la
   * regla del cero de `recortesDeColumna`, con sus dos mitades y su excepción.
   */
  test('🔴 una luz en cero no se toca, y una que es TODA la mesa tampoco', () => {
    const sinRojos = { ...MESA, semaforo: { ...MESA.semaforo, rojo: 0 } };
    expect(leyendaDelTablero(sinRojos, 'todas').find((o) => o.luz === 'rojo')?.clicable).toBe(false);

    const todoGris = { total: 40, semaforo: { verde: 0, ambar: 0, gris: 40, rojo: 0 } };
    expect(leyendaDelTablero(todoGris, 'todas').find((o) => o.luz === 'gris')?.clicable).toBe(false);

    expect(leyendaDelTablero(MESA, 'todas').every((o) => o.clicable)).toBe(true);
  });

  test('🔴 la luz ACTIVA se toca siempre, aunque dé cero: es el botón que la apaga', () => {
    const vacia = { total: 0, semaforo: { verde: 0, ambar: 0, gris: 0, rojo: 0 } };
    const opciones = leyendaDelTablero(vacia, 'verde');
    expect(opciones.find((o) => o.luz === 'verde')).toMatchObject({ n: 0, clicable: true });
    expect(opciones.find((o) => o.luz === 'ambar')?.clicable).toBe(false);
  });
});

/**
 * «N RESPONDIDOS» EN LA CARD DE «TE ESPERAN» (pedido del dueño, 13-sep-2026: «en
 * vez de contestaron pon los que ya fueron respondidos hoy»). Es la columna de al
 * lado contada en la misma foto, y el rótulo dice DE QUÉ ventana es: con
 * `mesaPorCanal` el desglose es del rango puesto; con un server viejo, siempre de
 * 30 días.
 */
describe('respondidosDeLaMesa', () => {
  const D: FilaDesglose[] = [
    fila({ etapa: 'contactado', n: 30 }),
    fila({ etapa: 'contactado', n: 12 }),
    fila({ etapa: 'interesado', n: 400 }),
  ];

  test('cuenta los de «Respondidos» (`contactado`) y nada más', () => {
    expect(respondidosDeLaMesa(D, 'cola', true)?.n).toBe(42);
  });

  test('🔴 con el desglose del rango, el rótulo dice el rango', () => {
    expect(respondidosDeLaMesa(D, 'hoy', true)?.rotulo).toBe('respondidos hoy');
    expect(respondidosDeLaMesa(D, 'd7', true)?.rotulo).toBe('respondidos · 7 d');
    expect(respondidosDeLaMesa(D, 'cola', true)?.rotulo).toBe('respondidos · 30 d');
  });

  test('🔴 con un server viejo el desglose es de 30 d aunque la mesa esté en «Hoy», y lo dice', () => {
    expect(respondidosDeLaMesa(D, 'hoy', false)?.rotulo).toBe('respondidos · 30 d');
  });

  test('uno solo va en singular', () => {
    expect(respondidosDeLaMesa([fila({ etapa: 'contactado', n: 1 })], 'hoy', true)?.rotulo).toBe('respondido hoy');
  });

  test('sin desglose no hay cifra: null, nunca un cero inventado', () => {
    expect(respondidosDeLaMesa(undefined, 'hoy', true)).toBeNull();
  });
});
