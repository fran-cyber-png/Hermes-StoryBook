import { describe, expect, it } from 'vitest';
import { elegirPlantillaPublica, PLANTILLAS_PUBLICAS } from './plantillaPublica';

describe('elegirPlantillaPublica', () => {
  it('siempre devuelve una de la lista', () => {
    for (const azar of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(PLANTILLAS_PUBLICAS).toContain(elegirPlantillaPublica(null, () => azar));
    }
  });

  it('recorre las tres: ninguna queda inalcanzable', () => {
    const salieron = new Set([0, 0.4, 0.7].map((a) => elegirPlantillaPublica(null, () => a)));
    expect(salieron.size).toBe(PLANTILLAS_PUBLICAS.length);
  });

  /**
   * 🔴 EL CANDADO QUE IMPORTA: la repetición se ve en los DOS comentarios
   * seguidos del mismo post, no diluida en el mes. Con `azar` fijo en 0 —el
   * peor caso, siempre la primera candidata— la anterior no puede volver a
   * salir, porque no está entre las candidatas.
   */
  it('nunca repite la anterior, ni con el azar clavado', () => {
    for (const anterior of PLANTILLAS_PUBLICAS) {
      for (const azar of [0, 0.34, 0.67, 0.999]) {
        expect(elegirPlantillaPublica(anterior, () => azar)).not.toBe(anterior);
      }
    }
  });

  it('encadenada, no repite en ningún paso', () => {
    let anterior: string | null = null;
    for (let i = 0; i < 20; i++) {
      const elegida = elegirPlantillaPublica(anterior, () => (i % 3) / 3);
      expect(elegida).not.toBe(anterior);
      anterior = elegida;
    }
  });

  /**
   * Un texto editado a mano no está en la lista, así que el filtro no descarta
   * nada y el sorteo es el normal — incluida la que se acaba de editar.
   */
  it('un `anterior` que no es de la lista no rompe el sorteo', () => {
    expect(PLANTILLAS_PUBLICAS).toContain(
      elegirPlantillaPublica('lo que la vendedora escribió a mano', () => 0.5),
    );
  });

  /**
   * ⚠️ `Math.random()` promete [0, 1), pero un seam inyectado puede devolver 1
   * y ahí el índice se sale del array: la sugerencia llegaría `undefined` y la
   * caja se vería vacía, que se lee como que el panel no cargó.
   */
  it('un azar de 1 no se sale del array', () => {
    expect(PLANTILLAS_PUBLICAS).toContain(elegirPlantillaPublica(null, () => 1));
  });

  /**
   * 🔴 ADR 0033: **NINGUNA de las sugerencias puede prometer un privado.**
   *
   * La que lo hacía se sacó del sorteo el 25-ago-2026. Mientras estuvo, el
   * camino de menor esfuerzo —prefill que promete + caja privada en blanco +
   * enviar, que el botón habilita— publicaba la promesa sin que saliera ningún
   * privado. Este test es lo que impide que alguien la reponga sin darse cuenta
   * de que está reabriendo ese camino.
   *
   * ⚠️ Busca «privado» a secas, no la frase entera: lo que hay que atajar es
   * cualquier redacción nueva que dé por hecho el mensaje, no una en concreto.
   */
  it('🔴 ninguna plantilla promete un mensaje privado', () => {
    const prometen = PLANTILLAS_PUBLICAS.filter((p) => /privado/i.test(p));
    expect(prometen).toEqual([]);
  });
});
