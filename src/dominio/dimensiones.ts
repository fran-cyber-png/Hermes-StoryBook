/**
 * LAS DIMENSIONES DE UNA FILA DE LA COLA — el tipo del front (#783, ADR 0095 §1).
 *
 * El estado de una persona son dimensiones con **quién las afirmó** y **con qué
 * confianza**, no un peldaño. Este archivo es el contrato: lo que el server sirve
 * por fila y cómo se lee. Vive en `dominio/` —capa 1— porque describe QUÉ es una
 * conversación; ninguna feature lo reinterpreta.
 *
 * ══ 🔴 TODO ES OPCIONAL, Y AUSENTE NO ES `desconocida` ════════════════════
 *
 * Un campo **ausente** significa «no se miró»: la cola de `ventas` no las sirve
 * (ADR 0095 §9: lo genérico se prende ahí en una segunda vuelta), y con dos
 * clientes en el alcance el server las apaga a propósito y lo dice con
 * `sinDimensiones`. En cambio `postura: 'desconocida'` significa **«se miró y no
 * se sabe»** — el sistema leyó los mensajes y no encontró postura.
 *
 * La diferencia decide qué se dibuja: lo ausente **no se dibuja**; lo
 * `desconocida` sí, porque es un hecho medido. Colapsarlas en `null` era la
 * tentación y se descartó: una pantalla que no puede distinguirlas termina
 * mostrando «sin postura» como si fuera un dato.
 */

/** Lo que el sistema cree que piensa la persona (ADR 0095 §1). */
export type Postura = 'apoya' | 'indeciso' | 'se_opone' | 'pro_rival' | 'desconocida';

/** Quién lo afirmó: una persona del equipo o un motor. Nunca «no se sabe». */
export type OrigenDeAfirmacion = 'persona' | 'sistema';

/** `alta` · `media` · `baja`. Tres valores, no un número (ADR 0094). */
export type Confianza = 'alta' | 'media' | 'baja';

/**
 * QUIÉN TIENE LA PELOTA — la dimensión «atención» de ADR 0095 §1.
 *
 * 🔴 Es de tres valores y no de dos, y esa es la razón de que `hablo` viaje en
 * la fila: `respondida` sola **no distingue** «contestó» de «nunca contestó»,
 * porque una conversación sin ningún entrante da `respondida = true`. Sin el
 * tercer valor, «le escribimos y no contesta» —el peldaño más grande del
 * embudo, 2.580 de 3.973 conversaciones medidas el 8-ago-2026— se lee como si
 * la persona hubiera contestado.
 */
export type Atencion = 'te_espera' | 'contesto' | 'nunca_contesto';

/** Los hechos de la fila con los que se deriva la atención. */
export interface HechosDeAtencion {
  respondida: boolean;
  hablo?: boolean;
  yaLeHablamos?: boolean;
}

/**
 * La atención de una conversación. La regla vive ACÁ: el server sirve los hechos
 * (`respondida`, `hablo`, `ya_le_hablamos`) y la pantalla no vuelve a decidir con
 * ellos por su cuenta.
 *
 * ⚠️ **Tiene UNA copia en el server, `server/src/cola/atencion.ts`**, para que el
 * productor del hilo (`afirmaciones/delHilo.ts`) afirme lo mismo que esta pantalla
 * dibuja. El server no puede importar del front (`rootDir`), igual que el
 * semáforo: **si tocas la regla acá, tócala allá**, y los casos de los dos tests
 * tienen que seguir siendo los mismos.
 *
 * ⚠️ `hablo` es opcional porque un server viejo —o una respuesta rehidratada del
 * caché de IndexedDB (ADR 0007)— no lo trae. Ausente se asume `true`, que es el
 * comportamiento de siempre: se prefiere no inventar un «nunca contestó».
 */
export function atencionDe(f: HechosDeAtencion): Atencion {
  if (f.hablo === false && f.yaLeHablamos) return 'nunca_contesto';
  return f.respondida ? 'contesto' : 'te_espera';
}

/**
 * Las dimensiones tal como viajan en cada fila de `/api/conversaciones` y del
 * tablero: **con el nombre que les pone `consultarCola`**, en snake_case como el
 * resto de la fila (`etapa_manual`, `ultimo_at`). En `ventas` vienen en `null`.
 *
 * 🔴 **La versión anterior las prometía en camelCase** (`posturaEvidencia`…) y no
 * había mapeo en ningún lado: el primer componente que la leyera habría dibujado
 * todo vacío, sin error. Y prometía un `compromiso` que el server no emite: el
 * peldaño viaja como `etapa_manual`, porque vive en `gestiones` (revisión de #939).
 * Las columnas salen de `server/src/cola/dimensionesSql.ts` y de `consultarCola`.
 */
export interface DimensionesDeFila {
  postura?: Postura | null;
  /** El `interaction_id` del mensaje que la explica. Se puede citar y abrir. */
  postura_evidencia?: string | null;
  postura_confianza?: Confianza | null;
  /** La FAMILIA de la regla (`escucha.postura`), sin la versión del diccionario. */
  postura_regla?: string | null;

  /**
   * 🔴 Ya RESUELTO contra la ventana de 30 días, del lado del server. La pantalla
   * no la vuelve a calcular: esa ventana vive en `afirmaciones/proyectar.ts` con
   * su gemelo SQL generado desde la misma constante, y una tercera copia acá
   * sería la única sin test de paridad.
   */
  riesgo?: boolean | null;
  /** Sólo para el texto («hace seis días»). No se decide nada con esto. */
  riesgo_at?: string | null;
  riesgo_evidencia?: string | null;
  riesgo_regla?: string | null;

  pidio_explicito?: boolean | null;
  pidio_at?: string | null;

  temas?: string[] | null;
  lugar?: string | null;

  /** De qué salió el estado: `persona` (compartido entre canales), `identidad`, `conversacion`. */
  estado_origen?: string | null;

  /** Quién puso el peldaño de `etapa_manual`: una persona del equipo o un motor. */
  compromiso_origen?: OrigenDeAfirmacion | null;
  compromiso_evidencia?: string | null;
  compromiso_regla?: string | null;
  compromiso_confianza?: Confianza | null;

  /**
   * true = este estado es de la PERSONA y se comparte entre sus canales — el
   * chip «en 2 canales». Sin él, una vendedora ve en este hilo algo que acá
   * nadie escribió y no tiene cómo saber de dónde salió.
   */
  estado_compartido?: boolean | null;
  /** En cuántos canales está esa persona. `1` es el caso normal. */
  canales_enlazados?: number | null;
}

/**
 * ¿El chip de riesgo se dibuja? Sólo cuando lo que lo prende **no es el mismo
 * mensaje** que fijó la postura: si son el mismo, el chip repetiría lo que la
 * postura ya dice y ocuparía lugar sin agregar nada.
 */
export function muestraChipDeRiesgo(d: DimensionesDeFila): boolean {
  return Boolean(d.riesgo) && d.riesgo_evidencia !== d.postura_evidencia;
}
