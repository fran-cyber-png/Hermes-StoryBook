import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';
import type { OpcionFaceta } from '../../dominio/segmentosPadron';

/**
 * EL PADRÓN, DEL LADO DE LA APP — los 72.923 contactos de icarus que nunca
 * escribieron, y el reparto que decide quién ve cuáles.
 *
 * Contra `/api/padron` (`server/src/routes/padron.ts`).
 *
 * ⚠️ **Quién es supervisor lo dice el SERVER, en la respuesta.** Acá no hay
 * ninguna lista de supervisores ni ningún `if` que decida qué mostrar antes de
 * preguntar: el server sirve el padrón entero o la lista propia, y la pantalla
 * dibuja lo que llegó. Un recorte hecho acá sería cosmético — los datos ya
 * habrían viajado — y esta pantalla es la única de Hermes donde el recorte es
 * una frontera de verdad y no un filtro.
 */

export interface ContactoPadron {
  id: number;
  nombre: string | null;
  telefono: string | null;
  correo: string | null;
  pais: string | null;
  etapa: string | null;
  nivel: string | null;
  gastado: string | null;
  /**
   * Lo que icarus dice que compró. **Miente en más de la mitad de los casos**
   * (10.564 lo tienen en > 0, solo 4.783 tienen venta real), así que NUNCA se
   * dibuja solo: va siempre al lado de `conVenta`, que es lo que se sostiene.
   */
  compras: number | null;
  /** El único «compró» afirmable: hay fila en `icarus.sales`. */
  conVenta: boolean;
  /**
   * ⚠️ **El curso que DECLARÓ, no el que compró.** Lo llena la landing con lo que
   * la persona dijo que le interesaba: de los 19.776 contactos de `landing`,
   * 19.405 tienen curso y solo 1.086 compraron. Los 477 que entran por el webhook
   * de Cerberus tienen venta en el 100 % de los casos y curso en NINGUNO.
   *
   * Por eso una fila puede decir «Sí compró» con el curso vacío: son datos
   * distintos y se dibujan distinto.
   */
  curso: string | null;
  /** QUÉ COMPRÓ — el producto de su última venta. Los 4.783 compradores lo tienen. */
  comprado: string | null;
  fuente: string | null;
  creadoEn: string | null;
  /**
   * A QUIÉN ESTÁ ASIGNADO (ADR 0102): la grafía guardada en `contacto_habilitado`,
   * o `null` si no tiene dueña.
   *
   * ⚠️ **Ausente NO es `null`.** El server lo manda sólo a quien manda en el
   * equipo, y sólo si pudo leer el reparto. Ausente es «no se sabe» —una
   * vendedora, un server viejo, la tabla sin migrar— y la columna no se dibuja;
   * `null` es «se preguntó y no tiene dueña», y la celda dice «—».
   */
  asignadoA?: string | null;
}

export interface PaginaPadron {
  contactos: ContactoPadron[];
  /** El total del RECORTE — el número que se está por repartir, no el del padrón. */
  total: number;
  supervisor: boolean;
  porPagina: number;
  paginaActual: number;
  /** Nadie configurado como supervisor: nadie ve el padrón. Se dice, no se dibuja vacío. */
  sinSupervisores: boolean;
}

/**
 * Las cinco dimensiones multivalor. El orden es el de la pantalla, y el rótulo
 * vive con ellas: si mañana entra una sexta, se agrega acá y aparece sola.
 */
export const DIMENSIONES = [
  { id: 'pais', rotulo: 'País' },
  { id: 'curso', rotulo: 'Curso' },
  { id: 'etapa', rotulo: 'Etapa' },
  { id: 'nivel', rotulo: 'Nivel' },
  { id: 'fuente', rotulo: 'Fuente' },
] as const;

export type Dimension = (typeof DIMENSIONES)[number]['id'];

/**
 * Los filtros tal como viajan. Todos opcionales: lo ausente no recorta.
 *
 * Las dimensiones son LISTAS: OR adentro de cada una, AND entre ellas. Con un
 * valor por dimensión, «Perú o México» no se podía pedir en una sola pasada y el
 * supervisor perdía el total, que es el número con el que decide.
 */
