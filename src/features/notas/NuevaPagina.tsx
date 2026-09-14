import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileText, Loader2, Paperclip, Plus } from 'lucide-react';
import { ACEPTA_DOCUMENTOS } from './documentos';

/**
 * EL BOTÓN DE «NUEVA PÁGINA» — con DOS formas de empezar (26-ago-2026), no
 * solo la de texto en blanco: «Adjuntar documento» arranca de acá también.
 *
 * ══ BOTÓN DIVIDIDO, NO UN MENÚ QUE SE ABRE SIEMPRE ═══════════════════════
 *
 * El clic PRINCIPAL sigue creando una página en blanco en el acto —es lo que
 * ya hacía, y sigue siendo lo más común—; la flechita al lado abre la otra
 * opción. Un menú que se abre SIEMPRE (nunca crea directo) le agrega un
 * clic extra a lo más usado para no agregárselo a lo menos usado.
 *
 * ══ EL DISEÑO DE FICHA (03-sep-2026) ═════════════════════════════════════
 *
 * Pedido con una captura de referencia: insignia cuadrada con el «+» y
 * texto — reemplaza al botón azul ancho de antes. La píldora del atajo
 * («Ctrl+N») que trajo la primera vuelta se sacó a pedido explícito: era
 * decorativa (Ctrl+N/⌘N son del navegador/sistema operativo, y
 * `esAtajoLibreta` en `notas.ts` los excluye a propósito) y competía por el
 * mismo ancho angosto que el propio texto del botón. La flechita del menú
 * secundario se mantiene: sacarla habría sido borrar «Adjuntar documento»
 * sin que nadie lo pidiera.
 */

export function NuevaPagina({
  onNueva,
  onDocumento,
  subiendoDocumento,
  errorDocumento,
}: {
  onNueva: () => void;
  /** El archivo tal cual lo eligió el `<input type="file">` — subirlo es cosa de quien llama. */
  onDocumento: (archivo: File) => void;
  /** Mientras el documento sube y la página se crea: deshabilita el menú para no disparar dos subidas pisadas. */
  subiendoDocumento: boolean;
  /** El motivo del último fallo al adjuntar, o `null`. Vive afuera: sobrevive a que este menú se cierre. */
  errorDocumento: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);

  // Cerrar al tocar afuera — mismo molde que `PanelDeCapas.tsx`.
  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', afuera, true);
    return () => document.removeEventListener('pointerdown', afuera, true);
  }, [abierto]);

  return (
    // `px-2 py-2` — EL MISMO padding que el envoltorio de `SelectorDeEspacio.tsx`
    // (`<div className="px-2 py-2">`, justo abajo en el riel): con `p-3` de
    // antes el botón quedaba unos píxeles más adentro que "Mi libreta" y
    // "Todas las páginas" — dos insets distintos para la misma columna. Ahora
    // el borde del botón cae exactamente donde cae el de esas filas.
    <div className="px-2 py-2">
      <div ref={caja} className="relative flex rounded-lg border border-border bg-card">
        {/* ⚠️ Un solo borde en el ENVOLTORIO, no uno por botón — con w-56 (el
            mismo ancho que "Mi libreta" abajo, ver `Libreta.tsx`) dos bordes
            propios más el relleno de cada botón no dejaban lugar para
            "Nueva página" entero: se leía "Nuev…" cortado a la mitad. */}
        <button
          type="button"
          onClick={onNueva}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-l-lg px-2.5 py-2 text-left transition hover:bg-muted"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Plus className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">Nueva página</span>
        </button>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-label="Más formas de crear una página"
          aria-expanded={abierto}
          disabled={subiendoDocumento}
          className="flex shrink-0 items-center rounded-r-lg border-l border-border px-2 text-muted-foreground transition hover:bg-muted disabled:opacity-60"
        >
          {subiendoDocumento ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5" />}
        </button>

        {abierto && (
          // `w-full` (03-sep-2026, antes `w-56`) — el mismo ancho que ESTA
          // caja (`caja`, el envoltorio de arriba), no un valor aparte: con
          // `w-56` el menú se salía unos píxeles a la derecha del botón —
          // y del riel, que tiene el mismo ancho — reportado con una
          // captura como que "el contenedor está sobresaliendo por un lado".
          <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-border bg-card p-1 shadow-lg">
            
            <button
              type="button"
              onClick={() => inputArchivo.current?.click()}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
            >
              <Paperclip className="size-4 shrink-0 text-muted-foreground" />
              Adjuntar documento
            </button>
            <p className="px-2 pb-1 pt-0.5 text-[0.6875rem] text-muted-foreground">PDF, Word (.docx) o texto (.txt)</p>
          </div>
        )}
      </div>

      {/* El selector de archivos vive SIEMPRE montado (no solo con el menú
          abierto): el cambio dispara `onDocumento` recién cuando el usuario
          ya eligió un archivo del diálogo del sistema operativo, que puede
          tardar — para entonces el menú de arriba ya se cerró solo. */}
      <input
        ref={inputArchivo}
        type="file"
        aria-label="Elegir documento"
        accept={ACEPTA_DOCUMENTOS}
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          // Se limpia el valor SIEMPRE, elija o cancele: sin esto, adjuntar el
          // MISMO archivo dos veces seguidas no dispara `onChange` la segunda vez.
          e.target.value = '';
          setAbierto(false);
          if (archivo) onDocumento(archivo);
        }}
      />

      {errorDocumento && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
          <FileText className="size-3.5 shrink-0" />
          {errorDocumento}
        </p>
      )}
    </div>
  );
}
