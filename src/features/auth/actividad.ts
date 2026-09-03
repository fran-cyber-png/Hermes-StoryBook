import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/datos/cliente';

/**
 * EL LATIDO DE LA SESIÓN — cuánto lleva activa una persona, para la fila de
 * Configuración. Pedido del dueño, con reglas exactas:
 *
 *   · `startedAt`/`lastActivityAt` los guarda el SERVER (`/api/actividad`,
 *     `server/src/actividad/actividad.ts`) — una fila por persona, no por
 *     login: acá solo se PREGUNTA y se muestra.
 *   · El cronómetro (`transcurrido`, `HH:mm:ss`) tickea LOCAL cada segundo:
 *     no hay un solo request por segundo, el `setInterval` de abajo solo
 *     fuerza un re-render.
 *   · El heartbeat al server va cada `INTERVALO_LATIDO_MS` (dentro de los
 *     30–60 s pedidos) y SOLO si hubo actividad real desde el último —así
 *     `ultima_actividad_en` se congela sola cuando la persona se va, y
 *     `activo` pasa a `false` a los `UMBRAL_INACTIVO_MS` sin que nadie tenga
 *     que apagar nada a mano.
 *   · Actividad = click, tecla, mouse o scroll — solo escriben un `ref`
 *     (sin re-render, sin costo por más seguido que disparen).
 *
 * Un solo `useEffect`, con `vendedoraId` de dependencia: al cambiar (login
 * nuevo o logout) se desarma TODO —los 4 listeners y los 2 intervalos— y se
 * arma de nuevo. Nada queda escuchando de más, nada se duplica.
 */

const UMBRAL_INACTIVO_MS = 2 * 60_000;
const INTERVALO_LATIDO_MS = 45_000; // dentro del rango pedido, 30–60 s
const INTERVALO_TICK_MS = 1_000;

const EVENTOS_DE_ACTIVIDAD = ['click', 'keydown', 'mousemove', 'scroll'] as const;

export interface EstadoActividad {
  activo: boolean;
  /** `HH:mm:ss` desde `startedAt`. `null` mientras no se sabe (primer latido en vuelo). */
  transcurrido: string | null;
}

function formatoHms(ms: number): string {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(totalSeg / 3600);
  const mm = Math.floor((totalSeg % 3600) / 60);
  const ss = totalSeg % 60;
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return `${dosDigitos(hh)}:${dosDigitos(mm)}:${dosDigitos(ss)}`;
}

export function useActividadDeSesion(vendedoraId: string | null): EstadoActividad {
  const [iniciadaEn, setIniciadaEn] = useState<number | null>(null);
  // Solo dispara un re-render por segundo; el cálculo de verdad usa Date.now().
  const [, forzarRender] = useState(0);
  const ultimaActividadRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!vendedoraId) {
      setIniciadaEn(null);
      return;
    }

    let vivo = true;
    let ultimoLatidoEnviado = Date.now();
    ultimaActividadRef.current = Date.now();

    async function latido() {
      try {
        const r = await api<{ iniciadaEn: string }>('/api/actividad', { method: 'POST' });
        if (vivo) setIniciadaEn(new Date(r.iniciadaEn).getTime());
      } catch {
        // Sin red o 401: la próxima vuelta del intervalo lo reintenta sola.
        // No hay nada que mostrarle a la vendedora por un latido que no llegó.
      }
      ultimoLatidoEnviado = Date.now();
    }
    void latido(); // arranca (o retoma) el cronómetro apenas hay sesión

    function marcarActividad() {
      ultimaActividadRef.current = Date.now();
    }
    for (const evento of EVENTOS_DE_ACTIVIDAD) {
      window.addEventListener(evento, marcarActividad, { passive: true });
    }

    const idLatido = window.setInterval(() => {
      if (ultimaActividadRef.current > ultimoLatidoEnviado) void latido();
    }, INTERVALO_LATIDO_MS);

    const idTick = window.setInterval(() => forzarRender((n) => n + 1), INTERVALO_TICK_MS);

    return () => {
      vivo = false;
      for (const evento of EVENTOS_DE_ACTIVIDAD) {
        window.removeEventListener(evento, marcarActividad);
      }
      window.clearInterval(idLatido);
      window.clearInterval(idTick);
    };
  }, [vendedoraId]);

  const ahora = Date.now();
  return {
    activo: Boolean(vendedoraId) && ahora - ultimaActividadRef.current < UMBRAL_INACTIVO_MS,
    transcurrido: iniciadaEn == null ? null : formatoHms(ahora - iniciadaEn),
  };
}
