import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';

/**
 * MI LÍNEA — la auto-vinculación desde la app (decisión del dueño, 15-ago-2026).
 *
 * Hasta acá vincular una línea era D13: un operador mirando `/vincular` o el
 * panel de Cerberus, y la app de la vendedora "no vincula, solo ve". Esto abre
 * una puerta segunda: una vendedora SIN línea propia trae la suya, sola, desde
 * `PanelUsuario`. Server: `server/src/routes/miLinea.ts`.
 */

export interface MiLinea {
  numero: string | null;
  sesion?: { estado: string };
}

export function useMiLinea() {
  return useQuery({
    queryKey: ['mi-linea'],
    queryFn: () => api<MiLinea>('/api/whatsapp/mi-linea'),
    // Como `useLineas`: esto cambia cuando alguien vincula, casi nunca sin que
    // una persona lo provoque a propósito.
    staleTime: 5 * 60_000,
  });
}

export type EstadoAutoVinculacion =
  | { estado: 'expirado' }
  | { estado: 'vinculando' }
  | { estado: 'esperando_qr'; qr: string }
  /**
   * `montada` la agrega el server desde el arreglo del montaje: la línea quedó
   * REGISTRADA seguro, y `false` significa que todavía no está atendiendo. Viaja
   * **opcional** a propósito — un server viejo no la manda, y ahí se lee como
   * «anduvo», que es lo que ese server efectivamente prometía.
   */
  | { estado: 'conectado'; numero: string; montada?: boolean }
  | { estado: 'baneado'; ban: { codigo: string; expira: string } }
  | { estado: 'error'; motivo: string };

/**
 * 🔴 LOS CUATRO ESTADOS DONDE YA NO HAY NADA QUE ESPERAR.
 *
 * Sin esto, el polling seguía cada 1,5 s **después** de conectar. Y el server, al
 * llegar a `conectado`, suelta el candado — así que el poll siguiente contesta
 * `expirado` y la pantalla que decía «¡Listo! Tu número quedó vinculado» pasaba a
 * **«La vinculación se cortó»** un segundo y medio después, sobre una línea que
 * había quedado perfecta. Lo mismo pisaba `error` y `baneado`: el motivo real
 * —que es lo único accionable— se reemplazaba por el genérico.
 *
 * `expirado` también es terminal: significa «el server no tiene nada mío». Seguir
 * preguntando no lo va a cambiar.
 */
export const ESTADOS_TERMINALES = ['conectado', 'baneado', 'error', 'expirado'] as const;

export function esEstadoTerminal(e: EstadoAutoVinculacion | undefined): boolean {
  return e !== undefined && (ESTADOS_TERMINALES as readonly string[]).includes(e.estado);
}

/** El ritmo de la consola de operador (`routes/vincular.ts`), sin inventar otro. */
export const RITMO_POLLING_MS = 1500;

/**
 * Cuánto esperar hasta el próximo poll, o `false` para no volver a preguntar.
 * Vive fuera del hook, pura y con test, por lo mismo que `presentacion.ts` de Ivi:
 * adentro de la opción de `useQuery` esta decisión no se puede interrogar.
 */
export function ritmoDePolling(e: EstadoAutoVinculacion | undefined): number | false {
  return esEstadoTerminal(e) ? false : RITMO_POLLING_MS;
}

/**
 * El polling del pareo en vuelo — mismo ritmo que la consola HTML de operador
 * (`routes/vincular.ts`). Solo corre mientras `activo` (o sea: después de que el
 * POST volvió 200, nunca antes), y **se apaga solo** al llegar a un estado
 * terminal.
 *
 * ⚠️ `refetchOnWindowFocus` apagado por lo mismo: volver a la ventana media hora
 * después no puede convertir un «¡Listo!» en «se cortó».
 */
