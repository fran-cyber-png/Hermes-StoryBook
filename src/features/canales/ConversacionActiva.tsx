import { useQueryClient } from '@tanstack/react-query';
import { MessageSquareText } from 'lucide-react';
import { useEstadoConversacion, type Conversacion } from '../../dominio/conversaciones';
import { HiloWhatsapp, type SugerenciaEnComposer } from '../whatsapp/HiloWhatsapp';
import { HiloMessenger } from './HiloMessenger';
import ResponderPanel from './ResponderPanel';
import { ProximoSeguimiento } from '../agenda/ProximoSeguimiento';
import type { Interaccion } from './types';
import { useEfectoAlCambiar } from '../../lib/useEfectoAlCambiar';

/**
 * LA COLUMNA CENTRAL: la conversación abierta.
 *
 * Es un conmutador según qué se eligió en la cola:
 *   · WhatsApp  → el hilo nativo (`HiloWhatsapp`): ver y responder desde Hermes.
 *   · Comentario FB/IG → el flujo de respuesta pública + privada (`ResponderPanel`,
 *     que vive EN esta columna — dejó de ser un modal que tapaba la mesa).
 *   · Messenger → el hilo completo en lectura (`HiloMessenger`), con la caja
 *     deshabilitada honesta.
 *   · Nada      → un vacío que invita a elegir.
 */
