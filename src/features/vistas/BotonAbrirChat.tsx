import { useEffect, useRef, useState } from 'react';
import { MessageSquareText, Smartphone } from 'lucide-react';
import type { Conversacion } from '../../dominio/conversaciones';
import type { LineaWhatsapp } from '../../dominio/lineas';
import {
  conversacionEnLinea,
  queHacerAlAbrir,
  type OpcionDeLinea,
} from '../../dominio/lineaParaAbrir';
import { ladoDelMenu } from '../canales/accionesFila';
import { usePopover } from '../../lib/teclado/usePopover';

/**
 * EL BOTÓN DE LA TARJETA QUE LLEVA AL CHAT — y, cuando hay más de una línea,
 * PREGUNTA POR CUÁL.
 *
 * Antes elegía solo: la línea del hilo si la había, y para un lead de formulario
 * ninguna. Con varias líneas corriendo eso es una decisión tomada a espaldas de
 * la vendedora, y se descubre tarde — cuando al lead le llega el mensaje desde un
 * número que no conoce, o cuando la respuesta sale por la línea de una campaña
 * que no es la suya.
 *
 * La decisión de si hay algo que preguntar vive pura en
 * `dominio/lineaParaAbrir.ts`; acá está el IO: el menú, el foco y hacia qué lado
 * se abre.
 *
 * ── EL MOLDE ES `canales/MenuFila.tsx` ─────────────────────────────────────
 * Mismo cierre (`usePopover`: Escape en CAPTURA + clic afuera), mismo foco al
 * primer item, y el mismo `ladoDelMenu` — porque las columnas del Pipeline son
 * `overflow-y-auto` igual que la cola: en las últimas tarjetas, abrir hacia abajo
 * es abrir un menú cortado.
 *
 * ⚠️ Lo que NO tiene la cola: la tarjeta de acá es `draggable`. Un `mousedown`
 * adentro del panel arrancaría el arrastre de la tarjeta que está debajo, así que
 * el panel corta el `dragstart`.
 */
