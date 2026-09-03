import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { api } from '../lib/datos/cliente';
import { intervaloDeCola, streamVivo } from '../lib/datos/latido';
import { esFiltroSec, parametrosDeCola, type EstadoCola } from './cola';
import type { FilaDesglose } from './desglose';

/**
 * Una fila de la cola unificada: o un comentario suelto (FB/IG) o una
 * conversación de mensajes agrupada (WhatsApp/Messenger). El servidor ya la
 * ordena por la urgencia de seis niveles (`server/src/cola/urgencia.ts`);
 * el front no reordena nada.
 */
export interface Conversacion {
  /** Clave estable: `int:<id>` para comentarios, `conv:<canal>:<persona>:<num>` para chats. */
  clave: string;
  /**
   * ⚠️ `landing` NO es un canal de chat: es un lead de formulario que todavía no
   * tiene conversación (ADR 0051). Entra a la cola por el tercer brazo del UNION
   * (`cola/leadsCte.ts`) y cae en «Te esperan» porque la pelota es nuestra.
   * Quien ramifique por canal tiene que contemplarlo — no hay hilo que abrir ni
   * línea por la que haya entrado.
   */
  canal: 'facebook' | 'instagram' | 'whatsapp' | 'landing';
  /**
   * ⚠️ `lead` es el tercer valor y **no es decorativo: gobierna el orden de la
   * cola**. `server/src/cola/urgencia.ts` decide con él si la fila es deuda
   * nuestra (niveles 0 y 3) o «el resto» (nivel 5). Estuvo faltando acá mientras
   * el server ya lo emitía, y el día que se preguntó por él quedó a la vista que
   * un lead caía en el nivel 5 — o sea, debajo de las 377 conversaciones de su
   * propia columna. Ver ADR 0051, enmienda del 11-ago-2026.
   */
  tipo: 'comentario' | 'mensaje' | 'lead';
  persona_id: string | null;
  persona_nombre: string | null;
  /** El número propio de Goberna por el que entró (solo mensajes). */
  numero_propio: string | null;
  texto: string | null;
  contexto_texto: string | null;
  /** Clase del último mensaje (imagen/video/audio/documento/sticker): para «📷 Foto» cuando no hay texto.
   *  Opcional: solo la cola (`/api/conversaciones`) la trae; el radar/agenda arman Conversacion sin ella. */
  ultima_clase?: string | null;
  /** Origen del último mensaje (anuncio/landing): para «📣 Vino del anuncio» cuando no hay texto ni media. */
  ultima_origen?: { fuente: string; titulo?: string | null } | null;
  /** El PRIMER anuncio de la conversación — de acá sale el curso (#128). */
  origen_anuncio?: { fuente: string; titulo?: string | null; adId?: string | null } | null;
  /** Derivada: hay un saliente posterior al último entrante. Nunca estado de fila. */
  respondida: boolean;
  /** Derivada: alguna vez salió un mensaje nuestro. Distinto de `respondida`
   *  (que es de quién es el turno HOY): quien volvió a escribir después de que
   *  la atendimos no es una desconocida. */
  ya_le_hablamos?: boolean;
  /** Derivada (`cola/precio.ts`): ya le pasamos el precio o la forma de pagarlo. */
  precio_enviado?: boolean;
  /** La etapa del embudo dicha por el SERVER (ADR 0013): max(manual, derivada),
   *  `perdido` terminal. Opcional hasta que el server desplegado la sirva (#88). */
  etapa_efectiva?: string | null;
  /** La última gestión asentada a mano (o null). Informativa; la que manda es la efectiva. */
  etapa_manual?: string | null;
  ventana_abierta: boolean;
  /**
   * CUÁNDO SE CIERRA LA PUERTA (server: `cola/ventana.ts`) — 24 h desde que la
   * persona escribió en un chat, 7 días desde que comentó en FB/IG. Viaja el
   * INSTANTE y no «6 h»: el texto envejece adentro del caché de IndexedDB
   * (ADR 0007) y un «quedan 6 h» serializado ayer hoy es mentira.
   *
   * `null` = no aplica (sin entrante, o un canal sin plazo). AUSENTE = el server
   * todavía no lo manda (N4 va solo, N5 es un botón), y ahí no se dibuja nada —
   * que es como se comportaba antes. La lectura vive en `canales/ventana.ts`.
   */
  ventana_cierra?: string | null;
  /**
   * ¿PIDIÓ ALGO? Los tres niveles del predicado viven en el server
   * (`cola/pregunta.ts`): precio, un sustantivo concreto, o un pedido genérico
   * que no sea el texto del anuncio.
   */
  pregunto: boolean;
  /** Nombró plata: precio, cuotas, yape, cómo inscribirse. Es el chip. */
  pregunto_precio?: boolean;
  /**
   * El último entrante lo escribió el ANUNCIO, no la persona. AUSENTE = server
   * viejo o respuesta rehidratada del caché (ADR 0007): ahí no se dibuja nada y
   * la fila se comporta como antes de este frente.
   */
  solo_clic?: boolean;
  /** Cuántos mensajes agrupa la conversación (1 en comentarios). */
  n: number;
  referencia: string;
  ultimo_at: string;
  /**
   * DESDE CUÁNDO ESTÁ EN SU ETAPA (server: `cola/tiempoEnEtapa.ts`) — el dato que
   * separa a dos tarjetas que la etapa iguala: una recibió el precio hace 40
   * minutos y la otra hace tres semanas.
   *
   * Viaja el INSTANTE, no «hace 12 d»: el texto envejece adentro del caché de
   * IndexedDB (ADR 0007), el timestamp no. Opcional y **nulable, que no es lo
   * mismo**: ausente = server viejo; `null` = no se pudo determinar (un
   * comentario respondido no guarda cuándo). Los dos casos se dibujan igual —no
   * se dibuja nada—, y por eso la lectura vive en `canales/antiguedad.ts`.
   */
  etapa_desde?: string | null;
  dias: number;
  /** La escala canónica de urgencia: 0 vivo · 1 vencido · 2 expira · 3 espera ·
   *  4 silencio · 5 resto — la misma que el radar del Dashboard. */
  nivel: 0 | 1 | 2 | 3 | 4 | 5;
  /** Estado PERSONAL de la vendedora sobre la conversación (cola potenciada #49).
   *  Opcionales: solo la cola (`/api/conversaciones`) los trae; radar/agenda no. */
  /** Fijada (pin): sube a la banda de arriba de todo (tope 3). */
  fijada?: boolean;
  /** Favorita: entra al tab «Favoritos». */
  favorita?: boolean;
  /** Sin leer: hay un entrante posterior al cursor de lectura. Distinto de `respondida`. */
  no_leido?: boolean;
  /**
   * CUÁNTOS entrantes hay después del cursor de lectura — el número del globito.
   *
   * ⚠️ **Opcional y hay que leerlo como opcional de verdad**: falta en un server
   * viejo (N4 sale solo, N5 es un botón) y en cualquier hilo rehidratado del
   * caché de IndexedDB (ADR 0007). Ausente NO es cero: es «este server no sabe
   * contarlo», y ahí el globito se comporta como antes.
   *
   * 🔴 **No es `n`, y confundirlos es el defecto que este campo vino a arreglar.**
   * `n` son los mensajes de la conversación y no mira el cursor, así que abrir el
   * chat no lo bajaba: sólo contestar. Quien venga de WhatsApp lee ese número
   * como «sin leer». El server los deriva juntos (`sinLeerSql` al lado de
   * `noLeidoSql`), así que `sin_leer > 0` equivale a `no_leido`.
   */
  sin_leer?: number;
  /** Las categorías (etiquetas) asignadas, en minúsculas — para la píldora de color. */
  categorias?: string[];
  /** CANDIDATOS del chip de curso (#72). La precedencia la decide `curso.ts`, no el server. */
  /** El interés más reciente asentado para esta conversación. */
  interes_curso?: string | null;
  /** El curso del formulario que la persona llenó (lead emparejado por teléfono). */
  lead_curso?: string | null;
  /** El nombre con el que llenó ESE formulario. Le gana al pushname de WhatsApp,
   *  que en producción suele ser «🦋W», «.» o «10 ❤️L» (#137). */
  lead_nombre?: string | null;
  /** Lo que el equipo anotó a mano en «Registrar contacto» (`contacto_ficha`,
   *  ADR 0060) — en campaña, sin Cerberus ni formulario, suele ser el ÚNICO
   *  nombre que existe (ampliación del 25-ago-2026). */
  ficha_nombre?: string | null;
  ficha_apellido?: string | null;
  /** EX-CLIENTE (#133): `vip` · `recompro` · `compro`, del cruce por teléfono
   *  contra el padrón local. Ausente = no se sabe (radar/agenda no lo traen, y un
   *  server sin el `db:push` tampoco). NUNCA se lee como «no es cliente». */
  cliente_nivel?: 'vip' | 'recompro' | 'compro' | null;
  /** Cuántas compras registra el padrón — el «×3» de la marca. */
  cliente_compras?: number | null;
  /** EL VEREDICTO DEL BOT (`cola/botSql.ts`): el bot se frenó y espera a una
   *  persona. Ausente = no se sabe (el radar y la agenda no lo traen, y un
   *  server sin la migración del bot tampoco). Se lee en `canales/bot.ts`. */
  bot_escalada?: boolean | null;
  /** `caliente` · `tibio` · `frio` — lo que el bot calificó. `null` = no dijo nada. */
  bot_temperatura?: string | null;
  /** El motivo CRUDO: uno de los seis `EscaladaMotivo` si escaló, o el texto
   *  libre del modelo si solo calificó. La traducción a criollo vive en `bot.ts`. */
  bot_motivo?: string | null;
  /** DE QUIÉN ES (reparto de leads, 4-ago-2026): el username de Cerberus de quien
   *  la tiene. `null`/ausente = sin dueño, y eso NO se lee como «es de nadie,
   *  agarrala»: un server sin la migración del reparto manda esto en cada fila.
   *  La marca de la píldora la decide `canales/dueno.ts`, puro y con tests. */
  asignada_a?: string | null;
  /** HASTA CUÁNDO ES SUYA, en ISO (ADR 0083). `null` = **no vence** —el dueño
   *  contestó y la pelota es del lead—, jamás «está libre». Los dos vacíos se
   *  distinguen mirando `asignada_a`, y colapsarlos deja abierto justo el caso
   *  más trabado. La lectura la decide `dominio/tenencia.ts`, puro y con tests. */
  asignada_hasta?: string | null;
}