export interface FiltrosPadron {
  q?: string;
  etapa?: string[];
  nivel?: string[];
  pais?: string[];
  curso?: string[];
  fuente?: string[];
  /**
   * A qué vendedora está asignado. NO es una de las cinco `DIMENSIONES`: esas
   * tienen conteo por opción porque `/api/padron/facetas` las calcula; para
   * ésta el server todavía no ofrece esa cuenta, así que el desplegable
   * («ListaVendedoras» en `PanelFiltros.tsx`) muestra nombres sin número al
   * lado, y no puede vivir en `FiltroFaceta` (que siempre pinta un conteo).
   */
  asignadoA?: string[];
  /**
   * Por qué línea de WhatsApp escribió («Ventas Meta», «Betto»…). Igual que
   * `asignadoA`, viaja como el NÚMERO (`OpcionLinea.valor`), nunca la
   * etiqueta — mandar «Ventas Meta» de vuelta no encuentra a nadie (#605).
   */
  entroPorLinea?: string[];
  /** `YYYY-MM-DD`, las DOS puntas inclusivas (lo fija un test del lado del server). */
  entroDesde?: string;
  entroHasta?: string;
  conVenta?: boolean;
  conTelefono?: boolean;
  sinHabilitar?: boolean;
  orden?: 'recientes' | 'antiguos' | 'mas_gastaron' | 'nombre';
  pagina?: number;
  porPagina?: number;
}

export function comoQuery(f: FiltrosPadron): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    // `false`, `''` y la lista vacía no se mandan: un filtro apagado es un filtro
    // AUSENTE. Mandar `conVenta=false` haría filtrar por lo contrario, y una lista
    // vacía leída como filtro significaría «ninguno» en vez de «cualquiera».
    if (v === undefined || v === null || v === '' || v === false) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      p.set(k, v.join(','));
      continue;
    }
    p.set(k, String(v));
  }
  return p.toString();
}

/** Cuántas cosas están recortando ahora — para el contador de «filtros activos». */
export function contarActivos(f: FiltrosPadron): number {
  let n = DIMENSIONES.reduce((s, d) => s + (f[d.id]?.length ?? 0), 0);
  n += f.asignadoA?.length ?? 0;
  if (f.entroDesde || f.entroHasta) n += 1;
  if (f.q?.trim()) n += 1;
  if (f.conVenta) n += 1;
  if (f.conTelefono) n += 1;
  if (f.sinHabilitar) n += 1;
  return n;
}

/** Prende o apaga un valor de una dimensión, sin mutar. */
export function alternar(actuales: string[] | undefined, valor: string): string[] {
  const previos = actuales ?? [];
  return previos.includes(valor) ? previos.filter((v) => v !== valor) : [...previos, valor];
}

/**
 * La página del padrón.
 *
 * `placeholderData` conserva la página anterior mientras llega la nueva: sin eso,
 * cada tecla del buscador vacía la tabla y la pantalla parpadea entre «no hay
 * nada» y los resultados — que es exactamente la lectura falsa que este frente
 * evita en todos lados.
 */
export function usePadron(filtros: FiltrosPadron) {
  return useQuery({
    queryKey: ['padron', filtros],
    queryFn: () => api<PaginaPadron>(`/api/padron/contactos?${comoQuery(filtros)}`),
    placeholderData: (previa) => previa,
    staleTime: 30_000,
  });
}

/**
 * `asignadoA` viaja APARTE de las 5 `DIMENSIONES`: no es `OpcionFaceta[]`
 * directo, porque «nadie todavía» no es un valor de `asignadoA` que se pueda
 * mandar de vuelta (buscaría a alguien con esa grafía y no encontraría a
 * nadie) — viaja como `sinRepartir`, un número aparte que se traduce a
 * `filtros.sinHabilitar`, no a `filtros.asignadoA`. Ver `opcionesDeReparto`
 * en `dominio/segmentosPadron.ts`.
 */
export interface FacetaReparto {
  opciones: OpcionFaceta[];
  sinRepartir: number;
}

export type Facetas = Record<Dimension, OpcionFaceta[]>;

/** Una línea de entrada (`entroPorLinea`). `valor` es el número crudo
 * (`"51984429504"`) — es lo que viaja de vuelta al filtrar, NUNCA `etiqueta`
 * (`"Ventas Meta"`, lo que se muestra). Mandar la etiqueta no encuentra a
 * nadie: el server ya se equivocó una vez así y lo corrigió (#605). */
