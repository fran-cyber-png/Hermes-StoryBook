import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi } from '../../lib/datos/cliente';
import { tokenGuardado } from '../../lib/datos/token';
import { streamVivo } from '../../lib/datos/latido';
import { API_URL } from '../../config';
import type { PiezaDeclarada } from './procedenciaComposer';
import type { CitaHilo } from './cita';
import { esLineaQueNoCorre, intervaloDelHilo, intervaloDeLaSesion } from './cadencia';
import { ondaEnBase64 } from './notaDeVoz';

/** Un adjunto del hilo: el archivo ya vive en el server, esto es la referencia. */
export interface MediaHilo {
  clase: 'imagen' | 'video' | 'audio' | 'documento' | 'sticker';
  archivo: string;
  mime: string | null;
  nombre?: string | null;
  /**
   * Presente solo si el audio es una NOTA DE VOZ y no un archivo de audio. Ausente
   * también en las notas de voz viejas: la marca se guarda desde el 11-sep-2026.
   * `segundos` es `null` cuando el proveedor no la manda (la Cloud API no).
   */
  voz?: { segundos: number | null } | null;
}

/**
 * Una reacción a un mensaje — 👍 al flyer, ❤️ al temario.
 *
 * **Opcional a propósito, y ausente en vez de `[]`**: un server viejo no la
 * manda y la migración puede no estar aplicada. Sin el campo, la burbuja se
 * dibuja como siempre; con `[]` habría que distinguir «no tiene reacciones» de
 * «no se pudo saber», y esa diferencia no le sirve a nadie acá.
 */
/** La escala de los ✓✓. Espeja `entrega/dominio.ts` del server. */
export type EstadoEntregaWa = 'enviado' | 'entregado' | 'leido' | 'fallido';

export interface ReaccionWa {
  emoji: string;
  /** La puso Goberna por esta línea, no el lead. */
  nuestra: boolean;
}

/** Un mensaje del hilo, tal como lo devuelve el backend. */
export interface MensajeHilo {
  id: number;
  /**
   * 🔴 **EL MENSAJE TODAVÍA NO SALIÓ, o no pudo salir (21-ago-2026).**
   *
   * Ausente = el mensaje es real, vino del server. Presente = es la burbuja
   * PROVISIONAL que `enviar` pinta antes de que el server conteste.
   *
   * ⚠️ **Optimista NO es mentiroso.** Un mensaje dibujado como enviado que no
   * salió es peor que esperar: la vendedora cierra el chat creyendo que contestó.
   * Por eso la burbuja provisional **no lleva ✓** y se ve distinta hasta que el
   * refetch la reemplaza por la de verdad. Es el vocabulario que ADR 0058 ya
   * estableció para los ✓✓ — se reusa, no se inventa uno nuevo.
   */
  enVuelo?: 'enviando' | 'fallido';
  direccion: 'entrante' | 'saliente';
  autor: string;
  texto: string | null;
  occurred_at: string;
  external_id: string;
  media?: MediaHilo | null;
  /** Si este mensaje trajo el origen del lead (anuncio/landing). Solo el primero suele traerlo. */
  origen?: { fuente: string; titulo?: string | null } | null;
  /**
   * Lo mandó la AUTO-RESPUESTA fuera de horario, no una persona (#125, ADR 0015).
   * Sale de `envios_wa.automatico`. La vendedora TIENE que poder distinguirlo de
   * un vistazo: sin la marca, abre el chat creyendo que ella escribió eso.
   */
  automatico?: boolean;
  /**
   * Quién le dio el OK antes de que saliera (modo supervisado, ADR 0016). Null
   * en modo automático, donde justamente no lo miró nadie. La distinción no es
   * cosmética: «esto lo mandó la máquina sola» y «esto lo mandó la máquina
   * porque Ana lo aprobó» son dos cosas distintas para quien lee el hilo tres
   * días después.
   */
  aprobada_por?: string | null;
  /**
   * QUIÉN MANDÓ ESTE SALIENTE — el `vendedora_id` de `envios_wa`.
   *
   * 🔴 **Existe porque una línea la atienden VARIAS personas.** Pedido del dueño
   * (23-ago-2026): «en los chats o en algún lado que se sepa quién respondió a
   * tal dato para tenerlo mapeado». La línea de campaña la atienden **18
   * operadores** y el hilo no decía nada: quien abría un chat tres días después
   * no tenía forma de saber quién había contestado.
   *
   * ⚠️ **Ausente = no se sabe, y eso NO es «lo mandé yo».** Falta en los
   * mensajes que la vendedora escribió desde su propio teléfono (no pasan por
   * `envios_wa`), en los anteriores a este frente, y en un server viejo. Se
   * dibuja sólo cuando hay dato — inventar un nombre es peor que no ponerlo.
   *
   * ⚠️ **Es la identidad cruda** (`centurion:job.meneses`, `Luz`): el nombre que
   * se muestra lo resuelve el front, que es quien sabe cuánto lugar tiene.
   */
  enviado_por?: string | null;
  /** Las reacciones a ESTE mensaje, en el orden en que se pusieron. */
  reacciones?: ReaccionWa[];
  /**
   * ¿LE LLEGÓ? ¿LO LEYÓ? Solo en los SALIENTES.
   *
   * **Ausente = no se sabe**, y eso NO es lo mismo que «enviado»: los mensajes
   * anteriores a este frente no tienen estado —sus recibos pasaron cuando no los
   * escuchábamos— y dibujar un ✓ ahí sería afirmar algo que nadie confirmó.
   */
  entrega?: EstadoEntregaWa;
  /**
   * POR QUÉ NO SE ENTREGÓ — el código de Meta (`'131047'`), solo con `fallido`.
   *
   * Lo traduce `motivoEntrega.ts`. **Ausente es lo normal y no significa nada
   * malo**: un server viejo, un hilo rehidratado del caché (ADR 0007) o un fallo
   * anterior a la migración 0028. Sin él la burbuja dibuja el triángulo pelado,
   * exactamente como antes de este frente.
   */
  entregaMotivo?: string;
  /**
   * A QUÉ MENSAJE RESPONDE ESTE — la tirita gris de WhatsApp.
   *
   * **Opcional y `null`-able**: opcional porque un server viejo no la manda (el
   * front sale por N4 y el server por N5, así que esa ventana existe en cada
   * deploy), y `null` porque el server nuevo la manda explícita en cada mensaje.
   * Las dos formas significan lo mismo acá: no hay tirita.
   *
   * Que venga con `texto: null` **no** significa que no haya cita: significa que
   * el mensaje citado no está en Hermes, y ahí se dibuja el hueco honesto. La
   * lectura vive en `cita.ts`, no en el JSX.
   */
  cita?: CitaHilo | null;
  /**
   * SI SE EDITÓ: el texto VIGENTE y cuándo cambió por última vez.
   *
   * **Opcional, y ausente ≠ no editado a secas**: como `entrega`, un server
   * viejo no lo manda. Con el campo, la burbuja prefiere `editado.texto` sobre
   * `texto` (el original) y muestra «Editado» — el mismo trato que le da
   * WhatsApp: no lo pisa, lo marca.
   */
  editado?: { texto: string; editadoEn: string } | null;
  /**
   * SI SE ELIMINÓ (o se OCULTÓ): cuándo, y si eso le llegó de verdad a
   * WhatsApp. No hay texto ni contenido que mostrar — la burbuja se tacha.
   *
   * **`revocadoEnWhatsapp` cambia lo que dice la marca, y no es cosmético**:
   * `true` es un SALIENTE con «delete for everyone» real (whatsmeow,
   * ADR 0100) — al lead ya no le queda. `false` es un ENTRANTE que la
   * vendedora ocultó solo en Hermes (`ocultarMensaje`) — el lead lo sigue
   * teniendo intacto en su teléfono, y la burbuja tiene que decirlo así:
   * mostrar «se eliminó» sobre algo que el lead todavía ve sería mentir sobre
   * el estado real de la conversación.
   *
   * **Opcional, y ausente ≠ no eliminado a secas**: mismo trato que `editado`,
   * un server viejo no lo manda.
   */
  eliminado?: { eliminadoEn: string; revocadoEnWhatsapp: boolean } | null;
}

