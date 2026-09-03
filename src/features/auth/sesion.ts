import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../../lib/datos/cliente';
import { olvidarCacheDeHermes } from '../../lib/datos/cacheDeHermes';
import { borrarToken, guardarToken, tokenGuardado } from '../../lib/datos/token';
import { mensajeDeErrorCenturion, tokenCenturionDeLaUrl } from './centurionSso';
import { tieneSesionDeCerberus } from './identidad';

/**
 * LA SESIÓN DE LA VENDEDORA, del lado del cliente.
 *
 * El token vive en localStorage; `api()` ya lo adjunta a cada request. Este hook
 * es la fuente de verdad de "¿quién está logueada?": al montar valida el token
 * contra `/api/auth/yo`, así una sesión expirada manda de vuelta al login en vez
 * de mostrar una app que va a dar 401 en cada llamada.
 *
 * El token se borra SOLO ante un 401 real (token muerto). Si el server no
 * contesta (red caída, deploy a medias), la sesión sigue siendo válida:
 * `sinServer` se prende y `reintentar()` vuelve a validar sin perder nada.
 *
 * ── Por qué la sesión se cree el token antes de preguntar ──
 * Validar contra el server ANTES de mostrar nada dejaba la app tapada por un
 * esqueleto durante todo el viaje de ida y vuelta a VPS1 — y eso hacía inútil el
 * caché persistido, que existe justamente para que al abrir haya algo pintado
 * (ADR 0007). Así que si hay un token que todavía no venció, la vendedora entra
 * de una y `/api/auth/yo` valida por detrás.
 *
 * Lo que NO cambia: la firma la sigue verificando el server en cada request, y
 * un 401 real echa igual. Lo único que se adelanta es la pantalla, y lo que se
 * ve mientras tanto es el caché de ESA misma vendedora, en SU máquina.
 */

export interface Vendedora {
  id: string;
  nombre: string;
  /** El apodo que configuró en «Configuración», si es que lo hizo. */
  apodo?: string | null;
  /** La ruta de su foto de perfil (`/api/perfil/foto/...`), si subió una. */
  fotoUrl?: string | null;
  /**
   * ¿Atiende una línea de campaña? Decide qué vistas tiene el riel
   * (`features/vistas/acceso.ts`).
   *
   * ⚠️ **OPCIONAL, y se lee como `false` cuando falta.** Falta en un server viejo
   * y en el atajo de `quienDiceSer` —que arma la vendedora leyendo el token, sin
   * preguntarle nada a nadie—, y en los dos casos el riel completo es el
   * comportamiento de siempre. Que el default sea «no es de campaña» no abre
   * nada: las superficies de ventas las niega el server (`modulos/deEsteModulo.ts`),
   * así que lo peor que pasa es ver un ícono que contesta 403.
   */
  esDeCampana?: boolean;
  /**
   * ¿Entrena al bot? Decide si «Entrenar bot» está en el riel (ADR 0077). Al
   * revés que `esDeCampana`, **ausente se lee como `false`**: una vista que es
   * de UNA persona se esconde hasta que el server diga lo contrario. Viaja en el
   * login, en el canje de Centurión y en `/yo`, por la misma función del server.
   */
  puedeEntrenar?: boolean;
  /**
   * ¿Es el candidato? Decide si ve «Nuevo contacto» en Contactos de campaña
   * (ampliación de ADR 0060). Como `puedeEntrenar`, **ausente se lee como
   * `false`**: es una vista de una persona del equipo, se esconde hasta que
   * el server diga lo contrario. Quien niega de verdad el registro sin
   * conversación es el server, en `POST /api/contactos/registro`.
   */
  esCandidato?: boolean;
}

/** El último usuario que entró — JAMÁS la contraseña. Precarga el login. */
export const CLAVE_ULTIMO_USUARIO = 'hermes.ultimoUsuario';

