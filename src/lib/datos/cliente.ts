import { QueryClient } from '@tanstack/react-query';
import { API_URL } from '../../config';
import { tokenGuardado } from './token';

/**
 * LA CAPA DE DATOS. Una sola puerta al servidor.
 *
 * ── El problema que resuelve ──
 * Había 28 llamadas `fetch` sueltas repartidas en 12 archivos, cada una con su `useState` y su
 * `useEffect`, sin caché y sin cancelación. Consecuencias reales, medidas:
 *
 *   · Navegar y volver = refetch completo, siempre.
 *   · `/api/interactions/canales` se pedía desde 3 pantallas sin compartir nada.
 *   · Una respuesta tardía podía PISAR EL BORRADOR que el operador estaba escribiendo.
 *   · Una respuesta vieja podía pisar los datos del canal nuevo al navegar.
 *
 * ── Las tres reglas ──
 *
 *   1. ESTADO DEL SERVIDOR → acá (caché). Nunca en localStorage.
 *      Si dos personas atienden, tienen que verse. localStorage las aísla.
 *
 *   2. PREFERENCIAS DE UI → localStorage (`useLocalStorage`). Nunca en el servidor.
 *      Qué rango elegiste no le importa a nadie más.
 *
 *   3. LO DERIVABLE NO SE GUARDA.
 *      `respondida` no es un estado: es `status !== 'nuevo'`. Por eso sobrevive a la recarga —
 *      nunca vivió en el cliente.
 */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * 30 s de frescura. Ir y volver entre pantallas dentro de ese lapso no vuelve a pedir nada.
       * Pasado eso, se revalida en segundo plano: la pantalla muestra lo viejo al instante y se
       * actualiza sola. Nunca un spinner por navegar.
       */
      staleTime: 30_000,
      /** El caché sobrevive 5 min sin observadores: volver a una pantalla es instantáneo. */
      gcTime: 5 * 60_000,
      /** Los datos vienen de Postgres y cambian por acción humana, no solos. No hace falta. */
      refetchOnWindowFocus: false,
      /**
       * Un reintento, salvo que el SERVER haya dicho que no sirve (`debeReintentar`).
       * Acá vivía un `retry: 1` a secas: la opinión del server llegaba a `ErrorApi`
       * desde #175 y este borde la tiraba igual. Ver el docblock de la función.
       */
      retry: debeReintentar,
      /** Y cuánto esperar: lo que el server pidió en `Retry-After`, con jitter. */
      retryDelay: esperaAntesDeReintentar,
    },
  },
});

