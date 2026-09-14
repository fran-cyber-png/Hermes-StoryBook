import type { AlcanceDeCanal } from '../../dominio/conversaciones';
import type { FilaDesglose } from '../../dominio/desglose';

/**
 * ══ EL CANAL DE LA MESA — la fila de íconos del Pipeline (13-sep-2026) ══════════
 *
 * Pedido del dueño: «que se entienda que no faltan leads por contestar, son
 * comentarios». «Te esperan» mezclaba en una sola cifra los chats de WhatsApp,
 * los DMs y los COMENTARIOS de Facebook e Instagram, y un número de mil y pico
 * se leía como mil y pico personas esperando una respuesta por WhatsApp. Ahora
 * la mesa se mira canal por canal, y **arranca en WhatsApp** — en las DOS mesas.
 *
 * 🔴 **NACIÓ SÓLO PARA CAMPAÑA** («estamos haciendo exclusivamente para campaña»,
 * Betto y Américo, 13-sep-2026) y al día siguiente el dueño la pidió para la
 * Escuela con el mismo diseño: «falta los filtros y el nuevo diseño a escuela
 * ventas, ajustémoslo bien» (14-sep-2026). La mecánica es UNA —esta tabla, un
 * solo `insigniaDe`, un solo `ayudaDeCanal`—; lo que cambia por módulo es la
 * lista que se ofrece (`canalesDeLaMesa`), y nada más.
 *
 * 🔴 **UNA FILA, DOS GRUPOS** (decisión del dueño): primero los MENSAJES —WhatsApp,
 * Instagram, Messenger— y después los COMENTARIOS —Facebook, Instagram—. Instagram
 * se PARTE: el riel de Mensajes lo dejaba en un solo ícono (`tipo: null`) y eso
 * volvía a mezclar justo lo que esta fila existe para separar. Formulario no va
 * «todavía» EN CAMPAÑA: ahí no hay landing de la Escuela.
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
 *
 * ══ Y EN VENTAS, LA MISMA FILA MÁS FORMULARIO (13 y 14-sep-2026) ══════════════
 *
 * La Escuela reusa los CINCO pares de arriba tal cual y agrega el que campaña
 * dejó afuera a propósito: acá SÍ hay landing (ADR 0051) y «Te esperan» ya
 * mezcla sus leads con los chats, así que el mismo defecto que esta fila
 * resolvió para campaña («¿de qué mil, si es otra cosa?») corre también acá.
 *
 * 🔴 **VENTAS TAMBIÉN ARRANCA EN WHATSAPP** (decisión del dueño, 14-sep-2026). La
 * primera versión de la fila en ventas (#1073, 13-sep) arrancaba en «Todos» para
 * que el tablero se pidiera byte a byte como antes mientras nadie tocara un ícono;
 * duró un día en `desarrollo` y no llegó a producción: el dueño eligió WhatsApp,
 * porque lo que se trabaja al abrir son los chats, en la Escuela igual que en la
 * campaña. Quien pone el arranque es `VistaEmbudo` (`CANAL_INICIAL`), no esta lista.
 *
 * 🔴 **FORMULARIO ES `canal: 'landing'`, Y NO ES UNA MARCA.** No tiene disco de
 * color (`BadgeCanal`: «landing NO está en CANAL, no tiene color de marca ni
 * disco») ni un `tipo` que lo separe de nada — a diferencia de Instagram y
 * Facebook, del lado de `leads` no hay comentarios que partir. Va en su PROPIO
 * grupo (`grupo: 'formulario'`), no en «mensajes»: un formulario no es un DM,
 * es lo contrario — nadie le escribió todavía (por eso ADR 0051 le dedica su
 * propia píldora en la tarjeta, y no lo cuenta como chat).
 *
 * ⚠️ **Con WhatsApp puesto, los formularios NO están en «Te esperan»**: se caen
 * del UNION con cualquier canal que no sea `landing` (la regla de ADR 0051 en el
 * server). No es una pérdida, es el filtro haciendo lo que dice: los leads se ven
 * en «Todos» y en su propio ícono, y la composición de la card los cuenta siempre.
 *
 * ⚠️ **`recorteDeCanalSql` (server) ya venía escrito pensando en esto**: filtra
 * por exclusión (`tipo NOT IN ('mensaje','comentario')`) en vez de por
 * igualdad, con su propio comentario explicando que escribirlo por igualdad
 * «en ventas se comería los formularios de "Te esperan" sin un error». El
 * server no se tocó para ventas — ya era genérico, y `mesaPorCanal=1` corre igual
 * con el módulo `ventas` (sus tests usan ese default).
 */

