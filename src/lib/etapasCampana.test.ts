import { describe, expect, it } from 'vitest';
import { ETAPAS, ETAPAS_CAMPANA, ordenDelEmbudo, SIN_RESPUESTA } from './etapas';

/**
 * ══ EL EMBUDO DE CAMPAÑA SE DIBUJA EN ORDEN ═════════════════════════════════
 *
 * 🔴 `ordenDelEmbudo` ordena contra `ORDEN_PREFERIDO_EMBUDO`, que era
 * `[SIN_RESPUESTA, ...ETAPAS]` — **sólo las etapas de ventas**. Las tres de
 * campaña (`simpatiza` · `comprometido` · `voluntario`) no estaban ahí, así que
 * caían en la rama «desconocidas» y se agregaban AL FINAL.
 *
 * El resultado no era una lista vacía ni un cero —por eso nadie lo vio— sino
 * una escalera desordenada: `Dijeron que no` quedaba ANTES de `Simpatizan`.
 * Y un embudo es una progresión: leído de izquierda a derecha, ese orden dice
 * que la gente pasa por «dijeron que no» y después simpatiza.
 *
 * ⚠️ Es la misma familia que #329, que este archivo ya documenta: allá el
 * Dashboard **omitía** una etapa por iterar una lista fija del front; acá no la
 * omite (eso ya se arregló derivando de las claves del server) pero la ORDENA
 * con una lista que tampoco conoce los dos módulos.
 */
describe('el orden del embudo conoce los dos módulos', () => {
  it('la escalera de campaña sale en su orden, no apilada al final', () => {
    // Lo que el server manda para un operador de campaña (ADR 0063): los dos
    // peldaños compartidos, los tres propios, y `perdido`, que se declara.
    const delServer = ['voluntario', 'perdido', 'interesado', 'comprometido', 'contactado', 'simpatiza'];

    expect(ordenDelEmbudo(delServer)).toEqual([
      'interesado',
      'contactado',
      'simpatiza',
      'comprometido',
      'voluntario',
      'perdido',
    ]);
  });

  /**
   * El de ventas no se mueve ni un lugar. Es la mitad que hay que proteger:
   * agregar las de campaña no puede reordenar la pantalla que ya se usa todos
   * los días — `sin_respuesta` va primera (es la etapa más grande, el 65 %) y
   * `perdido` última.
   */
  it('el de ventas queda exactamente como estaba', () => {
    const delServer = ['cierre', 'sin_respuesta', 'cotizado', 'interesado', 'contactado', 'perdido'];

    expect(ordenDelEmbudo(delServer)).toEqual([
      SIN_RESPUESTA,
      'interesado',
      'contactado',
      'cotizado',
      'cierre',
      'perdido',
    ]);
  });

  /**
   * ⚠️ Los dos módulos comparten `interesado` y `contactado`, así que una etapa
   * no puede aparecer dos veces en el orden preferido — se dibujaría duplicada
   * en la barra y el total no cerraría con la suma de los segmentos.
   */
  it('ninguna etapa se cuenta dos veces, aunque los módulos compartan peldaños', () => {
    const todas = [SIN_RESPUESTA, ...ETAPAS, ...ETAPAS_CAMPANA];
    const ordenadas = ordenDelEmbudo(todas);
    expect(ordenadas).toHaveLength(new Set(ordenadas).size);
    expect(new Set(ordenadas)).toEqual(new Set(todas));
  });

  /**
   * La degradación de #329 no se toca: una clave que el server invente mañana
   * **no se pierde**, se agrega al final. Es lo que permite que la relación
   * «toda etapa que el seam puede devolver, el Dashboard la puede dibujar» se
   * fije sin enumerar cada etapa a mano.
   */
  it('una etapa que el front no conoce sigue llegando al final, no se pierde', () => {
    expect(ordenDelEmbudo(['militante', 'interesado'])).toEqual(['interesado', 'militante']);
  });
});
