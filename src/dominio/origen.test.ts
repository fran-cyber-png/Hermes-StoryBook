import { describe, expect, test } from 'vitest';
import { deDondeVino, type OrigenCrudo } from './origen';

/**
 * LA ETIQUETA DE ORIGEN, en puro: qué dice y por qué. Sin React, sin base.
 *
 * Los valores de los casos son los REALES de producción del 7-sep-2026 —el
 * anuncio resuelto de Luis, el sin resolver de Rafael, y los ocho mensajes sin
 * origen de Mario Sánchez—, no un caso ideal. La galería (`galeriaOrigen.tsx`)
 * sirve exactamente los mismos.
 *
 * ⚠️ **El cableado NO se prueba acá** (ADR 0024): que esta función esté bien no
 * dice nada sobre si su respuesta llega a la pantalla. Eso lo fijan
 * `origenEnLaFila.test.tsx` y `origenEnLaFicha.test.tsx`, que montan.
 */

/** El anuncio de Luis López Loarte, ya resuelto contra Meta (ad 120249753997080789). */
const RESUELTO: OrigenCrudo = {
  fuente: 'anuncio',
  adId: '120249753997080789',
  titulo: '🎓 Diploma Internacional de Inteligencia y Contrainteligencia',
  anuncio: 'flyer principal',
  campana: '[SEP][DIPICOT027] Diplomado en Inteligencia 27 - Perú',
};

/** El de Rafael: el mismo hecho, sin que nadie le haya preguntado a Meta todavía. */
const SIN_RESOLVER: OrigenCrudo = {
  fuente: 'anuncio',
  adId: '120253750387870341',
  titulo: 'La política no se improvisa. Se planifica.',
};

describe('deDondeVino — es TOTAL: para toda fila de chat hay algo que decir', () => {
  test('sin ningún origen NO devuelve null: devuelve «Sin origen»', () => {
    const r = deDondeVino({ tipo: 'mensaje', origen_anuncio: null, ultima_origen: null });
    expect(r?.clase).toBe('desconocido');
    expect(r?.etiqueta).toBe('Sin origen');
  });

  // El caso de Mario, tal cual está en producción: 8 mensajes, `origen` nulo en
  // los ocho. La pantalla tiene que decir «no sabemos», no quedarse callada.
  test('la ayuda del «Sin origen» explica los DOS motivos y no afirma que no hubo anuncio', () => {
    const r = deDondeVino({ tipo: 'mensaje' });
    expect(r?.ayuda).toContain('antes de que su línea se enlazara');
    expect(r?.ayuda).toContain('sin referral');
    // Lo que el hueco en blanco invitaba a concluir, y que es falso.
    expect(r?.ayuda).toContain('No quiere decir que no haya visto un anuncio');
  });

  /**
   * 🔴 **UN MOTIVO QUE EN ESE CANAL NO EXISTE ES UNA CAUSA INVENTADA.** Los DM
   * de Messenger e Instagram salen del MISMO CTE que WhatsApp
   * (`tipo = 'mensaje'`, `server/src/cola/consultarCola.ts`), así que caen en
   * esta misma rama — y ahí «escribió antes de que su línea se enlazara (el
   * enlace por QR no trae el historial)» no significa nada: no hay línea que
   * enlazar ni QR que escanear.
   */
  test('la ayuda no habla del enlace por QR en un DM de Messenger o Instagram', () => {
    const wa = deDondeVino({ tipo: 'mensaje', canal: 'whatsapp' });
    const ig = deDondeVino({ tipo: 'mensaje', canal: 'instagram' });
    expect(wa?.ayuda).toContain('enlace por QR');
    expect(ig?.ayuda).not.toContain('enlace por QR');
    expect(ig?.ayuda).toContain('directo a la Página');
    // Lo que NO cambia con el canal: seguir negando la conclusión falsa.
    expect(ig?.ayuda).toContain('No quiere decir que no haya visto un anuncio');
  });

  test('un comentario NO lleva etiqueta: su origen es la publicación, que la fila ya muestra', () => {
    expect(deDondeVino({ tipo: 'comentario' })).toBeNull();
  });

  test('un lead de formulario dice «Formulario», no «Sin origen» — su origen SÍ se sabe', () => {
    const r = deDondeVino({ tipo: 'lead' });
    expect(r?.clase).toBe('formulario');
    expect(r?.etiqueta).toBe('Formulario');
  });
});

