import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';
import { intervaloConStream, streamVivo } from '../../lib/datos/latido';

/**
 * EL RADAR DE ANTES — `GET /api/dashboard`, lo que el Dashboard pedía hasta ADR 0104.
 *
 * Desde el 10-sep-2026 el Dashboard mide («Hoy», `hoy.ts») y el radar vive en el
 * Pipeline. Esta consulta se queda porque la leen otras dos pantallas: el recibo de
 * venta (`FormularioVenta`, la foto del embudo) y la cola despachada (la cifra del
 * día). Por eso los tipos siguen describiendo la respuesta entera.
 */

export interface LeadChat {
  clave: string;
  fuente: 'chat' | 'comentario';
  canal: string;
  tipo: string;
  persona_id: string | null;
  persona_nombre: string | null;
  numero_propio: string | null;
  texto: string | null;
  /**
   * La clase de media y el origen del MISMO mensaje que `texto` (#20) — el
   * último ENTRANTE, no el último del hilo. Con esto la fila dice «📷 Foto» o
   * «📣 Vino del anuncio» en vez de quedar en blanco. NULL en comentarios.
   */
  texto_clase: string | null;
  texto_origen: { fuente?: string } | null;
  contexto_texto: string | null;
  telefono: string | null;
  pais_dato: string | null;
  /** ¿Pidió algo? El predicado vive en el server (`cola/pregunta.ts`). */
  pregunto: boolean;
  /** El último entrante lo escribió el ANUNCIO. Ausente = server viejo o caché. */
  solo_clic?: boolean;
  /**
   * Los días que quedan de la Ventana de Meta (#22). `null` donde no hay ventana
   * —WhatsApp y todo lo que no sea un comentario de FB/IG—, `0` cuando ya se
   * cerró. `null` y `0` NO son lo mismo: «no aplica» contra «se te pasó».
   */
  ventana_dias: number | null;
  ventana_abierta: boolean;
  respondida: boolean;
  referencia: string;
  cayo_at: string;
  /**
   * El seguimiento agendado más viejo que sigue pendiente, y DE QUÉ se trata
   * (#23). `seguimiento_nota` es la nota de esa misma fila.
   */
  seguimiento_en: string | null;
  seguimiento_nota: string | null;
  /**
   * QUIÉN LA TIENE (`cola/asignadaSql.ts`, misma regla que la cola: una tenencia
   * vencida se lee como `null`). Opcional: falta en un server anterior y en una
   * respuesta rehidratada del caché de IndexedDB (ADR 0007).
   */
  asignada_a?: string | null;
  /** Nivel de urgencia (0 vivo … 5 archivo). Lo decide el server, ver cola/urgencia.ts. */
  nivel: number;
  /** Desempate dentro del nivel. Con (nivel, orden) alcanza para mezclar las dos listas. */
  orden: number;
}

export interface LeadFormulario {
  clave: string;
  fuente: 'landing' | 'lead-ad';
  canal: string;
  persona_nombre: string | null;
  telefono: string | null;
  correo: string | null;
  pais_dato: string | null;
  producto: string | null;
  campana: string | null;
  flyer: string | null;
  es_organico: boolean | null;
  estado_lead: string;
  cayo_at: string;
  respondida: boolean;
  /** Misma clave de urgencia que los chats: el criterio de la pantalla es uno solo. */
  nivel: number;
  orden: number;
}

export interface StatsVendedora {
  vendedora: string;
  conversaciones_hoy: number;
  mensajes_hoy: number;
  ventas_hoy: number;
  conversaciones_7d: number;
  mensajes_7d: number;
  ventas_7d: number;
}

export interface PuntoLeadsDia {
  /** YYYY-MM-DD (fecha del server). */
  dia: string;
  chats: number;
  comentarios: number;
  formularios: number;
}

/**
 * Lo que mandó el SOFTWARE, agregado. `bot` y `goberna-admin` firman `envios_wa`
 * igual que una vendedora; el server los aparta en `dashboard/equipo.ts`.
 * `null`/ausente = no hay nada automático que contar (o el server es viejo).
 */
export interface Automaticos {
  mensajes_hoy: number;
  mensajes_7d: number;
  /** Quiénes: va al `title`, para que el número tenga dueño. */
  quienes: string[];
}

export interface DatosDashboard {
  chats: LeadChat[];
  formularios: LeadFormulario[];
  etapas: Record<string, string>;
  etiquetas: Record<string, string[]>;
  /** **Solo personas.** Lo que firma el software va en `automaticos`. */
  porVendedora: StatsVendedora[];
  automaticos?: Automaticos | null;
  /** Counts por etapa del embudo (normalizada). */
  embudo: Record<string, number>;
  /** Qué cursos pide la gente: el ranking de intereses. */
  cursos: { curso: string; n: number }[];
  /** Series de 14 días — siempre 14 puntos, ceros incluidos. */
  series: {
    leads_dia: PuntoLeadsDia[];
    envios_dia: { dia: string; n: number }[];
    ventas_dia: { dia: string; n: number }[];
  };
  /** ¿Quien mira ve TODO? Lo decide el server. Ausente = server viejo o caché (ADR 0007). */
  supervisor?: boolean;
  /** Lo que vino está recortado a las conversaciones asignadas de quien mira. */
  soloMisAsignadas?: boolean;
  /** Nadie configurado como supervisor (fail-closed): todas ven solo lo suyo. */
  sinSupervisores?: boolean;
}

/**
 * ══ LA CONSULTA SE DECLARA UNA VEZ, Y QUIEN LA USA DICE SI LA QUIERE VIVA ════
 *
 * 🔴 **Hasta el 18-ago-2026 vivía en la RAÍZ de la app**, o sea en las diez vistas:
 * 12.751 pedidos en un día con 203 mensajes reales (`dashboardFueraDeLaRaiz.test.ts`).
 *
 * Es el issue #5: con dos `useQuery` sobre la MISMA `queryKey` y políticas
 * distintas, cuál ganaba dependía de qué componente montó primero. Ahora la query
 * se declara UNA vez y quien la usa dice si además la quiere VIVA.
 *
 * ⚠️ **No colapsar `activa` con `vivo`.** Una pantalla puede querer el dato y no el
 * latido (el recibo de una venta); apagar el latido apagando la query la dejaría
 * sin dato.
 */
export function useDashboard({ activa = true, vivo = false }: OpcionesDashboard = {}) {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DatosDashboard>('/api/dashboard'),
    enabled: activa,
    /**
     * `false` y no un número grande cuando no está `vivo`: un intervalo apagado no
     * programa un timer. `streamVivo()` decide CUÁNTO, nunca SI.
     */
    refetchInterval: () => (vivo ? intervaloConStream(streamVivo(), 30_000) : false),
    staleTime: 30_000,
  });
}

export interface OpcionesDashboard {
  /** ¿Se pide? Apagado no consulta y no cachea nada (el default es que sí). */
  activa?: boolean;
  /** ¿Se refresca solo cada 30 s? Solo la pantalla que se queda mirándolo. */
  vivo?: boolean;
}
