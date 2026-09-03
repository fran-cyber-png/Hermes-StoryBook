import { describe, expect, it } from 'vitest';
import { ordenDelEmbudo, ETAPA_ROTULO, SIN_RESPUESTA } from '../../lib/etapas';

/**
 * EL CANDADO DEL ISSUE #329, DESDE EL LADO DEL FRONT.
 *
 * *«Toda etapa que `contarPorEtapaEfectiva` puede devolver, el Dashboard la
 * tiene que poder dibujar.»* El defecto que esto viene a cerrar no era que
 * `sin_respuesta` no existiera — existía, tipada y todo — era que
 * `VistaDashboard.tsx` sumaba y dibujaba iterando `ETAPAS`, una lista fija
 * del front que la excluye a propósito (ver `etapas.ts`). El seam del server
 * (`server/src/cola/etapaEfectivaSql.ts`) puede devolver `sin_respuesta` más
 * las cinco de `server/src/gestiones/registrarGestion.ts::ETAPAS`, y el radar
 * mostraba un total que omitía la más grande de las seis (65 % del embudo).
 *
 * ⚠️ **`import.meta.glob` y NUNCA `node:fs`** — mismo motivo que
 * `correos/topeCuerpo.paridad.test.ts`: con `fs` el test pasa en vitest y
 * falla el typecheck de `tsconfig.app.json`, que no lleva los tipos de node.
 */

const ARCHIVOS: Record<string, string> = import.meta.glob(
  [
    '../../../server/src/gestiones/registrarGestion.ts',
    '../../../server/src/cola/etapaEfectivaSql.ts',
    '../../features/dashboard/VistaDashboard.tsx',
  ],
  { eager: true, query: '?raw', import: 'default' },
);

/**
 * 🔴 Un glob que no encuentra nada aprueba en silencio — mismo falso verde
 * que `seleccionVisible.test.ts` evitó hace tiempo. Acá «no se pudo leer el
 * archivo» es un fallo con nombre propio, no una comparación que da true por
 * vacío.
 */
function fuente(ruta: string): string {
  // Vite acorta la clave del glob cuando el archivo está en el mismo
  // directorio del test (`./VistaDashboard.tsx`, no la ruta relativa
  // completa) — por eso se compara por el NOMBRE del archivo, no por la ruta
  // entera, que es lo único estable entre los dos casos.
  const nombre = ruta.split('/').pop();
  const clave = Object.keys(ARCHIVOS).find((k) => k.split('/').pop() === nombre);
  expect(clave, `el glob no encontró ${ruta} — ¿se movió el archivo? Sin fuente este test aprueba sin comparar nada`).toBeTruthy();
  const contenido = ARCHIVOS[clave!] ?? '';
  expect(contenido.length, `${ruta} se leyó vacío: el candado estaría comparando la nada`).toBeGreaterThan(0);
  return contenido;
}

/** Las etapas de VENTAS que el server declara, extraídas como texto (misma técnica que `topeCuerpo.paridad.test.ts`). */
function etapasDelServer(): string[] {
  const src = fuente('gestiones/registrarGestion.ts');
  const m = src.match(/export const ETAPAS = \[([^\]]+)\]/);
  expect(m, 'no se encontró `export const ETAPAS = [...]` en registrarGestion.ts — ¿se renombró?').toBeTruthy();
  return m![1].match(/'([a-z_]+)'/g)!.map((s) => s.slice(1, -1));
}

/** Confirma que `sin_respuesta` sigue siendo lo que `etapaEfectivaSql.ts` antepone a la escala. */
function confirmarSinRespuestaEnElServer(): void {
  const src = fuente('cola/etapaEfectivaSql.ts');
  expect(
    src.includes('SIN_RESPUESTA = "sin_respuesta"') || src.includes("SIN_RESPUESTA = 'sin_respuesta'"),
    'etapaEfectivaSql.ts ya no declara SIN_RESPUESTA = "sin_respuesta" — el seam pudo cambiar de valor',
  ).toBe(true);
  expect(
    src.includes('SIN_RESPUESTA,') && src.includes('...ETAPAS'),
    'etapaEfectivaSql.ts ya no antepone SIN_RESPUESTA a ETAPAS en su escala — revisa ESCALA_ETAPAS',
  ).toBe(true);
}

/**
 * ══ EL CONSUMIDOR, NO SOLO LA FUNCIÓN ═══════════════════════════════════════
 *
 * `totalDelEmbudo`/`ordenDelEmbudo` son correctas por construcción — no hay
 * forma de que pierdan una clave. Lo que SÍ puede volver a romperse es que
 * `VistaDashboard.tsx` deje de llamarlas y vuelva a iterar `ETAPAS` a mano
 * (exactamente el bug original). Mismo patrón que `PINTAN_ETAPA` en
 * `lib/etapas.test.ts`: se lee el componente como texto, como
 * `limitesMedia.paridad.test.ts`.
 */
function fuenteDelDashboard(): string {
  return fuente('features/dashboard/VistaDashboard.tsx');
}

describe('VistaDashboard.tsx llama a las funciones que no pierden claves, no a ETAPAS a mano', () => {
  it('🔴 el total NO se calcula iterando ETAPAS — eso es el bug original', () => {
    const src = fuenteDelDashboard();
    expect(src.includes('totalDelEmbudo'), 'VistaDashboard.tsx ya no usa totalDelEmbudo').toBe(true);
    expect(
      /ETAPAS\.reduce/.test(src),
      'VistaDashboard.tsx volvió a sumar el embudo con `ETAPAS.reduce` — eso es exactamente el bug de #329',
    ).toBe(false);
  });

  it('los segmentos y la leyenda salen de ordenDelEmbudo, no de un ETAPAS.map', () => {
    const src = fuenteDelDashboard();
    expect(src.includes('ordenDelEmbudo'), 'VistaDashboard.tsx ya no usa ordenDelEmbudo').toBe(true);
    expect(
      /ETAPAS\.map/.test(src),
      'VistaDashboard.tsx volvió a dibujar el embudo con `ETAPAS.map` — sin_respuesta quedaría afuera del dibujo',
    ).toBe(false);
  });
});

describe('toda etapa que el seam del Dashboard puede devolver, el front la puede dibujar', () => {
  it('sin_respuesta + las de ventas siguen siendo exactamente lo que el server puede derivar', () => {
    confirmarSinRespuestaEnElServer();
    const posibles = [SIN_RESPUESTA, ...etapasDelServer()];
    expect(posibles).toEqual(['sin_respuesta', 'interesado', 'contactado', 'cotizado', 'cierre', 'perdido']);
  });

  it('ordenDelEmbudo no pierde NINGUNA de las seis, sin importar el orden en que lleguen', () => {
    const posibles = [SIN_RESPUESTA, ...etapasDelServer()];
    const dibujadas = ordenDelEmbudo(posibles);
    expect(dibujadas.sort()).toEqual([...posibles].sort());
  });

  it('toda etapa que el seam puede devolver tiene un rótulo con el que dibujarse', () => {
    const posibles = [SIN_RESPUESTA, ...etapasDelServer()];
    for (const e of posibles) {
      expect(ETAPA_ROTULO[e], `«${e}» no tiene rótulo — el Dashboard mostraría el id crudo`).toBeDefined();
    }
  });
});