/**
 * Quién dice ser el token, sin validarlo. El cuerpo es `<id>|<expira>` en
 * base64url (ver `auth/sesion.ts` del server); la FIRMA no se mira, porque acá
 * no hay secreto con el que mirarla — de eso se encarga el server en cada
 * request. Devuelve null si está vencido o no se entiende, y entonces no hay
 * atajo: se espera al server como siempre.
 */
export function quienDiceSer(token: string): Vendedora | null {
  const cuerpo = cuerpoDelToken(token);
  if (!cuerpo) return null;
  const [id, expira] = cuerpo;
  if (!id || !(Number(expira) > Date.now())) return null;
  // `/api/auth/yo` devuelve el username como nombre: no hay un dato mejor que adelantar.
  return { id, nombre: id, ...moduloDelToken(token) };
}

/**
 * El cuerpo del token, partido — **la única lectura de ese formato en el front**.
 * Con dos, el riel que se dibuja al entrar y el que se dibuja al recargar pueden
 * divergir sin que nada falle (#37). Devuelve null si no se entiende: un token
 * que no se puede leer no es un token vencido, es uno que no sirve.
 */
function cuerpoDelToken(token: string): string[] | null {
  try {
    const [cuerpo] = token.split('.');
    return atob(cuerpo.replace(/-/g, '+').replace(/_/g, '/')).split('|');
  } catch {
    return null;
  }
}

/**
 * DE QUÉ MÓDULO ES, SEGÚN EL TOKEN — el adelanto que ahorra la ida al server.
 *
 * El server lo firma adentro del token (`server/src/auth/sesion.ts`) por un
 * motivo medido: preguntarlo es `GET /api/auth/yo`, cuya **mediana es 20 ms y
 * cuyo p90 es 41 s** en producción (21-ago-2026) — no porque cueste, sino porque
 * hace cola detrás de consultas de 8 s. Leerlo de acá dibuja el riel correcto en
 * el primer render, sin una sola request. `/yo` sigue contestando y **pisa** este
 * valor: el token es la foto, la base es la verdad.
 *
 * 🔴 **UN MÓDULO QUE NO ESTÁ NO ES «ventas»: ES `undefined`, Y LA CLAVE NO SE
 * PONE.** Se ve en el spread: con `esDeCampana: false` explícito, esto PISA lo
 * que traiga `/yo` en cualquier merge que se escriba mañana; sin la clave, no
 * pisa nada. Y los dos casos en que falta —un token emitido antes de este frente,
 * un server que todavía no lo firma— tienen que comportarse **exactamente como
 * ayer**: riel de la Escuela, corregido cuando el server conteste.
 *
 * ⚠️ Un valor que este front no conoce (un módulo nuevo del server) cae en
 * `false`, no en un throw: dibuja el riel completo y el server niega lo que no le
 * toca. Esconder de más sería peor que mostrar de más — lo que protege de verdad
 * es `modulos/deEsteModulo.ts`, nunca este archivo.
 */
export function moduloDelToken(token: string): { esDeCampana?: boolean } {
  const modulo = cuerpoDelToken(token)?.[2];
  return modulo ? { esDeCampana: modulo === 'campana' } : {};
}

