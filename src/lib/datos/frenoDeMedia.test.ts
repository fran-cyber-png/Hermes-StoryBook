import { describe, expect, test } from 'vitest';
import {
  ESPERA_BASE_MS,
  ESPERA_TOPE_MS,
  crearFrenoDeMedia,
  esperaTrasFallos,
  etiquetaDeStatus,
} from './frenoDeMedia';

/**
 * LO QUE ESTOS TESTS FIJAN, y es una sola relación con dos mitades:
 *
 *   **un `no-hay` deja de pedirse, y un `no-se-pudo` se sigue pidiendo — pero
 *   cada vez menos.**
 *
 * Las dos mitades tienen que estar en el mismo archivo porque el defecto que
 * viene a evitar es confundirlas: cachear el 503 «ya que estamos» rompe la foto
 * de un contacto real cuya línea vuelve a estar montada, y no cachear el 404
 * deja los 3.581 pedidos diarios que ya sabemos cómo terminan.
 */

describe('etiquetaDeStatus', () => {
  test('🔴 solo el 404 dice «no tiene foto» — es lo único que se recuerda para siempre', () => {
    expect(etiquetaDeStatus(404)).toBe('no-hay');
  });

  test('🔴 el 503 NO es «no tiene foto»: es «no se pudo preguntar»', () => {
    // El error que este módulo vino a deshacer. El server manda 503 sin guardar
    // nada a propósito (un negativo ahí diría «no tiene foto» durante 7 días
    // sobre un contacto que ni siquiera se llegó a consultar); leerlo como
    // `no-hay` acá reproduce ese mismo defecto del lado del cliente.
    expect(etiquetaDeStatus(503)).toBe('no-se-pudo');
  });

  test('el 401 tiene etiqueta propia: no es un fallo de la línea', () => {
    expect(etiquetaDeStatus(401)).toBe('sin-sesion');
  });

  test('⚠️ el 400 y el 403 son `no-se-pudo`, no `no-hay`', () => {
    // Nunca van a andar (teléfono inválido, frontera de campaña de ADR 0061) y
    // el backoff los lleva al techo igual. Recordarlos como «no tiene foto»
    // sería afirmar algo del CONTACTO a partir de algo de la PETICIÓN, y ese
    // «no» quedaría pegado incluso después de arreglar lo que estaba mal.
    expect(etiquetaDeStatus(400)).toBe('no-se-pudo');
    expect(etiquetaDeStatus(403)).toBe('no-se-pudo');
  });

  test('un status que nadie previó cae en `no-se-pudo`, nunca en `no-hay`', () => {
    expect(etiquetaDeStatus(500)).toBe('no-se-pudo');
    expect(etiquetaDeStatus(418)).toBe('no-se-pudo');
  });
});

describe('esperaTrasFallos', () => {
  test('duplica desde la base y se planta en el techo', () => {
    expect(esperaTrasFallos(1)).toBe(ESPERA_BASE_MS);
    expect(esperaTrasFallos(2)).toBe(ESPERA_BASE_MS * 2);
    expect(esperaTrasFallos(3)).toBe(ESPERA_BASE_MS * 4);
    expect(esperaTrasFallos(8)).toBe(ESPERA_TOPE_MS);
    expect(esperaTrasFallos(9)).toBe(ESPERA_TOPE_MS);
  });

  test('sin fallos no se espera nada', () => {
    expect(esperaTrasFallos(0)).toBe(0);
  });

  test('un contador absurdo se planta en el techo, no desborda a Infinity', () => {
    // `2 ** 2000` es Infinity, y una espera de Infinity dejaría la URL frenada
    // para siempre — que es justo lo que este módulo NO puede hacer.
    expect(esperaTrasFallos(2000)).toBe(ESPERA_TOPE_MS);
  });

  test('la rampa hasta el techo cuesta un par de horas, no una jornada', () => {
    // La suma de las esperas hasta el techo es lo que decide cuántos intentos
    // caben en un día. Si la rampa crece, se recorrería entera todos los días y
    // el techo no llegaría a morder nunca.
    //
    // ⚠️ El tope de escalones NO es decoración: con una espera que no crece este
    // bucle no termina, y un candado que se CUELGA en vez de ponerse rojo no es
    // un candado. Lo encontró la verificación en rojo de este mismo PR, no la
    // lectura del test.
    let total = 0;
    let escalones = 0;
    while (escalones < 100 && esperaTrasFallos(escalones + 1) < ESPERA_TOPE_MS) {
      escalones += 1;
      total += esperaTrasFallos(escalones);
    }
    expect(escalones).toBeLessThan(100); // llegó al techo: la espera crece de verdad
    expect(total).toBeLessThan(2 * ESPERA_TOPE_MS); // 63,5 min con los valores de hoy
  });
});

