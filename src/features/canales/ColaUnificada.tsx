/**
 * 🔴🔴🔴 AVISO PARA QUIEN HAGA EL MERGE CON `fix/corregir-vermas` (dejado el
 * 07-sep-2026, antes de que ese merge exista) 🔴🔴🔴
 *
 * Hay OTRO checkout en paralelo — `37_Hermes_07_09_26_Fix_Chat/corregir-vermas`,
 * rama `fix/corregir-vermas`, commit `c4496f5c` («fix(mensajes): filtra
 * Facebook/Messenger en el server, no sobre lo ya traído») — que edita ESTE
 * MISMO ARCHIVO, en la zona de `useConversaciones({...})` y el `useMemo` de
 * `visibles` (el filtro `porTipo`). El dueño va a mergear esas dos carpetas a
 * mano; esto queda escrito para que ese merge no pierda ninguna de las dos
 * mitades.
 *
 * Qué toca CADA lado, para que no se pisen:
 *   · **Acá** (esta sesión, 07-sep-2026): la cabecera de tres pestañas
 *     (Canales flotante / Chats / Llamadas), que internaliza `canal` como
 *     estado propio —dejó de ser prop— y saca `RielDeCanales` de `App.tsx`.
 *     Ver el docblock grande de `ColaUnificada` más abajo.
 *   · **`corregir-vermas`**: manda `tipo` al server dentro de
 *     `useConversaciones({ canal, tipo })` y BORRA el recorte `porTipo` que
 *     hoy vive en el `useMemo` de `visibles` (Facebook/Messenger compartían
 *     `canal` y se separaban acá, sobre la página ya traída — con eso
 *     sobrevivían 0 o 1 fila de 30 y hacían falta muchos «Ver más»). También
 *     toca `dominio/cola.ts` (`EstadoCola.tipo`, `parametrosDeCola`) y
 *     `canalesDelRiel.ts` (docblock).
 *
 * NINGUNO de los dos cambios pisa al otro en el sentido de LÓGICA: el `canal`
 * que este archivo ahora resuelve como estado interno sigue siendo el mismo
 * valor que `opcionDeCanal`/`useConversaciones` ya consumían — sólo cambió de
 * dónde sale. Lo que el merge tiene que verificar a mano es que, después de
 * unir las dos ramas, `useConversaciones` reciba `tipo` (de `corregir-vermas`)
 * usando el `canal` que ahora es estado local (de acá), y que el `useMemo` de
 * `visibles` quede SIN el recorte `porTipo` (se movió al server) pero SÍ con
 * todo lo demás que este archivo agregó alrededor. Si al mergear este aviso
 * ya no aplica —porque alguna de las dos ramas cambió de nuevo, o porque el
 * merge ya pasó—, bórralo: un aviso de un merge que ya ocurrió es ruido, no
 * ayuda.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Filter, MessageSquarePlus, Phone, Search, Smartphone, X } from 'lucide-react';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { api, ErrorApi } from '../../lib/datos/cliente';
import { esFresca, hace, horasDesdeIngesta, useFrescura } from '../../lib/datos/frescura';
import { useSelloDeViejo } from '../../lib/datos/useSelloDeViejo';
import { botonAzulClass } from '../../lib/styles';
import { SelloDeAntes } from '../../components/SelloDeAntes';
import { useSesionWa } from '../whatsapp/conversacionWa';
import { pendientesQueApuran, useAgenda } from '../agenda/agenda';
import { useCategorias } from '../gestion/categorias';
import { GestorCategorias } from '../gestion/GestorCategorias';
import { useDashboard } from '../dashboard/dashboard';
import {
  KEY_TAB,
  KEY_LINEA,
  TABS,
  filtrosActivos,
  migracionDesdeKeyVieja,
  migrarFiltroViejo,
  ordenarConEtiquetaActiva,
  type FiltroSec,
  type Tab,
} from '../../dominio/cola';
import { lineaEfectiva, opcionesDeLinea } from './alcance';
import { BarraFiltros } from './BarraFiltros';
import { RotuloDeLaCola } from './RotuloDeLaCola';
import { FallaConReintento } from '../../components/FallaConReintento';
import { VacioDeLineaPropia } from './VacioDeLineaPropia';
import { useConversaciones, useEstadoConversacion, type Conversacion } from '../../dominio/conversaciones';
import { useLineas } from '../../dominio/lineas';
import { lineaDelChatNuevo, lineasParaChatNuevo } from '../../dominio/lineaParaAbrir';
import { usePopover } from '../../lib/teclado/usePopover';
import { ANCHO_RIEL_REM, RielDeCanales } from './RielDeCanales';
import { FilaConversacion } from './FilaConversacion';
import { AvisoFilaQueBajo } from './AvisoFilaQueBajo';
import { avisoDeFilaQueSeFue } from './filaQueSeFue';
import { MenuFila } from './MenuFila';
import { nombreCanal } from '../../components/BadgeCanal';
import { opcionDeCanal } from './canalesDelRiel';
import { useEfectoAlCambiar } from '../../lib/useEfectoAlCambiar';

/** Solo anima lo que llegó AHORA (SSE): lo viejo que entra por «Ver más» no. */
const RECIEN_LLEGADA_MS = 10 * 60_000;

/** La pestaña de arriba del contenedor (ver el docblock de más abajo). Persistida: es la misma clase de preferencia que `KEY_TAB`/`KEY_LINEA` en `dominio/cola.ts`, sólo que vive acá porque no es un recorte de la CONSULTA — «Llamadas» ni siquiera pide datos. */
const KEY_PESTANA = 'hermes.colaPestana';

/**
 * LOS BOTONES AZULES DE LA CABECERA — el filtro de canal y el chat nuevo
 * (08-sep-2026, pedido del dueño: «deben tener los mismos efectos»).
 *
 * `botonAzulClass` vive en `lib/styles.ts` (08-sep-2026, ampliación del mismo
 * día): el trigger que abre/cierra el panel de la ficha, en `App.tsx`, lo
 * pidió también, así que dejó de ser cosa de esta pantalla — una sola cadena
 * compartida entre features, no dos (o tres) copias que un cambio futuro
 * puede desalinear sin que nadie lo note (#37).
 */

/**
 * LA COLA UNIFICADA — el corazón de Hermes, ahora la MESA DE TRABAJO (#49).
 *
 * Una sola lista con los cuatro canales mezclados (comentarios FB/IG, DMs de
 * Messenger, chats de WhatsApp), ordenada por el servidor según la urgencia
 * canónica de seis niveles (`server/src/cola/urgencia.ts`). El canal es una
 * insignia, no una columna.
 *
 * La cola potenciada suma la organización estilo WhatsApp Business: TABS
 * (`Todo · No leídos · Favoritos`) como eje, filtros secundarios (`Piden info`,
 * `Por vencer`), una BANDA de conversaciones fijadas arriba de todo, y el MODO
 * LISTAS: la lista de la izquierda se convierte en la lista de categorías, y
 * entrar a una la filtra (drill-down). El pin, la favorita y el «no leído» son
 * POR VENDEDORA (`estado_conversacion`).
 *
 * ══ 🔴 TRES PESTAÑAS ARRIBA DEL TODO (07-sep-2026, pedido del dueño) ═════════
 *
 * El contenedor entero —éste, el que ya tenía su propio `rounded-2xl bg-card
 * shadow-panel`— gana una cabecera de tres botones, y NADA de su tamaño
 * cambia (mismo alto, mismo ancho: los da `<main>` en `App.tsx`, acá no se
 * toca): **el ícono de canales**, que despliega los mismos WhatsApp/Facebook/
 * Instagram/… de `RielDeCanales` pero FLOTANDO (`mostrarCanales`, con
 * `usePopover` — el mismo mecanismo que ya cierra el menú de «por qué línea»
 * unas líneas más abajo, Escape y clic afuera incluidos) en vez de como
 * columna fija; **Chats**, que es exactamente todo lo que este componente ya
 * dibujaba (búsqueda, tabs, filtros, la lista) — no se movió una línea de esa
 * parte, sólo se le puso una puerta al lado; y **Llamadas**, hoy un cartel de
 * «Próximamente» y nada más, porque la función no existe todavía.
 *
 * 🔴 **`RielDeCanales` DEJA DE VIVIR EN `App.tsx`.** La razón por la que
 * vivía afuera —«el riel no puede leer el canal sin que la cola se lo
 * empuje hacia arriba»— dejó de aplicar: ahora el riel se dibuja ACÁ, así
 * que lee `canal`/`setCanal` directo, sin cruzar un componente. Por eso esos
 * dos dejan de ser PROPS (nadie más los necesitaba: `grep -rn
 * "canalDeLaCola" App.tsx` sólo daba este componente) y pasan a ser estado
 * de acá, con el mismo default `''` que tenían en el shell — ningún
 * comportamiento cambia, sólo de dónde sale el dato. De regalo, la
 * revisión de canal ya no necesita su propio `{!revision.activo && …}`: en
 * modo revisión no se monta `ColaUnificada` (se monta `ColaRevision`), así
 * que el riel desaparece SOLO con la revisión, sin una condición aparte que
 * pudiera desincronizarse de esa otra.
 */