type Pagina = {
  conversaciones: Conversacion[];
  total?: number;
  hayMas: boolean;
  /** El server sirvió la cola SIN estado personal (la tabla no existe todavía). */
  sinEstado?: boolean;
  /** Conteos reales por etapa efectiva sobre la misma ventana (#89). Solo primera página. */
  conteos?: Record<string, number>;
  /** Cuántas filas daría cada filtro secundario dentro del recorte actual. Primera página. */
  conteosFiltro?: {
    preguntoPrecio: number;
    teEscribieron: number;
    /** La deuda entera, sin corte de antigüedad. Ya no tiene chip: eran 505 y el
     *  93 % de más de una semana. Se sigue contando porque es el número que dice
     *  si la deuda vieja crece. */
    sinResponder?: number;
    yaCompraron?: number;
    /** El bot se frenó y espera a una persona. Opcional: un server viejo no lo manda. */
    botEscalada?: number;
    botCaliente?: number;
    /** Cuántas tienen la ventana abierta (`cola/ventana.ts`). Opcional: server viejo. */
    puedoEscribirle?: number;
    /** Cuántas te asignó el reparto — SIEMPRE contadas con el filtro apagado, así
     *  el chip puede decir su número antes de que lo toquen. */
    mios?: number;
  };
  /** El server sirvió la cola SIN la marca de ex-cliente (falta el `db:push` de #133). */
  sinPadron?: boolean;
  /** Se pidió «las mías» y `numero_vendedora` no le asigna ninguna: vino TODO. */
  sinLineasPropias?: boolean;
  /** El server sirvió la cola SIN dueño: falta la migración del reparto. */
  sinAsignacion?: boolean;
  /**
   * Se pidió «Míos» (`?mios=1`), así que esta cola YA es solo lo suyo.
   *
   * ⚠️ **Antes también se prendía sola**, al estar en una rueda del reparto, y era
   * lo que decidía el rótulo de la cabecera. Ese recorte automático murió: quién
   * ve qué es propiedad del ROL, y lo que hay que leer para el rótulo es
   * `colaRecortada`. Se conserva en el tipo porque el server lo sigue mandando —
   * hoy ninguna pantalla manda `?mios=1`, así que en la práctica nunca llega.
   */
  enElReparto?: boolean;
  /**
   * EL SERVER APLICÓ LA FRONTERA DEL ROL: esta cola trae lo de quien pregunta más
   * lo huérfano de sus líneas, y el trabajo repartido a otra persona **no viajó**.
   *
   * ⚠️ **Opcional, y ausente NO es «no hay recorte»**: un server viejo no lo manda
   * y una página rehidratada del caché de IndexedDB (ADR 0007) tampoco. Es «no se
   * sabe», y de eso no se afirma nada — ver `RotuloDeLaCola`.
   */
  colaRecortada?: boolean;
  /**
   * QUIEN MIRA TRAJO SU PROPIA LÍNEA (la vinculó por QR desde Hermes), así que
   * esta cola es **su línea entera más lo que le asignaron en las otras** — y
   * NADA del archivo de las líneas que no tienen dueña.
   *
   * 🔴 **Cambia lo que la pantalla puede AFIRMAR, no cómo se ve una fila.** Sin
   * esto, el rótulo de la cabecera le promete «lo que todavía no tiene dueña»
   * (`RotuloDeLaCola`) — que para esta persona es exactamente la rama que se le
   * cayó, o sea una explicación falsa sobre por qué su número bajó. Y el vacío
   * diría «nada cayó con estos filtros», que también es falso: cayó, no es suyo
   * y todavía no le asignaron nada. Es el mismo problema que `soloMisAsignadas`
   * resuelve en el Dashboard (ADR 0036).
   *
   * ⚠️ **Opcional, y ausente NO es «no tiene línea propia»**: es «no se sabe» —
   * un server viejo no lo manda (el front sale por N4 y el server por N5) y una
   * página rehidratada del caché de IndexedDB tampoco (ADR 0007). Se lee
   * `?? false` / `=== true`: no afirmar nada deja el texto de siempre, que como
   * mucho es incompleto. Al revés se afirmaría un recorte sobre la cola de todo
   * el equipo.
   */
  conLineaPropia?: boolean;
  /**
   * EL BLOQUEO DE CHAT ESTÁ PRENDIDO EN ESTE SERVER (ADR 0083): quien no es el
   * dueño de una conversación vigente no puede escribir en ella.
   *
   * 🔴 **Viaja explícito porque `asignada_hasta` NO alcanza para deducirlo**:
   * `null` ahí significa dos cosas opuestas —«no vence, es suya» y «este server
   * no sabe de esto»— y elegir mal cuesta caro en las dos direcciones. Sin el
   * campo, un N4 desplegado antes que N5 bloquearía todo lo que tenga dueño, que
   * en producción son 3.637 conversaciones.
   *
   * ⚠️ **Opcional, y ausente es «como antes de este frente»**, igual que
   * `colaRecortada` y `conLineaPropia`: un server viejo no lo manda y una página
   * rehidratada del caché de IndexedDB (ADR 0007) tampoco. Se lee `=== true`.
   * Para algo que QUITA una capacidad, no afirmar nada es la degradación
   * correcta.
   */
  bloqueoDeChat?: boolean;
  /** La misma foto abierta por «ya le hablamos» × precio × viva × ventana. Solo primera página. */
  desglose?: FilaDesglose[];
};

