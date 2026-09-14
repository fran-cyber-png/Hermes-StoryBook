import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, claves } from '../../lib/datos/cliente';

/**
 * UN COMENTARIO SE RESPONDE UNA VEZ — lo que el panel sabe antes de dejar escribir (13-sep-2026).
 *
 * Medido en la Página de Américo desde el 6-sep: 192 respuestas en 131
 * comentarios, 61 de más, y 191 salieron de Hermes. El comentario de Nina Silva
 * recibió cuatro. Las agentes no podían saber que otra ya había respondido: el
 * panel abría con la caja vacía y la plantilla puesta.
 *
 * El server ya frena la segunda respuesta (`server/src/responder/unaSolaRespuesta.ts`).
 * Esto es la parte de la pantalla:
 *
 *   · `useEstadoDeRespuesta`: qué respuestas tiene y quién más lo tiene abierto.
 *     Se refresca sola cuando el SSE avisa que ese comentario cambió
 *     (`lib/datos/tiempoReal.ts`).
 *   · `usePresenciaEnComentario`: el «lo tengo abierto» que ven las demás.
 */

export interface RespuestaPrevia {
  /** `facebook`: la Página respondió por fuera de Hermes (Business Suite, el celular). */
  origen: 'hermes' | 'facebook';
  /** ISO. */
  cuando: string;
  /** El `vendedoraId`. `null` desde Facebook o antes del 13-sep-2026. */
  quien: string | null;
  /** El nombre, si el equipo lo sabe. */
  nombre: string | null;
  /** Lo publicado. `null` si sólo salió el privado. */
  texto: string | null;
  conPrivado: boolean;
}

export interface EnElComentario {
  quien: string;
  nombre: string | null;
  desde: string;
}

export interface EstadoDeRespuesta {
  respuestas: RespuestaPrevia[];
  /** Las OTRAS personas con el comentario abierto: el server ya sacó a quien pregunta. */
  respondiendo: EnElComentario[];
}

export const SIN_ESTADO: EstadoDeRespuesta = { respuestas: [], respondiendo: [] };

/**
 * Lo que llegó, con listas siempre. Un server anterior a este cambio no tiene la
 * ruta (404, y la consulta queda en error) y un stub de test puede contestar
 * cualquier cosa. En los dos casos el panel tiene que abrir como antes.
 */
export function leerEstado(crudo: unknown): EstadoDeRespuesta {
  const o = (crudo ?? {}) as Partial<EstadoDeRespuesta>;
  return {
    respuestas: Array.isArray(o.respuestas) ? o.respuestas : [],
    respondiendo: Array.isArray(o.respondiendo) ? o.respondiendo : [],
  };
}

/**
 * Cada cuánto se vuelve a pedir aunque el SSE no avise. El bus es la fuente; esto
 * es la red para un stream caído, igual que el poll largo de la cola
 * (`lib/datos/latido.ts`). Es barato: dos lecturas por índice, 2 ms medidos.
 */
const RED_DEL_ESTADO_MS = 30_000;

export function useEstadoDeRespuesta(interactionId: number, activo: boolean) {
  return useQuery({
    queryKey: claves.estadoDeRespuesta(interactionId),
    queryFn: async () => leerEstado(await api<unknown>(`/api/responder/${interactionId}/estado`)),
    enabled: activo && interactionId > 0,
    staleTime: 0,
    refetchInterval: activo ? RED_DEL_ESTADO_MS : false,
  });
}

/**
 * QUIÉN TIENE ABIERTO QUÉ COMENTARIO — las pastillas de la cola y del Pipeline
 * (ADR 0121). Las ids son las claves del objeto, como las manda el JSON.
 */
export type PresenciasPorComentario = Readonly<Record<string, readonly EnElComentario[]>>;

/** Lo que llegó, o nadie. Un server anterior a ADR 0121 contesta 404 y la cola se dibuja como antes. */
export function leerPresencias(crudo: unknown): PresenciasPorComentario {
  const presencias = (crudo as { presencias?: unknown } | null)?.presencias;
  if (!presencias || typeof presencias !== 'object' || Array.isArray(presencias)) return {};
  const limpias: Record<string, EnElComentario[]> = {};
  for (const [id, personas] of Object.entries(presencias)) {
    if (Array.isArray(personas) && personas.length > 0) limpias[id] = personas;
  }
  return limpias;
}

const NADIE: readonly EnElComentario[] = [];

/** Cuántas pastillas hay montadas, y el único reloj de la red de presencias. */
let pastillasMontadas = 0;
let redDePresencias: ReturnType<typeof setInterval> | null = null;

