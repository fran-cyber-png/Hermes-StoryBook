import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileText, Loader2, Paperclip, Plus, Workflow } from 'lucide-react';
import { ACEPTA_DOCUMENTOS } from './documentos';

/**
 * EL BOTÓN DE «NUEVA PÁGINA» — ahora con TRES formas de empezar (26-ago-2026),
 * no solo la de texto en blanco. Antes «Diagrama» solo se podía crear desde
 * adentro de «Pantalla dividida» (`PantallaDividida.tsx`), un camino escondido
 * que nadie encontraba sin ya estar dividiendo pantalla; «Adjuntar documento»
 * no existía. Los tres arrancan de acá ahora.
 *
 * ══ BOTÓN DIVIDIDO, NO UN MENÚ QUE SE ABRE SIEMPRE ═══════════════════════════
 *
 * El clic PRINCIPAL sigue creando una página en blanco en el acto —es lo que
 * ya hacía, y sigue siendo lo más común—; la flechita al lado abre las otras
 * dos opciones. Un menú que se abre SIEMPRE (nunca crea directo) le agrega un
 * clic extra a lo más usado para no agregárselo a lo menos usado.
 */

export function NuevaPagina({
  onNueva,
  onDiagrama,
  onDocumento,
  subiendoDocumento,
  errorDocumento,
}: {
  onNueva: () => void;
  onDiagrama: () => void;
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
    <div className="p-3">
      <div ref={caja} className="relative flex">
        <button
          type="button"
          onClick={onNueva}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-l-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
        >
          <Plus className="size-4" />
          Nueva página
        </button>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-label="Más formas de crear una página"
          aria-expanded={abierto}
          disabled={subiendoDocumento}
          className="flex items-center rounded-r-lg border-l border-primary-hover bg-primary px-2 text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60"
        >
          {subiendoDocumento ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
        </button>

        {abierto && (
          <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                onNueva();
                setAbierto(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
            >
              <Plus className="size-4 shrink-0 text-muted-foreground" />
              Página en blanco
            </button>
            <button
              type="button"
              onClick={() => {
                onDiagrama();
                setAbierto(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted"
            >
              <Workflow className="size-4 shrink-0 text-muted-foreground" />
              Diagrama
            </button>
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