/**
 * La cola unificada. Mismo patrón que `useInteracciones` (infinite query cacheada
 * por filtros), pero contra `/api/conversaciones`: una fila por conversación, no
 * por mensaje. Los ejes (tab, filtro secundario, categoría, etapa) van en
 * `estado` y se traducen a query-params con `parametrosDeCola` (lógica pura,
 * testeada aparte).
 *
 * `etapa` (#89/#90): la carga POR COLUMNA del Pipeline — filtra por etapa
 * efectiva en el server. Solo entra a la queryKey/URL cuando se pide, así las
 * queries de siempre (Mensajes) conservan su clave y su caché persistido.
 */
export function useConversaciones(
  estado: EstadoCola | string = { tab: 'todo', filtroSec: '', categoria: null },
  canal = '',
  etapa = '',
) {
  // Compat: `VistaEmbudo` (otro frente) todavía llama `useConversaciones(intencion, canal, etapa)`
  // por posición, con el string viejo de intención. Un string legado se normaliza
  // a un estado: `''` = todo, y solo los filtros que HOY existen sobreviven como
  // filtro secundario; `canal`/`etapa` posicionales entran igual al estado.
  const norm: EstadoCola =
    typeof estado === 'string'
      ? {
          tab: 'todo',
          filtroSec: esFiltroSec(estado) ? estado : '',
          categoria: null,
          canal: canal || undefined,
          etapa: etapa || undefined,
        }
      : estado;
  const base = parametrosDeCola(norm);

  const q = useInfiniteQuery({
    queryKey: ['conversaciones', base],
    /**
     * ══ 🔴 FILTRAR NO VACÍA LA PANTALLA — 21-ago-2026 ═══════════════════════
     *
     * `base` son los filtros, así que **cada tab, cada chip y cada cambio de
     * línea es una `queryKey` NUEVA**: fallo de caché garantizado. Sin esto, la
     * lista se vaciaba y quedaba un esqueleto hasta que volviera el servidor —
     * y esa consulta tiene p50 de 3,73 s medido en producción DESPUÉS de los
     * arreglos del pool. Antes eran 6,04 s con un 21 % de 5xx.
     *
     * Se lee como «la app tarda en renderizar», y no es el render: es la
     * pantalla vaciándose. Con `keepPreviousData` la lista anterior se queda
     * puesta, atenuada por `actualizando`, y se reemplaza cuando llega la nueva.
     *
     * ⚠️ **NO es lo mismo que el caché de IndexedDB** (ADR 0007), y por eso hacen
     * falta los dos: aquél restaura la ÚLTIMA cola al arrancar la app —una sola
     * combinación de filtros, la que estaba abierta al cerrar—; esto cubre el
     * salto ENTRE combinaciones dentro de la misma sesión, que es donde la
     * vendedora pasa el día.
     *
     * ⚠️ **Lo que cuesta, dicho**: durante ese lapso la pantalla muestra filas
     * que NO cumplen el filtro que el chip ya dibuja como activo. Es aceptable
     * porque `actualizando` ya viaja hasta la barra y la atenúa —o sea que la
     * pantalla DICE que está trayendo—, y porque la alternativa era mostrar
     * cero filas, que es afirmar «no hay nada acá» sobre algo que todavía no se
     * preguntó. En este repo eso es peor: la cicatriz de `sinLineasPropias` y
     * `VacioDeLineaPropia` es exactamente ésa.
     */
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      /**
       * CON UNA ETIQUETA ACTIVA, TODO DE UNA — no de a 30.
       *
       * El paginado de 30 existe para la cola sin filtro, que puede tener
       * miles de filas: cargarla entera de una sería el problema que el
       * paginado vino a evitar. Una lista curada por etiqueta es lo opuesto
       * — chica y cerrada (140 del Foro) — y con «no leídos primero»
       * (ColaUnificada) paginada a 30, ese orden solo vale DENTRO de cada
       * página cargada: un sin-leer en la página 3 se ve recién después de
       * tres clics en «Ver más». Pedir más de una hace que el orden sea el
       * de casi toda la lista desde el primer render.
       *
       * ⚠️ **100 y no más**: `consultarCola.ts` clampea a `Math.min(limit, 100)`
       * — pedir de más no trae de más, solo miente sobre cuánto se está
       * pidiendo. Con 140 en el Foro, esto deja UN «Ver más» en vez de cinco.
       */
      const limit = base.categoria ? '100' : '30';
      const p = new URLSearchParams({ ...base, limit, offset: String(pageParam) });
      return api<Pagina>(`/api/conversaciones?${p}`);
    },
    getNextPageParam: (ultima, todas) =>
      ultima.hayMas ? todas.reduce((n, p) => n + p.conversaciones.length, 0) : undefined,
    /**
     * EL RITMO DEPENDE DE SI EL PUSH ESTÁ VIVO — no de un número fijo.
     *
     * El tiempo real lo maneja el SSE, que invalida esta clave al instante por
     * cada mensaje (`lib/datos/tiempoReal.ts`). Este intervalo es la RED: lo
     * que queda cuando el stream no está. Y hasta el 19-ago-2026 corría a
     * 20–30 s **aunque el stream estuviera perfecto**: 13.152 pedidos el 18-ago
     * a la consulta más cara del sistema (2,4 s) contra **220 mensajes reales
     * en todo el día**.
     *
     * `streamVivo()` responde con el latido del stream —bytes recibidos hace
     * menos de 60 s, o sea dos keep-alives— y la decisión vive pura en
     * `lib/datos/latido.ts`. Con el push vivo: 5 minutos. Sin él: el ritmo de
     * hoy, jitter incluido.
     *
     * ⚠️ **El intervalo se recalcula recién cuando su timer vence**, así que si
     * el stream se cae con la cola en 300 s, el ritmo corto puede tardar hasta
     * 5 minutos en entrar. Lo que cubre ese hueco NO es este intervalo: es la
     * invalidación explícita que `tiempoReal.ts` dispara **al reconectar**.
     *
     * ⚠️ **`refetchOnWindowFocus: true` se queda**: es la única de todo Hermes
     * (el default global está en `false`) y con el poll espaciado pasa a ser
     * más importante, no menos — volver a la pestaña es cuando la vendedora
     * mira la cola.
     */
    refetchOnWindowFocus: true,
    refetchInterval: () => intervaloDeCola(streamVivo(), Math.random()),
  });

  return {
    items: q.data?.pages.flatMap((p) => p.conversaciones) ?? [],
    total: q.data?.pages[0]?.total ?? 0,
    /** Los conteos del embudo (primera página): el total real de cada columna del tablero. */
    conteos: q.data?.pages[0]?.conteos,
    /** Cuántas daría cada chip de filtro sin salir del recorte actual (#72). */
    conteosFiltro: q.data?.pages[0]?.conteosFiltro,
    /** El desglose (primera página): las bandas de la bandeja y el recorte por precio. */
    desglose: q.data?.pages[0]?.desglose,
    hayMas: Boolean(q.hasNextPage),
    cargando: q.isPending,
    cargandoMas: q.isFetchingNextPage,
    cargarMas: () => void q.fetchNextPage(),
    /**
     * Cuándo se trajo esto. Al abrir la app la cola se pinta desde el caché
     * persistido, y hasta que llegue lo fresco hay que decir de cuándo es
     * (ver `lib/datos/persistencia.ts`).
     */
    traidoEn: q.dataUpdatedAt,
    actualizando: q.isFetching,
    /**
     * El server no pudo leer el estado personal (falta el `db:push` de
     * `estado_conversacion`). La cola igual sirve; la UI lo dice en voz alta en
     * vez de fingir que nadie fijó ni marcó nada.
     */
    sinEstado: q.data?.pages[0]?.sinEstado === true,
    /**
     * Se pidió «las mías» y el mapa `numero_vendedora` no le asigna ninguna, así
     * que el server sirvió TODO (fail-open). La UI lo dice: un filtro que no
     * filtra y no avisa se ve igual que uno que sí, y la vendedora creería que
     * esas conversaciones son suyas.
     */
    sinLineasPropias: q.data?.pages[0]?.sinLineasPropias === true,
    /**
     * El server sirvió la cola SIN el dueño de cada conversación: falta la
     * migración del reparto. Se dice para que la pantalla no ofrezca un filtro
     * «Míos» que devolvería cero por una razón que no es «no te tocó nada».
     */
    sinAsignacion: q.data?.pages[0]?.sinAsignacion === true,
    /**
     * EL SERVER APLICÓ LA FRONTERA DEL ROL: esta cola es lo de quien pregunta más
     * lo huérfano de sus líneas. La pantalla lo usa para DECIRLO — sin la píldora
     * «Vos» (retirada por ser la misma marca en todas las filas), una cola propia
     * se ve idéntica a la de todos, y el número de la cabecera cae sin explicación.
     *
     * ⚠️ **`=== true` y no `?? false`, y la diferencia importa acá**: lo que se
     * quiere distinguir es «el server dijo que recortó» de «el server no dijo
     * nada» (server viejo, o caché rehidratado). Ausente cae en `false` y el
     * rótulo no afirma nada, que es lo correcto.
     *
     * ⚠️ Reemplaza a `enElReparto` en este lugar: aquél respondía «¿está en una
     * rueda?», que dejó de gobernar lo que se ve.
     */
    colaRecortada: q.data?.pages[0]?.colaRecortada === true,
    /**
     * TRAJO SU PROPIA LÍNEA: la cola es su línea entera + lo que le asignen en
     * las otras. La pantalla lo usa para DECIRLO — hoy son dos personas que van
     * a abrir la cola y ver muy poco, porque el dueño todavía no les asignó nada
     * en la línea compartida (medido el 18-ago-2026: cero filas en
     * `conversacion_asignada` para las dos). Un vacío sin motivo se lee «se
     * perdieron las conversaciones».
     *
     * ⚠️ `=== true` y no `?? true`: ausente es «no se sabe» y no se afirma nada.
     */
    conLineaPropia: q.data?.pages[0]?.conLineaPropia === true,
    /**
     * EL BLOQUEO DE CHAT ESTÁ PRENDIDO (ADR 0083). La pantalla lo usa para apagar
     * el compositor de una conversación ajena y para dibujar el contorno.
     *
     * ⚠️ `=== true`, como los dos de arriba y por un motivo más fuerte: acá
     * ausente no deja un rótulo incompleto, **evita quitarle a todo el equipo la
     * capacidad de escribir** mientras N5 todavía no salió.
     */
    bloqueoDeChat: q.data?.pages[0]?.bloqueoDeChat === true,
  };
}