export interface OpcionLinea {
  valor: string;
  etiqueta: string;
  contactos: number;
}

/**
 * LA RESPUESTA REAL DE `/api/padron/facetas` — TRES CLAVES HERMANAS, ninguna
 * anidada dentro de otra.
 *
 * 🔴 **Acá vivía el bug** (encontrado el 24-ago-2026, mientras se cableaba el
 * filtro de línea): el tipo viejo metía `asignadoA` ADENTRO de `Facetas`, pero
 * el server (`respuestaDeFacetas`, `server/src/routes/padron.ts`) arma
 * `{ facetas, asignadoA, entroPorLinea }` — tres hermanos. `data.facetas.asignadoA`
 * daba `undefined` SIEMPRE, y como `opcionesDeReparto` blinda con `if (!faceta)
 * return []`, la sección «Reparto» del panel se veía vacía en producción sin que
 * nada tirara error — la clase de bug que un tipo nunca atrapa, porque `api<T>()`
 * es un CAST, no una validación contra la respuesta real.
 *
 * ⚠️ **Para una vendedora, `asignadoA` y `entroPorLinea` llegan en `null`, no
 * ausentes** (`CAMPOS_SOLO_SUPERVISOR` en el server) — por eso `| null` y no
 * opcional en esos dos.
 */
export interface RespuestaFacetas {
  facetas: Facetas;
  asignadoA: FacetaReparto | null;
  /** No-opcional desde que #605 mergeó (24-ago-2026): el server SIEMPRE lo
   * manda, `null` para quien no es supervisor. */
  entroPorLinea: OpcionLinea[] | null;
}

/**
 * QUÉ SE PUEDE ELEGIR, con su conteo.
 *
 * ⚠️ **La queryKey ignora `pagina` a propósito.** Las facetas no dependen de la
 * página, así que pasar de la 3 a la 4 no tiene por qué disparar cinco `GROUP BY`
 * sobre 72.923 filas: con la página adentro de la clave, react-query las pediría
 * de nuevo en cada paso.
 */
export function useFacetas(filtros: FiltrosPadron, habilitado: boolean) {
  const { pagina: _pagina, porPagina: _porPagina, ...sinPaginar } = filtros;
  return useQuery({
    queryKey: ['padron-facetas', sinPaginar],
    queryFn: () => api<RespuestaFacetas>(`/api/padron/facetas?${comoQuery(sinPaginar)}`),
    enabled: habilitado,
    placeholderData: (previa) => previa,
    staleTime: 60_000,
  });
}

/**
 * Los tres interruptores. Antes cada uno estaba escrito a mano en 4 lugares
 * (la interfaz, `contarActivos`, el botón y «Limpiar todo») y agregar un cuarto
 * exigía acordarse de los 4. Con esto, uno de esos lugares —«Limpiar todo»— se
 * deriva solo; los otros tres quedan como estaban porque ya funcionan y tocarlos
 * sin necesidad sería el mismo riesgo que se está evitando acá.
 */
export const TOGGLES = [
  // «Sin asignar», el mismo nombre que la vista y que el panel (ADR 0102).
  { id: 'sinHabilitar', rotulo: 'Sin asignar' },
  { id: 'conVenta', rotulo: 'Con venta real' },
  { id: 'conTelefono', rotulo: 'Con teléfono' },
] as const satisfies { id: keyof FiltrosPadron; rotulo: string }[];

export interface CargaVendedora {
  vendedoraId: string;
  contactos: number;
}

interface RespuestaReparto {
  /** A quiénes se les puede habilitar. Lo arma el server: es la MISMA lista con
   * la que valida el POST — con dos, la app ofrecería a alguien que después rechaza. */
  destinos: string[];
  carga: CargaVendedora[];
}

/** Sólo responde para el supervisor; para el resto es un 403 y no se pregunta. */
export function useRepartoPadron(habilitado: boolean) {
  return useQuery({
    queryKey: ['padron-reparto'],
    queryFn: () => api<RespuestaReparto>('/api/padron/reparto'),
    enabled: habilitado,
    staleTime: 60_000,
    retry: false,
  });
}