/**
 * La URL para ver/bajar un adjunto del hilo. OJO: está detrás del perímetro
 * (Bearer), así que NO va directa a un `<img src>` — se consume vía
 * `useBlobAutenticado` (src/lib/datos/blobAutenticado.ts), el mecanismo
 * central de media autenticada.
 */
export function urlMedia(archivo: string): string {
  return `${API_URL}/api/whatsapp/media/${encodeURIComponent(archivo)}`;
}

/**
 * CUÁNTO ACEPTA ESTA LÍNEA, por clase de adjunto (bytes).
 *
 * Lo publica `GET /api/whatsapp/sesion` porque el tope **es de la línea, no de
 * Hermes**: la del bot es Cloud API y Meta corta el video en 16 MB y la imagen
 * en 5; las de las vendedoras son whatsmeow y no tienen ese tope. Sin esto, la
 * app dejaba elegir un video de 17,9 MB, lo subía entero y mostraba el JSON de
 * Meta con su `fbtrace_id`.
 *
 * **Opcional a propósito**: un server viejo no lo manda, y ahí el front no
 * frena nada — que es exactamente como se comportaba antes. La garantía no es
 * ésta: el server verifica igual y responde 409 con el motivo redactado.
 */
export type LimitesMediaWa = Partial<Record<'imagen' | 'video' | 'audio' | 'documento', number>>;

