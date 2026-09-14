import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/datos/cliente';
import { bloquesDeTexto } from './bloques';

/**
 * NOTAS — el «Notion» a una tecla (issue #47). Datos y reglas de orden/atajo;
 * la UI vive en `PanelNotas.tsx`. Ancladas a una conversación (`clave` de la
 * cola) o a `'general'` (la libreta personal, tecla «n» — `App.tsx`).
 *
 * A propósito NO entran a `PERSISTIBLES` (`src/lib/datos/persistencia.ts`): una
 * nota «paga el viernes» rehidratada como actual desde IndexedDB es peor que un
 * spinner. El queryKey `['notas', clave]` queda fuera de la lista blanca.
 */

/**
 * EL TOPE DE UNA PÁGINA — **copia del server**, no la fuente de verdad.
 *
 * Acá solo se usa para redactar el fallo cuando el server no explicó por qué
 * rechazó (`guardado.ts`). La garantía es el 400 de `validarTexto`.
 *
 * ⚠️ **Y por eso hay un test de paridad que lee el archivo del server**
 * (`limiteTexto.paridad.test.ts`): con el número en dos lados, el día que uno
 * cambie el otro sigue diciendo el viejo y la pantalla afirma «pasa de los 2.000»
 * sobre un server que acepta 20.000. Es #37 en su forma más barata de introducir
 * y más difícil de notar, porque el mensaje **suena** correcto.
 */
export const LIMITE_TEXTO = 20_000;

/**
 * EL TOPE DE FIJADAS POR APARTADO (04-sep-2026, ADR 0093) — misma advertencia
 * que `LIMITE_TEXTO`: **copia del server** (`MAX_FIJADAS_POR_APARTADO`,
 * `server/src/notas/notas.ts`), no la fuente de verdad. Solo se usa para
 * redactar el aviso cuando el 409 de `editarNota` llega — la garantía real es
 * el rechazo del server, con su `pg_advisory_xact_lock` contando de verdad.
 */
export const MAX_FIJADAS_POR_APARTADO = 5;

/** Quién puede abrir un link (ADR 0048). Copia del server; ver `linkModelo.ts`. */
export type Alcance = 'publico' | 'goberna';
/** Qué puede hacer quien lo abre. `editar` NUNCA se combina con `publico`. */
export type Permiso = 'ver' | 'editar';

