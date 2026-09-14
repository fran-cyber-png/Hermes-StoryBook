import { describe, expect, it } from 'vitest';
import { lecturaDelBot, marcaDelBot } from './bot';

describe('marcaDelBot', () => {
  it('la escalada por cerrar se lee como «Listo para cerrar»', () => {
    // El caso que costó tres leads el 1-ago-2026: el bot marcaba esto y nadie lo veía.
    expect(marcaDelBot({ bot_escalada: true, bot_motivo: 'por_cerrar' })).toEqual({
      tono: 'escalada',
      texto: 'Listo para cerrar',
      titulo: 'El bot se frenó y espera a una persona: listo para cerrar',
    });
  });

  it('los seis motivos del server tienen lectura propia, y ninguna se confunde con otra', () => {
    const motivos = [
      'por_cerrar',
      'pidio_humano',
      'pregunto_si_es_bot',
      'sin_respuesta_en_catalogo',
      'frustrado',
      'error_bot',
    ];
    const textos = motivos.map((m) => marcaDelBot({ bot_escalada: true, bot_motivo: m })?.texto);
    expect(textos.every((t) => typeof t === 'string' && t.length > 0)).toBe(true);
    expect(new Set(textos).size).toBe(motivos.length);
    // Y ninguno cae en el genérico: si alguien agrega un motivo al server y se
    // olvida acá, este test no lo atrapa — pero sí atrapa haber roto uno de los seis.
    expect(textos).not.toContain('Pidió ayuda');
  });

  it('un motivo que el front no conoce NO se calla ni inventa: dice el hecho que sí sabe', () => {
    // El enum de escaladas crece del lado del server. Un server más nuevo que
    // esta app tiene que producir «el bot se frenó», nunca una fila sin marca
    // (que se leería como «nadie pidió ayuda») ni un motivo parecido.
    expect(marcaDelBot({ bot_escalada: true, bot_motivo: 'motivo_del_futuro' })).toEqual({
      tono: 'escalada',
      texto: 'Pidió ayuda',
      titulo: 'El bot se frenó y espera a una persona',
    });
  });

  it('la escalada le gana a la temperatura: una espera a una persona, la otra no', () => {
    const m = marcaDelBot({ bot_escalada: true, bot_motivo: 'por_cerrar', bot_temperatura: 'caliente' });
    expect(m?.tono).toBe('escalada');
  });

  it('caliente sin escalar se dibuja, con el motivo libre del modelo en el title', () => {
    expect(marcaDelBot({ bot_temperatura: 'caliente', bot_motivo: 'preguntó por las cuotas' })).toEqual({
      tono: 'caliente',
      texto: 'Caliente',
      titulo: 'El bot la ve caliente: preguntó por las cuotas',
    });
  });

  it('caliente sin motivo tampoco se calla', () => {
    expect(marcaDelBot({ bot_temperatura: 'caliente' })?.titulo).toBe('El bot la ve caliente');
  });

  it('tibio y frío no se dibujan: serían 50 de 66 filas', () => {
    expect(marcaDelBot({ bot_temperatura: 'tibio' })).toBeNull();
    expect(marcaDelBot({ bot_temperatura: 'frio' })).toBeNull();
  });

  it('sin dato no hay marca — la ausencia NO es «el bot la vio fría»', () => {
    // El radar y la agenda arman `Conversacion` sin estos campos, y un server sin
    // la migración del bot tampoco los trae.
    expect(marcaDelBot({})).toBeNull();
    expect(marcaDelBot({ bot_escalada: null, bot_temperatura: null, bot_motivo: null })).toBeNull();
  });

  it('`bot_escalada: false` no es una marca: el bot la calificó y siguió trabajando', () => {
    expect(marcaDelBot({ bot_escalada: false, bot_temperatura: 'tibio' })).toBeNull();
  });
});

/**
 * LA LECTURA COMPLETA — la misma tabla, leída donde SÍ hay lugar.
 *
 * `marcaDelBot` dibuja dos hechos y calla `tibio` y `frio` a propósito: en una
 * LISTA, un chip que aparece en 50 de 66 filas no ayuda a elegir a quién
 * atender. Esa medición sigue valiendo y no se toca.
 *
 * Pero la ficha no es una lista: es UNA conversación abierta, y ahí la pregunta
 * cambia de «¿a quién toco?» a «¿qué sé de ésta?». Un «Tibio» que en la cola era
 * ruido, acá es lo que el bot concluyó — y hasta hoy nadie lo veía nunca, ni
 * abriendo la conversación. Cuánto es ese «nunca», medido, está en `bot.ts`, que
 * es el único archivo donde esa cifra se escribe.
 */
describe('la lectura completa, para la ficha', () => {
  it('dice la temperatura que el bot calificó, incluida la tibia que la lista calla', () => {
    const l = lecturaDelBot({ bot_temperatura: 'tibio', bot_motivo: 'preguntó por el temario' });
    expect(l?.temperatura).toBe('tibio');
    expect(l?.texto).toBe('Tibio');
    expect(l?.motivo).toBe('preguntó por el temario');
  });

  it('la fría también: es un dato, no una ausencia de dato', () => {
    expect(lecturaDelBot({ bot_temperatura: 'frio' })?.texto).toBe('Frío');
  });

  it('la caliente se lee igual que en la lista, con su motivo', () => {
    const l = lecturaDelBot({ bot_temperatura: 'caliente', bot_motivo: 'pidió el precio' });
    expect(l?.temperatura).toBe('caliente');
    expect(l?.motivo).toBe('pidió el precio');
  });

  it('🔴 sin fila devuelve null: la ausencia de dato NO es «el bot la vio fría»', () => {
    expect(lecturaDelBot({})).toBeNull();
    expect(lecturaDelBot({ bot_temperatura: null, bot_motivo: null })).toBeNull();
  });

  it('una temperatura que este front no conoce no se inventa ni se acerca a la parecida', () => {
    // El vocabulario lo fija el server (`bot/acciones.ts`) y puede crecer.
    expect(lecturaDelBot({ bot_temperatura: 'templado' })).toBeNull();
  });

  it('la escalada se dice, y su motivo va en CRIOLLO y no con el enum crudo', () => {
    const l = lecturaDelBot({ bot_escalada: true, bot_motivo: 'por_cerrar', bot_temperatura: 'caliente' });
    expect(l?.escalada).toBe(true);
    expect(l?.motivo).toBe('Listo para cerrar');
    // Y la temperatura NO se pierde: son dos hechos y la ficha tiene lugar para
    // los dos. En la lista gana uno porque entra uno; acá no hace falta elegir.
    expect(l?.temperatura).toBe('caliente');
  });

  it('un motivo de escalada que el front no conoce no se muestra crudo', () => {
    // El enum crece del lado del server. Mostrar `motivo_nuevo_del_server` es
    // peor que no mostrar nada: parece un error de la app.
    const l = lecturaDelBot({ bot_escalada: true, bot_motivo: 'motivo_que_no_existe_aun' });
    expect(l?.escalada).toBe(true);
    expect(l?.motivo).toBeNull();
  });

  it('una escalada sin calificar se dice igual: el hecho más caro no depende de la temperatura', () => {
    const l = lecturaDelBot({ bot_escalada: true, bot_motivo: 'pidio_humano' });
    expect(l?.escalada).toBe(true);
    expect(l?.temperatura).toBeNull();
    expect(l?.motivo).toBe('Pidió una persona');
  });
});
