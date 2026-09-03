/**
 * Las etapas del embudo, canónicas para TODA la app (Dashboard, cola, kanban,
 * recibo de venta). La identidad visual de una etapa es fija: ningún filtro ni
 * vista la re-pinta.
 */

export const ETAPAS = ['interesado', 'contactado', 'cotizado', 'cierre', 'perdido'] as const;

/**
 * ══ «SIN RESPUESTA» — DERIVADA, NUNCA DECLARABLE ═══════════════════════════
 *
 * Le escribimos y la persona nunca contestó (server: `cola/etapaEfectivaSql.ts`).
 * Medido el 8-ago-2026: **2.580 de 3.973 conversaciones (65 %)**, que hasta hoy
 * caían en Contactados y Cotizados e inflaban las dos — 2.252 de los 3.050
 * Cotizados nunca habían dicho una palabra.
 *
 * 🔴 **Queda AFUERA de `ETAPAS` a propósito**, y no es un olvido: esa lista es la
 * que se puede DECLARAR (botón, arrastre) o le pide el recibo de venta un
 * peldaño «ganado». `sin_respuesta` no es ninguna de las dos cosas — se deriva
 * de un hecho y deja de ser cierto solo, en cuanto la persona escribe. Está en
 * el TIPO —porque el tablero sí lo recibe y lo pinta— y no en la lista que se
 * enumera para declarar.
 *
 * ⚠️ **Lo que este comentario decía ANTES era la causa del issue #329**: «el
 * Dashboard solo cuenta conversaciones con un primer entrante, así que por
 * construcción nunca lo devuelve». Eso es cierto de `/negocio` (su `HAVING` lo
 * exige) y era **falso** del embudo del radar, que llama al mismo seam del
 * Pipeline — donde `sin_respuesta` es el 65 % del total. El total y los
 * segmentos del Dashboard NO iteran `ETAPAS`: iteran las claves que el server
 * mandó (`ordenDelEmbudo`, abajo), así que esto no puede volver a pasar.
 */
export const SIN_RESPUESTA = 'sin_respuesta';

/**
 * ══ EL ORDEN DE DIBUJO DEL EMBUDO DEL DASHBOARD (issue #329) ═══════════════
 *
 * El Dashboard NO decide qué etapas existen — eso lo dice el SERVER, en las
 * claves de `embudo` (`contarPorEtapaEfectiva`, el mismo seam del Pipeline).
 * Esta lista es solo el orden preferido para DIBUJARLAS: primero la espera
 * (no es un peldaño ganado), después los peldaños de ventas en su orden de
 * siempre.
 *
 * 🔴 **Antes el Dashboard iteraba `ETAPAS` a secas para el total y los
 * segmentos**, y `ETAPAS` excluye `sin_respuesta` a propósito (ver arriba):
 * el radar mostraba **1.397** cuando el seam devolvía **3.973**, porque el
 * 65 % del embudo —la etapa MÁS GRANDE— nunca se sumaba ni se dibujaba.
 *
 * ⚠️ `ordenDelEmbudo` **degrada, no tumba**: una clave que el server mande y
 * esta lista no conozca no se pierde, se agrega al final — mismo criterio
 * que `rotuloEtapa` con un id desconocido (ADR 0037). Es lo que hace que
 * `dashboard/etapas.paridad.test.ts` pueda fijar la relación *«toda etapa
 * que el seam puede devolver, el Dashboard la puede dibujar»* sin que este
 * archivo tenga que enumerar cada una a mano.
 */
/**
 * ══ LAS ETAPAS DE CAMPAÑA (ADR 0063) ═══════════════════════════════════════
 *
 * Espejo de `ETAPAS_CAMPANA` del server. **Aparte de `ETAPAS`** por lo mismo que
 * allá: esa lista la iteran el embudo del Dashboard y el recibo de venta, que
 * son de ventas, y ahí estos tres serían tres segmentos clavados en cero.
 *
 * ⚠️ Los tres se DECLARAN y ninguno se deriva — es la asimetría que invierte
 * ADR 0044: un votante no deja huellas verificables.
 */
export const ETAPAS_CAMPANA = ['simpatiza', 'comprometido', 'voluntario'] as const;

