import { describe, expect, test } from 'vitest';
import {
  contarHuecos,
  filtrarPlantillas,
  pegarPlantilla,
  primerHueco,
  restoDePlantilla,
  tituloDePlantilla,
  type PlantillaAMano,
} from './plantillasAMano';

/**
 * LAS REGLAS DEL PEGADO — los bordes que adentro de un `onClick` no se pueden
 * interrogar (ADR 0024): caja vacía, caja con un borrador, cursor en el medio,
 * plantilla con huecos y sin.
 *
 * El caso que se lleva el peso es el segundo: **pegar no puede borrar lo que la
 * vendedora estaba escribiendo**. Un borrador de tres renglones es lo único de la
 * pantalla que nadie más tiene guardado, y no hay deshacer.
 */

// Los cuerpos son los REALES de producción (`campana/plantillasAprobadas.ts`),
// recortados. Una prueba con un texto ideal ya escondió tres defectos una vez.
const FORO = [
  '👋 Hola buen día. Te saluda Luz asesora comercial de Goberna.',
  '',
  '🏛️XII FORO DE ESTADO - Aniversario GOBERNA 🏛️',
  '*Único pago de S/360.00*',
].join('\n');

const CON_HUECO = 'Hola {{1}}, tu inscripción al {{2}} quedó confirmada.';

const PLANTILLAS: PlantillaAMano[] = [
  { nombre: 'foro_estado_5_ago', idioma: 'es_PE', categoria: 'MARKETING', cuerpo: FORO, headerDeImagen: true },
  {
    nombre: 'promo_3x1_cursos',
    idioma: 'en',
    categoria: 'MARKETING',
    cuerpo: '🚨 *PROMO 3X1 IMPERDIBLE* 🚨\n💵 *TODO por solo $150 USD*',
    headerDeImagen: true,
  },
];

describe('los huecos de Meta', () => {
  test('se encuentran, se cuentan, y un texto sin huecos no inventa ninguno', () => {
    expect(contarHuecos(CON_HUECO)).toBe(2);
    expect(contarHuecos(FORO)).toBe(0);
    expect(primerHueco(CON_HUECO)).toEqual({ desde: 5, hasta: 10 });
    expect(primerHueco(FORO)).toBeNull();
  });

  test('un texto entre llaves que alguien escribió a propósito NO es un hueco', () => {
    // Una sola llave, o un párrafo entero entre llaves, es prosa. Marcarlo como
    // hueco dejaría seleccionado medio mensaje al pegar.
    expect(contarHuecos('el horario es {8 a 10}')).toBe(0);
    expect(contarHuecos(`{{${'x'.repeat(60)}}}`)).toBe(0);
  });
});

describe('el título de un renglón', () => {
  test('es la primera línea CON palabras, no el slug ni un renglón en blanco', () => {
    expect(tituloDePlantilla('\n\n  🚨 PROMO 3X1\nsegunda línea')).toBe('🚨 PROMO 3X1');
    expect(tituloDePlantilla('   \n  ')).toBe('(sin texto)');
  });

  test('el preview es lo que SIGUE al título, nunca el cuerpo entero', () => {
    // Con el cuerpo entero, el renglón dice dos veces la misma línea. Lo mostró
    // la captura de evidencia, no un test.
    expect(restoDePlantilla('\n🚨 PROMO 3X1\n\n$150 USD')).toBe('$150 USD');
    // De una sola línea no hay resto: mejor nada que un hueco repetido.
    expect(restoDePlantilla('  una sola línea  ')).toBe('');
    expect(restoDePlantilla('   ')).toBe('');
  });
});

describe('buscar', () => {
  test('encuentra por el nombre y por una palabra del CUERPO', () => {
    // Nadie se acuerda del slug: se acuerda de una palabra del mensaje.
    expect(filtrarPlantillas(PLANTILLAS, 'foro').map((p) => p.nombre)).toEqual(['foro_estado_5_ago']);
    expect(filtrarPlantillas(PLANTILLAS, 'S/360').map((p) => p.nombre)).toEqual(['foro_estado_5_ago']);
    expect(filtrarPlantillas(PLANTILLAS, '150 USD').map((p) => p.nombre)).toEqual(['promo_3x1_cursos']);
  });

  test('sin consulta devuelve todo, en el orden que vino', () => {
    expect(filtrarPlantillas(PLANTILLAS, '   ')).toHaveLength(2);
  });
});

describe('pegar', () => {
  test('con la caja vacía cae el cuerpo TAL CUAL, y el cursor al final', () => {
    const r = pegarPlantilla('', 0, FORO);
    expect(r.texto).toBe(FORO);
    expect(r.desde).toBe(FORO.length);
    expect(r.hasta).toBe(FORO.length);
  });

  test('🔴 con un borrador escrito NO lo pisa: inserta y lo conserva entero', () => {
    // El defecto que este test impide: reemplazar la caja es la versión obvia, y
    // es la que borra tres renglones con un clic en el botón equivocado.
    const borrador = 'Hola Javier, te cuento:';
    const r = pegarPlantilla(borrador, borrador.length, 'Segundo mensaje.');
    expect(r.texto).toContain(borrador);
    expect(r.texto).toBe('Hola Javier, te cuento:\nSegundo mensaje.');
  });

  test('inserta DONDE está el cursor, no siempre al final', () => {
    const r = pegarPlantilla('arriba\nabajo', 6, 'MEDIO');
    expect(r.texto).toBe('arriba\nMEDIO\nabajo');
  });

  test('no acumula renglones en blanco al pegar dos veces seguidas', () => {
    const uno = pegarPlantilla('ya escrito', 10, 'A');
    const dos = pegarPlantilla(uno.texto, uno.texto.length, 'B');
    expect(dos.texto).toBe('ya escrito\nA\nB');
  });

  test('🔴 el primer hueco queda SELECCIONADO: se reemplaza tipeando', () => {
    // Con solo el cursor al lado, `{{1}}` se descubre cuando el lead ya lo leyó.
    const r = pegarPlantilla('', 0, CON_HUECO);
    expect(r.texto.slice(r.desde, r.hasta)).toBe('{{1}}');
  });

  test('y también cuando se inserta sobre un borrador (el offset no se pierde)', () => {
    const r = pegarPlantilla('previo', 6, CON_HUECO);
    expect(r.texto.slice(r.desde, r.hasta)).toBe('{{1}}');
  });

  test('un cursor imposible no rompe: se acota al largo del texto', () => {
    const r = pegarPlantilla('corto', 999, 'X');
    expect(r.texto).toBe('corto\nX');
  });
});
