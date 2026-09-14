import { describe, expect, test } from 'vitest';
import { PORQUE_DE_PRECIO, PORQUE_DE_RELLENO, porqueDestacable, semaforoDe, type EntradaSemaforo } from './semaforo';

/**
 * EL SEMÁFORO DE VENTAS (decidido por el dueño, 8-sep-2026; las cuatro
 * definiciones y el corte del rojo, 9-set-2026) — mide intención de COMPRA, no
 * tiempo. Un test en rojo por cada luz y uno por cada regla de precedencia
 * (candado 11 del CLAUDE.md: se rompe cada uno a propósito para comprobar que
 * cae antes de darlo por bueno).
 *
 * 🔴 **`preguntoPrecio` y `dijoQueNo` NO se miden igual, y de eso depende toda
 * la regla de recencia.** `dijoQueNo` es un `bool_or` sobre el historial de
 * entrantes («rechazó alguna vez») y `preguntoPrecio` es el veredicto del
 * ÚLTIMO entrante con texto («lo más nuevo que dijo con palabras habló de
 * plata», `cola/pregunta.ts`, #49). La función pura no puede ver fechas: el
 * ORDEN se lo cuentan esas dos semánticas distintas, y por eso
 * `dijoQueNo && preguntoPrecio` significa «rechazó ANTES y volvió», mientras que
 * `dijoQueNo && !preguntoPrecio` significa «lo último que dijo fue que no».
 */

const BASE: EntradaSemaforo = {
  hablo: false,
  entranteConSustancia: false,
  preguntoPrecio: false,
  nombroUnCurso: false,
  dijoQueNo: false,
  autoRespuestaDeNegocio: false,
  incoherente: false,
  perdidoDeclarado: false,
  botTemperatura: null,
  enfriada: false,
};

describe('semaforoDe — gris: el estado de entrada', () => {
  test('nadie escribió nunca: gris', () => {
    const r = semaforoDe(BASE);
    expect(r.luz).toBe('gris');
  });

  test('«hola, info» sin más sigue gris: contestó pero sin sustancia', () => {
    const r = semaforoDe({ ...BASE, hablo: true, entranteConSustancia: false });
    expect(r.luz).toBe('gris');
  });

  test('🔴 el contestador de otra empresa es gris, y le gana hasta al precio', () => {
    // Se pintaban de verde porque su saludo automático menciona plata. Del otro
    // lado no hay nadie a quien venderle: no es interés bajo, es que no es lead.
    const r = semaforoDe({
      ...BASE,
      hablo: true,
      entranteConSustancia: true,
      preguntoPrecio: true,
      autoRespuestaDeNegocio: true,
    });
    expect(r.luz).toBe('gris');
    expect(r.porque).toMatch(/contestador/i);
  });

  test('🔴 nombró un curso pero NUNCA contestó: sigue gris', () => {
    // El curso sale del formulario que llenó hace meses, emparejado por
    // teléfono. Sin una palabra suya en esta conversación no es una señal de hoy.
    const r = semaforoDe({ ...BASE, nombroUnCurso: true, hablo: false });
    expect(r.luz).toBe('gris');
  });

  test('🔴 haber comprado antes ya no pinta nada: no es un campo de esta regla', () => {
    // Era el 79 % de los verdes. El dato vive en el chip «Cliente»
    // (dominio/cliente.ts), no en la luz — antes estaba dicho dos veces y una
    // de las dos mentía.
    expect(Object.keys(BASE)).not.toContain('compro');
  });
});

describe('semaforoDe — verde: quiere comprar', () => {
  test('preguntó precio o cómo pagar', () => {
    const r = semaforoDe({ ...BASE, hablo: true, entranteConSustancia: true, preguntoPrecio: true });
    expect(r.luz).toBe('verde');
    expect(r.porque).toMatch(/precio/i);
  });

  test('el bot/LLM la ve caliente, y viaja como propuesto (origen: maquina)', () => {
    const r = semaforoDe({ ...BASE, botTemperatura: 'caliente' });
    expect(r.luz).toBe('verde');
    expect(r.origen).toBe('maquina');
  });
});

