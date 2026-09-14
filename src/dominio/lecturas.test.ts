import { describe, expect, test } from 'vitest';
import {
  autorDe,
  lecturaDe,
  opcionesDeCorreccion,
  pideVeredicto,
  valorRevocado,
  verboDe,
  type Afirmacion,
} from './lecturas';

/**
 * LAS LECTURAS DEL SISTEMA COMO RENGLONES — la política, sin DOM.
 *
 * Lo que se fija acá es qué dice cada fila y cuál pide una decisión. El cableado
 * —que el timeline las dibuje y que los botones escriban contra la regla— se
 * prueba montando, en `EventoLinea.test.tsx`: es la lección de ADR 0024, y el
 * defecto casi nunca es la regla mal escrita sino que nadie la llama.
 */

const LEIDA: Afirmacion = {
  id: 'af:1',
  dimension: 'postura',
  valor: 'pide agua',
  detalle: 'Huarmey',
  regla: 'escucha.apoyo',
  origen: 'sistema',
  confianza: 'alta',
  evidencia: 'int:9001',
  cita: 'pide agua para su sector y dice que va a ganar',
  ocurridoAt: '2026-09-05T10:42:00.000Z',
};

describe('tres verbos, y siempre los mismos', () => {
  test('clasificar un mensaje es LEER: no cambió nada', () => {
    expect(verboDe({ dimension: 'postura' })).toBe('leyó');
    expect(verboDe({ dimension: 'tema' })).toBe('leyó');
    expect(verboDe({ dimension: 'lugar' })).toBe('leyó');
  });

  test('mover a alguien de columna o prender el riesgo es ANOTAR', () => {
    expect(verboDe({ dimension: 'compromiso' })).toBe('anotó');
    expect(verboDe({ dimension: 'riesgo' })).toBe('anotó');
  });

  test('lo que espera a una persona PROPONE', () => {
    expect(verboDe({ dimension: 'identidad', aplicada: false })).toBe('propone');
    expect(verboDe({ dimension: 'proxima_accion', aplicada: false })).toBe('propone');
  });

  /**
   * 🔴 `propone` GANA sobre la dimensión. Preguntar primero por la dimensión
   * dejaría un renglón diciendo «anotó: simpatiza» sobre alguien que sigue en su
   * columna de antes — el timeline afirmando algo que no pasó.
   */
  test('🔴 un compromiso SIN aplicar propone, no anota', () => {
    expect(verboDe({ dimension: 'compromiso', aplicada: false })).toBe('propone');
  });

  test('aplicada por defecto: lo que viaja en la fila ya pasó', () => {
    expect(verboDe({ dimension: 'compromiso', aplicada: true })).toBe('anotó');
    expect(verboDe({ dimension: 'compromiso' })).toBe('anotó');
  });
});

describe('cuál fila pide una decisión', () => {
  test('la del sistema, mientras nadie haya dictaminado', () => {
    expect(pideVeredicto({ origen: 'sistema' })).toBe(true);
  });

  /**
   * 🔴 Lo que afirmó una PERSONA no se acepta ni se corrige: ya es un hecho.
   * Preguntarle a alguien «¿está bien?» sobre lo que él mismo escribió es ruido
   * en cada fila del timeline — y en un hilo largo son decenas.
   */
  test('🔴 lo que escribió una persona NO pide veredicto', () => {
    expect(pideVeredicto({ origen: 'persona' })).toBe(false);
  });

  test('una ya dictaminada tampoco vuelve a preguntar', () => {
    for (const veredicto of ['acepta', 'corrige', 'no_aplica'] as const) {
      expect(pideVeredicto({ origen: 'sistema', veredicto }), veredicto).toBe(false);
    }
  });
});

describe('una corrección deja las dos cosas en la misma fila', () => {
  const CORREGIDA: Afirmacion = {
    ...LEIDA,
    valor: 'se opone',
    veredicto: 'corrige',
    corregidoA: 'apoya',
    corregidoPor: 'Luz',
  };

  test('🔴 el renglón dice a qué se corrigió, y quién', () => {
    const l = lecturaDe(CORREGIDA);
    expect(l.verbo).toBe('corrigió');
    expect(l.que).toBe('apoya');
    expect(autorDe(l)).toBe('por Luz');
  });

  /**
   * 🔴 CORREGIR REVOCA, NO BORRA. El valor viejo se devuelve aparte para que la
   * vista lo pueda TACHAR: un valor revocado y uno vigente en la misma frase,
   * sin marca, se leen como dos datos.
   *
   * Y no es prolijidad: el valor de una corrección no es sólo el dato nuevo, es
   * la prueba de que esa regla falló ahí. Es lo único con lo que Revisión puede
   * decir «acierta el 94 %».
   */
  test('🔴 el valor viejo sigue disponible para tacharlo', () => {
    expect(valorRevocado(CORREGIDA)).toBe('se opone');
  });

  test('sin corrección no hay nada que tachar', () => {
    expect(valorRevocado(LEIDA)).toBeNull();
    expect(valorRevocado({ ...LEIDA, veredicto: 'acepta' })).toBeNull();
    expect(valorRevocado({ ...LEIDA, veredicto: 'no_aplica' })).toBeNull();
  });

  /** Un «acepta» no cambia el texto: la lectura sigue siendo la de la máquina. */
  test('aceptar no reescribe la fila, sólo la cierra', () => {
    const l = lecturaDe({ ...LEIDA, veredicto: 'acepta' });
    expect(l.verbo).toBe('leyó');
    expect(l.que).toBe('pide agua');
    expect(l.veredicto).toBe('acepta');
  });
});

