import { describe, expect, test } from 'vitest';
import { resolver } from './PulsosDelLienzo';
import type { PulsoDeRuteo } from '../../lib/datos/pulsoDeRuteo';
import type { CableLienzo } from './reglasDelLienzo';

/**
 * EL PUNTITO — de qué nodo sale, dónde aterriza, y cuándo NO se dibuja.
 *
 * Puro a propósito: la animación la hace SVG y no hay nada que testear ahí, pero
 * la traducción de «un lead cayó» a geometría es donde el puntito puede MENTIR —
 * viajar por un cable que no se usó, aterrizar en la persona equivocada, o no
 * aparecer nunca por una diferencia de mayúsculas.
 */

const ANCLAS = new Map([
  ['v:Luz', { x: 400, y: 100 }],
  ['v:sindy', { x: 400, y: 160 }],
]);

function cable(over: Partial<CableLienzo> = {}): CableLienzo {
  return { de: 'prod:dipicot', a: 'v:Luz', tipo: 'regla', ...over };
}

const TRAZOS = [{ d: 'M 0 0 C 1 1, 2 2, 400 100', cable: cable() }];

function pulso(over: Partial<PulsoDeRuteo> = {}): PulsoDeRuteo {
  return {
    tipo: 'ruteo',
    canal: 'whatsapp',
    motivo: 'producto',
    eje: 'familia',
    regla: 'dipicot',
    hecho: 'alta',
    destino: 'luz',
    ...over,
  };
}

describe('a dónde aterriza', () => {
  test('🔴 la grafía NO importa: `luz` del login encuentra el nodo `v:Luz`', () => {
    /**
     * Regla dura #4. Los nodos llevan la grafía que vino en `destinos` y el
     * reparto entrega la de Cerberus o la del login según de dónde salga.
     * Comparar exacto no da error: da que a Luz **no le aparece ningún puntito
     * de lo suyo**, para siempre y sin síntoma.
     */
    const v = resolver(pulso({ destino: 'luz' }), TRAZOS, ANCLAS, 1);
    expect(v?.destino).toEqual({ x: 400, y: 100 });
  });

  test('y al revés: `Luz` de Cerberus encuentra un nodo en minúscula', () => {
    const v = resolver(pulso({ destino: 'SINDY' }), TRAZOS, ANCLAS, 2);
    expect(v?.destino).toEqual({ x: 400, y: 160 });
  });

  test('una dueña que no está en la columna NO dibuja nada', () => {
    // Pasa de verdad —`cablesHuerfanos` lo documenta— y dibujar el puntito
    // hacia un punto inventado sería peor que no dibujarlo.
    expect(resolver(pulso({ destino: 'darian' }), TRAZOS, ANCLAS, 3)).toBeNull();
  });
});

describe('por dónde viaja', () => {
  test('con un cable confirmado, viaja POR ese cable', () => {
    const v = resolver(pulso(), TRAZOS, ANCLAS, 4);
    expect(v?.d).toBe(TRAZOS[0]!.d);
  });

  test('🔴 SIN cable igual se dibuja — es el caso mayoritario, no el borde', () => {
    /**
     * Medido en producción: 3.637 asignaciones y CERO con motivo `campana`.
     * Casi todo cae por la rueda, que no tiene nodo de origen. Si el puntito
     * sólo existiera sobre un cable, la pantalla se vería quieta mientras los
     * leads siguen entrando — y quien la mire concluiría que está roto.
     */
    const v = resolver(pulso({ motivo: 'round-robin', eje: '', regla: '' }), [], ANCLAS, 5);
    expect(v).not.toBeNull();
    expect(v?.d).toBeNull();
    expect(v?.destino).toEqual({ x: 400, y: 100 });
  });

  test('🔴 un cable PENDIENTE no se usa: el server todavía no lo aplicó', () => {
    /**
     * Mientras un PUT está en vuelo la pantalla dibuja cables `pendiente`.
     * Animar sobre uno afirmaría que el lead viajó por una regla que quizá ni
     * existe —y que un 409 puede revertir medio segundo después—. Sin trazo
     * confirmado el puntito llega desde el borde: se pierde el origen, no la
     * verdad.
     */
    const v = resolver(pulso(), [{ d: 'M 0 0 L 1 1', cable: cable({ pendiente: true }) }], ANCLAS, 6);
    expect(v?.d).toBeNull();
  });

  test('un cable de PERTENENCIA tampoco: es la línea punteada, no una regla', () => {
    const v = resolver(pulso(), [{ d: 'M 0 0 L 1 1', cable: cable({ tipo: 'pertenencia' }) }], ANCLAS, 7);
    expect(v?.d).toBeNull();
  });
});

describe('la frontera', () => {
  test('🔴 un evento RECORTADO no dibuja nada', () => {
    /**
     * Sin `destino`, el lead no es de quien mira y no supervisa: el server ya lo
     * recortó (ADR 0059). Que no se dibuje nada es la frontera funcionando, no
     * un defecto — y por eso el tablero también viene recortado, para que el
     * contador de al lado no suba mientras el lienzo está quieto.
     */
    expect(resolver(pulso({ destino: undefined }), TRAZOS, ANCLAS, 8)).toBeNull();
  });
});

describe('qué clase de hecho fue', () => {
  test('`revencida` se distingue de `alta`: no es un lead nuevo', () => {
    // Una conversación de hace tres meses que volvió al circuito no es alguien
    // que acaba de escribir, y pintarlas igual haría que la pantalla mienta.
    expect(resolver(pulso({ hecho: 'revencida' }), TRAZOS, ANCLAS, 9)?.hecho).toBe('revencida');
  });

  test('un evento sin `hecho` (server viejo) se trata como alta, no se descarta', () => {
    // Degradar hacia «no muestro nada» sería peor: el lead cayó igual.
    expect(resolver(pulso({ hecho: undefined }), TRAZOS, ANCLAS, 10)?.hecho).toBe('alta');
  });
});
