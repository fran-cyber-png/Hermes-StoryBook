import { useState } from 'react';
import { Check, Copy, Loader2, Phone } from 'lucide-react';
import type { Conversacion } from '../../dominio/conversaciones';
import { ErrorApi } from '../../lib/datos/cliente';
import { abrirExterno } from '../../lib/enlacesExternos';
import { CLASE_RELLENO_HOVER, claseIconoNeon } from '../../lib/estiloNeon';
import { usePopover } from '../../lib/teclado/usePopover';
import { llamar as llamarPorWhatsapp } from '../llamadas/llamadaActual';
import { usePedirPermisoDeLlamada, usePermisoDeLlamada } from '../llamadas/permisoDeLlamada';
import { useLlamable, type MotivoNoLlamable } from '../llamadas/useLlamable';

/**
 * LLAMAR — por WhatsApp cuando se puede, con el `tel:` como red de seguridad (ADR 0123).
 *
 * 🔴 **Hasta el 14-sep-2026 este botón NO sabía que la llamada por WhatsApp existía.** El dueño lo
 * midió: en una conversación de Ventas Meta (Cloud API, canal whatsapp, con teléfono) tocó el
 * «Llamar» verde de la cabecera del hilo y le salió el marcador de macOS — la llamada por WhatsApp
 * que Hermes ya sabe hacer vive SOLO en `PanelLlamada` (la ficha de la derecha), y de ahí no se
 * ve. El botón tampoco decía POR QUÉ: ni una palabra sobre `/api/llamadas/activas` con
 * `activa=false`, la línea equivocada o el panel escondido.
 *
 * Con conversación, este botón usa la MISMA regla y las MISMAS consultas que `PanelLlamada`
 * (`useLlamable`, `usePermisoDeLlamada`, `usePedirPermisoDeLlamada` — mismas `queryKey`, se
 * invalidan juntas): si se puede llamar por WhatsApp, el clic llama por WhatsApp y el `tel:` ni se
 * intenta. Si no, hace lo de siempre — abre el marcador y ofrece copiar el número — pero el
 * popover agrega POR QUÉ fue el marcador y no WhatsApp.
 *
 * Sin conversación (la ficha de un contacto de campaña, la búsqueda de Personas: ninguna de las
 * dos tiene una conversación de Cloud API a mano) el botón se comporta EXACTAMENTE como antes de
 * esta regla: `tel:` y nada más.
 *
 * El `tel:` sigue siendo la red de seguridad en los dos casos: un botón que a veces no hace nada
 * es un botón roto, y acá el clic SIEMPRE contesta con algo — una llamada que arranca, o un
 * marcador con el motivo al lado.
 *
 * El ícono compacto (sin texto, #1077) usa `claseIconoNeon('success')` — el mismo reciclado que
 * `AgendarRapido` y `BarraGestion` — pero el `onClick` sigue siendo `tocarLlamar`: el estilo es
 * de un lado, la regla de llamar es del otro, y acá conviven los dos.
 */

const TEXTO_MOTIVO: Record<MotivoNoLlamable, string> = {
  consultando: 'Todavía estamos revisando si se puede llamar por WhatsApp.',
  sin_llamadas_para_ti: 'Tu usuario no tiene las llamadas activas.',
  otra_linea: 'Esta línea no tiene llamadas por WhatsApp.',
  sin_telefono: 'Esta conversación no tiene un teléfono para llamar.',
  es_lead: 'Este contacto es un lead sin chat.',
  error: 'No se pudo consultar.',
};

