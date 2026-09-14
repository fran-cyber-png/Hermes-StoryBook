import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi } from '../../lib/datos/cliente';
import type { ParteDeReparto } from './repartoDeAnuncio';

/**
 * ROUTING, DEL LADO DE LA APP — qué campaña de Meta cae en qué vendedora.
 *
 * Contra `/api/routing` (`server/src/routes/routing.ts`). Acá no se decide nada:
 * el estado de la campaña, el orden de la lista y a quién SE PUEDE elegir los
 * arma el server, que es el mismo que después valida el `PUT`. Con dos cabezas,
 * la pantalla ofrecería un nombre que el server rechaza con 409 (#37).
 */

export type EstadoCampana = 'activa' | 'pausada' | 'desconocido';

/** Cómo se resolvió el producto de una pieza. Ver `CampanaEnRouting.origenFamilia`. */
export type OrigenFamilia = 'manual' | 'sku' | 'alias';

export interface CampanaEnRouting {
  campanaId: string;
  nombre: string;
  estado: EstadoCampana;
  /** Cuántos anuncios suyos trajeron gente en la ventana. */
  anuncios: number;
  /** Cuántas PERSONAS escribieron por ella (no cuántos mensajes). */
  personas: number;
  ultima: string | null;
  /** Su producto, o `null`. Medido el 18-ago-2026: resuelven 83 de 153. */
  familia: string | null;
  /**
   * 🔴 **DE DÓNDE SALIÓ ESE PRODUCTO — y sin esto la hoja no puede explicar nada.**
   * `manual` lo decidió una persona · `sku` lo AFIRMA el código que la pauta
   * escribió en el nombre · `alias` es una adivinanza por palabras, y es la
   * única de las tres que puede estar mal.
   * ⚠️ **Opcional**: ausente = server viejo o caché de IndexedDB (ADR 0007), y
   * ahí la hoja se calla en vez de inventar un porqué.
   */
  origenFamilia?: OrigenFamilia;
  /** Qué alias enganchó, cuando fue por texto. Es lo que se muestra entre comillas. */
  aliasFamilia?: string;
  /** LOS CABLES: a quiénes les puede caer. Vacío = a la rueda del reparto. */
  vendedoras: string[];
  /**
   * Cuántos de sus anuncios reparten aparte, con su propio reparto (#1002). Con
   * uno o más, los cables de arriba no deciden los leads de esos anuncios.
   * ⚠️ Opcional: un server anterior o el caché de IndexedDB no lo traen = 0.
   */
  anunciosConReparto?: number;
}

/**
 * UN CURSO DE FORMULARIO — la otra fuente de leads, y la que más volumen trae:
 * medido el 12-ago-2026, **178 leads en 30 días contra 33 de la campaña activa**.
 */
export interface CursoEnRouting {
  curso: string;
  /** Su producto, o `null` si no resuelve a ninguno. */
  familia: string | null;
  /** De dónde salió. Ver `CampanaEnRouting.origenFamilia`. */
  origenFamilia?: OrigenFamilia;
  /** Qué alias enganchó, cuando fue por texto. */
  aliasFamilia?: string;
  leads: number;
  ultimo: string | null;
  /** Vacío = lo ve todo el equipo, como hasta ahora. */
  vendedoras: string[];
}

/** Un producto: lo que junta varias campañas con sus formularios. */
export interface ProductoEnRouting {
  familia: string;
  nombre: string;
}

