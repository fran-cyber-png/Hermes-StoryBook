import { describe, expect, it } from 'vitest';
import {
  atiendeDesde,
  ayudaDeLinea,
  filasDelEquipo,
  inicioDeHoyLocal,
  notaSinAtribuir,
  puenteDe,
  rotuloDeActualizacion,
  rotuloDeLinea,
  sinDuena24h,
  textoPrimeraRespuesta,
  type DatosHoy,
  type PersonaDeHoy,
} from './hoy';

/**
 * «HOY» — LAS DERIVACIONES PURAS DE LA PESTAÑA (ADR 0104).
 *
 * Lo que se fija acá es lo que la pantalla PROMETE sin que nadie lea: a qué recorte
 * del Pipeline lleva cada cifra, cómo se llama cada línea y a quién le toca cada
 * número. El cableado (que el clic dispare esto) vive en `PanelHoy.test.tsx`.
 */

const LUZ = '51970356062';
const VENTAS_META = '51984429504';
const LIBROS_MX = '5215610584485';
const NICOLE = '593992073457';

const persona = (p: Partial<PersonaDeHoy> & { vendedora: string }): PersonaDeHoy => ({
  nombre: null,
  lineas: [],
  asignadas: 0,
  contestadas: 0,
  primeraRespuesta: null,
  ventas: 0,
  ...p,
});

const datos = (d: Partial<DatosHoy>): DatosHoy => ({
  inicioDeHoy: '2026-09-10T05:00:00.000Z',
  generadoEn: '2026-09-10T20:00:00.000Z',
  supervisor: true,
  modulo: 'ventas',
  lineas: [
    { numero: LUZ, etiqueta: 'luz', clase: 'propia', personas: ['luz'] },
    { numero: VENTAS_META, etiqueta: 'Ventas Meta', clase: 'equipo', personas: ['luz', 'nicole', 'darian'] },
    { numero: LIBROS_MX, etiqueta: 'Libros Mx', clase: 'compartida', personas: ['darian', 'nicole'] },
    { numero: NICOLE, etiqueta: 'Nicole', clase: 'propia', personas: ['nicole'] },
  ],
  escribieron: { total: 0, porLinea: [] },
  sinRespuesta: { total: 0, porDuena: [], porLinea: [] },
  calientesSinDuena: { total: 0, porLinea: [] },
  personas: [],
  sinAtribuir: [],
  ...d,
});

describe('inicioDeHoyLocal — el «hoy» lo resuelve el navegador (#421)', () => {
  it('es la medianoche LOCAL de quien mira, no la de UTC', () => {
    const tarde = new Date(2026, 8, 10, 15, 30);
    expect(inicioDeHoyLocal(tarde)).toBe(new Date(2026, 8, 10, 0, 0, 0, 0).toISOString());
  });

  it('a las 00:00:00.000 ya es el día nuevo, y un milisegundo antes todavía es el anterior', () => {
    expect(inicioDeHoyLocal(new Date(2026, 8, 10, 0, 0, 0, 0))).toBe(new Date(2026, 8, 10).toISOString());
    expect(inicioDeHoyLocal(new Date(2026, 8, 9, 23, 59, 59, 999))).toBe(new Date(2026, 8, 9).toISOString());
  });
});