export function ConversacionActiva({
  conversacion,
  onCerrar,
  sugerencia,
  miVendedora,
  onAbrirOtra,
  senales,
  esDeCampana,
  onVolver,
}: {
  conversacion: Conversacion | null;
  onCerrar: () => void;
  /**
   * EL CELULAR: volver a la lista de chats (11-sep-2026). El shell lo pasa
   * sólo cuando la lista y el chat no caben juntos; baja hasta la cabecera
   * del canal que corresponda (`CabeceraDeChat`), que dibuja la flecha con el
   * nombre del contacto. Sin esto no hay flecha. En escritorio no cambia nada.
   */
  onVolver?: () => void;
  /**
   * Quién está mirando. Baja hasta la `BarraGestion` para el reparto: sin esto,
   * «pasar la conversación» no puede decir «Vos» ni marcar cuál de los destinos
   * es quien está operando. Viaja como prop y no llamando a `useSesion()` acá
   * abajo a propósito — ese hook pide `/api/auth/yo` al montar, así que una
   * segunda llamada sería un request más por cada conversación que se abre.
   */
  miVendedora?: string | null;
  /** ¿De qué embudo es? Decide los peldaños de la barra (ADR 0063). */
  esDeCampana?: boolean;
  /**
   * MODO REVISIÓN (ADR 0018): la auto-respuesta que Hermes preparó para ESTA
   * conversación, para que el composer la muestre como borrador aprobable.
   * Viaja como prop y no por contexto a propósito — así se lee, en el shell,
   * quién decide que hay algo que revisar.
   */
  sugerencia?: SugerenciaEnComposer;
  /** Abrir el chat del contacto que ya estaba registrado (duplicado). */
  onAbrirOtra?: (o: { clave: string; telefono: string | null }) => void;
  /**
   * LOS ATAJOS DE LA BARRA, como contadores. Los maneja el shell (es donde vive
   * el teclado global) y bajan hasta el control que abren: `R` el registro
   * rápido, `E` la etapa, `T` las etiquetas, `A` agendar.
   *
   * ⚠️ **`N` (anotar) NO está acá**: desde que el chip «Notas» se fue de la
   * barra, esa señal va derecho al `PanelDerecho`, que es donde quedó el único
   * botón que la consume. El shell la manda por el otro lado.
   */
  senales?: { registrar: number; estado: number; etiqueta: number; agendar: number };
}) {
  const qc = useQueryClient();

  // Avanzar el cursor de lectura al abrir el hilo, CROSS-CANAL (#49): marca la
  // conversación como leída (el punto azul se apaga) para todos los canales, no
  // solo WhatsApp. Los ticks azules de WhatsApp son un efecto lateral aparte
  // (`useConversacionWa.marcarLeido`). Es una escritura por acción humana: abrir.
  const estado = useEstadoConversacion();
  const clave = conversacion?.clave ?? null;
  useEfectoAlCambiar([clave], () => {
    if (!clave) return;
    estado.mutate({ clave, leido: true });
    // Solo al cambiar de conversación: `estado` es estable entre renders.
  });

  if (!conversacion) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <MessageSquareText size={28} className="mb-3 text-muted-foreground/50" />
        <p className="text-sm font-semibold text-foreground">Elige a alguien de la cola</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Su conversación aparece acá, con la ficha al lado para saber quién es antes de escribir.
        </p>
      </div>
    );
  }

  /**
   * ══ LOS CUATRO CANALES, LA MISMA ANATOMÍA (08-sep-2026, pedido del dueño) ══
   *
   * Hasta acá WhatsApp era el único con la barra de gestión ADENTRO de su
   * cabecera (07-sep-2026): Messenger y los comentarios de FB/IG —y el
   * Formulario, que cae en la rama de Messenger más abajo— seguían con DOS
   * tarjetas apiladas, `BarraGestion` sola arriba (`conBarra`, que vivía acá)
   * y el hilo con su PROPIA cabecera, más angosta, debajo. El pedido fue
   * parejo: los cuatro con la misma fila única — ver `CabeceraDeChat`, que
   * `HiloWhatsapp`, `HiloMessenger` y `ResponderPanel` montan cada uno con su
   * propio avatar/subtítulo. `conBarra` ya no hace falta: cada componente
   * recibe directo los props de la barra y los embebe.
   *
   * `ProximoSeguimiento` se queda AFUERA de la tarjeta en los cuatro, igual
   * que ya estaba para WhatsApp: es «lo que se debe», no parte del chat.
   */
  /**
   * En el celular el chat ocupa la pantalla entera (cada hilo se vuelve
   * `fixed` por debajo de `md`, ver `HiloWhatsapp`), así que «lo que se
   * debe» no tiene dónde ir sin robarle alto al hilo: se esconde. El
   * envoltorio es `contents` a propósito — sin caja propia, para no meterle
   * un `gap` vacío a la columna de escritorio cuando no hay seguimiento.
   */
  const conProximoSeguimiento = (contenido: React.ReactNode) => (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="contents max-md:hidden">
        <ProximoSeguimiento clave={conversacion.clave} />
      </div>
      <div className="min-h-0 flex-1">{contenido}</div>
    </div>
  );

  // WhatsApp: el hilo nativo. La razón de ser de este panel.
  if (conversacion.canal === 'whatsapp') {
    return conProximoSeguimiento(
      <HiloWhatsapp
        conversacion={conversacion}
        sugerencia={sugerencia}
        miVendedora={miVendedora}
        onAbrirOtra={onAbrirOtra}
        esDeCampana={esDeCampana}
        senales={senales}
        onVolver={onVolver}
      />,
    );
  }

  // Comentario de Facebook/Instagram: el flujo de respuesta pública + privada, que
  // ya estaba resuelto (privado antes que público). Se reusa tal cual.
  if (conversacion.tipo === 'comentario') {
    const inter: Interaccion = {
      id: Number(conversacion.clave.replace('int:', '')),
      canal: conversacion.canal,
      tipo: 'comentario',
      persona_nombre: conversacion.persona_nombre,
      texto: conversacion.texto,
      contexto_texto: conversacion.contexto_texto,
      occurred_at: conversacion.referencia,
      status: conversacion.respondida ? 'contactado' : 'nuevo',
      pide_info: conversacion.pregunto,
      ventana_abierta: conversacion.ventana_abierta,
      dias: conversacion.dias,
    };
    return conProximoSeguimiento(
      <ResponderPanel
        interaccion={inter}
        conversacion={conversacion}
        miVendedora={miVendedora}
        esDeCampana={esDeCampana}
        onAbrirOtra={onAbrirOtra}
        senales={senales}
        onVolver={onVolver}
        onCerrar={onCerrar}
        onRespondido={() => void qc.invalidateQueries({ queryKey: ['conversaciones'] })}
      />,
    );
  }

  // Messenger (canal Meta, tipo mensaje) y Formulario (tipo lead, sin canal
  // propio de Meta): el hilo completo, en lectura.
  return conProximoSeguimiento(
    <HiloMessenger
      conversacion={conversacion}
      miVendedora={miVendedora}
      esDeCampana={esDeCampana}
      onAbrirOtra={onAbrirOtra}
      senales={senales}
      onVolver={onVolver}
    />,
  );
}