export class ErrorApi extends Error {
  // Declaradas a mano: `erasableSyntaxOnly` prohíbe las propiedades de parámetro, porque son
  // sintaxis que TypeScript *emite* en vez de solo borrar.
  readonly status: number;
  readonly tipo?: string;
  /** El detalle que algunos endpoints (responder) mandan junto al error. */
  readonly errores?: string[];
  /**
   * La CLASE del fallo, cuando el endpoint la nombra: `codigo` en el cuerpo del error.
   *
   * El proxy de Ivi devuelve un 502 con uno de ocho códigos tipados —`timeout` no es lo
   * mismo que `falta_config`, y ninguno de los dos es «Ivi no encontró datos»— y hasta acá
   * llegaban todos como el mismo 502 anónimo: el server distinguía ocho clases de problema
   * con cuidado y el cliente las aplanaba a una. Sin esto, la pantalla solo puede decir
   * «algo falló», que es justo lo que la regla fail-closed vino a evitar.
   */
  readonly codigo?: string;
  /**
   * SI REINTENTAR PUEDE DAR OTRO RESULTADO — **según el server, que es el que sabe**.
   *
   * El proxy de Ivi ya calcula esto (`esReintentable`, `server/src/ivi/cliente.ts`) y lo manda
   * en cada 502 **exactamente para que la app no reimplemente la tabla de códigos**. Hasta acá
   * se descartaba en este borde, así que la pantalla la reimplementaba igual — y ya divergía
   * antes de mergear (#175).
   *
   * Lo que el front NO puede reproducir por su cuenta: `http_inesperado` es un cajón de sastre
   * donde caen el `404` de «todavía no lo desplegaron» (permanente) y el `500` de Ivi o los
   * `502/504` de nginx (transitorios). El server los distingue mirando el **estado HTTP**, que
   * no viaja en el cuerpo. Una tabla indexada solo por `codigo` no puede acertar los dos.
   *
   * `undefined` = el endpoint no se pronunció (un server viejo, o un error que no es de Ivi).
   * Ahí manda la tabla del front, que sigue siendo el respaldo — nunca se asume `false` acá.
   */
  readonly reintentable?: boolean;
  /**
   * EL CUERPO DEL ERROR, CRUDO — lo que el endpoint dijo y estas cinco propiedades
   * no alcanzan a representar.
   *
   * 🔴 **Sin esto, un error que trae CIFRAS se aplana a una frase.** El caso que lo
   * obligó es el techo de ritmo de Correos: el server contesta
   * `429 { codigo: 'techo_de_ritmo', motivo: 'techo_hora', techo: 20, usado: 20 }`
   * — o sea que se tomó el trabajo de decir **cuál** techo y **cuánto** va usado,
   * justamente para que la pantalla pueda escribir «20 de 20 en la última hora» en
   * vez de «no se pudo enviar». De los cuatro campos, `ErrorApi` sólo se quedaba con
   * `codigo`: los otros tres se perdían en este borde, y la vendedora quedaba
   * mirando un fallo genérico que la invita a volver a apretar Enviar.
   *
   * Es la misma lección que `codigo` y `reintentable` (#175): **el server distingue
   * con cuidado y el cliente lo aplana**. La diferencia es que aquellos dos son
   * transversales y merecen su propiedad; esto es la válvula para lo que es propio
   * de un endpoint y no justifica una sexta.
   *
   * ⚠️ **No se lee sin comprobar el tipo.** Es `unknown` adentro a propósito: viene
   * de la red, y un `techo` que llega como cadena tiene que romper en el `if` de
   * quien lo lee, nunca aparecer concatenado en un mensaje. `undefined` = el cuerpo
   * no era un objeto JSON (una caída de nginx devuelve HTML).
   */
  readonly cuerpo?: Record<string, unknown>;
  /**
   * CUÁNTO PIDIÓ ESPERAR EL SERVER, en milisegundos — el header `Retry-After`.
   *
   * 🔴 **El server lo manda desde el 21-ago-2026 y el front lo tiraba a la basura**:
   * `server/src/lib/ruta.ts` corta toda request que pase 25 s sin responder y contesta
   * `503 servidor_ocupado` **con `Retry-After: 5`**, exactamente para que la app pueda
   * hacer backoff en vez de comerse el corte mudo de nginx a los 60 s. Había **cero
   * ocurrencias de `Retry-After` en todo `src/`**: el server distinguía «estoy saturado,
   * vuelve en 5» de «esto está roto» y el cliente reintentaba a los 1.000 ms igual,
   * amplificando la saturación que el 503 vino a frenar.
   *
   * Es la misma lección que `codigo` y `reintentable`, con una vuelta más: acá el dato
   * no viene en el cuerpo sino en un **header**, y por eso se perdía sin que ninguna
   * prueba de contrato del cuerpo lo pudiera notar.
   *
   * 🔴 **SÓLO SE LEE MISMO-ORIGEN, y eso hay que saberlo antes de dar el frente por
   * roto en dev.** `Retry-After` NO es un header de respuesta safelisted por CORS y
   * `server/src/index.ts` monta `cors()` **sin `exposedHeaders`**, así que en un
   * pedido cross-origin el navegador lo filtra y `res.headers.get('retry-after')`
   * devuelve `null`. En producción y en pruebas no muerde —la UI se sirve por OTA
   * desde el MISMO origen que la API (`hermes-api.goberna.us`,
   * `pruebas.hermes.goberna.us`)—, pero con `npm run dev` el front vive en `:5173` y
   * la API en otro puerto: **ahí este camino está muerto y en silencio**. Encenderlo
   * también en dev es un `cors({ exposedHeaders: ['Retry-After'] })` en el server, o
   * sea otro PR y otro N5.
   *
   * ⚠️ Sólo se acepta la forma «segundos enteros», que es la que el server manda. El
   * RFC además admite una fecha HTTP; interpretarla exigiría confiar en el reloj de la
   * máquina de la vendedora contra el del server, y un reloj adelantado daría una
   * espera negativa. `undefined` = el server no pidió nada, y decide el backoff normal.
   */
  readonly reintentarEnMs?: number;

  constructor(
    message: string,
    status: number,
    tipo?: string,
    errores?: string[],
    codigo?: string,
    reintentable?: boolean,
    cuerpo?: Record<string, unknown>,
    reintentarEnMs?: number,
  ) {
    super(message);
    this.status = status;
    this.tipo = tipo;
    this.errores = errores;
    this.codigo = codigo;
    this.reintentable = reintentable;
    this.cuerpo = cuerpo;
    this.reintentarEnMs = reintentarEnMs;
  }
}

/**
 * SEGUNDOS DEL `Retry-After` → MILISEGUNDOS. `undefined` si no vino o no se entiende.
 *
 * Se exporta para poder testearla: el header es lo único de esta capa que no llega en el
 * cuerpo, así que es lo único que una prueba de contrato de JSON no puede vigilar.
 */