describe('quién firma cada fila', () => {
  test('una lectura la firma el motor que la escribió', () => {
    expect(autorDe(lecturaDe(LEIDA))).toBe('la escucha');
  });

  /**
   * ⚠️ El LLM todavía no tiene nombre del lado del operador — es una decisión de
   * producto. Hasta que exista, cae en «el sistema»: menos preciso, y honesto.
   */
  test('lo que no tiene nombre todavía cae en «el sistema»', () => {
    expect(autorDe(lecturaDe({ ...LEIDA, regla: 'llm.postura' }))).toBe('el sistema');
  });
});

describe('la confianza, con la misma regla que la tarjeta', () => {
  test('alta no se escribe: nunca pide nada', () => {
    expect(lecturaDe(LEIDA).confianza).toBeUndefined();
  });

  test('media y baja sí: dicen cuánto verificar antes de aceptar', () => {
    expect(lecturaDe({ ...LEIDA, confianza: 'media' }).confianza).toBe('media');
    expect(lecturaDe({ ...LEIDA, confianza: 'baja' }).confianza).toBe('baja');
  });

  test('lo que afirmó una persona no la lleva, aunque el dato traiga una', () => {
    expect(lecturaDe({ ...LEIDA, origen: 'persona', confianza: 'baja' }).confianza).toBeUndefined();
  });
});

describe('la evidencia', () => {
  /**
   * El ancla al mensaje es lo que vuelve verificable a la fila. Sin evidencia la
   * lectura sigue siendo válida —el dato existe— pero no se puede citar, y la
   * vista tiene que poder saberlo para no dibujar un enlace que no lleva a nada.
   */
  test('viaja el id citable y el texto, cuando los hay', () => {
    const l = lecturaDe(LEIDA);
    expect(l.evidencia).toBe('int:9001');
    expect(l.cita).toContain('pide agua para su sector');
  });

  test('sin evidencia la fila existe igual, y se sabe que no hay ancla', () => {
    const l = lecturaDe({ ...LEIDA, evidencia: undefined, cita: undefined });
    expect(l.que).toBe('pide agua');
    expect(l.evidencia).toBeUndefined();
  });

  /**
   * 🔴 CUÁNDO HABLÓ LA PERSONA, no cuándo lo dedujimos. Son cosas distintas y el
   * frente de datos las separa a propósito (`ocurrido_at`): un renglón que dice
   * «hace 18 m» sobre el instante en que corrió el reloj estaría fechando la
   * lectura, no el mensaje — y el reloj corre cada 15 minutos.
   */
  test('🔴 la fecha es la del mensaje, no la de la deducción', () => {
    expect(lecturaDe(LEIDA).ocurridoAt).toBe('2026-09-05T10:42:00.000Z');
  });
});

describe('a qué se puede corregir', () => {
  /**
   * 🔴 Corregir pide el VALOR de reemplazo, no un pulgar abajo: «no sirve» no
   * dice qué era lo correcto, así que no alimenta el prompt, ni el diccionario,
   * ni la precisión por regla.
   */
  test('la postura ofrece sus cuatro valores reales', () => {
    expect(opcionesDeCorreccion('postura').map((o) => o.valor)).toEqual([
      'apoya',
      'indeciso',
      'se_opone',
      'pro_rival',
    ]);
  });

  /** `desconocida` no está: nadie AFIRMA que no se sabe. Eso es no corregir. */
  test('«desconocida» no es algo que una persona afirme', () => {
    expect(opcionesDeCorreccion('postura').map((o) => o.valor)).not.toContain('desconocida');
  });

  /**
   * El sistema sólo declara `simpatiza` (ADR 0095 §3), pero una PERSONA puede
   * subir desde acá: corregir hacia arriba es lo que ADR 0063 pide que haga
   * quien habló con la gente.
   */
  test('el compromiso ofrece los tres peldaños, no sólo el que el sistema declara', () => {
    expect(opcionesDeCorreccion('compromiso').map((o) => o.valor)).toEqual([
      'simpatiza',
      'comprometido',
      'voluntario',
    ]);
  });

  /**
   * 🔴 **Sin lista cerrada no se ofrece la acción.** El `lugar` son los
   * distritos del catálogo de la campaña: una búsqueda, no cuatro botones.
   * Ofrecer «Corregir» con una lista recortada dejaría a quien atiende sin poder
   * poner el distrito que de verdad es — peor que no ofrecerlo.
   */
  test('🔴 el lugar no ofrece corrección: su lista no cabe en cuatro botones', () => {
    expect(opcionesDeCorreccion('lugar')).toEqual([]);
    expect(opcionesDeCorreccion('tema')).toEqual([]);
  });
});