/** El estado de la sesión de WhatsApp (para el banner). Espeja `EstadoSesion` del server. */
export type EstadoSesionWa = {
  /** Qué hay del otro lado. Ausente en un server viejo. */
  transporte?: 'whatsmeow' | 'cloud-api' | 'falso';
  limitesMedia?: LimitesMediaWa;
  /**
   * ¿ESTA LÍNEA PUEDE EDITAR UN MENSAJE YA MANDADO? Feature-detectado del lado
   * del server (`transporte.editarTexto` presente o no): hoy solo whatsmeow,
   * porque la Cloud API de Meta no expone ningún PATCH de mensajes.
   *
   * Ausente = server viejo → se trata como `false` (no ofrecer el botón), el
   * mismo criterio conservador que el resto de estas banderas opcionales.
   */
  puedeEditar?: boolean;
  /**
   * ¿ESTA LÍNEA PUEDE ELIMINAR («delete for everyone») UN MENSAJE YA MANDADO?
   * Mismo criterio que `puedeEditar`, y por la misma razón: la Cloud API de
   * Meta tampoco expone esto.
   */
  puedeEliminar?: boolean;
  /**
   * ¿ESTA LÍNEA PUEDE MANDAR UNA PLANTILLA APROBADA COMO HSM REAL? (ADR 0072).
   * Al revés que `puedeEditar`: hoy SOLO la Cloud API la tiene. El selector de
   * plantillas lo lee para ofrecer «enviar como plantilla real» cuando la
   * ventana de 24 h está cerrada — sin esto, ausente = server viejo → `false`,
   * mismo criterio conservador que el resto de estas banderas.
   */
  puedeMandarPlantilla?: boolean;
} & (
  | { estado: 'sin-vincular'; qr: string | null; codigo: string | null }
  | { estado: 'conectando' }
  | { estado: 'conectado'; telefono: string }
  | { estado: 'desconectado'; motivo: string }
  | { estado: 'cerrada'; motivo: string }
  | { estado: 'baneado'; codigo: string; expira: string }
);

/**
 * EL ESTADO DE LA LÍNEA — y por qué este poll es la RED del SSE, no la fuente.
 *
 * Cuando el estado de una línea cambia de verdad (conectada, caída, baneada, o
 * recién montada), el server lo empuja por el bus: `whatsapp/wiring.ts` llama a
 * `emitirRT({tipo:'estado'})` en cada `onEstado`, y `lib/datos/tiempoReal.ts`
 * traduce ese evento a `invalidateQueries(['wa','sesion'])`. **Eso es la
 * fuente.** Este intervalo es lo que queda cuando el stream no está.
 *
 * Era `10_000` fijo, y con ~6 observadores montados a la vez eso fueron
 * **58.429 pedidos el 18-ago-2026** para un endpoint que contesta en 6 ms sin
 * tocar la base — o sea, trabajo que no le sirve a nadie.
 *
 * ⚠️ **Los ~6 observadores siguen ahí y cada uno pone su propio timer**:
 * `refetchInterval` vive en el OBSERVADOR, no en la query, así que seis
 * componentes montados sobre `['wa','sesion','']` son seis timers sobre la
 * misma query. Bajar de 10 s a 60 s divide eso por seis; **hacer que sólo uno
 * sondee es otro frente** y no se hace acá, porque elegir «cuál» crea un
 * acoplamiento nuevo: el día que ese componente se desmonte, nadie pollea y
 * nada lo dice.
 *
 * ⚠️ **`['wa','sesion','']` y `['wa','sesion',numeroPropio]` son claves
 * DISTINTAS a propósito y no se colapsan**: la primera es el semáforo global
 * («¿alguna línea puede mandar?») y la segunda gobierna si el composer de ESA
 * conversación deja mandar. Con una sola, el composer de una línea caída
 * quedaría habilitado porque otra está viva.
 */
export function useSesionWa(numeroPropio?: string | null) {
  const params = numeroPropio ? `?numeroPropio=${encodeURIComponent(numeroPropio)}` : '';
  return useQuery({
    queryKey: ['wa', 'sesion', numeroPropio ?? ''],
    queryFn: () => api<EstadoSesionWa>(`/api/whatsapp/sesion${params}`),
    /**
     * 🔴 **UN 404 SE DEJA DE PEDIR.** `esa línea no está corriendo`
     * (`server/src/routes/whatsapp.ts`) es una respuesta ESTABLE: sólo cambia
     * cuando alguien monta la línea, y **cuando eso pasa el server emite un
     * `estado`** que invalida esta clave. Repreguntarlo cada 10 s fueron
     * **19.313 pedidos el 18-ago** que nunca podían contestar otra cosa.
     *
     * La red no es `refetchOnWindowFocus` —está APAGADO globalmente en Hermes
     * (`lib/datos/cliente.ts`)—: son las dos invalidaciones de
     * `lib/datos/tiempoReal.ts`, la del evento `estado` y la del **reconecte**
     * del stream. Sin esa segunda, una línea montada mientras el front estaba
     * desconectado se quedaría en 404 para siempre.
     */
    refetchInterval: (query) => intervaloDeLaSesion(query.state.error, streamVivo()),
    /**
     * Y tampoco se REINTENTA el 404: el default global es `retry: 1`, así que
     * cada 404 costaba dos pedidos. Los demás errores conservan su reintento.
     */
    retry: (intentos, error) => !esLineaQueNoCorre(error) && intentos < 1,
  });
}

/** De dónde vino el lead, enriquecido con Meta si vino de un anuncio. */
export type OrigenLead =
  | { fuente: 'anuncio'; adId?: string; titulo?: string; anuncio?: string; campana?: string }
  | { fuente: 'landing'; ref: string }
  | null;

/** Lo que devuelve `GET /api/whatsapp/conversacion/:telefono`. */
type HiloWa = { telefono: string; mensajes: MensajeHilo[]; origen: OrigenLead };

