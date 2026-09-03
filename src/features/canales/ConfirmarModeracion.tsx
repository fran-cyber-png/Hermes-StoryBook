import { useEffect, useRef } from 'react';
import { EyeOff, Trash2, X } from 'lucide-react';
import { useEscape } from '../../lib/teclado/useEscape';

/**
 * ¿SEGURO? — la confirmación de ocultar y de borrar (fase 10 del rediseño).
 *
 * ══ POR QUÉ UN MODAL PROPIO, Y NO EL `confirm()` DEL NAVEGADOR ══════════════
 *
 * La guía del proyecto prohíbe los diálogos nativos: bloquean el hilo y en la
 * cáscara de escritorio se ven ajenos. Eso NO prohíbe un modal propio — que es
 * lo que la fase 10 pide, con overlay, Escape y foco.
 *
 * ⚠️ **Reemplaza a la confirmación en el propio botón** («¿Seguro? Eliminar»),
 * que estuvo vivo unas horas. Aquella tenía una debilidad que este modal cierra:
 * el segundo clic caía en el MISMO lugar de la pantalla que el primero, así que
 * un doble clic apurado borraba sin que nadie leyera nada. Acá el botón que
 * confirma está en otro lado y dice qué va a pasar.
 *
 * ══ 🔴 LOS DOS TEXTOS SON DISTINTOS PORQUE LOS DOS HECHOS SON DISTINTOS ═════
 *
 * Borrar es definitivo; ocultar es reversible y **el comentario le sigue
 * apareciendo a quien lo escribió y a sus amigos**. Confundirlos es cómo alguien
 * usa ocultar creyendo que borra —o al revés, borra creyendo que puede volver
 * atrás—, y por eso la descripción de cada uno dice exactamente qué queda
 * después, no sólo qué se hace.
 */

export type QueConfirmar = 'ocultar' | 'eliminar';

const TEXTOS: Record<
  QueConfirmar,
  { titulo: string; descripcion: string; confirmar: string; icono: typeof Trash2; destructivo: boolean }
> = {
  eliminar: {
    titulo: '¿Eliminar comentario?',
    descripcion:
      'Esta acción eliminará permanentemente el comentario de Facebook. No se puede deshacer, ni desde acá ni desde la publicación.',
    confirmar: 'Eliminar',
    icono: Trash2,
    destructivo: true,
  },
  ocultar: {
    titulo: '¿Ocultar comentario?',
    descripcion:
      'El comentario dejará de ser visible públicamente en Facebook, pero permanecerá disponible en tu CRM. Quien lo escribió lo va a seguir viendo, así que no se entera de que lo ocultaste.',
    confirmar: 'Ocultar comentario',
    icono: EyeOff,
    destructivo: false,
  },
};

export default function ConfirmarModeracion({
  que,
  onCancelar,
  onConfirmar,
}: {
  que: QueConfirmar;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const t = TEXTOS[que];
  const Icono = t.icono;
  const cancelar = useRef<HTMLButtonElement>(null);

  useEscape(onCancelar);

  /**
   * 🔴 **EL FOCO ARRANCA EN «CANCELAR», NO EN LA ACCIÓN.** Un modal que se abre
   * con el botón destructivo enfocado convierte un Enter de inercia —el mismo
   * con el que se venía escribiendo— en un borrado. Es la razón por la que este
   * modal existe: mover la confirmación lejos del gesto que la disparó.
   */
  useEffect(() => {
    cancelar.current?.focus();
  }, []);

  const base =
    'rounded-xl px-3.5 py-2 text-sm font-bold transition-transform duration-200 ease-house ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 active:scale-[0.98]';

  return (
    <>
      {/* El overlay bloquea el fondo y cierra al tocarlo, como el resto de la app. */}
      <div
        className="fixed inset-0 z-40 bg-navy/30 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in"
        onClick={onCancelar}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmar-moderacion-titulo"
          className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-panel"
        >
          <header className="flex items-start justify-between gap-3 p-5 pb-0">
            <div className="flex items-start gap-2.5">
              <span
                className={
                  'flex size-9 shrink-0 items-center justify-center rounded-xl ' +
                  (t.destructivo ? 'bg-destructive/10 text-destructive' : 'bg-gold/20 text-gold-ink')
                }
              >
                <Icono size={17} />
              </span>
              <h2
                id="confirmar-moderacion-titulo"
                className="mt-1 font-heading text-base font-bold text-foreground"
              >
                {t.titulo}
              </h2>
            </div>
            <button
              type="button"
              onClick={onCancelar}
              title="Cerrar"
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
            >
              <X size={16} />
            </button>
          </header>

          <p className="px-5 pt-2 text-sm leading-relaxed text-muted-foreground">{t.descripcion}</p>

          <footer className="flex justify-end gap-2 p-5">
            <button
              ref={cancelar}
              type="button"
              onClick={onCancelar}
              className={`${base} border border-border bg-card text-foreground hover:bg-muted`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirmar}
              className={
                base +
                ' text-white ' +
                (t.destructivo
                  ? 'bg-destructive hover:opacity-90'
                  : 'bg-primary hover:bg-primary-hover')
              }
            >
              {t.confirmar}
            </button>
          </footer>
        </div>
      </div>
    </>
  );
}