/**
 * LAS OTRAS PERSONAS CON ESTE COMENTARIO ABIERTO, para una fila o una tarjeta.
 *
 * 🔴 **Una consulta para toda la pantalla, no una por fila.** La cola dibuja
 * cientos de filas: todas se suscriben a la MISMA clave y cada una se queda con
 * lo suyo (`select`), así que sale un solo `GET /api/responder/presencias` por
 * más pastillas que haya montadas. El server ya sacó a quien pregunta y ya
 * aplicó la frontera de Página.
 *
 * La refresca el SSE (`tiempoReal.ts`, agrupado) y, por si el stream se cae, una
 * red de 30 s.
 *
 * 🔴 **La red es UN reloj para todas, no `refetchInterval`.** `refetchInterval`
 * arma un reloj por observador (`query-core`), y las filas se montan en momentos
 * distintos al scrollear: con cien pastillas desfasadas salían hasta cien pedidos
 * cada 30 s (revisión de ADR 0121). El reloj vive mientras haya al menos una
 * pastilla montada.
 */
export function useQuienesTienenAbierto(interactionId: number): readonly EnElComentario[] {
  const qc = useQueryClient();
  const activo = interactionId > 0;

  useEffect(() => {
    if (!activo) return;
    pastillasMontadas += 1;
    redDePresencias ??= setInterval(() => {
      void qc.invalidateQueries({ queryKey: claves.presenciasDeComentarios() });
    }, RED_DEL_ESTADO_MS);
    return () => {
      pastillasMontadas -= 1;
      if (pastillasMontadas === 0 && redDePresencias) {
        clearInterval(redDePresencias);
        redDePresencias = null;
      }
    };
  }, [qc, activo]);

  const q = useQuery({
    queryKey: claves.presenciasDeComentarios(),
    queryFn: async () => leerPresencias(await api<unknown>('/api/responder/presencias')),
    enabled: activo,
    staleTime: 10_000,
    select: (todas: PresenciasPorComentario) => todas[String(interactionId)] ?? NADIE,
  });
  return q.data ?? NADIE;
}

/** Cada cuánto el panel abierto repite «lo tengo abierto». La vida en el server es 45 s. */
export const LATIDO_DE_PRESENCIA_MS = 20_000;

/**
 * «TENGO ESTE COMENTARIO ABIERTO» — mientras `activo`.
 *
 * `activo` baja cuando el panel se cierra, cambia de comentario o la agente ya
 * respondió: quien ya respondió no «lo está respondiendo», y seguir anunciándolo
 * les diría a las demás algo que ya no es cierto.
 *
 * ⚠️ **Los errores se tragan a propósito.** La presencia es un aviso para las
 * demás. Si no llega, ellas pierden el aviso y el server igual frena la respuesta
 * duplicada, así que no hay nada que la agente pueda hacer con ese error.
 *
 * ⚠️ El `DELETE` va con `keepalive` para que salga aunque la pestaña se esté
 * cerrando. Si igual no sale, la marca se vence sola en 45 s.
 */
export function usePresenciaEnComentario(interactionId: number, activo: boolean): void {
  useEffect(() => {
    if (!activo || interactionId <= 0) return;
    const ruta = `/api/responder/${interactionId}/presencia`;
    const marcar = () => {
      api(ruta, { method: 'PUT' }).catch(() => {});
    };

    marcar();
    const latido = setInterval(marcar, LATIDO_DE_PRESENCIA_MS);
    return () => {
      clearInterval(latido);
      api(ruta, { method: 'DELETE', keepalive: true }).catch(() => {});
    };
  }, [interactionId, activo]);
}

/**
 * Cómo se nombra a quien respondió o está mirando: el nombre del equipo, y si
 * Hermes no lo sabe, el username ENTERO sin el namespace.
 *
 * ⚠️ No `nombreCorto` (`dominio/dueno.ts`): recorta en el primer punto, así que
 * `centurion:americo.agente4` se leería «Americo» y parecería que respondió el
 * candidato. Es la misma regla que `server/src/responder/frasesDelTurno.ts`.
 */
export function quienSeLee(p: { quien: string | null; nombre: string | null }): string {
  if (p.nombre?.trim()) return p.nombre.trim();
  if (!p.quien?.trim()) return 'Alguien del equipo';
  return p.quien.trim().replace(/^[a-z]+:/i, '');
}

/** «Luz» · «Luz y Sindy» · «Luz, Sindy y 2 más». */
export function nombresEnFila(personas: readonly { quien: string | null; nombre: string | null }[]): string {
  const nombres = personas.map(quienSeLee);
  if (nombres.length <= 1) return nombres[0] ?? '';
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  return `${nombres[0]}, ${nombres[1]} y ${nombres.length - 2} más`;
}
