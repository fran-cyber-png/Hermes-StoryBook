import { describe, expect, test } from 'vitest';
import { contactosDelGrupo, ETAPA_GRUPOS, NIVEL_GRUPOS } from '../../dominio/segmentosPadron';
import { FACETAS, SIN_ASIGNAR, TOTAL_PADRON } from './galeriaDatos';

/**
 * EL CANDADO CONTRA LA GALERÍA VIEJA — regla dura #9 del CLAUDE.md, hecha test.
 *
 * `FACETAS.etapa` estuvo incompleta tres semanas (le faltaban 4 de 10 valores)
 * y una captura de esa misma galería mostró «Se perdió: 0» cuando en
 * producción hay 7 — casi se validó un rediseño entero contra datos que nunca
 * tuvieron ese valor. Actualizar a mano arregla hoy y no evita que pase de
 * nuevo dentro de tres semanas. Esto lo hace imposible de repetir en silencio.
 */

function suma(pares: readonly (readonly [string, number])[]): number {
  return pares.reduce((s, [, n]) => s + n, 0);
}

describe('completitud de FACETAS contra TOTAL_PADRON', () => {
  /**
   * `stage` y `source` no tienen NULL en icarus (todo contacto entró por
   * ALGUNA fuente y está en ALGUNA etapa): la suma de sus valores tiene que
   * dar el total exacto. Si falta un valor —como faltaban `lost` y
   * `recontact`— la suma no cuadra y esto se pone rojo solo.
   */
  test('etapa: la suma de las 10 etapas es el total del padrón', () => {
    expect(suma(FACETAS.etapa)).toBe(TOTAL_PADRON);
  });

  test('fuente: la suma de las fuentes es el total del padrón', () => {
    expect(suma(FACETAS.fuente)).toBe(TOTAL_PADRON);
  });

  /**
   * ⚠️ **`nivel` (`buyer_tier`) NO se testea contra el total, y es a propósito
   * — no es una excepción por pereza.** ~33 % de `buyer_tier` es NULL (ver el
   * docblock de `NIVEL_GRUPOS` en `padron.ts`) y la faceta del server excluye
   * los valores vacíos: sumar los 4 conocidos NUNCA va a dar `TOTAL_PADRON`,
   * y forzar esa igualdad pondría el test rojo por un motivo que no es un bug.
   * Lo que SÍ se puede exigir es que los 4 valores que `NIVEL_GRUPOS` conoce
   * sigan estando — ver el test de abajo.
   */
  test('nivel: sabido y documentado que NO suma el total (33% es NULL)', () => {
    expect(suma(FACETAS.nivel)).toBeLessThan(TOTAL_PADRON);
  });

  /**
   * `pais` y `curso` son intencionalmente un recorte (top-N ilustrativo, no
   * las 62/102 opciones reales) — no se testean contra el total por el mismo
   * motivo que `nivel`, pero por una razón distinta: acá no es NULL, es que
   * la galería nunca pretendió listarlas todas.
   */

  /**
   * LA CAPTURA DEL 10-SEP — las cuatro cifras que sí salieron de producción
   * (vía la pantalla del dueño) tienen que seguir diciendo eso. El reparto por
   * valor es proporcional, así que lo que se fija son las SUMAS de los grupos,
   * que es lo que la pantalla muestra.
   */
  test('sin asignar: las etapas suman los 73.200 y los grupos dan lo de la captura', () => {
    const porValor = SIN_ASIGNAR.etapa.map(([valor, contactos]) => ({ valor, contactos }));
    const grupo = (id: string) => contactosDelGrupo(porValor, ETAPA_GRUPOS.find((g) => g.id === id)!);
    expect(suma(SIN_ASIGNAR.etapa)).toBe(SIN_ASIGNAR.total);
    expect(grupo('conversacion')).toBe(850);
    expect(grupo('sin_cerrar')).toBe(5_792);
  });

  for (const [nombre, grupos] of [
    ['ETAPA_GRUPOS', ETAPA_GRUPOS],
    ['NIVEL_GRUPOS', NIVEL_GRUPOS],
  ] as const) {
    test(`${nombre}: cada valor crudo que agrupa existe en la faceta de la galería`, () => {
      const campo = nombre === 'ETAPA_GRUPOS' ? 'etapa' : 'nivel';
      const conocidos = new Set(FACETAS[campo].map(([valor]) => valor));
      const faltantes = grupos.flatMap((g) => g.valores).filter((v) => !conocidos.has(v));
      expect(faltantes).toEqual([]);
    });
  }
});
