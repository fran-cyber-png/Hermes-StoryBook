import { useEffect, useRef } from 'react';
import { IdCard, X } from 'lucide-react';
import { useEscape } from '../../lib/teclado/useEscape';
import type { Conversacion } from '../../dominio/conversaciones';
import { PanelDerecho } from './PanelDerecho';
import type { DestinoCorreo } from '../../lib/puente';
import { PasarConversacion } from '../reparto/PasarConversacion';

/**
 * EL ANCHO DE LA HOJA — 360 px, el mismo `PanelDerecho` de toda la app (ADR 0017).
 *
 * Va como VALOR y ya no como la clase `w-[22.5rem]` que estaba acá, porque desde
 * que el Dashboard empuja hay un layout que necesita SABERLO para reservarle el
 * hueco. Dos literales que tienen que sumar igual divergen mudos, y el síntoma
 * de esa divergencia es una hoja que se superpone ocho píxeles: nadie lo
 * reporta, ningún test lo ve.
 */
export const ANCHO_HOJA = '22.5rem';

/**
 * LO QUE UN TABLERO RESERVA PARA QUE LA HOJA NO TAPE NADA: el ancho, más los
 * 12 px que la despegan del borde (`right-3`, los mismos que `p-3` deja del otro
 * lado) y los 10 px de aire hacia el contenido — el `gap-2.5` de la casa.
 */
export const ESPACIO_HOJA = `calc(${ANCHO_HOJA} + 0.75rem + 0.625rem)`;

/**
 * LA FICHA, AL COSTADO DE DONDE ESTABAS — el panel derecho fuera de Mensajes.
 *
 * ══ QUÉ PROBLEMA CIERRA ══════════════════════════════════════════════════════
 *
 * «¿Quién es esta persona?» se pregunta en el Pipeline y en el padrón, y hasta
 * hoy la única forma de contestarla era **irse a Mensajes** (el botoncito de la
 * tarjeta llama a `onAbrir`, que conmuta de vista). O sea que para saber si a
 * alguien ya le vendimos había que perder el tablero, y volver.
 *
 * No hay componente nuevo adentro: es `PanelDerecho` (ADR 0017) tal cual, con su
 * banda de estado, su timeline, su ficha de Cerberus y su «Registrar venta». Lo
 * único que aporta esta hoja es DÓNDE se monta y CÓMO se cierra.
 *
 * ══ SE SUPERPONE O EMPUJA — LO DECIDE EL LLAMADOR, Y ES ARITMÉTICA ═══════════
 *
 * En el **Pipeline** se superpone, y el motivo es aritmético: su `GRID` declara
 * mínimos que suman **1.000 px**. A 1280×720 (la pantalla para la que está
 * diseñada esta app) el área de contenido son ~1.180 px menos el riel:
 * empujando, al tablero le quedarían ~810 px para algo que pide 1.000, y
 * aparecería scroll horizontal — que en Hermes no existe, se scrollea el riel o
 * una columna, nunca la página. Así que ahí la hoja va encima, con el molde que
 * la casa ya tiene (`ConsultaIvi`, ADR 0024).
 *
 * 🔴 **En el Dashboard EMPUJA, y no es una excepción caprichosa: es la misma
 * cuenta con otros números.** El radar no declara mínimo (es una lista de filas
 * que truncan, `min-w-0 flex-1`) y el riel pide 320 px, así que reservarle el
 * hueco a la hoja no genera scroll horizontal — solo achica el radar. Lo que sí
 * generaba la superposición era tapar el radar del que se está eligiendo,
 * justamente donde se elige. **La hoja no sabe cuál de los dos le toca**: se
 * posiciona `absolute` contra el ancestro posicionado más cercano y punto. El
 * que empuja envuelve la hoja en una ventana que se abre —y le reserva el hueco
 * al tablero con `ESPACIO_HOJA`—; el que se superpone la monta directo, como
 * siempre. Ver `dashboard/VistaDashboard.tsx`.
 *
 * Lo que NO copia de aquélla: el scrim. Ivi es modal porque es una conversación
 * aparte; acá se está eligiendo a quién mirar, y tapar la lista de la que se
 * elige haría falsa la pregunta. Sin scrim se puede tocar otra tarjeta y la hoja
 * cambia de persona sin cerrarse.
 *
 * ══ CERRAR AL TOCAR AFUERA (`cerrarAlTocarAfuera`, opt-in) ═══════════════════
 *
 * Pedido del dueño para el Pipeline: tocar el fondo del tablero cierra la hoja,
 * sin scrim y sin perder lo de arriba — tocar OTRA tarjeta sigue cambiando de
 * persona en vez de cerrar, porque el `mousedown` que detecta «afuera» corre
 * ANTES que el `onClick` de la tarjeta que abre la ficha nueva: las dos
 * actualizaciones de estado caen en el mismo tick y gana la última
 * (`setFicha(null)` y después `setFicha(nueva)`), así que nunca parpadea
 * cerrada. Es opt-in y no el default de la hoja: se monta desde TRES pantallas
 * (Pipeline, padrón, el radar del Dashboard) y sólo el Pipeline lo pidió — las
 * otras dos siguen exactamente igual que antes.
 *
 * ══ EL ESCAPE, Y POR QUÉ LLEVA CONDICIÓN ═════════════════════════════════════
 *
 * `useEscape` registra en CAPTURA sobre `window` y corta la propagación: un
 * listener de más apaga el Escape de TODA la app, en silencio (fue exactamente
 * lo que pasó con Ivi, ADR 0024). Acá se paga de dos formas:
 *
 *  · esta hoja se monta y se desmonta con su apertura —el llamador la envuelve en
 *    `{ficha && <HojaContacto …/>}`—, así que cerrada no existe ni el listener;
 *  · y `escapeActivo` deja apagarlo cuando hay algo ENCIMA que también escucha
 *    (los modales de compuerta del Pipeline). Sin eso, un Escape cerraría el
 *    modal y la hoja de una, y la vendedora perdería de vista a quién le estaba
 *    por registrar la venta.
 *
 * ⚠️ **Y hay un tercer caso desde que el Dashboard empuja**: ahí la hoja sigue
 * montada unos milisegundos DESPUÉS de cerrada, porque si no el cierre no se
 * puede animar. O sea que la primera viñeta ya no vale sola en todos lados y
 * `escapeActivo` deja de ser sólo para «hay algo encima»: también es para «esto
 * ya no es de nadie». Una hoja que se está yendo y se queda con la tecla apaga
 * el Escape de TODA la app hasta que termine la transición.
 */
