import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_URL } from '../../config';
import { crearAgrupador } from './agrupador';
import { claves } from './cliente';
import { consumirStream } from './streamAutenticado';
import { tokenGuardado } from './token';
import { esMensajeEntrante } from '../notificaciones/decidir';
import { reproducirSonidoMensaje } from '../notificaciones/sonido';
import { notificarEscritorio, pedirPermisoDeNotificacion } from '../notificaciones/escritorio';
import { formatoTelefono } from '../formato';
import { emitirPulsoDeRuteo, type PulsoDeRuteo } from './pulsoDeRuteo';
import { emitirSenalDeLlamada, senalDeLlamadaDe } from './senalDeLlamada';

/**
 * TIEMPO REAL — el frontend escucha lo que el server empuja.
 *
 * El server abre un stream SSE (`/api/stream`) y manda una señal cada vez que
 * entra un mensaje o cambia el estado de la sesión. Acá se traduce esa señal a
 * invalidaciones de react-query: la cola, la conversación de esa persona y el
 * estado de WhatsApp se vuelven a pedir al instante. Es push, no polling —el
 * mensaje aparece en la pantalla apenas llega al server, sin que la vendedora
 * toque nada.
 *
 * ── Por qué fetch y no EventSource ──
 * Los eventos de mensaje llevan el teléfono del contacto (PII), así que desde
 * el cierre del issue #36 el stream exige el Bearer como todo /api — y
 * EventSource no puede mandar headers. `consumirStream` lo consume con fetch.
 *
 * ── Red caída ≠ sesión muerta ──
 * Un corte de red o un deploy se reintenta a los 3s (los mismos del `retry`
 * que mandaba el server). Un **401 corta el loop**: martillar con un token
 * muerto no lo revive — se dispara `alNoAutorizado` (App pasa la re-validación
 * de sesión, el mismo camino de `/api/auth/yo` que echa y limpia si
 * corresponde). Y solo se conecta con sesión iniciada.
 *
 * ── La campanita ──
 * Un mensaje `entrante` (nunca lo que mandamos nosotros) suena y, si la
 * pestaña no está a la vista, además dispara un `Notification` — ver
 * `lib/notificaciones/`. El permiso se pide al iniciar sesión, no al primer
 * mensaje: pedirlo desde un tab en segundo plano (el caso en que más se
 * necesita) suele ser justo cuando el navegador lo deniega solo.
 *
 * ── 🔴 El evento puede venir RECORTADO, y eso no es un evento roto ──
 * Desde el 17-ago-2026 el server filtra por dueña (`realtime/visibilidad.ts`):
 * un mensaje de una conversación que no es tuya llega **sin `telefono` y sin
 * `direccion`**. Antes llegaban todos enteros, o sea que a Sindy le sonaba la
 * campanita —y le saltaba un aviso del sistema con el número— cuando le
 * escribían a un lead de Luz.
 *
 * Lo que NO cambia es que la pantalla se refresque: el evento recortado sigue
 * invalidando la cola, el radar y **el hilo abierto**. Esa última mitad es la
 * que obliga a las dos ramas de abajo — sin ella, una conversación sin dueña
 * (todo lo anterior al reparto, y toda línea sin rueda) dejaría de actualizarse
 * sola con el chat abierto, que es el defecto que este bus vino a arreglar.
 *
 * ── 🔴 EL STREAM NO TIENE REPLAY, ASÍ QUE RECONECTAR ES RECUPERAR ──
 * Desde el 19-ago-2026 los polls de la cola, del hilo y de la sesión bajaron
 * mucho el ritmo **porque este bus es la fuente**. Lo que pagaba el hueco antes
 * era el poll rápido: mientras el stream estuvo cortado no llegó ni un aviso, y
 * `routes/stream.ts` no reenvía lo perdido al reconectar.
 *
 * ⚠️ Y **`refetchOnWindowFocus` está APAGADO globalmente** en Hermes
 * (`lib/datos/cliente.ts`), así que «al volver a la pestaña se refresca solo»
 * es FALSO acá. Sacar ritmo del poll obliga a poner una red explícita, y ésta
 * es: al **reconectar** se invalida todo lo que el bus habría empujado.
 * `alReconectar` no corre en la PRIMERA conexión —ahí las queries recién se
 * montan y piden solas—, sólo cuando el stream volvió.
 */
