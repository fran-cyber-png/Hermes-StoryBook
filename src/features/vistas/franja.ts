/**
 * ══ LA FRANJA DE TIEMPO DE UNA COLUMNA — «¿a quiénes les escribí HOY?» ═══════
 *
 * «Nunca contestaron» tiene 4.491 tarjetas y la etapa las iguala a todas: la que
 * recibió el mensaje hace ocho minutos y la que lo recibió hace tres semanas se
 * dibujan igual. Es el mismo defecto que `tiempoEnEtapa.ts` describe para el
 * embudo entero, pero acá muerde más fuerte, porque en esta columna **el tiempo
 * es el único criterio que hay**: nadie contestó, así que no hay nada más que
 * mirar que cuándo se les habló.
 *
 * ── UN EJE, TRES GRANULARIDADES ──────────────────────────────────────────
 * Fecha · Hora · Minutos son tres menús y **un solo valor**: son el mismo eje
 * mirado con tres lupas, no tres filtros que se cruzan. Elegir «Últimos 30 min»
 * borra «Hoy» porque son dos respuestas a la misma pregunta. Es la regla de
 * `Recorte` en `tablero.ts` (un eje con varias posiciones, nunca varios toggles)
 * aplicada al tiempo.
 *
 * ── EL INSTANTE QUE SE MIDE ES `ultimo_at` ───────────────────────────────
 * El ÚLTIMO mensaje que le mandamos, no el primero. En esta columna la persona
 * nunca habló, así que el último mensaje de la conversación es siempre nuestro y
 * `ultimo_at` responde exactamente «cuándo le escribí». El otro instante
 * disponible —`etapa_desde`, desde cuándo corre el silencio— ya tiene su chip
 * («Para seguir») y contesta otra cosa: insistirle no lo reinicia, así que un
 * lead de marzo al que le escribiste hoy NO aparecería bajo «Hoy».
 *
 * ── 🔴 LA COLA MIRA 30 DÍAS, Y ESO RECORTA EL MENÚ ───────────────────────
 * `consultarCola.ts` filtra los mensajes con `occurred_at > now() - 30 days` (sin
 * esa cota el planner escanea `events` entero: 482 ms → 3,4 ms, medido). O sea
 * que **toda tarjeta del tablero tiene su último mensaje dentro de los últimos 30
 * días**. Por eso acá no existe el preset «Últimos 30 días» que traía la maqueta:
 * daría exactamente el total de la columna, y un botón que no cambia lo que se ve
 * es el defecto que `recortesDeColumna` ya persigue con la regla del cero. Lo que
 * sí queda es el tope del rango a medida (`DIAS_DE_LA_COLA`): más atrás no hay
 * tarjetas que mostrar, y prometerlas sería mentir con un calendario.
 *
 * Puro y sin DOM a propósito: qué franjas existen y qué instantes significan es
 * política, y se interroga sin montar el Pipeline.
 */

/** Hasta dónde mira la cola (`consultarCola.ts`). Nada más viejo entra al tablero. */
export const DIAS_DE_LA_COLA = 30;

/** Los presets, agrupados como se dibujan. El id viaja en el estado y en la URL. */
export type PresetFranja =
  | 'hoy'
  | 'ayer'
  | 'd7'
  | 'h1'
  | 'h3'
  | 'h6'
  | 'h12'
  | 'm5'
  | 'm15'
  | 'm30';

/**
 * Lo que la columna está pidiendo. `null` (ausente) es «todas»: el universo de la
 * columna, que ya es la ventana de 30 días de la cola.
 *
 * El rango a medida guarda los DOS instantes ya resueltos —no un id— porque no
 * hay forma de recalcularlo: lo eligió una persona en un calendario.
 */
export type Franja =
  | { tipo: 'preset'; id: PresetFranja }
  | { tipo: 'rango'; desde: string; hasta: string };

export interface GrupoDeFranjas {
  /** El rótulo del menú: Fecha · Hora · Minutos. */
  titulo: string;
  opciones: readonly { id: PresetFranja; label: string }[];
}

/**
 * ⚠️ **«Últimos 30 días» no está, y no es un olvido**: ver el bloque de arriba.
 * Tampoco están las horas del reloj (14:00–15:00): el eje es «hace cuánto», y
 * mezclar «hace 3 horas» con «a las 3 de la tarde» en el mismo menú daría dos
 * lecturas para el mismo clic.
 */
export const GRUPOS_DE_FRANJAS: readonly GrupoDeFranjas[] = [
  {
    titulo: 'Fecha',
    opciones: [
      { id: 'hoy', label: 'Hoy' },
      { id: 'ayer', label: 'Ayer' },
      { id: 'd7', label: 'Últimos 7 días' },
    ],
  },
  {
    titulo: 'Hora',
    opciones: [
      { id: 'h1', label: 'Última hora' },
      { id: 'h3', label: 'Últimas 3 horas' },
      { id: 'h6', label: 'Últimas 6 horas' },
      { id: 'h12', label: 'Últimas 12 horas' },
    ],
  },
  {
    titulo: 'Minutos',
    opciones: [
      { id: 'm5', label: 'Últimos 5 minutos' },
      { id: 'm15', label: 'Últimos 15 minutos' },
      { id: 'm30', label: 'Últimos 30 minutos' },
    ],
  },
];

