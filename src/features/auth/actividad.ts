import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/datos/cliente';

/**
 * EL LATIDO DE LA SESIÓN — cuánto lleva activa una persona, para la fila de
 * Configuración. Pedido del dueño, con reglas exactas:
 *
 *   · `startedAt`/`lastActivityAt` los guarda el SERVER (`/api/actividad`,
 *     `server/src/actividad/actividad.ts`) — una fila por persona, no por
 *     login: acá solo se PREGUNTA y se muestra.
 *   · El cronómetro (`transcurrido`, `HH:mm:ss`) tickea LOCAL cada segundo:
 *     no hay un solo request por segundo, el `setInterval` solo fuerza un
 *     re-render.
 *   · El heartbeat al server va cada `INTERVALO_LATIDO_MS` (dentro de los
 *     30–60 s pedidos) y SOLO si hubo actividad real desde el último —así
 *     `ultima_actividad_en` se congela sola cuando la persona se va, y
 *     `activo` pasa a `false` a los `UMBRAL_INACTIVO_MS` sin que nadie tenga
 *     que apagar nada a mano.
 *   · Actividad = click, tecla, mouse o scroll — solo escriben un `ref`
 *     (sin re-render, sin costo por más seguido que disparen).
 *
 * ══ 🔴 POR QUÉ SON DOS HOOKS Y NO UNO (8-sep-2026) ═════════════════════════
 *
 * Porque el de arriba era UNO SOLO y se llamaba desde `AppAutenticada`, o sea
 * desde la raíz: su `setInterval` de un segundo hacía `setState` en el shell
 * entero, así que **toda la app se re-renderizaba una vez por segundo, para
 * siempre**. El riel, el header, la Bandeja —que nunca se desmonta— con su
 * cola, su hilo y su `PanelDerecho`, y encima la vista abierta con sus filas.
 *
 * Y lo único que ese tick mueve es la línea `Activo · 00:12:34` de
 * `ConfiguracionPerfil`, que es un modal **cerrado** casi todo el día. Se
 * repintaba Hermes 3.600 veces por hora para animar un reloj que nadie mira.
 *
 * La partición sigue la regla de siempre: el trabajo vive donde se consume.
 *
 *   · `useLatidoDeSesion` — el heartbeat y los listeners. Va en la RAÍZ porque
 *     tiene que correr siempre (si deja de latir, el server cree que te fuiste).
 *     **No re-renderiza por tiempo**: los listeners escriben un ref y el único
 *     `setState` es `iniciadaEn`, que llega una vez y después vale lo mismo —
 *     React corta solo cuando el valor no cambia.
 *   · `useEstadoDeActividad` — el cronómetro. Tickea **solo mientras alguien lo
 *     mira**, y por eso recibe `corriendo`: montado ≠ visible.
 *
 * ⚠️ **La fuente se lee con una FUNCIÓN (`ultimaActividad()`) y no como campo.**
 * Un campo obligaría a leer el ref durante el render de quien la arma, que es
 * justo lo que React Compiler rechaza («Cannot access refs during render») y lo
 * que haría que ese componente quede sin optimizar. Así el ref se lee dentro de
 * `useEstadoDeActividad`, que es quien de verdad depende del reloj.
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

/**
 * LO QUE LA RAÍZ SABE Y NO CUESTA NADA SABER: cuándo empezó la sesión y cómo
 * preguntar por la última actividad. Sin reloj adentro — el reloj es del que
 * mira.
 */
export interface FuenteDeActividad {
  /** `startedAt` del server, en ms. `null` mientras el primer latido está en vuelo. */
  iniciadaEn: number | null;
  /** Hay sesión: sin ella no hay nada que cronometrar. */
  hayVendedora: boolean;
  /** Cuándo se movió por última vez. Se llama al tickear, nunca en el render de la raíz. */
  ultimaActividad: () => number;
}

function formatoHms(ms: number): string {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(totalSeg / 3600);
  const mm = Math.floor((totalSeg % 3600) / 60);
  const ss = totalSeg % 60;
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return `${dosDigitos(hh)}:${dosDigitos(mm)}:${dosDigitos(ss)}`;
}

/**
 * EL HEARTBEAT. Va en la raíz y **no dispara ni un re-render por tiempo**.
 *
 * Un solo `useEffect`, con `vendedoraId` de dependencia: al cambiar (login
 * nuevo o logout) se desarma TODO —los 4 listeners y el intervalo— y se arma de
 * nuevo. Nada queda escuchando de más, nada se duplica.
 */
export function useLatidoDeSesion(vendedoraId: string | null): FuenteDeActividad {
  const [iniciadaEn, setIniciadaEn] = useState<number | null>(null);
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
        // ⚠️ Con el mismo `startedAt` esto NO re-renderiza: React corta cuando
        // el valor es idéntico. Por eso el heartbeat puede seguir latiendo cada
        // 45 s sin costo de pintura para toda la app.
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

    return () => {
      vivo = false;
      for (const evento of EVENTOS_DE_ACTIVIDAD) {
        window.removeEventListener(evento, marcarActividad);
      }
      window.clearInterval(idLatido);
    };
  }, [vendedoraId]);

  return useMemo(
    () => ({
      iniciadaEn,
      hayVendedora: Boolean(vendedoraId),
      ultimaActividad: () => ultimaActividadRef.current,
    }),
    [iniciadaEn, vendedoraId],
  );
}

/**
 * EL CRONÓMETRO — tickea cada segundo, y **solo mientras se lo mira**.
 *
 * `corriendo` no es una optimización opcional: es la diferencia entre un
 * `setState` por segundo en un modal abierto y un `setState` por segundo en
 * toda la app. Su default es `true` porque quien llama a este hook es, por
 * construcción, quien dibuja el número.
 */
export function useEstadoDeActividad(fuente: FuenteDeActividad, corriendo = true): EstadoActividad {
  const [, tick] = useState(0);
  const { hayVendedora, iniciadaEn } = fuente;

  useEffect(() => {
    if (!corriendo || !hayVendedora) return;
    const id = window.setInterval(() => tick((n) => n + 1), INTERVALO_TICK_MS);
    return () => window.clearInterval(id);
  }, [corriendo, hayVendedora]);

  const ahora = Date.now();
  return {
    activo: hayVendedora && ahora - fuente.ultimaActividad() < UMBRAL_INACTIVO_MS,
    transcurrido: iniciadaEn == null ? null : formatoHms(ahora - iniciadaEn),
  };
}
