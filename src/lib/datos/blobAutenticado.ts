import { useCallback, useEffect, useState } from 'react';
import { crearCacheDeBlobs } from './cacheDeBlobs';
import { crearFrenoDeMedia, etiquetaDeStatus, type ResultadoDeMedia } from './frenoDeMedia';
import { tokenGuardado } from './token';

/**
 * MEDIA DETRÁS DEL PERÍMETRO — el mecanismo central, y el único.
 *
 * Desde el cierre del issue #36, los adjuntos (`/api/whatsapp/media/*`) y la
 * foto de perfil (`/api/whatsapp/foto/:telefono`) exigen el Bearer de la
 * vendedora, como todo /api. Pero `<img src>`, `<video src>` y `<a href>` no
 * mandan headers — así que la URL directa ya no sirve.
 *
 * La solución de la casa es UNA: fetch con el token → blob → URL de objeto
 * local, que cualquier etiqueta consume sin auth porque ya vive en memoria.
 * Se eligió esto (y no un token corto en la query) porque no deja credenciales
 * en los access logs de nginx ni en el historial del navegador, no caduca a
 * mitad de sesión y reutiliza la misma sesión Bearer que todo lo demás.
 *
 * El costo del blob es que se baja ENTERO — no hay streaming por rango. Por
 * eso hay dos modos:
 *   · eager (default): para lo chico que se ve siempre — imágenes, stickers,
 *     la foto de perfil.
 *   · `alPedir: true`: para lo pesado — video, audio, documentos. No se baja
 *     nada hasta que la vendedora toca; el componente llama `pedir()`.
 *
 * Y una memoria compartida (`cacheDeBlobs`): cambiar de chat y volver no
 * re-baja nada, dos burbujas con la misma media comparten un solo fetch, y el
 * caché —no el hook— es el dueño de la revocación (LRU con límite; `limpiar`
 * en el cierre de sesión). Todo componente que muestre media del server pasa
 * por acá. Si aparece otro `<img>` apuntando a la API, es un bug: o usa este
 * hook, o va a 401.
 *
 * ── 🔴 UN FALLO NO ES UN FALLO: SON TRES, Y SE TRATAN DISTINTO ──
 * Hasta el 19-ago-2026 acá había un `if (!res.ok) return null` que colapsaba el
 * 404, el 401 y el 503 en el MISMO `null`. Lo que costó, medido sobre el log de
 * nginx del 18-ago: **5.472 de los 6.233 pedidos diarios a
 * `/api/whatsapp/foto/:telefono` fallan** (88 %), y **1.891 de ésos son 503**
 * sobre un puñado de números, todos los días. El front no podía hacer nada
 * mejor porque ni siquiera podía distinguir «ya sabíamos que no tiene foto» de
 * «no se pudo preguntar». Ahora la bajada devuelve una etiqueta
 * (`frenoDeMedia.ts`) y con eso el 404 se recuerda y el 503 se frena — la
 * decisión de cuánto vive ahí, pura y testeada; acá vive nada más el cableado.
 *
 * ⚠️ **La etiqueta NO se publica en el estado del hook, a propósito.** Los tres
 * fallos se dibujan igual (iniciales en el avatar, «no se pudo cargar» en la
 * burbuja) y nadie ramifica sobre el motivo; y en la bajada compartida —dos
 * componentes pidiendo la misma URL, que es el caso normal— el que se cuelga de
 * la promesa ajena no vio cómo terminó, así que llenar el campo sería adivinar.
 * Un campo público que a veces miente es peor que no tenerlo. El día que una
 * pantalla necesite ramificar, esto se resuelve devolviendo la etiqueta desde
 * `cacheDeBlobs.traer`, no adivinándola acá.
 */

// 250 entradas: más que un hilo entero (LIMIT 200) para que el LRU no revoque
// blobs que siguen montados. Lo pesado entra solo si la vendedora lo pidió.
const cache = crearCacheDeBlobs(250, (valor) => URL.revokeObjectURL(valor));

/**
 * Qué URLs no vale la pena volver a pedir todavía. Compartido por todos los
 * montajes a propósito: el defecto que arregla es justamente que cada montaje
 * volviera a pedir lo que el anterior ya sabía.
 */
