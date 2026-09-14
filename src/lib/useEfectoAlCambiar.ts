import { useEffect, useRef } from 'react';

/**
 * ══ CORRE ESTE EFECTO SÓLO CUANDO CAMBIEN ESTAS CLAVES ══════════════════════
 *
 * Es `useEffect` con las dependencias que el autor eligió a mano, **y sin el
 * `eslint-disable` que eso obliga a escribir**. Nada más. La semántica es
 * idéntica: el efecto corre cuando cambia alguna clave, y el cuerpo que corre
 * es el del render vigente.
 *
 * ── 🔴 POR QUÉ EXISTE, MEDIDO (8-sep-2026) ─────────────────────────────────
 *
 * Un `// eslint-disable-next-line react-hooks/exhaustive-deps` adentro de un
 * componente hace que **React Compiler abandone ese componente entero**, en
 * silencio y sin salida en el build. El mensaje exacto que emite el plugin:
 *
 *   «React Compiler has skipped optimizing this component because one or more
 *    React ESLint rules were disabled.»
 *
 * Corrido sobre los 399 componentes del repo, eso saltaba **20**, y entre ellos
 * los más calientes que hay: `AppAutenticada` —o sea el shell entero, del que
 * cuelgan la Bandeja siempre montada y la vista abierta—, `ColaUnificada`,
 * `ConversacionActiva`, `BarraFiltros` y `PasarConversacion`, que se monta **una
 * vez por fila del radar**. Sin memoización, cada render del padre rehace el
 * trabajo de todos.
 *
 * ⚠️ **La supresión no se borra: se MUDA acá.** Las dependencias recortadas de
 * esos efectos son decisiones deliberadas y documentadas («solo al montar», «no
 * revalidar en cada cambio de vista»); completarlas cambiaría el comportamiento,
 * que es exactamente lo que este frente no quiere tocar. Lo que se gana es que
 * la supresión viva en un archivo de veinte líneas al que el compilador puede
 * saltar sin que a nadie le importe, en vez de adentro de un componente de mil.
 *
 * ⚠️ **`claves` se lee como un array de dependencias de verdad**: tiene que ser
 * estable en LARGO entre renders, igual que en `useEffect`. Este helper no lo
 * puede verificar y el linter tampoco — es el precio de mudar la supresión, y
 * por eso el helper no se usa para escribir efectos nuevos, sino para los que ya
 * tenían la decisión tomada.
 */
export function useEfectoAlCambiar(claves: readonly unknown[], efecto: () => void | (() => void)): void {
  const ultimo = useRef(efecto);

  // Sin lista de dependencias: corre después de CADA render, y siempre antes
  // que el de abajo (React los dispara en orden de declaración). Así el cuerpo
  // que se ejecuta es el del render vigente, que es justo lo que hacía el
  // `useEffect` con dependencias recortadas que este helper reemplaza.
  useEffect(() => {
    ultimo.current = efecto;
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => ultimo.current(), claves);
}