export interface FotoDeRouting {
  linea: string;
  etiqueta: string | null;
  ventanaDias: number;
  campanas: CampanaEnRouting[];
  /** Los cursos que llegan por los formularios de icarus. */
  cursos: CursoEnRouting[];
  /** El catálogo de productos, con su nombre comercial. Lo arma el server. */
  productos: ProductoEnRouting[];
  /** Anuncios que trajeron gente y todavía no se resolvieron contra Meta. */
  anunciosSinResolver: number;
  /**
   * Campañas de la cuenta que mandan a WhatsApp pero **no a esta línea**. No se
   * listan porque no se pueden cablear, pero se MUESTRAN como número: medido el
   * 12-ago-2026, dieciséis de diecisiete adsets activos mandan a otro teléfono,
   * y esconderlo haría que la pantalla afirme «estas son todas las campañas».
   */
  campanasEnOtraLinea: number;
  actualizadoAt: string | null;
  sinMigracion: boolean;
  destinos: string[];
  /**
   * 🔴 **QUIÉNES SE FUERON — y por qué siguen en `destinos`.**
   *
   * Sacarlos de la lista haría desaparecer de la pantalla los cables que YA
   * apuntan a esa persona, así que nadie podría verlos para cortarlos: Tracy
   * tenía tres en `curso_ruteo` y se llevaba ~32 leads al mes. Se MARCAN, no se
   * esconden — el problema a la vista es el que se puede arreglar.
   *
   * ⚠️ **Es baja en `equipo`, NO pausa en la rueda.** Una pausa operativa no
   * apaga los cables de nadie (ADR 0073); haberse ido sí.
   *
   * ⚠️ Opcional: ausente = server viejo o respuesta rehidratada del caché
   * (ADR 0007). Sin el dato no se marca a nadie, que es mejor que marcar mal.
   */
  deBaja?: string[];
}

/**
 * La foto. `retry: false` porque los dos fallos que importan son de
 * configuración, no de red: sin línea de Cloud API (503 `sin_linea_cloud_api`) y
 * sin migración. Reintentar no arregla ninguno y solo demora el cartel.
 */
export function useRouting() {
  return useQuery<FotoDeRouting, ErrorApi>({
    queryKey: ['routing'],
    queryFn: () => api<FotoDeRouting>('/api/routing'),
    retry: false,
  });
}

/**
 * DEJAR LOS CABLES DE UNA CAMPAÑA. Viaja el conjunto COMPLETO, no un cable:
 * con `conectar`/`desconectar` sueltos, dos personas editando la misma campaña
 * se pisan y la última cree que sumó uno cuando en realidad borró el de la otra.
 * `vendedoras: []` corta todos y la campaña vuelve a la rueda.
 *
 * ⚠️ **No es optimista, a propósito.** El destino lo VERIFICA el server y un
 * desconocido vuelve 409: pintar el cambio antes de la respuesta mostraría la
 * campaña ya asignada y la revertiría medio segundo después. Acá lo que se
 * decide es a quién le caen los leads de mañana; se espera el sí.
 */
/**
 * DEJAR LOS CABLES DE UN CURSO. El curso viaja en el body y no en la URL: son
 * nombres de producto con espacios, tildes y `&`, y en el path quedan a merced
 * de cualquier proxy que normalice por su cuenta.
 */
/**
 * CABLEAR UN PRODUCTO ENTERO. **Escribe el cable en cada una de sus campañas y
 * formularios**; no crea una regla que los demás hereden. Por eso el acuse dice
 * cuántos tocó: «listo» sobre cinco renglones y sobre cero se ven igual.
 */
export function useConectarProducto() {
  const qc = useQueryClient();
  return useMutation({
    /**
     * ⚠️ **`modo` decide si el gesto es destructivo, y el default NO lo es por
     * accidente**: `reemplazar` es el del botón «Poner este cable en las N»,
     * que dice qué va a pisar. El arrastre manda `agregar`/`quitar` — ver
     * `ModoDeCableado` en el server.
     */
    mutationFn: ({
      familia,
      vendedoras,
      modo,
    }: {
      familia: string;
      vendedoras: string[];
      modo?: 'reemplazar' | 'agregar' | 'quitar';
    }) =>
      api<{ campanas: number; cursos: number }>('/api/routing/productos', {
        method: 'PUT',
        body: JSON.stringify({ familia, vendedoras, modo: modo ?? 'reemplazar' }),
      }),
    /**
     * 🔴 **`onSettled` y NO `onSuccess`: un rechazo TIENE que traer la foto de
     * vuelta.** El cable se dibuja con el gesto (antes de que el server
     * conteste), y quien lo revierte es el refetch. Con `onSuccess`, un `409`
     * —destino que no está en la rueda, que es el rechazo más probable acá— no
     * invalidaba nada: quedaba el cable dibujado sobre una regla que no existe,
     * y la franja roja de abajo no alcanza porque lo que la persona mira es el
     * cable.
     */
    onSettled: () => qc.invalidateQueries({ queryKey: ['routing'] }),
  });
}