export function useSesion() {
  const [vendedora, setVendedora] = useState<Vendedora | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sinServer, setSinServer] = useState(false);
  const [intento, setIntento] = useState(0);
  /**
   * ¿Hermes todavía tiene su cookie de Cerberus? `null` = no se sabe (server viejo
   * o todavía no contestó). `false` es la única que hay que denunciar.
   *
   * Son dos vidas distintas: el token de Hermes dura 14 días y sobrevive un
   * reinicio; la cookie de Cerberus vive en memoria del proceso y muere con él.
   * Sin esto, la vendedora se enteraba recién al registrar una venta, con un 409.
   */
  const [cerberusVivo, setCerberusVivo] = useState<boolean | null>(null);
  /** Vino de Centurión con un link que no sirvió. `Login` lo puede mostrar. */
  const [errorCenturion, setErrorCenturion] = useState<string | null>(null);

  useEffect(() => {
    async function arrancar() {
      // ── EL BUZÓN DE CENTURIÓN, primero: se lee UNA VEZ, no es un router ──
      // (mismo criterio que `notas/porLink.ts`, ADR 0048). Si el canje falla no
      // se corta acá: puede haber una sesión guardada de un login anterior.
      const tokenCenturion = tokenCenturionDeLaUrl();
      if (tokenCenturion) {
        try {
          const r = await api<{ token: string; vendedora: Vendedora }>('/api/auth/centurion', {
            method: 'POST',
            body: JSON.stringify({ token: tokenCenturion }),
          });
          guardarToken(r.token);
          /**
           * 🔴 **EL MÓDULO SALE DEL TOKEN ACÁ TAMBIÉN, y faltaba.**
           *
           * `/api/auth/centurion` devuelve `{ id, nombre, puedeEntrenar }` y
           * nada más — igual que `/login`. Sin este merge, quien llega por el
           * link de Centurión —o sea **toda la gente de campaña, que es la única
           * que usa esta puerta**— entraba con el riel de la Escuela: las cinco
           * vistas que no son suyas, el panel con la ficha de Cerberus, y un 403
           * en cada una, hasta el próximo reload.
           *
           * Es exactamente el defecto que `entrar()` arregló el 21-ago-2026 en la
           * otra puerta, y esta se quedó sin arreglar: dos puertas al mismo canje
           * y la regla escrita una sola vez, pero llamada una sola vez también.
           * Encontrado abriendo dos sesiones a la vez para probar ADR 0083.
           */
          setVendedora({ ...r.vendedora, ...moduloDelToken(r.token) });
          setSinServer(false);
          // Esta identidad no tiene sesión de Cerberus y nunca la va a tener. Se
          // pregunta con la MISMA función que `entrar()`, no con un `false` a
          // mano: son dos puertas al mismo canje y la regla es una sola.
          setCerberusVivo(tieneSesionDeCerberus(r.vendedora.id));
          setCargando(false);
          return;
        } catch (err) {
          setErrorCenturion(mensajeDeErrorCenturion(err));
          // sigue abajo: quizás hay una sesión guardada de antes.
        }
      }

      const token = tokenGuardado();
      if (!token) {
        setCargando(false);
        return;
      }
      // El atajo: con un token que no venció, la app se pinta YA desde el caché.
      const supuesta = quienDiceSer(token);
      if (supuesta) {
        setVendedora(supuesta);
        setCargando(false);
      } else {
        setCargando(true);
      }
      setSinServer(false);
      try {
        /**
         * 🔴 SI EL TOKEN NO DICE EL MÓDULO, SE PIDE UNO QUE LO DIGA — una vez.
         *
         * Los tokens emitidos antes de este frente no lo traen y duran catorce
         * días: sin esto, cada arranque de esa persona dibujaría el riel por
         * defecto hasta que esta misma llamada conteste, y su p90 en producción
         * es de **41 s**. Con `?renovar=1` el server devuelve un token
         * equivalente con el módulo adentro —mismo id y **misma expiración**,
         * ver `reemitirConModulo`— y del arranque siguiente en adelante el riel
         * correcto sale en el primer frame.
         *
         * ⚠️ **Quien decide es el front y no el server**, y no es un capricho: el
         * server tendría que leer el módulo del token para saber si falta, que
         * es justo lo que `auth/sesion.ts` promete que nunca hace. Acá el dato
         * está a mano y no cuesta nada.
         *
         * Se apaga solo: en cuanto el token guardado trae el módulo, la
         * condición deja de cumplirse para siempre.
         */
        const sinModulo = !('esDeCampana' in moduloDelToken(token));
        const r = await api<{ vendedora: Vendedora; cerberus?: boolean; token?: string }>(
          `/api/auth/yo${sinModulo ? '?renovar=1' : ''}`,
        );
        // Un server viejo no manda `token`; ahí no hay nada que guardar y el
        // próximo arranque vuelve a pedirlo, que es exactamente lo de hoy.
        if (r.token) guardarToken(r.token);
        setVendedora(r.vendedora);
        // El server viejo no manda el campo; ahí no hay nada que denunciar.
        setCerberusVivo(r.cerberus ?? null);
      } catch (err) {
        if (err instanceof ErrorApi && err.status === 401) {
          // Token muerto de verdad: afuera, y sin dejarle el radar a la que entre.
          borrarToken();
          setVendedora(null);
          void olvidarCacheDeHermes();
        } else {
          setSinServer(true); // el server no contesta: el token se queda
        }
      } finally {
        setCargando(false);
      }
    }
    void arrancar();
  }, [intento]);

  /** Vuelve a validar el token guardado (para el estado «no pude conectar con el server»). */
  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  const entrar = useCallback(async (username: string, password: string) => {
    // Si entra OTRA vendedora, lo guardado no es suyo: se va antes de que ella vea nada.
    if (username !== localStorage.getItem(CLAVE_ULTIMO_USUARIO)) await olvidarCacheDeHermes();
    const r = await api<{ token: string; vendedora: Vendedora }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    guardarToken(r.token);
    localStorage.setItem(CLAVE_ULTIMO_USUARIO, username);
    setSinServer(false);
    /**
     * 🔴 **EL MÓDULO SALE DEL TOKEN, NO DEL CUERPO — y sin esto el frente no
     * sirve de nada.** `/api/auth/login` devuelve `{ id, nombre }` y nada más
     * (`auth/loginCascada.ts` lo tipa así), así que hasta el 21-ago-2026 quien
     * entraba por el formulario quedaba **siempre** con el riel de la Escuela
     * hasta el próximo reload: un operador de campaña veía las cinco vistas que
     * no son suyas y comía 403 en cada una. `entrar()` no vuelve a pedir `/yo`,
     * o sea que no había nada más atrás que lo corrigiera.
     *
     * Viaja en el token y en un solo lugar a propósito: mandarlo TAMBIÉN en el
     * cuerpo serían dos fuentes para el mismo hecho, y la que sobreviva a un
     * refactor decide distinto que la otra sin que nada falle (#37).
     */
    setVendedora({ ...r.vendedora, ...moduloDelToken(r.token) });
    // 🔴 **NO ES «entrar ⇒ hay sesión de Cerberus»: DEPENDE DE QUIÉN ENTRÓ.**
    // Era cierto cuando la caja de login era Cerberus y nada más; desde el login
    // directo de Centurión, la misma caja deja pasar identidades que no tienen
    // usuario del otro lado — y afirmarles una cookie que no existe hace que al
    // recargar aparezca el aviso «reconecta con Cerberus», cuyo botón llama acá
    // y vuelve a afirmarla. Un banner que no se puede apagar nunca.
    //
    // Se deriva de la IDENTIDAD que devolvió el login, no de que el login haya
    // salido bien: es el mismo hecho que la puerta `/centurion` ya escribía a
    // mano (`setCerberusVivo(false)`), dicho una sola vez.
    setCerberusVivo(tieneSesionDeCerberus(r.vendedora.id));
  }, []);

  const salir = useCallback(async () => {
    // Best-effort: si no llega (red caída, token ya vencido), el logout sigue
    // igual — no hay nada que la vendedora pueda hacer para que un cierre que
    // no avisó al server sea un motivo para no poder salir de la app. Va ANTES
    // de `borrarToken()`: sin el Bearer, el 401 lo rebota antes de intentarlo.
    await api('/api/actividad/cerrar', { method: 'POST' }).catch(() => {});
    borrarToken();
    setVendedora(null);
    setCerberusVivo(null);
    // El caché persistido también: con dos vendedoras en la misma máquina, la
    // que entra no puede ver el radar de la que se fue.
    void olvidarCacheDeHermes();
  }, []);

  return { vendedora, cargando, sinServer, reintentar, entrar, salir, cerberusVivo, errorCenturion };
}