/**
 * ¿ESTE SERVER TIENE PRENDIDO EL BLOQUEO DE CHAT? (ADR 0083)
 *
 * ══ POR QUÉ SE LEE DEL CACHÉ Y NO SE PIDE ═══════════════════════════════════
 *
 * Es un dato GLOBAL que viaja pegado a las filas de la cola, y quien lo necesita
 * —el hilo abierto— cuelga de `App` y no de `ColaUnificada`: bajarlo por props
 * serían tres componentes intermedios cargando un booleano que no usan. Pedirlo
 * por su cuenta sería una consulta nueva de la más cara del repo (p50 3,73 s
 * medido) para traer un `true`.
 *
 * Así que se lee lo que la cola YA trajo, con `getQueriesData` sobre el prefijo:
 * cualquier página de cualquier filtro sirve, porque el campo no depende de los
 * filtros.
 *
 * 🔴 **Sin nada en el caché devuelve `false`, y ésa es la dirección segura.**
 * Este booleano QUITA la capacidad de escribir: equivocarse hacia `true` deja a
 * una vendedora mirando un compositor apagado sin motivo. Hacia `false` se
 * comporta como antes del frente y el candado de verdad —el del server— sigue
 * rechazando el envío igual.
 */
export function useBloqueoDeChat(): boolean {
  return useDeLaCola((paginas) =>
    paginas.some((p) => p.pages?.some((pag) => pag.bloqueoDeChat === true)),
  );
}