/**
 * ⚠️ **`perdido` va SIEMPRE ÚLTIMO y por eso se saca del medio.** No es un
 * peldaño de la escalera: es donde termina lo que no llegó, y en el embudo se
 * lee de izquierda a derecha como una progresión. Dejarlo en el orden de
 * `ETAPAS` lo pondría antes de los tres peldaños de campaña.
 */
const TERMINAL = 'perdido';

/**
 * 🔴 **UNA SOLA LISTA SIRVE A LOS DOS MÓDULOS, y no es un atajo: es correcto por
 * construcción.** Una conversación pertenece a UN módulo, así que las etapas
 * propias de ventas (`cotizado`, `cierre`) y las de campaña (`simpatiza`,
 * `comprometido`, `voluntario`) **nunca coexisten en una misma respuesta**. Al
 * filtrar contra las claves que mandó el server, cada módulo recupera su propio
 * orden de esta única lista — y los dos peldaños compartidos (`interesado`,
 * `contactado`) salen primeros en los dos.
 *
 * Antes era `[SIN_RESPUESTA, ...ETAPAS]`, o sea sólo ventas, y las tres de
 * campaña caían en la rama «desconocidas» de `ordenDelEmbudo`: se agregaban al
 * final **en el orden en que las mandó el server**. Medido, el embudo de campaña
 * se dibujaba `interesado · contactado · perdido · voluntario · comprometido ·
 * simpatiza` — o sea la escalera AL REVÉS y con el terminal en el medio. No se
 * perdía ninguna etapa ni ningún número, por eso nadie lo vio.
 */
const ORDEN_PREFERIDO_EMBUDO: readonly string[] = [
  SIN_RESPUESTA,
  ...ETAPAS.filter((e) => e !== TERMINAL),
  ...ETAPAS_CAMPANA,
  TERMINAL,
];

export function ordenDelEmbudo(claves: readonly string[]): string[] {
  const conocidas = ORDEN_PREFERIDO_EMBUDO.filter((e) => claves.includes(e));
  const desconocidas = claves.filter((c) => !ORDEN_PREFERIDO_EMBUDO.includes(c));
  return [...conocidas, ...desconocidas];
}

/**
 * EL TOTAL DEL EMBUDO — la suma de TODAS las claves que el server mandó, sin
 * filtrar por ninguna lista del front. Es la mitad del fix de #329 que se
 * puede probar sin montar un componente: el bug era exactamente que el total
 * se calculaba con `ETAPAS.reduce(...)`, que deja afuera cualquier clave que
 * `ETAPAS` no enumere — hoy `sin_respuesta`, mañana la que sea.
 */
export function totalDelEmbudo(embudo: Record<string, number> | null | undefined): number {
  return Object.values(embudo ?? {}).reduce((n, v) => n + v, 0);
}

/**
 * ⚠️ **El tipo es la UNIÓN de los dos módulos, no uno por módulo.** Los tipos que
 * lo usan —`decidirDrop`, la tarjeta, la barra de gestión— son los MISMOS
 * componentes en los dos tableros; partirlo obligaría a duplicarlos. Qué etapa
 * se le OFRECE a cada quien lo decide `vistas/tablero.ts:columnasDe`, que es
 * donde vive el tablero, no el tipo.
 */
export type Etapa =
  | (typeof ETAPAS)[number]
  | (typeof ETAPAS_CAMPANA)[number]
  | typeof SIN_RESPUESTA;

