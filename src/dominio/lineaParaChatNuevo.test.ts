import { describe, expect, it } from 'vitest';
import { lineaDelChatNuevo, lineasParaChatNuevo } from './lineaParaAbrir';
import type { LineaWhatsapp } from './lineas';

/**
 * EL CHAT NUEVO DE MENSAJES — por qué línea sale.
 *
 * El panel hacía `sesion.telefono` y abría con esa, sin preguntar. Lo que se fija
 * acá es lo que reemplaza a esa línea: que se ofrezcan las vivas, que no se
 * ofrezca un hilo que no existe, y sobre todo que **nunca deje de abrir un chat**.
 */

const linea = (numero: string, etiqueta = ''): LineaWhatsapp =>
  ({ numero, etiqueta, estado: 'conectado' }) as LineaWhatsapp;

const META = linea('51984429504', 'Ventas Meta');
const BETTO = linea('51963139984', 'Betto');

describe('lineasParaChatNuevo', () => {
  it('ofrece las líneas vivas, con su etiqueta', () => {
    expect(lineasParaChatNuevo([META, BETTO]).map((o) => o.etiqueta)).toEqual([
      'Ventas Meta',
      'Betto',
    ]);
  });

  it('🔴 NUNCA ofrece «el chat que ya existe»: un número recién tipeado no tiene hilo', () => {
    // Ofrecerlo sería prometer un historial inexistente, y elegirlo abriría una
    // conversación con `numero_propio` vacío. Es la diferencia con
    // `opcionesParaAbrir`, que sí lo ofrece porque allá la tarjeta ya tiene hilo.
    expect(lineasParaChatNuevo([META, BETTO]).every((o) => !o.actual)).toBe(true);
  });

  it('sin etiqueta cae al número, nunca a una cadena vacía', () => {
    expect(lineasParaChatNuevo([linea('51999999999', '   ')])[0].etiqueta).toBe('51999999999');
  });
});

describe('lineaDelChatNuevo', () => {
  it('manda lo que la vendedora eligió', () => {
    expect(lineaDelChatNuevo([META, BETTO], BETTO.numero, META.numero)).toBe(BETTO.numero);
  });

  it('sin elegir, manda la primera viva — no la de la sesión', () => {
    // Es lo que el selector muestra encendido: los dos tienen que coincidir, o el
    // chip dice una línea y el mensaje sale por otra.
    expect(lineaDelChatNuevo([META, BETTO], null, BETTO.numero)).toBe(META.numero);
  });

  it('🔴 una elegida que YA NO está viva se ignora', () => {
    // El panel queda abierto mientras se tipea el número, y en ese rato una línea
    // se puede caer. Mandar por una que el gestor ya no tiene es un envío que
    // rebota; se cae a la primera viva, que es la que el selector va a mostrar.
    expect(lineaDelChatNuevo([META], BETTO.numero, null)).toBe(META.numero);
  });

  it('🔴 FAIL-OPEN: sin ninguna línea viva, usa la de la sesión', () => {
    // Server viejo, la consulta falló, WhatsApp caído. Es exactamente lo que el
    // panel hacía antes de este cambio: un selector que no se pudo armar no puede
    // dejar a la vendedora sin abrir el chat.
    expect(lineaDelChatNuevo([], null, '51984429504')).toBe('51984429504');
  });

  it('y sin nada de nada devuelve null, sin tirar', () => {
    expect(lineaDelChatNuevo([], null, null)).toBe(null);
  });
});

describe('cómo se lee cada línea en el menú', () => {
  it('usa la etiqueta registrada de la línea, como el menú del Pipeline', () => {
    expect(lineasParaChatNuevo([META, BETTO]).map((o) => o.etiqueta)).toEqual([
      'Ventas Meta',
      'Betto',
    ]);
  });

  it('🔴 sin etiqueta cae al número: feo, pero NUNCA una cadena vacía', () => {
    // Un item en blanco es una opción que no se puede leer ni elegir con
    // confianza. Es la misma caída que `opcionesParaAbrir` hace en el Pipeline.
    expect(lineasParaChatNuevo([linea('51963139984', '   ')])[0].etiqueta).toBe('51963139984');
  });
});
