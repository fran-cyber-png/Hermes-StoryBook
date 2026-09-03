import { useRef, useState } from 'react';

/**
 * UN TÍTULO QUE SE EDITA IN-PLACE — el mismo molde que ya usa `Miembros`
 * (`SelectorDeEspacio.tsx`) para renombrar un espacio: guarda al perder el
 * foco o con Enter, Escape descarta. Se reusa acá para nombrar un DIAGRAMA
 * (`AccionesDePagina.tsx`, `PantallaDividida.tsx`) — la única clase de
 * página sin un «primer renglón de texto» del que sacar un título solo.
 *
 * ⚠️ VACÍO NO GUARDA. Un texto en blanco no pasa `validarTexto` del lado del
 * server (400), así que ni se manda: el campo vuelve solo al valor anterior,
 * igual que cancelar.
 *
 * ⚠️ SIGUE A `valor` MIENTRAS NO ESTÁ ENFOCADO, comparado EN EL RENDER (la
 * misma técnica que `clavePreviaDeHoja` en `Libreta.tsx`) y no en un
 * `useEffect`: un efecto corre DESPUÉS de pintar, y un `valor` que llega
 * mientras el campo está enfocado —otra pestaña, otra persona del espacio—
 * pisaría la letra que se está tecleando en ese instante si no estuviera la
 * guarda de `enfocado`.
 */
export function TituloEditable({
  valor,
  placeholder,
  onGuardar,
  className,
  autoFocus,
  onTerminar,
}: {
  valor: string;
  placeholder: string;
  onGuardar: (nuevo: string) => void;
  className?: string;
  /** Arranca enfocado y con todo seleccionado — para cuando ESTE campo es la
   * razón por la que algo se mostró (el botón «Editar» de una fila), no un
   * campo que ya estaba a la vista. */
  autoFocus?: boolean;
  /** Se dispara al perder el foco, guarde o no — para que quien lo muestra
   * condicionalmente (el botón «Editar» de `FilaPagina`) sepa cuándo volver
   * a esconderlo. Separado de `onGuardar`: ESE solo avisa cuando hay un
   * nombre nuevo de verdad. */
  onTerminar?: () => void;
}) {
  const [texto, setTexto] = useState(valor);
  const valorPrevio = useRef(valor);
  const enfocado = useRef(false);
  if (valorPrevio.current !== valor) {
    valorPrevio.current = valor;
    if (!enfocado.current) setTexto(valor);
  }

  return (
    <input
      autoFocus={autoFocus}
      onFocusCapture={(e) => autoFocus && e.currentTarget.select()}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onFocus={() => {
        enfocado.current = true;
      }}
      onBlur={() => {
        enfocado.current = false;
        const limpio = texto.trim();
        if (limpio && limpio !== valor) onGuardar(limpio);
        else setTexto(valor);
        onTerminar?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        // Escape descarta y NO se propaga: el shell no tiene por qué
        // enterarse de que alguien se arrepintió de un nombre.
        if (e.key === 'Escape') {
          e.stopPropagation();
          setTexto(valor);
          e.currentTarget.blur();
        }
      }}
      placeholder={placeholder}
      aria-label={placeholder}
      className={
        className ??
        'h-7 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 text-sm font-medium text-foreground outline-none hover:border-input focus:border-ring'
      }
    />
  );
}