/**
 * ══ CÓMO SE LLAMA CADA ETAPA — UNA SOLA VEZ, PARA TODA LA APP ══════════════
 *
 * Hasta acá los rótulos vivían en CINCO lugares y ninguno era canónico:
 * `vistas/tablero.ts` (plural), `gestion/BarraGestion.tsx` (singular y sin
 * `perdido`), **dos `ETAPA_LABEL` privados e idénticos** en
 * `venta/FormularioVenta.tsx` y `gestion/RegistrarGestion.tsx`, y el Dashboard,
 * que no tenía ninguno: pintaba **el identificador crudo** con un `capitalize`
 * de CSS. Con ids de una palabra eso se veía bien de casualidad — y por eso
 * nadie lo vio.
 *
 * 🔴 **Es #37 otra vez, y el rename lo iba a destapar**: al cambiar el rótulo
 * del tablero, el Dashboard habría seguido diciendo «Cotizado» sobre la misma
 * conversación que el Pipeline llama «Saben el precio». Dos nombres para el
 * mismo hecho es peor que un nombre feo.
 *
 * ── POR QUÉ EL VALOR ES UN PAR Y NO UN STRING ────────────────────────────
 * Una COLUMNA es un montón y una FICHA es una persona: «Saben el precio» y
 * «Sabe el precio» son la misma etapa en dos números gramaticales, no dos
 * etapas. Con un solo string, cada consumidor volvía a conjugar por su cuenta —
 * que es exactamente cómo nacieron las cinco copias.
 *
 * ── EL CRITERIO DE LOS NOMBRES (investigación 10-ago-2026) ───────────────
 * Pipedrive («Contact Made», «Proposal Made») y HubSpot («Contract sent») nombran
 * sus etapas como un **hecho en pasado**, y las guías de pipeline nombran
 * *«Interested»* y *«Qualified»* como los ejemplos de lo que NO hay que hacer,
 * por interpretativos. Es la misma regla que ADR 0044 dedujo midiendo: **la
 * etapa se define por una acción observable del COMPRADOR, no por lo que el
 * vendedor cree**. Acá el nombre dice el hecho que el `CASE` de
 * `cola/etapaEfectivaSql.ts` ya evalúa, y nada más.
 *
 * ⚠️ **Los IDENTIFICADORES no se tocan.** `sin_respuesta`, `cotizado` y compañía
 * viven en `gestiones`, en el SQL, en `?etapa=` y en el caché de IndexedDB
 * (ADR 0007): acá se cambia **lo que se lee**, nunca lo que se guarda.
 */
export const ETAPA_ROTULO: Record<string, { uno: string; varios: string }> = {
  // Derivada, nunca declarable: le escribimos y nunca dijo una palabra.
  sin_respuesta: { uno: 'Nunca contestó', varios: 'Nunca contestaron' },
  /**
   * La BANDEJA: escribieron y todavía nadie les contestó — la pelota es NUESTRA.
   *
   * ⚠️ **El nombre NO se inventó acá: se adoptó el que `BandejaDeuda` ya usaba.**
   * Esa tira decía «Te esperan» desde #87 y era el rótulo más claro que había en
   * toda la pantalla — del lado del comprador, sin jerga. Ponerle otro habría
   * dejado la bandeja diciendo una cosa y el chip de la ficha otra, que es el
   * defecto que este mapa viene a cerrar.
   *
   * 🔴 Y es el que más importa que NO se parezca a `sin_respuesta`: son cosas
   * opuestas —deuda NUESTRA vs. deuda del lead— y con nombres como «Sin
   * contestar» / «Sin respuesta» sonaban casi igual. Con «Te esperan» ya ni
   * empiezan con la misma palabra. El test prohíbe que dos etapas compartan
   * rótulo justamente por esto.
   */
  interesado: { uno: 'Te espera', varios: 'Te esperan' },
  contactado: { uno: 'Contestó', varios: 'Contestaron' },
  cotizado: { uno: 'Sabe el precio', varios: 'Saben el precio' },
  cierre: { uno: 'Compró', varios: 'Compraron' },
  /**
   * ══ LOS TRES PELDAÑOS DE CAMPAÑA (ADR 0063) ═══════════════════════════════
   *
   * Misma regla que los de arriba —el hecho, en pasado, del lado de la persona—
   * y una diferencia que hay que tener presente al leerlos: **estos NO se
   * derivan de nada, los afirma quien habló**. Un comprador deja huellas
   * (un precio, una venta); un votante no deja ninguna.
   *
   * ⚠️ **Viven en el MISMO mapa que los de ventas, no en uno paralelo.** Los ids
   * no se pisan y el candado que importa es el de `etapas.test.ts` —dos etapas
   * no pueden compartir rótulo—, que con dos mapas dejaría de ver los choques
   * entre módulos. «Simpatiza» y «Te espera» tienen que sonar distinto aunque
   * nunca aparezcan en la misma pantalla: la ficha de una persona sí puede
   * mostrar cualquiera de los dos.
   */
  simpatiza: { uno: 'Simpatiza', varios: 'Simpatizan' },
  comprometido: { uno: 'Se comprometió', varios: 'Se comprometieron' },
  voluntario: { uno: 'Es voluntario', varios: 'Son voluntarios' },
  // Terminal humano. Se llama por lo que la persona dijo, y así queda a la vista
  // por qué en toda la historia hay CERO: nadie dice que no, se callan.
  perdido: { uno: 'Dijo que no', varios: 'Dijeron que no' },
};

