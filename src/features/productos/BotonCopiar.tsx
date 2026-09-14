import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * COPIAR UN TEXTO PARA PEGARLO EN EL CHAT — el gesto de toda la vista Productos.
 *
 * Copiar no es enviar: la vendedora lo pega, lo lee y lo manda ella (la regla de
 * #45). Por eso Productos no tiene un «Mandar»: medido el 10-sep-2026, la vista se
 * abre unas 4 veces al día y no sale ni un envío de ahí, así que es una vista de
 * CONSULTA (ADR 0106, D6).
 *
 * `principal` es la ÚNICA acción primaria de la pantalla («Copiar precio para el
 * chat», en la hoja). En la tarjeta y en los datos por país el mismo gesto va como
 * botón secundario.
 *
 * ⚠️ «Copiado» se dice sólo si el portapapeles aceptó: sin permiso, `writeText`
 * rechaza, y decir «Copiado» sin haberlo hecho es peor que no decir nada.
 */
export function BotonCopiar({
  texto,
  rotulo,
  principal = false,
  descripcion,
}: {
  texto: string;
  rotulo: string;
  principal?: boolean;
  /** Para lectores de pantalla, cuando el rótulo solo no dice QUÉ se copia. */
  descripcion?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 1600);
    return () => clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles: el botón no miente con un «Copiado».
    }
  }

  const Icono = copiado ? Check : Copy;
  return (
    <button
      type="button"
      onClick={() => void copiar()}
      title={texto}
      aria-label={descripcion}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 font-semibold transition-[background-color,border-color,transform] duration-200 active:translate-y-px',
        principal
          ? 'h-11 w-full rounded-xl bg-primary text-sm text-primary-foreground hover:bg-primary/90'
          : 'h-8 rounded-lg border border-border bg-card px-2.5 text-[11px] text-foreground hover:border-primary/40 hover:bg-secondary',
        copiado && !principal && 'border-success/40 text-success',
      )}
    >
      <Icono size={principal ? 16 : 13} aria-hidden />
      {copiado ? 'Copiado' : rotulo}
    </button>
  );
}