describe('deDondeVino — anuncio', () => {
  test('resuelto: la campaña y el anuncio viajan SEPARADOS, y la fila solo dice «Anuncio»', () => {
    const r = deDondeVino({ tipo: 'mensaje', resuelto: RESUELTO });
    expect(r?.clase).toBe('anuncio');
    expect(r?.etiqueta).toBe('Anuncio');
    expect(r?.anuncio).toBe('flyer principal');
    expect(r?.campana).toBe('[SEP][DIPICOT027] Diplomado en Inteligencia 27 - Perú');
  });

  test('la ayuda dice el nombre, la campaña Y el titular que la persona leyó', () => {
    const r = deDondeVino({ tipo: 'mensaje', resuelto: RESUELTO });
    expect(r?.ayuda).toContain('«flyer principal»');
    expect(r?.ayuda).toContain('[SEP][DIPICOT027]');
    expect(r?.ayuda).toContain('🎓 Diploma Internacional de Inteligencia y Contrainteligencia');
  });

  /**
   * 🔴 El candado de la decisión medida: el 60 % de los leads de pauta llega sin
   * nombre resuelto, y los 1.954 traen titular. Un `adId` pelado como etiqueta
   * sería un número de 18 dígitos en la cara de la vendedora.
   */
  test('sin resolver: lo que identifica al anuncio es el TITULAR, no el adId', () => {
    const r = deDondeVino({ tipo: 'mensaje', origen_anuncio: SIN_RESOLVER });
    expect(r?.anuncio).toBe('La política no se improvisa. Se planifica.');
    expect(r?.anuncio).not.toContain('120253750387870341');
    expect(r?.etiqueta).not.toContain('120253750387870341');
  });

  /**
   * 🔴 **Y NO SE HACE PASAR POR UNA CAMPAÑA.** El titular es lo que la persona
   * leyó, no el nombre de una campaña de Meta; mientras nadie le pregunte a
   * Meta, `campana` es `null` y quien dibuja tiene que rotularlo por lo que es.
   * Cuando estas dos viajaban juntas en una sola cadena, la ficha titulaba
   * «CAMPAÑA: La política no se improvisa» en el 60 % de los casos.
   */
  test('sin resolver NO hay campaña: el titular no ocupa su lugar', () => {
    const r = deDondeVino({ tipo: 'mensaje', origen_anuncio: SIN_RESOLVER });
    expect(r?.campana).toBeNull();
  });

  test('sin resolver: el adId viaja igual (dispara la resolución) y se lee en la ayuda', () => {
    const r = deDondeVino({ tipo: 'mensaje', origen_anuncio: SIN_RESOLVER });
    expect(r?.adId).toBe('120253750387870341');
    expect(r?.ayuda).toContain('todavía no se resolvió su nombre en Meta');
    expect(r?.ayuda).toContain('ID 120253750387870341');
  });

  // Mismo motivo que `cursoDeFila`: el referral viaja SOLO en el primer mensaje.
  // Con `ultima_origen` a secas, quien escribe dos veces pierde el anuncio y la
  // fila pasaría de «Anuncio» a «Sin origen» sola — el defecto que este frente
  // existe para matar, cometido por dentro.
  test('el anuncio sale del PRIMERO de la conversación aunque el último mensaje no lo traiga', () => {
    const r = deDondeVino({ tipo: 'mensaje', origen_anuncio: SIN_RESOLVER, ultima_origen: null });
    expect(r?.clase).toBe('anuncio');
  });

  test('lo resuelto le gana al crudo: es el único de los tres que puede traer nombres', () => {
    const r = deDondeVino({ tipo: 'mensaje', resuelto: RESUELTO, origen_anuncio: SIN_RESOLVER });
    expect(r?.anuncio).toBe('flyer principal');
    expect(r?.campana).toContain('[SEP][DIPICOT027]');
  });

  test('un anuncio sin titular ni nombre sigue diciendo que es un anuncio', () => {
    const r = deDondeVino({ tipo: 'mensaje', origen_anuncio: { fuente: 'anuncio', adId: '123' } });
    expect(r?.clase).toBe('anuncio');
    expect(r?.anuncio).toBeNull();
    expect(r?.ayuda).toContain('Vino de un anuncio de Facebook o Instagram');
  });

  /**
   * El otro lado del `switch` exhaustivo: en COMPILACIÓN obliga a decidir, y en
   * EJECUCIÓN degrada. Un server nuevo contra un front viejo (N5 sale por un
   * botón, N4 solo) puede escribir una fuente que este build no conoce, y ahí
   * «no sabemos qué es» y «no sabemos de dónde vino» son la misma respuesta.
   */
  test('una fuente que este build no conoce cae en «Sin origen», no revienta', () => {
    const r = deDondeVino({
      tipo: 'mensaje',
      ultima_origen: { fuente: 'tiktok' as unknown as 'anuncio', titulo: 'algo' },
    });
    expect(r?.clase).toBe('desconocido');
    expect(r?.etiqueta).toBe('Sin origen');
  });

  test('un título en blanco no cuenta como titular', () => {
    const r = deDondeVino({ tipo: 'mensaje', origen_anuncio: { fuente: 'anuncio', titulo: '   ' } });
    expect(r?.anuncio).toBeNull();
  });
});

/**
 * ⚠️ **Producción no tiene NI UNA landing**: 0 filas en toda la historia de
 * `events` (medido el 7-sep-2026), aunque `whatsapp/origen.ts` la detecta desde
 * siempre. Estos casos usan la forma que ESE detector escribe, y quedan dichos
 * como lo que son: la rama que todavía no se ejerció en la vida real.
 */
describe('deDondeVino — landing (la rama que producción nunca ejerció)', () => {
  test('con código dice cuál landing fue', () => {
    const r = deDondeVino({ tipo: 'mensaje', ultima_origen: { fuente: 'landing', ref: 'clandestinas' } });
    expect(r?.clase).toBe('landing');
    expect(r?.etiqueta).toBe('Landing');
    expect(r?.ref).toBe('clandestinas');
  });

  test('sin código sigue siendo landing, y la ayuda admite que no se sabe cuál', () => {
    const r = deDondeVino({ tipo: 'mensaje', ultima_origen: { fuente: 'landing' } });
    expect(r?.clase).toBe('landing');
    expect(r?.ayuda).toContain('sin código que diga cuál');
  });
});