export function reintentarEnMsDe(cabeceras: Headers): number | undefined {
  const crudo = cabeceras.get('retry-after');
  if (crudo == null) return undefined;
  // `Number` sobre '' da 0 y sobre ' 5 ' da 5; se exige la forma entera y positiva.
  // Una fecha HTTP («Wed, 21 Oct 2026 07:28:00 GMT») cae acá y se descarta: ver el
  // docblock de `ErrorApi.reintentarEnMs`.
  const segundos = Number(crudo.trim());
  if (!Number.isInteger(segundos) || segundos <= 0) return undefined;
  // Techo de un minuto: el header lo puede escribir un intermediario (nginx, Cloudflare)
  // y una app que se queda quieta diez minutos se ve exactamente igual que una colgada.
  return Math.min(segundos, 60) * 1000;
}

/**
 * ¿REINTENTAR? — **la opinión del server le gana a la del front, y esto es #37 al revés.**
 *
 * 🔴 `ErrorApi.reintentable` existe desde #175 con un docblock que dice, textual, que el
 * server es «el que sabe» — y el `retry: 1` a secas de este mismo archivo lo ignoraba. O sea
 * que el dato cruzaba el borde entero (server → `api()` → `ErrorApi`) para que lo leyeran dos
 * PANTALLAS y ninguna capa de red: la que efectivamente decide si sale un segundo pedido
 * seguía decidiendo a ciegas. El caso que muerde es `falta_config`: un error de configuración
 * que no se va a arreglar solo, reintentado automáticamente, contra un server saturado.
 *
 * ⚠️ **Y los emisores del flag son DOS, no uno.** `routes/ivi.ts` (`esReintentable` sobre
 * `CODIGO_ERROR_IVI`) y **`routes/correos.ts:886`** (`clasificarRechazo`, el 502
 * `envio_rechazado`), leídos por `features/ivi/errores.ts` y `features/correos/correos.ts`
 * respectivamente. Hoy el de correos no pasa por acá porque mandar un correo es una
 * MUTACIÓN y `defaultOptions.mutations` es otro cajón — pero el día que alguien le ponga
 * un `retry` a las mutaciones, esta función empieza a gobernarlo también, y ahí su semántica
 * («reintentar EXACTAMENTE lo mismo no sirve») es la correcta.
 *
 * ⚠️ **Sólo `false` corta.** `undefined` es «el server no se pronunció» (un server viejo, o
 * un error que no viene de una ruta que calcule el flag) y ahí se reintenta como siempre —
 * asumir `false` apagaría el reintento de casi todo el sistema con un cambio de una línea.
 * `true` tampoco agrega reintentos: el techo de uno sigue mandando.
 *
 * ⚠️ **No mira `codigo`, a propósito.** La tabla de códigos vive en `features/ivi/errores.ts`
 * y es el RESPALDO de una pantalla; copiarla acá sería la segunda implementación que
 * `server/src/ivi/paridad-front.test.ts` existe para impedir.
 */
export function debeReintentar(fallos: number, error: unknown): boolean {
  if (error instanceof ErrorApi && error.reintentable === false) return false;
  return fallos < 1;
}

/** El backoff exponencial de TanStack, que es lo que corría hasta acá. */
function backoffPorDefecto(fallos: number): number {
  return Math.min(1000 * 2 ** fallos, 30_000);
}

/**
 * CUÁNTO ESPERAR ANTES DEL REINTENTO — con `Retry-After` cuando el server lo pidió.
 *
 * 🔴 **EL JITTER NO ES DECORACIÓN: ES LA RAZÓN DE SER DE ESTA FUNCIÓN.** El `503
 * servidor_ocupado` lo dispara la saturación, así que llega a **todas las pestañas a la
 * vez**; con un delay fijo de 5 s las ocho vendedoras vuelven a pedir en el mismo segundo y
 * le devuelven al server exactamente la estampida que lo tumbó. Es la misma cicatriz que
 * `intervaloDeCola` (`lib/datos/latido.ts`) documenta para el SSE, medida ahí en load
 * average 16 sobre un VPS de 8 núcleos.
 *
 * La banda es **0,5× a 1,5×** lo que pidió el server (2,5 a 7,5 s con su `Retry-After: 5`).
 * Se acepta caer un poco por debajo de lo pedido: lo que este número tiene que lograr es
 * DESINCRONIZAR, no obedecer al segundo — y el techo de un reintento acota el daño de
 * volver medio segundo antes.
 *
 * ⚠️ **`Math.random()` acá SÍ es seguro, y hay que decirlo porque el gemelo de esta trampa
 * está vivo en el repo.** Verificado en `@tanstack/query-core@5.101.4`
 * (`build/modern/retryer.js`): `retryDelay` se evalúa **una sola vez por fallo**, en la línea
 * inmediatamente anterior a `sleep(delay)`, así que el número sorteado es el que se usa. El
 * que NO se puede escribir así es `refetchInterval`: ese se re-evalúa en cada `setOptions`
 * (`queryObserver.js#computeRefetchInterval`) y, si el valor cambia, **clava el temporizador
 * y lo arranca de cero** — un `Math.random()` ahí adentro nunca da dos veces lo mismo, o sea
 * que el intervalo se reinicia en cada render.
 */
