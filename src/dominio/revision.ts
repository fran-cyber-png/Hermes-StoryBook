import type { Veredicto } from './lecturas';

/**
 * ══ REVISIÓN — LO QUE EL SISTEMA HIZO, Y CUÁNTO LE CREEMOS (ADR 0095 §8) ════
 *
 * 🔴 **ESTA VISTA ABRE CON LA COLA SIN REVISAR, NO CON LA PRECISIÓN.** Es una
 * cola de trabajo que se quema, no un tablero de métricas — y la inversión es
 * deliberada:
 *
 *   · `bot_calificaciones` tiene **85 filas y cero lectores**.
 *   · De **1.206** respuestas que el bot preparó en sombra, se revisaron **0**.
 *   · `lecciones`: **0 filas**.
 *
 * Tres tablas que informan sobre algo que nadie hace. Abrir con un panel de
 * porcentajes sería la cuarta: el primer día mostraría cinco filas diciendo «sin
 * datos» y nadie volvería. **La precisión es la CONSECUENCIA de quemar la cola**,
 * y por eso va debajo.
 */

/** Lo que una regla acumuló, tal como lo cuenta la tabla de correcciones. */
export interface ConteoDeRegla {
  /** La FAMILIA, sin versión: `escucha.apoyo`. Es la unidad con la que se mide. */
  regla: string;
  acepta: number;
  corrige: number;
  /** Ni a favor ni en contra: ver `precisionDe`. */
  noAplica: number;
  /** Cuántas escribió en total, revisadas o no. */
  escribio: number;
  estado: EstadoDeRegla;
}

/**
 * Los tres estados de una regla (ADR 0095 §8). Se dibujan con la MISMA escalera
 * de formas que los chips de la tarjeta, un nivel más arriba: `declara` lleno ·
 * `sugiere` punteado con tinta plena · `sombra` punteado y apagado.
 *
 * ⚠️ **No llevan verde/amarillo/rojo**, y no sólo porque esos colores ya son la
 * ventana de 24 h: pintar `sombra` de gris-error diría que está mal, y **sombra
 * es donde toda regla nueva TIENE que empezar**. Castigar con el color el
 * comportamiento correcto es la forma más rápida de que nadie lo siga.
 */
export type EstadoDeRegla = 'sombra' | 'sugiere' | 'declara';

/**
 * LA MUESTRA MÍNIMA PARA DECIR UN PORCENTAJE.
 *
 * 🔴 **Un «100 %» sobre dos revisiones no es un dato: es una coincidencia**, y
 * puesto al lado de un «94 % sobre 212» miente por comparación — las dos cifras
 * se leen con la misma autoridad. Por debajo de esto la vista dice cuántas van y
 * se calla el porcentaje, que es lo honesto y encima empuja a revisar más.
 *
 * Doce y no diez ni veinte: es el orden de magnitud donde una corrección más
 * deja de mover el número diez puntos. No hay medición detrás — cuando existan
 * correcciones de verdad, este número se calibra con ellas y no antes.
 */
export const MUESTRA_MINIMA = 12;

export interface Precision {
  /** `null` cuando la muestra no alcanza para decirlo sin mentir. */
  porcentaje: number | null;
  /** Sobre cuántas. Se dice SIEMPRE, tenga o no porcentaje. */
  muestra: number;
  /** Qué mostrar cuando no hay porcentaje. Vacío cuando sí lo hay. */
  motivo: string;
}

/**
 * LA PRECISIÓN DE UNA REGLA: aceptadas sobre lo dictaminado.
 *
 * 🔴 **`no_aplica` queda FUERA del cociente**, y las dos alternativas son peores:
 * contarlo como acierto haría subir a una regla **por dispararse de más**, y
 * contarlo como error haría que quien atiende dejara de marcarlo para no
 * castigar a una regla que no se equivocó. Fuera de la cuenta, marcarlo no tiene
 * costo — y su conteo aparte es, él solo, la señal de que una regla se está
 * disparando donde no debe.
 *
 * ⚠️ **Y el porcentaje NUNCA viaja sin su muestra.** No es prolijidad: «94 %
 * sobre 17» y «94 % sobre 1.700» son afirmaciones distintas, y la vista que
 * muestra sólo la primera cifra las vuelve indistinguibles.
 */