/**
 * Cuándo pasó lo último en este hilo — lo que decide su cadencia.
 *
 * El server sirve los mensajes en orden ASCENDENTE (`whatsapp/hilo.ts` aplica
 * el `LIMIT` sobre el orden DESC y devuelve ASC), así que el último del arreglo
 * es el más reciente. Sin hilo todavía, o con un hilo vacío, devuelve `null` —
 * y `intervaloDelHilo` lee eso como el escalón más rápido.
 *
 * ══ 🔴 POR QUÉ ESTO ES TOTAL Y NO CONFÍA EN EL TIPO ═════════════════════════
 *
 * Porque lo consume un `refetchInterval`, y **TanStack lo evalúa adentro del
 * RENDER** (`QueryObserver.setOptions`, desde `useBaseQuery`): una excepción
 * ahí no degrada el poll, se lleva puesta la pantalla entera.
 *
 * Y el tipo no alcanza para garantizar que no la haya. `query.state.data` está
 * declarado `HiloWa | undefined` y en runtime puede ser otra cosa: una
 * respuesta rehidratada del caché de IndexedDB (ADR 0007) escrita por una
 * versión anterior del front, o un server que contesta otro cuerpo. La primera
 * versión de esta función era `hilo?.mensajes.at(-1)` —el `?.` cubría `hilo` y
 * no `mensajes`— y **tumbó un candado que no tiene nada que ver con este
 * frente**: `leidoInstantaneo.test.tsx` usa un stub que contesta
 * `{ok:true,cursor:true}` a TODA URL, incluida la del hilo, y el render murió
 * con «Cannot read properties of undefined (reading 'at')».
 *
 * Cualquier forma que no se entienda cae en `null`, que es el escalón más
 * rápido: la misma regla de `cadencia.ts`, degradar hacia MÁS frecuente.
 */
function ultimoMensajeDelHilo(hilo: HiloWa | undefined): string | null {
  const mensajes: unknown = hilo?.mensajes;
  if (!Array.isArray(mensajes)) return null;
  const ultimo: unknown = mensajes.at(-1);
  if (typeof ultimo !== 'object' || ultimo === null) return null;
  const cuando = (ultimo as { occurred_at?: unknown }).occurred_at;
  return typeof cuando === 'string' ? cuando : null;
}

/**
 * ⚠️ **`numeroPropio` viaja al `GET`, y hasta el 22-ago-2026 no viajaba.**
 *
 * `HiloWhatsapp.tsx` YA tenía el número a mano (`conversacion.numero_propio`)
 * y lo usaba para `enviar`/`marcarLeido`/etc., pero el `GET` del hilo salía
 * SIN él — «sin `numeroPropio` se sirve todo», el comportamiento viejo de
 * antes de #50. Eso hacía que «Desvincular WhatsApp, eliminar chats»
 * (`routes/miLinea.ts`) fuera mudo desde la app: el server sabe archivar por
 * línea (`GET /conversacion?numeroPropio=`), pero nadie se lo estaba
 * preguntando así — la vendedora seguía viendo los mensajes que acababa de
 * pedir que se ocultaran, aunque la regla del lado del server ya estuviera
 * bien escrita y con test. La cicatriz de siempre (CLAUDE.md #10).
 */
const claveDelHilo = (telefono: string | null, numeroPropio: string | undefined) =>
  ['wa', 'conversacion', telefono, numeroPropio ?? ''] as const;

/**
 * La URL del hilo, en UN solo lugar.
 *
 * ⚠️ **Dos observadores comparten esta entrada de caché** (`useConversacionWa`,
 * el chat, y `useOrigenWa`, la ficha). Con la clave y la URL escritas dos veces,
 * el día que una gane un parámetro las dos se separan sin un solo síntoma: la
 * ficha pediría un hilo distinto del que muestra el chat, o —peor— el mismo con
 * otra clave, duplicando el pedido. Es la cicatriz #37 en chiquito.
 */
const urlDelHilo = (telefono: string | null, numeroPropio: string | undefined) =>
  `/api/whatsapp/conversacion/${telefono}${numeroPropio ? `?numeroPropio=${encodeURIComponent(numeroPropio)}` : ''}`;

/**
 * SÓLO DE DÓNDE VINO — para la ficha, que se abre sin el chat al lado.
 *
 * ══ POR QUÉ PIDE EL HILO ENTERO PARA LEER UN CAMPO ═════════════════════════
 *
 * Porque `GET /api/whatsapp/conversacion/:telefono` es el ÚNICO lugar del
 * sistema donde el origen sale con los nombres humanos puestos: la ruta llama a
 * `resolverAnuncio()` contra la Graph API y, de paso, guarda el resultado en
 * `anuncio_resuelto` (`routes/whatsapp.ts`, «DE PASO, para Contactos»). O sea
 * que **este pedido no sólo lee el nombre del anuncio: es lo que hace que
 * exista** — para esta ficha y para la columna «Campaña» de Contactos, que
 * nunca pregunta. Un endpoint nuevo que devolviera sólo el origen ahorraría
 * bytes y perdería eso.
 *
 * ⚠️ **La MISMA clave que `useConversacionWa`, con las cuatro partes.** Con el
 * chat abierto no hay un pedido de más: los dos observadores comparten la
 * entrada del caché. `FormularioVenta` usa una clave de TRES (sin la línea) y
 * por eso sí pide aparte, aunque su comentario diga lo contrario — no se
 * arregla acá para no meter otro frente en este PR.
 *
 * Sin `refetchInterval` a propósito: el ritmo del hilo lo gobierna el observador
 * del chat (`cadencia.ts`). El origen es de los datos más quietos que hay —el
 * primer mensaje de la conversación no cambia— así que este observador no
 * agrega un solo pedido periódico.
 */