/**
 * LA TENENCIA VIVA DE UNA CONVERSACIÓN — no la de cuando se abrió.
 *
 * ══ 🔴 EL DEFECTO QUE ESTO CIERRA, y es JUSTO el que ADR 0083 existe para
 *    evitar ═══════════════════════════════════════════════════════════════════
 *
 * `App` guarda la conversación abierta en un `useState` que se **congela al
 * hacer clic**. Cuando otra persona toma ese chat, la cola refresca sola —la
 * fila de la lista ya dibuja la píldora del dueño nuevo— pero el panel del chat
 * sigue leyendo la foto vieja: contorno apagado, caja habilitada, y quien
 * escribe se come el rechazo del server después de haber tecleado.
 *
 * Medido el 24-ago-2026 con dos sesiones abiertas: a los **30 segundos** de que
 * el otro tomara el chat, la pestaña seguía dejando escribir, y sólo un reload
 * lo corregía. Es exactamente el conflicto que el frente vino a cortar, ocurrido
 * adentro del frente.
 *
 * ⚠️ **Se suscribe al caché, no lo lee y ya.** `getQueriesData` es una lectura de
 * una sola vez: sin la suscripción, el componente no se vuelve a pintar cuando la
 * cola trae el dueño nuevo y el arreglo no arregla nada. Ese matiz es el frente
 * entero — la primera versión leía el caché y **seguía sin enterarse**.
 *
 * ⚠️ **Ausente NO es «libre»**: si esta clave no está en ninguna página cacheada
 * (la cola se filtró, la conversación salió del recorte), se devuelve `null` y
 * el llamador se queda con lo que traía. Tratarlo como libre abriría la caja
 * justo cuando se perdió de vista quién la tiene.
 */
