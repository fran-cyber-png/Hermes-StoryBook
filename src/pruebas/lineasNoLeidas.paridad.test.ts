import { describe, expect, it } from 'vitest';
import { CODIGO_LINEAS_NO_LEIDAS } from '../lib/datos/lineasNoLeidas';
import { MENSAJE_LINEAS_NO_LEIDAS, REINTENTAR_EN_SEGUNDOS } from './lineasNoLeidas';

/**
 * EL CANDADO ENTRE EL 503 `lineas_no_leidas` DEL SERVER Y SUS COPIAS DEL FRONT (ADR 0108).
 *
 * Si las dos copias se separan **no se rompe nada**, y por eso hace falta un test:
 *   · con otro CÓDIGO, `esLineasNoLeidas` da `false` y las pantallas de bot, correos y campaña
 *     vuelven a leer ese 503 como «falta la migración» o «falta el SMTP»;
 *   · con otro MENSAJE, las galerías y los tests siguen verdes mostrando una frase que el server
 *     ya no dice, y la captura deja de ser evidencia (candado 10).
 *
 * ⚠️ `import.meta.glob` y nunca `node:fs`: con `fs` el test pasa en vitest y falla el typecheck
 * de `tsconfig.app.json` (la cicatriz de `etapas.test.ts`, ADR 0049).
 */

/** Ruta literal y no un patrón: un archivo movido tiene que fallar acá, no comparar contra la nada. */
const SERVER: Record<string, string> = import.meta.glob('../../server/src/cola/lecturaDeLineas.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});

function fuenteDelServer(): string {
  const entradas = Object.values(SERVER);
  expect(
    entradas.length,
    'el glob no encontró server/src/cola/lecturaDeLineas.ts — ¿se movió? Sin fuente este test aprueba sin comparar nada',
  ).toBe(1);
  const fuente = entradas[0] ?? '';
  expect(fuente.length, 'el archivo del server se leyó vacío: el candado compararía la nada').toBeGreaterThan(0);
  return fuente;
}

function constanteDelServer(nombre: string): string {
  const m = fuenteDelServer().match(new RegExp(`export const ${nombre}\\s*=\\s*"([^"]+)"`));
  expect(m, `no se encontró \`export const ${nombre}\` en el server — ¿se renombró?`).toBeTruthy();
  return m![1]!;
}

describe('el 503 de las líneas no leídas — front y server dicen lo mismo', () => {
  it('el código que miran las pantallas es exactamente el del server', () => {
    const delServer = constanteDelServer('CODIGO_LINEAS_NO_LEIDAS');
    expect(
      CODIGO_LINEAS_NO_LEIDAS,
      `el front espera «${CODIGO_LINEAS_NO_LEIDAS}» y el server manda «${delServer}»: bot, correos y campaña ` +
        'volverían a diagnosticar ese 503 como una migración o un SMTP que faltan',
    ).toBe(delServer);
  });

  it('el mensaje de tests y galerías es el que manda el server', () => {
    expect(
      MENSAJE_LINEAS_NO_LEIDAS,
      'las galerías mostrarían una frase que el server ya no dice: la captura dejaría de ser evidencia',
    ).toBe(constanteDelServer('MENSAJE_LINEAS_NO_LEIDAS'));
  });

  it('y el Retry-After también', () => {
    expect(fuenteDelServer()).toMatch(new RegExp(`reintentarEnSegundos:\\s*${REINTENTAR_EN_SEGUNDOS}\\b`));
  });
});