const freno = crearFrenoDeMedia();

/** Revoca todos los blobs. Se llama al cerrar sesión (via `olvidarCacheDeHermes`). */
export function limpiarBlobsAutenticados(): void {
  cache.limpiar();
  // Los frenos también son de SU sesión: la que entra después arranca limpia,
  // y si la línea se cayó mientras la anterior miraba, no hereda la espera.
  freno.limpiar();
}

type Bajada = { tipo: 'ok'; blob: Blob } | { tipo: Exclude<ResultadoDeMedia, 'ok'> };

/**
 * El fetch con el Bearer, ya etiquetado. **No tira nunca**: una red caída es un
 * `no-se-pudo` como cualquier otro, y dejarla salir como excepción la sacaría
 * del freno — que es exactamente el caso que más conviene frenar.
 */
async function bajarMedia(url: string): Promise<Bajada> {
  const token = tokenGuardado();
  try {
    const res = await fetch(url, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return { tipo: etiquetaDeStatus(res.status) };
    return { tipo: 'ok', blob: await res.blob() };
  } catch {
    return { tipo: 'no-se-pudo' };
  }
}

interface EstadoBlob {
  url: string | null;
  fallo: boolean;
  bajando: boolean;
}

export function useBlobAutenticado(
  url: string | null,
  opciones?: { alPedir?: boolean },
): EstadoBlob & { pedir: () => void } {
  const alPedir = opciones?.alPedir ?? false;
  // Con `alPedir`, la bajada arranca recién cuando `pedir()` marcó ESTA url —
  // atado a la url, no a un booleano, para que cambiar de mensaje no herede
  // el permiso del anterior. `intento` permite que un nuevo `pedir()` reintente
  // después de un fallo (el fallo no se cachea, pero el efecto no re-corría).
  const [pedidaPara, setPedidaPara] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const activa = url !== null && (!alPedir || pedidaPara === url);

  const [estado, setEstado] = useState<EstadoBlob>({ url: null, fallo: false, bajando: false });

  useEffect(() => {
    if (!url || !activa) {
      setEstado({ url: null, fallo: false, bajando: false });
      return;
    }

    const enCache = cache.obtener(url);
    if (enCache) {
      setEstado({ url: enCache, fallo: false, bajando: false });
      return;
    }

    // El freno va DESPUÉS del caché y ANTES del fetch: lo que ya está bajado se
    // muestra igual —frenar no es esconder—, y lo que no, se pregunta solo si
    // tiene sentido preguntarlo.
    if (freno.consultar(url, Date.now()) !== 'pedir') {
      setEstado({ url: null, fallo: true, bajando: false });
      return;
    }

    let vivo = true;
    setEstado({ url: null, fallo: false, bajando: true });
    cache
      .traer(url, async () => {
        const r = await bajarMedia(url);
        freno.anotar(url, r.tipo, Date.now());
        return r.tipo === 'ok' ? URL.createObjectURL(r.blob) : null;
      })
      .then((objectUrl) => {
        // Sin revocación acá: el blob es del caché, no de este montaje —
        // otro componente puede estar mostrándolo.
        if (vivo) setEstado({ url: objectUrl, fallo: objectUrl === null, bajando: false });
      })
      .catch(() => {
        if (vivo) setEstado({ url: null, fallo: true, bajando: false });
      });
    return () => {
      vivo = false;
    };
  }, [url, activa, intento]);

  const pedir = useCallback(() => {
    if (!url) return;
    // 🔴 EL CLIC HUMANO LE GANA AL FRENO. `pedir()` es el botón «reintentar» de
    // un adjunto pesado: un reintento que ALGUIEN PIDIÓ. El freno existe para
    // los que nadie pidió, así que sin esta línea el arreglo de rendimiento le
    // rompería el botón a la vendedora —y en silencio, porque el botón seguiría
    // dibujándose igual.
    freno.olvidar(url);
    setPedidaPara(url);
    setIntento((n) => n + 1);
  }, [url]);

  return { ...estado, pedir };
}