export function useTenenciaViva(
  clave: string | null | undefined,
): { asignada_a?: string | null; asignada_hasta?: string | null } | null {
  return useDeLaCola((paginas) => {
    if (!clave) return null;
    for (const p of paginas) {
      for (const pagina of p.pages ?? []) {
        const fila = pagina.conversaciones?.find((c) => c.clave === clave);
        if (fila) return { asignada_a: fila.asignada_a, asignada_hasta: fila.asignada_hasta };
      }
    }
    return null;
  });
}

type PaginasDeLaCola = { pages?: Pagina[] };

/**
 * Leer algo de lo que la cola YA trajo, **y volver a pintar cuando cambie**.
 *
 * ══ POR QUÉ DEL CACHÉ Y NO PIDIENDO ═════════════════════════════════════════
 *
 * Quien necesita estos datos —el hilo abierto— cuelga de `App` y no de
 * `ColaUnificada`: bajarlos por props serían tres componentes intermedios
 * cargando algo que no usan. Y pedirlos por su cuenta sería repetir la consulta
 * más cara del repo (p50 3,73 s medido) para releer una fila que ya está en
 * memoria.
 *
 * `useSyncExternalStore` sobre el `QueryCache` es lo que convierte esa lectura en
 * algo vivo. El selector tiene que devolver valores **comparables por
 * identidad** o el store re-renderiza sin parar: por eso el objeto de
 * `useTenenciaViva` se serializa antes de compararlo.
 */
function useDeLaCola<T>(seleccionar: (paginas: PaginasDeLaCola[]) => T): T {
  const qc = useQueryClient();
  const leer = useCallback(() => {
    const datos = qc
      .getQueriesData<PaginasDeLaCola>({ queryKey: ['conversaciones'] })
      .map(([, d]) => d)
      .filter((d): d is PaginasDeLaCola => Boolean(d));
    return seleccionar(datos);
  }, [qc, seleccionar]);

  // La foto se guarda serializada para que `useSyncExternalStore` compare por
  // VALOR: devolver un objeto nuevo en cada lectura lo haría re-renderizar en
  // bucle («getSnapshot should be cached»).
  const ultimo = useRef<{ crudo: T; serie: string } | null>(null);
  const snapshot = useCallback(() => {
    const valor = leer();
    const serie = JSON.stringify(valor ?? null);
    if (!ultimo.current || ultimo.current.serie !== serie) {
      ultimo.current = { crudo: valor, serie };
    }
    return ultimo.current.crudo;
  }, [leer]);

  const suscribir = useCallback(
    (avisar: () => void) => qc.getQueryCache().subscribe(avisar),
    [qc],
  );

  return useSyncExternalStore(suscribir, snapshot, snapshot);
}

