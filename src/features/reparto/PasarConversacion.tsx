import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, UserRound, UserRoundPlus } from 'lucide-react';
import { usePopover } from '../../lib/teclado/usePopover';
import { ladoDelMenu } from '../canales/accionesFila';
import { ErrorApi } from '../../lib/datos/cliente';
import { mismaVendedora, rotuloDePersona } from '../../dominio/dueno';
import { useRueda, usePasarConversacion } from './reparto';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * «PÁSASELA A OTRA PERSONA» — de quién es esta conversación, y cómo cambiarlo.
 *
 * ── Por qué vive en la BarraGestion y no en el menú ▼ de la fila ──
 * El menú de la fila es, por su propio docblock, «la puerta única a las marcas
 * PERSONALES» (fijar · no leído · favoritos): cosas que solo ve quien las pone.
 * Pasar una conversación es lo contrario —una decisión del equipo, visible para
 * todos, con rastro de quién la tomó— y meterla ahí la dejaría a un clic de
 * distancia de tres acciones que no tienen consecuencias para nadie más.
 *
 * Acá, en cambio, está donde se decide qué hacer con ESTA conversación, al lado
 * de la etapa y los intereses, y con el chat a la vista: pasar un lead sin leer
 * de qué venía hablando es cómo se pasa un lead mal.
 *
 * ── Lo que NO es ──
 * **No es un permiso.** Cualquiera puede pasar cualquier conversación, incluso
 * una que no es suya: Hermes no tiene modelo de permisos y fingir uno acá sería
 * una frontera imaginaria (el mismo argumento de `cola/lineas.ts`). Lo que sí hay
 * es rastro — el server guarda quién la pasó.
 *
 * ── Cuándo NO aparece ──
 * Sin línea (un comentario de FB/IG), o si esa línea no tiene reparto configurado.
 * Un botón que abre una lista vacía no es una acción, es una promesa incumplida —
 * y con tres de las cuatro líneas sin reparto, sería la mayoría de las veces.
 *
 * ── 🔴 Y DESDE EL 24-AGO-2026 TAMBIÉN VIVE EN LA FILA DEL RADAR ────────────
 * Pedido del dueño sobre el Dashboard: *«un botón para poder asignar a un
 * vendedor rápidamente»*, en el lugar donde estaba el `+` de etiquetar.
 *
 * ⚠️ **Esto NO contradice el «por qué vive en la BarraGestion» de arriba**, que
 * sigue entero: aquel argumento es contra el menú ▼ de la fila de la COLA —«la
 * puerta única a las marcas PERSONALES»—, no contra las filas en general. El
 * radar del Dashboard es la mesa de reparto: la pantalla donde se mira quién
 * espera y se decide quién atiende. Ahí, pasar una conversación no está al lado
 * de tres acciones sin consecuencias: **es la acción**.
 *
 * Lo que la fila SÍ trae y la barra no es que vive adentro de un
 * `overflow-y-auto` y de un contenedor clickeable. De ahí los dos parámetros de
 * abajo (`recortaEn`, y el `stopPropagation` del disparador), que son el mismo
 * cuidado que ya se documenta en `canales/MenuFila.tsx` y
 * `vistas/BotonAbrirChat.tsx` — no una variante nueva.
 */