export interface Nota {
  id: number;
  clave: string;
  vendedoraId: string;
  /**
   * El texto plano. Cuando hay `doc`, es lo que el SERVER derivó de él — nunca
   * se manda desde acá: el navegador no calcula derivados (ver el server,
   * `notas/textoPlano.ts`). Se usa para la lista, la búsqueda y el preview.
   */
  texto: string;
  /**
   * El documento rico de BlockNote. `null` en toda nota escrita antes de la
   * Libreta, y en TODA histórica de `gestiones` — que se pintan desde `texto`.
   */
  doc: unknown;
  /**
   * LA CAPA DE ANOTACIONES a mano que va ENCIMA del texto (`dibujo/figuras.ts`).
   * `null` en toda página que nunca se anotó — que son todas las que existen
   * antes de esta función, y toda histórica de `gestiones`.
   */
  anotaciones?: unknown;
  /**
   * ORDENA la página primero en su apartado — máximo 5 a la vez, cada
   * apartado (la libreta privada, cada espacio) con su propio tope
   * (`MAX_FIJADAS_POR_APARTADO` en el server). Ya NO decide si aparece en
   * Favoritos: eso es `favorita`, un campo aparte (04-sep-2026, ADR 0093).
   */
  fijada: boolean;
  /**
   * ENTRA A «FAVORITOS» (04-sep-2026, ADR 0093) — cruza TODOS los apartados
   * (la libreta privada Y cada espacio del que la vendedora es miembro), y no
   * tiene tope: es una marca personal, no un orden. Independiente de `fijada`.
   *
   * ⚠️ Opcional en la lectura, igual que `espacioId`: un server viejo no lo
   * manda y la ausencia es `false` — nunca al revés.
   */
  favorita?: boolean;
  creadoAt: string;
  /** null = nunca editada. */
  editadoAt: string | null;
  /**
   * null = viva. Archivar es soft-delete.
   *
   * ⚠️ Ya no es el único destino final (03-sep-2026, Papelera): desde ahí,
   * "Eliminar para siempre" SÍ borra la fila de verdad — `eliminarParaSiempre`
   * en `useMutacionesNotas`, y siempre sobre algo que ya pasó por acá.
   */
  archivadoAt: string | null;
  /**
   * 'nota' = editable, de la tabla `notas`. 'gestion' = HISTÓRICA — el texto
   * que quedó en `gestiones.notas` antes de #47 (el viejo textarea de
   * `RegistrarGestion`), solo lectura: no tiene PATCH posible (ver ADR 0012).
   * `id` de una histórica es el id de esa fila de `gestiones`, no de `notas`.
   */
  origen: 'nota' | 'gestion';
  /**
   * DÓNDE VIVE (ADR 0046). `null` = la libreta privada de su autora.
   *
   * ⚠️ Se lee como **opcional**: un server viejo no lo manda, y la ausencia
   * significa lo mismo que `null` (la libreta de siempre). Nunca al revés.
   */
  espacioId?: number | null;
  /**
   * El token del link público, o `null`/ausente si NO está compartida (ADR 0047).
   *
   * ⚠️ **Opcional, y la ausencia se lee como «no compartida»** — nunca como «no
   * se sabe». Con un server viejo eso es exactamente correcto: si el server no
   * conoce los links, no hay ninguno. Al revés (dibujar «compartida» ante la
   * duda) sería alarmar sobre algo que no pasó.
   */
  token?: string | null;
  /** Quién puede abrir el link, si tiene (ADR 0048). Ausente = no tiene. */
  alcance?: Alcance | null;
  /** Qué puede hacer quien lo abre. */
  permiso?: Permiso | null;
  /** `null` = no vence. */
  venceAt?: string | null;
  /** `null` = nunca lo abrió nadie — la respuesta más útil. */
  ultimoAccesoAt?: string | null;
  /**
   * PANTALLA DIVIDIDA (17-ago-2026): con qué otra página se ve al lado, a la
   * derecha. `null`/ausente = pantalla simple.
   *
   * ⚠️ UNIDIRECCIONAL: es la contraparte que ESTA página eligió, no una
   * relación simétrica — abrir la otra no trae a ésta de vuelta salvo que
   * ELLA también apunte para acá. Y es UNA SOLA: dividir de nuevo reemplaza,
   * nunca agrega una segunda.
   */
  paginaDivididaId?: number | null;
  /**
   * `'texto'` (BlockNote, el de siempre) o `'archivo'` (un PDF/Word/txt
   * adjuntado, 26-ago-2026). Ausente se lee como `'texto'`: un server viejo
   * no lo manda, y toda fila de antes de este frente ES texto.
   */
  tipo?: 'texto' | 'archivo';
  /** El documento adjuntado, o `null`/ausente si `tipo !== 'archivo'`. */
  archivo?: { archivo: string; nombreOriginal: string; mime: string; bytes: number } | null;
}

/**
 * Fijada primero, luego más nueva primero — espejo del `ORDER BY` del server
 * (`notas/notas.ts` en el server). Se re-aplica acá porque una edición local
 * (fijar/desfijar) puede llegar antes que la invalidación del query.
 */
export function ordenarNotas(notas: Nota[]): Nota[] {
  return [...notas].sort((a, b) => {
    if (a.fijada !== b.fijada) return a.fijada ? -1 : 1;
    return new Date(b.creadoAt).getTime() - new Date(a.creadoAt).getTime();
  });
}

/**
 * ¿La tecla que llegó es el atajo de la libreta? Puro — sin `preventDefault` ni
 * lectura del DOM: eso lo decide `App.tsx`, que además guarda con `tecleandoEn`
 * (ningún atajo global pisa un input). Los acordes con modificador NO son este
 * atajo (⌘N, Ctrl+N son del sistema operativo/navegador).
 */
export function esAtajoLibreta(e: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }): boolean {
  return e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey;
}

/**
 * Las páginas de un lugar: mi libreta privada (`espacioId === null`) o un espacio.
 *
 * 🔴 **EL `espacioId` VA EN LA `queryKey`, Y NO ES OPCIONAL.** Sin él, las dos
 * listas comparten entrada de caché: cambias de espacio y ves durante un
 * instante —o hasta que resuelva el refetch— las páginas del anterior, bajo el
 * nombre del nuevo. No es un parpadeo cosmético: en un frente cuyo punto entero
 * es quién ve qué, se lee como que el espacio tiene contenido que no tiene.
 */