describe('puenteDe — cada cifra abre el Pipeline con SU recorte', () => {
  it('«escribieron por primera vez hoy»: el total sin línea, y por línea con la línea', () => {
    expect(puenteDe({ tipo: 'escribieron' })).toStrictEqual({ tipo: 'pipeline', recorte: { escribioHoy: true } });
    expect(puenteDe({ tipo: 'escribieron', linea: LIBROS_MX })).toStrictEqual({
      tipo: 'pipeline',
      recorte: { escribioHoy: true },
      linea: LIBROS_MX,
    });
  });

  it('«> 24 h»: por línea lleva la línea; por dueña lleva a quién, y la sin dueña viaja como null', () => {
    expect(puenteDe({ tipo: 'sinRespuesta' })).toStrictEqual({ tipo: 'pipeline', recorte: { sinRespuesta24h: true } });
    expect(puenteDe({ tipo: 'sinRespuesta', linea: LUZ })).toStrictEqual({
      tipo: 'pipeline',
      recorte: { sinRespuesta24h: true },
      linea: LUZ,
    });
    expect(puenteDe({ tipo: 'sinRespuestaDe', duena: 'luz' })).toStrictEqual({
      tipo: 'pipeline',
      recorte: { sinRespuesta24h: true },
      asignadaA: 'luz',
    });
    expect(puenteDe({ tipo: 'sinRespuestaDe', duena: null })).toStrictEqual({
      tipo: 'pipeline',
      recorte: { sinRespuesta24h: true },
      asignadaA: null,
    });
  });

  it('«calientes sin dueña»: verdes y sin asignar, con la línea cuando se abre desde una', () => {
    expect(puenteDe({ tipo: 'calientes' })).toStrictEqual({ tipo: 'pipeline', recorte: { luz: 'verde' }, asignadaA: null });
    expect(puenteDe({ tipo: 'calientes', linea: VENTAS_META })).toStrictEqual({
      tipo: 'pipeline',
      recorte: { luz: 'verde' },
      asignadaA: null,
      linea: VENTAS_META,
    });
  });

  it('«asignadas» de una persona abre su lista, sin recorte', () => {
    expect(puenteDe({ tipo: 'asignadas', vendedora: 'nicole' })).toStrictEqual({ tipo: 'pipeline', asignadaA: 'nicole' });
  });

  it('🔴 un DM sin línea abre el Pipeline por su CANAL: sin `linea` ni `canal` abriría TODAS las líneas', () => {
    expect(puenteDe({ tipo: 'escribieron', linea: null, canal: 'facebook' })).toStrictEqual({
      tipo: 'pipeline',
      recorte: { escribioHoy: true },
      canal: 'facebook',
    });
    expect(puenteDe({ tipo: 'sinRespuesta', linea: null, canal: 'instagram' })).toStrictEqual({
      tipo: 'pipeline',
      recorte: { sinRespuesta24h: true },
      canal: 'instagram',
    });
    expect(puenteDe({ tipo: 'calientes', linea: null, canal: 'facebook' })).toStrictEqual({
      tipo: 'pipeline',
      recorte: { luz: 'verde' },
      asignadaA: null,
      canal: 'facebook',
    });
  });

  it('una cifra sin línea y sin canal —o con un canal que el Pipeline no recorta— NO abre nada', () => {
    expect(puenteDe({ tipo: 'escribieron', linea: null })).toBeNull();
    expect(puenteDe({ tipo: 'sinRespuesta', linea: null, canal: 'whatsapp' })).toBeNull();
    expect(puenteDe({ tipo: 'calientes', linea: null })).toBeNull();
  });
});