const ROTULO: Record<PresetFranja, string> = Object.fromEntries(
  GRUPOS_DE_FRANJAS.flatMap((g) => g.opciones.map((o) => [o.id, o.label])),
) as Record<PresetFranja, string>;

/** Cuántos minutos hacia atrás mira cada preset relativo. Los de fecha no están: se anclan al día. */
const MINUTOS_ATRAS: Partial<Record<PresetFranja, number>> = {
  d7: 7 * 24 * 60,
  h12: 12 * 60,
  h6: 6 * 60,
  h3: 3 * 60,
  h1: 60,
  m30: 30,
  m15: 15,
  m5: 5,
};

/** Los dos bordes de la franja. `hasta: null` = «hasta ahora», que no tiene borde. */
export interface LimitesDeFranja {
  desde: Date;
  hasta: Date | null;
}

const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * De una franja a los dos instantes que el server entiende.
 *
 * ⚠️ **`ahora` se recorta al MINUTO**, y de eso depende que la pantalla no se
 * quede pidiendo sola. El `desde` de «Últimos 30 min» viaja en la `queryKey` del
 * tablero: calculado al milisegundo cambiaría en cada render y cada render sería
 * una consulta nueva de la más cara del repo. Recortado al minuto, la clave se
 * mueve una vez por minuto — el mismo ritmo al que el tablero ya refresca.
 *
 * El costo, escrito: la ventana corta se mueve de a saltos de un minuto en vez de
 * deslizarse. Para «a quiénes les escribí recién» eso no cambia ninguna decisión.
 */
export function limitesDe(f: Franja, ahora: Date): LimitesDeFranja {
  if (f.tipo === 'rango') return { desde: new Date(f.desde), hasta: new Date(f.hasta) };

  const alMinuto = new Date(ahora);
  alMinuto.setSeconds(0, 0);

  if (f.id === 'hoy') return { desde: inicioDelDia(alMinuto), hasta: null };
  if (f.id === 'ayer') {
    const hoy0 = inicioDelDia(alMinuto);
    return { desde: new Date(hoy0.getTime() - 86_400_000), hasta: hoy0 };
  }
  const minutos = MINUTOS_ATRAS[f.id] ?? 0;
  return { desde: new Date(alMinuto.getTime() - minutos * 60_000), hasta: null };
}

/** Cómo se lee la franja en el chip: es lo que reemplaza a la palabra «Cuándo». */
export function rotuloDeFranja(f: Franja | null): string {
  if (!f) return 'Cuándo';
  if (f.tipo === 'preset') return ROTULO[f.id];
  const d = new Date(f.desde);
  // ⚠️ El `hasta` es EXCLUSIVO (el 00:00 del día siguiente): para NOMBRAR el rango
  // hay que retroceder un instante, o «del 18 al 18» se leería «18 ago – 19 ago».
  const h = new Date(new Date(f.hasta).getTime() - 1);
  const corto = (x: Date) => x.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  return corto(d) === corto(h) ? corto(d) : `${corto(d)} – ${corto(h)}`;
}

/**
 * El día más viejo que el calendario del rango puede ofrecer (`YYYY-MM-DD`, que es
 * lo que come un `<input type="date">`). Más atrás la cola no tiene nada, y un
 * calendario que deja elegir el mes pasado para devolver cero está mintiendo.
 */
export function pisoDelRango(ahora: Date): string {
  const piso = new Date(inicioDelDia(ahora).getTime() - DIAS_DE_LA_COLA * 86_400_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${piso.getFullYear()}-${p(piso.getMonth() + 1)}-${p(piso.getDate())}`;
}

/**
 * Un rango elegido a mano → la franja, o `null` si no es un rango que se pueda
 * pedir. Las dos fechas llegan como `YYYY-MM-DD` (hora local de quien mira) y se
 * devuelven como INSTANTES: el día entero, de su 00:00 al 00:00 del siguiente.
 *
 * ⚠️ **El `hasta` es EXCLUSIVO y por eso suma un día.** Con el borde en el 00:00
 * del mismo día elegido, «del 18 al 18» daría cero tarjetas — un rango vacío que
 * se lee como «no hay nadie» en vez de como «pediste una raya».
 */
export function rangoDeFechas(desde: string, hasta: string): Franja | null {
  const d = new Date(`${desde}T00:00:00`);
  const h = new Date(`${hasta}T00:00:00`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(h.getTime())) return null;
  if (h < d) return null;
  return { tipo: 'rango', desde: d.toISOString(), hasta: new Date(h.getTime() + 86_400_000).toISOString() };
}