export function useNotas(clave: string, espacioId: number | null = null, activo = true) {
  return useQuery({
    queryKey: ['notas', clave, espacioId],
    queryFn: () =>
      api<{ notas: Nota[] }>(
        `/api/notas?clave=${encodeURIComponent(clave)}${espacioId === null ? '' : `&espacio=${espacioId}`}`,
      ),
    select: (d) => ordenarNotas(d.notas),
    enabled: activo && Boolean(clave),
  });
}

/**
 * LA PAPELERA (03-sep-2026) — SIEMPRE de la libreta privada, nunca de un
 * espacio: "MI LIBRETA" en la barra lateral lleva "solo tú", y esa etiqueta
 * también describe a esta vista. Mismo molde que `useNotas`, pero pidiendo
 * `archivadas=1` en vez de `espacio` — el server rechaza la combinación de
 * los dos (`routes/notas.ts`).
 */
export function usePapelera(clave: string, activo = true) {
  return useQuery({
    queryKey: ['notas', clave, 'papelera'],
    queryFn: () => api<{ notas: Nota[] }>(`/api/notas?clave=${encodeURIComponent(clave)}&archivadas=1`),
    select: (d) => ordenarNotas(d.notas),
    enabled: activo && Boolean(clave),
  });
}

/**
 * FAVORITOS (04-sep-2026, ADR 0093) — CRUZA todos los apartados: la libreta
 * privada Y cada espacio del que la vendedora es miembro, igual que la
 * Papelera (`usePapelera`) y por el mismo motivo — una marca personal no
 * debería depender de dónde estás parada para verla. `?favoritas=1`; el
 * server rechaza combinarlo con `espacio` (siempre se pide sin él).
 */
export function useFavoritas(clave: string, activo = true) {
  return useQuery({
    queryKey: ['notas', clave, 'favoritas'],
    queryFn: () => api<{ notas: Nota[] }>(`/api/notas?clave=${encodeURIComponent(clave)}&favoritas=1`),
    select: (d) => ordenarNotas(d.notas),
    enabled: activo && Boolean(clave),
  });
}

/**
 * UNA PÁGINA, POR SU ID — lo que la pantalla dividida necesita para mostrar al
 * lado una página que no pertenece a la `clave`/`espacio` que `useNotas` está
 * trayendo. `null` la apaga: no hay pantalla dividida (todavía) que mirar.
 */
export function useNotaPorId(id: number | null) {
  return useQuery({
    queryKey: ['notas', 'por-id', id],
    queryFn: () => api<{ ok: true; nota: Nota }>(`/api/notas/${id}`),
    select: (d) => d.nota,
    enabled: id !== null,
  });
}

/**
 * `clave` (03-sep-2026, opcional) — acota la búsqueda a UNA clave en vez de
 * cruzar todas las que la vendedora puede ver. El filtro fijo de la Libreta
 * la pasa (`CLAVE_LIBRETA`): sin esto, buscar ahí devolvía también notas
 * pegadas a una conversación de WhatsApp. `PantallaDividida.tsx`/
 * `PanelNotas.tsx` siguen llamando sin ella — cruzar claves ahí es a
 * propósito, no un olvido.
 *
 * `activo` (03-sep-2026, opcional) — cuándo pedirla. Por default sigue
 * siendo "solo con texto" (`termino.length > 0`), igual que siempre. El
 * filtro fijo de la Libreta lo fuerza a `true` incluso con el buscador
 * VACÍO cuando hay un tipo o un alcance elegidos — "dame todo lo visible
 * de este lugar" es una búsqueda válida sin una sola letra. `?buscar=1` es
 * la señal que el server necesita para entrar a `buscarNotas` con un `q`
 * vacío en vez de leerlo como "no hay búsqueda, cae al `clave` de siempre" —
 * mandarla siempre acá no cambia nada para quien sigue sin pasar `activo`,
 * porque para ellos la pregunta solo se hace con texto de por medio.
 */
export function useBuscarNotas(q: string, opciones: { clave?: string; activo?: boolean } = {}) {
  const termino = q.trim();
  const clave = opciones.clave;
  const activo = opciones.activo ?? termino.length > 0;
  return useQuery({
    queryKey: ['notas', 'buscar', termino, clave ?? null],
    queryFn: () =>
      api<{ notas: Nota[] }>(
        `/api/notas?buscar=1&q=${encodeURIComponent(termino)}${clave ? `&clave=${encodeURIComponent(clave)}` : ''}`,
      ),
    select: (d) => ordenarNotas(d.notas),
    enabled: activo,
  });
}