export function BotonAbrirChat({
  c,
  lineas,
  onAbrir,
}: {
  c: Conversacion;
  /** Las que el server ofrece (`GET /api/whatsapp/lineas`), ya recortadas por él. */
  lineas: LineaWhatsapp[];
  onAbrir: (c: Conversacion) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [lado, setLado] = useState<'abajo' | 'arriba'>('abajo');
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const primerItemRef = useRef<HTMLButtonElement>(null);

  // La tarjeta se recicla: la misma posición de la columna pasa a ser otra
  // persona cuando llega un mensaje y todo sube. Un menú que sobreviva a ese
  // cambio abriría el chat de la de antes. Mismo motivo que en `MenuFila`.
  useEffect(() => {
    setAbierto(false);
  }, [c.clave]);

  const { propsOverlay } = usePopover(
    abierto,
    () => {
      setAbierto(false);
      disparadorRef.current?.focus();
    },
    { z: 'z-20' },
  );

  useEffect(() => {
    if (abierto) primerItemRef.current?.focus();
  }, [abierto]);

  const plan = queHacerAlAbrir(c, lineas);
  const opciones = plan.tipo === 'elegir' ? plan.opciones : [];
  const hayActual = opciones.some((o) => o.actual);

  /**
   * Alto ESTIMADO del panel, para decidir el lado antes de que exista y se pueda
   * medir (la estimación es el trato que ya documenta `accionesFila.ts`): el
   * encabezado, un renglón de ~34 px por línea, y el pie que sólo aparece cuando
   * hay un hilo del que distinguirse.
   */
  const altoMenu = 34 + opciones.length * 34 + (hayActual ? 30 : 0);

  function elegir(o: OpcionDeLinea) {
    setAbierto(false);
    onAbrir(conversacionEnLinea(c, o));
  }

  function alTocar() {
    if (plan.tipo === 'abrir') {
      onAbrir(plan.destino);
      return;
    }
    if (abierto) {
      setAbierto(false);
      return;
    }
    const el = disparadorRef.current;
    if (el) {
      const disparador = el.getBoundingClientRect();
      // Contra el scroller de la COLUMNA, no contra la ventana: lo que recorta el
      // panel es ese contenedor. Es el mismo `data-scroll-columna` que usa el
      // observer de las fotos de la tarjeta.
      const scroller = el.closest<HTMLElement>('[data-scroll-columna]')?.getBoundingClientRect();
      setLado(
        ladoDelMenu({
          arribaDisparador: disparador.top,
          abajoDisparador: disparador.bottom,
          limiteArriba: scroller?.top ?? 0,
          limiteAbajo: scroller?.bottom ?? window.innerHeight,
          altoMenu,
        }),
      );
    }
    setAbierto(true);
  }

  return (
    <span className="relative shrink-0">
      <button
        ref={disparadorRef}
        type="button"
        // El título dice lo que el botón VA a hacer, y son dos cosas distintas:
        // con una sola forma de abrir lleva derecho, con varias pregunta primero.
        title={plan.tipo === 'elegir' ? 'Abrir el chat — elige por qué línea' : 'Abrir en Mensajes'}
        aria-haspopup={plan.tipo === 'elegir' ? 'true' : undefined}
        aria-expanded={plan.tipo === 'elegir' ? abierto : undefined}
        onClick={(e) => {
          // Sin esto el clic también abriría la ficha al costado — y cuando la
          // vista se va a Mensajes, quedaría una hoja abierta atrás.
          e.stopPropagation();
          alTocar();
        }}
        className={
          'rounded-md p-1 text-muted-foreground transition-[color,background-color,opacity] duration-200 hover:bg-secondary hover:text-navy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.96] ' +
          // Con el menú abierto se queda a la vista: si no, el disparador
          // desaparece bajo el mouse en cuanto éste se mueve hacia el panel.
          (abierto
            ? 'bg-secondary text-navy-ink opacity-100'
            : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')
        }
      >
        <MessageSquareText size={13} />
      </button>

      {abierto && (
        <>
          <span {...propsOverlay} />
          <div
            role="menu"
            aria-label="Por qué línea escribirle"
            onClick={(e) => e.stopPropagation()}
            // La tarjeta de abajo es `draggable`: sin esto, apretar sobre un item
            // y moverse un píxel arrastra la tarjeta en vez de elegir la línea.
            onDragStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className={
              'absolute right-0 z-30 w-56 rounded-xl bg-card p-1.5 text-left shadow-panel ' +
              (lado === 'abajo' ? 'top-7' : 'bottom-7')
            }
          >
            <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold text-muted-foreground">
              ¿Por qué línea le escribes?
            </p>

            {opciones.map((o, i) => (
              <button
                key={`${o.numero ?? ''}:${o.actual}`}
                ref={i === 0 ? primerItemRef : undefined}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  elegir(o);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                <Smartphone size={13} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{o.etiqueta}</span>
                {o.actual && (
                  // Sin oro: acá no hay ningún plazo corriendo. Es sólo «éste es
                  // el que ya tienes», que es lo que separa seguir de empezar.
                  <span className="shrink-0 rounded-full border border-navy/20 bg-secondary px-1.5 py-px text-[10px] font-semibold text-secondary-foreground">
                    este chat
                  </span>
                )}
              </button>
            ))}

            {/* Sólo cuando hay un hilo del que distinguirse: en un lead de
                formulario TODAS las opciones abren un chat nuevo, y decirlo ahí
                sería una advertencia sobre lo único que se puede hacer. */}
            {hayActual && (
              <p className="border-t border-border px-2 pb-0.5 pt-1.5 text-[11px] leading-snug text-muted-foreground">
                Otra línea abre un chat <b className="font-semibold">nuevo</b> con esta persona: el
                historial se queda en el de arriba.
              </p>
            )}
          </div>
        </>
      )}
    </span>
  );
}
