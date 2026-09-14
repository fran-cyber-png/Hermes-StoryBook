import { claveDeVendedora } from '../../dominio/dueno';
import type { Puente } from '../../lib/puente';
import { SIN_ASIGNAR } from './lista';
import type { RecorteDelDia } from '../../dominio/recortesDelDia';
import { NOMBRE_DEL_RECORTE_DEL_DIA, type RecorteSemaforo } from './tablero';

/**
 * EL PUENTE DESDE EL DASHBOARD — qué hace el Pipeline con lo que le mandan.
 *
 * La pestaña «Hoy» del Dashboard mide y el Pipeline trabaja (ADR 0104): cada
 * cifra de «Hoy» abre el Pipeline ya recortado (`lib/puente.ts`). Esto traduce
 * ese pedido a lo que esta pantalla sabe hacer, y es puro para poder fijar lo
 * que importa: lo que no se puede hacer se dice.
 *
 * 🔴 **`escribioHoy` y `sinRespuesta24h` se aplican sólo si el server los
 * publica** (`recortesDisponibles`, #946). A un server que no los conoce, un
 * recorte desconocido es un 400 del tablero ENTERO (`cola/columnasPedidas.ts`).
 * Por eso el plan los deja PEDIDOS y `resolverRecorteDelPuente` decide con la
 * primera respuesta: aplicar, o abrir sin el recorte y avisarlo — nunca
 * ignorarlo en silencio, porque el Dashboard prometió una lista recortada.
 */

export type PuentePipeline = Extract<Puente, { tipo: 'pipeline' }>;

export interface PlanDelPuente {
  /** La luz que pasa a ser el recorte de la mesa. `null` = ninguna. */
  luz: RecorteSemaforo | null;
  /** El recorte del día que pidió el Dashboard. PEDIDO, no aplicado: ver `resolverRecorteDelPuente`. */
  recorteDelDia: RecorteDelDia | null;
  /** El número propio que acota el tablero. `null` = todas las líneas. */
  linea: string | null;
  /**
   * El canal, para lo que NO entró por ninguna línea (un DM de Messenger o de
   * Instagram no tiene número propio, así que `linea` no lo puede nombrar).
   * `null` = todos los canales.
   */
  canal: 'facebook' | 'instagram' | null;
  /** Con qué filtro de dueña abre la Lista. `null` = el puente no dijo nada de a quién. */
  filtroAsignada: string | null;
}

export function planDelPuente(p: PuentePipeline): PlanDelPuente {
  const r = p.recorte;
  return {
    luz: r && 'luz' in r ? r.luz : null,
    recorteDelDia: !r || 'luz' in r ? null : 'escribioHoy' in r ? 'escribioHoy' : 'sinRespuesta24h',
    linea: p.linea?.trim() || null,
    canal: p.canal ?? null,
    // ⚠️ `null` y ausente NO son lo mismo: `null` es «las que no tiene nadie»,
    // ausente es «no toques el filtro». Colapsarlos abriría la Lista vacía
    // cuando el Dashboard no pidió filtrar por dueña.
    filtroAsignada:
      p.asignadaA === undefined ? null : p.asignadaA === null ? SIN_ASIGNAR : claveDeVendedora(p.asignadaA),
  };
}

export type ResolucionDelPuente =
  | { tipo: 'esperar' }
  | { tipo: 'aplicar'; recorte: RecorteDelDia }
  | { tipo: 'avisar'; aviso: string };

/**
 * ¿Se aplica el recorte del día que pidió el puente? Lo dice el server que
 * contestó, no una bandera del front: el Pipeline sale antes o después que el
 * server según el día, y las dos órdenes tienen que funcionar.
 *
 * ⚠️ **`esperando` no es «cargando»**: una foto restaurada del caché (ADR 0007)
 * no dice qué sabe hacer el server de HOY. Quien llama pasa si el pedido de esta
 * visita ya contestó (`useTablero().contesto`).
 *
 * ⚠️ **Un pedido que FALLÓ también «contestó»**, pero no dice nada del server: el
 * aviso no puede decir que «todavía no sabe» recortar cuando lo que hubo fue una
 * falla (revisión cruzada de #956).
 */
export function resolverRecorteDelPuente(
  pedido: RecorteDelDia,
  disponibles: readonly string[] | undefined,
  esperando: boolean,
  fallo = false,
): ResolucionDelPuente {
  if (esperando) return { tipo: 'esperar' };
  if (disponibles?.includes(pedido)) return { tipo: 'aplicar', recorte: pedido };
  const nombre = NOMBRE_DEL_RECORTE_DEL_DIA[pedido];
  return {
    tipo: 'avisar',
    aviso: fallo
      ? `El tablero no respondió, así que se abrió sin el recorte «${nombre}».`
      : `El Pipeline todavía no puede recortar por «${nombre}»: se abrió sin ese recorte.`,
  };
}