export function esperaAntesDeReintentar(fallos: number, error: unknown): number {
  const pedido = error instanceof ErrorApi ? error.reintentarEnMs : undefined;
  if (pedido == null) return backoffPorDefecto(fallos);
  return pedido * (0.5 + Math.random());
}

/**
 * El único `fetch` del frontend. Todo pasa por acá.
 *
 * Recibe la `signal` de react-query, así que la cancelación al desmontar o al cambiar de
 * parámetros es automática — que es lo que mata las races que teníamos.
 */
export async function api<T>(ruta: string, init?: RequestInit): Promise<T> {
  // El token de la vendedora (si inició sesión) va en cada request. Un Bearer en
  // el header, no una cookie: la app de escritorio habla con su propio backend.
  const token = tokenGuardado();
  // Un `FormData` (los adjuntos de Correos, `Composer.tsx`) NO puede llevar
  // `content-type` a mano: el boundary del multipart lo calcula el navegador
  // al armar el body, y pisarlo con `application/json` deja al server sin poder
  // leer ni un campo — ni siquiera los que no son archivos.
  const esFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const res = await fetch(`${API_URL}${ruta}`, {
    ...init,
    headers: {
      ...(esFormData ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const cuerpo = await res.json().catch(() => ({}));
    // La key canónica es `errores` (así emite responder); `errors` se acepta
    // porque la mitad heredada del server todavía la usa en sus 400.
    const errores = Array.isArray(cuerpo.errores)
      ? cuerpo.errores
      : Array.isArray(cuerpo.errors)
        ? cuerpo.errors
        : undefined;
    throw new ErrorApi(
      // `message` es la canónica (305 rutas); `error` es la otra (11, `routes/persona.ts` entre
      // ellas — medido el 4-sep-2026). Leer sólo la primera aplanaba el rechazo de Meta ya
      // traducido a «Error 502», y el hilo de Messenger mostraba su genérico encima.
      cuerpo.message ?? (typeof cuerpo.error === 'string' ? cuerpo.error : undefined) ?? `Error ${res.status}`,
      res.status,
      cuerpo.type,
      errores,
      typeof cuerpo.codigo === 'string' ? cuerpo.codigo : undefined,
      // Solo un booleano de verdad cuenta como que el server se pronunció. Cualquier otra cosa
      // —ausente, `null`, una cadena— queda en `undefined` y decide la tabla del front.
      typeof cuerpo.reintentable === 'boolean' ? cuerpo.reintentable : undefined,
      // El cuerpo entero, para lo que ninguna de las cinco de arriba representa (ver `ErrorApi`).
      // `null` es un objeto para `typeof` y NO trae nada: se descarta acá y no en cada lector.
      typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as Record<string, unknown>) : undefined,
      // El `Retry-After` del 503 de `lib/ruta.ts`. Es un HEADER y no una clave del cuerpo:
      // si no se lee acá no se lee en ningún lado, porque `res` no sale de esta función.
      reintentarEnMsDe(res.headers),
    );
  }
  return res.json() as Promise<T>;
}

/**
 * Las claves del caché, en un solo lugar.
 *
 * Tenerlas centralizadas es lo que permite invalidar con precisión: al responder una
 * interacción, invalidamos `overview` y `bandeja` — y las dos pantallas que las muestran se
 * actualizan solas, sin que ninguna sepa de la otra.
 */
export const claves = {
  overview: (rango: string) => ['overview', rango] as const,
  bandeja: (filtros: Record<string, unknown>) => ['bandeja', filtros] as const,
  canal: (canal: string, rango: string) => ['canal', canal, rango] as const,
  persona: (id: number) => ['persona', id] as const,
  cuentasPauta: () => ['config', 'cuentas-pauta'] as const,
  cuentasMeta: () => ['meta', 'ad-accounts'] as const,
  /**
   * Lo que un comentario ya tiene respondido y quién más lo tiene abierto
   * (`features/canales/respuestaUnica.ts`). Vive acá porque la invalidan DOS
   * lugares: el panel y el SSE (`tiempoReal.ts`). Con la clave escrita dos
   * veces, el aviso en vivo refrescaría una consulta que nadie pidió.
   */
  estadoDeRespuesta: (interactionId: number) => ['responder', 'estado', interactionId] as const,
  /**
   * Quién tiene abierto cada comentario, para las pastillas de la cola y del
   * Pipeline (ADR 0121). La invalidan las pastillas y el SSE, por el mismo motivo.
   */
  presenciasDeComentarios: () => ['responder', 'presencias'] as const,
} as const;
