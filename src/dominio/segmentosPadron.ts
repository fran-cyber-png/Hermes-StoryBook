/**
 * LOS SEGMENTOS DEL PADRÓN — qué ES una etapa, qué ES un historial de compra.
 *
 * Vive en `dominio/` y no en `features/padron/` (de donde se mudó el
 * 24-ago-2026) porque «qué agrupa `stage=sold`» es una pregunta sobre el
 * MODELO, no sobre la pantalla: si mañana el Dashboard quiere los mismos
 * cinco grupos de Etapa, importa de acá — la alternativa es escribir la regla
 * dos veces, y una regla en dos lugares diverge muda (#37, la cicatriz más
 * repetida del repo).
 *
 * Puro: nada de React, nada de `fetch`, nada de `FiltrosPadron`. Quien
 * traduce un grupo a un filtro de pantalla es cada feature que lo use.
 */

import { nombreCorto } from './dueno';

/** Un valor elegible, con cuántos contactos tiene en el recorte actual. */
export interface OpcionFaceta {
  valor: string;
  contactos: number;
}

/**
 * UN GRUPO CON SENTIDO DE NEGOCIO, hecho de valores crudos de icarus.
 *
 * `etapa` y `nivel` viajan al server igual que siempre —como lista de valores
 * crudos (`sold`, `vip`…)—: un grupo no es un campo nuevo, es una forma de
 * ELEGIR varios valores crudos de una vez y de mostrarlos con un nombre que un
 * supervisor entiende. El server no sabe que los grupos existen, y no hace
 * falta que lo sepa.
 */
export interface GrupoCondensado {
  id: string;
  rotulo: string;
  valores: readonly string[];
  /** Por qué existe este grupo. */
  nota?: string;
  /** Una duda sobre el propio grupo — distinto de `nota`, que explica el grupo. */
  aviso?: string;
  /**
   * ⚠️ **Sólo un grupo lo lleva en `true` — «Todavía sin trabajar».** Con las
   * cinco notas abiertas a la vez en una columna de 380 px no se lee ninguna
   * (Estephano, 24-ago-2026); el resto queda detrás de un ícono ⓘ, a demanda.
   * Ésta es la única que evita un error caro (tratar el 84 % del padrón como
   * un recorte útil) y por eso es la única que no se puede perder.
   */
  notaSiempreVisible?: boolean;
}

/**
 * ETAPA CONDENSADA — 10 valores de `stage` en 5 grupos con sentido de negocio,
 * medidos en producción el 24-ago-2026 (73.145 contactos):
 *   contacted 61.366 · delivered 5.796 · sold 4.968 · interested 658 ·
 *   new 140 · follow_up 135 · recontact 46 · resold 28 · lost 7 · client 1
 *
 * 🔴 **`contacted` solo es el 84 % del padrón.** Filtrar por él no recorta nada,
 * así que el grupo que lo contiene («Todavía sin trabajar») no se ofrece como si
 * sirviera para armar un lote — lleva su propia nota en vez de un check mudo.
 *
 * 🔴 **`delivered` NO es una compra — medido con el cruce directo contra
 * `icarus.sales` (24-ago-2026), no por resta:**
 *
 *   | stage    | total | con venta real |
 *   |----------|-------|-----------------|
 *   | sold     | 4.968 | 4.953 (99,7 %)  |
 *   | delivered| 5.796 |     2 (0,03 %)  |
 *   | resold   |    28 |     1           |
 *   | client   |     1 |     0           |
 *
 * La hipótesis inicial del dueño («delivered = ya compró y se le entregó el
 * curso») no la sostienen los datos: casi ninguno de los 5.796 tiene venta
 * detrás. Van en su PROPIO grupo, separados de `sold`/`resold`/`client` — son
 * **oportunidades sin cerrar** (se les entregó algo — curso, propuesta o
 * material — y nadie compró), el segundo grupo más grande del padrón después de
 * «Todavía sin trabajar», y probablemente el más valioso para repartir.
 *
 * 🔴 **Corolario para el PR, y es lo que más importa del hallazgo**: cualquier
 * conteo de «cuántos compraron» que salga de `stage` está mal — hasta ~2× más
 * alto que la realidad. El número bueno es siempre el de `icarus.sales`
 * (el toggle «Con venta real», `conVenta`). De paso quedaron **16 contactos con
 * venta real que ninguna etiqueta de `stage` marca como compradores** — otro
 * dato para el dueño, no algo que este módulo decida.
 */
