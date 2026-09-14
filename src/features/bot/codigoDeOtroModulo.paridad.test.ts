import { describe, expect, it } from 'vitest';
import { CODIGO_OTRO_MODULO } from './estado';

/**
 * EL CANDADO ENTRE LOS DOS `CODIGO_OTRO_MODULO` — desde el lado del FRONT.
 *
 * ══ QUÉ SOSTIENE ════════════════════════════════════════════════════════════
 *
 * `/api/bot` va montada con el candado `deVentas` (ADR 0077 §3), así que a una
 * identidad de campaña le contesta **403 con `codigo: 'otro_modulo_del_crm'`**.
 * El chip del bot usa ESE código —no el 403 pelado— para decir «bot: no aplica»
 * en vez de «bot: sin señal».
 *
 * ══ 🔴 POR QUÉ HACE FALTA UN TEST Y NO ALCANZA UN COMENTARIO ════════════════
 *
 * Porque si las dos cadenas se separan **no se rompe nada**: `codigo === ...` da
 * `false`, la rama nueva no entra y el chip vuelve a decir «sin señal» — o sea,
 * exactamente el estado del que este cambio viene, restaurado en silencio. No
 * hay excepción, no hay 500, no hay nada en la consola. Es la misma forma de
 * fallo que `TOPE_CUERPO` (`features/correos/topeCuerpo.paridad.test.ts`): el
 * mensaje SUENA correcto, así que nadie lo reporta.
 *
 * Y es una cadena, no un número: renombrarla al agregar un tercer módulo es un
 * refactor que se ve inofensivo del lado del server.
 *
 * ⚠️ **`import.meta.glob` y NUNCA `node:fs`.** Con `fs` el test pasa en vitest y
 * falla el typecheck de `tsconfig.app.json`, que no lleva los tipos de node (la
 * cicatriz es `etapas.test.ts`, ADR 0049).
 */

/**
 * El archivo del server como texto crudo. Ruta literal y no un patrón: con un
 * comodín, un archivo renombrado devolvería un mapa vacío en vez de fallar acá,
 * que es donde se lee mejor.
 */
const SERVER: Record<string, string> = import.meta.glob('../../../server/src/modulos/deEsteModulo.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/**
 * 🔴 **Un glob que no encuentra nada aprueba en silencio.** Por eso «no se pudo
 * leer el server» es un fallo con nombre propio y no una comparación contra la
 * nada.
 */
function fuenteDelServer(): string {
  const entradas = Object.values(SERVER);
  expect(
    entradas.length,
    'el glob no encontró server/src/modulos/deEsteModulo.ts — ¿se movió? Sin fuente este test aprueba sin comparar nada',
  ).toBe(1);
  const fuente = entradas[0] ?? '';
  expect(fuente.length, 'el archivo del server se leyó vacío: el candado compararía la nada').toBeGreaterThan(0);
  return fuente;
}

function codigoDelServer(): string {
  const m = fuenteDelServer().match(/export const CODIGO_OTRO_MODULO\s*=\s*"([^"]+)"/);
  expect(m, 'no se encontró `export const CODIGO_OTRO_MODULO` en el server — ¿se renombró?').toBeTruthy();
  return m![1]!;
}

describe('CODIGO_OTRO_MODULO — front y server dicen la misma cadena', () => {
  it('el código del front es exactamente el del server', () => {
    const delServer = codigoDelServer();
    expect(
      CODIGO_OTRO_MODULO,
      `el front espera «${CODIGO_OTRO_MODULO}» y el server manda «${delServer}»: el chip volvería a decir ` +
        '«sin señal» en campaña, sin que nada falle',
    ).toBe(delServer);
  });

  /**
   * Que las dos constantes coincidan no alcanza si el server dejó de mandarlas.
   * Esto fija el CABLEADO del otro lado: que el 403 del candado siga llevando el
   * código en el cuerpo.
   */
  it('el server sigue mandando el código en el cuerpo del 403', () => {
    const fuente = fuenteDelServer();
    expect(fuente, 'el 403 del candado de módulo ya no manda `codigo`: el front no puede distinguirlo').toMatch(
      /res\s*\.status\(403\)[\s\S]{0,200}codigo:\s*CODIGO_OTRO_MODULO/,
    );
  });
});