/**
 * El rótulo de una etapa. **Degrada, no tumba**: una etapa que no está en el
 * mapa se devuelve tal cual, igual que `rotuloDeTipo` con un tipo de evento
 * desconocido (ADR 0037). El server puede empezar a devolver un peldaño nuevo
 * antes de que el front lo conozca —N4 y N5 se despliegan por separado— y ahí
 * mostrar el id crudo es feo, pero es cierto; tirar sería una pantalla en blanco.
 */
export function rotuloEtapa(etapa: string, numero: 'uno' | 'varios' = 'uno'): string {
  return ETAPA_ROTULO[etapa]?.[numero] ?? etapa;
}

/**
 * LOS PELDAÑOS QUE UNA PERSONA PUEDE DECLARAR, por módulo (ADR 0063).
 *
 * ⚠️ **No es lo mismo que las COLUMNAS del tablero, y confundirlos deja un
 * defecto mudo en cada punta**: `sin_respuesta` es columna en ventas y **no** se
 * puede declarar (se deriva de un hecho), y `perdido` se puede declarar y **no**
 * es columna en ninguno de los dos (pide confirmación, vive aparte). Son dos
 * preguntas distintas —qué se DIBUJA vs. qué se AFIRMA— y por eso hay dos
 * funciones.
 *
 * 🔴 **Y la barra del chat tiene que preguntar ÉSTA.** Con la lista de ventas
 * clavada, un operador de campaña podía declarar «Sabe el precio»: la gestión se
 * guardaba, y su propio tablero la devolvía a «Contestaron» porque `cotizado` no
 * está en la escala de campaña (`indexOf` da -1 y manda el piso). Sin error y
 * sin log — la vendedora aprieta, ve que no pasa nada, y no tiene forma de saber
 * por qué.
 */
export function etapasDeclarablesDe(modulo: 'ventas' | 'campana'): readonly string[] {
  return modulo === 'campana'
    ? ['interesado', 'contactado', ...ETAPAS_CAMPANA]
    : ETAPAS.filter((e) => e !== 'perdido');
}

/** Chip de etapa (fondo + tinta). */
export const ETAPA_CHIP: Record<string, string> = {
  // Tinta apagada y sin borde: es un estado de espera, no un peldaño ganado.
  // Sin oro — acá no hay ningún plazo corriendo, hay silencio.
  sin_respuesta: 'bg-muted text-muted-foreground',
  interesado: 'bg-primary/10 text-primary',
  contactado: 'bg-secondary text-secondary-foreground',
  cotizado: 'bg-navy text-white',
  cierre: 'bg-success/10 text-success',
  perdido: 'bg-destructive/10 text-destructive',
  // Los tres de campaña, en la misma progresión de peso que ventas y **sin oro**
  // (acá no corre ningún plazo). `voluntario` toma el verde de `cierre`: es el
  // peldaño ganado de su embudo.
  simpatiza: 'bg-primary/10 text-primary',
  comprometido: 'bg-navy text-white',
  voluntario: 'bg-success/10 text-success',
};

/**
 * Color de segmento para la barra del embudo, por CLAVE — nunca por posición.
 *
 * 🔴 Antes indexaba `i` contra su lugar en `ETAPAS` (`['bg-navy/40',
 * 'bg-navy/60', 'bg-navy'][i]`): agregar `sin_respuesta` como primer
 * segmento corría el índice de TODOS los demás, y cada etapa se pintaba con
 * el color de la anterior. Por clave, agregar un segmento no mueve nada.
 */
const COLOR_SEGMENTO: Record<string, string> = {
  // Apagado y sin la progresión de navy: es un estado de espera, no un
  // peldaño ganado — mismo criterio que `ETAPA_CHIP.sin_respuesta`.
  sin_respuesta: 'bg-muted-foreground/20',
  interesado: 'bg-navy/40',
  contactado: 'bg-navy/60',
  cotizado: 'bg-navy',
  cierre: 'bg-success',
  perdido: 'bg-muted-foreground/30',
};

export function colorSegmento(etapa: string): string {
  return COLOR_SEGMENTO[etapa] ?? 'bg-navy';
}