/** Un cambio de estado personal de una conversación (pin / favorita / leído). */
export interface CambioEstadoConversacion {
  clave: string;
  fijada?: boolean;
  favorita?: boolean;
  leido?: boolean;
}

/**
 * Fijar / marcar favorita / marcar leído — la mutación contra
 * `PUT /api/conversaciones/estado`. Es una ESCRITURA (una acción humana): al
 * terminar invalida la cola para que el pin/estrella/punto azul se repinten.
 * Fijar con el tope lleno devuelve 409 (`ErrorApi`), que la UI muestra sin
 * esconder. `marcarLeido` avanza el cursor cross-canal al abrir cualquier hilo.
 */
export function useEstadoConversacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cambio: CambioEstadoConversacion) =>
      api('/api/conversaciones/estado', { method: 'PUT', body: JSON.stringify(cambio) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['conversaciones'] });
    },
  });
}


/** El recorte de UNA columna del tablero. Uno por columna, nunca dos (ADR 0044). */
export type RecorteDeColumna = 'precio' | 'ventana' | 'seguir' | 'seCallo';

/**
 * La franja de tiempo de una columna, ya resuelta a instantes (`vistas/franja.ts`).
 * `hasta: null` = «hasta ahora»: la franja no tiene borde de arriba.
 */
export interface FranjaDeColumna {
  desde: string;
  hasta: string | null;
}

/** Qué columna se pide, con qué recorte y en qué franja. El orden es el que se dibuja. */
export interface ColumnaDelTablero {
  etapa: string;
  recorte?: RecorteDeColumna;
  /**
   * ⚠️ **Va a UNA columna, no al tablero.** El server obliga a nombrarla
   * (`?franjaEn=`) justamente para que no pueda aplicarse a las cinco: filtrar
   * «Nunca contestaron · última hora» no puede vaciar Cotizados.
   */
  franja?: FranjaDeColumna;
}

/** Lo que el server sirve por columna en `/api/conversaciones/tablero`. */
interface ColumnaServida {
  conversaciones: Conversacion[];
  total: number;
  hayMas: boolean;
}

type RespuestaTablero = Pick<Pagina, 'conteos' | 'desglose' | 'colaRecortada' | 'conLineaPropia'> & {
  columnas?: Record<string, ColumnaServida>;
};

/** `interesado,cotizado:seguir,cierre` — lo que el server sabe leer. */
export function claveDeColumnas(columnas: readonly ColumnaDelTablero[]): string {
  return columnas.map((c) => (c.recorte ? `${c.etapa}:${c.recorte}` : c.etapa)).join(',');
}

/**
 * La columna que trae franja, si hay alguna. **Es UNA sola**: el server pide
 * `?franjaEn=` para saber a cuál aplicarla, y dos franjas necesitarían dos
 * nombres. Hoy la ofrece solo «Nunca contestaron»; si mañana la ofrece otra, esto
 * es lo que hay que abrir (acá y en `franjaPedida.ts`, del otro lado).
 */
function conFranja(columnas: readonly ColumnaDelTablero[]): ColumnaDelTablero | undefined {
  return columnas.find((c) => c.franja);
}

/**
 * Los parámetros de la franja, listos para pegar en la URL — y para entrar a la
 * `queryKey`.
 *
 * 🔴 **QUE ENTREN A LA CLAVE ES LA MITAD DEL TRABAJO.** TanStack cachea por
 * clave: sin los instantes adentro, tocar «Hoy» y después «Última hora» daría
 * DOS pedidos con la misma clave, y el segundo se serviría de la caché del
 * primero. La vendedora vería la lista de «Hoy» debajo de un chip que dice
 * «Última hora» — el mismo defecto que el server persigue con sus 400.
 */
export function paramsDeFranja(columnas: readonly ColumnaDelTablero[]): string {
  const col = conFranja(columnas);
  if (!col?.franja) return '';
  const p = new URLSearchParams({ franjaEn: col.etapa, desde: col.franja.desde });
  if (col.franja.hasta) p.set('hasta', col.franja.hasta);
  return `&${p}`;
}

/** Sin repetidas y conservando el orden: la primera aparición de cada clave manda. */
function sinRepetir(filas: readonly Conversacion[]): Conversacion[] {
  const vistas = new Set<string>();
  const salida: Conversacion[] = [];
  for (const f of filas) {
    if (vistas.has(f.clave)) continue;
    vistas.add(f.clave);
    salida.push(f);
  }
  return salida;
}