describe('semaforoDe — ámbar: duda', () => {
  test('contestó con sustancia sin señal de compra', () => {
    const r = semaforoDe({ ...BASE, hablo: true, entranteConSustancia: true });
    expect(r.luz).toBe('ambar');
  });

  test('🔴 nombró un curso Y contestó: ámbar, ya no verde', () => {
    const r = semaforoDe({ ...BASE, hablo: true, entranteConSustancia: true, nombroUnCurso: true });
    expect(r.luz).toBe('ambar');
    expect(r.porque).toMatch(/curso/i);
  });

  test('el bot/LLM la ve tibia', () => {
    const r = semaforoDe({ ...BASE, botTemperatura: 'tibio' });
    expect(r.luz).toBe('ambar');
    expect(r.origen).toBe('maquina');
  });

  test('un verde que se enfrió: precio enviado y silencio ≥ 3 días', () => {
    const r = semaforoDe({ ...BASE, hablo: true, entranteConSustancia: true, preguntoPrecio: true, enfriada: true });
    expect(r.luz).toBe('ambar');
    expect(r.porque).toMatch(/enfri/i);
  });
});

describe('semaforoDe — rojo: no quiere', () => {
  test('dijo que no', () => {
    const r = semaforoDe({ ...BASE, hablo: true, entranteConSustancia: true, dijoQueNo: true });
    expect(r.luz).toBe('rojo');
  });

  test('incoherente o spam', () => {
    const r = semaforoDe({ ...BASE, hablo: true, incoherente: true });
    expect(r.luz).toBe('rojo');
  });

  test('el bot/LLM la ve fría', () => {
    const r = semaforoDe({ ...BASE, botTemperatura: 'frio' });
    expect(r.luz).toBe('rojo');
    expect(r.origen).toBe('maquina');
  });

  test('perdido declarado', () => {
    const r = semaforoDe({ ...BASE, perdidoDeclarado: true });
    expect(r.luz).toBe('rojo');
  });
});

describe('semaforoDe — precedencia: rojo > verde > ámbar > gris', () => {
  test('preguntó precio y DESPUÉS dijo que no: rojo, no verde', () => {
    // Lo último que dijo fue el rechazo, así que el veredicto del último
    // entrante (`preguntoPrecio`) es false. Se deja de invertir tiempo ahí.
    const r = semaforoDe({
      ...BASE,
      hablo: true,
      entranteConSustancia: true,
      preguntoPrecio: false,
      dijoQueNo: true,
    });
    expect(r.luz).toBe('rojo');
  });

  test('🔴 dijo que no y DESPUÉS preguntó el precio: verde, no rojo', () => {
    // La dirección que faltaba, y la que se cobraba caro: el rechazo es un
    // bool_or del historial y la luz lo preguntaba primero, así que un «no» de
    // julio enterraba una pregunta de precio de septiembre PARA SIEMPRE —
    // «Atender siguiente» nunca abre un rojo.
    const r = semaforoDe({
      ...BASE,
      hablo: true,
      entranteConSustancia: true,
      preguntoPrecio: true,
      dijoQueNo: true,
    });
    expect(r.luz).toBe('verde');
  });

  test('bot caliente pero lo último que dijo fue que no: rojo, no verde', () => {
    const r = semaforoDe({ ...BASE, botTemperatura: 'caliente', dijoQueNo: true, preguntoPrecio: false, hablo: true });
    expect(r.luz).toBe('rojo');
  });

  test('sustancia sin compra y bot caliente: verde, no ámbar', () => {
    const r = semaforoDe({ ...BASE, hablo: true, entranteConSustancia: true, botTemperatura: 'caliente' });
    expect(r.luz).toBe('verde');
  });
});

