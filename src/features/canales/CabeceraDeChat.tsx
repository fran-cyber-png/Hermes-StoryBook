import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BarraGestion } from '../gestion/BarraGestion';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * LA CABECERA DE UNA CONVERSACIÓN ABIERTA — una sola fila, en los CUATRO canales.
 *
 * ══ POR QUÉ EXISTE (08-sep-2026, pedido del dueño) ══════════════════════════
 *
 * `HiloWhatsapp` estrenó esta anatomía el 07-sep-2026 (avatar + nombre + un
 * dato de contacto a la izquierda, `<BarraGestion embebida>` a la derecha, todo
 * en UNA fila dentro de la misma tarjeta) y quedó mejor que lo que tenían
 * Messenger y los comentarios de FB/IG: dos tarjetas apiladas, una para
 * `BarraGestion` y otra —con su PROPIA cabecera, más angosta y sin gestión—
 * para el hilo. El pedido fue parejo: la misma anatomía para los cuatro.
 *
 * Se factoriza ACÁ y no se copia tres veces (#37): `HiloWhatsapp`, `HiloMessenger`
 * y `ResponderPanel` (Facebook/Instagram, y el default de Formulario) importan
 * esto en vez de llevar cada uno su propio `<header>`. Lo único que cambia entre
 * ellos es el AVATAR (foto real solo en WhatsApp) y el dato bajo el nombre
 * (teléfono / «red · cuándo» / «Messenger · N mensajes») — eso se recibe como
 * prop, el resto es idéntico.
 *
 * ⚠️ **`conversacion` es la `Conversacion` ENTERA, no el tipo recortado que
 * `ResponderPanel` arma para sí mismo (`Interaccion`, en `types.ts`).**
 * `BarraGestion` necesita `clave`/`persona_id`/`numero_propio`, que `Interaccion`
 * no lleva — por eso quien abre la cabecera le pasa las dos cosas por separado
 * cuando corresponde.
 */
export function CabeceraDeChat({
  avatar,
  nombre,
  subtitulo,
  extra,
  onVolver,
  conversacion,
  miVendedora,
  esDeCampana,
  onAbrirOtra,
  senales,
}: {
  /**
   * EN EL CELULAR, LA FLECHA DE VOLVER A LA LISTA (11-sep-2026).
   *
   * En un ancho de teléfono la lista de chats y el chat abierto no caben
   * juntos: el shell monta uno u otro y pasa esto para poder volver. Con la
   * prop, el bloque de avatar + nombre pasa a ser UN botón con la flecha
   * adelante —como en WhatsApp, donde tocar el nombre también vuelve— y sólo
   * por debajo de `md`: en escritorio el botón no se dibuja (`md:hidden`) y el
   * bloque de siempre sigue tal cual. Sin la prop no existe la flecha: en
   * escritorio la lista está al lado y un botón que no lleva a ningún lado es
   * peor que ninguno. Candado: `volverEnCelular.test.tsx`.
   */
  onVolver?: () => void;
  /** El avatar ya armado — `<Avatar conFoto>` en WhatsApp, iniciales en los demás. */
  avatar: ReactNode;
  nombre: ReactNode;
  /** El dato bajo el nombre: teléfono, «red · cuándo» o «Messenger · N mensajes». */
  subtitulo: ReactNode;
  /**
   * Lo que va PEGADO al bloque de nombre, antes de `BarraGestion` — la píldora
   * de «quién lo atiende» en WhatsApp (ADR 0083), el chip Comentario/Mensaje en
   * `ResponderPanel`. `undefined` = nada, como en `HiloMessenger`.
   */
  extra?: ReactNode;
  conversacion: Conversacion;
  miVendedora?: string | null;
  esDeCampana?: boolean;
  onAbrirOtra?: (o: { clave: string; telefono: string | null }) => void;
  senales?: { registrar: number; estado: number; etiqueta: number; agendar: number };
}) {
  return (
    // En el celular la fila NO se parte: la barra de gestión se desliza a lo
    // ancho (`overflow-x-auto`) y el bloque de volver + nombre queda fijo a la
    // izquierda (`sticky`), como la cabecera de WhatsApp. Partida en dos filas
    // se comía un tercio de la pantalla y el último botón quedaba cortado.
    <header className="flex min-h-[3.25rem] shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-1.5 max-md:flex-nowrap max-md:gap-x-2 max-md:overflow-x-auto max-md:px-2 max-md:[scrollbar-width:none]">
      {onVolver && (
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver a la lista"
          // 44 px de alto para el dedo (`min-h-11`), y `-ml-1` para que la
          // flecha quede al ras del borde sin correr el resto de la fila.
          className="sticky left-0 z-10 -ml-1 flex min-h-11 max-w-[60%] min-w-0 shrink-0 items-center gap-1.5 rounded-xl bg-card pr-2 text-left active:bg-muted md:hidden"
        >
          <ArrowLeft size={22} className="shrink-0 text-navy-ink" aria-hidden />
          {avatar}
          <span className="min-w-0">
            <span className="block truncate font-heading text-sm font-bold text-foreground">{nombre}</span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">{subtitulo}</span>
          </span>
        </button>
      )}
      <span className={'flex shrink-0 items-center gap-2.5' + (onVolver ? ' max-md:hidden' : '')}>
        {avatar}
        <div className="min-w-0">
          <div className="truncate font-heading text-sm font-bold text-foreground">{nombre}</div>
          {/* Sin `font-mono`/`tabular-nums` acá: eso solo tiene sentido para el
              teléfono de WhatsApp, y quien lo necesite lo agrega en su propio
              `subtitulo` (ver `HiloWhatsapp`) — «red · cuándo» y «Messenger · N
              mensajes» no son cifras y forzarles la tipografía de dígitos se
              leería raro. */}
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">{subtitulo}</div>
        </div>
      </span>

      {extra}

      {/* `contents`: sin caja propia, así en escritorio la barra sigue siendo hija
          directa de la fila (su `flex-1` y su `ml-auto` no cambian). En el
          celular se le pide a la barra que NO se envuelva —su raíz y su fila
          interna son `flex-wrap`— para que se deslice con la cabecera en vez de
          apilarse en tres renglones. Se hace desde acá y no en `BarraGestion`
          porque la barra también vive en otras pantallas, donde envolverse está
          bien. */}
      <div className="contents max-md:[&>div]:flex-none max-md:[&>div>div]:flex-nowrap">
      <BarraGestion
        conversacion={conversacion}
        miVendedora={miVendedora}
        esDeCampana={esDeCampana}
        onAbrirOtra={onAbrirOtra}
        senalRegistrar={senales?.registrar}
        senalEstado={senales?.estado}
        senalEtiqueta={senales?.etiqueta}
        senalAgendar={senales?.agendar}
        embebida
      />
      </div>
    </header>
  );
}