export const ETAPA_GRUPOS: readonly GrupoCondensado[] = [
  { id: 'conversacion', rotulo: 'Contactado', valores: ['interested', 'follow_up', 'recontact'] },
  {
    id: 'sin_cerrar',
    rotulo: 'En negociación',
    valores: ['delivered'],
    nota: 'Ya se les entregó algo (curso, propuesta o material) y todavía no compraron — es el grupo más grande de oportunidades reales para repartir.',
  },
  {
    id: 'cliente',
    rotulo: 'Venta cerrada',
    valores: ['sold', 'resold', 'client'],
    nota: 'Coincide casi siempre con el interruptor «Con venta real» de más abajo (verificado el 24-ago-2026).',
  },
  { id: 'perdido', rotulo: 'Venta perdida', valores: ['lost'] },
  {
    id: 'sin_tocar',
    rotulo: 'Por contactar',
    valores: ['contacted', 'new'],
    nota: 'Es la mayor parte del padrón: no sirve para armar un lote por sí solo, es lo que queda si no eliges nada de las opciones de arriba.',
    notaSiempreVisible: true,
  },
];

/**
 * HISTORIAL DE COMPRA — antes se llamaba «Nivel» y mostraba `buyer_tier`.
 *
 * 🔴 **El nombre viejo mentía por partida doble.** `icarus.contacts` tiene una
 * columna que se llama literalmente `level`, distinta de `buyer_tier`, y está
 * **100 % vacía** (73.145 de 73.145) — nadie la lee ni la llenó nunca. Un
 * supervisor que conoce la base y ve «Nivel» en la pantalla no tiene forma de
 * saber que el filtro mira la OTRA columna. El rótulo nuevo dice qué es el
 * dato (historial de compra), no cómo se llama en la base.
 *
 * VIP y «Compró más de una vez» van primero porque son los únicos dos segmentos
 * chicos y accionables (460 y 2.544); Prospect y Sin dato —el 87 % del padrón
 * junto— van al final, misma lógica que «Todavía sin trabajar» en Etapa.
 *
 * `buyer_tier` vacío (33 %, 24.051 contactos) no es un grupo de esta lista:
 * el server filtra por `= ANY(array)`, y eso nunca hace match contra NULL, así
 * que hoy no hay forma de PEDIR «sin dato» — solo de mostrar cuántos son
 * (`contactosSinGrupo`). Ofrecerlo con un check que no hace nada sería peor que
 * no ofrecerlo.
 *
 * 🔴 **`buyer_tier` miente en los DOS sentidos, medido el 24-ago-2026 contra
 * `icarus.sales`:**
 *
 *   | buyer_tier | total  | con venta real |
 *   |------------|--------|-----------------|
 *   | prospect   | 39.306 |    188          |
 *   | single     |  6.784 |  2.403 (35 %)   |
 *   | repeat     |  2.544 |  1.238 (49 %)   |
 *   | vip        |    460 |    317 (69 %)   |
 *
 * Los cuatro suman 4.146 con venta real, pero el padrón tiene 4.972 — hay
 * **~826 clientes reales con `buyer_tier` VACÍO**, mezclados en el «sin dato»
 * de acá arriba. Ya está aprobada una proyección del lado del server que
 * recalcule esto contra las ventas reales; mientras tanto:
 *
 *   ⚠️ **Ningún rótulo de acá promete exactitud** («VIP», no «los que más
 *   compraron») — un rótulo neutro sobrevive al arreglo, uno que afirma no.
 *   Los conteos se leen SIEMPRE de la faceta en vivo (`contactosDelGrupo`),
 *   nunca de un número escrito acá: cuando la proyección corrija el dato, el
 *   grupo se achica solo, sin tocar este archivo.
 *
 * ⚠️ **Va a cambiar de raíz cuando entre la proyección** (`nivel` con 4
 * valores cerrados calculados contra ventas reales: `vip` · `recompro` ·
 * `compro` · `null`, donde `null` = «nunca compró de verdad», no «sin dato»).
 * Ese día este archivo cambia — `buyer_tier` deja de existir como tal — pero
 * la FORMA (`GrupoCondensado`, «el grande al final, sin ofrecerse como
 * recorte útil») sigue valiendo igual: es el mismo patrón que «Todavía sin
 * trabajar» en Etapa.
 */