export function precisionDe(c: Pick<ConteoDeRegla, 'acepta' | 'corrige'>): Precision {
  const muestra = c.acepta + c.corrige;
  if (muestra === 0) return { porcentaje: null, muestra: 0, motivo: 'nadie la miró todavía' };
  if (muestra < MUESTRA_MINIMA)
    return { porcentaje: null, muestra, motivo: `sólo ${muestra} revisadas: muy pocas para decirlo` };
  return { porcentaje: Math.round((c.acepta / muestra) * 100), muestra, motivo: '' };
}

/** Cuántas de las que escribió esa regla no las miró nadie. */
export function sinRevisar(c: ConteoDeRegla): number {
  return Math.max(c.escribio - c.acepta - c.corrige - c.noAplica, 0);
}

/** Una afirmación esperando veredicto, como la ve el supervisor. */
export interface Pendiente {
  id: string;
  /** `anotó` cambió el tablero; `leyó` sólo clasificó. Ver el orden, abajo. */
  cambioElTablero: boolean;
  /** Cuándo la escribió el sistema. */
  creadoAt: string;
  veredicto?: Veredicto;
}

/**
 * EN QUÉ ORDEN SE REVISA.
 *
 * 🔴 **Primero lo que YA ESTÁ ACTUANDO.** Una lectura equivocada que sólo
 * clasificó un mensaje es un chip que dice algo raro; una que movió a alguien de
 * columna está, mientras nadie la mire, ordenando el trabajo de un equipo con un
 * dato falso. Cuesta distinto y se revisa distinto.
 *
 * ⚠️ **Y dentro de cada grupo, primero LA MÁS VIEJA.** Es al revés de casi todo
 * lo demás en este producto —donde lo nuevo va arriba— y a propósito: acá el
 * orden no dice «qué pasó recién», dice «qué lleva más tiempo actuando sin que
 * nadie lo mire». Con lo nuevo primero, una afirmación vieja y equivocada se
 * hunde para siempre debajo de las que llegan cada quince minutos.
 */
export function ordenDeRevision(pendientes: readonly Pendiente[]): Pendiente[] {
  return [...pendientes]
    .filter((p) => p.veredicto == null)
    .sort((a, b) => {
      if (a.cambioElTablero !== b.cambioElTablero) return a.cambioElTablero ? -1 : 1;
      return a.creadoAt.localeCompare(b.creadoAt);
    });
}

/**
 * EL AVISO DE QUE UNA REGLA SE MOVIÓ SOLA (ADR 0095 §8: «nunca en silencio»).
 *
 * 🔴 **Y trae con qué volverla atrás.** Un aviso sin acción es silencio con más
 * pasos: el supervisor se entera y tiene que salir a buscar dónde se deshace.
 */
export interface AvisoDeUmbral {
  regla: string;
  desde: EstadoDeRegla;
  hacia: EstadoDeRegla;
  /** La cifra que la movió, con su muestra: sin las dos, el aviso no se puede juzgar. */
  precision: number;
  muestra: number;
  cuando: string;
}

/**
 * ¿Vale la pena avisar de este cambio de estado?
 *
 * Sí cuando SUBIÓ —empezó a actuar sola sobre el tablero— y también cuando BAJÓ,
 * que es la mitad que se olvida: una regla que dejó de declarar deja de llenar
 * una columna, y si nadie lo dice, la columna se vacía sin explicación.
 */
export function mereceAviso(a: Pick<AvisoDeUmbral, 'desde' | 'hacia'>): boolean {
  return a.desde !== a.hacia;
}