export type GrupoDeCanal = 'mensajes' | 'comentarios' | 'formulario';

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
  /** `landing` es Formulario (sólo en ventas): no es una red, es un lead sin conversación (ADR 0051). */
  canal: 'whatsapp' | 'facebook' | 'instagram' | 'landing';
  /** `null` en WhatsApp y en Formulario: ninguno de los dos separa comentario de mensaje. */
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

/** El par que campaña deja afuera a propósito («Form no lo pongamos aún») y ventas sí ofrece. */
const FORMULARIO: CanalDeLaMesa = {
  id: 'formulario',
  label: 'Formulario',
  corto: 'Formulario',
  canal: 'landing',
  tipo: null,
  grupo: 'formulario',
};

/** Los cinco de campaña, tal cual, más Formulario — nunca una segunda copia de los cinco. */
const CANALES_DE_VENTAS: readonly CanalDeLaMesa[] = [...CANALES_DE_CAMPANA, FORMULARIO];

/** Con qué canal abre la mesa, en los dos módulos: lo que se trabaja al entrar son los chats de WhatsApp. */
export const CANAL_INICIAL = 'whatsapp';

/** El ícono que no recorta. No es un canal: es la suma. */
export const TODOS_LOS_CANALES = 'todos';

/**
 * Qué íconos ofrece la mesa de ESTE módulo.
 *
 * `modulo` es opcional y por defecto `'campana'` — así ningún llamador viejo
 * (ni sus tests) se entera de que ventas existe: `canalesDeLaMesa()` sigue
 * siendo exactamente la lista de campaña, sin Formulario.
 */
export function canalesDeLaMesa(modulo: 'ventas' | 'campana' = 'campana'): readonly CanalDeLaMesa[] {
  return modulo === 'ventas' ? CANALES_DE_VENTAS : CANALES_DE_CAMPANA;
}

/**
 * Qué le pide la mesa al server (`useTablero`, `?canal=&tipo=`). `null` = todos
 * los canales.
 *
 * 🔴 **El canal del PUENTE le gana al ícono** (ADR 0104): el Dashboard abre el
 * Pipeline con los DMs que no entraron por ninguna línea, y su cifra cuenta DMs
 * — por eso va con `tipo=mensaje`.
 *
 * Un id que la mesa de ESE módulo no ofrece (un valor viejo, o «Formulario» sin
 * `modulo: 'ventas'`) no recorta: nunca se inventa un canal que no está en su
 * lista. `modulo` por defecto `'campana'`, como `canalesDeLaMesa` — mismo motivo.
 *
 * El resultado sólo dice QUÉ par pedir. Viaja como `?canal=&tipo=` junto con
 * `mesaPorCanal=1` en los dos módulos (`VistaEmbudo`): el par recorta las
 * columnas y la marca hace que el desglose venga por canal, para la composición
 * de cada card.
 */
export function alcanceDeCanal(
  elegido: string,
  delPuente: 'facebook' | 'instagram' | null,
  modulo: 'ventas' | 'campana' = 'campana',
): AlcanceDeCanal | null {
  if (delPuente) return { canal: delPuente, tipo: 'mensaje' };
  const elegida = canalesDeLaMesa(modulo).find((c) => c.id === elegido);
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
 * 13-sep-2026): los pares de la fila de íconos de ESE módulo, en su orden, contados
 * sobre una etapa. Los mismos que la fila ofrece y ninguno más: en campaña
 * Formulario no entra, en ventas sí (`canalesDeLaMesa`).
 *
 * `null` = el desglose no trae `canal` (un server viejo, o un pedido sin
 * `mesaPorCanal`): ahí la card dice sólo la cifra y el título, en vez de una fila
 * de ceros que se leería como «no hay nada en Facebook».
 */
export function conteoPorCanal(
  desglose: readonly FilaDesglose[] | undefined,
  etapa: string,
  modulo: 'ventas' | 'campana' = 'campana',
): ConteoDeCanal[] | null {
  if (!desglose || desglose.some((f) => f.canal === undefined)) return null;
  const deLaEtapa = desglose.filter((f) => f.etapa === etapa);
  return canalesDeLaMesa(modulo).map((c) => ({
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
    case 'formulario':
      return 'Sólo quienes llenaron el formulario de la landing, sin escribir todavía';
    default:
      return `Sólo ${c.label}`;
  }
}