const REINTENTO_MS = 3000;
/** Cuánto se reparten las pestañas para no invalidar la cola todas juntas. */
const JITTER_COLA_MS = 4000;
/**
 * ══ LA VENTANA EN LA QUE SE JUNTAN LAS DOS CONSULTAS CARAS ═══════════════════
 *
 * 🔴 **EL JITTER REPARTÍA Y NADA MÁS.** Cada mensaje que entra invalidaba la
 * cola, y en producción entran **7 a 18 por minuto** (medido el 19-ago-2026 en
 * el log del proceso: whatsmeow, no el webhook — por eso contar `POST /webhook`
 * daba cero y los números no cerraban). Con tres vendedoras conectadas eso eran
 * ~36 invalidaciones por minuto de la consulta más cara del sistema. Resultado:
 * `hermes_db` al 747 % de ocho núcleos y el 100 % de los pedidos en 504.
 *
 * Con la ventana, ese mismo minuto son **4 invalidaciones**, no 36.
 *
 * ⚠️ **15 s no es un número de confort: es lo que la pantalla puede tolerar sin
 * mentir.** Lo que la vendedora mira mientras le escriben es el HILO, y ése se
 * invalida al instante (abajo, sin agrupar). La campanita y el aviso de
 * escritorio también son inmediatos. Lo que espera hasta 15 s es el ORDEN de la
 * lista — y aun así queda veinte veces más fresco que la red del poll, que con
 * el stream vivo son 5 minutos (`lib/datos/latido.ts`).
 *
 * ⚠️ **La ventana NO reemplaza al jitter, lo contiene**: la ventana acota el
 * RITMO de una pestaña, el jitter desincroniza las PESTAÑAS entre sí. Sacar el
 * segundo devuelve las ~8 vendedanas disparando en el mismo segundo.
 */
const VENTANA_CARAS_MS = 15_000;

/**
 * 🔴 HOTFIX «el negocio no tumba producción» — `['dashboard']` YA NO invalida
 * `['dashboard', 'negocio', ...]`.
 *
 * El radar (`GET /`) es barato y quiere el refresco agrupado de siempre. El
 * panel del negocio es la consulta de 9-13 s: `useNegocio` (`staleTime` de
 * 120 s) ya decide sola cuándo refrescarse, y esta invalidación de cada
 * mensaje/reconexión la pisaba cada 15-19 s — la mitad de la tormenta era
 * ESTO, no solo la falta de caché en el server. Se usa `predicate` en vez de
 * una `queryKey` exacta porque lo que hay que EXCLUIR es un prefijo, no una
 * clave puntual.
 */
/**
 * Y desde ADR 0104 tampoco `['dashboard', 'hoy', ...]` ni `['dashboard', 'series']`:
 * cada pedido de «Hoy» arma en el server la `todo` de la cola (1 a 2 s medidos), y la
 * serie de 14 días cambia una vez por día. Las dos deciden solas cuándo refrescarse
 * (`features/dashboard/hoy.ts`, `series.ts`). Candado: `tiempoRealNegocio.test.tsx`.
 */
const DASHBOARD_SIN_SSE: readonly unknown[] = ['negocio', 'hoy', 'series'];

function invalidarDashboardSinNegocio(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({
    predicate: (query) => query.queryKey[0] === 'dashboard' && !DASHBOARD_SIN_SSE.includes(query.queryKey[1]),
  });
}

