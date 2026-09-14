import type { AlcanceDeCanal } from '../../dominio/conversaciones';
import type { FilaDesglose } from '../../dominio/desglose';

/**
 * ══ EL CANAL DE LA MESA DE CAMPAÑA — la fila de íconos del Pipeline (13-sep-2026) ══
 *
 * Pedido del dueño: «que se entienda que no faltan leads por contestar, son
 * comentarios». «Te esperan» mezclaba en una sola cifra los chats de WhatsApp,
 * los DMs y los COMENTARIOS de Facebook e Instagram, y un número de mil y pico
 * se leía como mil y pico personas esperando una respuesta por WhatsApp. Ahora
 * la mesa se mira canal por canal, y **arranca en WhatsApp**.
 *
 * 🔴 **SÓLO EN CAMPAÑA** («estamos haciendo exclusivamente para campaña», Betto y
 * Américo). El Pipeline de ventas no dibuja esta fila ni recorta por canal.
 *
 * 🔴 **UNA FILA, DOS GRUPOS** (decisión del dueño): primero los MENSAJES —WhatsApp,
 * Instagram, Messenger— y después los COMENTARIOS —Facebook, Instagram—. Instagram
 * se PARTE: el riel de Mensajes lo dejaba en un solo ícono (`tipo: null`) y eso
 * volvía a mezclar justo lo que esta fila existe para separar. Formulario no va
 * «todavía»: en campaña no hay landing de la Escuela.
 *
 * ⚠️ **Por eso esta lista YA NO es `OPCIONES_CANAL`** (la del riel de Mensajes):
 * las dos pantallas ofrecen cosas distintas a propósito, y cambiar aquélla cambia
 * Mensajes, que es otro frente. Lo que NO se duplica es lo que tiene que decir lo
 * mismo en todas partes —el color, el logo y el nombre de cada par canal · tipo—:
 * eso sale de `insigniaDe` (`components/BadgeCanal.tsx`), la fuente única.
 *
 * ⚠️ **No hay un canal `messenger` ni un canal `instagram-comentario`**: los ids son
 * de esta fila. Lo que viaja es el par (`canal`, `tipo`), igual que en el dato
 * (`interactions.canal` sólo admite facebook|instagram|whatsapp).
 */

export type GrupoDeCanal = 'mensajes' | 'comentarios';

export interface CanalDeLaMesa {
  id: string;
  /** El `aria-label`. Único a propósito: hay DOS Instagram, y un lector de pantalla no ve el hueco. */
  label: string;
  /**
   * Lo que se lee en la píldora cuando está elegida (la maqueta del dueño: la activa
   * dice su nombre, las demás sólo el logo). Corto, porque vive en la fila de arriba a
   * 1280, y distinto en los dos Instagram por lo mismo que `label`.
   */
  corto: string;
  canal: 'whatsapp' | 'facebook' | 'instagram';
  /** `null` en WhatsApp: ahí no hay comentarios que separar. */
  tipo: 'mensaje' | 'comentario' | null;
  grupo: GrupoDeCanal;
}

const CANALES_DE_CAMPANA: readonly CanalDeLaMesa[] = [
  { id: 'whatsapp', label: 'WhatsApp', corto: 'WhatsApp', canal: 'whatsapp', tipo: null, grupo: 'mensajes' },
  { id: 'instagram-mensaje', label: 'Mensajes de Instagram', corto: 'Instagram', canal: 'instagram', tipo: 'mensaje', grupo: 'mensajes' },
  { id: 'messenger', label: 'Messenger', corto: 'Messenger', canal: 'facebook', tipo: 'mensaje', grupo: 'mensajes' },
  { id: 'facebook', label: 'Comentarios de Facebook', corto: 'Comentarios FB', canal: 'facebook', tipo: 'comentario', grupo: 'comentarios' },
  { id: 'instagram-comentario', label: 'Comentarios de Instagram', corto: 'Comentarios IG', canal: 'instagram', tipo: 'comentario', grupo: 'comentarios' },
];

/** Con qué canal abre la mesa de campaña: lo que se trabaja al entrar son los chats de WhatsApp. */
export const CANAL_INICIAL = 'whatsapp';

/** El ícono que no recorta. No es un canal: es la suma. */
export const TODOS_LOS_CANALES = 'todos';

export function canalesDeLaMesa(): readonly CanalDeLaMesa[] {
  return CANALES_DE_CAMPANA;
}

/**
 * Qué le pide la mesa al server (`useTablero`, `?canal=&tipo=`). `null` = todos
 * los canales.
 *
 * 🔴 **El canal del PUENTE le gana al ícono** (ADR 0104): el Dashboard abre el
 * Pipeline con los DMs que no entraron por ninguna línea, y su cifra cuenta DMs
 * — por eso va con `tipo=mensaje`.
 *
 * Un id que la mesa no ofrece (Formulario, un valor viejo) no recorta: nunca se
 * inventa un canal que no está en la lista.
 */