describe('rotuloDeLinea — cómo se llama cada línea', () => {
  it('usa la etiqueta del catálogo', () => {
    expect(rotuloDeLinea(LIBROS_MX, datos({}).lineas)).toBe('Libros Mx');
  });

  it('sin etiqueta (o en blanco) dice el número, nunca un hueco', () => {
    expect(rotuloDeLinea('51999999999', datos({}).lineas)).toBe('51999999999');
    expect(rotuloDeLinea('51888888888', [{ numero: '51888888888', etiqueta: '  ', clase: 'propia', personas: [] }])).toBe(
      '51888888888',
    );
  });

  it('una conversación sin línea es un DM de Messenger o Instagram', () => {
    expect(rotuloDeLinea(null, datos({}).lineas)).toBe('Sin línea (Messenger/IG)');
  });

  it('con su canal, el DM sin línea se nombra por el canal', () => {
    expect(rotuloDeLinea(null, datos({}).lineas, 'facebook')).toBe('Messenger (sin línea)');
    expect(rotuloDeLinea(null, datos({}).lineas, 'instagram')).toBe('Instagram (sin línea)');
  });

  it('🔴 comentarios y leads sin línea tienen su chip, dicen por qué no se abren, y no se abren', () => {
    // El Pipeline abre «Messenger (sin línea)» sólo con chats: si un comentario verde
    // cayera ahí, la cifra diría más de lo que la lista muestra.
    expect(rotuloDeLinea(null, datos({}).lineas, 'comentarios_y_leads')).toBe('Comentarios y leads (sin línea)');
    expect(ayudaDeLinea(null, datos({}), 'comentarios_y_leads')).toBe(
      'Comentarios y leads (sin línea): comentarios de Facebook o Instagram y leads de formulario, que no son un chat; el Pipeline no los recorta así, y esta cifra no se abre.',
    );
    expect(puenteDe({ tipo: 'calientes', linea: null, canal: 'comentarios_y_leads' })).toBeNull();
  });
});

describe('filasDelEquipo — una fila por persona, con su deuda de más de un día', () => {
  it('ordena por el nombre que se lee, y el > 24 h de cada una sale de porDuena comparando normalizado (candado 4)', () => {
    const d = datos({
      personas: [
        persona({ vendedora: 'nicole', nombre: 'Nicole' }),
        persona({ vendedora: 'luz', nombre: null }),
        persona({ vendedora: 'darian', nombre: 'Darian' }),
      ],
      sinRespuesta: {
        total: 80,
        porDuena: [
          { duena: 'Luz ', n: 74 },
          { duena: 'nicole', n: 3 },
          { duena: null, n: 3 },
        ],
        porLinea: [],
      },
    });
    const filas = filasDelEquipo(d);
    expect(filas.map((f) => f.nombre)).toEqual(['Darian', 'luz', 'Nicole']);
    expect(filas.map((f) => f.sinRespuesta24h)).toEqual([0, 74, 3]);
    expect(filas.every((f) => !f.soloDeuda)).toBe(true);
  });

  it('una dueña con deuda que no está en el equipo de hoy igual aparece, al final y marcada: la deuda no se esconde', () => {
    const d = datos({
      personas: [persona({ vendedora: 'luz', nombre: 'Luz' })],
      sinRespuesta: {
        total: 127,
        porDuena: [
          { duena: 'luz', n: 74 },
          { duena: 'aperez', n: 53 },
        ],
        porLinea: [],
      },
    });
    const filas = filasDelEquipo(d);
    expect(filas.map((f) => [f.persona.vendedora, f.sinRespuesta24h, f.soloDeuda])).toEqual([
      ['luz', 74, false],
      ['aperez', 53, true],
    ]);
  });

  it('la deuda sin dueña no es una fila de persona: se cuenta aparte', () => {
    const d = datos({
      personas: [persona({ vendedora: 'luz' })],
      sinRespuesta: { total: 655, porDuena: [{ duena: null, n: 652 }, { duena: 'luz', n: 3 }], porLinea: [] },
    });
    expect(filasDelEquipo(d).map((f) => f.persona.vendedora)).toEqual(['luz']);
    expect(sinDuena24h(d)).toBe(652);
  });
});

describe('atiendeDesde — la línea dicha en palabras', () => {
  it('la propia es «su línea», la compartida nombra con quién, y la de equipo dice que se atiende desde Hermes', () => {
    const d = datos({
      personas: [persona({ vendedora: 'nicole', nombre: 'Nicole' }), persona({ vendedora: 'darian', nombre: 'Darian' })],
    });
    const nicole = persona({ vendedora: 'nicole', nombre: 'Nicole', lineas: [NICOLE, LIBROS_MX, VENTAS_META] });
    expect(atiendeDesde(nicole, d)).toEqual([
      { numero: NICOLE, etiqueta: 'Nicole', texto: 'su línea' },
      { numero: LIBROS_MX, etiqueta: 'Libros Mx', texto: 'compartida con Darian' },
      { numero: VENTAS_META, etiqueta: 'Ventas Meta', texto: 'de equipo, desde Hermes' },
    ]);
  });
});

