/**
 * UNA PANTALLA DE UN ANCHO DADO, PARA LOS TESTS QUE PREGUNTAN «¿ES UN CELULAR?».
 *
 * `pruebas/dom.tsx` remienda `matchMedia` con un stub que contesta «no matchea» a
 * todo, y está bien que así sea para el resto de la suite: jsdom no tiene media
 * queries, e inventar un ancho sería inventar un dato. Pero un test del shell en
 * celular necesita justo eso —un ancho—, y además necesita **cambiarlo en vivo**,
 * porque girar el teléfono o angostar la ventana cruza el corte sin recargar.
 *
 * Por eso esto no devuelve un booleano fijo: evalúa la consulta de verdad contra
 * el ancho simulado. Entiende la forma de rango que usa Tailwind y que copia
 * `lib/useEsMovil.ts` —`(width < 48rem)`—, con el `rem` a 16 px, que es la letra
 * por defecto del navegador. Una consulta que no entiende contesta «no matchea»,
 * igual que el stub de siempre: el esquema de color de `lib/tema.ts` no se entera
 * de que hay un ancho.
 *
 * Uso:
 *
 *     const pantalla = simularPantalla(390);
 *     // … montar, afirmar …
 *     pantalla.cambiarA(1280);   // avisa a quien escuchaba, como el navegador
 *     pantalla.restaurar();      // en el afterEach
 */

export interface PantallaSimulada {
  /** Cambia el ancho y avisa a cada consulta cuyo resultado cambió. */
  cambiarA(ancho: number): void;
  /** Devuelve el `matchMedia` que había antes. */
  restaurar(): void;
}

type Oyente = (evento: { matches: boolean; media: string }) => void;

const PX_POR_REM = 16;

function coincide(consulta: string, ancho: number): boolean {
  const regla = consulta.match(/^\(width < (\d+(?:\.\d+)?)(px|rem)\)$/);
  if (!regla) return false;
  const tope = Number(regla[1]) * (regla[2] === 'rem' ? PX_POR_REM : 1);
  return ancho < tope;
}

export function simularPantalla(anchoInicial: number): PantallaSimulada {
  const global = globalThis as { matchMedia?: unknown };
  const anterior = global.matchMedia;
  let ancho = anchoInicial;
  const escuchas = new Map<string, Set<Oyente>>();

  global.matchMedia = (consulta: string) => {
    const oyentes = escuchas.get(consulta) ?? new Set<Oyente>();
    escuchas.set(consulta, oyentes);
    return {
      get matches() {
        return coincide(consulta, ancho);
      },
      media: consulta,
      onchange: null,
      addEventListener: (_tipo: string, oyente: Oyente) => void oyentes.add(oyente),
      removeEventListener: (_tipo: string, oyente: Oyente) => void oyentes.delete(oyente),
      addListener: (oyente: Oyente) => void oyentes.add(oyente),
      removeListener: (oyente: Oyente) => void oyentes.delete(oyente),
      dispatchEvent: () => false,
    };
  };

  return {
    cambiarA(nuevo) {
      const antes = ancho;
      ancho = nuevo;
      for (const [consulta, oyentes] of escuchas) {
        const ahora = coincide(consulta, ancho);
        if (ahora === coincide(consulta, antes)) continue;
        for (const oyente of [...oyentes]) oyente({ matches: ahora, media: consulta });
      }
    },
    restaurar() {
      global.matchMedia = anterior;
    },
  };
}