export function alcanceDeCanal(elegido: string, delPuente: 'facebook' | 'instagram' | null): AlcanceDeCanal | null {
  if (delPuente) return { canal: delPuente, tipo: 'mensaje' };
  const elegida = CANALES_DE_CAMPANA.find((c) => c.id === elegido);
  return elegida ? { canal: elegida.canal, tipo: elegida.tipo } : null;
}

/**
 * ¿Esta fila del desglose es de ese par? WhatsApp va sin `tipo`: ahí no hay
 * comentarios que separar, así que manda el canal solo.
 *
 * 🔴 **La regla del `tipo` es la del server, letra por letra** (#37): con ella recorta
 * cada columna, y si la suma por canal usara otra, la card diría una cifra y la
 * columna de abajo otra. `comentario` es todo lo que no es `mensaje`; `mensaje`, todo
 * lo que no es `comentario`; cualquier otro valor, sólo los `lead`. En campaña no hay
 * leads y equivale a comparar igual, pero se escribe la general.
 */
function esDelPar(f: Pick<FilaDesglose, 'canal' | 'tipo'>, par: AlcanceDeCanal): boolean {
  if (f.canal !== par.canal) return false;
  switch (par.tipo) {
    case null:
      return true;
    case 'comentario':
      return f.tipo !== 'mensaje';
    case 'mensaje':
      return f.tipo !== 'comentario';
    default:
      return f.tipo === 'lead';
  }
}

/**
 * ══ EL DESGLOSE DEL CANAL QUE SE ESTÁ MIRANDO (`mesaPorCanal=1`) ═════════════
 *
 * Con esa marca el server cuenta TODOS los canales en el desglose (y en el rango
 * puesto), porque la card de cada columna tiene que decir cuántos hay de cada uno.
 * Pero todo lo demás que sale del desglose —la cifra de la columna, el «hoy», los
 * respondidos, la leyenda del semáforo— tiene que describir LA LISTA QUE SE VE, y
 * esa lista es la del canal elegido. Se filtra acá, una vez, y la vista usa esto.
 *
 * 🔴 Sin el filtro, con WhatsApp puesto «Verdes 312» contaba los comentarios de
 * Facebook, y tocarlo dejaba doce tarjetas: el defecto que la fila de íconos vino
 * a deshacer, dicho en la leyenda en vez de en la cifra.
 */
export function filasDelCanal(
  desglose: readonly FilaDesglose[] | undefined,
  alcance: AlcanceDeCanal | null,
): FilaDesglose[] | undefined {
  if (!desglose) return undefined;
  return alcance ? desglose.filter((f) => esDelPar(f, alcance)) : [...desglose];
}

export interface ConteoDeCanal {
  /** El id del ícono (`CanalDeLaMesa.id`), para resaltar el elegido. */
  id: string;
  n: number;
}

/**
 * «CUÁNTOS DE WSPP, CUÁNTOS DE FB O IG HAY EN CADA COLUMNA» (pedido del dueño,
 * 13-sep-2026): los cinco pares de la fila de íconos, en su orden, contados sobre
 * una etapa. Formulario no entra, igual que en la fila.
 *
 * `null` = el desglose no trae `canal` (un server viejo, o un pedido sin
 * `mesaPorCanal`): ahí la card dice sólo la cifra y el título, en vez de una fila
 * de ceros que se leería como «no hay nada en Facebook».
 */
export function conteoPorCanal(desglose: readonly FilaDesglose[] | undefined, etapa: string): ConteoDeCanal[] | null {
  if (!desglose || desglose.some((f) => f.canal === undefined)) return null;
  const deLaEtapa = desglose.filter((f) => f.etapa === etapa);
  return CANALES_DE_CAMPANA.map((c) => ({
    id: c.id,
    n: deLaEtapa.reduce((suma, f) => (esDelPar(f, c) ? suma + f.n : suma), 0),
  }));
}

/**
 * Lo que dice el `title` de cada ícono: QUÉ trae, no sólo de qué red es — la
 * confusión que esta fila existe para deshacer.
 */
export function ayudaDeCanal(c: CanalDeLaMesa): string {
  switch (c.id) {
    case 'whatsapp':
      return 'Sólo los chats de WhatsApp';
    case 'instagram-mensaje':
      return 'Sólo los mensajes directos de Instagram';
    case 'messenger':
      return 'Sólo los mensajes directos de Facebook (Messenger)';
    case 'facebook':
      return 'Sólo los comentarios en las publicaciones de Facebook';
    case 'instagram-comentario':
      return 'Sólo los comentarios en las publicaciones de Instagram';
    default:
      return `Sólo ${c.label}`;
  }
}