describe('porqueDestacable — qué porqué merece un renglón en una lista', () => {
  test('🔴 los tres de relleno se callan: son el 90 % de las tarjetas (medido el 10-sep-2026)', () => {
    expect(porqueDestacable(PORQUE_DE_RELLENO.contesto)).toBe(false);
    expect(porqueDestacable(PORQUE_DE_RELLENO.saludo)).toBe(false);
    expect(porqueDestacable(PORQUE_DE_RELLENO.llego)).toBe(false);
  });

  test('y son exactamente los que `semaforoDe` devuelve cuando no hay señal', () => {
    expect(porqueDestacable(semaforoDe(BASE).porque)).toBe(false);
    expect(porqueDestacable(semaforoDe({ ...BASE, hablo: true }).porque)).toBe(false);
    expect(porqueDestacable(semaforoDe({ ...BASE, hablo: true, entranteConSustancia: true }).porque)).toBe(false);
  });

  test('un porqué con señal sí se dibuja: precio, rechazo, enfriamiento, contestador', () => {
    expect(porqueDestacable(semaforoDe({ ...BASE, hablo: true, preguntoPrecio: true }).porque)).toBe(true);
    expect(porqueDestacable(semaforoDe({ ...BASE, hablo: true, dijoQueNo: true }).porque)).toBe(true);
    expect(porqueDestacable(semaforoDe({ ...BASE, hablo: true, enfriada: true }).porque)).toBe(true);
    expect(porqueDestacable(semaforoDe({ ...BASE, autoRespuestaDeNegocio: true }).porque)).toBe(true);
  });

  test('sin porqué no hay nada que destacar', () => {
    expect(porqueDestacable(null)).toBe(false);
    expect(porqueDestacable(undefined)).toBe(false);
    expect(porqueDestacable('')).toBe(false);
  });

  /**
   * 🔴 EN CAMPAÑA NO SE HABLA DE PRECIO (regla del dueño, 13-sep-2026: «no
   * debería decir preguntó precio en ningún caso para campaña»). La luz la sigue
   * poniendo el server —el voto no se cobra, pero la señal es la misma—; lo que
   * se calla es la PALABRA. Se prueba contra lo que devuelve `semaforoDe`, no
   * contra la frase copiada: si mañana cambia el texto, esto sigue mordiendo.
   */
  test('🔴 en campaña se callan los dos porqués de precio, y sólo ésos', () => {
    const pregunto = semaforoDe({ ...BASE, hablo: true, preguntoPrecio: true }).porque;
    const seEnfrio = semaforoDe({ ...BASE, hablo: true, enfriada: true }).porque;
    expect(porqueDestacable(pregunto, { esDeCampana: true })).toBe(false);
    expect(porqueDestacable(seEnfrio, { esDeCampana: true })).toBe(false);

    expect(porqueDestacable(semaforoDe({ ...BASE, hablo: true, dijoQueNo: true }).porque, { esDeCampana: true })).toBe(true);
    expect(porqueDestacable(semaforoDe({ ...BASE, autoRespuestaDeNegocio: true }).porque, { esDeCampana: true })).toBe(true);
  });

  /**
   * 🔴 LA REGLA DE CAMPAÑA COMPARA CONTRA LA FRASE QUE MANDA EL SERVER. El `porque`
   * de la tarjeta lo escribe `server/src/cola/semaforoSql.ts` (y su gemelo
   * `semaforo.ts`), no este archivo: si allá cambia el texto y acá no, en campaña
   * vuelve a salir «preguntó precio» sin que nada falle. El test de paridad del
   * server cruza el server con su SQL, no con el front — éste es el que ata las
   * dos mitades. `?raw` y no `node:fs`: `tsc -p tsconfig.app.json` no lleva los
   * tipos de node (misma lección que `etapas.test.ts`).
   */
  test('🔴 las frases de precio son LAS MISMAS que escribe el server', () => {
    const fuentes = import.meta.glob(['../../server/src/cola/semaforo.ts', '../../server/src/cola/semaforoSql.ts'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    expect(Object.keys(fuentes), 'no se encontraron las fuentes del server').toHaveLength(2);
    for (const [archivo, texto] of Object.entries(fuentes)) {
      for (const frase of Object.values(PORQUE_DE_PRECIO)) {
        expect(texto, `«${frase}» no está en ${archivo}`).toContain(`${archivo.endsWith('Sql.ts') ? "'" : '"'}${frase}${archivo.endsWith('Sql.ts') ? "'" : '"'}`);
      }
    }
  });

  test('en ventas los de precio se siguen diciendo', () => {
    expect(porqueDestacable(semaforoDe({ ...BASE, hablo: true, preguntoPrecio: true }).porque, { esDeCampana: false })).toBe(true);
  });
});
