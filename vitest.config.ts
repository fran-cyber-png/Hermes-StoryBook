import { defineConfig } from 'vitest/config'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
// Vitest 4 dejó de aceptar el provider como cadena: ahora es una fábrica.
import { playwright } from '@vitest/browser-playwright'

/**
 * DOS PROYECTOS: los tests del front y las historias de Storybook.
 *
 * ⚠️ **Este archivo YA NO es el del monorepo, y es a propósito.** El recorte lo
 * heredó igual, y así corría los ~400 tests del front y NINGUNA historia: el
 * addon `@storybook/addon-vitest` estaba instalado y declarado en `main.ts`, pero
 * sin proyecto que lo cableara. O sea que cada `play()` escrita en una historia
 * sólo corría si alguien entraba al navegador y apretaba «Run tests» a mano —
 * eran decorativas. La sincronización con hermes/main no toca este archivo (sólo
 * trae `src`, `index.html` y `vite.config.ts`), así que la divergencia es estable.
 *
 * ══ 🔴 SI ESTO DICE «no tests» Y LOS 43 ARCHIVOS FALLAN CON «No test suite
 * found», MIRÁ LA RUTA DEL REPO ANTES DE TOCAR NADA ══════════════════════════
 *
 * `@storybook/addon-vitest@10.6.0` se rompe cuando el proyecto vive en una ruta
 * con caracteres no-ASCII. El código que genera envuelve los tests en:
 *
 *     convertToFilePath(import.meta.url).includes(__vitest_worker__.filepath)
 *
 * y su `convertToFilePath` sólo decodifica `%20`:
 *
 *     url.replace(/^file:\/\//, "").replace(/^\/+([a-zA-Z]:)/, "$1").replace(/%20/g, " ")
 *
 * En `C:\Users\Consultoría\…` la í viaja como `%C3%ADa`, la comparación da
 * false y **no se registra un solo test** — sin error, sólo «no tests», que es
 * indistinguible de «todo bien».
 *
 * Medido el 14-sep-2026: el MISMO commit, con el mismo `node_modules`, corriendo
 * desde `C:\dev\Hermes-StoryBook` da **43 archivos y 131 tests en verde**. La
 * solución es la ruta, no la configuración: un junction no alcanza (Node lo
 * resuelve al path real).
 *
 * ── Por qué las historias corren en un NAVEGADOR de verdad ──
 * Porque los dos defectos que costaron encontrar en este repo eran invisibles sin
 * uno: una pastilla que salía truncada por un `max-w` sin contenedor, y las
 * muestras de Fundamentos pintadas con tokens que Tailwind no había emitido y que
 * resolvían a cadena vacía. Los dos compilaban perfecto y pasaban `tsc`. jsdom no
 * hace layout ni resuelve la cascada completa, así que tampoco los vería.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unidad',
          environment: 'node',
          /**
           * ══ POR QUÉ 30 s Y NO LOS 5 s DE FÁBRICA ═══════════════════════════
           *
           * El default de vitest da por sentado un test que no monta nada. Los de
           * jsdom de este repo cruzan las fronteras perezosas de
           * `notas/perezosos.tsx` (BlockNote), y **ese costo se paga UNA sola
           * vez**: lo carga el primer test que toque montarlas, y los demás del
           * archivo entran gratis.
           *
           * Medido el 21-ago-2026: el primer test de `Libreta.dibujo` tarda 9,1 s
           * mientras los otros 46 van de 70 a 800 ms. O sea que el número no
           * estaba midiendo el test: medía a cuál le tocó estrenar el módulo.
           *
           * Lo que ataja un cuelgue de verdad no es este número sino
           * `TOPE_ANTI_CUELGUE` (`src/pruebas/dom.tsx`), que cuenta turnos y no
           * mira el reloj.
           */
          testTimeout: 30_000,
          hookTimeout: 30_000,
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          /**
           * `index.css` SE PUEDE LEER; el resto del CSS sigue apagado.
           *
           * Vitest sirve todo `.css` como cadena VACÍA por default, y eso incluye
           * a `?raw`. `seleccionVisible.test.ts` —que mide el contraste del
           * resalte contra el fondo de las burbujas— leía `''` y pasaba por vacío:
           * el falso verde de siempre.
           *
           * Es un regex y no `true` a propósito: prender el CSS entero haría que
           * cualquier test que monte algo pague PostCSS + Tailwind para no mirar
           * ni un píxel. Y NO lleva `$`, porque el id viene con la query pegada
           * (`index.css?raw`).
           */
          css: { include: [/index\.css/] },
        },
      },
      {
        plugins: [storybookTest({ configDir: '.storybook' })],
        test: {
          name: 'storybook',
          /**
           * ⚠️ **SIN `setupFiles`, y eso NO es un olvido.** Desde Storybook 10.3
           * el addon aplica solo las anotaciones del `preview` (decoradores,
           * parámetros, tags). Un setup propio con `setProjectAnnotations` le hace
           * SALTEAR ese paso «para evitar conflictos» — y ahí se pierde el
           * `tags: ['test']` del preview, que es justo lo que decide qué historias
           * entran a la suite. Síntoma: los 43 archivos se encuentran y los 43
           * fallan con «No test suite found».
           */
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
  // Lo inyecta `vite.config.ts` en los builds de verdad; acá alcanza un valor
  // fijo. Sin esto, importar `persistencia.ts` reventaría por el global ausente.
  define: {
    __ID_DEL_BUILD__: JSON.stringify('test'),
  },
})