describe('el freno de la media', () => {
  test('una URL virgen se pide', () => {
    const freno = crearFrenoDeMedia();
    expect(freno.consultar('/foto/9', 0)).toBe('pedir');
  });

  test('🔴 un `no-hay` NO se vuelve a pedir: es un hecho, no un freno', () => {
    const freno = crearFrenoDeMedia();
    freno.anotar('/foto/9', 'no-hay', 0);
    expect(freno.consultar('/foto/9', 0)).toBe('no-hay');
    // Ni dentro de un rato, ni mañana: el server cachea el mismo «no» 7 días.
    expect(freno.consultar('/foto/9', 7 * 24 * 60 * 60_000)).toBe('no-hay');
  });

  test('🔴 un `no-se-pudo` SÍ se vuelve a pedir — pero cada vez menos', () => {
    const freno = crearFrenoDeMedia();
    let ahora = 0;

    freno.anotar('/foto/9', 'no-se-pudo', ahora);
    expect(freno.consultar('/foto/9', ahora)).toBe('esperando');
    expect(freno.consultar('/foto/9', ahora + ESPERA_BASE_MS - 1)).toBe('esperando');
    expect(freno.consultar('/foto/9', ahora + ESPERA_BASE_MS)).toBe('pedir');

    // Segundo fallo: la espera se duplica.
    ahora += ESPERA_BASE_MS;
    freno.anotar('/foto/9', 'no-se-pudo', ahora);
    expect(freno.consultar('/foto/9', ahora + ESPERA_BASE_MS)).toBe('esperando');
    expect(freno.consultar('/foto/9', ahora + ESPERA_BASE_MS * 2)).toBe('pedir');

    // Tercero: otra vez el doble.
    ahora += ESPERA_BASE_MS * 2;
    freno.anotar('/foto/9', 'no-se-pudo', ahora);
    expect(freno.consultar('/foto/9', ahora + ESPERA_BASE_MS * 2)).toBe('esperando');
    expect(freno.consultar('/foto/9', ahora + ESPERA_BASE_MS * 4)).toBe('pedir');
  });

  test('🔴 frenar NUNCA es dejar de pedir: pasado el techo se sigue pidiendo', () => {
    const freno = crearFrenoDeMedia();
    let ahora = 0;
    for (let n = 0; n < 40; n++) {
      freno.anotar('/foto/9', 'no-se-pudo', ahora);
      ahora += ESPERA_TOPE_MS;
      expect(freno.consultar('/foto/9', ahora)).toBe('pedir');
    }
  });

  test('el freno es POR URL: un contacto frenado no frena a los demás', () => {
    const freno = crearFrenoDeMedia();
    freno.anotar('/foto/9', 'no-se-pudo', 0);
    expect(freno.consultar('/foto/9', 0)).toBe('esperando');
    expect(freno.consultar('/foto/8', 0)).toBe('pedir');
  });

  test('🔴 un solo `ok` suelta TODOS los frenos: la línea volvió', () => {
    const freno = crearFrenoDeMedia();
    freno.anotar('/foto/9', 'no-se-pudo', 0);
    freno.anotar('/foto/8', 'no-se-pudo', 0);
    expect(freno.consultar('/foto/9', 0)).toBe('esperando');

    freno.anotar('/foto/7', 'ok', 0);

    expect(freno.consultar('/foto/9', 0)).toBe('pedir');
    expect(freno.consultar('/foto/8', 0)).toBe('pedir');
  });

  test('…y arranca de cero: el próximo fallo espera la base, no lo acumulado', () => {
    const freno = crearFrenoDeMedia();
    for (let n = 0; n < 5; n++) freno.anotar('/foto/9', 'no-se-pudo', 0);
    freno.anotar('/foto/7', 'ok', 0);
    freno.anotar('/foto/9', 'no-se-pudo', 0);
    expect(freno.esperaDe('/foto/9', 0)).toBe(ESPERA_BASE_MS);
  });

  test('⚠️ un `ok` NO resucita un `no-hay`: que otra foto cargue no le da una a quien no tiene', () => {
    const freno = crearFrenoDeMedia();
    freno.anotar('/foto/9', 'no-hay', 0);
    freno.anotar('/foto/7', 'ok', 0);
    expect(freno.consultar('/foto/9', 0)).toBe('no-hay');
  });

  test('⚠️ el 401 no frena ni recuerda: lo arregla el auth, no el tiempo', () => {
    const freno = crearFrenoDeMedia();
    freno.anotar('/foto/9', 'sin-sesion', 0);
    expect(freno.consultar('/foto/9', 0)).toBe('pedir');
    expect(freno.esperaDe('/foto/9', 0)).toBe(0);
  });

  test('⚠️ y tampoco borra un freno anterior: un 401 no dice nada de la línea', () => {
    const freno = crearFrenoDeMedia();
    freno.anotar('/foto/9', 'no-se-pudo', 0);
    freno.anotar('/foto/9', 'sin-sesion', 0);
    expect(freno.consultar('/foto/9', 0)).toBe('esperando');
  });

  test('un `no-hay` después de fallar cierra la pregunta: la espera deja de correr', () => {
    const freno = crearFrenoDeMedia();
    freno.anotar('/foto/9', 'no-se-pudo', 0);
    freno.anotar('/foto/9', 'no-hay', 0);
    expect(freno.consultar('/foto/9', 0)).toBe('no-hay');
    expect(freno.esperaDe('/foto/9', 0)).toBe(0);
  });

  test('🔴 `olvidar` le devuelve el turno a la URL: es el clic humano ganándole al freno', () => {
    const freno = crearFrenoDeMedia();
    freno.anotar('/media/pesado.mp4', 'no-se-pudo', 0);
    expect(freno.consultar('/media/pesado.mp4', 0)).toBe('esperando');
    freno.olvidar('/media/pesado.mp4');
    expect(freno.consultar('/media/pesado.mp4', 0)).toBe('pedir');
  });

  test('`olvidar` también borra un `no-hay`: reintentar a mano vale para los dos', () => {
    const freno = crearFrenoDeMedia();
    freno.anotar('/media/pesado.mp4', 'no-hay', 0);
    freno.olvidar('/media/pesado.mp4');
    expect(freno.consultar('/media/pesado.mp4', 0)).toBe('pedir');
  });

  test('limpiar() borra todo — el cierre de sesión no le hereda frenos a la próxima', () => {
    const freno = crearFrenoDeMedia();
    freno.anotar('/foto/9', 'no-se-pudo', 0);
    freno.anotar('/foto/8', 'no-hay', 0);
    freno.limpiar();
    expect(freno.consultar('/foto/9', 0)).toBe('pedir');
    expect(freno.consultar('/foto/8', 0)).toBe('pedir');
  });

  /**
   * LA CUENTA QUE DECIDE SI ESTO ALCANZA. Lo medido: 1.891 respuestas 503 al día
   * repartidas en 192 números. La meta del plan es bajar a menos de 5 intentos
   * por número y día. Este test simula el peor caso posible —una vendedora que
   * abre el mismo contacto sin parar, cada 10 s, durante 8 horas de jornada— y
   * cuenta cuántos pedidos deja pasar el freno.
   */
  test('🔴 en una jornada de 8 h golpeando cada 10 s, el freno deja pasar menos de 15', () => {
    const freno = crearFrenoDeMedia();
    const JORNADA_MS = 8 * 60 * 60_000;
    let pedidos = 0;
    for (let ahora = 0; ahora <= JORNADA_MS; ahora += 10_000) {
      if (freno.consultar('/foto/9', ahora) !== 'pedir') continue;
      pedidos += 1;
      freno.anotar('/foto/9', 'no-se-pudo', ahora);
    }
    // 8 escalones hasta el techo + una vez por hora el resto de la jornada.
    expect(pedidos).toBeLessThan(15);
    // Y sigue pidiendo: si diera 8 sería «dejó de reintentar», no «reintenta menos».
    expect(pedidos).toBeGreaterThan(8);
  });
});
