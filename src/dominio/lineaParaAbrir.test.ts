import { describe, expect, it } from 'vitest';
import type { Conversacion } from './conversaciones';
import type { LineaWhatsapp } from './lineas';
import {
  conversacionEnLinea,
  ETIQUETA_HILO_ACTUAL,
  opcionesParaAbrir,
  queHacerAlAbrir,
} from './lineaParaAbrir';

/**
 * POR QUÉ LÍNEA SE ABRE EL CHAT — la decisión, sin DOM.
 *
 * Lo que se fija acá: que con una sola forma de abrir no se pregunte nada, que
 * seguir el hilo que ya existe devuelva la conversación TAL CUAL (no una
 * rearmada, que perdería etapa y curso), que abrir por otra línea produzca la
 * clave que el SQL de la cola arma para ese par, y que nada de esto pueda
 * ofrecer una línea que el server no ofreció — que es la frontera de campaña
 * (ADR 0061).
 */

const LINEA = (numero: string, etiqueta: string): LineaWhatsapp => ({
  numero,
  etiqueta,
  estado: 'conectado',
});

const META = LINEA('51984429504', 'Ventas Meta');
const BETTO = LINEA('51963139984', 'Betto');

const CHAT: Conversacion = {
  clave: 'conv:whatsapp:51987654321:51984429504',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51987654321',
  persona_nombre: 'Javier Peralta',
  numero_propio: '51984429504',
  texto: 'me interesa el diplomado',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: false,
  pregunto: false,
  n: 3,
  referencia: '2026-08-18T12:00:00.000Z',
  ultimo_at: '2026-08-18T12:00:00.000Z',
  dias: 0,
  nivel: 3,
};

/** Un lead de formulario: llenó y NADIE le escribió — no tiene hilo ni línea. */
const LEAD: Conversacion = {
  ...CHAT,
  clave: 'lead:8821',
  canal: 'landing',
  tipo: 'lead',
  numero_propio: null,
  texto: 'Diploma en Inteligencia',
};

const COMENTARIO: Conversacion = {
  ...CHAT,
  clave: 'int:4410',
  canal: 'instagram',
  tipo: 'comentario',
  // En Meta el `persona_id` es un id, no un teléfono: es una cadena de dígitos
  // que NO se puede marcar.
  persona_id: '17841400000000000',
  numero_propio: null,
};

describe('con una sola forma de abrir no se pregunta nada', () => {
  it('la conversación de siempre, con su línea viva y única, abre derecho y SIN rearmarse', () => {
    // Rearmarla le sacaría etapa, curso, preview y señales que la cola ya
    // calculó: el chat se vería recién nacido teniendo tres mensajes.
    const plan = queHacerAlAbrir(CHAT, [META]);

    expect(plan.tipo).toBe('abrir');
    if (plan.tipo !== 'abrir') return;
    expect(plan.destino).toBe(CHAT);
  });

  it('un lead de formulario con una sola línea abre YA por esa línea', () => {
    // Es el arreglo del frente: hasta acá el botón lo mandaba a un hilo de solo
    // lectura, sin caja donde escribir, porque la tarjeta no tiene línea.
    const plan = queHacerAlAbrir(LEAD, [META]);

    expect(plan.tipo).toBe('abrir');
    if (plan.tipo !== 'abrir') return;
    expect(plan.destino.clave).toBe('conv:whatsapp:51987654321:51984429504');
    expect(plan.destino.canal).toBe('whatsapp');
    expect(plan.destino.persona_nombre).toBe('Javier Peralta');
  });

  it('un comentario de Meta no ofrece ninguna línea y abre lo que la tarjeta ya es', () => {
    // Su `persona_id` es un id, no un número: armarle una conversación con eso
    // abriría el chat de OTRA persona (`dominio/canal.ts`).
    expect(opcionesParaAbrir(COMENTARIO, [META, BETTO])).toEqual([]);

    const plan = queHacerAlAbrir(COMENTARIO, [META, BETTO]);
    expect(plan.tipo).toBe('abrir');
    if (plan.tipo !== 'abrir') return;
    expect(plan.destino).toBe(COMENTARIO);
  });

  it('un chat identificado con LID tampoco: no hay número al que mandar', () => {
    const conLid = { ...CHAT, persona_id: 'lid-2299887766' };

    expect(opcionesParaAbrir(conLid, [META, BETTO])).toEqual([]);
  });

  it('🔴 sin líneas —WhatsApp caído, server viejo— se abre igual: fail-open', () => {
    // Un selector que no se pudo armar nunca puede dejar a la vendedora sin
    // abrir el chat. Es lo que el botón hacía antes de que este menú existiera.
    const plan = queHacerAlAbrir(CHAT, []);

    expect(plan.tipo).toBe('abrir');
    if (plan.tipo !== 'abrir') return;
    expect(plan.destino).toBe(CHAT);
  });
});