export function useConectarCurso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ curso, vendedoras }: { curso: string; vendedoras: string[] }) =>
      api('/api/routing/cursos', { method: 'PUT', body: JSON.stringify({ curso, vendedoras }) }),
    /**
     * 🔴 **`onSettled` y NO `onSuccess`: un rechazo TIENE que traer la foto de
     * vuelta.** El cable se dibuja con el gesto (antes de que el server
     * conteste), y quien lo revierte es el refetch. Con `onSuccess`, un `409`
     * —destino que no está en la rueda, que es el rechazo más probable acá— no
     * invalidaba nada: quedaba el cable dibujado sobre una regla que no existe,
     * y la franja roja de abajo no alcanza porque lo que la persona mira es el
     * cable.
     */
    onSettled: () => qc.invalidateQueries({ queryKey: ['routing'] }),
  });
}

export function useConectar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ campanaId, vendedoras }: { campanaId: string; vendedoras: string[] }) =>
      api(`/api/routing/campanas/${encodeURIComponent(campanaId)}`, {
        method: 'PUT',
        body: JSON.stringify({ vendedoras }),
      }),
    /**
     * 🔴 **`onSettled` y NO `onSuccess`: un rechazo TIENE que traer la foto de
     * vuelta.** El cable se dibuja con el gesto (antes de que el server
     * conteste), y quien lo revierte es el refetch. Con `onSuccess`, un `409`
     * —destino que no está en la rueda, que es el rechazo más probable acá— no
     * invalidaba nada: quedaba el cable dibujado sobre una regla que no existe,
     * y la franja roja de abajo no alcanza porque lo que la persona mira es el
     * cable.
     */
    onSettled: () => qc.invalidateQueries({ queryKey: ['routing'] }),
  });
}

export interface Refresco {
  /** Cuántas campañas trajo el catálogo de Meta. */
  campanas: number;
  preguntados: number;
  resueltos: number;
  fallaron: string[];
}

/** Preguntarle a Meta de qué campaña es cada anuncio nuevo. */
export function useRefrescarDesdeMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<Refresco>('/api/routing/refrescar', { method: 'POST' }),
    /**
     * 🔴 **`onSettled` y NO `onSuccess`: un rechazo TIENE que traer la foto de
     * vuelta.** El cable se dibuja con el gesto (antes de que el server
     * conteste), y quien lo revierte es el refetch. Con `onSuccess`, un `409`
     * —destino que no está en la rueda, que es el rechazo más probable acá— no
     * invalidaba nada: quedaba el cable dibujado sobre una regla que no existe,
     * y la franja roja de abajo no alcanza porque lo que la persona mira es el
     * cable.
     */
    onSettled: () => qc.invalidateQueries({ queryKey: ['routing'] }),
  });
}

/**
 * Cómo se dice cada estado. Vive acá y no adentro del JSX para poder
 * interrogarla sobre el valor que todavía no existe: un estado nuevo de Meta
 * cae en «no se sabe» y lo dice, nunca en «pausada» ni en un throw.
 */
/** Un anuncio de una campaña, con lo que trajo y su reparto propio si lo tiene (#1002). */
export interface AnuncioDeCampana {
  adId: string;
  titular: string | null;
  personas: number;
  ultima: string | null;
  /**
   * Su regla en porcentajes (suman 100). `[]` = no tiene: sus leads los decide
   * la regla de la campaña.
   *
   * ⚠️ Opcional porque un server anterior a #1002 no lo manda: ausente se lee
   * como `[]`, que es exactamente lo que ese server hace con el anuncio.
   */
  reparto?: ParteDeReparto[];
}

