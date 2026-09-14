import { Bot, Hand } from 'lucide-react';
import { lecturaDelBot, type FilaConBot, type Temperatura } from '../../dominio/bot';
import { encabezadoSeccion } from './estiloSeccion';

/**
 * LO QUE EL BOT LEYÓ DE ESTA CONVERSACIÓN — en la ficha, que es donde entra.
 *
 * ══ QUÉ PROBLEMA CIERRA ══════════════════════════════════════════════════════
 *
 * La cola dibuja las calientes y las escaladas, y calla `tibio` y `frio` a
 * propósito: un chip que sale en tres de cada cuatro filas no ayuda a ELEGIR. El
 * efecto lateral era que **un tercio del dato no aparecía en ninguna pantalla**,
 * ni abriendo la conversación — el bot se formaba una opinión y la vendedora no
 * tenía cómo enterarse.
 *
 * ⚠️ **Las cifras que sostienen esto se miden y se escriben UNA sola vez, en
 * `dominio/bot.ts`.** Repetirlas en cada consumidor las condena a envejecer en
 * seis archivos a la vez, y la próxima medición tendría que acertarlos todos.
 *
 * Acá la pregunta ya no es «¿a quién toco?» sino «¿qué sé de ésta?», así que
 * caben las tres temperaturas y su porqué.
 *
 * ══ POR QUÉ EL MOTIVO VA SIEMPRE QUE EXISTA ══════════════════════════════════
 *
 * Porque una temperatura sin porqué no se puede juzgar y, sobre todo, **no se
 * puede corregir**. Es la misma regla de ADR 0094 y de la escucha: una
 * afirmación del sistema sin la evidencia al lado es una etiqueta que hay que
 * creerle. Cuando el ARM traiga aceptar/corregir (#793), este bloque es el lugar
 * donde se enganchan.
 *
 * ══ COLOR ═══════════════════════════════════════════════════════════════════
 *
 * 🔴 **Nada de oro.** En Hermes el oro significa tiempo que se acaba y nada más
 * (`src/index.css`), y una temperatura no es un reloj. Caliente toma el naranja
 * de advertencia —el mismo que la fila de la cola—, tibia el neutro de la casa y
 * fría el apagado. La escalada, que sí es una deuda con un lead esperando, va en
 * rojo.
 */

/** Los tres tonos. Ninguno es oro, a propósito — ver el docblock. */
const CLASE_TEMPERATURA: Record<Temperatura, string> = {
  caliente: 'border-warning/40 bg-warning/10 text-warning-foreground',
  tibio: 'border-border bg-secondary text-secondary-foreground',
  frio: 'border-border bg-muted text-muted-foreground',
};

const AYUDA_TEMPERATURA: Record<Temperatura, string> = {
  caliente: 'El bot la ve caliente: preguntó precio, cuotas o forma de pago',
  tibio: 'El bot la ve tibia: hay interés, pero todavía no preguntó por el precio',
  frio: 'El bot la ve fría: no encontró señales de intención de compra',
};

/**
 * Pide `FilaConBot` y no `Conversacion`: son los tres campos que usa, y el tipo
 * exacto ya existe. Así el bloque se puede montar sobre cualquier fila que traiga
 * el veredicto, sin arrastrar las cuarenta columnas de una conversación.
 */
export function LoQueDijoElBot({ conversacion }: { conversacion: FilaConBot }) {
  const bot = lecturaDelBot(conversacion);
  // Sin fila no se dibuja NADA — ni un hueco ni un «sin calificar». La ausencia
  // de dato no es un dato, y un bloque vacío permanente enseña a no mirarlo
  // (ADR 0080).
  if (!bot) return null;

  return (
    <section className="px-4 py-3">
      <h3 className={encabezadoSeccion}>
        <Bot size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        Lo que leyó el bot
      </h3>

      <div className="flex flex-wrap items-center gap-1.5">
        {bot.temperatura && (
          <span
            title={AYUDA_TEMPERATURA[bot.temperatura]}
            className={
              'inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[11px] font-semibold ' +
              CLASE_TEMPERATURA[bot.temperatura]
            }
          >
            {bot.texto}
          </span>
        )}
        {/* La escalada es el hecho más caro de la tabla: el bot se frenó y el
            lead quedó sin bot y sin persona. Convive con la temperatura en vez
            de taparla —acá hay lugar para las dos—, al revés que en la fila de
            la cola, donde entra un solo chip. */}
        {bot.escalada && (
          <span
            title="El bot se frenó y está esperando a una persona: mientras nadie la tome, el lead no recibe nada"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-px text-[11px] font-semibold text-destructive"
          >
            <Hand size={10} className="shrink-0" aria-hidden="true" />
            Pidió ayuda
          </span>
        )}
      </div>

      {bot.motivo && <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{bot.motivo}</p>}
    </section>
  );
}