export interface ConteoConDueno {
  total: number;
  /** Tiene ALGUNA dueña — se puede preguntar ANTES de elegir a quién repartir. */
  conDueno: number;
  /** Tiene una dueña DISTINTA de `vendedoraId` — solo viene si se lo mandaste. */
  deOtra?: number;
}

/**
 * CUÁNTOS DE LO ELEGIDO YA TIENEN DUEÑO — antes de repartir, no en el acuse de
 * después (regla dura #7: la cifra tiene que verse ANTES de la acción).
 *
 * ⚠️ **Sólo para modo `recorte`.** El body espeja el de `useHabilitarRecorte`
 * (`filtros` + `excluidos`), pensado para «todo el filtro menos estos» — no hay
 * una forma de preguntar por una lista de ids sueltos. En modo `lista` el
 * supervisor ya tildó cada fila a mano (como mucho unas pocas decenas, todas a
 * la vista): el riesgo del lote ciego que esto existe para atajar es
 * específicamente el de `recorte`, donde puede haber miles sin revisar una
 * por una.
 */
export function useContarConDueno(
  args: { filtros: FiltrosPadron; excluidos: number[]; vendedoraId?: string } | null,
) {
  return useQuery({
    queryKey: ['padron-conteo-dueno', args],
    queryFn: () =>
      api<ConteoConDueno>('/api/padron/contar-con-dueno', {
        method: 'POST',
        body: JSON.stringify({
          filtros: { ...args!.filtros, pagina: undefined, porPagina: undefined },
          excluidos: args!.excluidos,
          vendedoraId: args!.vendedoraId || undefined,
        }),
      }),
    enabled: args !== null,
    staleTime: 15_000,
  });
}

export function useHabilitar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { contactoIds: number[]; vendedoraId: string }) =>
      api<{ ok: true; habilitados: number; vendedoraId: string }>('/api/padron/habilitar', {
        method: 'POST',
        body: JSON.stringify(v),
      }),
    onSuccess: () => {
      // Las tres cambian: la lista (si se está filtrando por «sin habilitar»),
      // la carga, y lo que se puede deshacer — este reparto ES la nueva
      // «última tanda», y sin invalidar acá la tira de deshacer no se
      // enteraría hasta el próximo montaje de la pantalla.
      void qc.invalidateQueries({ queryKey: ['padron'] });
      void qc.invalidateQueries({ queryKey: ['padron-reparto'] });
      void qc.invalidateQueries({ queryKey: ['padron-ultima-tanda'] });
    },
  });
}

/**
 * REPARTIR TODO LO FILTRADO — viaja el recorte, no 17.014 ids.
 *
 * La lista pesaría ~700 KB en cada sentido para algo que el server resuelve con
 * una consulta. Y el recorte es lo que el supervisor quiso decir («todos los
 * peruanos con venta»); una lista de ids es su fotografía, y las dos dejan de
 * coincidir apenas entra un contacto nuevo.
 *
 * ⚠️ Por eso mismo el server puede habilitar un número distinto al que la
 * pantalla mostraba: devuelve **cuántos habilitó de verdad**, y eso es lo que se
 * muestra en el acuse.
 */
export function useHabilitarRecorte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { filtros: FiltrosPadron; excluidos: number[]; vendedoraId: string }) =>
      api<{ ok: true; habilitados: number; vendedoraId: string }>('/api/padron/habilitar-recorte', {
        method: 'POST',
        body: JSON.stringify({
          vendedoraId: v.vendedoraId,
          excluidos: v.excluidos,
          // Sin paginar: repartir «lo filtrado» no depende de en qué página estaba.
          filtros: { ...v.filtros, pagina: undefined, porPagina: undefined },
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['padron'] });
      void qc.invalidateQueries({ queryKey: ['padron-facetas'] });
      void qc.invalidateQueries({ queryKey: ['padron-reparto'] });
      void qc.invalidateQueries({ queryKey: ['padron-ultima-tanda'] });
    },
  });
}

export function useQuitarDelReparto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactoIds: number[]) =>
      api<{ ok: true; quitados: number }>('/api/padron/quitar', {
        method: 'POST',
        body: JSON.stringify({ contactoIds }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['padron'] });
      void qc.invalidateQueries({ queryKey: ['padron-reparto'] });
    },
  });
}