export function useEstadoAutoVinculacion(activo: boolean) {
  return useQuery({
    queryKey: ['mi-linea', 'vincular', 'estado'],
    queryFn: () => api<EstadoAutoVinculacion>('/api/whatsapp/mi-linea/vincular/estado'),
    enabled: activo,
    refetchInterval: (query) => ritmoDePolling(query.state.data),
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
}

/**
 * Tira el estado del pareo anterior. Hace falta al reintentar: la queryKey es la
 * misma, así que sin esto el primer render del intento nuevo muestra el
 * `conectado`/`error` del intento viejo hasta que llegue el primer poll.
 */
export function useOlvidarEstadoAutoVinculacion() {
  const qc = useQueryClient();
  return () => qc.removeQueries({ queryKey: ['mi-linea', 'vincular', 'estado'] });
}

export function useIniciarAutoVinculacion() {
  return useMutation({
    mutationFn: (numero: string) =>
      api<{ estado: string }>('/api/whatsapp/mi-linea/vincular', {
        method: 'POST',
        body: JSON.stringify({ numero }),
      }),
  });
}

/** Invalida lo que cambia cuando la línea propia queda conectada O se desvincula. */
export function useInvalidarMiLinea() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['mi-linea'] });
    // `PanelUsuario` (vía `useLineas`) y el selector de la barra leen de acá:
    // sin esto, la línea recién conectada no aparece hasta la próxima recarga.
    void qc.invalidateQueries({ queryKey: ['lineas-whatsapp'] });
    /**
     * 🔴 EL HILO ABIERTO, EN LAS DOS DIRECCIONES — sin esto, «archivar» y
     * «desarchivar» eran correctos en el server y mudos en la pantalla.
     *
     * Al DESVINCULAR con «eliminar chats» (`useDesvincularMiLinea`): si la
     * vendedora tenía el hilo de esa línea abierto en ese momento, seguía
     * viendo los mensajes que acababa de pedir ocultar hasta que hiciera algo
     * que disparara un refetch por su cuenta — el 22-ago-2026 esto era lo que
     * hacía que «ya no deberían figurar» pareciera no haber cambiado nada.
     *
     * Al VOLVER A VINCULAR (`useIniciarAutoVinculacion`, vía este mismo
     * invalidador en `VincularMiWhatsapp.tsx`): es la otra mitad de «cuando un
     * usuario se revincule, sus mensajes pueden ser mostrados» — el server ya
     * los desarchiva solo (`marcarVinculado`), y esto es lo que hace que la
     * pantalla se entere sin que haga falta recargar.
     *
     * Prefijo de 2, no la clave entera: `invalidateQueries` matchea por
     * PREFIJO — alcanza cualquier hilo abierto, sea cual sea su `numeroPropio`.
     */
    void qc.invalidateQueries({ queryKey: ['wa', 'conversacion'] });
  };
}

/**
 * DESVINCULAR MI WHATSAPP — «Desvincular WhatsApp» en Configuración. Cierra la
 * sesión de verdad (`server/src/routes/miLinea.ts:POST /desvincular`) y, si
 * `eliminarChats` es `true`, además retira la asignación (el número deja de
 * figurar como «tuyo» — ver el docblock del server: NO borra un solo mensaje,
 * el event store es append-only).
 */
export function useDesvincularMiLinea() {
  const invalidar = useInvalidarMiLinea();
  return useMutation({
    mutationFn: (eliminarChats: boolean) =>
      api<{ ok: true; numero: string; eliminarChats: boolean }>('/api/whatsapp/mi-linea/desvincular', {
        method: 'POST',
        body: JSON.stringify({ eliminarChats }),
      }),
    onSuccess: invalidar,
  });
}

export function useCancelarAutoVinculacion() {
  const invalidar = useInvalidarMiLinea();
  return useMutation({
    mutationFn: () =>
      api<{ estado: string; cancelada: boolean }>('/api/whatsapp/mi-linea/vincular', { method: 'DELETE' }),
    onSettled: invalidar,
  });
}

