import { describe, expect, it } from 'vitest';
import { claseDeComentario, emojisQueEntranGrandes } from './comentario';

describe('claseDeComentario', () => {
  it('un comentario con palabras es texto', () => {
    expect(claseDeComentario('Excelente propuesta')).toBe('texto');
    expect(claseDeComentario('Bendiciones')).toBe('texto');
  });

  it('vacío o sólo espacios no es nada — el sticker trae `message: ""`', () => {
    expect(claseDeComentario('')).toBe('vacio');
    expect(claseDeComentario('   ')).toBe('vacio');
    expect(claseDeComentario(null)).toBe('vacio');
    expect(claseDeComentario(undefined)).toBe('vacio');
  });

  it('sólo emojis se reconoce, con y sin espacios en el medio', () => {
    expect(claseDeComentario('😂😂😂')).toBe('emoji');
    expect(claseDeComentario('👏 👏 👏')).toBe('emoji');
    expect(claseDeComentario('❤️')).toBe('emoji');
  });

  /**
   * 🔴 EL CASO QUE OBLIGA A NO USAR `\p{Emoji}`.
   *
   * Esa propiedad de Unicode incluye los DÍGITOS, el `#` y el `*`, porque son la
   * base de los emojis de teclado (`1️⃣`). Con ella, un comentario que dice «2»
   * —o un número de teléfono— se dibujaría gigante y centrado como si fuera un
   * aplauso. `\p{Extended_Pictographic}` no los incluye.
   */
  it('🔴 un número NO es un emoji, por más que Unicode diga `Emoji`', () => {
    expect(claseDeComentario('2')).toBe('texto');
    expect(claseDeComentario('10')).toBe('texto');
    expect(claseDeComentario('987654321')).toBe('texto');
    expect(claseDeComentario('#')).toBe('texto');
    expect(claseDeComentario('*')).toBe('texto');
  });

  it('texto con emojis sigue siendo texto: hay algo que leer', () => {
    expect(claseDeComentario('¡Excelente propuesta! 👏')).toBe('texto');
    expect(claseDeComentario('👏 gracias')).toBe('texto');
  });

  /** Con puntuación hay algo que leer, y agrandarlo lo vuelve ilegible. */
  it('un emoji con puntuación es texto', () => {
    expect(claseDeComentario('😂!')).toBe('texto');
    expect(claseDeComentario('¿😂?')).toBe('texto');
  });

  /**
   * 🔴 LOS EMOJIS COMPUESTOS, que son donde una implementación ingenua se cae:
   * una familia es cuatro pictogramas pegados con ZWJ, una bandera son dos
   * letras regionales, y un pulgar con tono de piel lleva un modificador.
   * Recorrer la cadena por índice partiría los pares sustitutos en mitades que
   * no son nada, y TODO emoji caería en «texto».
   */
  it('🔴 familias, banderas y tonos de piel siguen siendo sólo emojis', () => {
    expect(claseDeComentario('👨‍👩‍👧‍👦')).toBe('emoji');
    expect(claseDeComentario('🇵🇪')).toBe('emoji');
    expect(claseDeComentario('👍🏽')).toBe('emoji');
    expect(claseDeComentario('🧑‍💻')).toBe('emoji');
    expect(claseDeComentario('👍🏽 🇵🇪')).toBe('emoji');
  });
});

describe('emojisQueEntranGrandes', () => {
  it('los pocos entran grandes', () => {
    expect(emojisQueEntranGrandes('😂')).toBe(true);
    expect(emojisQueEntranGrandes('👏👏👏')).toBe(true);
  });

  /** Una ristra larga agrandada rompe el alto que la fase 11 pide cuidar. */
  it('una ristra larga se dibuja como texto normal', () => {
    expect(emojisQueEntranGrandes('😂'.repeat(9))).toBe(false);
    expect(emojisQueEntranGrandes('👏'.repeat(30))).toBe(false);
  });

  /** El tono de piel no cuenta como otro emoji: sigue siendo un pulgar. */
  it('un emoji con modificador cuenta como uno', () => {
    expect(emojisQueEntranGrandes('👍🏽👍🏽👍🏽')).toBe(true);
  });
});
