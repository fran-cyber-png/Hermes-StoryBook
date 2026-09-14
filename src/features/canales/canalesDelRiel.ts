import { insigniaDe } from '../../components/BadgeCanal';

/**
 * LOS CANALES DEL RIEL — la lista, y qué significa cada campo.
 *
 * Vivía adentro de `ColaUnificada.tsx`, que la usaba para un desplegable
 * «Canales ▾». Salió acá porque desde el 4-sep-2026 la dibujan DOS lugares —el
 * riel de la izquierda y la consulta que arma `useConversaciones`— y una
 * lista de canales copiada en dos archivos es la cicatriz #37 esperando: se
 * agrega uno en un lado, no en el otro, y el filtro miente sin fallar.
 *
 * ⚠️ **`canal` NO es lo mismo que la entrada del riel, y por eso son dos campos.**
 * `interactions.canal` dice `facebook` para las DOS cosas que Facebook sirve —el
 * comentario del muro y el mensaje de Messenger— y lo que las separa es `tipo`
 * (pedido del dueño, 25-ago-2026: «un directo de Facebook es Messenger»).
 * `logo` tampoco es siempre el canal: Messenger dibuja su propio glifo.
 *
 * 🔴 **Hasta el 7-sep-2026, `canal` viajaba al server y `tipo` se recortaba
 * acá, sobre cada página YA TRAÍDA** — con una Página que recibe más DM que
 * comentarios, sobrevivían 0 o 1 fila de verdad por página de 30, así que
 * hacían falta muchos clics en «Ver más» para juntar un puñado de
 * comentarios, y el `total` de la cabecera contaba Messenger como si fuera
 * Facebook. Ahora los DOS viajan al server (`consultarCola.ts`, `conTodo`),
 * que arma la página ya separada.
 *
 * ══ 🔴 «GRUPOS» NO ES UN FILTRO DE LA COLA, Y POR ESO TIENE `lista` ═════════
 *
 * Los cinco primeros angostan la MISMA lista de conversaciones 1-a-1. Grupos
 * muestra **otra cosa**: salas con su nombre, cuántos miembros y cuándo se las
 * vio por última vez. No están en `interactions` y no van a estarlo — viven en
 * `grupos_wa`/`grupo_miembros`, no tienen ficha, ni dueño, ni etapa.
 *
 * Meterlos en la lista de conversaciones rompería el diseño de la pantalla: la
 * ficha de la derecha no tendría a quién mostrar, y el vacío dice «Elige a
 * alguien de la cola», que para una sala no aplica. Por eso `lista` es explícito
 * y no se deduce del `id`: quien agregue el séptimo canal tiene que contestar
 * la pregunta a propósito.
 */
export interface OpcionDeCanal {
  id: string;
  label: string;
  /** Lo que se le pide al server. `null` cuando la entrada no filtra la cola. */
  canal: string | null;
  /** Lo que se le pide al server además de `canal`, para separar comentario de mensaje. */
  tipo: string | null;
  /**
   * El glifo a dibujar (`LogoDeCanal`). No siempre coincide con `canal`.
   *
   * 🔴 **`null` = no es una marca, y no se le presta la de otro.** Grupos no
   * tiene logo propio, y ponerle el de WhatsApp —aunque sea en gris— lo hace
   * leerse como un segundo WhatsApp roto. Se vio en la primera captura: la
   * entrada apagada era el mismo glifo verde en gris, y a eso no lo salva
   * quitarle el color. El riel dibuja gente cuando esto es `null`.
   */
  logo: string | null;
  /** Qué lista muestra: la cola de conversaciones, o las salas de WhatsApp. */
  lista: 'cola' | 'grupos';
  /**
   * Por qué no se puede elegir todavía. `null` = se puede.
   *
   * 🔴 **Es texto y no un booleano a propósito.** Un canal apagado sin motivo es
   * exactamente el defecto que este repo persigue —«un canal que muestra 0 sin
   * decir por qué»—: quien lo ve apagado se queda sin saber si le falta un
   * permiso, si está roto, o si todavía no existe.
   */
  porQueNo: string | null;
}

export const OPCIONES_CANAL: readonly OpcionDeCanal[] = [
  { id: 'whatsapp', label: 'WhatsApp', canal: 'whatsapp', tipo: null, logo: 'whatsapp', lista: 'cola', porQueNo: null },
  { id: 'facebook', label: 'Facebook', canal: 'facebook', tipo: 'comentario', logo: 'facebook', lista: 'cola', porQueNo: null },
  { id: 'messenger', label: 'Messenger', canal: 'facebook', tipo: 'mensaje', logo: 'messenger', lista: 'cola', porQueNo: null },
  { id: 'instagram', label: 'Instagram', canal: 'instagram', tipo: null, logo: 'instagram', lista: 'cola', porQueNo: null },
  { id: 'formulario', label: 'Formulario', canal: 'landing', tipo: null, logo: 'landing', lista: 'cola', porQueNo: null },
  {
    id: 'grupos',
    label: 'Grupos',
    canal: null,
    tipo: null,
    logo: null,
    lista: 'grupos',
    /**
     * ⚠️ **El motivo es que falta la RUTA, no que falten los datos.** El backend
     * de grupos ya existe (`server/src/grupos/`, tablas `grupos_wa` y
     * `grupo_miembros`) y el inventario al conectar los siembra con nombre y
     * participantes; lo que no hay es un endpoint que los liste. Cuando exista,
     * esto pasa a `null` y la entrada se enciende sola.
     */
    porQueNo: 'Todavía no se pueden listar las salas: falta la ruta que las lea.',
  },
];

/**
 * ⚠️ **«Formulario» sale en campaña** (pedido del dueño): ahí no hay landing de
 * la Escuela, así que ofrecerlo sería un filtro que siempre da cero.
 */
export function opcionesDeCanal(esDeCampana: boolean): readonly OpcionDeCanal[] {
  return esDeCampana ? OPCIONES_CANAL.filter((o) => o.id !== 'formulario') : OPCIONES_CANAL;
}

export function opcionDeCanal(
  id: string,
  esDeCampana: boolean,
): OpcionDeCanal | undefined {
  return opcionesDeCanal(esDeCampana).find((o) => o.id === id);
}

/**
 * EL COLOR DE MARCA DE CADA OPCIÓN — misma fuente que la píldora de canal de
 * cada fila (`insigniaDe`): no se inventa un segundo mapa de colores que pueda
 * divergir del que ya pinta la cola (#37). `Formulario` (`landing`) no tiene
 * color de marca A PROPÓSITO —no es una red social— y `insigniaDe` devuelve
 * `null`: el ícono se queda del color del texto.
 *
 * ⚠️ **Grupos tampoco lleva color**: no es un canal de Meta ni una red, es un
 * lugar de WhatsApp. Pintarlo del verde de WhatsApp lo haría parecer un segundo
 * WhatsApp, que es justo lo que no es.
 */
export function colorDeOpcionCanal(o: OpcionDeCanal): string | undefined {
  if (o.lista !== 'cola' || !o.canal || !o.logo) return undefined;
  return insigniaDe(o.canal, o.tipo ?? undefined)?.color;
}
