import { describe, expect, it } from 'vitest';

/**
 * UN SOLO DETECTOR DE CELULAR EN EL FRONT — `lib/useEsMovil.ts`, y nadie más.
 *
 * El shell de celular y el hilo de celular nacieron en dos ramas a la vez, y cada
 * una escribió su propia pregunta: `(width < 48rem)` en el shell, `(max-width:
 * 767.98px)` en el ajuste del teclado del hilo. Dicen lo mismo a 16 px de letra y
 * con anchos enteros, y NO lo mismo con la letra del navegador en 20 px (48rem son
 * 960 px) ni en un ancho fraccionario entre 767,98 y 768: ahí el shell arma la
 * pantalla de celular y el hilo no se entera del teclado, o al revés. Nadie lo ve
 * en una captura a 390.
 *
 * El detector es uno a propósito (ver su docblock). Este candado lo hace
 * imposible de olvidar: cualquier `matchMedia` con un ancho escrito a mano fuera
 * de ese archivo pone esto rojo. Lo que haga falta se importa de ahí:
 * `useEsMovil()` para decidir qué se monta, `CONSULTA_CELULAR` para escuchar el
 * corte desde un efecto. Lo que sólo cambia de estilo va con `max-md:`, que es el
 * mismo corte.
 */

const FUENTES = import.meta.glob('../**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

/** `matchMedia('(max-width: …)')`, `matchMedia("(width < …)")`, `min-width`… con la consulta escrita ahí mismo. */
const ANCHO_ESCRITO_A_MANO = /matchMedia\??\.?\(\s*['"`][^'"`]*width/;

describe('un solo detector de celular', () => {
  it('nadie fuera de lib/useEsMovil.ts escribe a mano una media query de ancho', () => {
    const conDetectorPropio = Object.entries(FUENTES)
      .filter(([ruta]) => !ruta.includes('.test.') && !ruta.includes('/pruebas/') && !ruta.includes('galeria'))
      // Las claves del glob salen relativas a ESTE archivo: el detector es `./useEsMovil.ts`.
      .filter(([ruta]) => !ruta.endsWith('/useEsMovil.ts'))
      .filter(([, texto]) => ANCHO_ESCRITO_A_MANO.test(texto))
      .map(([ruta]) => ruta);

    expect(conDetectorPropio).toEqual([]);
  });

  it('y el candado ve un detector escrito a mano cuando existe', () => {
    // Sin esto, un glob que no encontrara nada daría el primer test verde para
    // siempre: se afirma que la regla SÍ reconoce la forma que ya se coló una vez.
    expect(ANCHO_ESCRITO_A_MANO.test(`window.matchMedia('(max-width: 767.98px)')`)).toBe(true);
    expect(Object.keys(FUENTES).some((ruta) => ruta.endsWith('/useEsMovil.ts'))).toBe(true);
  });
});