/**
 * REPARTIR UN ANUNCIO EN PORCENTAJES (#1002). Viaja el conjunto COMPLETO.
 *
 * Misma forma que `PUT /campanas/:id`: con altas y bajas sueltas, dos
 * supervisores editando el mismo anuncio se pisan. `reparto: []` le quita la
 * regla y sus leads vuelven a la de la campaña.
 */
export function usePonerRepartoDeAnuncio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { adId: string; reparto: ParteDeReparto[] }) =>
      api<{ ok: true; adId: string; reparto: ParteDeReparto[]; cambio: boolean }>(
        `/api/routing/anuncios/${encodeURIComponent(v.adId)}`,
        { method: 'PUT', body: JSON.stringify({ reparto: v.reparto }) },
      ),
    // ⚠️ `['routing']` entero: la lista de anuncios trae el reparto, y el
    // monitoreo empieza a contar «por el anuncio» desde el próximo lead.
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['routing'] });
    },
  });
}

/**
 * LOS ANUNCIOS DE UNA CAMPAÑA — se piden solo al entrar en ella.
 *
 * ⚠️ `enabled` y no un `if` afuera: sin campaña elegida no hay nada que pedir, y
 * react-query no puede tener un hook condicional.
 */
export function useAnunciosDeCampana(campanaId: string | null) {
  return useQuery<{ anuncios: AnuncioDeCampana[] }, ErrorApi>({
    queryKey: ['routing', 'anuncios', campanaId],
    queryFn: () =>
      api(`/api/routing/campanas/${encodeURIComponent(campanaId!)}/anuncios`),
    enabled: Boolean(campanaId),
    retry: false,
  });
}

/** Un producto al que se puede mandar una pieza. */
export interface FamiliaElegible {
  familia: string;
  nombre: string;
  /** `true` si Hermes ya sabe nombrarlo (tiene aliases). Los demás vienen de Cerberus. */
  conocida: boolean;
}

/**
 * LOS PRODUCTOS A LOS QUE SE PUEDE MANDAR UNA PIEZA.
 *
 * ⚠️ **`enabled` y no una llamada suelta**: pregunta a Cerberus, y esa espera no
 * puede colgarse de la pantalla que hay que abrir justo cuando algo anda mal. Se
 * pide al abrir la hoja, que es cuando alguien va a elegir.
 *
 * ⚠️ **`catalogoCaido` no es un error**: la lista viene con lo que Hermes ya sabe
 * nombrar y la hoja lo DICE. Una pantalla de configuración que no abre porque el
 * ERP está lento es peor que una lista incompleta que avisa.
 */
export function useProductosElegibles(abierta: boolean) {
  return useQuery<{ familias: FamiliaElegible[]; catalogoCaido: boolean }, ErrorApi>({
    queryKey: ['routing', 'productos-elegibles'],
    queryFn: () => api('/api/routing/productos-elegibles'),
    enabled: abierta,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/**
 * CORREGIR A QUÉ PRODUCTO PERTENECE UNA PIEZA. `familia: null` deshace.
 *
 * ⚠️ **No es optimista, y acá menos que en ningún lado**: esto reescribe el
 * diccionario que también leen la cola, el Dashboard y el bot. Pintar el cambio
 * antes del sí mostraría la pieza mudada de producto y la revertiría medio
 * segundo después.
 *
 * 🔴 **Invalida `['routing']` Y `['conversaciones']`**: el chip de curso de la
 * cola sale del MISMO diccionario, así que sin esa segunda invalidación la
 * corrección se ve acá y la otra pantalla sigue mostrando el producto viejo
 * hasta que alguien recargue — que es justo la confusión que este frente viene a
 * cerrar.
 */
export function useCorregirProducto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { tipo: 'campana' | 'curso'; clave: string; familia: string | null }) =>
      api<{ ok: true; texto: string; familia: string | null; nombreCurso: string | null }>(
        '/api/routing/pieza-producto',
        { method: 'PUT', body: JSON.stringify(v) },
      ),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['routing'] });
      qc.invalidateQueries({ queryKey: ['conversaciones'] });
    },
  });
}

