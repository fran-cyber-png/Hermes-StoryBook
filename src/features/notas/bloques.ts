/**
 * TEXTO PLANO → BLOQUES DE LA LIBRETA, sin una línea de BlockNote.
 *
 * ══ 🔴 POR QUÉ VIVE SOLA Y NO EN `editor.ts` — 21-ago-2026 ═══════════════════
 *
 * Esta función no toca BlockNote: arma objetos planos. Pero vivía en `editor.ts`,
 * cuya PRIMERA línea es `import { BlockNoteSchema, ... } from '@blocknote/core'`.
 * Y `notas.ts` —que `App.tsx` importa por `esAtajoLibreta`, dos líneas de teclado,
 * y `RegistrarGestion.tsx` por `useNotas`— la pedía desde ahí.
 *
 * Resultado medido con `npm run presupuesto` el día que el chunk de entrada
 * estrenó su techo: **102 ocurrencias de `prosemirror` y 25 de `EditorView` en
 * `index-*.js`**. O sea, el motor del editor viajaba en el arranque para todas
 * las vendedoras, incluidas las que ese día no abren la Libreta — que es
 * exactamente lo que ADR 0034 y la carga perezosa vinieron a evitar.
 *
 * ⚠️ **ES LA SEGUNDA VEZ, POR OTRA PUERTA.** La primera fue `TAB_POR_DEFECTO` —la
 * cadena `'inicio'`— pedida a `ribbon/catalogo.ts`, que importaba `ESQUEMA_LIBRETA`
 * y con él BlockNote entero. Se arregló sacando la identidad de las pestañas a
 * `ribbon/tabs.ts`. Esta es la misma forma: **una cosa chica y pura, alojada en un
 * archivo pesado, y un consumidor liviano que la pide.**
 *
 * 🔴 **`editor.ts` NO la re-exporta, a propósito** — igual que `catalogo.ts` no
 * re-exporta `TAB_POR_DEFECTO`. Ese puente sería la recaída, y sería igual de
 * invisible: el import se vería inocente y el grafo volvería a arrastrar el motor.
 * Quien la necesite, la pide acá.
 *
 * ⚠️ **El tipo se infiere y no se importa de BlockNote**: anotarlo con un tipo del
 * paquete reabre el mismo camino en el grafo de tipos, y `verbatimModuleSyntax` no
 * alcanza para garantizar que se borre.
 */
export function bloquesDeTexto(texto: string) {
  return texto.split('\n').map((linea) => ({
    type: 'paragraph' as const,
    content: linea === '' ? [] : [{ type: 'text' as const, text: linea, styles: {} }],
  }));
}