describe('textoPrimeraRespuesta — una mediana nunca va sin su denominador', () => {
  it('con respuestas: la mediana y «sobre de de»', () => {
    expect(textoPrimeraRespuesta({ medianaMin: 12, sobre: 30, de: 41 })).toEqual({ valor: '12 min', detalle: '30 de 41' });
  });

  it('nadie contestó todavía a las que llegaron: lo dice, con el denominador', () => {
    expect(textoPrimeraRespuesta({ medianaMin: null, sobre: 0, de: 5 })).toEqual({ valor: 'sin respuesta', detalle: '0 de 5' });
  });

  it('sin nadie que haya escrito por primera vez en lo suyo: un guion, sin detalle', () => {
    expect(textoPrimeraRespuesta(null)).toEqual({ valor: '—', detalle: null });
  });
});

describe('notaSinAtribuir — lo que se contestó desde el teléfono en una línea compartida', () => {
  it('nombra la línea, cuánto y con quiénes, y dice por qué no se reparte', () => {
    const d = datos({
      personas: [persona({ vendedora: 'darian', nombre: 'Darian' }), persona({ vendedora: 'nicole', nombre: 'Nicole' })],
    });
    expect(notaSinAtribuir({ linea: LIBROS_MX, contestadas: 70 }, d)).toBe(
      'Libros Mx: 70 contestadas desde el teléfono. La línea la comparten Darian y Nicole, y esa parte no se puede repartir por persona.',
    );
  });

  it('🔴 un DM de Messenger/IG sin línea no se contestó «desde el teléfono»: se dice que fue fuera de Hermes', () => {
    expect(notaSinAtribuir({ linea: null, contestadas: 9 }, datos({}))).toBe(
      'Sin línea (Messenger/IG): 9 contestadas fuera de Hermes, desde Messenger o Instagram. No queda registro de quién las contestó.',
    );
  });

  it('en singular cuando es una', () => {
    const d = datos({ personas: [] });
    expect(notaSinAtribuir({ linea: LIBROS_MX, contestadas: 1 }, d)).toBe(
      'Libros Mx: 1 contestada desde el teléfono. La línea la comparten darian y nicole, y esa parte no se puede repartir por persona.',
    );
  });
});