export function PasarConversacion({
  conversacion,
  miVendedora,
  recortaEn,
}: {
  conversacion: Conversacion;
  /** Quién está mirando, para poder decir «Tú» en vez de tu propio username. */
  miVendedora?: string | null;
  /**
   * Selector del contenedor que RECORTA el panel — el `overflow-y-auto` del que
   * este control cuelga cuando vive en una lista (el radar del Dashboard).
   *
   * Sin él se mide contra la ventana, que es lo correcto en la hoja y en la
   * barra: ahí nada recorta. Se mide contra el scroller y no contra el viewport
   * por lo mismo que en `MenuFila` — lo que corta el panel en la última fila es
   * ese contenedor, no la pantalla, así que el viewport diría «entra» y la
   * vendedora vería medio menú.
   */
  recortaEn?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [lado, setLado] = useState<'abajo' | 'arriba'>('abajo');
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const numeroPropio = conversacion.numero_propio;
  const { destinos, rueda, nombres, hayReparto } = useRueda(numeroPropio);
  const pasar = usePasarConversacion();

  const cerrar = useCallback(() => {
    setAbierto(false);
    disparadorRef.current?.focus();
  }, []);
  const { propsOverlay } = usePopover(abierto, cerrar, { z: 'z-20' });

  // La barra NO se desmonta al cambiar de conversación: un panel abierto
  // sobreviviría apuntando a la de antes, y sus acciones son escrituras sobre
  // quién atiende a quién. Mismo cuidado que `MenuFila`.
  useEffect(() => {
    setAbierto(false);
    pasar.reset();
    // `pasar` es estable entre renders (react-query); depender de la clave alcanza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversacion.clave]);

  if (!numeroPropio || !hayReparto) return null;

  /**
   * ══ QUIÉN LA ATIENDE — SE LEE DE LA FILA, NO DE `marcaDeDueno` ═════════════
   *
   * Este control usaba `marcaDeDueno`, que es la regla de la FILA DE LA COLA, y
   * ahí hace dos cosas que acá son defectos:
   *
   * 🔴 **Devuelve `null` cuando la conversación es TUYA** («lo propio no se
   * rotula»), que en una lista de 1.900 filas es correcto —serían 1.900 píldoras
   * iguales— y acá significaba que **una conversación asignada a vos misma
   * dibujaba «Asignar»**, o sea exactamente lo contrario de lo que pasa. El
   * supervisor que se auto-asigna una la veía volver al estado vacío.
   *
   * 🔴 **Y abrevia con `nombreCorto`**, así que el chip decía «Ventas11»
   * mientras su PROPIO menú, tres píxeles abajo, decía «Tracy»
   * (`rotuloDePersona`, que resuelve contra los `nombres` de la rueda y ya
   * estaba importado en este archivo). Dos nombres para la misma persona dentro
   * del mismo control.
   *
   * La fila de la cola no se toca: allá `marcaDeDueno` sigue siendo la regla, y
   * allá no hay `nombres` que consultar.
   */
  const asignadaA = conversacion.asignada_a?.trim() || '';
  const esMia = asignadaA !== '' && mismaVendedora(asignadaA, miVendedora ?? '');
  const dueno = asignadaA
    ? {
        texto: esMia ? 'Tú' : rotuloDePersona(asignadaA, nombres),
        titulo: esMia
          ? 'Esta conversación es tuya'
          : `Asignada a ${rotuloDePersona(asignadaA, nombres)} (${asignadaA})`,
      }
    : null;
  const cargaDe = (id: string) => rueda.find((r) => r.vendedoraId === id);

  /**
   * Alto ESTIMADO del panel, para decidir el lado ANTES de que exista y se pueda
   * medir — la misma estimación que documenta `accionesFila.ts`: el encabezado
   * («Pasar la conversación a»), un renglón de ~29 px por destino, y el padding.
   */
  const altoPanel = 24 + destinos.length * 29 + 12;

  function alTocar() {
    if (abierto) {
      setAbierto(false);
      return;
    }
    const el = disparadorRef.current;
    // Sin `recortaEn` no hay nada que recortar (la hoja, la barra): se mide
    // contra la ventana y el default de abajo gana casi siempre.
    if (el) {
      const disparador = el.getBoundingClientRect();
      const scroller = recortaEn ? el.closest<HTMLElement>(recortaEn)?.getBoundingClientRect() : undefined;
      setLado(
        ladoDelMenu({
          arribaDisparador: disparador.top,
          abajoDisparador: disparador.bottom,
          limiteArriba: scroller?.top ?? 0,
          limiteAbajo: scroller?.bottom ?? window.innerHeight,
          altoMenu: altoPanel,
        }),
      );
    }
    setAbierto(true);
  }

  return (
    // `shrink-0`: en la fila del radar esto vive en un flex junto al nombre, el
    // país y las etiquetas. Sin él, el chip es lo que cede — y un «Asignar»
    // aplastado a 12 px no es un control, es un adorno.
    <span className="relative shrink-0">
      {/* ══ EL ESTADO VACÍO NOMBRA LA ACCIÓN, NO LA AUSENCIA ══════════════════
          Pedido del dueño (24-ago-2026), sobre la hoja del Pipeline: *«que sea
          visible y usable pero que no ocupe tanto espacio tampoco»* — el
          supervisor lo usa a cada rato.

          Decía **«Sin asignar»**: once caracteres con borde punteado, o sea el
          rótulo más largo y pesado del control para el estado que menos
          información carga. Y es el estado que más se ve: medido el 18-ago-2026,
          `luz` tenía dueña en **1 de 1.008** conversaciones, así que en la
          práctica esa píldora era el ancho fijo de la barra.

          ⚠️ **Esto NO revierte la decisión de no dejarlo mudo** —que sigue siendo
          correcta y por eso el botón conserva palabra— sino que cambia CUÁL:
          «Asignar» es el verbo de lo que falta hacer, que es exactamente lo que
          el docblock de este archivo dice que el estado vacío existe para
          comunicar. Un estado se lee; una acción se aprieta. Y el `+` del ícono
          lo dice sin leer nada.

          El estado CON dueña no se toca: ahí la palabra ES el dato —quién
          atiende— y es lo que el supervisor viene a buscar. */}
      <button
        ref={disparadorRef}
        type="button"
        onClick={(e) => {
          // La fila del radar es clickeable y abre la ficha al costado: sin esto,
          // elegir a quién pasársela abriría además la hoja de esa persona.
          // En la hoja y en la barra no hay a quién frenar, así que no molesta.
          e.stopPropagation();
          alTocar();
        }}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title={
          dueno
            ? `${dueno.titulo} · toca para pasársela a otra persona`
            : 'Sin asignar — toca para elegir quién la atiende'
        }
        className={
          'flex items-center gap-1 rounded-full border py-0.5 pl-1.5 pr-1 text-[11px] font-semibold ' +
          'transition-colors duration-200 ease-house hover:border-primary/60 hover:text-foreground ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
          (dueno ? 'border-navy/40 text-navy-ink' : 'border-dashed border-border text-muted-foreground')
        }
      >
        {dueno ? (
          <UserRound size={11} className="shrink-0" aria-hidden="true" />
        ) : (
          <UserRoundPlus size={11} className="shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">{dueno ? dueno.texto : 'Asignar'}</span>
        {/* La flecha dice que ACÁ se elige, sin gastar una palabra. Con dueña es
            lo único que distingue una etiqueta de un control: sin ella, el
            nombre de quien atiende se lee como una marca y nadie la toca. */}
        {/* Gira al abrir en vez de saltar: un cambio de estado sin interpolación
            se lee como un glitch, no como una respuesta. Sólo `transform`. */}
        <ChevronDown
          size={10}
          aria-hidden="true"
          className={
            'shrink-0 opacity-60 transition-transform duration-200 ease-house ' +
            (abierto ? 'rotate-180' : '')
          }
        />
      </button>

      {abierto && (
        <>
          <div {...propsOverlay} />
          <div
            onClick={(e) => e.stopPropagation()}
            className={
              'absolute left-0 z-30 w-56 rounded-xl border border-border bg-card p-1.5 shadow-panel ' +
              (lado === 'abajo' ? 'top-full mt-1' : 'bottom-full mb-1')
            }
          >
            <p className="px-1.5 pb-1 text-[11px] font-semibold text-muted-foreground">Pasar la conversación a</p>
            {destinos.map((id) => {
              const carga = cargaDe(id);
              const esActual = conversacion.asignada_a === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={esActual || pasar.isPending}
                  onClick={() =>
                    pasar.mutate(
                      { clave: conversacion.clave, numeroPropio, vendedoraId: id },
                      { onSuccess: cerrar },
                    )
                  }
                  className={
                    'flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs ' +
                    'transition-colors hover:bg-secondary/60 disabled:opacity-50 disabled:hover:bg-transparent'
                  }
                >
                  {/* El NOMBRE de la persona cuando Hermes lo sabe; si no, su
                      username recortado, que es lo que se veía siempre. El
                      `title` lleva el username completo pase lo que pase: es
                      contra eso que se escribe la fila, y con dos personas de
                      nombre parecido es lo único que desempata. */}
                  <span className="truncate font-medium" title={id}>
                    {id === miVendedora
                      ? `${rotuloDePersona(id, nombres)} (tú)`
                      : rotuloDePersona(id, nombres)}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {/* La carga de cada uno, a la vista: pasarle la número 40 a
                        quien ya tiene 40 es exactamente lo que el round-robin
                        evita solo, y a mano no lo evita nadie si no se ve. */}
                    {esActual ? 'la tiene' : (carga?.asignadas ?? 0)}
                  </span>
                </button>
              );
            })}
            {pasar.isPending && (
              <p className="flex items-center gap-1 px-1.5 pt-1 text-[11px] text-muted-foreground">
                <Loader2 size={10} className="animate-spin" /> pasando…
              </p>
            )}
            {/* El 409 del server (username desconocido) se MUESTRA: es la red
                contra el dedazo, y tragárselo devolvería el fallo silencioso que
                esa guarda existe para impedir. */}
            {pasar.isError && (
              <p className="px-1.5 pt-1 text-[11px] text-destructive">
                {pasar.error instanceof ErrorApi ? pasar.error.message : 'No se pudo pasar. Prueba de nuevo.'}
              </p>
            )}
          </div>
        </>
      )}
    </span>
  );
}