/**
 * POR QUÉ ESTA PIEZA ESTÁ EN ESTE PRODUCTO, en criollo.
 *
 * Vive fuera del JSX y es pura para poder interrogarla sobre el valor que
 * todavía no existe: un origen desconocido cae en el texto conservador, nunca en
 * un throw ni en «lo decidió alguien» (la regla de `presentacion.ts` de Ivi).
 */
export function porQueEsteProducto(
  origen: OrigenFamilia | undefined,
  alias: string | undefined,
): { texto: string; sospechoso: boolean } | null {
  if (!origen) return null;
  if (origen === 'manual') return { texto: 'Lo decidió alguien del equipo', sospechoso: false };
  if (origen === 'sku') return { texto: 'Lo dice el código del nombre', sospechoso: false };
  return {
    // El ÚNICO de los tres que puede estar mal: es una coincidencia de palabras.
    texto: alias ? `Coincidió con «${alias}»` : 'Coincidió con una palabra del nombre',
    sospechoso: true,
  };
}

export function rotuloEstado(estado: EstadoCampana): string {
  switch (estado) {
    case 'activa':
      return 'Activa';
    case 'pausada':
      return 'Pausada';
    default:
      return 'No se sabe';
  }
}

/**
 * Cuánto hace que llegó alguien por esta campaña, en criollo. `null` cuando no
 * llegó nadie — que no es «hace mucho», es que no hay nada que contar.
 */
export function haceCuanto(iso: string | null, ahora = Date.now()): string | null {
  if (!iso) return null;
  const ms = ahora - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const dias = Math.floor(ms / 86_400_000);
  if (dias >= 1) return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  const horas = Math.floor(ms / 3_600_000);
  if (horas >= 1) return `hace ${horas} h`;
  return 'recién';
}

/* ───────────────────────── EL TABLERO Y EL HISTORIAL ────────────────────── */

/** Una división del catálogo de Cerberus, con lo que ya está cableado. */
export interface DivisionRuteable {
  division: string;
  nombre: string;
  familias: number;
  productos: number;
  vendedoras: string[];
}

/** Una familia de SKU. `EPCOORP004..009` son una sola: seis cohortes del mismo curso. */
export interface FamiliaRuteable {
  familia: string;
  nombre: string;
  division: string;
  divisionNombre: string;
  productos: number;
  vendedoras: string[];
}

/** Cuántas conversaciones cayeron por cada motivo, y en quién. */
export interface LoQueCayo {
  motivo: string;
  vendedoraId: string;
  conversaciones: number;
  ultima: string | null;
}

export interface TableroDeRuteo {
  divisiones: DivisionRuteable[];
  familias: FamiliaRuteable[];
  cayo: LoQueCayo[];
  actualizadoAt: string | null;
  ventanaDias?: number;
  /**
   * 🔴 **La respuesta viene RECORTADA a quien pregunta.** Quien no manda en el
   * equipo ve sólo lo suyo, y la pantalla tiene que DECIRLO: un desglose de una
   * fila sin explicación se lee como «casi no está cayendo nada», que es una
   * afirmación sobre el negocio y no sobre un permiso.
   */
  recortado?: boolean;
  sinMigracion?: boolean;
}

/**
 * EL CATÁLOGO RUTEABLE Y LO QUE CAYÓ.
 *
 * ⚠️ **Clave propia (`['routing','tablero']`) y no una rama de `['routing']`**:
 * son dos consultas con dos ritmos. La foto de `/` depende de Meta y cambia
 * cuando alguien refresca; el tablero cambia cada vez que cae un lead. Con una
 * sola clave, un lead entrante refrescaría también la parte cara.
 */
