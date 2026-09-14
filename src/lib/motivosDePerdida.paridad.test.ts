import { describe, expect, it } from 'vitest';
import { MOTIVOS_DE_PERDIDA, MOTIVO_DE_PERDIDA_ROTULO, TOPE_DETALLE_PERDIDA } from './motivosDePerdida';

/**
 * LOS MOTIVOS DE PÉRDIDA, FRONT ≡ SERVER (candado 3, ADR 0107).
 *
 * La lista vive en `server/src/gestiones/motivosDePerdida.ts`, que es quien la hace
 * cumplir: el front no puede importarla (el server compila con `rootDir: src` y el front
 * con `include: ["src"]`), así que tiene su espejo acá y este test lee el server como
 * texto. Sin el cruce, la barra ofrecería un motivo que el server rechaza, o dejaría de
 * ofrecer uno que el server acepta, y nada fallaría hasta que alguien lo tocara.
 *
 * ⚠️ **`import.meta.glob` y NUNCA `node:fs`** — mismo motivo que
 * `features/dashboard/etapas.paridad.test.ts`: con `fs` el test pasa en vitest y falla el
 * typecheck de `tsconfig.app.json`, que no lleva los tipos de node.
 */

const ARCHIVOS: Record<string, string> = import.meta.glob(['../../server/src/gestiones/motivosDePerdida.ts'], {
  eager: true,
  query: '?raw',
  import: 'default',
});

/** 🔴 Un glob que no encuentra nada aprueba en silencio: acá «no se pudo leer» es un fallo con nombre. */
function fuenteDelServer(): string {
  const clave = Object.keys(ARCHIVOS).find((k) => k.split('/').pop() === 'motivosDePerdida.ts');
  expect(clave, 'el glob no encontró server/src/gestiones/motivosDePerdida.ts — ¿se movió? Sin fuente este test no compara nada').toBeTruthy();
  const contenido = ARCHIVOS[clave!] ?? '';
  expect(contenido.length, 'motivosDePerdida.ts se leyó vacío: el candado compararía la nada').toBeGreaterThan(0);
  return contenido;
}

describe('los motivos de pérdida — el front ofrece exactamente los que el server acepta', () => {
  it('la misma lista, en el mismo orden', () => {
    const m = fuenteDelServer().match(/export const MOTIVOS_DE_PERDIDA = \[([^\]]+)\]/);
    expect(m, 'no se encontró `export const MOTIVOS_DE_PERDIDA = [...]` en el server — ¿se renombró o se reformateó?').toBeTruthy();
    const delServer = m![1].match(/'([a-z_]+)'/g)!.map((s) => s.slice(1, -1));
    expect(delServer.length).toBeGreaterThan(0);
    expect([...MOTIVOS_DE_PERDIDA]).toEqual(delServer);
  });

  it('el mismo tope para el detalle: la barra no puede dejar escribir lo que el server va a rechazar', () => {
    const m = fuenteDelServer().match(/export const TOPE_DETALLE_PERDIDA = (\d+);/);
    expect(m, 'no se encontró `export const TOPE_DETALLE_PERDIDA = N;` en el server').toBeTruthy();
    expect(TOPE_DETALLE_PERDIDA).toBe(Number(m![1]));
  });

  it('cada motivo tiene su rótulo, y dos motivos no se leen igual', () => {
    const rotulos = MOTIVOS_DE_PERDIDA.map((motivo) => MOTIVO_DE_PERDIDA_ROTULO[motivo]);
    for (const [i, rotulo] of rotulos.entries()) {
      expect(rotulo?.trim(), `«${MOTIVOS_DE_PERDIDA[i]}» no tiene rótulo: la barra mostraría el id crudo`).toBeTruthy();
    }
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });
});
