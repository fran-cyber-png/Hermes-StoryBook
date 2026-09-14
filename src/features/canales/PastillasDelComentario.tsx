import { Check, Eye } from 'lucide-react';
import { nombresEnFila, useQuienesTienenAbierto } from './respuestaUnica';

/**
 * «RESPONDIDO» Y «QUIÉN LO TIENE ABIERTO», EN LA LISTA (ADR 0121).
 *
 * Hasta el 13-sep-2026 esto sólo se veía adentro del panel (`YaRespondido`): para
 * saber si un comentario ya tenía respuesta, o si otra agente lo estaba
 * respondiendo, había que abrirlo. Con varias agentes en la misma Página, abrir
 * para mirar es justo lo que termina en dos respuestas. Ahora se ve antes, en la
 * fila de la cola (`FilaConversacion`) y en la tarjeta del Pipeline
 * (`TarjetaEmbudo`).
 *
 * · **Respondido** sale de `respondida`, o sea del `status` de la interacción.
 *   Desde ADR 0121 esa es la única fuente: la Página contestó desde Hermes o desde
 *   Facebook. Si se borra la última respuesta, vuelve a no estar respondido.
 * · **Quién lo tiene abierto** sale de `GET /api/responder/presencias`, una
 *   consulta para toda la pantalla (`useQuienesTienenAbierto`).
 *
 * ⚠️ **Verde y azul, nunca dorado.** El dorado significa tiempo que se acaba
 * (`src/index.css`). Verde es el mismo hecho que el «Respondido» del panel; azul,
 * el mismo aviso de presencia que `YaRespondido`.
 */

/**
 * Dónde se dibuja. Cada superficie tiene su caja de chip y la pastilla usa esa:
 * en la fila, la de «Preguntó» y el curso (cápsula sin borde); en la tarjeta, la
 * del `Chip` de `TarjetaEmbudo` (cápsula con borde).
 */
const SUPERFICIE = {
  fila: { caja: 'rounded-full px-1 py-px text-[10.5px]', icono: 10, bordeVerde: '', bordeAzul: '' },
  tarjeta: {
    caja: 'rounded-full border px-1.5 py-px text-[11px]',
    icono: 11,
    bordeVerde: 'border-success/40',
    bordeAzul: 'border-primary/30',
  },
} as const;

type Superficie = keyof typeof SUPERFICIE;

export function PastillaRespondido({ en }: { en: Superficie }) {
  const s = SUPERFICIE[en];
  return (
    <span
      data-pastilla="respondido"
      title="Ya tiene respuesta de la Página, desde Hermes o desde Facebook"
      className={`inline-flex shrink-0 items-center gap-0.5 bg-success/15 font-semibold text-success ${s.bordeVerde} ${s.caja}`}
    >
      <Check size={s.icono} strokeWidth={3} className="shrink-0" aria-hidden="true" />
      Respondido
    </span>
  );
}

export function PastillaTieneAbierto({ interactionId, en }: { interactionId: number; en: Superficie }) {
  const personas = useQuienesTienenAbierto(interactionId);
  if (personas.length === 0) return null;
  const s = SUPERFICIE[en];
  const nombres = nombresEnFila(personas);
  return (
    <span
      data-pastilla="abierto"
      title={`${nombres} ${personas.length > 1 ? 'tienen' : 'tiene'} abierto este comentario ahora`}
      className={`inline-flex min-w-0 max-w-[60%] items-center gap-0.5 bg-primary/10 font-semibold text-primary ${s.bordeAzul} ${s.caja}`}
    >
      <Eye size={s.icono} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{nombres}</span>
    </span>
  );
}
