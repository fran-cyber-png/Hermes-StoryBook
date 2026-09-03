import { useQuery } from '@tanstack/react-query';
import { api } from './cliente';
import { horasDesde } from '../formato';

/**
 * QUÉ TAN VIEJO ES LO QUE EL VENDEDOR ESTÁ MIRANDO.
 *
 * ── El bug que esto mata ──
 * La bandeja abre filtrada por "les puedo escribir", que son los comentarios de
 * los últimos 7 días. Si la ingesta está detenida hace más de 7 días, ese filtro
 * devuelve CERO y la pantalla dice "Estás al día".
 *
 * Medido el 21-jul-2026 sobre la base real: 94.371 interacciones, 0 con la
 * ventana abierta — porque el último dato capturado era del 11-jul. La pantalla
 * felicitaba al vendedor por tener limpia una bandeja que en realidad no había
 * mirado en diez días.
 *
 * Un estado vacío indistinguible de un pipeline muerto es peor que un error: el
 * error te hace mirar, la calma falsa te manda a tu casa tranquilo.
 */
/**
 * ⚠️ **YA NO LLEVA `horasDesdeIngesta` NI `fresca`** (docs/plan-borrar-el-polling.md
 * §6 PR 2). El server ahora cachea esta respuesta SIN vencer —la actualiza cada
 * mensaje real, `server/src/cache/frescura.ts`—, así que un número de horas
 * calculado en el momento de guardar quedaría VIEJO mientras el caché sigue
 * sirviendo la misma foto: a las dos horas de sembrado seguiría diciendo «hace
 * 3 minutos». Y un cuerpo que cambia solo por el paso del tiempo nunca puede
 * dar un 304 — el ETag es el hash del cuerpo. Ahora los dos se DERIVAN acá, en
 * el momento de leer (`horasDesdeIngesta` + `esFresca`, abajo), del mismo modo
 * que `lib/formato.ts:horasDesde` ya hace para el resto de la app.
 */
export type Frescura = {
  /** El evento más nuevo que tenemos. Lo que pasó en el mundo. */
  ultimoDato: string | null;
  /** Cuándo lo capturamos nosotros. La diferencia contra ultimoDato es el atraso. */
  ultimaIngesta: string | null;
  /** Estimación de Postgres (`pg_class.reltuples`), no un `count(*)` exacto. */
  total: number;
};

export function useFrescura() {
  return useQuery({
    queryKey: ['frescura'],
    queryFn: () => api<Frescura>('/api/interactions/frescura'),
    /**
     * CADA CINCO MINUTOS, no cada uno — y el porqué del número está acá para que
     * nadie lo baje de vuelta «porque es un dato que envejece solo».
     *
     * Sigue siendo cierto que es el único dato de la pantalla que envejece SIN
     * que nadie haga nada: los demás cambian por acción humana, este cambia por
     * el mero paso del tiempo. Lo que estaba mal era la CADENCIA, no la idea.
     *
     * 🔴 **ERA EL ENDPOINT MÁS PEDIDO DE TODO HERMES.** Medido el 21-ago-2026
     * sobre el log de nginx: `/api/interactions/frescura` son **34.153 de los
     * 132.441 pedidos** a `/api/*` del día — el **25,8 %**, más que el hilo, más
     * que la cola y más que el Dashboard. Y con el server saturado devolvió
     * **8.943 respuestas 5xx — el 26,2 %** (6.796 timeouts de 60 s, 2.126
     * quinientos, 17 502 y 4 503), o sea que la pieza que existe para avisar
     * que la ingesta murió era ella misma parte de por qué el server no daba
     * abasto.
     *
     * ⚠️ **Las cinco cifras de arriba son del DÍA COMPLETO** (`access.log.1`).
     * Existe una segunda medición del mismo día cortada a las 14:30 —22.309 de
     * 69.511, con 40,1 % de 5xx— y las dos son ciertas: cambia la ventana.
     * Mezclarlas da porcentajes que no cierran con sus propios operandos, que
     * es exactamente lo que pasó al escribir este docblock. **Si actualizas un
     * número acá, actualiza los cinco desde la misma ventana.**
     *
     * ⚠️ **Y desde el 21-ago este intervalo es prácticamente el único motor**: el
     * SSE dejó de invalidar `['frescura']` por cada mensaje
     * (`lib/datos/tiempoReal.ts`). Queda UNA excepción y conviene saberla antes
     * de tratar la cuenta como exacta: `alReconectar()` sigue invalidando la
     * clave, así que un deploy —que corta el stream de todas las pestañas a la
     * vez— produce una ráfaga que este número no contempla.
     *
     * Con esa salvedad: `pedidos/día ≈ observadores montados × (1.440 / minutos
     * del intervalo)`. **Observadores, no pestañas** — ver el ⚠️ de abajo: en
     * Mensajes hay dos. A 60 s son 1.440 por observador y por día; a 300 s son
     * 288. **Menos 80 %, sin tocar una línea del server.**
     *
     * ⚠️ La línea de base de 34.153 se midió el MISMO día en que se desplegó el
     * corte de la invalidación por SSE, así que incluye horas de tráfico que ese
     * cambio ya se llevó. El **÷5 es exacto**; el «34.153 → 6.831» que sale de
     * multiplicarlo por esa base es un techo, no una promesa.
     *
     * ── LO QUE SE PIERDE, dicho con el número ──────────────────────────────
     * El aviso de «la ingesta está muerta» puede tardar hasta **5 minutos más**
     * en aparecer. Eso no mueve la aguja: los huecos de ingesta REALES que este
     * cartel vino a delatar duraron entre **127 y 945 minutos**. Cinco minutos
     * sobre dos horas de agujero es ruido; 34.153 pedidos por día no lo son.
     *
     * ⚠️ **Hay DOS observadores de esta misma query** (`BarraFrescura`, montada
     * en el shell y por lo tanto en las diez vistas, y `ColaUnificada`, que la
     * usa para no festejar «estás al día» sobre una bandeja muerta). Comparten
     * la `queryKey`, así que comparten el caché — pero **cada observador arma su
     * propio `setInterval`** (`queryObserver.js#updateRefetchInterval`), y los
     * dos disparan si no coinciden en el tiempo. En Mensajes esto puede ser el
     * doble de pedidos que en las otras nueve vistas. El ahorro proporcional es
     * el mismo; el absoluto es hasta el doble.
     */
    refetchInterval: 300_000,
    /** La mitad del intervalo, como siempre: navegar entre vistas no repregunta. */
    staleTime: 150_000,
  });
}

/**
 * Horas desde la última ingesta, calculadas AHORA — nunca leídas de un número
 * que el server hubiera precomputado y cacheado. `ultimaIngesta` es la única
 * fecha cruda que el cuerpo lleva; el resto es este cálculo.
 */
export function horasDesdeIngesta(f: Pick<Frescura, 'ultimaIngesta'>): number | null {
  return f.ultimaIngesta == null ? null : horasDesde(f.ultimaIngesta);
}

/** < 6 h. El compromiso es que lo que ve el vendedor sea de esta jornada. */
export function esFresca(horas: number | null): boolean {
  return horas != null && horas < 6;
}

/** "hace 3 minutos" / "hace 10 días". Sin librería: es una sola forma y un solo idioma. */
export function hace(horas: number | null): string {
  if (horas == null) return 'nunca';
  if (horas < 1) {
    const min = Math.max(1, Math.round(horas * 60));
    return `hace ${min} min`;
  }
  if (horas < 24) {
    const h = Math.round(horas);
    return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
  }
  const d = Math.round(horas / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}