/**
 * POR QUÉ SE LE OFRECE VINCULAR — la regla, pura y en un solo lugar.
 *
 * ══ 🔴 «TENER LÍNEA» NO ES LO MISMO QUE «TENER LÍNEA QUE ANDA» ══════════════
 *
 * El panel ofrecía el botón sólo a quien **no tenía ninguna propia**, y con eso
 * dejaba afuera el caso que el server sí sabe resolver: la línea **registrada y
 * muda**. `numeros/autoVinculacion.ts` documenta que `numeroPedido` existe
 * exactamente para eso —«solo 1» es un tope de CUÁNTAS, no una prohibición de
 * volver a parear la que ya es suya— y menciona el escenario: si el montaje en
 * caliente falla o el server reinicia, «la vendedora tiene su fila escrita y
 * ninguna forma de volver a intentarlo desde la app».
 *
 * Eso dejó de ser hipotético: medido el 18-ago-2026, `51963139984` («Betto»,
 * la línea de campaña) arranca en `sin-vincular` con su fila puesta. **El server
 * lo permitía y el front no lo ofrecía**, así que la única salida era `wa:vincular`
 * por SSH — o sea, un operador, que es justo lo que la auto-vinculación vino a
 * sacar del medio.
 *
 * ══ 🔴 UN SOLO ESTADO LO PIDE, Y ES EL DEL CONTRATO — NO EL DEL TRANSPORTE ══
 *
 * Lo que viaja hasta acá (`useMiLinea` → `GET /api/whatsapp/mi-linea` →
 * `sesionDe` → `numeros/dominio.ts:sesionPublicada/estadoSesionAContrato`) es
 * el vocabulario del CONTRATO (`EstadoSesionContrato`): `sin_vincular` (con
 * guión bajo) — que ya junta adentro los DOS motivos por los que no hay sesión
 * (`sin-vincular` del transporte y `cerrada`, cuando WhatsApp la cortó) —,
 * `vinculando`, `conectado`, `desconectado`, `baneado`.
 *
 * Hasta el 22-ago-2026 esto decía `['sin-vincular', 'cerrada']`: los nombres
 * CRUDOS del transporte (`whatsapp/transporte.ts:EstadoSesion`), que nunca
 * llegan hasta el front — el server los traduce ANTES de mandarlos. El bug no
 * se veía en el test puro (`miLinea.vincular.test.ts` llama a la función
 * directo con esos strings y por supuesto matchean), pero si vos desvinculabas
 * el WhatsApp desde el teléfono, la sesión se cerraba (`cambiarEstado({estado:
 * 'cerrada', ...})` en `transporteWhatsmeow.ts`), el server lo traducía a
 * `sin_vincular`, y ESE string no estaba en la lista — el botón «Vincular tu
 * WhatsApp» no volvía a aparecer nunca, aunque la sesión real ya no existiera.
 * Es la cicatriz de siempre (CLAUDE.md #10): la regla estaba bien escrita y
 * nadie la llamaba con el dato real.
 *
 * 🔴 **`baneado` NO lo dispara, y no es un olvido.** Un `temporary_ban` se
 * muestra y **no se reintenta** — ofrecer «vuelve a vincular» ahí sería empujar a
 * la vendedora a re-parear durante un ban, que es exactamente el anti-ban que
 * este repo tiene prohibido por escrito. `vinculando` y `desconectado` tampoco:
 * son transitorios y la línea vuelve sola; ofrecer ahí invita a romper una sesión
 * sana.
 *
 * ⚠️ **Sin estado NO se ofrece.** Falta mientras la consulta viaja y en un server
 * viejo, y las dos veces la respuesta honesta es «no sé»: ofrecer ante la duda
 * haría parpadear el botón sobre una línea que anda.
 */
export const ESTADOS_QUE_PIDEN_VINCULAR = ['sin_vincular'] as const;

export type MotivoDeVincular = 'sin_linea' | 'linea_muda';

export function motivoParaVincular(
  tienePropia: boolean,
  estadoDeSesion: string | undefined,
): MotivoDeVincular | null {
  if (!tienePropia) return 'sin_linea';
  if (!estadoDeSesion) return null;
  return (ESTADOS_QUE_PIDEN_VINCULAR as readonly string[]).includes(estadoDeSesion)
    ? 'linea_muda'
    : null;
}

/** Lo que dice el botón. Son dos acciones distintas y se llaman distinto. */
export function rotuloDeVincular(motivo: MotivoDeVincular): string {
  return motivo === 'sin_linea' ? 'Vincular tu WhatsApp' : 'Volver a vincular tu WhatsApp';
}