export const NIVEL_GRUPOS: readonly GrupoCondensado[] = [
  { id: 'vip', rotulo: 'Cliente VIP', valores: ['vip'] },
  { id: 'repeat', rotulo: 'Cliente recurrente', valores: ['repeat'] },
  { id: 'single', rotulo: 'Compró nuevo', valores: ['single'] },
  { id: 'prospect', rotulo: 'Sin compra', valores: ['prospect'] },
];

/** Cuántos contactos le corresponden a un grupo, sumando sus valores crudos. */
export function contactosDelGrupo(opciones: OpcionFaceta[] | undefined, grupo: GrupoCondensado): number {
  const buscados = new Set(grupo.valores);
  return (opciones ?? []).reduce((suma, o) => (buscados.has(o.valor) ? suma + o.contactos : suma), 0);
}

/**
 * Los que no entran en NINGÚN grupo publicado: para `nivel`, el 33 % sin dato
 * (`buyer_tier IS NULL`, que la faceta no puede devolver — ver el docblock de
 * `NIVEL_GRUPOS`); para `etapa`, la red de seguridad si icarus agrega un valor
 * nuevo que todavía nadie agrupó. Mismo cálculo, dos motivos distintos.
 */
export function contactosSinGrupo(
  total: number,
  opciones: OpcionFaceta[] | undefined,
  grupos: readonly GrupoCondensado[],
): number {
  const cubiertos = new Set(grupos.flatMap((g) => g.valores));
  const conocidos = (opciones ?? []).reduce((s, o) => (cubiertos.has(o.valor) ? s + o.contactos : s), 0);
  return Math.max(0, total - conocidos);
}

/** ¿Están puestos TODOS los valores crudos de este grupo? Así se pinta su check. */
export function grupoActivo(grupo: GrupoCondensado, actuales: string[] | undefined): boolean {
  const a = actuales ?? [];
  return grupo.valores.every((v) => a.includes(v));
}

/**
 * Prende o apaga un grupo entero, de una.
 *
 * ⚠️ **Un estado A MEDIAS —caché vieja de antes de esta versión, ADR 0007—
 * cuenta como APAGADO**, porque `grupoActivo` exige TODOS los valores. Tocar
 * la casilla ahí no la vacía: la completa. Es la misma regla que un checkbox
 * de toda la vida — si se ve destildada, tocarla la tilda — y evita el otro
 * comportamiento posible (sacar lo poco que había), que dejaría la casilla
 * destildada mostrando CERO de sus tres valores en vez de los tres.
 */
export function alternarGrupo(grupo: GrupoCondensado, actuales: string[] | undefined): string[] {
  const a = actuales ?? [];
  return grupoActivo(grupo, a)
    ? a.filter((v) => !grupo.valores.includes(v))
    : [...new Set([...a, ...grupo.valores])];
}

/**
 * Los chips de una dimensión agrupada (Etapa, Nivel): un chip por grupo activo,
 * con SU rótulo humano, nunca con el valor crudo de icarus.
 *
 * ⚠️ **Puede quedar un resto sin grupo** — caché vieja de antes de esta versión
 * (ADR 0007), o un valor de icarus que ningún grupo cubre todavía. Se muestra
 * tal cual, sin rótulo bonito: un chip feo es mejor que un filtro puesto que no
 * se ve en ningún lado y que nadie sabe cómo sacar.
 */
