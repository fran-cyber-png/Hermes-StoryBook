import { Columns2 } from 'lucide-react';
import { TituloEditable } from './TituloEditable';
import type { Nota } from './notas';

/**
 * QUÉ SE PUEDE HACER CON UNA PÁGINA ABIERTA — nombrar un documento y dividir
 * pantalla.
 *
 * ⚠️ **Hasta el 04-sep-2026 acá vivían también «Mover» y «Compartir con
 * link»** (ADR 0047): la razón de entonces era que esas dos acciones se
 * decidían «con la página a la vista, después de leer lo que dice». A pedido
 * explícito del dueño se mudaron al menú `⋮` de la fila (`MenuDeFila.tsx`,
 * ver ADR 0093): se pueden mover o compartir sin abrir la página primero, y
 * «Compartir con link» pasó a llamarse, a secas, «Compartir». Lo que queda
 * acá es lo que de verdad necesita la página ABIERTA a la vista — nombrar un
 * documento (mira su propio contenido) y dividir pantalla (arma el panel de
 * al lado).
 */
export function AccionesDePagina({
  nota,
  dividiendo,
  onTocarDividir,
  onCortarDivision,
  onRenombrar,
}: {
  nota: Nota;
  /**
   * ¿HAY UNA PANTALLA DIVIDIDA A LA VISTA AHORA MISMO? No es lo mismo que
   * `nota.paginaDivididaId`: esto también es `true` mientras se está ELIGIENDO
   * con qué dividir (el server todavía no confirmó nada). El botón necesita
   * ESTO para ser un toggle de verdad — «Dividir pantalla» tiene que volver a
   * una sola pantalla en cualquiera de los dos momentos, no solo después de
   * persistida (ver `Libreta.tsx`).
   */
  dividiendo: boolean;
  /** Abre el selector de la pantalla dividida, en el panel de al lado. */
  onTocarDividir: () => void;
  /** Cierra la pantalla dividida — eligiendo o ya persistida, las dos. */
  onCortarDivision: () => void;
  /**
   * NOMBRAR UN DOCUMENTO (19-ago-2026, ampliado 26-ago-2026). Un archivo
   * adjuntado no tiene «primera línea de texto» de la que sacar un título
   * solo —nace con el nombre del archivo, que puede no ser el que la
   * vendedora quiere ver en su lista—, así que es la única clase que
   * necesita ponerlo a mano. Manda `texto` por el mismo `PATCH /api/notas/:id`
   * que ya usa todo lo demás — el server no distingue por `tipo` al editar,
   * ver `editarNota`.
   */
  onRenombrar: (texto: string) => void;
}) {
  return (
    // 🔴 SIN `mb-4` PROPIO (19-ago-2026): el espacio antes de la hoja lo pone
    // el wrapper de `Libreta.tsx`/`PantallaDividida.tsx` (`pb-4`), para que
    // las dos cabeceras —esta y la de la mitad derecha en la pantalla
    // dividida— midan EXACTO lo mismo y sus hojas A4 arranquen a la misma
    // altura. `min-h-7` es la otra mitad de ese acuerdo: el renglón mide lo
    // mismo tenga botones (con borde, más altos) o solo texto.
    <div className="flex min-h-7 flex-wrap items-center gap-1.5">
      {/* NOMBRAR EL DOCUMENTO — la clase de página sin un primer renglón de
          texto del que sacar un título solo. `flex-1` para que empuje los
          botones a la derecha, como el título de la mitad derecha en la
          pantalla dividida. */}
      {nota.tipo === 'archivo' && (
        <TituloEditable valor={nota.texto} placeholder="Nombra el documento" onGuardar={onRenombrar} />
      )}

      {/*
        `ml-auto` (26-ago-2026): una página de TEXTO no tiene título acá (nace
        de la primera línea, no de este campo), así que sin esto el botón se
        quedaba pegado al borde IZQUIERDO en una página de texto y saltaba al
        borde DERECHO en un documento.
      */}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {/*
          DIVIDIR PANTALLA (17-ago-2026). Un TOGGLE, y de verdad: un segundo
          toque vuelve a una sola pantalla desde CUALQUIER momento de la
          división —eligiendo con qué, o ya persistida— porque los dos se leen
          en `dividiendo`, no solo `nota.paginaDivididaId` (antes el botón se
          quedaba mudo mientras se elegía: un segundo toque no hacía nada, y
          solo la ✕ de adentro del panel cerraba). Sin nada abierto, ABRE el
          selector en el panel de al lado (vive en `Libreta.tsx`, no acá: es
          una columna entera, no un dropdown de 19rem).
        */}
        <button
          type="button"
          onClick={() => (dividiendo ? onCortarDivision() : onTocarDividir())}
          aria-pressed={dividiendo}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
            dividiendo
              ? 'border-primary bg-secondary text-foreground'
              : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Columns2 className="size-3.5" />
          {dividiendo ? 'Pantalla dividida' : 'Dividir pantalla'}
        </button>
      </div>
    </div>
  );
}