/**
 * Las mutaciones comparten la invalidación: la lista de esa `clave` (nunca se
 * cachea en disco). `onSuccess` DEVUELVE la promesa de `invalidateQueries` (no
 * `void`) a propósito: así `mutateAsync(...)` no se considera terminada hasta
 * que la lista se refrescó de verdad — sin esto, dos clics rápidos en "fijar"
 * (el botón se reactiva apenas el PATCH vuelve, todavía con el dato viejo en
 * caché) podían pisarse. `PanelNotas` además deshabilita el botón mientras la
 * promesa está en vuelo.
 */
export function useMutacionesNotas(clave: string, espacioId: number | null = null) {
  const qc = useQueryClient();
  const invalidar = () => qc.invalidateQueries({ queryKey: ['notas', clave, espacioId] });
  /**
   * LOS CONTADORES DE "TUS ESPACIOS" (03-sep-2026) viven en OTRA queryKey
   * (`['espacios']`, `useEspacios` en `espacios.ts`) — nada de lo de arriba la
   * toca. Sin este invalidado, crear/archivar/desarchivar/mover una página de
   * un espacio corría bien pero el número de al lado de su nombre en el riel
   * quedaba VIEJO hasta recargar la app entera: reportado como "los espacios
   * no se están contando correctamente".
   */
  const invalidarEspacios = () => qc.invalidateQueries({ queryKey: ['espacios'] });
  /**
   * LA PAPELERA (03-sep-2026) es OTRA queryKey (`['notas', clave, 'papelera']`,
   * `usePapelera`) — nunca la misma que `['notas', clave, espacioId]`, ni
   * siquiera cuando `espacioId` es `null` (mi libreta privada): son dos listas
   * que miran el MISMO `archivadoAt` desde lados opuestos. `archivar` la
   * ignoraba, así que una página recién archivada no aparecía en la Papelera
   * hasta recargar — reportado junto con lo de arriba como "los botones de
   * eliminar no funcionan": no es que el botón fallara, es que la fila que
   * había que borrar nunca llegaba a mostrarse.
   */
  const invalidarPapelera = () => qc.invalidateQueries({ queryKey: ['notas', clave, 'papelera'] });
  /**
   * FAVORITOS (04-sep-2026, ADR 0093) — mismo motivo que la Papelera arriba:
   * otra queryKey (`['notas', clave, 'favoritas']`, `useFavoritas`) que mira
   * el mismo campo `favorita`/`archivadoAt` desde su propio ángulo. Marcar,
   * desmarcar, archivar (se cae de Favoritos si estaba viva) y desarchivar
   * (puede volver a aparecer) la tienen que tocar.
   */
  const invalidarFavoritas = () => qc.invalidateQueries({ queryKey: ['notas', clave, 'favoritas'] });

  const crear = useMutation({
    mutationFn: (v: string | { texto?: string; doc?: unknown; anotaciones?: unknown }) => {
      const cuerpo = typeof v === 'string' ? { texto: v } : v;
      // `espacioId` viaja SIEMPRE: una página nueva nace donde la vendedora está
      // parada. Sin esto, escribir adentro de un espacio creaba la página en la
      // libreta privada — y desaparecía de la lista apenas refrescaba.
      return api<{ ok: true; nota: Nota }>('/api/notas', {
        method: 'POST',
        body: JSON.stringify({ clave, espacioId, ...cuerpo }),
      });
    },
    // Nace en `espacioId`: si es un espacio de verdad, su contador subió uno.
    onSuccess: () => Promise.all([invalidar(), invalidarEspacios()]),
  });

  const editar = useMutation({
    mutationFn: (v: {
      id: number;
      texto?: string;
      doc?: unknown;
      anotaciones?: unknown;
      fijada?: boolean;
      favorita?: boolean;
    }) =>
      api<{ ok: true; nota: Nota }>(`/api/notas/${v.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          texto: v.texto,
          doc: v.doc,
          anotaciones: v.anotaciones,
          fijada: v.fijada,
          favorita: v.favorita,
        }),
      }),
    onSuccess: (r) => {
      // 🔴 `useNotaPorId` (pantalla dividida, y ahora la barra de pestañas)
      // vive en OTRA queryKey (`['notas','por-id', id]`) — invalidar solo la
      // lista no la toca. Sin este parche, renombrar acá dejaba el título
      // viejo en cualquier pestaña abierta de esta misma página hasta que
      // algo más forzara un refetch (30 s de `staleTime`, o cambiar de vista
      // y volver).
      qc.setQueryData(['notas', 'por-id', r.nota.id], { ok: true as const, nota: r.nota });
      return Promise.all([invalidar(), invalidarFavoritas()]);
    },
  });

  /**
   * AUTOGUARDADO del editor. Es `editar` con otra política de caché: parchea la
   * fila en el caché en vez de invalidar. Invalidar en cada tecleo dispara un
   * refetch por pulsación y hace parpadear la lista mientras se escribe — y el
   * único dato que cambia es el `texto` derivado y el `editadoAt`, que vienen en
   * la respuesta. El editor no se toca: es no-controlado, así que un refetch
   * tampoco lo resetearía, solo cuesta.
   */
  const autoguardar = useMutation({
    // ⚠️ Se manda SOLO lo que cambió: `JSON.stringify` omite los `undefined` y
    // el server trata la ausencia como «no lo toques». Mandar siempre los dos
    // haría que dibujar reescriba el texto (y al revés) sin motivo.
    mutationFn: (v: { id: number; doc?: unknown; anotaciones?: unknown }) =>
      api<{ ok: true; nota: Nota }>(`/api/notas/${v.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ doc: v.doc, anotaciones: v.anotaciones }),
      }),
    onSuccess: (r) => {
      qc.setQueryData<{ notas: Nota[] }>(['notas', clave, espacioId], (prev) =>
        prev ? { notas: prev.notas.map((n) => (n.id === r.nota.id && n.origen === 'nota' ? { ...n, ...r.nota } : n)) } : prev,
      );
    },
  });

  /**
   * UN DOCUMENTO ADJUNTADO (26-ago-2026) — el gemelo de `crear` para
   * `tipo: 'archivo'`. Nunca se autoguarda: a diferencia del texto, no hay
   * nada que la vendedora vaya cambiando en pantalla — el documento nace
   * subido entero de una vez (`documentos.ts: subirDocumento`) y esto solo
   * crea la fila que lo referencia.
   *
   * Nace en `espacioId` igual que `crear` (03-sep-2026): adjuntar un
   * documento adentro de un espacio también le sube el contador uno, así
   * que invalida `['espacios']` por el mismo motivo — quedaba afuera y era
   * el mismo síntoma reportado como "los espacios no se están contando
   * correctamente", solo que por esta puerta en vez de la del texto.
   */
  const crearDocumento = useMutation({
    mutationFn: (v: { archivo: string; nombreOriginal: string; mime: string; bytes: number }) =>
      api<{ ok: true; nota: Nota }>('/api/notas', {
        method: 'POST',
        body: JSON.stringify({ clave, espacioId, tipo: 'archivo', archivo: v }),
      }),
    onSuccess: () => Promise.all([invalidar(), invalidarEspacios()]),
  });

  const archivar = useMutation({
    mutationFn: (id: number) => api<{ ok: true; nota: Nota }>(`/api/notas/${id}/archivar`, { method: 'PATCH' }),
    // Se va de la lista viva de `espacioId` (`invalidar`) Y —si `espacioId` es
    // `null`— entra a la Papelera; si es un espacio de verdad, su contador baja
    // uno. Y si estaba marcada favorita, se cae de Favoritos (que solo mira lo
    // vivo) — las cuatro, siempre: es más barato refrescar una consulta de más
    // que dejar una lista mintiendo.
    onSuccess: () => Promise.all([invalidar(), invalidarPapelera(), invalidarEspacios(), invalidarFavoritas()]),
  });

  /**
   * El «Deshacer» del toast que sigue a archivar — el camino de vuelta que faltaba.
   *
   * 🔴 **Y desde el 04-sep-2026 no alcanza con `invalidar()`** (04-sep-2026,
   * ADR 0093): esa función refresca `['notas', clave, espacioId]` con el
   * `espacioId` con el que se CREÓ el hook (`useMutacionesNotas`), no el de la
   * nota que se está restaurando. Restaurar SIEMPRE se dispara parada en la
   * Papelera (`espacioId` del hook es `null`) — mientras la Papelera solo traía
   * páginas privadas, coincidía. Ahora que también trae páginas de un espacio
   * (ADR 0093), restaurar una de ésas dejaba el contador de "Tus espacios" bien
   * (`invalidarEspacios` no mira `espacioId`) pero la LISTA del espacio seguía
   * mostrando la versión vieja hasta navegar afuera y volver — reportado como
   * «archivar/restaurar dejó de llevar a Papelera» cuando en realidad archivar
   * y la Papelera ya andaban bien: lo que fallaba era el paso de VUELTA.
   * `r.nota.espacioId` es la fuente de verdad de A DÓNDE vuelve, no `espacioId`
   * del cierre — mismo criterio que ya usa `mover` con `v.destino`.
   */
  const desarchivar = useMutation({
    mutationFn: (id: number) => api<{ ok: true; nota: Nota }>(`/api/notas/${id}/desarchivar`, { method: 'PATCH' }),
    // Simétrico a `archivar`: sale de la Papelera y vuelve a la lista viva —
    // la de la nota, no la del hook.
    onSuccess: (r) =>
      Promise.all([
        invalidar(),
        qc.invalidateQueries({ queryKey: ['notas', clave, r.nota.espacioId ?? null] }),
        invalidarPapelera(),
        invalidarEspacios(),
        invalidarFavoritas(),
      ]),
  });

  /**
   * ELIMINAR PARA SIEMPRE (Papelera, 03-sep-2026) — el único DELETE físico de
   * una nota. Solo tiene sentido desde adentro de la Papelera (el server
   * rechaza con 400 una página que no esté ya archivada), así que invalida
   * ESA queryKey y no la de `espacioId` — la página no vuelve a la lista viva
   * porque nunca estuvo ahí para esta mutación, estaba en la Papelera.
   */
  const eliminarParaSiempre = useMutation({
    mutationFn: (id: number) => api<{ ok: true }>(`/api/notas/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas', clave, 'papelera'] }),
  });

  /**
   * MOVER una página de lugar (ADR 0047). `destino: null` = mi libreta privada.
   *
   * ⚠️ **Invalida las DOS listas**, la de origen y la de destino: la página
   * desaparece de una y aparece en la otra, y refrescar solo la actual dejaría la
   * otra con un fantasma hasta el próximo refetch — que en la lista de un espacio
   * compartido se lee como que la página sigue ahí para todos.
   */
  const mover = useMutation({
    mutationFn: (v: { id: number; destino: number | null }) =>
      api<{ ok: true }>(`/api/notas/${v.id}/mover`, {
        method: 'PATCH',
        body: JSON.stringify({ espacioId: v.destino }),
      }),
    // + `invalidarEspacios`: el contador de origen baja uno y el de destino
    // sube uno (o no cambian, si alguno de los dos es la libreta privada) —
    // la única forma de saber cuál es cuál sin duplicar la regla acá es
    // refrescar la consulta entera.
    onSuccess: (_r, v) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['notas', clave, espacioId] }),
        qc.invalidateQueries({ queryKey: ['notas', clave, v.destino] }),
        invalidarEspacios(),
      ]),
  });

  /**
   * Abrir —o RECONFIGURAR— el link (ADR 0048). Idempotente en el server: dos
   * clics no dan dos URLs, y cambiar el alcance surte efecto sobre el token que
   * ya se repartió.
   *
   * ⚠️ `permiso: 'editar'` con `alcance: 'publico'` lo rechaza el server con 400:
   * sin identidad no hay autoría. La pantalla no ofrece esa combinación.
   */
  const abrirLink = useMutation({
    mutationFn: (v: { id: number; alcance: Alcance; permiso: Permiso; venceAt?: string | null }) =>
      api<{ ok: true; token: string }>(`/api/notas/${v.id}/link`, {
        method: 'POST',
        body: JSON.stringify({ alcance: v.alcance, permiso: v.permiso, venceAt: v.venceAt ?? null }),
      }),
    onSuccess: invalidar,
  });

  /** Cortarlo. El corte es inmediato: el server borra la fila. */
  const cortarLink = useMutation({
    mutationFn: (id: number) => api<{ ok: true; token: null }>(`/api/notas/${id}/link`, { method: 'DELETE' }),
    onSuccess: invalidar,
  });

  /**
   * PANTALLA DIVIDIDA (17-ago-2026): con qué otra página se ve al lado.
   * `dividir` la abre —o la cambia—, `cortarDivision` la deshace.
   *
   * ⚠️ Invalida la lista de ESTA página (la que cambió su `paginaDivididaId`),
   * no la de la contraparte: dividir no la mueve de lugar ni la toca, así que
   * no hay nada que refrescar del otro lado. Quien la muestra al lado
   * (`useNotaPorId`) la trae por su propio queryKey.
   */
  const dividir = useMutation({
    mutationFn: (v: { id: number; paginaDivididaId: number }) =>
      api<{ ok: true; nota: Nota }>(`/api/notas/${v.id}/dividir`, {
        method: 'PATCH',
        body: JSON.stringify({ paginaDivididaId: v.paginaDivididaId }),
      }),
    onSuccess: invalidar,
  });

  const cortarDivision = useMutation({
    mutationFn: (id: number) => api<{ ok: true; nota: Nota }>(`/api/notas/${id}/dividir`, { method: 'DELETE' }),
    onSuccess: invalidar,
  });

  return {
    crear,
    editar,
    archivar,
    desarchivar,
    eliminarParaSiempre,
    autoguardar,
    mover,
    abrirLink,
    cortarLink,
    dividir,
    cortarDivision,
    crearDocumento,
  };
}

/** La primera línea con texto — el título que la Libreta muestra en la lista. */
export function tituloDeNota(nota: Nota): string {
  const primera = nota.texto.split('\n').find((l) => l.trim() !== '');
  return primera?.trim() ?? '';
}

/**
 * El resto, para el renglón de abajo en la lista. Se corta con `slice` y no con
 * CSS porque son varias líneas colapsadas en una: sin el corte, una nota larga
 * manda un párrafo entero al DOM de cada fila.
 */
export function resumenDeNota(nota: Nota, tope = 90): string {
  const titulo = tituloDeNota(nota);
  const resto = nota.texto.slice(titulo.length).replace(/\s+/g, ' ').trim();
  return resto.length > tope ? `${resto.slice(0, tope)}…` : resto;
}

/**
 * EL TIPO DE ARCHIVO, para el filtro del panel de "Páginas" (03-sep-2026) y
 * para la etiqueta de cada fila (04-sep-2026, ver `ETIQUETA_DE_CLASE`).
 * `'texto'` es una página de BlockNote de siempre. Las otras tres son un
 * documento adjuntado, distinguidas por el MIME que ya valida
 * `documentos.ts: TIPOS_DOCUMENTO_ACEPTADOS` — son las ÚNICAS tres que
 * existen porque `subirDocumento` rechaza cualquier otra antes de llegar a
 * guardarse, así que esta función nunca necesita un `'otro'`.
 */
export type ClaseDeArchivo = 'texto' | 'pdf' | 'word' | 'txt';

export function claseDeArchivo(nota: Nota): ClaseDeArchivo {
  if (nota.tipo !== 'archivo') return 'texto';
  switch (nota.archivo?.mime) {
    case 'application/pdf':
      return 'pdf';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'word';
    default:
      return 'txt';
  }
}

/**
 * LA ETIQUETA QUE CADA FILA MUESTRA (04-sep-2026, a pedido explícito) — en
 * el lugar donde antes decía «· editada» (`FilaPagina`, `Libreta.tsx`): qué
 * ES la página, no si se tocó desde que se creó. «Bloc» es el nombre que la
 * vendedora reconoce para un `.txt` (Bloc de notas); el resto son literales.
 */
export const ETIQUETA_DE_CLASE: Record<ClaseDeArchivo, string> = {
  texto: 'Página',
  pdf: 'PDF',
  word: 'Word',
  txt: 'Bloc',
};

/**
 * El `doc` que le entra al editor. Una nota vieja (o una histórica de
 * `gestiones`) no tiene documento: se convierte su texto a párrafos, uno por
 * línea, para que se pueda abrir y seguir escribiendo sin migrar nada.
 * `undefined` cuando no hay ni texto — BlockNote no acepta contenido vacío.
 */
export function docParaEditor(nota: Nota): unknown[] | undefined {
  if (Array.isArray(nota.doc) && nota.doc.length > 0) return nota.doc;
  if (nota.texto.split('\n').every((l) => l.trim() === '')) return undefined;
  return bloquesDeTexto(nota.texto);
}
