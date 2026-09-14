import { useQuery } from '@tanstack/react-query';
import type { Conversacion } from '../../dominio/conversaciones';
import { api } from '../../lib/datos/cliente';

/**
 * ¿SE PUEDE LLAMAR POR WHATSAPP A ESTA CONVERSACIÓN? — UNA sola regla (ADR 0123).
 *
 * Hasta el 14-sep-2026 vivía inline en `PanelLlamada.tsx`, y sin motivo: si no daba, el panel se
 * callaba (`return null`). El dueño midió el caso: en una conversación de Ventas Meta (línea
 * Cloud API, canal whatsapp, con teléfono) tocó el botón verde «Llamar» de la CABECERA del hilo
 * (`gestion/BotonLlamar.tsx`, que no sabe nada de esta regla) y le salió el marcador de macOS —
 * sin una palabra de por qué no fue la llamada por WhatsApp que Hermes ya sabe hacer.
 *
 * `llamablePor` es la mitad PURA — el mismo corte que separa `decidirSenal.ts` de
 * `llamadaActual.ts` en este mismo directorio — para poder fijar la regla con un test que no
 * levanta React Query. `useLlamable` es el ÚNICO lugar que la envuelve con la consulta a
 * `/api/llamadas/activas`: `PanelLlamada` y `BotonLlamar` importan este hook, ninguno de los dos
 * vuelve a calcular la fórmula (candado #3 del repo: una regla en dos lugares diverge muda).
 */

export type MotivoNoLlamable =
  | 'consultando'
  | 'sin_llamadas_para_ti'
  | 'otra_linea'
  | 'sin_telefono'
  | 'es_lead'
  | 'error';

export interface EstadoLlamable {
  llamable: boolean;
  /** `null` cuando `llamable` es `true`, o cuando no había conversación que evaluar. */
  motivo: MotivoNoLlamable | null;
  /** `conversacion.persona_id`, o vacío sin conversación. */
  telefono: string;
  /** La línea Cloud API que devolvió `/activas` — la necesita `PanelLlamada` para su propio cálculo. */
  linea: string | null;
}

interface Activas {
  ok: true;
  activa: boolean;
  linea: string | null;
}

/** La query de `/api/llamadas/activas` — la MISMA clave para el panel y el botón. */
export const CLAVE_ACTIVAS = ['llamadas', 'activas'] as const;

interface EntradaActivas {
  /** Ni pendiente ni con error ni con dato: los tres son mutuamente excluyentes acá. */
  estado: 'pendiente' | 'error' | 'listo';
  activa: boolean;
  linea: string | null;
}

/**
 * La fórmula, sin React Query — la misma que `PanelLlamada.tsx` calculaba inline:
 *
 *     activas.activa && linea !== null && canal === 'whatsapp' && tipo !== 'lead'
 *       && telefono !== '' && numero_propio === linea
 *
 * Acá factorizada en pasos para poder decir CUÁL de las condiciones falló.
 */
export function llamablePor(conversacion: Conversacion | null, activas: EntradaActivas): EstadoLlamable {
  const telefono = conversacion?.persona_id ?? '';
  const linea = activas.linea;

  if (conversacion === null) return { llamable: false, motivo: null, telefono, linea };
  if (activas.estado === 'pendiente') return { llamable: false, motivo: 'consultando', telefono, linea };
  if (activas.estado === 'error') return { llamable: false, motivo: 'error', telefono, linea };
  if (!activas.activa) return { llamable: false, motivo: 'sin_llamadas_para_ti', telefono, linea };
  if (linea === null || conversacion.canal !== 'whatsapp' || conversacion.numero_propio !== linea) {
    return { llamable: false, motivo: 'otra_linea', telefono, linea };
  }
  if (conversacion.tipo === 'lead') return { llamable: false, motivo: 'es_lead', telefono, linea };
  if (telefono === '') return { llamable: false, motivo: 'sin_telefono', telefono, linea };

  return { llamable: true, motivo: null, telefono, linea };
}

/**
 * ¿Se puede llamar por WhatsApp a esta conversación, y si no, por qué?
 *
 * `conversacion` es `null` para los llamadores de `BotonLlamar` que no tienen una conversación
 * completa a mano (la ficha de un contacto de campaña, la búsqueda de Personas): ahí ni se
 * consulta `/activas` (`enabled: false`) ni se afirma un motivo — `BotonLlamar` se comporta
 * exactamente como antes de que existiera esta regla.
 */
export function useLlamable(conversacion: Conversacion | null): EstadoLlamable {
  const activas = useQuery({
    queryKey: CLAVE_ACTIVAS,
    queryFn: () => api<Activas>('/api/llamadas/activas'),
    staleTime: 5 * 60_000,
    enabled: conversacion !== null,
  });

  return llamablePor(conversacion, {
    estado: activas.isPending ? 'pendiente' : activas.isError ? 'error' : 'listo',
    activa: activas.data?.activa === true,
    linea: activas.data?.linea ?? null,
  });
}
