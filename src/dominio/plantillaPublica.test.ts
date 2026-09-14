import { describe, expect, it } from 'vitest';
import {
  clienteDeLasPlantillas,
  elegirPlantillaPublica,
  plantillasPublicasPara,
  PLANTILLAS_PUBLICAS_POR_CLIENTE,
} from './plantillaPublica';

/**
 * Fragmentos copiados literales de lo que salió en la Página de Américo el 11-sep-2026, y NO
 * importados de la lista: el test tiene que poder decir que algo se coló aunque la lista cambie.
 */
const DE_LA_ESCUELA = 'programa completo con fechas y precios';
const DE_BETTO = 'trabajando por un solo Áncash';

describe('de quién son los textos que se sugieren', () => {
  it('🔴 un cliente de campaña sin textos propios (americo) no recibe ninguno', () => {
    expect(plantillasPublicasPara({ modulo: 'campana', cliente: 'americo' })).toEqual([]);
  });

  it('🔴 la campaña de Betto recibe las suyas, y ninguna es de la Escuela', () => {
    const lista = plantillasPublicasPara({ modulo: 'campana', cliente: 'betto' });
    expect(lista.some((p) => p.includes(DE_BETTO))).toBe(true);
    expect(lista.filter((p) => p.includes(DE_LA_ESCUELA))).toEqual([]);
  });

  it('🔴 la Escuela, sobre una Página de Goberna sin registrar, recibe la suya y ninguna de campaña', () => {
    const lista = plantillasPublicasPara({ modulo: 'ventas', cliente: null });
    expect(lista.some((p) => p.includes(DE_LA_ESCUELA))).toBe(true);
    expect(lista.filter((p) => p.includes(DE_BETTO))).toEqual([]);
  });

  it('🔴 en campaña, una Página sin cliente no es de nadie', () => {
    expect(clienteDeLasPlantillas({ modulo: 'campana', cliente: null })).toBeNull();
    expect(plantillasPublicasPara({ modulo: 'campana', cliente: null })).toEqual([]);
  });

  it('🔴 si falta cualquiera de los dos datos no se sugiere nada', () => {
    expect(plantillasPublicasPara({})).toEqual([]);
    expect(plantillasPublicasPara({ modulo: 'ventas' })).toEqual([]);
    expect(plantillasPublicasPara({ cliente: 'betto' })).toEqual([]);
  });

  it('un cliente_id con nombre de propiedad de Object no cuela nada', () => {
    expect(plantillasPublicasPara({ modulo: 'campana', cliente: 'constructor' })).toEqual([]);
    expect(plantillasPublicasPara({ modulo: 'campana', cliente: '__proto__' })).toEqual([]);
  });

  /**
   * 🔴 REGLA DEL DUEÑO (12-sep-2026, por hermes-c5): «no debería decir nada de Áncash
   * o cosas relacionadas a Betto» en nada de Américo. Acá vale para cualquier cliente
   * de campaña que no sea `betto`, incluido el que se agregue mañana a la lista.
   *
   * Se siembran los dos a la vez (candado 7): si las frases de Betto no tuvieran
   * ninguna de las palabras, este test pasaría sin probar nada.
   */
  it('🔴 a un cliente de campaña que no es betto no se le sugiere nada de Betto ni de Áncash', () => {
    const DE_BETTO_O_ANCASH = /[áÁaA]ncash|betto|barrionuevo|huaraz|chimbote/iu;
    const deBetto = plantillasPublicasPara({ modulo: 'campana', cliente: 'betto' });
    expect(deBetto.some((p) => DE_BETTO_O_ANCASH.test(p))).toBe(true);

    const otros = ['americo', ...Object.keys(PLANTILLAS_PUBLICAS_POR_CLIENTE).filter((c) => c !== 'betto')];
    const colados = otros.flatMap((cliente) =>
      plantillasPublicasPara({ modulo: 'campana', cliente })
        .filter((p) => DE_BETTO_O_ANCASH.test(p))
        .map((p) => `${cliente}: ${p}`),
    );
    expect(colados).toEqual([]);
  });
});