export function useTiempoReal(sesionActiva: boolean, alNoAutorizado?: () => void) {
  const qc = useQueryClient();

  useEffect(() => {
    if (sesionActiva) pedirPermisoDeNotificacion();
  }, [sesionActiva]);

  useEffect(() => {
    if (!sesionActiva) return;
    const control = new AbortController();
    let reintento: ReturnType<typeof setTimeout> | undefined;
    /** La primera conexión no recupera nada: las queries recién se montan. */
    let primeraConexion = true;

    /**
     * ⚠️ JITTER en la cola, y no en las demás: el SSE empuja el mismo evento a
     * TODAS las pestañas conectadas en el mismo instante, y sin este delay las
     * ~8 vendedoras invalidan `['conversaciones']` juntas — la consulta más
     * cara del sistema, disparada 8 veces en el mismo segundo (medido: load
     * average 16 en un VPS de 8 núcleos). `frescura`/`dashboard`/el hilo son
     * baratas y no lo necesitan.
     */
    /**
     * Las dos caras van AGRUPADAS y con jitter; el resto, al instante.
     *
     * Se separan en dos agrupadores y no en uno solo porque el reconecte
     * invalida el dashboard sin pasar por la cola, y con un agrupador
     * compartido un mensaje se habría comido esa recuperación.
     */
    const agCola = crearAgrupador(() => VENTANA_CARAS_MS + Math.random() * JITTER_COLA_MS);
    const agDashboard = crearAgrupador(() => VENTANA_CARAS_MS + Math.random() * JITTER_COLA_MS);
    /**
     * 🔴 **EL TABLERO VA AGRUPADO COMO LA COLA, no al instante.** Un lead que cae
     * emite `ruteo`, y `GET /api/routing/tablero` son dos scans más `loQueCayo`
     * sobre `conversacion_asignada` — justo en el instante en que el webhook está
     * repartiendo ese lead, compartiendo un pool de 10 conexiones. Invalidar por
     * evento, sin ventana, es literalmente lo que dejó `hermes_db` al 747 % y la
     * API en 504 el 19-ago-2026 (ver `agrupador.ts`). El jitter es para que ocho
     * pestañas con la pantalla abierta no disparen en el mismo segundo.
     */
    const agTablero = crearAgrupador(() => VENTANA_CARAS_MS + Math.random() * JITTER_COLA_MS);
    /**
     * LAS PASTILLAS «QUIÉN LO TIENE ABIERTO» de la cola y del Pipeline (ADR 0121).
     * Cada panel que se abre o se cierra emite `comentario`, así que sin ventana
     * diez agentes moviéndose por la lista serían diez pedidos por pestaña. La
     * ventana es corta y no la de la cola: es un dato de presencia, y quince
     * segundos tarde ya no avisa a tiempo. El pedido es barato: memoria del
     * proceso y una lectura por índice.
     */
    const agPresencias = crearAgrupador(() => 2_000 + Math.random() * 1_000);
    const invalidarPresenciasAgrupadas = () =>
      agPresencias.pedir(() => {
        if (!control.signal.aborted) void qc.invalidateQueries({ queryKey: claves.presenciasDeComentarios() });
      });
    const invalidarColaAgrupada = () =>
      agCola.pedir(() => {
        if (!control.signal.aborted) void qc.invalidateQueries({ queryKey: ['conversaciones'] });
      });
    const invalidarDashboardAgrupado = () =>
      agDashboard.pedir(() => {
        if (!control.signal.aborted) invalidarDashboardSinNegocio(qc);
      });

    const manejar = (data: string) => {
      let e: { tipo?: string; telefono?: string | null; direccion?: string; que?: string; interactionId?: number };
      try {
        e = JSON.parse(data);
      } catch {
        return;
      }

      if (esMensajeEntrante(e)) {
        // La campanita: nos escribieron. Nunca por lo que mandamos nosotros
        // (`esMensajeEntrante` filtra por `direccion`), ni por una reacción o
        // un recibo (el server no manda `direccion` en esos casos).
        reproducirSonidoMensaje();
        if (e.telefono) notificarEscritorio('Hermes', `Nuevo mensaje de ${formatoTelefono(e.telefono)}`);
      }

      if (e.tipo === 'mensaje') {
        // La cola cambió (fila nueva o reordenada). El jitter vive en el
        // agrupador y lo comparte con el reconecte: dos delays distintos sobre la
        // misma consulta serían la misma regla escrita dos veces.
        invalidarColaAgrupada();
        /*
         * 🔴 **`frescura` YA NO SE INVALIDA ACÁ — 21-ago-2026.**
         *
         * `/api/interactions/frescura` existe para contestar «¿la captura está
         * viva?» **cuando no hay novedades que lo demuestren**. Con un evento del
         * SSE en la mano, preguntarlo es redundante por definición: el evento ES
         * la novedad que frescura iba a descubrir.
         *
         * Y no era gratis. Medido el 21-ago en producción, frescura fue el
         * endpoint más llamado del día —**13.758 pedidos en media jornada**— con
         * 10,6 % de 5xx, y su cadencia de diseño es un `refetchInterval` de 60 s
         * (61 pedidos/hora, que es lo que se ve de madrugada). La diferencia entre
         * 61 y 13.758 no son más vendedoras: es esta línea multiplicada por cada
         * mensaje y por cada pestaña abierta.
         *
         * ⚠️ **Lo que se pierde, dicho**: el cartel de «la captura está atrasada»
         * puede tardar hasta 60 s (su `refetchInterval`) en reflejar un mensaje
         * recién llegado. Es exactamente al revés de lo que preocupa: ese cartel
         * avisa de ingesta MUERTA, y un mensaje entrando prueba que está viva.
         *
         * ⚠️ **El server sigue invalidando SU caché en `emitirRT`**
         * (`server/src/realtime/bus.ts`), así que el próximo pedido —el del
         * intervalo— trae el dato fresco. Los dos lados no hacen lo mismo: allá se
         * tira un caché de 3 s, acá se disparaba una consulta.
         */
        // El radar del dashboard también: un mensaje ES un lead cayendo. Va
        // agrupado como la cola: son las dos que pesan (~2 s cada una medidas
        // en producción), y el resto de esta función cuesta milisegundos.
        invalidarDashboardAgrupado();
        // Y el hilo de esa persona, si está abierto. Con el evento recortado no
        // sabemos de quién fue, así que se invalida el PREFIJO: react-query
        // refetchea solo las queries ACTIVAS, y de hilo hay a lo sumo una montada.
        // Cuesta un refetch de esa única consulta por cada mensaje ajeno; lo que
        // compra es que el chat abierto nunca se quede viejo, sin nombrar a nadie.
        if (e.telefono) void qc.invalidateQueries({ queryKey: ['wa', 'conversacion', e.telefono] });
        else void qc.invalidateQueries({ queryKey: ['wa', 'conversacion'] });
      } else if (e.tipo === 'ruteo') {
        /**
         * 🔴 **El PULSO sale al instante; la CONSULTA va agrupada.** Son dos
         * costos distintos: el puntito es una animación de SVG que no toca la
         * red, y el tablero es una consulta cara. Agrupar el pulso lo haría
         * llegar quince segundos tarde —o sea, mentir sobre cuándo cayó—; no
         * agrupar la consulta es el incidente de arriba.
         *
         * ⚠️ **Y NO se invalida la cola acá.** El mismo lead ya emitió su
         * `mensaje` hermano en el mismo tick, que es quien la invalida. Hacerlo
         * de nuevo sería una invalidación duplicada por lead para TODOS los
         * clientes conectados, tengan Routing abierto o no.
         */
        emitirPulsoDeRuteo(e as PulsoDeRuteo);
        agTablero.pedir(() => {
          if (control.signal.aborted) return;
          void qc.invalidateQueries({ queryKey: ['routing', 'tablero'] });
          void qc.invalidateQueries({ queryKey: ['routing', 'historial'] });
        });
      } else if (e.tipo === 'comentario') {
        /**
         * 🔴 ALGUIEN ABRIÓ, CERRÓ O RESPONDIÓ UN COMENTARIO (13-sep-2026).
         *
         * Es lo que le avisa a la segunda agente, antes de escribir, que otra ya
         * lo tiene abierto o ya lo respondió. Se refresca SÓLO el estado de ese
         * comentario: react-query vuelve a pedir una consulta sólo si hay un panel
         * montado con esa clave, así que en las demás pestañas no cuesta nada. No
         * se toca la cola: la respuesta publicada ya vuelve por el webhook como
         * `mensaje`, y abrir un panel no cambia ninguna fila.
         *
         * Recortado (`realtime/visibilidad.ts`) llega sin id, y no hay nada que
         * refrescar.
         */
        if (typeof e.interactionId === 'number') {
          void qc.invalidateQueries({ queryKey: claves.estadoDeRespuesta(e.interactionId) });
          invalidarPresenciasAgrupadas();
        }
      } else if (e.tipo === 'llamada') {
        // Una llamada de WhatsApp cambió de fase (ADR 0123). Acá no se decide nada: la feature de
        // llamadas se suscribe. La recortada no trae `callId` y no se emite.
        const s = senalDeLlamadaDe(e);
        if (s) emitirSenalDeLlamada(s);
      } else if (e.tipo === 'estado') {
        void qc.invalidateQueries({ queryKey: ['wa', 'sesion'] });
        // El webhook de landing emite 'estado' al persistir: el radar se refresca.
        invalidarDashboardAgrupado();
      } else if (e.tipo === 'cambio' && (e.que === 'autorespuesta' || e.que === 'bot')) {
        // El chip de auto-respuesta o de bot cambió de MÁQUINA (el freno
        // automático, el reloj de encolado) o desde OTRA pestaña: `e.que` **es**
        // la raíz de la queryKey (`docs/plan-borrar-el-polling.md` §6 PR 3). Un
        // front viejo ignora este tipo; un server viejo no lo manda, y el chip
        // se queda con la red de 5 min del PR 1.
        void qc.invalidateQueries({ queryKey: [e.que] });
      }
    };

    /**
     * LA RECUPERACIÓN DE LO QUE PASÓ MIENTRAS EL STREAM ESTUVO CAÍDO.
     *
     * Se invalida lo mismo que invalidaría un evento `mensaje` más un `estado`,
     * porque no se sabe cuál de los dos se perdió: la cola, la frescura, el
     * radar, el hilo abierto y el estado de las líneas.
     *
     * ⚠️ **La cola lleva el MISMO jitter que la rama de `mensaje`**, y por el
     * mismo motivo elevado al cuadrado: un deploy corta el stream de las ~8
     * pestañas a la vez, así que todas reconectan en la misma ventana de 3 s y
     * sin el delay dispararían juntas la consulta más cara del sistema —
     * exactamente cuando el server acaba de arrancar.
     */
    function alReconectar() {
      invalidarColaAgrupada();
      void qc.invalidateQueries({ queryKey: ['frescura'] });
      invalidarDashboardAgrupado();
      void qc.invalidateQueries({ queryKey: ['wa', 'conversacion'] });
      // 🔴 Y el estado de las líneas: sin esto, una línea que se montó mientras
      // el front estaba desconectado se queda en su 404 congelado para siempre
      // (`useSesionWa` deja de repreguntarlo a propósito — ver `cadencia.ts`).
      void qc.invalidateQueries({ queryKey: ['wa', 'sesion'] });
    }

    async function conectar() {
      const fin = await consumirStream({
        url: `${API_URL}/api/stream`,
        token: tokenGuardado(),
        senal: control.signal,
        onData: manejar,
        onAbierto: () => {
          if (primeraConexion) {
            primeraConexion = false;
            return;
          }
          alReconectar();
        },
      });
      if (control.signal.aborted) return;
      if (fin === 'no-autorizado') {
        // Token muerto: se corta acá. La re-validación decide si echa (y
        // entonces `sesionActiva` baja y este efecto se desmonta solo).
        alNoAutorizado?.();
        return;
      }
      reintento = setTimeout(() => void conectar(), REINTENTO_MS);
    }

    void conectar();

    return () => {
      control.abort();
      if (reintento !== undefined) clearTimeout(reintento);
      // Las ventanas abiertas se tiran: la guarda del `signal` ya evitaba
      // invalidar sobre un cliente desmontado, pero dejar dos timers de 15 s
      // vivos por cada montaje es una fuga que en un `StrictMode` se duplica.
      agCola.cancelar();
      agDashboard.cancelar();
      agPresencias.cancelar();
    };
  }, [qc, sesionActiva, alNoAutorizado]);
}