export function chipsDeGrupos(
  campo: string,
  grupos: readonly GrupoCondensado[],
  actuales: string[] | undefined,
): { llave: string; rotulo: string; quitar: (actuales: string[] | undefined) => string[] }[] {
  const a = actuales ?? [];
  const chips: { llave: string; rotulo: string; quitar: (actuales: string[] | undefined) => string[] }[] = [];
  const cubiertos = new Set<string>();
  for (const g of grupos) {
    if (grupoActivo(g, a)) {
      chips.push({ llave: `${campo}:${g.id}`, rotulo: g.rotulo, quitar: (act) => alternarGrupo(g, act) });
      for (const v of g.valores) cubiertos.add(v);
    }
  }
  for (const v of a) {
    if (!cubiertos.has(v)) {
      chips.push({ llave: `${campo}:${v}`, rotulo: v, quitar: (act) => (act ?? []).filter((x) => x !== v) });
    }
  }
  return chips;
}

/**
 * REPARTO — el control unificado, pedido por el dueño el 24-ago-2026:
 * «que diga cuántos tiene asignados, que haya un filtro por defecto de los
 * que están asignados, y que se pueda poner ninguno y/o a varios».
 *
 * Antes eran DOS controles que hablaban del mismo hecho —el interruptor «Sin
 * repartir» y el desplegable «Asignado a»—; ahora son una sola lista, y
 * «Sin asignar» es UNA OPCIÓN MÁS, no un interruptor aparte.
 *
 * 🔴 **«Sin asignar» NO es un valor de `asignadoA`.** El server lo manda
 * separado (`FacetaReparto.sinRepartir`) porque mandarlo de vuelta como si
 * fuera una grafía de `asignadoA` buscaría a alguien con ese nombre y no
 * encontraría a nadie — cero resultados, lo contrario de lo pedido. Por eso
 * esta función no devuelve algo que se pueda mandar tal cual: devuelve filas
 * con un `id`, y quien las use decide, mirando `esSinAsignar`, si togglear
 * `sinHabilitar` (booleano) o sumar/sacar de `asignadoA` (lista) — la
 * traducción es la única parte de esto que sabe de `FiltrosPadron`, y por
 * eso vive en la feature, no acá.
 *
 * ⚠️ **«Sin asignar» va PRIMERO, no al final.** Es el mismo tamaño gigante
 * que «Todavía sin trabajar» en Etapa (probablemente el 84 % del padrón), pero
 * al revés: ese no sirve para armar un lote, ÉSTE es literalmente lo que el
 * supervisor va a repartir. El grande que importa no se esconde.
 */
export const ID_SIN_ASIGNAR = '__sin_asignar__';

export interface OpcionDeReparto {
  id: string;
  rotulo: string;
  contactos: number;
}

/** ¿Esta fila es la opción «Sin asignar» (→ `sinHabilitar`), o una vendedora (→ `asignadoA`)? */
export function esSinAsignar(opcion: OpcionDeReparto): boolean {
  return opcion.id === ID_SIN_ASIGNAR;
}

export function opcionesDeReparto(faceta: { opciones: OpcionFaceta[]; sinRepartir: number } | undefined): OpcionDeReparto[] {
  if (!faceta) return [];
  return [
    // «Sin asignar» y ya no «Nadie todavía» (ADR 0102): el mismo filtro tenía
    // tres nombres en la misma pantalla —éste, «Sin asignar» y «Sin repartir»—,
    // y tres nombres se leen como tres filtros.
    { id: ID_SIN_ASIGNAR, rotulo: 'Sin asignar', contactos: faceta.sinRepartir },
    ...faceta.opciones.map((o) => ({ id: o.valor, rotulo: nombreCorto(o.valor), contactos: o.contactos })),
  ];
}