export function ColaUnificada({
  seleccionada,
  onSeleccionar,
  conversacionAbierta,
  miVendedora,
  esDeCampana = false,
  onIrAgenda,
  inputRef,
}: {
  seleccionada: string | null;
  onSeleccionar: (c: Conversacion) => void;
  /** La conversación abierta completa (para la fila pin cuando el filtro la esconde). */
  conversacionAbierta?: Conversacion | null;
  /** Username de la vendedora, para el «Respondiste a {n} personas hoy». */
  miVendedora?: string;
  /**
   * ¿Quien mira trabaja en el módulo de CAMPAÑAS? Pedido del dueño: ahí no
   * existe el formulario de la Escuela, así que «Formulario» sale del
   * selector «Canales» — es la única diferencia entre los dos módulos en
   * este componente. Mismo prop que ya baja a `VistaEmbudo`/`HojaContacto`.
   */
  esDeCampana?: boolean;
  /** Siguiente jugada del vacío despachado cuando no hay pide-info pendiente. */
  onIrAgenda?: () => void;
  /** Ref de la búsqueda, para el atajo «/» global (se cablea en el shell). */
  inputRef?: Ref<HTMLInputElement>;
}) {
  // La pestaña de arriba del contenedor — ver el docblock de más arriba.
  // Persistida, como el tab de abajo; arranca en «chats» para quien nunca la
  // tocó (Llamadas todavía no hace nada, así que no es un default razonable).
  const [pestana, setPestana] = useLocalStorage<'chats' | 'llamadas'>(KEY_PESTANA, 'chats');
  // El riel de canales — efímero (no se persiste abierto/cerrado, igual que
  // el menú «por qué línea» unas líneas más abajo).
  const [mostrarCanales, setMostrarCanales] = useState(false);
  const dispararCanales = useRef<HTMLButtonElement>(null);
  // Sólo por el Escape (`usePopover` lo registra igual, mire o no algo el
  // `propsOverlay` que devuelve) — el riel acoplado ya no usa el overlay de
  // clic-afuera, ver el docblock grande de más abajo.
  usePopover(mostrarCanales, () => {
    setMostrarCanales(false);
    dispararCanales.current?.focus();
  });
  // EL CANAL ELEGIDO EN EL RIEL — el id de `canalesDelRiel`, vacío = todos.
  // Vivía como prop del shell (`App.tsx`) mientras el riel se dibujaba AFUERA
  // de este componente; ahora que se dibuja ACÁ (acoplado, ver el docblock de
  // más abajo) nadie más lo necesita — mismo default `''` que tenía allá.
  const [canal, setCanal] = useState('');

  // El tab es el eje (persistido). El default dejó de ser `puedo-escribirle`:
  // `migrarFiltroViejo` mapea cualquier valor viejo/basura a un tab válido, así
  // el caché persistido no abre mostrando un filtro que ya no existe (#49).
  const [tabGuardado, setTab] = useLocalStorage<string>(KEY_TAB, 'todo');
  const tab: Tab = migrarFiltroViejo(tabGuardado);
  // La línea también se guarda (ver KEY_LINEA). `lineas` son las que están
  // VIVAS: si la guardada dejó de correr, el filtro se cae a «todas» en vez de
  // dejar la cola vacía sin explicación — un número que ya no está no puede
  // seguir escondiendo el trabajo.
  const [lineaGuardada, setLinea] = useLocalStorage<string>(KEY_LINEA, '');
  const { lineas, hayMias, veTodo } = useLineas();
  /**
   * ⚠️ **El fallback ya NO es «Todas».** La regla vive pura en `alcance.ts` y es
   * la misma que decide qué ofrece el selector, para que no puedan divergir.
   *
   * Lo que cambió y por qué: cuando el mapa te asigna una sola línea, el selector
   * **no se dibuja** —una opción no es una elección—, y entonces ya no hay
   * control en pantalla para corregir un valor guardado malo. Con el fallback
   * viejo, quien alguna vez eligió «Todas» se quedaba viendo las cuatro líneas
   * para siempre, sin nada que lo explicara ni que lo apagara. Ahora cae a lo
   * suyo. Sin mapa sigue cayendo a «Todas», que ahí sí es lo correcto (fail-open).
   *
   * 🔴 **Y `veTodo` NO es opcional acá: es el arreglo del 7-sep-2026.** Con el
   * rol afuera, esta línea le clavaba a `alex` —supervisor con UNA línea en
   * `numero_vendedora`— la cola de Ventas Meta y le escondía las otras 4.832
   * conversaciones que el server sí le servía. **Se decide UNA sola vez y el
   * resultado baja a `BarraFiltros` como `opciones`**: antes la barra volvía a
   * llamar a la regla con sus propios argumentos, así que agregar un tercero
   * dejaba dos lugares donde olvidarlo y ningún síntoma que lo delatara (#37).
   */
  const opcionesLinea = opcionesDeLinea(lineas, hayMias, veTodo);
  const linea = lineaEfectiva(lineaGuardada, opcionesLinea);
  // Filtros secundarios: efímeros (la sesión arranca en limpio).
  const [filtroSec, setFiltroSec] = useState<FiltroSec>('');
  const [categoriaActiva, setCategoriaActiva] = useState<{ nombre: string; color: string } | null>(null);
  const [gestorAbierto, setGestorAbierto] = useState(false);
  // La opción se resuelve desde el id que baja del riel. `esDeCampana` decide
  // qué lista se consulta, igual que antes: sin él, «Formulario» existiría en
  // campaña y sería un filtro que siempre da cero.
  const opcionCanal = opcionDeCanal(canal, esDeCampana);

  // La key de la cola cambió con los tabs: quien venía usando la vieja tiene que
  // encontrar SU filtro, no un default mudo. Se traduce una vez, al montar.
  useEfectoAlCambiar([], () => {
    const migrado = migracionDesdeKeyVieja(
      (k) => {
        try {
          return window.localStorage.getItem(k);
        } catch {
          return null;
        }
      },
      (k) => {
        try {
          window.localStorage.removeItem(k);
        } catch {
          // Bloqueado: no es crítico, solo se reintentaría la próxima vez.
        }
      },
    );
    if (!migrado) return;
    setTab(migrado.tab);
    setFiltroSec(migrado.filtroSec);
    // Solo al montar: la migración es de una vez y borra su propia key.
  });

  const { data: catalogo = [] } = useCategorias();
  const estadoMut = useEstadoConversacion();
  const [avisoPin, setAvisoPin] = useState<string | null>(null);

  const {
    items,
    total,
    conteosFiltro,
    hayMas,
    cargando,
    cargandoMas,
    cargarMas,
    traidoEn,
    actualizando,
    sinEstado,
    sinLineasPropias,
    colaRecortada,
    conLineaPropia,
    falla,
    reintentar,
    reintentando,
  } = useConversaciones({
    tab,
    filtroSec,
    categoria: categoriaActiva?.nombre ?? null,
    linea,
    // `?? undefined` y no `?? null`: una entrada del riel que no filtra la cola
    // (Grupos) tiene `canal: null`, y mandarlo como filtro pediría el canal
    // llamado «null» en vez de no filtrar.
    canal: opcionCanal?.canal ?? undefined,
    // Separa comentario de mensaje cuando `canal` no alcanza (Facebook y
    // Messenger comparten `canal: 'facebook'`, ver `canalesDelRiel.ts`). Va al
    // server para que la PÁGINA ya venga separada — antes solo se recortaba
    // acá, sobre lo ya traído (ver `visibles` más abajo).
    tipo: opcionCanal?.tipo ?? undefined,
  });

  /**
   * CON UNA ETIQUETA ACTIVA, LA PÁGINA SIGUIENTE SE PIDE SOLA — pedido del
   * dueño (26-ago-2026): «no quiero ese botón, quiero una mejor solución».
   *
   * Una lista curada por etiqueta es chica y cerrada (140 del Foro): no hay
   * motivo para pedirle a alguien que revisa respuestas en vivo que note un
   * botón y lo clickee para poder confiar en que «no leídos primero» está
   * ordenando la lista ENTERA y no solo la primera página. La cola SIN
   * filtro sigue siendo manual — puede tener miles de filas, y traerlas
   * todas de una es el problema que el paginado existe para evitar.
   *
   * `cargandoMas` en la guarda: sin ella, cada render dispara un `cargarMas`
   * nuevo mientras el anterior sigue en vuelo — no hay límite de reintentos
   * porque no hace falta, `hayMas` se apaga sola cuando el server ya no
   * tiene más para dar.
   */
  useEffect(() => {
    if (categoriaActiva && hayMas && !cargando && !cargandoMas) cargarMas();
  }, [categoriaActiva, hayMas, cargando, cargandoMas, cargarMas]);

  // Al abrir la app la cola viene del caché persistido: hasta que llegue lo
  // fresco hay que decir de cuándo es lo que se está mirando.
  const deAntes = useSelloDeViejo(traidoEn);
  const tabMeta = TABS.find((t) => t.valor === tab) ?? TABS[0];

  // Búsqueda: filtra lo YA cargado (nombre, teléfono, texto). Si no aparece,
  // «Buscar en más historia» trae más — honesto: busca en lo que hay, no en toda la base.
  const [busqueda, setBusqueda] = useState('');
  /**
   * ══ EL BUSCADOR SE VUELVE UN ÍCONO QUE SE EXPANDE (07-sep-2026, pedido del
   * dueño) ══
   *
   * Antes era una píldora fija en su propio renglón. Ahora vive al lado de
   * Chats/Llamadas, pegado a la derecha junto al botón de chat nuevo, y por
   * default es sólo el ícono — con el `title` diciendo qué hace, como
   * cualquier otro botón sin rótulo de esta app.
   *
   * `busquedaAbierta` es el gesto (foco/clic); `expandida` —unas líneas más
   * abajo, donde se usa— es lo que de verdad gobierna el dibujo: con texto
   * adentro, el buscador SIGUE expandido aunque pierda el foco, porque
   * colapsarlo escondería la razón por la que la lista está filtrada.
   *
   * ⚠️ **El `<input>` NUNCA se desmonta** (sólo cambia de clases entre
   * colapsado y expandido): el atajo global `/` (`App.tsx`) hace
   * `inputRef.current?.focus()`, y un input que no existe en el DOM porque
   * `busquedaAbierta` era `false` habría dejado a `/` apretando un `focus()`
   * sobre `null` — el atajo se habría muerto en silencio. Como sigue montado,
   * enfocarlo (por `/` o por el ícono) dispara `onFocus`, que es lo que abre
   * `busquedaAbierta` — un solo mecanismo para las dos puertas.
   */
  const [busquedaAbierta, setBusquedaAbierta] = useState(false);
  const expandida = busquedaAbierta || busqueda !== '';
  /**
   * El ícono de la lupa necesita poder enfocar el input a mano (clic del
   * mouse, no llega por teclado), y el `inputRef` que baja como prop puede
   * ser una función (el molde genérico `Ref<T>`) — de esos no se puede leer
   * `.current`. Se resuelve con un ref PROPIO en el mismo nodo, fusionado a
   * mano con el que venga de afuera (mismo patrón que `FilaConversacion.tsx`
   * usa para el roving-tabindex + el IntersectionObserver de la foto).
   */
  const campoBusquedaRef = useRef<HTMLInputElement>(null);
  const visibles = useMemo(() => {
    // El recorte por `tipo` (Facebook vs. Messenger) ya lo aplicó el server
    // (`useConversaciones` lo manda arriba) — acá solo queda la búsqueda.
    const q = busqueda.trim().toLowerCase();
    const filtradas = q
      ? items.filter((c) =>
          [c.persona_nombre, c.persona_id, c.texto, c.contexto_texto].some((v) => v?.toLowerCase().includes(q)),
        )
      : items;

    /**
     * CON UNA ETIQUETA ACTIVA, LO SIN LEER SUBE PRIMERO Y DESPUÉS ES
     * CRONOLÓGICO — pedido del dueño (26-ago-2026): revisando 140 respuestas
     * de una campaña, lo ya leído tapaba lo que todavía necesitaba una
     * respuesta.
     *
     * 🔴 Y NO el orden del server: ese es por URGENCIA (`nivel ASC, orden
     * ASC`, mesa completa), y esa escala cambia de dirección según el nivel
     * — algo que tiene sentido para «qué atender primero en TODA la mesa» y
     * se lee como desorden dentro de un grupo chico y curado como una
     * etiqueta. `ordenarConEtiquetaActiva` (dominio/cola.ts) no muta `items`,
     * que sigue siendo el orden del server para la cola sin filtrar.
     */
    if (!categoriaActiva) return filtradas;
    return ordenarConEtiquetaActiva(filtradas);
  }, [items, busqueda, categoriaActiva]);

  /**
   * El estado vacío NO puede decir «estás al día» si en realidad no estamos
   * mirando: cero filas significa o que no hay trabajo, o que la captura está
   * muerta — y sin este chequeo la pantalla elige siempre la versión que deja a
   * la vendedora tranquila mientras pierde gente.
   */
  const { data: frescura } = useFrescura();
  // Calculado AHORA y no leído de un campo del server: con el caché de
  // frescura sin vencer, el mismo cuerpo puede seguir sirviéndose horas
  // (docs/plan-borrar-el-polling.md §6 PR 2).
  const horasFrescura = frescura ? horasDesdeIngesta(frescura) : null;
  const frescuraFresca = esFresca(horasFrescura);
  const vacioPorAtraso = frescura != null && !frescuraFresca && frescura.total > 0;

  // Cierre de edición despachada: la cola de «Todo» en cero CON datos frescos y
  // sin ningún filtro es trabajo terminado — la Deuda en cero. Se celebra con la
  // cifra del día + la siguiente jugada.
  const sinFiltros = tab === 'todo' && !filtroSec && !categoriaActiva && !opcionCanal;
  // `!falla`: una cola en error y sin datos no está al día, está sin llegar (ADR 0108).
  const despachada = !cargando && !falla && visibles.length === 0 && !busqueda && sinFiltros && frescura != null && frescuraFresca;

  // La cifra del día sale del MISMO hook que el radar (issue #5): acá vivía un
  // `useQuery` a mano sobre la misma `queryKey` con `staleTime` donde el hook
  // usaba `refetchInterval`, y cuál ganaba dependía de qué componente montó
  // primero. Se pide sin latido y solo con la cola despachada: es una cifra que
  // se lee una vez, no un radar.
  const statsDia = useDashboard({ activa: despachada && miVendedora != null });
  const nHoy = miVendedora
    ? statsDia.data?.porVendedora.find((v) => v.vendedora === miVendedora)?.conversaciones_hoy
    : undefined;

  /**
   * 🔴 «ESTÁS AL DÍA» ES UN FESTEJO, Y NO SE FESTEJA UNA MESA QUE NUNCA TUVO
   * TRABAJO.
   *
   * Quien trajo su propia línea (18-ago-2026) ve **su línea más lo que le
   * asignen**, y el día del deploy eso puede ser CERO: el dueño reparte a mano y
   * hoy no hay una sola fila suya en `conversacion_asignada`. Con la cola en cero
   * y `nHoy` en cero, «no queda deuda» es literalmente cierto y como respuesta es
   * falsa: le dice «terminaste» a alguien a quien todavía no le dieron nada, y
   * encima cierra la pregunta —«¿por qué no veo nada?»— con la explicación
   * equivocada, que es peor que no explicar.
   *
   * ⚠️ **Con `nHoy > 0` el festejo se queda**: ahí contestó gente de verdad hoy,
   * y esa cifra sale del Dashboard, no de la cola. Lo que se recorta es la
   * felicitación sin respaldo, no la felicitación.
   */
  const felicitacionConRespaldo = !conLineaPropia || (typeof nHoy === 'number' && nHoy > 0);

  // La salida de «estás al día»: a quién mirar cuando no hay deuda. Es el chip de
  // plata y no el de deuda, justamente porque acá ya no queda deuda que ofrecer.
  const conteoPrecio = useQuery({
    queryKey: ['conversaciones', 'conteo', 'pregunto-precio'],
    queryFn: () => api<{ total?: number }>('/api/conversaciones?intencion=pregunto-precio&limit=1&offset=0'),
    // En campaña no se habla de precio (regla del dueño, 13-sep-2026): ni el botón ni su conteo.
    enabled: despachada && !esDeCampana,
    staleTime: 60_000,
  });
  const nPreguntoPrecio = conteoPrecio.data?.total ?? 0;

  const { agenda } = useAgenda();
  const nAgenda = pendientesQueApuran(agenda.data?.recordatorios);

  // Solo la fila recién llegada por SSE entra animada: guardamos la foto de
  // claves del render anterior y marcamos lo que no estaba (y es reciente).
  const [clavesPrevias, setClavesPrevias] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (cargando) return;
    setClavesPrevias((prev) => {
      if (prev != null && prev.size === items.length && items.every((c) => prev.has(c.clave))) return prev;
      return new Set(items.map((c) => c.clave));
    });
  }, [items, cargando]);
  function esNueva(c: Conversacion): boolean {
    return (
      clavesPrevias != null &&
      !clavesPrevias.has(c.clave) &&
      Date.now() - new Date(c.ultimo_at).getTime() < RECIEN_LLEGADA_MS
    );
  }

  // Roving tabindex: una sola fila tabulable; ↑↓ mueven el foco, Enter abre.
  const refsFilas = useRef<(HTMLButtonElement | null)[]>([]);
  const [idxFoco, setIdxFoco] = useState(0);
  const idxSeguro = Math.min(idxFoco, Math.max(0, visibles.length - 1));
  function onTeclasLista(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    e.preventDefault();
    const proximo = Math.min(Math.max(idxSeguro + (e.key === 'ArrowDown' ? 1 : -1), 0), visibles.length - 1);
    setIdxFoco(proximo);
    refsFilas.current[proximo]?.focus();
  }

  // Chat nuevo: hablarle a alguien que NO está en la cola (un lead de landing
  // con teléfono, un referido). Abre el hilo vacío; el envío sigue pasando por
  // EnvioControlado — esto no manda nada solo.
  const { data: sesion } = useSesionWa();
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [nuevoTel, setNuevoTel] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  /**
   * Por qué línea sale el chat nuevo. `null` = todavía no eligió, y ahí manda la
   * primera viva — nunca se abre sin línea. La resolución vive pura en
   * `dominio/lineaParaAbrir.ts`; acá sólo se recuerda el clic.
   */
  const opcionesNuevo = lineasParaChatNuevo(lineas);
  // La MISMA regla que el Pipeline: con menos de dos no se pregunta nada. Un
  // selector de un elemento no es una elección, es un clic de más por cada chat.
  const hayQueElegirLinea = opcionesNuevo.length >= 2;
  const [menuLineaAbierto, setMenuLineaAbierto] = useState(false);
  const dispararNuevo = useRef<HTMLButtonElement>(null);
  const primerItemLinea = useRef<HTMLButtonElement>(null);
  const { propsOverlay: propsMenuLinea } = usePopover(menuLineaAbierto, () => {
    setMenuLineaAbierto(false);
    dispararNuevo.current?.focus();
  });
  // El foco al primer item, como en el menú del Pipeline: el menú se abre con el
  // teclado tanto como con el mouse (se llega tabulando desde los dos inputs).
  useEffect(() => {
    if (menuLineaAbierto) primerItemLinea.current?.focus();
  }, [menuLineaAbierto]);

  /**
   * Tocar «Abrir»: con una sola línea abre derecho —lo de siempre—, con varias
   * despliega. Es la misma bifurcación que `queHacerAlAbrir` hace en el Pipeline,
   * y por el mismo motivo: preguntar cuando no hay nada que elegir es fricción.
   */
  function alTocarAbrir() {
    if (!hayQueElegirLinea) {
      abrirChatNuevo(null);
      return;
    }
    setMenuLineaAbierto((v) => !v);
  }
  const conectado = sesion?.estado === 'conectado';

  /** `linea` = la que se eligió en el menú; `null` = no había nada que elegir. */
  function abrirChatNuevo(linea: string | null) {
    const tel = nuevoTel.replace(/\D/g, '');
    if (tel.length < 8 || sesion?.estado !== 'conectado') return;
    // 🔴 Antes era `sesion.telefono` a secas: la línea que el gestor devuelve
    // primera, elegida a espaldas de la vendedora. Con varias corriendo, el lead
    // recibía el primer mensaje de su vida desde un número que no reconoce —o
    // desde la línea de una campaña—. Ahora manda lo que dice el selector, y
    // `sesion.telefono` queda de último escalón para que esto no pueda dejar de
    // abrir un chat (fail-open, ver el docblock).
    const numeroPropio = lineaDelChatNuevo(lineas, linea, sesion.telefono);
    onSeleccionar({
      clave: `conv:whatsapp:${tel}:${numeroPropio}`,
      canal: 'whatsapp',
      tipo: 'mensaje',
      persona_id: tel,
      persona_nombre: nuevoNombre.trim() || null,
      numero_propio: numeroPropio,
      texto: null,
      contexto_texto: null,
      respondida: false,
      ventana_abierta: false,
      pregunto: false,
      pregunto_precio: false,
      solo_clic: false,
      n: 0,
      referencia: new Date().toISOString(),
      ultimo_at: new Date().toISOString(),
      dias: 0,
      nivel: 5, // neutro: el «resto» de la escala 0–5; la cola recalcula el real al cargar
    });
    setNuevoAbierto(false);
    setMenuLineaAbierto(false);
    setNuevoTel('');
    setNuevoNombre('');
  }

  // Toggle de estado personal (pin / favorita / leído) desde la fila. Fijar con
  // el tope lleno rebota con 409: se muestra, no se esconde (política de la casa).
  function togglear(c: Conversacion, campo: 'fijada' | 'favorita') {
    setAvisoPin(null);
    estadoMut.mutate(
      { clave: c.clave, [campo]: !c[campo] },
      {
        onError: (e) => {
          if (e instanceof ErrorApi && e.status === 409) setAvisoPin(e.message);
        },
      },
    );
  }
  function marcarLeido(c: Conversacion, leido: boolean) {
    estadoMut.mutate({ clave: c.clave, leido });
  }

  // Fila pin de orientación: la conversación abierta no aparece bajo el filtro
  // (o la búsqueda) activo — se fija arriba para que la vendedora no la pierda.
  const noEstaEnLista = seleccionada != null && !cargando && !visibles.some((c) => c.clave === seleccionada);
  // Los recortes activos, nombrados: es lo que la cabecera muestra y lo que
  // decide si «Ver todo» tiene sentido (lógica pura, `cola.ts`).
  const recortes = filtrosActivos({
    tab,
    filtroSec,
    categoria: categoriaActiva?.nombre ?? null,
    busqueda,
    canalLabel: opcionCanal?.label ?? null,
  });
  const hayFiltroActivo = recortes.some((r) => r.clave !== 'busqueda');
  // Con búsqueda el recorte lo hace el front sobre lo cargado, así que el número
  // honesto es el que se ve; sin ella manda el total que contó el server.
  const nVisibles = busqueda ? visibles.length : total;
  const pinVisible = noEstaEnLista && (busqueda !== '' || hayFiltroActivo);

  /**
   * «LE CONTESTÉ Y DESAPARECIÓ» — el complemento EXACTO del pin de arriba.
   *
   * El pin cubre «no coincide con el recorte». Lo que no tenía red era el caso
   * sin ningún recorte —como Luz abre la cola—: contestar mueve la fila del
   * nivel 0/3 al 4 (`server/src/cola/urgencia.ts`) y, con cientos de filas de
   * deuda arriba y páginas de 40, **cae fuera de lo cargado**. No se reordena:
   * se va de la vista.
   *
   * La regla vive pura en `filaQueSeFue.ts` (con sus cinco guardas y sus tests);
   * acá solo se le da el «antes», que es lo único que un componente puede saber
   * y una función pura no.
   */
  const clavesAntes = useRef<string[]>([]);
  /**
   * Las claves como UNA cadena, y no como array, por dos razones que van juntas:
   * el array es nuevo en cada render —así que un efecto que dependa de él corre
   * siempre y pisa el «antes» antes de que el aviso lo lea— y la regla de hooks
   * exige una dependencia que se pueda chequear estáticamente.
   *
   * El separador es seguro: una clave es `conv:<canal>:<persona>:<numero>` o
   * `int:<id>`, y ninguna de las dos formas lleva `|`.
   */
  const clavesAhora = visibles.map((c) => c.clave).join('|');
  const aviso = avisoDeFilaQueSeFue({
    abierta: seleccionada,
    nombre: conversacionAbierta?.persona_nombre,
    claves: clavesAhora ? clavesAhora.split('|') : [],
    clavesAntes: clavesAntes.current,
    fijadaArriba: pinVisible,
    cargando,
  });
  useEffect(() => {
    // El «antes» se actualiza SOLO con una lista ya cargada: guardar el vacío de
    // un refetch en vuelo borraría la memoria justo antes de necesitarla.
    if (!cargando) clavesAntes.current = clavesAhora ? clavesAhora.split('|') : [];
  }, [cargando, clavesAhora]);
  const canalPin =
    conversacionAbierta?.canal ?? (seleccionada?.startsWith('conv:') ? seleccionada.split(':')[1] : null);
  const origenPin = canalPin ? nombreCanal(canalPin) : 'un comentario';

  /**
   * Vuelve a la cola completa: sin búsqueda, sin filtros y fuera del modo Listas.
   *
   * ⚠ **La LÍNEA no se toca acá, a propósito.** Es el universo, no un recorte:
   * quien vende por su propio número tiene que poder apretar «limpiar» sin que
   * la cola se le llene con las conversaciones de otra persona. Se cambia solo
   * desde su segmentado, que dice cuál está puesta — y volver a «Todas» es un
   * click desde ahí.
   */
  function limpiarFiltros() {
    setBusqueda('');
    setTab('todo');
    setFiltroSec('');
    setCategoriaActiva(null);
    setCanal('');
  }

  return (
    /* ══ EN EL CELULAR LA COLA ES LA PANTALLA (11-sep-2026) ══
       Debajo de `md` esta caja ocupa el ancho entero (`App.tsx`), así que deja
       de ser una tarjeta flotando sobre el fondo. Y todo lo que se toca crece a
       40 px o más con `max-md:` —los botones de la cabecera, las pestañas, los
       chips—, porque a 28 px el dedo erra; los campos van a 16 px de letra,
       que es el mínimo con el que Safari de iOS no hace zoom al enfocar. En
       escritorio no cambia una clase: todo lo nuevo lleva `max-md:`. */
    <div className="relative flex h-full overflow-hidden rounded-2xl bg-card shadow-panel max-md:rounded-none max-md:shadow-none">
      {/*
        ══ EL RIEL DE CANALES SE ACOPLA Y EMPUJA, YA NO FLOTA (08-sep-2026,
        pedido del dueño) ══

        Hasta acá `RielDeCanales` colgaba `absolute` sobre la cola —el
        docblock viejo decía «flota, no empuja», y hasta tenía un test con ese
        nombre (`PestanasDeLaCola.test.tsx`)— así que abrirlo no le movía un
        píxel a nada de abajo. El pedido fue el contrario: que la cola se
        angoste MIENTRAS se elige un canal. Por eso ahora es un HERMANO del
        resto del contenedor (`flex h-full`, sin `flex-col`) en vez de una
        capa flotante.
        ⚠️ **Y sigue sin ser la columna fija que `RielDeCanales.tsx` describe
        y descarta** (§«por qué es angosto»): esa columna angostaba la cola
        TODO el tiempo, y ahí está escrito por qué eso es malo. Acá sólo
        angosta mientras el panel está abierto —elegir un canal sigue
        cerrándolo (`onCanal` más abajo), igual que hoy— así que el
        presupuesto de ancho de 1280 se devuelve solo, apenas se elige.

        ══ 🔴 SIEMPRE MONTADO, PARA PODER ANIMAR EL CIERRE (corrección del
        mismo día, pedido del dueño: «se abre y se cierra muy de golpe») ══

        La primera vuelta montaba/desmontaba con `{mostrarCanales && …}` —el
        mismo mecanismo que el panel flotante que reemplaza— y por eso
        aparecía y desaparecía de un salto: no hay forma de transicionar un
        ancho HACIA/DESDE un elemento que no existe todavía. Ahora el wrapper
        vive siempre y lo que cambia es su `width`/`opacity` (`ANCHO_RIEL_REM`
        exportado por `RielDeCanales.tsx`, para que este número y el `w-[…]`
        de su `<nav>` no puedan desviarse — #37). `duration-[240ms]
        ease-house`: la MISMA física que `--animate-entrar` (`index.css`),
        una sola curva de movimiento para toda la casa.

        ⚠️ **`inert` reemplaza al montado condicional como guarda de
        accesibilidad.** Un riel oculto por ancho pero presente en el DOM
        sin más sería tabulable y su texto («WhatsApp», «Instagram»…)
        aparecería en cualquier búsqueda de contenido — el defecto que el
        montado condicional evitaba. `inert` (React 19, sin polyfill) apaga
        el subárbol entero —nada tabulable, afuera del árbol de accesibilidad—
        sin desmontarlo, que es justo lo que permite animar. `aria-hidden`
        de acompañante para el lector de pantalla que todavía no respeta
        `inert` a pleno.
      */}
      <div
        inert={!mostrarCanales}
        aria-hidden={!mostrarCanales}
        className={
          'h-full shrink-0 overflow-hidden transition-[width,opacity] duration-[240ms] ease-house ' +
          (mostrarCanales ? 'border-r border-border opacity-100' : 'border-r border-transparent opacity-0')
        }
        style={{ width: mostrarCanales ? `${ANCHO_RIEL_REM}rem` : 0 }}
      >
        {/* El overlay `fixed inset-0` de `usePopover` que un panel flotante
            necesitaría para el clic-afuera NO está acá, a propósito: cubriría
            la pantalla entera para cerrar con un clic, y medido, se comía la
            rueda del mouse sobre la fila de chips que scrollea horizontal
            (`BarraFiltros.tsx`, `overflow-x-auto`) — abrir el filtro de canal
            apagaba ese scroll sin ningún aviso. `Escape` sigue cerrando (el
            listener de teclado de `usePopover` no depende de ningún overlay,
            sólo de `abierto`) y elegir un canal también — lo que se pierde es
            SOLO «cualquier clic en la cola también cierra», que en un panel
            acoplado no es una expectativa tan fuerte como en uno flotante.

            ⚠️ **SIN `p-1` (08-sep-2026, pedido del dueño: «no estuvieran
            centradas horizontalmente»)** — este `<div>` mide EXACTO
            `ANCHO_RIEL_REM` (lo pone el wrapper de arriba) y el `<nav>` de
            adentro (`RielDeCanales.tsx`) YA es ese mismo ancho, `w-[4.5rem]`
            fijo. Un `p-1` acá le restaba 8px de espacio disponible al `<nav>`
            sin restarle nada a SU propio ancho — quedaba más angosto que su
            contenedor, pegado a la izquierda en vez de ocupar el ancho
            entero, y encima levemente recortado por el `overflow-hidden` del
            wrapper de arriba. El `<nav>` ya trae su propio `py-1` vertical;
            lo único que faltaba acá era el scroll, no otro padding. */}
        <div className="h-full overflow-y-auto">
          <RielDeCanales
            canal={canal}
            onCanal={(id) => {
              setCanal(id);
              setMostrarCanales(false);
              dispararCanales.current?.focus();
            }}
            esDeCampana={esDeCampana}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/*
        ══ LA CABECERA DE TRES PESTAÑAS (07-sep-2026, pedido del dueño) ══
        Ver el docblock grande de más arriba.
      */}
      {/*
        ⚠️ **`min-h-[3.25rem]`, y no un padding a ojo (07-sep-2026, comprimida
        el mismo día a pedido del dueño)**: la primera vuelta clavaba 5,25rem
        —la altura que la cabecera de `HiloWhatsapp` daba con `py-3`—, y el
        pedido fue explícito: la fila entera tiene que medir apenas lo que
        mide el bloque nombre+teléfono de esa cabecera (37px) más un poco de
        aire, no lo que ocupaba con el padding viejo. `HiloWhatsapp` bajó a
        `py-1.5` y esta fila apunta al MISMO número resultante (52px, medido
        con Playwright DESPUÉS del recorte) — para que el borde de abajo de
        esta fila y el de la cabecera del chat sigan a la misma altura.
        `items-center`: el ícono de canales, el buscador y el de chat nuevo
        (que centran dentro de su propio botón, no pegados a ningún borde) y
        las pestañas tienen que verse a la misma altura entre sí, y el
        subrayado de la pestaña activa va pegado a su propio texto (`py-2`
        simétrico en los botones de Chats/Llamadas), no al borde del
        contenedor.
      */}
      <div className="flex min-h-[3.25rem] shrink-0 items-center gap-1 border-b border-border px-2">
        {/* ══ LA ZONA QUE EL BUSCADOR TAPA AL EXPANDIRSE (07-sep-2026) ══
            `relative` + `min-w-0 flex-1`: éste es el ancho que el buscador
            ocupa cuando se abre — el ícono de canales, «Chats» y «Llamadas»
            siguen ACÁ debajo (no se desmontan: `tabIndex={-1}` cuando está
            expandido alcanza para que no se puedan tabular por error, sin
            perder su estado). El botón de chat nuevo, en el `span` de más
            abajo, queda AFUERA de esta zona a propósito: el pedido fue que el
            buscador tape el filtro de canal y las pestañas, no ese botón.

            ⚠️ **`items-center`, y la altura la fija la PESTAÑA, no el
            contenedor (08-sep-2026: «elevá la línea, no bajes el círculo»,
            corrección de una primera vuelta con `items-end` que sí bajaba el
            círculo — y con él, lo desalineaba del ícono de buscar y de «chat
            nuevo», que viven en OTRO contenedor y se quedaron centrados
            donde siempre)**: el botón (28px, círculo fijo) tiene que seguir
            centrado en la fila como cualquier otro ícono de la cabecera; lo
            que se corrige es que la PESTAÑA mida esos mismos 28px —ver
            `h-7` en «Chats»/«Llamadas» más abajo—, así el subrayado cae
            solo donde termina el círculo sin mover a ninguno de los dos del
            centro. */}
        <div className="relative flex min-w-0 flex-1 items-center gap-1">
          {/* ══ UNA FLECHA QUE SE DA VUELTA, NO DOS ÍCONOS (08-sep-2026,
              pedido del dueño) ══
              Reemplaza a la cuadrícula (`LayoutGrid`, que decía «todos los
              canales juntos» pero no decía nada de CÓMO se abre el panel).
              `ChevronRight` sola + `rotate-180` cuando está abierto: cerrada
              apunta hacia la derecha —hacia el riel, que se acopla ahí mismo
              (ver el docblock grande de arriba)—, abierta apunta a la
              izquierda, el mismo lenguaje de flecha-que-se-da-vuelta que ya
              usa cualquier disclosure. Un solo componente, nunca dos íconos
              que puedan desalinearse en tamaño entre sí.

              ⚠️ **Azul sólido SIEMPRE, no sólo mientras está abierto
              (08-sep-2026, corrección del mismo día, pedido del dueño)**: la
              primera vuelta lo dejaba gris en reposo y sólo se pintaba
              (`bg-secondary`) al abrir o con un canal elegido — se perdía
              entre el resto de íconos apagados de la fila.
              ⚠️ **Y usa `botonAzulClass`, la MISMA constante que el botón de
              chat nuevo (más abajo) y el que abre/cierra la ficha (`App.tsx`),
              no una copia parecida** — «los mismos efectos» (pedido del
              dueño) dejó de ser una promesa que un className suelto pudiera
              romper en el próximo cambio. */}
          <button
            ref={dispararCanales}
            type="button"
            tabIndex={expandida ? -1 : undefined}
            aria-haspopup="true"
            aria-expanded={mostrarCanales}
            title="Filtrar por canal"
            onClick={() => setMostrarCanales((v) => !v)}
            className={botonAzulClass}
          >
            <ChevronRight
              size={15}
              aria-hidden="true"
              className={'transition-transform duration-200 ' + (mostrarCanales ? 'rotate-180' : '')}
            />
          </button>
          {/* 🔴 **`h-7`, NO `py-2` (08-sep-2026, corrección del mismo día:
              «elevá la línea, no bajes el círculo»)** — la vuelta anterior
              (`py-2` simétrico) centraba el TEXTO bien, pero dejaba la caja
              entera en 37,5px (línea de texto + padding + el subrayado)
              contra los 28px del círculo de al lado: centrados los dos por
              separado, sus bases quedaban a 4,75px de distancia una de otra.
              `h-7` (28px, LA MISMA medida que `size-7` del círculo — no un
              número aparte que pueda desviarse) fuerza la caja al tamaño
              exacto del círculo; `flex items-center justify-center` adentro
              sigue centrando el texto DENTRO de esa caja, así que el
              subrayado (`border-b-2`, incluido en los 28px por el
              `box-sizing: border-box` que ya usa toda la app) cae justo
              donde termina el círculo — sin tocar la posición del círculo,
              que se queda centrado en la fila como el resto de los íconos de
              la cabecera.
              ⚠️ **`ml-2` PROPIO, no sólo el `gap-1` de la fila (08-sep-2026,
              pedido del dueño: «no tienen buena distancia del filtro por
              canal»)**: el `gap-1` (4px) es el mismo que separa Chats de
              Llamadas, un par que SÍ tiene que leerse pegado —son la misma
              pestaña, dos vistas—. El botón azul es otra cosa: un color
              sólido con sombra al lado de texto plano a 4px se leía apretado,
              no como dos grupos. El margen extra va SOLO acá (el primero del
              grupo de pestañas), no en el `gap` general: separar el botón del
              grupo, sin aflojar el grupo entre sí. */}
          <button
            type="button"
            role="tab"
            tabIndex={expandida ? -1 : undefined}
            aria-selected={pestana === 'chats'}
            onClick={() => setPestana('chats')}
            className={
              'ml-2 flex h-7 items-center justify-center border-b-2 px-1 text-[13px] font-bold transition-colors max-md:h-10 max-md:px-1.5 max-md:text-[15px] ' +
              (pestana === 'chats'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            Chats
          </button>
          <button
            type="button"
            role="tab"
            tabIndex={expandida ? -1 : undefined}
            aria-selected={pestana === 'llamadas'}
            onClick={() => setPestana('llamadas')}
            className={
              'flex h-7 items-center justify-center border-b-2 px-1 text-[13px] font-bold transition-colors max-md:h-10 max-md:px-1.5 max-md:text-[15px] ' +
              (pestana === 'llamadas'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            Llamadas
          </button>

          {/* ══ EL BUSCADOR — ícono que se expande hacia la izquierda,
              pedido del dueño (07-sep-2026) ══
              `absolute inset-0` los dos estados, para que el único cambio
              entre colapsado y expandido sea de clases — nunca de montaje
              (ver el docblock grande de `busquedaAbierta`, arriba del
              `return`, sobre por qué el atajo global `/` lo exige). */}
          <div
            className={
              /* `absolute inset-0` en los dos estados: un `mb-2` acá no
                 pintaría nada (`inset-0` fija los cuatro bordes contra el
                 padre `relative`, sin importar el margen). */
              'flex items-center gap-2 rounded-full transition-[opacity] ' +
              (expandida
                ? 'absolute inset-0 z-20 border border-border bg-card px-3 opacity-100 focus-within:border-primary'
                : 'pointer-events-none absolute inset-0 z-0 opacity-0')
            }
          >
            <Search size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={(el) => {
                campoBusquedaRef.current = el;
                if (typeof inputRef === 'function') inputRef(el);
                else if (inputRef) inputRef.current = el;
              }}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onFocus={() => setBusquedaAbierta(true)}
              onBlur={() => setBusquedaAbierta(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  if (busqueda) setBusqueda('');
                  else (e.target as HTMLInputElement).blur();
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setIdxFoco(0);
                  refsFilas.current[0]?.focus();
                }
              }}
              tabIndex={expandida ? undefined : -1}
              placeholder="Buscar nombre, teléfono o texto…"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground max-md:text-base"
            />
            {busqueda && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setBusqueda('')}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* El ícono del buscador y el de chat nuevo, pegados a la derecha
            (pedido del dueño, 07-sep-2026) — antes vivían en su propio
            renglón, arriba de Todo/No leídos/Favoritos. */}
        <span className="flex shrink-0 items-center gap-1.5">
          {!expandida && (
            <button
              type="button"
              title="Buscar nombre, teléfono o texto…"
              aria-label="Buscar nombre, teléfono o texto…"
              onClick={() => campoBusquedaRef.current?.focus()}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground max-md:size-10"
            >
              <Search size={15} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            title={conectado ? 'Chat nuevo (a un número que no está en la cola)' : 'WhatsApp no está conectado'}
            disabled={!conectado}
            onClick={() => setNuevoAbierto((v) => !v)}
            className={botonAzulClass}
          >
            <MessageSquarePlus size={14} />
          </button>
        </span>
      </div>

      {pestana === 'llamadas' ? (
        // Sólo el cartel — pedido explícito del dueño: nada más todavía.
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
          <Phone size={28} className="mb-1 text-muted-foreground/50" aria-hidden="true" />
          <p className="font-heading text-2xl font-bold text-navy-ink">Próximamente</p>
        </div>
      ) : (
        <>
      {/* Header: tabs + filtros — la búsqueda y el chat nuevo se fueron arriba,
          al lado de Chats/Llamadas (07-sep-2026, pedido del dueño).
          ⚠️ **`px-2`, no `px-3` (08-sep-2026, pedido del dueño: «alineemos
          los botones al filtro por canal»)**: la fila de arriba —el botón
          azul, Chats/Llamadas— vive en `px-2`; con `px-3` acá, el borde
          izquierdo de Todo/No leídos y de la barra de chips quedaba 4px más
          adentro que el botón, así que las dos filas no se leían como parte
          de la misma columna. `BarraFiltros.tsx` sangra con `-mx-3`/`px-3`
          contra ESTE padding (para que sus chips lleguen hasta el borde del
          panel) — ese número bajó con éste, en el mismo commit, o el sangrado
          se desalinea de nuevo. */}
      <div className="shrink-0 border-b border-border px-2 pb-2 pt-3">
        {nuevoAbierto && (
          <div className="mb-2 rounded-xl border border-border bg-muted/30 p-2">
            <div className="flex gap-1.5">
              <input
                value={nuevoTel}
                onChange={(e) => setNuevoTel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && alTocarAbrir()}
                autoFocus
                inputMode="tel"
                placeholder="Teléfono con país, ej. 51 986…"
                className="w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1.5 font-mono text-xs outline-none focus:border-primary placeholder:font-sans max-md:py-2.5 max-md:text-base"
              />
              <input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && alTocarAbrir()}
                placeholder="Nombre (opcional)"
                className="w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs outline-none focus:border-primary max-md:py-2.5 max-md:text-base"
              />
              {/* EL BOTÓN, Y EL MENÚ DE LÍNEAS COLGANDO DE ÉL.
                  Molde: `vistas/BotonAbrirChat.tsx` (el de la tarjeta del
                  Pipeline). Mismo texto de encabezado, mismos items con su
                  ícono, mismo cierre por `usePopover`. Lo que NO se copia es
                  `ladoDelMenu`: acá el disparador está arriba de todo en una
                  columna que no scrollea hacia arriba, así que el menú siempre
                  cae hacia abajo. */}
              <span className="relative shrink-0">
                <button
                  ref={dispararNuevo}
                  type="button"
                  // El título dice lo que el botón VA a hacer, y son dos cosas
                  // distintas: con una sola línea abre derecho, con varias
                  // pregunta primero.
                  title={hayQueElegirLinea ? 'Abrir el chat — elige por qué línea' : 'Abrir el chat'}
                  aria-haspopup={hayQueElegirLinea ? 'true' : undefined}
                  aria-expanded={hayQueElegirLinea ? menuLineaAbierto : undefined}
                  onClick={alTocarAbrir}
                  disabled={nuevoTel.replace(/\D/g, '').length < 8}
                  className="rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white transition-[background-color,transform] hover:bg-navy/90 active:scale-[0.97] disabled:opacity-40 max-md:py-2.5 max-md:text-sm"
                >
                  Abrir
                </button>

                {menuLineaAbierto && (
                  <>
                    <span {...propsMenuLinea} />
                    <div
                      role="menu"
                      aria-label="Por qué línea escribirle"
                      className="absolute right-0 top-9 z-30 w-56 rounded-xl bg-card p-1.5 text-left shadow-panel"
                    >
                      <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold text-muted-foreground">
                        ¿Por qué línea le escribís?
                      </p>
                      {opcionesNuevo.map((o, i) => (
                        <button
                          key={o.numero ?? i}
                          ref={i === 0 ? primerItemLinea : undefined}
                          type="button"
                          role="menuitem"
                          onClick={() => abrirChatNuevo(o.numero)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50"
                        >
                          <Smartphone size={13} className="shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{o.etiqueta}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Abre el hilo vacío. El mensaje lo escribes tú — nada sale solo.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {/* Tabs: el eje de la cola. No se encogen: son el control principal. */}
            <div className="flex shrink-0 gap-0.5 rounded-lg bg-muted/60 p-0.5" role="tablist" aria-label="Filtrar la cola">
              {TABS.map((t) => (
                <button
                  key={t.valor}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.valor}
                  onClick={() => setTab(t.valor)}
                  className={
                    'rounded-md px-2.5 py-1 text-xs font-bold transition-colors max-md:px-3 max-md:py-2 max-md:text-[13px] ' +
                    (tab === t.valor ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* La barra que se corre: los filtros que sirven + las listas de la vendedora. */}
        <div className="mt-2">
          <BarraFiltros
            filtroSec={filtroSec}
            onFiltro={setFiltroSec}
            conteos={conteosFiltro}
            opciones={opcionesLinea}
            lineaActiva={linea}
            onLinea={setLinea}
            catalogo={catalogo}
            categoriaActiva={categoriaActiva?.nombre ?? null}
            /* La categoría afina lo que ya se está mirando: el tab y los demás
               filtros siguen puestos, tal como se ven en la barra. */
            onCategoria={setCategoriaActiva}
            onAdministrarCategorias={() => setGestorAbierto(true)}
            extraDerecha={
              deAntes ? (
                <SelloDeAntes texto={deAntes} actualizando={actualizando} />
              ) : (
                !cargando &&
                total > 0 &&
                !hayFiltroActivo && (
                  /* «PARA VOS» Y NO «EN COLA» CUANDO LA COLA YA ES LA SUYA.
                     Al sacar la píldora «Vos» —que en una cola propia sería la misma
                     marca en todas las filas— quedó una pantalla sin UN SOLO indicio
                     de que lo que se ve es lo asignado a quien mira. 18 filas sin
                     dueño visible se leen exactamente igual que la cola de todos, y
                     así se leyeron: «sigo viendo todos».
                     ⚠️ Lo decidía `enElReparto` («¿está en una rueda?»); ahora lo
                     decide `colaRecortada`, que es el HECHO de que el server haya
                     aplicado la frontera. El porqué de cada palabra, en el componente.
                     Bajó de la fila de los tabs a ésta (pedido del dueño, quedar a
                     la altura de «Todas»/«Categorías»), sin cambiar ni el cálculo
                     ni la alineación a la derecha. */
                  <RotuloDeLaCola total={total} recortada={colaRecortada} lineaPropia={conLineaPropia} />
                )
              )
            }
          />
        </div>

        {/* QUÉ ESTÁ FILTRADO AHORA MISMO. Una cola de 1.866 que muestra 12 sin
            decir por qué hace creer que no hay trabajo: acá se nombra cada
            recorte y se sale de todos con un gesto. */}
        {recortes.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Filter size={11} className="shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 truncate">
              <span className="font-mono tabular-nums text-foreground">{nVisibles.toLocaleString('es')}</span>{' '}
              {nVisibles === 1 ? 'conversación' : 'conversaciones'} con {recortes.map((r) => r.label).join(' + ')}
            </p>
            <button
              type="button"
              onClick={limpiarFiltros}
              className="shrink-0 rounded-md px-1.5 py-0.5 font-bold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 max-md:px-3 max-md:py-2 max-md:text-xs"
            >
              Ver todo
            </button>
          </div>
        )}
      </div>

      {avisoPin && (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-warning/10 px-3 py-2 text-[12px] font-medium text-warning-foreground">
          <span className="min-w-0 flex-1">{avisoPin}</span>
          <button type="button" onClick={() => setAvisoPin(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X size={13} />
          </button>
        </div>
      )}

      {/* El server no pudo leer el estado personal: la cola sirve igual, pero
          fijar/marcar no va a guardar nada. Se dice, no se esconde. */}
      {sinEstado && (
        <p className="border-b border-border bg-warning/10 px-3 py-2 text-[12px] font-medium text-warning-foreground">
          Fijar, favoritos y «sin leer» no están disponibles todavía — falta aplicar el cambio de base en
          el servidor. El resto de la cola funciona normal.
        </p>
      )}

      {/* Se pidió «Las mías» y el mapa no le asigna ninguna línea: el server
          sirvió TODO (fail-open). Se dice, porque una cola completa con el
          filtro encendido se ve idéntica a una cola filtrada — y la vendedora
          creería que esas conversaciones son suyas. */}
      {sinLineasPropias && (
        <p className="border-b border-border bg-warning/10 px-3 py-2 text-[12px] font-medium text-warning-foreground">
          Todavía no tienes líneas asignadas, así que estás viendo todas. Pide que te asignen la tuya
          desde el panel de Cerberus.
        </p>
      )}

      {/* `overscroll-contain` en el celular: sin él, arrastrar hacia abajo con
          la lista ya arriba de todo encadena el gesto a la página y Chrome de
          Android la RECARGA — con un borrador a medias. El `safe-area` de abajo
          es la barra de gestos: la última fila no puede quedar debajo. Y
          `--piso-movil` es la píldora Mensajes/Pipeline de campaña (ADR 0113),
          que flota encima: la publica `App.tsx` sólo cuando la monta. */}
      <div
        className="min-h-0 flex-1 overflow-y-auto max-md:overscroll-contain max-md:pb-[calc(var(--piso-movil,0px)+env(safe-area-inset-bottom))]"
        onKeyDown={onTeclasLista}
        data-scroll-cola
      >
        {pinVisible && (
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-l-[3px] border-border border-l-navy bg-card py-2.5 pl-3 pr-2">
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              Abierta desde {origenPin} — no coincide con {busqueda ? 'tu búsqueda' : 'este filtro'}
            </p>
            <button
              type="button"
              onClick={() => (busqueda ? setBusqueda('') : limpiarFiltros())}
              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-primary/10"
            >
              {busqueda ? 'Limpiar búsqueda' : 'Ver en Todo'}
            </button>
          </div>
        )}

        {aviso && (
          <AvisoFilaQueBajo
            aviso={aviso}
            onFijar={conversacionAbierta ? () => togglear(conversacionAbierta, 'fijada') : undefined}
          />
        )}

        {falla && items.length > 0 && (
          // Lo que se ve es la cola de antes: el último pedido falló, y se dice arriba de ella.
          <FallaConReintento
            compacta
            error={falla}
            generico="No se pudo actualizar la cola."
            onReintentar={reintentar}
            reintentando={reintentando}
          />
        )}

        {falla && items.length === 0 ? (
          // 🔴 Sin esto, una cola en error y sin datos se veía VACÍA, y con la frescura al día eso era
          // «Estás al día»: un festejo encima de una falla. El server cerró con 503 (ADR 0108).
          <FallaConReintento
            error={falla}
            generico="La cola no llegó del servidor."
            onReintentar={reintentar}
            reintentando={reintentando}
          />
        ) : cargando ? (
          /* Skeleton con la anatomía real de la fila: avatar + dos barras. */
          <div aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-start gap-3 border-b border-border py-3 pl-4 pr-3">
                <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="min-w-0 flex-1 space-y-2 pt-1">
                  <div className={'h-3 animate-pulse rounded bg-muted ' + (i % 2 ? 'w-2/5' : 'w-1/3')} />
                  <div className={'h-3 animate-pulse rounded bg-muted ' + (i % 3 ? 'w-4/5' : 'w-3/5')} />
                </div>
              </div>
            ))}
          </div>
        ) : visibles.length === 0 ? (
          busqueda ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              Ninguna conversación cargada coincide con «{busqueda}».
            </p>
          ) : vacioPorAtraso && sinFiltros ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-bold text-foreground">No hay nada acá, pero no es porque estés al día.</p>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                La última captura fue {hace(horasFrescura)}. Hay{' '}
                {frescura.total.toLocaleString('es')} interacciones guardadas, pero ninguna es lo bastante
                reciente como para entrar en la cola.
              </p>
            </div>
          ) : despachada && felicitacionConRespaldo ? (
            <div className="px-6 py-14 text-center">
              {typeof nHoy === 'number' && nHoy > 0 ? (
                <>
                  <p className="font-heading text-3xl font-bold tabular-nums text-navy-ink">
                    Respondiste a {nHoy} {nHoy === 1 ? 'persona' : 'personas'} hoy
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">Estás al día: no queda deuda en la cola.</p>
                </>
              ) : (
                <>
                  <p className="font-heading text-3xl font-bold text-navy-ink">Estás al día</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">No queda deuda en la cola ahora mismo.</p>
                </>
              )}
              {statsDia.isError && (
                // La cifra del día sale de `/api/dashboard`, que también cierra con 503 si no lee las líneas.
                <FallaConReintento
                  compacta
                  error={statsDia.error}
                  generico="No pudimos traer tu cifra de hoy."
                  onReintentar={() => void statsDia.refetch()}
                  reintentando={statsDia.isFetching}
                />
              )}
              {/* La guarda va AUNQUE la query esté apagada en campaña: su clave es la misma
                  en los dos módulos, y un conteo de ventas guardado en el caché lo dibujaría. */}
              {!esDeCampana && nPreguntoPrecio > 0 ? (
                <button
                  type="button"
                  onClick={() => setFiltroSec('pregunto-precio')}
                  className="mt-4 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  Ver los {nPreguntoPrecio} que preguntaron precio →
                </button>
              ) : onIrAgenda ? (
                <button
                  type="button"
                  onClick={onIrAgenda}
                  className="mt-4 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  Revisa tu Agenda{nAgenda > 0 ? ` — ${nAgenda} para hoy` : ''} →
                </button>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  Revisa tu Agenda{nAgenda > 0 ? ` — ${nAgenda} para hoy` : ''}.
                </p>
              )}
            </div>
          ) : sinFiltros && frescura == null ? (
            /* La frescura todavía no llegó: sin ella no se puede afirmar «al día». */
            <div className="space-y-2 px-6 py-12" aria-hidden="true">
              <div className="mx-auto h-3 w-2/3 animate-pulse rounded bg-muted" />
              <div className="mx-auto h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <div className="px-4 py-12 text-center">
              {/* 🔴 EL VACÍO TIENE QUE DECIR SU MOTIVO, y para quien trajo su
                  propia línea el motivo es OTRO. Desde el 18-ago-2026 esa
                  persona ve su línea entera más lo que le asignen — y el día del
                  deploy puede no tener nada asignado todavía (el dueño reparte a
                  mano; medido: cero filas en `conversacion_asignada` para las
                  dos). Con el texto de siempre lee «no entró nada», que es
                  FALSO: entró, no es suyo. Es la misma forma que el Dashboard
                  usa con `soloMisAsignadas` (ADR 0036), y por el mismo motivo:
                  un vacío sin explicación se lee «se perdieron las
                  conversaciones». Sólo con la cola limpia — con un filtro puesto
                  el motivo del vacío es el filtro, y decir otra cosa mentiría. */}
              {conLineaPropia && !hayFiltroActivo ? (
                <VacioDeLineaPropia />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {categoriaActiva
                    ? `Nadie en «${categoriaActiva.nombre}» todavía.`
                    : filtroSec
                      ? 'Nada con ese filtro.'
                      : opcionCanal
                        ? `Nada por ${opcionCanal.label} todavía.`
                        : tabMeta.vacio}
                </p>
              )}
              {hayFiltroActivo ? (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  Ver todo lo que entró
                </button>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Puedes abrir un chat nuevo con el botón + de arriba.
                </p>
              )}
            </div>
          )
        ) : (
          visibles.map((c, i) => (
            <div key={c.clave} className="group/fila relative">
              <FilaConversacion
                c={c}
                esDeCampana={esDeCampana}
                seleccionada={seleccionada === c.clave}
                onAbrir={onSeleccionar}
                etapa={c.etapa_manual}
                mostrarPregunto={filtroSec !== 'pregunto-precio'}
                catalogoCategorias={catalogo}
                esNueva={esNueva(c)}
                indice={i}
                tabIndex={i === idxSeguro ? 0 : -1}
                onFocus={() => setIdxFoco(i)}
                // Para resolver por qué transporte sale esta conversación: la cuenta
                // regresiva de 24 h sólo se dibuja donde el plazo se cumple de verdad
                // (`dominio/ventana.ts:plazoDuro`).
                lineas={lineas}
                ref={(el) => {
                  refsFilas.current[i] = el;
                }}
              />
              {/* Acciones de organización: fuera del <button> de la fila (HTML no
                  anida botones). Una sola flechita ▼ que abre el menú con las
                  tres acciones escritas — antes eran tres iconos sueltos que al
                  hover se pintaban encima de la hora y la escondían. El espacio
                  se lo reserva `FilaConversacion` (`pr-9`), así la fila no salta
                  cuando la flechita aparece y desaparece. */}
              <MenuFila
                clave={c.clave}
                estado={c}
                tabIndex={i === idxSeguro ? 0 : -1}
                onFijar={() => togglear(c, 'fijada')}
                onFavorita={() => togglear(c, 'favorita')}
                onLeido={() => marcarLeido(c, Boolean(c.no_leido))}
              />
            </div>
          ))
        )}

        {/* Fuera del ternario a propósito: también bajo el vacío de búsqueda,
            donde se vuelve la salida del dead-end. Con etiqueta activa la
            página siguiente se pide sola (el efecto de arriba) — el botón
            no tiene nada que hacer ahí, mostrarlo igual sería prometer un
            clic que no hace falta. */}
        {!cargando && hayMas && !categoriaActiva && (
          <div className="p-3">
            <button
              type="button"
              onClick={cargarMas}
              disabled={cargandoMas}
              className="w-full rounded-lg border border-border py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50 max-md:py-3 max-md:text-sm"
            >
              {cargandoMas ? 'Cargando…' : busqueda && visibles.length === 0 ? 'Buscar en más historia' : 'Ver más'}
            </button>
          </div>
        )}
        {!cargando && !hayMas && busqueda !== '' && visibles.length === 0 && (
          <p className="pb-4 text-center text-[11px] text-muted-foreground">Ya está cargada toda la historia.</p>
        )}
      </div>
        </>
      )}
      </div>

      {gestorAbierto && <GestorCategorias onCerrar={() => setGestorAbierto(false)} />}
    </div>
  );
}