export function HojaContacto({
  conversacion,
  onCerrar,
  escapeActivo = true,
  cerrarAlTocarAfuera = false,
  miVendedora,
  esDeCampana,
  onMandarCorreo,
  onEscribir,
}: {
  conversacion: Conversacion;
  onCerrar: () => void;
  /** `false` cuando hay un modal encima que ya maneja su propio Escape. */
  escapeActivo?: boolean;
  /**
   * Cierra la hoja al tocar afuera (fuera del `<aside>`) — opt-in, default
   * `false` para no cambiar a padrón ni al radar del Dashboard, que no lo
   * pidieron. Ver el docblock de arriba.
   */
  cerrarAlTocarAfuera?: boolean;
  /**
   * Quién está mirando. Baja hasta `PanelDerecho` para el timeline (ADR 0037):
   * un evento del contacto lo edita y lo borra SOLO quien lo registró, y sin
   * esto `esMio` da `false` para todos.
   *
   * Sin este cable la hoja no se rompía —degrada a no dibujar los botones, que
   * es el lado correcto del fail— pero la ficha de Pipeline y la del padrón
   * quedaban en solo lectura sin que nada lo dijera: la misma acción se podía
   * hacer desde Mensajes y no desde acá.
   */
  miVendedora?: string | null;
  /**
   * ¿Quien mira trabaja en el módulo de CAMPAÑAS? Baja hasta `PanelDerecho`,
   * que apaga con esto las tres consultas que van contra Cerberus (`modulos/
   * modulo.ts`). Opcional: sin él se comporta como el panel de siempre.
   */
  esDeCampana?: boolean;
  /**
   * Puente a Correos, de paso hacia `PanelDerecho`. Va acá y no adentro porque
   * quién sabe cambiar de vista es el shell, no la hoja.
   *
   * ⚠️ **Es la misma prop opcional que esconde la acción cuando falta**: la
   * hoja se monta desde TRES pantallas (Pipeline, padrón y el radar del
   * Dashboard) y olvidarse en una deja «Escribirle» viva en dos y muerta en la
   * tercera, sobre la misma ficha y sin ningún síntoma.
   */
  onMandarCorreo?: (destino: DestinoCorreo) => void;
  /** Puente a Mensajes para iniciar un chat nuevo desde la ficha. */
  onEscribir?: (telefono: string) => void;
}) {
  useEscape(onCerrar, escapeActivo);

  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!cerrarAlTocarAfuera) return;
    // `mousedown` y no `click`: corre ANTES que el `onClick` de la tarjeta que
    // abre una ficha nueva, así que las dos actualizaciones de estado caen en
    // el mismo tick y la que gana es la última — nunca un parpadeo a cerrado.
    function alTocarAfuera(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onCerrar();
    }
    document.addEventListener('mousedown', alTocarAfuera);
    return () => document.removeEventListener('mousedown', alTocarAfuera);
  }, [cerrarAlTocarAfuera, onCerrar]);

  return (
    <aside
      ref={ref}
      aria-label="Ficha del contacto"
      style={{ width: ANCHO_HOJA }}
      className="absolute inset-y-3 right-3 z-30 flex flex-col gap-2 animate-entrar"
    >
      {/* La barra propia existe porque el encabezado del panel no tiene dónde
          poner una X: su esquina derecha es la pastilla de estado (Cliente /
          Lead nuevo), que es justamente lo que no se puede tapar.

          El botón de asignación va acá porque es una decisión del EQUIPO sobre
          esta conversación, no una marca personal; antes solo existía en la
          barra del chat. */}
      <header className="flex shrink-0 items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-panel">
        <IdCard size={14} strokeWidth={2.1} className="shrink-0 text-navy-ink" />
        <h2 className="font-heading text-xs font-bold text-navy-ink">Ficha</h2>
        <span className="ml-2">
          <PasarConversacion conversacion={conversacion} miVendedora={miVendedora} />
        </span>
        <kbd className="ml-auto rounded bg-muted px-1.5 font-mono text-[10px] font-semibold text-muted-foreground">
          Esc
        </kbd>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar la ficha"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors duration-200 ease-house hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X size={14} />
        </button>
      </header>

      {/* El panel se queda con lo que sobra y scrollea adentro, igual que en
          Mensajes: su pie («Registrar venta») está clavado y no se puede empujar
          fuera de la hoja. */}
      <div className="min-h-0 flex-1">
        <PanelDerecho
          conversacion={conversacion}
          miVendedora={miVendedora}
          esDeCampana={esDeCampana}
          onMandarCorreo={onMandarCorreo}
          onEscribir={onEscribir}
        />
      </div>
    </aside>
  );
}