/**
 * ══ EL TABLERO ENTERO EN UN PEDIDO ═══════════════════════════════════════════
 *
 * 🔴 **CINCO `useConversaciones` ERAN CINCO VECES LA CONSULTA MÁS CARA DEL
 * REPO.** El Pipeline montaba un hook por columna y cada uno pedía
 * `/api/conversaciones?etapa=…`; del lado del server, cada pedido rearmaba desde
 * cero la tabla temporal `todo` — 2.226 ms medidos en producción el 19-ago-2026.
 * Con DOS vendedoras adentro eso fueron **4.431 materializaciones en 100
 * minutos**, load 15 sobre 8 núcleos y la API devolviendo 504 durante minutos
 * enteros. Acá el tablero pide UNA vez y el server recorta las cinco columnas
 * sobre el mismo `todo`.
 *
 * ⚠️ **Y baja el costo de cada mensaje que entra, no sólo el del reloj.** El SSE
 * invalida `['conversaciones']` por cada mensaje (`lib/datos/tiempoReal.ts`), y
 * esa clave la comparten los cinco hooks: un solo mensaje disparaba **cinco**
 * consultas. Por eso la clave de acá arranca igual —el tiempo real la tiene que
 * seguir alcanzando— pero ahora es UNA.
 *
 * ⚠️ **«Cargar más» sigue yendo por `/api/conversaciones?etapa=&offset=`**, y es
 * a propósito: sobre 13.285 pedidos de una mañana el **97 %** son `offset=0`.
 * Darle paginación por columna al endpoint nuevo sería complicar el contrato
 * para el 3 % — y ese 3 % paga un `todo` que ya pagaba antes.
 */
export function useTablero(columnas: readonly ColumnaDelTablero[]) {
  const clave = claveDeColumnas(columnas);
  const franja = paramsDeFranja(columnas);

  const q = useQuery({
    // 🔴 ARRANCA CON `conversaciones` PORQUE EL SSE INVALIDA ESE PREFIJO. Con una
    // clave propia el tablero dejaría de refrescarse al llegar un mensaje y sólo
    // se enteraría por el reloj — que con el push vivo son 5 minutos.
    queryKey: ['conversaciones', 'tablero', clave, franja],
    queryFn: () =>
      api<RespuestaTablero>(
        `/api/conversaciones/tablero?columnas=${encodeURIComponent(clave)}&limit=30${franja}`,
      ),
    // El mismo ritmo que la cola de Mensajes, por la misma razón: con el stream
    // vivo el poll es la red y no la fuente (`lib/datos/latido.ts`).
    refetchOnWindowFocus: true,
    refetchInterval: () => intervaloDeCola(streamVivo(), Math.random()),
  });

  /**
   * Las páginas que «Cargar más» trajo, por columna. Viven acá y no en la query
   * porque son de OTRO endpoint: mezclarlas en la caché del tablero haría que un
   * refresco del tablero las borrara sin avisar.
   */
  const [extra, setExtra] = useState<Record<string, { filas: Conversacion[]; hayMas: boolean }>>({});
  const [trayendo, setTrayendo] = useState<string | null>(null);

  /**
   * ⚠️ **Cambiar un recorte tira las páginas extra**, y no es prolijidad: son
   * filas del recorte ANTERIOR. Sin esto, tocar «Para seguir» en una columna con
   * dos páginas cargadas dejaría 30 tarjetas que el chip nuevo excluye, debajo de
   * un encabezado que promete otra cosa.
   */
  useEffect(() => {
    setExtra({});
  }, [clave, franja]);

  const cargarMas = useCallback(
    async (col: ColumnaDelTablero, yaTengo: number) => {
      setTrayendo(col.etapa);
      try {
        const p = new URLSearchParams({ etapa: col.etapa, limit: '30', offset: String(yaTengo) });
        if (col.recorte) p.set(col.recorte, '1');
        // La página 2 tiene que traer LA MISMA lista: sin la franja, «Ver más»
        // llenaría la columna de tarjetas que el chip excluye.
        if (col.franja) {
          p.set('franjaEn', col.etapa);
          p.set('desde', col.franja.desde);
          if (col.franja.hasta) p.set('hasta', col.franja.hasta);
        }
        const r = await api<Pagina>(`/api/conversaciones?${p}`);
        setExtra((e) => ({
          ...e,
          [col.etapa]: {
            filas: [...(e[col.etapa]?.filas ?? []), ...r.conversaciones],
            hayMas: r.hayMas,
          },
        }));
      } finally {
        setTrayendo(null);
      }
    },
    [],
  );

  const porColumna = Object.fromEntries(
    columnas.map((col) => {
      const servida = q.data?.columnas?.[col.etapa];
      const mas = extra[col.etapa];
      /**
       * ⚠️ **Se deduplica por clave y no es defensivo.** La página 0 la trae el
       * tablero y las siguientes otro endpoint, en otro momento: entre las dos, un
       * mensaje nuevo puede correr una fila de la página 1 a la 0 y quedaría dos
       * veces — con la misma tarjeta arrastrable duplicada en la misma columna.
       */
      const items = sinRepetir([...(servida?.conversaciones ?? []), ...(mas?.filas ?? [])]);
      return [
        col.etapa,
        {
          items,
          /** El total de la columna ENTERA (recorte incluido), no el de la página. */
          total: servida?.total ?? 0,
          hayMas: mas ? mas.hayMas : (servida?.hayMas ?? false),
          cargando: q.isPending,
          cargandoMas: trayendo === col.etapa,
          cargarMas: () => void cargarMas(col, items.length),
        },
      ];
    }),
  );

  return {
    porColumna,
    /** La foto del embudo, contada UNA vez para todas las columnas. */
    desglose: q.data?.desglose,
    conteos: q.data?.conteos,
    cargando: q.isPending,
    actualizando: q.isFetching,
    traidoEn: q.dataUpdatedAt,
    /** El server aplicó la frontera del rol: la pantalla lo DICE (ver `Pagina`). */
    colaRecortada: q.data?.colaRecortada === true,
    conLineaPropia: q.data?.conLineaPropia === true,
  };
}