export function useOrigenWa(telefono: string | null, numeroPropio?: string) {
  return useQuery({
    queryKey: claveDelHilo(telefono, numeroPropio),
    queryFn: () => api<HiloWa>(urlDelHilo(telefono, numeroPropio)),
    enabled: Boolean(telefono),
    staleTime: 5 * 60_000,
    select: (h: HiloWa) => h.origen,
  });
}

export function useConversacionWa(telefono: string | null, numeroPropio?: string) {
  const qc = useQueryClient();

  const hilo = useQuery({
    queryKey: claveDelHilo(telefono, numeroPropio),
    queryFn: () => api<HiloWa>(urlDelHilo(telefono, numeroPropio)),
    enabled: Boolean(telefono),
    /**
     * EL RITMO DEPENDE DE QUÉ TAN VIVA ESTÁ LA CONVERSACIÓN, no del reloj.
     *
     * Era `5_000` fijo, y el 18-ago-2026 eso fueron **41.973 pedidos con 98,8 %
     * de 304** — de los cuales **19.234 (46 %) eran cinco conversaciones de
     * líneas apagadas con DIEZ mensajes entre todas** (`989270836`: 6.644
     * pedidos para UN mensaje, en una línea muerta hacía 28 días). Un 304 no es
     * gratis: el ETag es el hash del cuerpo, así que la consulta corre entera y
     * recién al final se descubre que no cambió.
     *
     * La regla y su porqué —incluido el 🔴 de por qué el escalón lento no puede
     * pasar de 60 s— viven en `cadencia.ts`, puras y con test. Acá sólo se le
     * pasa el último mensaje del hilo: el server lo sirve ASC
     * (`whatsapp/hilo.ts`: `ORDER BY occurred_at ASC` sobre el `LIMIT` DESC),
     * así que el último del arreglo es el más reciente.
     *
     * Sin `data` todavía —el primer render, o el hilo recién abierto— cae en el
     * escalón más rápido: la regla degrada hacia MÁS frecuente, siempre.
     */
    refetchInterval: (query) =>
      telefono
        ? intervaloDelHilo(ultimoMensajeDelHilo(query.state.data), Date.now(), streamVivo())
        : false,
  });

  // Marcar leído al abrir (ticks azules — decisión de Estephano). Sin bloquear la vista.
  /**
   * Marcar leído al abrir. Hace DOS cosas del otro lado: los ticks azules para el
   * lead y el cursor de lectura de la vendedora (lo que apaga el punto azul de
   * la fila).
   *
   * ⚠️ **`numeroPropio` no es opcional para el cursor**: `estado_conversacion` se
   * indexa por la clave completa `conv:whatsapp:<tel>:<linea>`, y sin la línea el
   * server no puede saber cuál conversación marcar — manda los ticks y no toca el
   * cursor, que es lo correcto: mejor no apagar la marca que apagar la de otra.
   *
   * La cola se revalida al terminar. La conversación **no se mueve de lugar**:
   * el orden es por urgencia y leer dejó de ser un criterio de orden
   * (ADR 0087, 26-ago-2026 — `server/src/cola/estadoSql.ts`).
   */
  const marcarLeido = useMutation({
    mutationFn: (vars: { telefono: string; numeroPropio?: string | null }) => {
      const q = vars.numeroPropio ? `?numeroPropio=${encodeURIComponent(vars.numeroPropio)}` : '';
      return api<{ ok: true; cursor: boolean }>(`/api/whatsapp/leido/${vars.telefono}${q}`, {
        method: 'POST',
        body: '{}',
      });
    },
    /**
     * OPTIMISTA: el punto azul se apaga en el instante del clic.
     *
     * ── Por qué hacía falta ─────────────────────────────────────────────
     * El síntoma reportado fue «tengo que quedarme unos 3 segundos en el chat
     * para que lo tome como leído». No era eso: el marcado TARDABA tres
     * segundos —el server esperaba a que WhatsApp acusara los tildes antes de
     * tocar el cursor— y quien volvía antes no lo veía. Eso ya se arregló del
     * lado del server; esto es la otra mitad, para que ni siquiera se note el
     * viaje de ida y vuelta.
     *
     * Se tocan TODAS las variantes de la cola (`setQueriesData` con el prefijo)
     * porque la queryKey lleva los filtros: con `setQueryData` de una sola,
     * cambiar de filtro mostraría el punto encendido otra vez.
     *
     * ⚠️ **Solo se apaga el punto; NO se reordena acá.** El orden de la cola es
     * del server (`bandaPinOrdenSql`) y reimplementarlo en el navegador sería
     * tener la misma regla en dos lados — la lección de #37.
     *
     * 🔴 **Y desde ADR 0087 el refetch ya no la mueve**, así que este parche
     * optimista dejó de ser «adelantar lo que igual va a pasar» y pasó a ser lo
     * ÚNICO que cambia en la fila: el punto se apaga y nada más. Si alguien
     * vuelve a meter la lectura en el orden del server, esto se convierte otra
     * vez en un salto — y el salto se vería acá, no allá.
     */
    onMutate: (vars) => {
      const previas = qc.getQueriesData({ queryKey: ['conversaciones'] });
      qc.setQueriesData(
        { queryKey: ['conversaciones'] },
        (viejo: { pages?: { conversaciones: { persona_id: string; no_leido?: boolean }[] }[] } | undefined) => {
          if (!viejo?.pages) return viejo;
          return {
            ...viejo,
            pages: viejo.pages.map((p) => ({
              ...p,
              conversaciones: p.conversaciones.map((c) =>
                c.persona_id === vars.telefono ? { ...c, no_leido: false } : c,
              ),
            })),
          };
        },
      );
      return { previas };
    },
    onError: (_e, _v, ctx) => {
      // Se deshace: un punto apagado sobre algo que el server no marcó es una
      // conversación que se pierde de vista sin que nadie la haya leído.
      for (const [clave, dato] of ctx?.previas ?? []) qc.setQueryData(clave, dato);
    },
    onSuccess: (r) => {
      // Se revalida para que el punto apagado quede confirmado por el server y no
      // sólo por el parche optimista. Desde ADR 0087 el refetch NO trae un orden
      // nuevo: leer no reordena, así que esto no puede verse como un salto.
      if (r?.cursor) void qc.invalidateQueries({ queryKey: ['conversaciones'] });
    },
  });

  const enviar = useMutation({
    mutationFn: (vars: {
      numeroPropio: string;
      telefono: string;
      texto: string;
      referencia: string;
      /** De qué pieza salió (#169). Ausente = escrito a mano: la línea de base. */
      pieza?: PiezaDeclarada;
      /**
       * A qué mensaje responde: **el `external_id` y nada más**. De quién era y
       * qué decía lo resuelve el server contra lo que ya guardó — es un dato que
       * el LEAD va a ver, y declararlo desde acá sería la segunda fuente de
       * verdad para el mismo hecho (ver `whatsapp/citaRepositorio.ts`).
       */
      citaDe?: string;
    }) =>
      api<{ ok: true; idExterno: string }>('/api/whatsapp/enviar', {
        method: 'POST',
        body: JSON.stringify(vars),
      }),
    /**
     * ══ 🔴 OPTIMISTA — 21-ago-2026, y es «que se sienta fluida» ════════════════
     *
     * `marcarLeido`, `reaccionar` y `editar` ya eran optimistas en este mismo
     * archivo. **`enviar` no lo era**, que es la acción que más importa: la
     * vendedora apretaba Enter y esperaba el round-trip completo mirando un
     * composer que no hacía nada. Medido el 21-ago en producción, ese round-trip
     * tenía **p95 de 20,07 s y máximo 44,25 s**.
     *
     * Es exactamente el síntoma que el docblock de `marcarLeido` ya describe
     * («tengo que quedarme tres segundos»), sobre la acción principal del CRM.
     *
     * ⚠️ **ESTO ESCONDE LA LATENCIA, NO LA BORRA.** El mensaje sigue tardando lo
     * que tarda en salir de verdad; lo que cambia es que la vendedora puede
     * seguir trabajando. Va junto con el pool más grande (`db/opciones.ts`) — con
     * uno solo de los dos, la app se siente rápida mientras los mensajes hacen
     * fila, que es peor que sentirse lenta.
     */
    onMutate: async (vars) => {
      const clave = claveDelHilo(telefono, numeroPropio);
      await qc.cancelQueries({ queryKey: clave });
      const antes = qc.getQueryData(clave);
      // Id local NEGATIVO: los reales son un `serial` de Postgres, así que no hay
      // forma de que choquen, y dos envíos seguidos tampoco chocan entre sí.
      const idLocal = -Date.now();
      qc.setQueryData(clave, (viejo: { mensajes: MensajeHilo[] } | undefined) => {
        if (!viejo) return viejo;
        const provisional: MensajeHilo = {
          id: idLocal,
          enVuelo: 'enviando',
          direccion: 'saliente',
          autor: 'vendedora',
          texto: vars.texto,
          occurred_at: new Date().toISOString(),
          external_id: `local:${idLocal}`,
        };
        return { ...viejo, mensajes: [...viejo.mensajes, provisional] };
      });
      return { antes, clave, idLocal };
    },
    onError: (_e, _v, ctx) => {
      // 🔴 NO se deshace como en `reaccionar`: se MARCA. Quitar la burbuja deja a
      // la vendedora sin saber qué pasó con lo que escribió, y el texto se
      // perdería de la pantalla. Marcada en rojo, sigue ahí y se puede copiar.
      if (!ctx) return;
      qc.setQueryData(ctx.clave, (viejo: { mensajes: MensajeHilo[] } | undefined) => {
        if (!viejo) return viejo;
        return {
          ...viejo,
          mensajes: viejo.mensajes.map((m) =>
            m.id === ctx.idLocal ? { ...m, enVuelo: 'fallido' as const } : m,
          ),
        };
      });
    },
    // Al enviar, el hilo y la cola quedan viejos: se revalidan. El refetch del
    // hilo es lo que reemplaza la burbuja provisional por la REAL —con su
    // `external_id` y sus ✓✓—, así que no hace falta borrarla a mano.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wa', 'conversacion', telefono] });
      void qc.invalidateQueries({ queryKey: ['conversaciones'] });
    },
  });

  // Adjuntos: el archivo viaja crudo (no JSON), por eso no pasa por `api()` —
  // pero lleva el mismo Bearer y los mismos estados que cualquier envío.
  const enviarMedia = useMutation({
    mutationFn: async (vars: {
      numeroPropio: string;
      telefono: string;
      referencia: string;
      archivo: File;
      caption: string;
      /** Solo una nota de voz grabada en el compositor (ver `notaDeVoz.ts`). */
      voz?: { segundos: number; onda: number[] | null };
    }) => {
      const token = tokenGuardado();
      const q = new URLSearchParams({
        telefono: vars.telefono,
        numeroPropio: vars.numeroPropio,
        referencia: vars.referencia,
        nombre: vars.archivo.name,
        ...(vars.caption.trim() ? { caption: vars.caption.trim() } : {}),
        ...(vars.voz
          ? {
              voz: '1',
              segundos: String(vars.voz.segundos),
              ...(vars.voz.onda ? { onda: ondaEnBase64(vars.voz.onda) } : {}),
            }
          : {}),
      });
      const res = await fetch(`${API_URL}/api/whatsapp/enviar-media?${q}`, {
        method: 'POST',
        headers: {
          'content-type': vars.archivo.type || 'application/octet-stream',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: vars.archivo,
      });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}));
        throw new ErrorApi(cuerpo.message ?? `Error ${res.status}`, res.status);
      }
      return res.json() as Promise<{ ok: true; idExterno: string }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wa', 'conversacion', telefono] });
      void qc.invalidateQueries({ queryKey: ['conversaciones'] });
    },
  });

  /**
   * MANDAR UNA PLANTILLA APROBADA COMO HSM REAL (ADR 0072) — la única vía que
   * reabre una conversación con la ventana de 24 h cerrada. Mismo molde que
   * `enviarMedia`: los metadatos van en la query, el body es el archivo CRUDO
   * de la imagen del header (o nada, si la plantilla no la pide).
   *
   * ⚠️ **No pasa por `anotarPieza`**: la procedencia se calcula ENTERA del
   * lado del server (`deUnaHsmDelComposer`, `routes/whatsapp.ts`), porque este
   * camino no pega texto en la caja — manda directo.
   */
  const enviarPlantillaHsm = useMutation({
    mutationFn: async (vars: {
      numeroPropio: string;
      telefono: string;
      referencia: string;
      nombrePlantilla: string;
      idioma: string;
      variables: string[];
      imagen: File | null;
    }) => {
      const token = tokenGuardado();
      const q = new URLSearchParams({
        numeroPropio: vars.numeroPropio,
        telefono: vars.telefono,
        referencia: vars.referencia,
        nombrePlantilla: vars.nombrePlantilla,
        idioma: vars.idioma,
        variables: JSON.stringify(vars.variables),
      });
      const res = await fetch(`${API_URL}/api/whatsapp/enviar-plantilla?${q}`, {
        method: 'POST',
        headers: {
          ...(vars.imagen ? { 'content-type': vars.imagen.type || 'application/octet-stream' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: vars.imagen ?? undefined,
      });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}));
        throw new ErrorApi(cuerpo.message ?? `Error ${res.status}`, res.status);
      }
      return res.json() as Promise<{ ok: true; idExterno: string }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wa', 'conversacion', telefono] });
      void qc.invalidateQueries({ queryKey: ['conversaciones'] });
    },
  });

  /**
   * REACCIONAR a un mensaje del lead. Emoji vacío quita la reacción.
   *
   * Optimista a propósito: la píldora aparece al instante y se corrige sola si
   * el server dice que no. Reaccionar es el gesto más liviano del chat — que
   * tarde medio segundo en aparecer lo hace sentir roto.
   */
  const reaccionar = useMutation({
    mutationFn: (vars: { numeroPropio: string; telefono: string; mensajeId: string; emoji: string }) =>
      api<{ ok: true; quitada: boolean }>('/api/whatsapp/reaccionar', {
        method: 'POST',
        body: JSON.stringify(vars),
      }),
    onMutate: async (vars) => {
      const clave = claveDelHilo(telefono, numeroPropio);
      await qc.cancelQueries({ queryKey: clave });
      const antes = qc.getQueryData(clave);
      qc.setQueryData(clave, (viejo: { mensajes: MensajeHilo[] } | undefined) => {
        if (!viejo) return viejo;
        return {
          ...viejo,
          mensajes: viejo.mensajes.map((m) => {
            if (m.external_id !== `wa:${vars.mensajeId}` && m.external_id !== vars.mensajeId) return m;
            // Las de OTROS quedan como están: solo se toca la nuestra, que es
            // la única que este gesto puede cambiar.
            const ajenas = (m.reacciones ?? []).filter((r) => !r.nuestra);
            const nuestras = vars.emoji ? [{ emoji: vars.emoji, nuestra: true }] : [];
            const todas = [...ajenas, ...nuestras];
            return { ...m, reacciones: todas.length ? todas : undefined };
          }),
        };
      });
      return { antes, clave };
    },
    onError: (_e, _v, ctx) => {
      // Se deshace: dejar la píldora puesta sobre algo que no salió es peor que
      // no haberla mostrado.
      if (ctx?.antes) qc.setQueryData(ctx.clave, ctx.antes);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['wa', 'conversacion', telefono] }),
  });

  /**
   * EDITAR el texto de un mensaje SALIENTE ya mandado — la corrección de un
   * error de tipeo.
   *
   * Optimista, como reaccionar: la burbuja muestra el texto nuevo al instante
   * y se corrige sola si el server dice que no (línea sin la capacidad, sesión
   * caída, WhatsApp lo rechazó por protocolo — el aviso llega igual por
   * `onError` del componente que la dispara).
   */
  const editar = useMutation({
    mutationFn: (vars: { numeroPropio: string; telefono: string; mensajeId: string; texto: string }) =>
      api<{ ok: true }>('/api/whatsapp/editar', {
        method: 'POST',
        body: JSON.stringify(vars),
      }),
    onMutate: async (vars) => {
      const clave = claveDelHilo(telefono, numeroPropio);
      await qc.cancelQueries({ queryKey: clave });
      const antes = qc.getQueryData(clave);
      const ahora = new Date().toISOString();
      qc.setQueryData(clave, (viejo: { mensajes: MensajeHilo[] } | undefined) => {
        if (!viejo) return viejo;
        return {
          ...viejo,
          mensajes: viejo.mensajes.map((m) =>
            m.external_id === `wa:${vars.mensajeId}` || m.external_id === vars.mensajeId
              ? { ...m, editado: { texto: vars.texto, editadoEn: ahora } }
              : m,
          ),
        };
      });
      return { antes, clave };
    },
    onError: (_e, _v, ctx) => {
      // Se deshace: un texto editado que no salió de verdad es peor que no
      // haberlo mostrado — el lead nunca vio esa corrección.
      if (ctx?.antes) qc.setQueryData(ctx.clave, ctx.antes);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['wa', 'conversacion', telefono] }),
  });

  /**
   * ELIMINAR («delete for everyone») un mensaje SALIENTE ya mandado.
   *
   * Optimista, como editar: la burbuja se tacha al instante y se corrige sola
   * si el server dice que no (línea sin la capacidad, sesión caída, WhatsApp
   * lo rechazó por protocolo).
   */
  const eliminar = useMutation({
    mutationFn: (vars: { numeroPropio: string; telefono: string; mensajeId: string }) =>
      api<{ ok: true }>('/api/whatsapp/eliminar', {
        method: 'POST',
        body: JSON.stringify(vars),
      }),
    onMutate: async (vars) => {
      const clave = claveDelHilo(telefono, numeroPropio);
      await qc.cancelQueries({ queryKey: clave });
      const antes = qc.getQueryData(clave);
      const ahora = new Date().toISOString();
      qc.setQueryData(clave, (viejo: { mensajes: MensajeHilo[] } | undefined) => {
        if (!viejo) return viejo;
        return {
          ...viejo,
          mensajes: viejo.mensajes.map((m) =>
            m.external_id === `wa:${vars.mensajeId}` || m.external_id === vars.mensajeId
              ? { ...m, eliminado: { eliminadoEn: ahora, revocadoEnWhatsapp: true } }
              : m,
          ),
        };
      });
      return { antes, clave };
    },
    onError: (_e, _v, ctx) => {
      // Se deshace: una burbuja tachada que no se eliminó de verdad es peor
      // que no haberla tocado — el lead sigue viendo el mensaje original.
      if (ctx?.antes) qc.setQueryData(ctx.clave, ctx.antes);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['wa', 'conversacion', telefono] }),
  });

  /**
   * OCULTAR el mensaje de un LEAD — «eliminar para mí», nunca «para todos».
   * WhatsApp no deja revocar lo que uno no mandó (ver `ocultarMensaje` en el
   * server): esto no manda NADA a WhatsApp, así que a diferencia de `eliminar`
   * no depende de `puedeEliminar` ni de la sesión — funciona con cualquier
   * transporte y con la línea caída, porque no hay ninguna línea de por medio.
   */
  const ocultar = useMutation({
    mutationFn: (vars: { numeroPropio: string; telefono: string; mensajeId: string }) =>
      api<{ ok: true }>('/api/whatsapp/ocultar', {
        method: 'POST',
        body: JSON.stringify(vars),
      }),
    onMutate: async (vars) => {
      const clave = claveDelHilo(telefono, numeroPropio);
      await qc.cancelQueries({ queryKey: clave });
      const antes = qc.getQueryData(clave);
      const ahora = new Date().toISOString();
      qc.setQueryData(clave, (viejo: { mensajes: MensajeHilo[] } | undefined) => {
        if (!viejo) return viejo;
        return {
          ...viejo,
          mensajes: viejo.mensajes.map((m) =>
            m.external_id === `wa:${vars.mensajeId}` || m.external_id === vars.mensajeId
              ? { ...m, eliminado: { eliminadoEn: ahora, revocadoEnWhatsapp: false } }
              : m,
          ),
        };
      });
      return { antes, clave };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(ctx.clave, ctx.antes);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['wa', 'conversacion', telefono] }),
  });

  return { hilo, enviar, enviarMedia, enviarPlantillaHsm, marcarLeido, reaccionar, editar, eliminar, ocultar };
}