const BETTO = PLANTILLAS_PUBLICAS_POR_CLIENTE.betto;

describe('elegirPlantillaPublica', () => {
  it('siempre devuelve una de la lista', () => {
    for (const azar of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(BETTO).toContain(elegirPlantillaPublica(BETTO, null, () => azar));
    }
  });

  it('recorre las tres: ninguna queda inalcanzable', () => {
    const salieron = new Set([0, 0.4, 0.7].map((a) => elegirPlantillaPublica(BETTO, null, () => a)));
    expect(salieron.size).toBe(BETTO.length);
  });

  /**
   * 🔴 EL CANDADO QUE IMPORTA: la repetición se ve en los DOS comentarios
   * seguidos del mismo post, no diluida en el mes. Con `azar` fijo en 0 —el
   * peor caso, siempre la primera candidata— la anterior no puede volver a
   * salir, porque no está entre las candidatas.
   */
  it('nunca repite la anterior, ni con el azar clavado', () => {
    for (const anterior of BETTO) {
      for (const azar of [0, 0.34, 0.67, 0.999]) {
        expect(elegirPlantillaPublica(BETTO, anterior, () => azar)).not.toBe(anterior);
      }
    }
  });

  it('encadenada, no repite en ningún paso', () => {
    let anterior: string | null = null;
    for (let i = 0; i < 20; i++) {
      const elegida = elegirPlantillaPublica(BETTO, anterior, () => (i % 3) / 3);
      expect(elegida).not.toBe(anterior);
      anterior = elegida;
    }
  });

  /**
   * Un texto editado a mano no está en la lista, así que el filtro no descarta
   * nada y el sorteo es el normal — incluida la que se acaba de editar.
   */
  it('un `anterior` que no es de la lista no rompe el sorteo', () => {
    expect(BETTO).toContain(elegirPlantillaPublica(BETTO, 'lo que la vendedora escribió a mano', () => 0.5));
  });

  /**
   * ⚠️ `Math.random()` promete [0, 1), pero un seam inyectado puede devolver 1
   * y ahí el índice se sale del array: la sugerencia llegaría `undefined` y la
   * caja se vería vacía, que se lee como que el panel no cargó.
   */
  it('un azar de 1 no se sale del array', () => {
    expect(BETTO).toContain(elegirPlantillaPublica(BETTO, null, () => 1));
  });

  it('🔴 con una lista vacía la caja queda vacía, nunca `undefined`', () => {
    expect(elegirPlantillaPublica([], null, () => 0.5)).toBe('');
  });

  it('con una sola frase la repite: no hay otra que elegir', () => {
    expect(elegirPlantillaPublica(['única'], 'única', () => 0)).toBe('única');
  });

  /**
   * 🔴 ADR 0033: **NINGUNA sugerencia de campaña puede prometer un privado.**
   *
   * El botón de enviar se habilita con sólo el público, así que un prefill que
   * promete + la caja privada en blanco publicaría la promesa sin que saliera
   * ningún privado. La que lo hacía se sacó del sorteo el 25-ago-2026.
   *
   * ⚠️ La de la Escuela queda afuera a propósito: no da por hecho un mensaje,
   * **invita** a escribir por privado, y es su texto de siempre.
   *
   * Busca «privado» a secas, no la frase entera: lo que hay que atajar es
   * cualquier redacción nueva que dé por hecho el mensaje, no una en concreto.
   */
  it('🔴 ninguna plantilla de campaña promete un mensaje privado', () => {
    const prometen = Object.entries(PLANTILLAS_PUBLICAS_POR_CLIENTE)
      .filter(([cliente]) => cliente !== 'escuela')
      .flatMap(([, lista]) => lista.filter((p) => /privado/i.test(p)));
    expect(prometen).toEqual([]);
  });
});