describe('con varias líneas se pregunta', () => {
  it('la del hilo va marcada, y elegirla devuelve la conversación tal cual', () => {
    const plan = queHacerAlAbrir(CHAT, [META, BETTO]);

    expect(plan.tipo).toBe('elegir');
    if (plan.tipo !== 'elegir') return;
    expect(plan.opciones.map((o) => [o.etiqueta, o.actual])).toEqual([
      ['Ventas Meta', true],
      ['Betto', false],
    ]);
  });

  it('elegir OTRA línea abre un chat distinto con la misma persona', () => {
    // La clave es `conv:whatsapp:<tel>:<numeroPropio>` — literalmente la que arma
    // el SQL de la cola. Por eso el hilo nuevo aparece ahí cuando alguien escriba.
    const plan = queHacerAlAbrir(CHAT, [META, BETTO]);
    if (plan.tipo !== 'elegir') throw new Error('tenía que preguntar');
    const otra = plan.opciones.find((o) => !o.actual)!;

    const destino = conversacionEnLinea(CHAT, otra);

    expect(destino.clave).toBe('conv:whatsapp:51987654321:51963139984');
    expect(destino.numero_propio).toBe('51963139984');
    // Vacío, y eso ES la verdad: bajo esa clave todavía no hay nada guardado.
    expect(destino.n).toBe(0);
    expect(destino.texto).toBeNull();
    // Lo que sí se conserva es quién es: el nombre no depende del hilo.
    expect(destino.persona_nombre).toBe('Javier Peralta');
  });

  it('y elegir la del hilo devuelve la MISMA conversación, no una copia', () => {
    const plan = queHacerAlAbrir(CHAT, [META, BETTO]);
    if (plan.tipo !== 'elegir') throw new Error('tenía que preguntar');

    expect(conversacionEnLinea(CHAT, plan.opciones.find((o) => o.actual)!)).toBe(CHAT);
  });

  it('un lead de formulario no ofrece «el chat que ya existe»: no existe ninguno', () => {
    const opciones = opcionesParaAbrir(LEAD, [META, BETTO]);

    expect(opciones.map((o) => o.etiqueta)).toEqual(['Ventas Meta', 'Betto']);
    expect(opciones.some((o) => o.actual)).toBe(false);
  });

  it('🔴 si la línea del hilo ya no está corriendo, seguir el chat sigue siendo posible', () => {
    // El caso de las tres líneas retiradas el 11-ago: sus conversaciones siguen
    // en la mesa. Sin esta entrada, el único destino sería una línea nueva y el
    // botón dejaría de hacer lo que hacía ayer.
    const retirada = { ...CHAT, numero_propio: '51986394450', clave: 'conv:whatsapp:51987654321:51986394450' };

    const opciones = opcionesParaAbrir(retirada, [META]);

    expect(opciones).toHaveLength(2);
    expect(opciones[0]).toEqual({
      numero: '51986394450',
      etiqueta: ETIQUETA_HILO_ACTUAL,
      actual: true,
      viva: false,
    });
    // 🔴 Y no se nombra el número: la etiqueta es la constante, no la línea. Una
    // línea que el server no ofreció puede ser una de campaña (ADR 0061), y el
    // selector no la puede delatar ni con su número.
    expect(opciones[0].etiqueta).not.toContain('51986394450');
  });

  it('una clave sin línea (`…:`) también conserva el chat que ya existe', () => {
    // `COALESCE(payload->>'numeroPropio','')` en el SQL de la cola: una clave
    // terminada en `:` es real, no rota.
    const sinLinea = { ...CHAT, numero_propio: '', clave: 'conv:whatsapp:51987654321:' };

    const opciones = opcionesParaAbrir(sinLinea, [META]);

    expect(opciones).toHaveLength(2);
    expect(opciones[0].actual).toBe(true);
  });

  it('la etiqueta cae al número cuando la línea no tiene nombre registrado', () => {
    // El server ya hace ese fallback; acá se repite porque perder el rótulo no
    // puede esconder la línea. Un menú con un renglón en blanco no es elegible.
    const opciones = opcionesParaAbrir(LEAD, [LINEA('51999888777', '   '), META]);

    expect(opciones[0].etiqueta).toBe('51999888777');
  });

  it('🔴 no se agrega ninguna línea que el server no haya ofrecido', () => {
    // La lista de `GET /api/whatsapp/lineas` ya viene recortada por la frontera
    // de campaña, que NO es fail-open. Completarla acá sería reabrirla desde el
    // navegador.
    const opciones = opcionesParaAbrir(LEAD, [META]);

    expect(opciones.map((o) => o.numero)).toEqual(['51984429504']);
  });
});