describe('ayudaDeLinea — qué es cada línea, dicho al pasar el mouse por su cifra', () => {
  const d = datos({
    lineas: [
      { numero: '51986394450', etiqueta: 'Ventas Perú', clase: 'sin_asignar', personas: [] },
      { numero: LUZ, etiqueta: 'luz', clase: 'propia', personas: ['luz'] },
      { numero: LIBROS_MX, etiqueta: 'Libros Mx', clase: 'compartida', personas: ['darian', 'nicole'] },
      { numero: VENTAS_META, etiqueta: 'Ventas Meta', clase: 'equipo', personas: ['luz', 'nicole'] },
    ],
    personas: [persona({ vendedora: 'nicole', nombre: 'Nicole' }), persona({ vendedora: 'luz', nombre: 'Luz' })],
  });

  it('🔴 una línea sin nadie en el mapa lo dice: sus cifras no son de ninguna persona', () => {
    expect(ayudaDeLinea('51986394450', d)).toBe(
      'Ventas Perú: nadie tiene esta línea en el mapa, así que sus cifras no son de ninguna persona.',
    );
  });

  it('la propia dice de quién es, la compartida entre quiénes, y la de equipo que se atiende desde Hermes', () => {
    expect(ayudaDeLinea(LUZ, d)).toBe('luz: la línea de Luz.');
    expect(ayudaDeLinea(LIBROS_MX, d)).toBe('Libros Mx: la comparten darian y Nicole.');
    expect(ayudaDeLinea(VENTAS_META, d)).toBe('Ventas Meta: línea de equipo, con rueda; se atiende desde Hermes.');
  });

  it('un DM sin línea dice de dónde vino; sin canal, explica por qué no se abre', () => {
    expect(ayudaDeLinea(null, d, 'facebook')).toBe(
      'Messenger (sin línea): mensajes directos a la Página de Facebook, que no entran por ninguna línea de WhatsApp.',
    );
    expect(ayudaDeLinea(null, d, 'instagram')).toBe(
      'Instagram (sin línea): mensajes directos a la cuenta de Instagram, que no entran por ninguna línea de WhatsApp.',
    );
    expect(ayudaDeLinea(null, d)).toBe('Sin línea (Messenger/IG): no se sabe por qué canal entró, así que esta cifra no se abre.');
  });

  it('una línea que no está en el catálogo no inventa nada', () => {
    expect(ayudaDeLinea('51999999999', d)).toBeNull();
  });

  it('en «atiende desde», una línea sin asignar tampoco inventa dueña', () => {
    const quien = persona({ vendedora: 'luz', lineas: ['51986394450'] });
    expect(atiendeDesde(quien, d)).toEqual([
      { numero: '51986394450', etiqueta: 'Ventas Perú', texto: 'nadie tiene esta línea en el mapa' },
    ]);
  });
});

describe('atiendeDesde — una línea con mucha gente no se enumera en la fila', () => {
  const BETTO = '51963139984';
  const TRIO = '51900000003';
  const d = datos({
    lineas: [
      { numero: BETTO, etiqueta: 'Betto', clase: 'compartida', personas: ['centurion:angie', 'centurion:job', 'centurion:usuario4', 'centurion:usuario9'] },
      { numero: TRIO, etiqueta: 'Trío', clase: 'compartida', personas: ['centurion:angie', 'centurion:job', 'centurion:usuario9'] },
    ],
  });

  it('🔴 con más de dos personas más dice CUÁNTAS: la línea de Betto tiene 19 y enumerarlas empujaba las cifras fuera de la tabla', () => {
    const quien = persona({ vendedora: 'centurion:usuario9', lineas: [BETTO] });
    expect(atiendeDesde(quien, d)).toEqual([{ numero: BETTO, etiqueta: 'Betto', texto: 'compartida con 3 personas' }]);
  });

  it('con dos o menos, las nombra', () => {
    const quien = persona({ vendedora: 'centurion:usuario9', lineas: [TRIO] });
    expect(atiendeDesde(quien, d)).toEqual([{ numero: TRIO, etiqueta: 'Trío', texto: 'compartida con angie y job' }]);
  });
});

describe('rotuloDeActualizacion — cuándo se trajeron las cifras que se están viendo', () => {
  const T = Date.UTC(2026, 8, 10, 15, 0, 0);

  it('sin datos todavía no dice nada', () => {
    expect(rotuloDeActualizacion(0, T)).toBeNull();
  });

  it('en el primer minuto: hace un momento', () => {
    expect(rotuloDeActualizacion(T - 59_000, T)).toBe('actualizado hace un momento');
  });

  it('en minutos, redondeando hacia abajo', () => {
    expect(rotuloDeActualizacion(T - 7 * 60_000 - 55_000, T)).toBe('actualizado hace 7 min');
  });

  it('pasada la hora, en horas', () => {
    expect(rotuloDeActualizacion(T - 125 * 60_000, T)).toBe('actualizado hace 2 h');
  });

  it('un reloj adelantado no da un tiempo negativo', () => {
    expect(rotuloDeActualizacion(T + 30_000, T)).toBe('actualizado hace un momento');
  });
});