export function BotonLlamar({
  telefono,
  compacto = false,
  conversacion = null,
}: {
  telefono: string;
  compacto?: boolean;
  /** Con esto se sabe si HAY llamada por WhatsApp (ADR 0123). Sin esto, el botón es solo el `tel:` de siempre. */
  conversacion?: Conversacion | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const digitos = telefono.replace(/\D/g, '');

  const { llamable, motivo, telefono: telefonoWa } = useLlamable(conversacion);
  const permiso = usePermisoDeLlamada(conversacion?.clave ?? '', { habilitado: llamable });
  const pedir = usePedirPermisoDeLlamada(conversacion?.clave ?? '');

  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-30' });

  if (digitos.length < 8) return null;

  function tocarLlamar(e: React.MouseEvent) {
    e.stopPropagation();
    if (!llamable || !conversacion) {
      abrirExterno(`tel:+${digitos}`);
      setAbierto(true);
      return;
    }
    if (permiso.data?.puedeLlamar) {
      void llamarPorWhatsapp(conversacion.clave, telefonoWa);
      return;
    }
    // Sin permiso vigente: el primer toque lo pide (si Meta no lo tiene ya vetado); los
    // siguientes vuelven a preguntarle a Meta — es el "vuelve a tocar Llamar" del popover.
    if (pedir.isIdle && permiso.data?.puedePedir !== false) {
      pedir.mutate();
    } else if (!pedir.isIdle && !pedir.isPending) {
      void permiso.refetch();
    }
    setAbierto(true);
  }

  async function copiar(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(`+${digitos}`);
    setCopiado(true);
    window.setTimeout(() => {
      setCopiado(false);
      setAbierto(false);
    }, 1500);
  }

  // El estado en palabras cuando SÍ hay llamada por WhatsApp — nunca `null` mientras `llamable`,
  // así el popover jamás queda mudo (docblock de arriba).
  const textoWa = !llamable
    ? null
    : permiso.isPending
      ? 'Consultando si esta persona te dejó llamarla por WhatsApp…'
      : permiso.isError
        ? permiso.error instanceof ErrorApi
          ? permiso.error.message
          : 'No se pudo consultar el permiso de esta persona.'
        : permiso.data?.puedeLlamar
          ? 'Ya puedes llamarla: toca Llamar de nuevo.'
          : pedir.isPending
            ? 'Pidiéndole permiso para llamarla…'
            : pedir.isSuccess
              ? 'Le pedimos permiso para llamarlo; cuando acepte en su WhatsApp, vuelve a tocar Llamar.'
              : pedir.isError
                ? pedir.error instanceof ErrorApi
                  ? pedir.error.message
                  : 'No se pudo pedirle permiso.'
                : permiso.data?.puedePedir === false
                  ? 'Meta no deja volver a pedir permiso todavía: 1 pedido por día y 2 por semana.'
                  : 'Todavía no se le puede llamar por WhatsApp.';

  return (
    <span className="relative inline-flex">
      {compacto ? (
        <button
          type="button"
          aria-label="Llamar"
          title={`Llamar al +${digitos}`}
          onClick={tocarLlamar}
          className={claseIconoNeon('success')}
        >
          <Phone size={15} className={CLASE_RELLENO_HOVER} />
        </button>
      ) : (
        <button
          type="button"
          title={`Llamar al +${digitos}`}
          onClick={tocarLlamar}
          className="flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-[11px] font-semibold text-success-foreground shadow-sm transition-all duration-200 hover:shadow-[0_0_12px_rgba(22,163,74,0.6)] hover:brightness-110"
        >
          <Phone size={11} /> Llamar
        </button>
      )}

      {abierto && (
        <>
          <span {...propsOverlay} />
          <span
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-7 z-40 w-64 rounded-xl bg-card p-2.5 shadow-panel"
          >
            {textoWa ? (
              <span className="flex items-start gap-1.5">
                {permiso.isPending || pedir.isPending ? (
                  <Loader2 size={11} className="mt-0.5 shrink-0 animate-spin text-muted-foreground" />
                ) : null}
                <span className="text-[11px] leading-tight text-foreground">{textoWa}</span>
              </span>
            ) : (
              <>
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs font-semibold tabular-nums text-foreground">
                      +{digitos}
                    </span>
                    <span className="block text-[11px] leading-tight text-muted-foreground">
                      Si el marcador no se abrió, cópialo:
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={copiar}
                    className={
                      'flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ' +
                      (copiado ? 'bg-success/10 text-success' : 'bg-navy text-white hover:bg-navy/90')
                    }
                  >
                    {copiado ? <Check size={11} /> : <Copy size={11} />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                </span>
                {motivo ? (
                  <span className="mt-1.5 block text-[11px] leading-tight text-muted-foreground">
                    {TEXTO_MOTIVO[motivo]}
                  </span>
                ) : null}
              </>
            )}
          </span>
        </>
      )}
    </span>
  );
}