/**
 * EL DESHACER — la vista previa (`ultima-tanda`) y la acción, contra
 * `/api/padron/ultima-tanda` y `/api/padron/deshacer-ultima-tanda`.
 *
 * ⚠️ **Solo repartir es deshacible, `quitar` no** (el server no guarda quién
 * ejecutó un quitar — deuda de seguimiento, no de este front). Nada acá lo
 * fuerza a mano: la tanda que el server reporte es la que hay, y si `quitar`
 * nunca la genera, esto simplemente nunca se ofrece después de uno.
 *
 * 🔴 **Un `total` sin nada adentro NO es lo mismo que no haber nada que
 * deshacer.** Si a los 470 de la última tanda los movió alguien más antes de
 * que el supervisor llegara a apretar «Deshacer», la respuesta es 200 con
 * `restaurados: 0`, `devueltos: 0` y `omitidosPorCambioPosterior: 470` — hubo
 * tanda, pero no queda nada que revertir. Es un mensaje distinto de «no hubo
 * tanda» (`hayTanda: false`) y de «se deshizo algo» (`restaurados`/`devueltos`
 * > 0): quien lo consuma tiene que distinguir los tres, no aplanarlos a uno.
 */
export interface UltimaTanda {
  hayTanda: boolean;
  cuando?: string;
  total?: number;
  restaurados?: number;
  devueltos?: number;
  omitidosPorCambioPosterior?: number;
}

/**
 * El preview, consultado al montar — es lo que convierte el deshacer en una
 * red PERMANENTE en vez de un botón que caduca a los 8 segundos: no hay
 * ventana de tiempo del lado del cliente, hay una pregunta que se repite cada
 * vez que la pantalla se abre.
 */
export function useUltimaTanda(habilitado: boolean) {
  return useQuery({
    queryKey: ['padron-ultima-tanda'],
    queryFn: () => api<UltimaTanda>('/api/padron/ultima-tanda'),
    enabled: habilitado,
    staleTime: 15_000,
  });
}

export interface ResultadoDeshacer {
  ok: true;
  cuando: string;
  restaurados: number;
  devueltos: number;
  omitidosPorCambioPosterior: number;
}

/**
 * ⚠️ **El 404 `nada_que_deshacer` es angosto a propósito: solo sale si quien
 * llama JAMÁS repartió.** Repartir y que todo se lo hayan pisado después NO
 * es este caso — es un 200 con ceros (ver el docblock de `UltimaTanda`). Quien
 * llama a esta mutación no necesita distinguir el 404 del resto: la tira que
 * lo ofrece ya sabía, por el preview, que había algo — un 404 acá es una
 * carrera (otra pestaña, doble clic) y se trata igual que «ya no hay nada»,
 * no como un error para mostrar en rojo.
 */
export function useDeshacerUltimaTanda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<ResultadoDeshacer>('/api/padron/deshacer-ultima-tanda', { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['padron'] });
      void qc.invalidateQueries({ queryKey: ['padron-facetas'] });
      void qc.invalidateQueries({ queryKey: ['padron-reparto'] });
    },
    // `onSettled`, no `onSuccess`: un 404 (carrera — otra pestaña, doble clic)
    // deja el preview VIEJO diciendo que todavía hay algo, y la tira seguiría
    // ofreciendo deshacer lo que ya no existe. Éxito o error, se vuelve a
    // preguntar — tampoco hay «rehacer» apretando de nuevo: el candado de
    // concurrencia del server hace que una segunda llamada sea un no-op
    // seguro, pero la UI tiene que dejar de ofrecerla igual.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['padron-ultima-tanda'] });
    },
  });
}

/**
 * El nombre corto de una vendedora: `ventas10@grupogoberna.com` → `Ventas10`.
 *
 * Los `vendedora_id` nuevos son el correo completo (verificado en el panel de
 * Cerberus el 4-ago: el usuario se llama así y no tiene email registrado) y los
 * viejos son cortos (`luz`, `alan`). Es la misma regla que `canales/dueno.ts`.
 */
export function nombreCorto(vendedoraId: string): string {
  const base = vendedoraId.split('@')[0] ?? vendedoraId;
  return base.charAt(0).toUpperCase() + base.slice(1);
}