export function useTableroDeRuteo() {
  return useQuery<TableroDeRuteo, ErrorApi>({
    queryKey: ['routing', 'tablero'],
    queryFn: () => api<TableroDeRuteo>('/api/routing/tablero'),
    retry: false,
  });
}

/** Una decisión de ruteo, tal como quedó anotada. */
export interface FilaDeHistorial {
  id: number;
  vendedoraId: string;
  motivo: string;
  /** El eje de la regla que decidió. `''` = no hubo regla (la rueda). */
  eje: string;
  regla: string;
  /** `alta` (lead nuevo) · `revencida` (volvió al circuito) · `manual`. */
  tipo: string;
  decididaPor: string | null;
  ocurrioEn: string;
}

export interface HistorialDeRuteo {
  filas: FilaDeHistorial[];
  recortado?: boolean;
  sinMigracion?: boolean;
}

/**
 * EL HISTORIAL — qué pasó y cuándo.
 *
 * ⚠️ **No trae la conversación ni el teléfono, a propósito**: la clave lleva el
 * teléfono del lead adentro y ADR 0059 recorta ese dato en tiempo real. Este
 * historial contesta «cómo se está repartiendo», no «quién escribió».
 */
export function useHistorialDeRuteo(activo: boolean) {
  return useQuery<HistorialDeRuteo, ErrorApi>({
    queryKey: ['routing', 'historial'],
    queryFn: () => api<HistorialDeRuteo>('/api/routing/historial?limite=50'),
    // Sólo se pide cuando alguien lo abre: es el detalle, no la portada.
    enabled: activo,
    retry: false,
  });
}

/**
 * CABLEAR UNA DIVISIÓN O UNA FAMILIA. Viaja el conjunto COMPLETO.
 *
 * Con `conectar`/`desconectar` sueltos, dos supervisores editando la misma regla
 * se pisan y el último cree que sumó uno cuando en realidad borró el del otro.
 * Es la misma forma que `PUT /campanas/:id`.
 */
export function usePonerRegla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { eje: 'familia' | 'division'; clave: string; vendedoras: string[] }) =>
      api<{ ok: true; eje: string; clave: string; vendedoras: string[] }>('/api/routing/reglas', {
        method: 'PUT',
        body: JSON.stringify(v),
      }),
    /**
     * ⚠️ **Se invalidan las DOS claves.** El tablero tiene los cables y la foto
     * de `/` tiene los productos: si sólo se refrescara una, un 409 dejaría el
     * cable dibujado sobre una regla que el server rechazó.
     */
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['routing'] });
    },
  });
}

/**
 * POR QUÉ LE CAYÓ A ÉSA — el `motivo` traducido a algo que se pueda leer.
 *
 * 🔴 **Vive sólo acá, y eso es deliberado.** Es un texto de PANTALLA: ninguna
 * decisión del server depende de él. Tenerlo también en `routing/cascada.ts`
 * sería la misma regla escrita dos veces sin nadie que las cruce — la cicatriz
 * #37 del repo — para no ganar nada.
 *
 * ⚠️ **Un motivo DESCONOCIDO se dice desconocido, jamás se mapea al más
 * parecido.** En producción hay 3.577 filas con `manual` y 25 con
 * `historico-campana`: llamarlas «por la rueda» sería afirmar que las repartió
 * el reparto, que es justo la pregunta que el motivo vino a contestar.
 */
export function explicarMotivo(motivo: string | null | undefined): string {
  switch ((motivo ?? '').trim()) {
    case 'anuncio':
      return 'por el anuncio';
    case 'campana':
      return 'por la campaña';
    case 'producto':
      return 'por el producto';
    case 'division':
      return 'por la división';
    case 'linea':
      return 'por la línea';
    case 'round-robin':
      return 'por la rueda';
    case 'manual':
      return 'a mano';
    default:
      return 'no se sabe';
  }
}
