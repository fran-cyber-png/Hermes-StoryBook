import { useEffect, useReducer, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns3,
  History,
  Info,
  List,
  MessageSquareOff,
  X,
  type LucideIcon,
} from 'lucide-react';
import { api, ErrorApi } from '../../lib/datos/cliente';
import {
  useTablero,
  type ColumnaDelTablero,
  type Conversacion,
} from '../../dominio/conversaciones';
import { useLineas } from '../../dominio/lineas';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { ETAPA_ROTULO, type Etapa } from '../../lib/etapas';
import { cifra } from '../../lib/formato';
import { decidirDrop, decidirRebote, reintentoTrasInteres } from './compuertas';
import { ModalInteresCotizado, ModalVentaCierre } from './ModalesCompuerta';
import { HojaContacto } from '../panel/HojaContacto';
import type { DestinoCorreo } from '../../lib/puente';
import { TarjetaEmbudo } from './TarjetaEmbudo';
import { cotizarEnUnClic } from './tarjeta';
import {
  ANCHO_MIN_COLUMNA,
  cifrasDeColumna,
  columnasDe,
  COLUMNA_CON_FRANJA,
  contarHoy,
  esRecorteSemaforo,
  etapaDeTarjeta,
  plantillaColumnas,
  primeraParaAtender,
  quedanPorTraer,
  recortesDeColumna,
  repartirColumnas,
  resumirBandeja,
  resumirColumna,
  tarjetasVisibles,
  totalServidoDe,
  vacioDeColumna,
  type ColumnaTablero,
  NOMBRE_DEL_RECORTE_DEL_DIA,
  TITULO_NUEVAS_HOY,
  type EtapaTrabajo,
  type Recorte,
} from './tablero';
import { esRecorteDelDia, type RecorteDelDia } from '../../dominio/recortesDelDia';
import { FiltroCuando } from './FiltroCuando';
import { limitesDe } from './franja';
import { CabeceraPipeline } from './CabeceraPipeline';
import { TiraDeChips } from './TiraDeChips';
import { ListaPipeline } from './ListaPipeline';
import { filasDeLista } from './lista';
import {
  chipsDeColumnaVisibles,
  hayRango,
  MESA_INICIAL,
  mesaSiguiente,
  origenDelVacio,
  rangoDelTablero,
  recorteDeLaColumna,
} from './mesa';
import { planDelPuente, resolverRecorteDelPuente, type PuentePipeline } from './puentePipeline';
import { nombreDeCanal } from '../../components/BadgeCanal';
import {
  alcanceDeCanal,
  CANAL_INICIAL,
  canalesDeLaMesa,
  conteoPorCanal,
  filasDelCanal,
  TODOS_LOS_CANALES,
} from './canalDeMesa';
import { respondidosDeLaMesa, resumirTablero } from './resumen';
import { CabeceraColumna, type CeldaDelDia } from './CabeceraColumna';
import { ICONO_DE_ETAPA } from './iconoDeEtapa';

/**
 * EL PIPELINE — el tablero de venta de la vendedora.
 *
 * QUÉ PASABA (medido en producción el 2026-07-25, 1.865 conversaciones): de 300
 * Contactadas muestreadas, las 300 estaban respondidas —es decir, TODA la única
 * columna con tarjetas era gente cuya pelota no es nuestra— mientras las 476 que
 * sí esperan respuesta vivían apretadas en un contador gris de una línea que
 * además decía algo falso («nadie les respondió aún») para 218 de ellas. Las
 * otras tres columnas estaban en cero sobre 1.366 px de ancho, y 611
 * conversaciones con el precio ya mandado no figuraban en Cotizados porque la
 * compuerta pide un interés tipeado a mano que nadie tipea (uno en toda la base).
 *
 * QUÉ HACE AHORA, en el mismo orden en que se lee:
 *
 *   1. LA BANDEJA (`BandejaDeuda`) encabeza el tablero y dice la verdad: cuántas
 *      esperan, cuántas están escribiendo AHORA, cuántas nunca abrimos y cuántas
 *      volvieron a escribir. Sigue sin ser columna (decisión del dueño, #87).
 *   2. LAS COLUMNAS pesan lo que trabajan: Contactados se lleva el ancho, y las
 *      vacías explican cómo se llenan en vez de ser un hueco blanco.
 *   3. EL RECORTE «Con precio» convierte las 1.389 en la lista que importa: las
 *      que ya están cotizadas de hecho y no figuran como tales.
 *   4. EL BOTÓN «Cotizado» de la tarjeta cierra el hueco: cuando ya sabemos el
 *      curso (registrado o del formulario), un clic asienta el interés y mueve.
 *      La compuerta del server NO se relaja — se satisface (`registrarGestion`).
 *
 * Lo que NO cambió: se arrastra igual, las compuertas guían con sus modales
 * (#60), el cierre se sigue ganando solo con una venta registrada, y la etapa la
 * dice el server (ADR 0013) — el front no inventa ninguna.
 */

/**
 * La grilla: aguanta 1280 sin reflow (es una app de escritorio, no una página)
 * y con `overflow-x-auto` como red de seguridad, no como plan.
 *
 * ⚠️ **HASTA ACÁ CADA COLUMNA PESABA DISTINTO A PROPÓSITO** —Contactados y
 * Cotizados se llevaban el ancho, Cierre era un cajón chico— porque el ancho
 * decía dónde está el trabajo. El dueño pidió lo contrario (ADR 0089): **todas
 * del mismo ancho**, y la posibilidad de ocultar una que hoy no toca mirar sin
 * perder de vista cuál es (`colapsadas`, más abajo). `plantillaColumnas`
 * (`tablero.ts`) arma el `grid-template-columns` en cada render: `minmax(215px,
 * 1fr)` parejo para todas, o la franja fija (`ANCHO_COLUMNA_COLAPSADA`) para
 * las que están colapsadas.
 *
 * 215 no es un mínimo nuevo sin probar: era el de «Te esperan», la columna más
 * angosta del reparto viejo, y `TarjetaEmbudo` ya está probada contra una de
 * 225 (el chip «Formulario» se movió a un segundo renglón por eso).
 *
 * 🔴 **LO QUE SIGUE SIENDO CIERTO, y esta decisión no lo reabre**: seis
 * columnas no entran a 1280 —se midió, la captura mostró la última cortada
 * contra el borde con las tarjetas desbordadas— así que Ventas tiene cinco y
 * Campaña otras cinco (`COLUMNAS_TRABAJO`/`COLUMNAS_CAMPANA`, `tablero.ts`).
 * Acá solo cambió CUÁNTO ANCHO se le da a cada una que sí se dibuja, no
 * cuántas ni cuáles son.
 */
const GRID = 'grid min-h-0 flex-1 gap-2 overflow-x-auto';

/**
 * El ícono de cada recorte. Vive acá y no en `tablero.ts` porque un componente de
 * lucide no es política: `recortesDeColumna` decide QUÉ se ofrece y con qué
 * número, esto solo lo dibuja. Así el módulo puro se puede testear en `node` sin
 * arrastrar React.
 */
const ICONO_RECORTE: Record<Recorte, LucideIcon | null> = {
  todas: null,
  precio: BadgeDollarSign,
  ventana: Clock,
  seguir: History,
  seCallo: MessageSquareOff,
  // Las luces ya no son chips de columna —se recortan desde la leyenda de
  // arriba, para las cinco—, pero siguen siendo `Recorte` y el tipo pide su
  // entrada. Nunca llegan a dibujarse acá.
  verde: null,
  ambar: null,
  gris: null,
  rojo: null,
  // Los recortes del día los pone la mesa (el puente), nunca un chip de columna.
  escribioHoy: null,
  sinRespuesta24h: null,
};

export function VistaEmbudo({
  onAbrir,
  onAgendarBienvenida,
  onEscribir,
  miVendedora,
  esDeCampana,
  onMandarCorreo,
  recorteInicial,
  onConsumido,
}: {
  onAbrir: (c: Conversacion) => void;
  /** La siguiente jugada del recibo de venta (cae en la Agenda vía puente). */
  onAgendarBienvenida?: (telefono: string | null) => void;
  /** Puente a Mensajes para iniciar un chat nuevo desde la ficha. */
  onEscribir?: (telefono: string) => void;
  /** Quién mira — la `HojaContacto` la necesita para el timeline (ADR 0037). */
  miVendedora?: string | null;
  /**
   * ¿Quien mira trabaja en el módulo de CAMPAÑAS? Baja hasta `PanelDerecho`,
   * que apaga con esto las tres consultas que van contra Cerberus (`modulos/
   * modulo.ts`). Opcional: sin él se comporta como el panel de siempre.
   */
  esDeCampana?: boolean;
  /** Puente a Correos: baja hasta la ficha de la hoja. Sin esto, ahí no hay «Escribirle». */
  onMandarCorreo?: (destino: DestinoCorreo) => void;
  /**
   * EL PUENTE DESDE EL DASHBOARD (ADR 0104): abrir el Pipeline ya recortado. Se
   * aplica UNA vez y se limpia con `onConsumido`, el mismo patrón que la Agenda:
   * a partir de ahí mandan los controles de esta pantalla.
   */
  recorteInicial?: PuentePipeline | null;
  onConsumido?: () => void;
}) {
  const qc = useQueryClient();
  /**
   * LAS LÍNEAS SE PIDEN UNA VEZ, ACÁ, y bajan por prop hasta el botón de cada
   * tarjeta: son cientos de tarjetas y `useLineas()` adentro de cada una sería
   * una suscripción por tarjeta a la misma lista. La query se comparte con la
   * barra de filtros de la cola (misma `queryKey`, `staleTime` de 5 min), así
   * que entrar al Pipeline no agrega un request.
   */
  // `veTodo` viaja con las líneas: es el rol (supervisor o admin) que decide si
  // cada tarjeta dice a quién está asignada. Misma señal que usa el selector de
  // líneas de la cola (`canales/alcance.ts`), no una segunda regla del rol.
  const { lineas, veTodo } = useLineas();
  /**
   * ══ LA MESA: el rango, el recorte de arriba, los de columna y la franja ═════
   *
   * UN estado y no cuatro, porque los cuatro ejes se apagan entre sí y esas
   * exclusiones vivían escritas a mano en cada `onClick`. Qué convive con qué lo
   * decide `mesaSiguiente` (`mesa.ts`, puro y con tests); acá sólo se despacha.
   *
   * Tocar «Verdes 278» aplica esa luz a LAS CINCO columnas y le gana al recorte
   * de cada una. Poner la luz limpia los de columna y la franja: un «Para seguir»
   * vivo debajo de «Verdes» sería un filtro cruzado sin botón a la vista que lo
   * apague, y un conteo («12 de 1.109») que no dice cuál de los dos lo achicó.
   *
   * ── EL RECORTE DE CADA COLUMNA (§3.1 del plan) ──
   * Hasta el 8-ago-2026 había **un solo recorte, global a la vista**, y solo se
   * dibujaba arriba de Contactados. Desde que el embudo se DERIVA la pila se mudó
   * a Cotizados —3.064 tarjetas— y la única columna con recorte quedó con 534:
   * una columna de 3.064 no es una lista de trabajo, es la misma pila con otro
   * rótulo. Cada eje sigue siendo UNO con varias posiciones y no varios toggles
   * (cruzar «con precio» × «en ventana» × «para seguir» daría ocho estados); qué
   * chips se ofrecen lo decide `recortesDeColumna`, no este componente.
   */
  const [mesa, despachar] = useReducer(mesaSiguiente, MESA_INICIAL);
  /**
   * Qué rangos precargar: los que no están puestos, y sólo si el server ya dijo que
   * los sabe servir. Se lee de la respuesta ANTERIOR (un render de atraso), que es
   * justo cuando la precarga puede salir: después de que la visible contestó.
   */
  const [serverSabeDeRangos, setServerSabeDeRangos] = useState(false);
  const precargaDeRangos = serverSabeDeRangos
    ? (['hoy', 'd7', 'cola'] as const).filter((r) => r !== mesa.rango).map((r) => rangoDelTablero(r, new Date()))
    : [];
  const recorteDe = (etapa: EtapaTrabajo): Recorte => recorteDeLaColumna(mesa, etapa);

  /**
   * LA LÍNEA QUE ACOTA EL TABLERO ENTERO — hoy sólo la pone el puente del
   * Dashboard (ADR 0104). No se guarda: es de esa visita, y se ve como un chip con
   * su ✕ en la fila de arriba, nunca como un filtro escondido.
   */
  const [linea, setLinea] = useState<string | null>(null);
  /**
   * Lo mismo para el canal DEL PUENTE: los DMs que no entraron por ninguna línea.
   * Mientras está puesto le gana al ícono (`canalDeMesa.ts#alcanceDeCanal`).
   */
  const [canal, setCanal] = useState<'facebook' | 'instagram' | null>(null);
  /**
   * ══ EL CANAL DE LA MESA — la fila de íconos (13-sep-2026, `canalDeMesa.ts`; ══
   * en las dos mesas desde el 14-sep, ADR 0103 §9)
   *
   * «Te esperan» sumaba chats, DMs y COMENTARIOS en una cifra, y mil y pico se
   * leían como mil y pico personas esperando por WhatsApp. La mesa se mira canal
   * por canal en LOS DOS módulos y **arranca en WhatsApp** en los dos (decisión
   * del dueño, 14-sep-2026: lo que se trabaja al abrir son los chats), cada vez
   * que se entra: no se guarda, igual que el rango. `canalesDeLaMesa` y
   * `alcanceDeCanal` reciben el módulo y resuelven contra SU lista (ventas suma
   * Formulario); la mecánica es una sola.
   *
   * ⚠️ La primera versión de ventas (#1073, un día en `desarrollo`) arrancaba en
   * «Todos» para no cambiar el pedido byte a byte; nunca llegó a producción.
   */
  const moduloDeLaMesa: 'ventas' | 'campana' = esDeCampana ? 'campana' : 'ventas';
  const [canalElegido, setCanalElegido] = useState<string>(CANAL_INICIAL);
  const alcanceCanal = alcanceDeCanal(canalElegido, canal, moduloDeLaMesa);

  /**
   * ══ LA FRANJA DE TIEMPO — «¿a quiénes les escribí hoy?» (`franja.ts`) ═════
   *
   * UNA sola, la de `COLUMNA_CON_FRANJA`: el server acepta una franja por pedido
   * porque tiene que nombrar a qué columna se la aplica (`?franjaEn=`). Guardar
   * un mapa por etapa sería inventar un estado que no se puede mandar.
   *
   * 🔴 **FRANJA Y RECORTE SON EL MISMO EJE, Y POR ESO SE APAGAN ENTRE SÍ.** No es
   * gusto: los números de los chips salen del DESGLOSE, que se cuenta una vez
   * para todo el tablero y no sabe de franjas. Cruzados, «Para seguir 1.349»
   * quedaría escrito arriba de una lista de sesenta — que es exactamente el
   * defecto que `recortesDeColumna` persigue con la regla del cero, dicho al
   * revés. Con exclusión, cada chip promete un número que es cierto: el de la
   * lista que aparece cuando lo tocas.
   */
  const franja = mesa.franja;

  /**
   * El recorte de una columna, como lo pide el tablero. `todas` = sin recorte.
   *
   * ⚠️ Los instantes de la franja se resuelven ACÁ, en cada render, y no cuando
   * se toca el menú: «Últimos 30 min» tiene que seguir queriendo decir los
   * últimos 30 minutos diez minutos después. `limitesDe` recorta `ahora` al
   * minuto justamente para que ese recálculo no cambie la `queryKey` en cada
   * repintado (ver su docblock).
   */
  const pedidoDe = (etapa: EtapaTrabajo): ColumnaDelTablero => {
    const r = recorteDe(etapa);
    // EL SEMÁFORO (#826, S.2): el server todavía no filtra la PÁGINA por luz
    // (`cola/semaforoSql.ts` solo la CUENTA, en el desglose) — estos cuatro se
    // recortan del lado del cliente, sobre lo que ya está cargado (más abajo,
    // donde se arma `enEtapa`). Acá no viajan como `recorte`: la columna se
    // pide entera, como si el chip activo fuera «Todas».
    const base: ColumnaDelTablero = {
      etapa,
      recorte: r === 'todas' || esRecorteSemaforo(r) ? undefined : r,
    };
    if (etapa !== COLUMNA_CON_FRANJA || !franja) return base;
    const { desde, hasta } = limitesDe(franja, new Date());
    return { ...base, franja: { desde: desde.toISOString(), hasta: hasta?.toISOString() ?? null } };
  };

  // Cada columna carga LO SUYO (#89) y ahora también SU recorte. El nombre real y
  // el curso del formulario no se piden: la cola los sirve siempre (#72).
  // «Te esperan» es una columna más desde el 10-ago: el server ya la sabía servir
  // (`interesado` está en ETAPAS_CONSULTABLES), así que no hizo falta tocar nada
  // del lado de allá — lo que había era una pantalla que no la pedía.
  /**
   * ══ QUÉ TABLERO SE DIBUJA (ADR 0063) ══════════════════════════════════════
   *
   * El juego de columnas lo decide el módulo; **la cantidad ya no ata a los
   * hooks**. Antes acá había cinco `useConversaciones` desenrollados a mano
   * porque React prohíbe que la cantidad de hooks varíe entre renders — y esas
   * cinco consultas eran cinco veces la más cara del repo, con el `todo` del
   * server rearmado cinco veces por refresco (2.226 ms cada uno, medido).
   *
   * Ahora es **un** hook que recibe la lista, así que una sexta columna se
   * agrega en `tablero.ts` y nada más. Lo que sigue siendo invariante es que los
   * dos juegos tengan el mismo largo (`tablero.test.ts`), pero por lo que ese
   * test dice —el ancho de la mesa a 1280— y ya no por una restricción de React.
   */
  const columnas = columnasDe(moduloDeLaMesa);
  const tablero = useTablero(
    columnas.map((c) => pedidoDe(c.id)),
    // El rango viaja como CLAVE (con el día, para «Hoy») y sus instantes se
    // resuelven cuando sale cada pedido (`mesa.ts#rangoDelTablero`): con el
    // instante en la clave, «7 d» relanzaba el tablero entero cada minuto.
    // ⚠️ `new Date()` en el render sólo decide el DÍA de «Hoy», y sirve porque el
    // React Compiler NO compila este componente (#950: se sale por el
    // `{ [clave]: _, ...resto }` de `quitarOverride`). Compilado, la clave de «Hoy»
    // no cambiaría a la medianoche hasta que cambie `mesa.rango`.
    {
      linea,
      canal: alcanceCanal,
      rango: rangoDelTablero(mesa.rango, new Date()),
      // Los otros dos rangos, detrás (`useTablero`). Con un server que no sabe de
      // rangos (sin `recortesDisponibles`), nada: «Hoy» y «7 d» le darían 400.
      precargar: precargaDeRangos,
      // El desglose por canal y en el rango (13-sep-2026; en las dos mesas desde el
      // 14-sep): es lo que cuenta la composición de cada card. Un server que no lo
      // sabe lo ignora y contesta el desglose de siempre, sin `mesaPorCanal: true`.
      mesaPorCanal: true,
    },
  );
  const porColumna = tablero.porColumna as Record<
    EtapaTrabajo,
    (typeof tablero.porColumna)[string]
  >;

  // El desglose (conteos reales por etapa × turno × precio) viene UNA vez para
  // todo el tablero: es la misma foto, y contarla por columna era contarla cinco.
  /**
   * 🔴 CON `mesaPorCanal` EL DESGLOSE TRAE TODOS LOS CANALES, Y LA MESA MIRA UNO.
   * La composición de cada columna lee `desgloseTodosLosCanales`; todo lo demás —la
   * cifra, el «hoy», los respondidos, la bandeja y la leyenda— lee `desglose`, que
   * es el del canal elegido (`canalDeMesa.ts#filasDelCanal`). Así «Verdes 12» es lo
   * que queda al tocarlo. Un server viejo ya lo manda recortado por canal, y de 30
   * días: ahí se usa tal cual llega.
   */
  const desgloseDelRango = tablero.mesaPorCanal;
  const desgloseTodosLosCanales = tablero.desglose;
  const desglose = desgloseDelRango ? filasDelCanal(desgloseTodosLosCanales, alcanceCanal) : desgloseTodosLosCanales;
  const conteos = tablero.conteos;

  /**
   * El desglose de «Te esperan» — los dos trabajos que la tira mostraba y que
   * ahora viven en la cabecera de su columna. `resumirBandeja` no se tocó: sigue
   * siendo la misma función pura, con los mismos tests.
   */
  const bandeja = resumirBandeja(desglose, conteos);
  /** La mesa entera, para la cabecera: la suma de ESTAS columnas (`resumen.ts`). */
  const resumenMesa = resumirTablero(columnas, desglose, conteos);

  /**
   * ══ QUÉ COLUMNAS ESTÁN COLAPSADAS (ADR 0089) ═══════════════════════════════
   *
   * Preferencia de PANTALLA, no dato de negocio: va a `localStorage`, nunca al
   * server (mismo criterio que `panelColapsado` en `App.tsx`). La clave separa
   * Ventas de Campaña porque son dos tableros con trabajo distinto — colapsar
   * «Contactados» en uno no tiene por qué colapsarlo en el otro.
   */
  const [colapsadasArr, setColapsadasArr] = useLocalStorage<string[]>(
    `hermes.embudo.colapsadas.${esDeCampana ? 'campana' : 'ventas'}`,
    [],
  );
  const colapsadas = new Set(colapsadasArr);
  function alternarColapso(id: EtapaTrabajo) {
    setColapsadasArr((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const [arrastrada, setArrastrada] = useState<Conversacion | null>(null);
  const [sobre, setSobre] = useState<EtapaTrabajo | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [rebotada, setRebotada] = useState<string | null>(null);
  const timerRebote = useRef<number | null>(null);
  /**
   * Los movimientos optimistas en vuelo: clave → etapa destino. La tarjeta se
   * pinta ya en la columna nueva (repartirColumnas) y el override se levanta
   * cuando la verdad del server refresca las columnas — nunca se restaura una
   * foto local que podría deshacer movimientos de OTRAS tarjetas.
   */
  const [overrides, setOverrides] = useState<Record<string, Etapa>>({});
  /**
   * DE QUIÉN SE ESTÁ LEYENDO LA FICHA, al costado del tablero. Un clic en la
   * tarjeta la abre; antes la única forma de saber quién era esa persona era
   * irse a Mensajes y volver — o sea, perder el tablero para consultarlo.
   *
   * Guarda la conversación entera y no la clave: `PanelDerecho` la pide así, y
   * releerla de `repartidas` obligaría a decidir qué hacer cuando la tarjeta se
   * mueve de columna mientras la ficha está abierta (nada: es la misma persona).
   */
  const [ficha, setFicha] = useState<Conversacion | null>(null);
  /** La tarjeta que la compuerta de Cotizados dejó ESPERANDO el curso de interés. */
  const [pendienteInteres, setPendienteInteres] = useState<Conversacion | null>(null);
  /** La conversación soltada en Cierre: abre el formulario de Registrar venta. */
  const [ventaPara, setVentaPara] = useState<Conversacion | null>(null);

  const cargando = columnas.every((c) => porColumna[c.id]!.cargando);

  // El server desplegado todavía no habla de etapas (#88/#89 sin deploy): sin
  // `etapa_efectiva` cada columna traería el feed entero y el tablero MENTIRÍA
  // con cara de honesto. Mejor decirlo que pintarlo.
  const servidorSinEtapas = columnas.some((col) => {
    const primera = porColumna[col.id]!.items[0];
    return primera != null && primera.etapa_efectiva === undefined;
  });

  const repartidas = repartirColumnas(
    columnas.map((col) => [col.id, porColumna[col.id]!.items] as const),
    overrides,
    // Manda el tiempo: «el color no reordena» (dueño, 13-sep-2026 para campaña y
    // 14-sep para la Escuela: «por tiempo»). El orden es el del server.
    { ordenarPorLuz: false },
  );

  // «ATENDER SIGUIENTE» (#807, S.3): sobre TODO lo que el tablero ya cargó,
  // en las columnas que se están dibujando — el mismo universo que ya
  // acotaron el reparto y la frontera de cliente al pedir cada columna.
  const paraAtender = primeraParaAtender([...repartidas.values()].flat());

  function quitarOverride(clave: string) {
    setOverrides((o) => {
      const { [clave]: _, ...resto } = o;
      return resto;
    });
  }

  function marcarRebote(clave: string) {
    setRebotada(clave);
    if (timerRebote.current != null) window.clearTimeout(timerRebote.current);
    timerRebote.current = window.setTimeout(() => setRebotada(null), 1500);
  }

  /**
   * Mover una tarjeta de etapa. `curso` (opcional) es el camino corto a
   * Cotizados: asienta el interés ANTES de mover, así la compuerta del server
   * —que no se toca— encuentra lo que exige. Las dos llamadas son consecuencia
   * de UN clic humano; nada se mueve solo.
   */
  const mover = useMutation({
    mutationFn: async (v: { c: Conversacion; etapa: Etapa; curso?: string }) => {
      if (v.curso) {
        await api('/api/gestiones/intereses', {
          method: 'POST',
          body: JSON.stringify({ clave: v.c.clave, curso: v.curso }),
        });
      }
      return api('/api/gestiones', {
        method: 'POST',
        body: JSON.stringify({
          clave: v.c.clave,
          canal: v.c.canal,
          personaId: v.c.persona_id,
          personaNombre: v.c.persona_nombre,
          numeroPropio: v.c.numero_propio,
          etapa: v.etapa,
        }),
      });
    },
    // Optimista: la tarjeta se muda al soltar (override). Si algo falla, NO se
    // restaura ninguna foto local: se levanta el override y la verdad del
    // server pinta el mapa.
    onMutate: (v) => {
      setOverrides((o) => ({ ...o, [v.c.clave]: v.etapa }));
    },
    onSuccess: async (_r, v) => {
      setAviso(null);
      // El override se levanta DESPUÉS del refetch: si no, la tarjeta volvería
      // a la columna vieja un instante, hasta que llegue lo fresco.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['conversaciones'] }),
        qc.invalidateQueries({ queryKey: ['embudo'] }),
        qc.invalidateQueries({ queryKey: ['gestiones'] }),
        qc.invalidateQueries({ queryKey: ['intereses', v.c.clave] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      quitarOverride(v.c.clave);
    },
    onError: (err, v) => {
      const r = decidirRebote({
        destino: v.etapa,
        status: err instanceof ErrorApi ? err.status : null,
        mensaje: err instanceof ErrorApi ? err.message : null,
        // Carrera real: este POST pudo quedar en vuelo mientras otro drop abría
        // el modal de venta. En ese caso: aviso, jamás dos modales apilados.
        ventaAbierta: ventaPara != null,
      });
      if (r.accion === 'modal-interes') {
        // La compuerta pide el interés: la tarjeta se queda esperando en
        // Cotizados (el override sigue puesto) mientras el modal lo registra.
        setPendienteInteres(v.c);
        return;
      }
      // El fallback de siempre (red, validación): se levanta el override y el
      // motivo queda a la vista hasta el próximo arrastre o hasta cerrarlo.
      quitarOverride(v.c.clave);
      setAviso(r.mensaje);
      marcarRebote(v.c.clave);
    },
  });

  /** La vendedora desistió del interés: se levanta el override y la tarjeta vuelve. */
  function cancelarInteres() {
    if (!pendienteInteres) return;
    const c = pendienteInteres;
    setPendienteInteres(null);
    quitarOverride(c.clave);
    marcarRebote(c.clave);
  }

  /**
   * El interés quedó guardado: el drag original se completa solo (reintento del
   * POST). Todo camino termina en el server: onSuccess o onError deciden.
   */
  function guardadoInteres() {
    if (!pendienteInteres) return;
    const vars = reintentoTrasInteres(pendienteInteres);
    setPendienteInteres(null);
    if (vars) mover.mutate(vars);
  }

  /**
   * EL CAMINO CORTO A COTIZADO — el botón de la tarjeta. Si ya sabemos el curso
   * (registrado, o el que la persona eligió en el formulario), un clic asienta el
   * interés y mueve. Si no lo sabemos, no se inventa: se abre el modal que lo
   * pregunta, que es exactamente el mismo camino del arrastre.
   */
  function cotizarDesdeTarjeta(c: Conversacion) {
    setAviso(null);
    const unClic = cotizarEnUnClic(c);
    if (!unClic) {
      setOverrides((o) => ({ ...o, [c.clave]: 'cotizado' }));
      setPendienteInteres(c);
      return;
    }
    // El interés se asienta con el texto CRUDO del catálogo (`unClic.crudo`), no
    // con el nombre corto del chip: registrar «Inteligencia y Contrainteligencia»
    // guardaría un curso que no existe en Cerberus (ver `tarjeta.ts`).
    mover.mutate({ c, etapa: 'cotizado', curso: unClic.hayQueRegistrar ? unClic.crudo : undefined });
  }

  function empezarArrastre(c: Conversacion) {
    setArrastrada(c);
    setAviso(null); // el próximo arrastre limpia el aviso de compuerta
    setRebotada(null);
  }

  function terminarArrastre() {
    setArrastrada(null);
    setSobre(null);
  }

  function soltar(etapa: EtapaTrabajo) {
    if (!arrastrada) return;
    const c = arrastrada;
    setArrastrada(null);
    setSobre(null);
    const actual = etapaDeTarjeta(c, overrides);
    if (actual == null) return; // sin etapa del server no se mueve nada a ciegas
    const d = decidirDrop({
      actual,
      destino: etapa,
      canal: c.canal,
      // La cola trae el interés asentado en la fila (`interes_curso`, #72): se
      // sabe ANTES de viajar si la compuerta de Cotizado va a rebotar. Ausente
      // (undefined) = server viejo que no lo sirve: se intenta, como siempre.
      tieneInteres: c.interes_curso === undefined ? undefined : Boolean(c.interes_curso),
      // Con un modal de compuerta abierto no se suelta nada: no se apilan.
      modalAbierto: pendienteInteres != null || ventaPara != null,
    });
    if (d.accion === 'nada') return;
    if (d.accion === 'modal-interes') {
      // La tarjeta espera en Cotizados (override puesto) mientras el modal pide
      // el curso — y ofrece el del formulario como un botón.
      setOverrides((o) => ({ ...o, [c.clave]: 'cotizado' }));
      setPendienteInteres(c);
      return;
    }
    if (d.accion === 'modal-venta') {
      // El cierre no se declara: se gana registrando la venta (la compuerta del
      // server queda intacta). El modal abre el formulario con la conversación
      // precargada; al crear la venta, el server asienta `cierre` solo.
      setVentaPara(c);
      return;
    }
    if (d.accion === 'abrir') {
      // Comentario FB/IG: sin teléfono no hay ficha ni venta — a la Bandeja.
      onAbrir(c);
      return;
    }
    mover.mutate({ c, etapa: d.etapa });
  }

  /**
   * ══ TABLERO · LISTA ═════════════════════════════════════════════════════════
   *
   * Preferencia de PANTALLA, como el colapso de columnas (ADR 0089): va a
   * `localStorage` y nunca al server. Un valor guardado que no es ninguno de los
   * dos —una versión vieja, un dedazo— cae al tablero.
   */
  const [vistaGuardada, setVista] = useLocalStorage<'tablero' | 'lista'>('hermes.embudo.vista', 'tablero');
  const enLista = vistaGuardada === 'lista';

  /**
   * ══ EL PUENTE ENTRA (ADR 0104) ══════════════════════════════════════════════
   *
   * Un puente es «abre el Pipeline ASÍ»: por eso limpia lo que había (recortes de
   * columna, franja, la luz anterior) en vez de sumarse encima. Lo que no se puede
   * aplicar todavía va al aviso de siempre (`planDelPuente`). Si pide una dueña,
   * abre la Lista con ese filtro — el tablero no sabe recortar por dueña — y la
   * remonta (`key`) para que el filtro inicial se lea de nuevo.
   */
  const [filtroAsignadaInicial, setFiltroAsignadaInicial] = useState('');
  const [vecesDelPuente, setVecesDelPuente] = useState(0);
  /** El recorte del día que pidió el puente, mientras el server no dijo si lo sabe hacer. */
  const [recorteDelPuente, setRecorteDelPuente] = useState<RecorteDelDia | null>(null);
  useEffect(() => {
    if (!recorteInicial) return;
    const plan = planDelPuente(recorteInicial);
    despachar({ tipo: 'abrir', luz: plan.luz });
    setRecorteDelPuente(plan.recorteDelDia);
    setLinea(plan.linea);
    setCanal(plan.canal);
    // Las cifras del Dashboard cuentan TODOS los canales: el puente abre la mesa
    // así, y si trae un canal propio, ése le gana al ícono (`alcanceDeCanal`).
    setCanalElegido(TODOS_LOS_CANALES);
    if (plan.filtroAsignada != null) {
      setFiltroAsignadaInicial(plan.filtroAsignada);
      setVecesDelPuente((n) => n + 1);
      setVista('lista');
    }
    onConsumido?.();
  }, [recorteInicial, onConsumido, setVista]);

  /**
   * EL RECORTE DEL DÍA SE DECIDE CON LA RESPUESTA, no con el puente
   * (`resolverRecorteDelPuente`): mandarlo antes de saber si el server lo conoce
   * sería apostar el tablero entero a un 400. Con un server que no lo publica, se
   * abre sin él y se dice.
   */
  const { recortesDisponibles, contesto, fallo } = tablero;
  useEffect(() => {
    if (recortesDisponibles != null) setServerSabeDeRangos(true);
  }, [recortesDisponibles]);

  /**
   * 🔴 LA MESA ARRANCA EN «HOY», Y UN SERVER VIEJO NO SABE QUÉ ES (`mesa.ts`).
   * Sin `recortesDisponibles` (#946), `franjaEn=*` se lee como una columna que no
   * existe y el tablero entero da 400. Si eso pasa con un rango puesto, la mesa
   * vuelve a 30 días en vez de quedarse en blanco: es la ventana de siempre, y la
   * cabecera ya dice por qué «Hoy» y «7 d» están apagados.
   */
  useEffect(() => {
    if (fallo && recortesDisponibles == null && hayRango(mesa.rango)) despachar({ tipo: 'rango', rango: 'cola' });
  }, [fallo, recortesDisponibles, mesa.rango]);
  useEffect(() => {
    if (!recorteDelPuente) return;
    const r = resolverRecorteDelPuente(recorteDelPuente, recortesDisponibles, !contesto, fallo);
    if (r.tipo === 'esperar') return;
    if (r.tipo === 'aplicar') despachar({ tipo: 'recorteDelDia', recorte: r.recorte });
    else setAviso(r.aviso);
    setRecorteDelPuente(null);
  }, [recorteDelPuente, recortesDisponibles, contesto, fallo]);

  /**
   * LO QUE UNA COLUMNA DIBUJA Y CUÁNTO DICE QUE MIDE — lo leen las DOS vistas:
   * cada columna del Tablero y el pie de la Lista («Mostrando X de N»). Con dos
   * cuentas, la Lista diría un total que las columnas del Tablero no suman.
   */
  const vistaDeColumna = (col: ColumnaTablero) => {
    const columna = porColumna[col.id]!;
    const resumen = resumirColumna(desglose, col.id, conteos);
    const recorte = recorteDe(col.id);
    // EL SEMÁFORO (#826, S.2): el server no filtró la página por luz (arriba, en
    // `pedidoDe`), así que se recorta del lado del cliente, sobre lo que ya se
    // cargó y ya se ordenó por luz (`tarjetasVisibles`).
    const enEtapa = tarjetasVisibles(repartidas.get(col.id) ?? [], recorte);
    // Las DOS cifras: la del recorte manda, el total acompaña («47 · de 3.064»).
    // La regla vive en `tablero.ts`; con un recorte de semáforo el «servido» sale
    // del desglose, porque el server no recortó nada (`totalServidoDe`).
    const conFranja = col.id === COLUMNA_CON_FRANJA && franja != null;
    // Con un rango Y una luz, el total de la luz del desglose es de 30 días: lo
    // que describe la lista es lo que quedó de las cargadas del rango.
    // Con `mesaPorCanal` el desglose YA es del rango, así que su total de la luz sí vale.
    const luzEnElRango = hayRango(mesa.rango) && esRecorteSemaforo(recorte) && !desgloseDelRango;
    const cifras = cifrasDeColumna(
      resumen,
      recorte,
      luzEnElRango ? undefined : totalServidoDe(resumen, recorte, columna.total),
      enEtapa.length,
      // La franja de la columna o el rango de la mesa: los dos achican por
      // tiempo, y el desglose —de donde sale el número grande— no sabe de
      // ninguno de los dos. Con cualquiera, manda el total servido.
      // Con `mesaPorCanal` el desglose YA es del rango: ahí el rango no achica
      // nada, y forzar el «de N» dejaba «20 de 23» con dos cuentas de la misma lista.
      conFranja || (hayRango(mesa.rango) && !desgloseDelRango),
    );
    return { columna, resumen, recorte, enEtapa, conFranja, cifras };
  };

  const etapaArrastrada = arrastrada ? etapaDeTarjeta(arrastrada, overrides) : null;
  // Vacío es vacío en TODOS los canales: con WhatsApp en cero y 900 comentarios, las
  // columnas se dibujan, porque su composición dice dónde está la gente.
  const tableroVacio =
    !cargando &&
    (desgloseTodosLosCanales != null || conteos != null) &&
    (desgloseTodosLosCanales?.length ?? Object.keys(conteos ?? {}).length) === 0;
  /** Lo que sirvió el server para las columnas dibujadas, sumado: con el rango y el recorte ya aplicados. */
  const servidasEnLaMesa = columnas.reduce((suma, col) => suma + porColumna[col.id]!.total, 0);

  return (
    // `relative`: la hoja de la ficha se ancla acá adentro (`absolute inset-y-3
    // right-3`), no al viewport — así respeta el padding del tablero y no se
    // mete abajo de la barra de la cabecera.
    <div className="relative flex min-h-0 flex-1 flex-col p-3">
      <CabeceraPipeline
        resumen={resumenMesa}
        desgloseDelRango={desgloseDelRango}
        recorte={mesa.recorte}
        onRecorte={(luz) => despachar({ tipo: 'luz', luz })}
        rango={mesa.rango}
        onRango={(rango) => despachar({ tipo: 'rango', rango })}
        // `recortesDisponibles` es también la señal de `franjaEn=*` (#946): a un
        // server sin ella, «Hoy» mandaría `*` como una columna y el tablero entero
        // daría 400.
        rangoDisponible={recortesDisponibles != null}
        // Con un recorte del día puesto, lo que sirvió cada columna es la
        // INTERSECCIÓN con el rango y no el tamaño del rango: esa cifra va en el
        // chip del recorte, que es lo que la nombra (como «Verdes 278»).
        totalDelRango={hayRango(mesa.rango) && !esRecorteDelDia(mesa.recorte) ? servidasEnLaMesa : null}
        recorteDelDia={
          esRecorteDelDia(mesa.recorte)
            ? {
                nombre: NOMBRE_DEL_RECORTE_DEL_DIA[mesa.recorte],
                n: cargando ? null : servidasEnLaMesa,
                onQuitar: () => despachar({ tipo: 'recorteDelDia', recorte: null }),
              }
            : null
        }
        cargando={cargando}
        linea={
          linea
            ? { etiqueta: lineas.find((l) => l.numero === linea)?.etiqueta ?? linea, onQuitar: () => setLinea(null) }
            : null
        }
        // Se nombra como DM («Messenger», «Instagram»), porque es lo que se pide:
        // `tipo=mensaje` (`canalDeMesa.ts#alcanceDeCanal`).
        canal={canal ? { etiqueta: nombreDeCanal(canal, 'mensaje'), onQuitar: () => setCanal(null) } : null}
        // La fila de íconos, EN LOS DOS MÓDULOS desde el 13-sep-2026: cada uno con
        // su lista (`canalesDeLaMesa(moduloDeLaMesa)` — ventas suma Formulario).
        // Tocar uno reemplaza el canal del puente: un eje por vez.
        canales={{
          opciones: canalesDeLaMesa(moduloDeLaMesa),
          elegido: canal ? null : canalElegido,
          onElegir: (id) => {
            setCanal(null);
            setCanalElegido(id);
          },
        }}
        // La pista nombra las dos compuertas de VENTAS (curso de interés y
        // venta registrada): en campaña no existe ninguna de las dos, así que
        // ahí no se dice nada en vez de explicar reglas de otro tablero.
        pista={
          arrastrada != null && !esDeCampana ? (
            <p className="text-xs text-muted-foreground">
              A <span className="font-semibold">{ETAPA_ROTULO.cotizado.varios}</span> con curso de
              interés; a <span className="font-semibold">{ETAPA_ROTULO.cierre.varios}</span>,
              registrando la venta. Si falta algo, se pide al soltar.
            </p>
          ) : undefined
        }
        acciones={
          <>
            {/* TABLERO · LISTA — la misma mesa en dos formas. Segmentado como el
                de `PanelNegocio`, para que un conmutador de la casa se lea igual
                en todas las pantallas. */}
            <div role="group" aria-label="Vista" className="flex rounded-full border border-border p-0.5">
              {(
                [
                  ['tablero', 'Tablero', Columns3],
                  ['lista', 'Lista', List],
                ] as const
              ).map(([id, rotulo, Icono]) => {
                const activa = (id === 'lista') === enLista;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={activa}
                    onClick={() => setVista(id)}
                    className={
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors duration-200 ease-house ' +
                      (activa ? 'bg-navy text-white' : 'text-muted-foreground hover:text-foreground')
                    }
                  >
                    <Icono size={12} aria-hidden />
                    {rotulo}
                  </button>
                );
              })}
            </div>
            {/* «ATENDER SIGUIENTE» (#807, S.3) — abre el primer verde que espera
                (el más antiguo primero), después ámbar, después gris, nunca un
                rojo. La precedencia vive una vez en `tablero.ts#primeraParaAtender`;
                acá solo se llama sobre lo que YA está cargado —el mismo universo
                que ya filtró el reparto y la frontera de cliente para esta
                vendedora (ADR 0083), no una segunda regla de alcance. */}
            {paraAtender && (
              <button
                type="button"
                onClick={() => setFicha(paraAtender)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-heading text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Atender siguiente
                <ArrowRight size={13} />
              </button>
            )}
          </>
        }
      />

      {servidorSinEtapas && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-secondary/70 px-3 py-2 text-xs text-foreground">
          <AlertTriangle size={14} className="shrink-0 text-temp-frio" />
          <span className="flex-1">
            El server todavía no sirve la etapa efectiva (falta desplegar #88/#89): sin eso el
            tablero mentiría, así que no se pinta.
          </span>
        </div>
      )}

      {aviso && (
        <div
          aria-live="polite"
          className="mb-2 flex items-start gap-2 rounded-lg border border-border bg-secondary/70 px-3 py-2 text-xs text-foreground"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-temp-frio" />
          <span className="flex-1">{aviso}</span>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setAviso(null)}
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {cargando ? (
        <div
          className={GRID}
          style={{ gridTemplateColumns: `repeat(${columnas.length}, minmax(${ANCHO_MIN_COLUMNA}px, 1fr))` }}
        >
          {columnas.map((col, i) => (
            <div key={col.id} className="flex min-h-0 flex-col gap-2 rounded-2xl bg-secondary/30 p-2">
              <div className="h-6 w-3/5 animate-pulse rounded-md bg-secondary/70" />
              {Array.from({ length: [4, 2, 2, 2, 3][i % 5] }, (_, j) => (
                <div key={j} className="h-12 animate-pulse rounded-xl bg-secondary/60" />
              ))}
            </div>
          ))}
        </div>
      ) : servidorSinEtapas ? null : tableroVacio ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
          <p className="text-sm font-semibold text-foreground">El embudo está vacío.</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Cuando alguien escriba por WhatsApp, Facebook o Instagram, cae solo en la bandeja — y al
            responderle, pasa solo a «{columnas.find((c) => c.id === 'contactado')?.titulo ?? ETAPA_ROTULO.contactado.varios}».
          </p>
        </div>
      ) : enLista ? (
        <ListaPipeline
          key={vecesDelPuente}
          filtroInicial={filtroAsignadaInicial}
          filas={filasDeLista(columnas, repartidas, recorteDe)}
          columnas={columnas}
          lineas={lineas}
          conAsignacion={veTodo}
          esDeCampana={esDeCampana}
          total={columnas.reduce((suma, col) => suma + vistaDeColumna(col).cifras.principal, 0)}
          hayMas={columnas.some((col) => porColumna[col.id]!.hayMas)}
          cargandoMas={columnas.some((col) => porColumna[col.id]!.cargandoMas)}
          // «Traer más» pide la página siguiente a TODAS las columnas que tienen
          // más: la Lista mezcla las cinco, y traer de una sola le cambiaría el
          // orden a lo que ya se estaba mirando.
          onTraerMas={() => {
            for (const col of columnas) {
              const c = porColumna[col.id]!;
              if (c.hayMas && !c.cargandoMas) c.cargarMas();
            }
          }}
          onFicha={setFicha}
          fichaAbierta={ficha?.clave ?? null}
          onAbrir={onAbrir}
        />
      ) : (
        <div className={GRID} style={{ gridTemplateColumns: plantillaColumnas(columnas, colapsadas) }}>
          {columnas.map((col) => {
            const { columna, resumen, recorte, enEtapa, conFranja, cifras } = vistaDeColumna(col);
            const opciones = recortesDeColumna(col.id, resumen, recorte);
            // El «Ver más» cuenta siempre sobre lo que la columna está pidiendo.
            // ⚠️ Con un recorte de semáforo puesto, «Ver más» sigue pidiendo más
            // de la columna ENTERA (el server no sabe filtrar por luz todavía):
            // puede traer más páginas sin que aparezca ni una tarjeta nueva del
            // color que se está mirando. Limitación conocida, no un bug mudo.
            const faltan = esRecorteSemaforo(recorte)
              ? quedanPorTraer(columna.total, columna.items.length)
              : quedanPorTraer(cifras.principal, columna.items.length);
            const esDestino = sobre === col.id && arrastrada != null;
            const esPerdidos = false;
            const esCierre = col.id === 'cierre';
            const esTeEsperan = col.id === 'interesado';
            const esContactados = col.id === 'contactado';
            const fondo = esDestino ? 'bg-secondary' : esPerdidos ? 'bg-transparent' : 'bg-secondary/50';
            const estaColapsada = colapsadas.has(col.id);
            // «N hoy» junto al total (pedido del dueño, 10-sep-2026): la misma
            // cuenta que el «nuevas hoy» de arriba, acotada a esta columna y a su
            // recorte, así describe la lista que se ve. Con franja calla: la
            // franja es de tiempo, el desglose no la conoce y el cruce sería falso.
            // Con el RANGO de la mesa sí se dice: las que nacieron hoy tienen
            // mensajes de hoy, así que caen adentro de «Hoy» y de «7 d».
            // Con un recorte del día calla sola (`contarHoy`).
            // Va en el renglón de abajo y no en el del título a propósito: ahí, a
            // 1280, dejaba «Nunca contestaron» en «Nunca…».
            const hoy = conFranja ? null : contarHoy(desglose, [col.id], recorte);
            /**
             * LO DEL DÍA EN LA CARD DE «TE ESPERAN» — dos celdas, y cada mesa dice lo
             * suyo. La primera es la misma en las dos: «N nuevas hoy». La segunda:
             *
             *  · CAMPAÑA: «N respondidos» (13-sep-2026, «en vez de contestaron pon los
             *    que ya fueron respondidos»): la columna de al lado, en la misma foto.
             *  · VENTAS: «N sin abrir» (nadie les contestó nunca) — el trabajo que la
             *    cabecera vieja decía en un renglón junto a «volvieron» y «ahora». Se
             *    queda sólo ése: es la deuda; «volvieron» es su complemento sobre la
             *    cifra grande, y «ahora» ya lo dice el reloj de cada tarjeta. En la
             *    Escuela se responde desde Hermes, así que la cuenta es honesta — a
             *    diferencia de campaña, donde mentía y se fue (ver el reinicio).
             *
             * Con un chip, una luz o un recorte del día la card calla las dos: ahí
             * describe otra lista. Con el rango de la mesa se dicen igual, porque con
             * `mesaPorCanal` el desglose ES del rango; con un server viejo (desglose de
             * 30 días), «sin abrir» sólo se dice sin rango, como antes.
             */
            const celdasDelDia: CeldaDelDia[] = [];
            if (esTeEsperan && recorte === 'todas') {
              if (hoy != null) {
                celdasDelDia.push({ n: hoy, rotulo: hoy === 1 ? 'nueva hoy' : 'nuevas hoy', ayuda: TITULO_NUEVAS_HOY });
              }
              if (esDeCampana) {
                const respondidos = respondidosDeLaMesa(desglose, mesa.rango, desgloseDelRango);
                if (respondidos) {
                  celdasDelDia.push({
                    n: respondidos.n,
                    rotulo: respondidos.rotulo,
                    ayuda: 'Les respondiste y no volvieron a escribir: la columna «Respondidos», en la misma ventana',
                  });
                }
              } else if (bandeja.hayDetalle && bandeja.total > 0 && (desgloseDelRango || !hayRango(mesa.rango))) {
                celdasDelDia.push({ n: bandeja.nuevas, rotulo: 'sin abrir', ayuda: 'Nadie les contestó nunca: hay que abrirlas' });
              }
            }

            // El (i) de la columna: reemplaza al texto fijo que iba siempre debajo del
            // título, y la pista se cuenta al pasar el mouse.
            // ⚠️ SIN `title`: ese atributo dispara el tooltip NATIVO del navegador
            // encima del nuestro —dos burbujas a la vez, una sin ningún diseño—, así que
            // la única fuente de texto accesible es `aria-label`.
            // ⚠️ El fondo es `bg-navy` y no `bg-navy-ink`: `-ink` es TINTA y en oscuro se
            // ACLARA (`#DCE7F7`, para que un TÍTULO se siga leyendo sobre una tarjeta
            // oscura) — de fondo daba una burbuja casi blanca con letra blanca encima,
            // ilegible. `navy` es SUPERFICIE y no se invierte: queda oscura en los dos
            // temas (ver `index.css`).
            const pistaDeColumna = col.pista && (
              <span className="group/info relative inline-flex shrink-0 self-center">
                <button
                  type="button"
                  data-pista-columna={col.id}
                  aria-label={col.pista}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Info size={12} />
                </button>
                <span
                  role="tooltip"
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 w-56 -translate-x-1/2 rounded-lg bg-navy px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover/info:opacity-100 group-focus-within/info:opacity-100"
                >
                  {col.pista}
                </span>
              </span>
            );

            // EL COLAPSO (ADR 0089): oculta la columna en una franja angosta con el
            // título vertical, sin perder la tarjeta que se está arrastrando por encima —
            // el `<section>` sigue siendo destino de drop igual colapsada.
            // ⚠️ Con fondo y borde a propósito, y no solo un ícono gris: un chevron de
            // 14px sin marco se perdía al lado del número y el título (pedido del dueño,
            // «que se note más»). El círculo se resalta en navy al pasar el mouse, el
            // mismo tratamiento que ya usan los chips activos del recorte — así se lee
            // como un control, no como ruido.
            const botonColapsar = (
              <button
                type="button"
                data-alternar-colapso={col.id}
                onClick={() => alternarColapso(col.id)}
                title={`Colapsar ${col.titulo}`}
                aria-label={`Colapsar ${col.titulo}`}
                className="ml-auto flex shrink-0 items-center justify-center self-center rounded-full border border-border bg-secondary p-1 text-muted-foreground transition-colors duration-200 ease-house hover:border-navy hover:bg-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <ChevronLeft size={15} strokeWidth={2.5} />
              </button>
            );

            // EL RECORTE — en CADA columna de trabajo, con su propio estado. Qué chips
            // aparecen lo decide `recortesDeColumna` (puro): la regla del cero, y que
            // Cierre y Perdidos no lleven ninguno, viven ahí con su porqué.
            // Con un recorte de la MESA o un rango puestos no se ofrece el de la columna
            // (ni la franja): un eje por vez, y con «Hoy» sus números serían de 30 días
            // (`mesa.ts`). La salida está arriba, y el vacío de la columna lo dice.
            const chipsDeColumna = chipsDeColumnaVisibles(mesa) && (opciones.length > 1 || col.id === COLUMNA_CON_FRANJA) && (
              <div className="mt-1.5 flex items-center gap-1">
                {/* El filtro de tiempo va PRIMERO y en la misma fila: es un recorte
                    más de esta columna, no un control aparte.
                    ⚠️ Pero AFUERA de la tira que se desliza: su menú es absoluto y
                    `overflow-x-auto` lo cortaría. */}
                {col.id === COLUMNA_CON_FRANJA && (
                  <FiltroCuando
                    franja={franja}
                    onElegir={(f) => despachar({ tipo: 'franjaDeColumna', franja: f })}
                    ahora={new Date()}
                  />
                )}
                {/* Un «Todas» solo —sin otro eje al lado— es un botón que no cambia
                    nada: sigue escondido, como antes. */}
                {opciones.length > 1 && (
                  <TiraDeChips>
                    {opciones.map((r) => {
                      const activo = recorte === r.id;
                      const Icono = ICONO_RECORTE[r.id];
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => despachar({ tipo: 'recorteDeColumna', etapa: col.id, recorte: r.id })}
                          aria-pressed={activo}
                          title={r.ayuda}
                          className={
                            'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-[11px] font-semibold transition-colors ' +
                            (activo
                              ? 'border-navy bg-navy text-white'
                              : 'border-border text-muted-foreground hover:text-foreground')
                          }
                        >
                          {Icono && <Icono size={10} />}
                          {r.label}
                          {r.n != null && ` ${cifra(r.n)}`}
                        </button>
                      );
                    })}
                  </TiraDeChips>
                )}
              </div>
            );
            return (
              <section
                key={col.id}
                aria-label={col.titulo}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSobre(col.id);
                }}
                onDragLeave={() => setSobre((s) => (s === col.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  soltar(col.id);
                }}
                className={
                  'flex min-h-0 flex-col rounded-2xl p-2 transition-colors ' +
                  fondo +
                  (esPerdidos ? ' border border-dashed border-border' : '') +
                  (esDestino && !esCierre ? ' ring-1 ring-primary/40' : '')
                }
              >
                {estaColapsada ? (
                  /* LA FRANJA COLAPSADA (ADR 0089): el título sigue escrito —
                     rotado, para caber en los ~44px— y la cifra acompaña, así
                     que colapsar no esconde CUÁNTO hay, solo LA LISTA. */
                  <button
                    type="button"
                    data-alternar-colapso={col.id}
                    onClick={() => alternarColapso(col.id)}
                    title={`Expandir ${col.titulo}`}
                    aria-label={`Expandir ${col.titulo}`}
                    className="group flex h-full w-full flex-col items-center gap-2 pt-2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span className="flex items-center justify-center rounded-full border border-border bg-secondary p-1 transition-colors duration-200 ease-house group-hover:border-navy group-hover:bg-navy group-hover:text-white">
                      <ChevronRight size={15} strokeWidth={2.5} />
                    </span>
                    <span className="font-heading text-sm font-bold tabular-nums text-foreground">
                      {cifra(cifras.principal)}
                    </span>
                    <h3 className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap font-heading text-[13px] font-bold text-foreground">
                      {col.titulo}
                    </h3>
                  </button>
                ) : (
                  <>
                  {/* LA CABECERA (13-sep-2026, campaña; 14-sep, las dos mesas): ícono,
                      título, la cifra del canal elegido y la composición por canal de la
                      etapa, en CADA columna; en «Te esperan», lo del día. La pista ya no
                      va en un renglón fijo: la cuenta el (i) (10-sep-2026); lo único que
                      va debajo del título es lo que cambia MIENTRAS se arrastra. */}
                  <CabeceraColumna
                    columna={col}
                    cifras={cifras}
                    conteos={desgloseDelRango ? conteoPorCanal(desgloseTodosLosCanales, col.id, moduloDeLaMesa) : null}
                    opciones={canalesDeLaMesa(moduloDeLaMesa)}
                    alcance={alcanceCanal}
                    delDia={celdasDelDia}
                    pista={pistaDeColumna}
                    colapsar={botonColapsar}
                    aviso={
                      esCierre && arrastrada != null && etapaArrastrada !== 'cierre' ? (
                        <p className="mt-1.5 text-xs font-semibold leading-tight text-navy-ink">
                          Suelta para registrar la venta
                        </p>
                      ) : undefined
                    }
                    chips={chipsDeColumna}
                  />

                  {/* `--piso-movil`: la píldora de campaña del celular flota encima
                      (ADR 0113); sin ella la variable no existe y esto es 0. */}
                  <div
                    data-scroll-columna
                    className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-0.5 max-md:pb-[calc(var(--piso-movil,0px)+0.125rem)]"
                  >
                    {enEtapa.map((c, i) => (
                      <TarjetaEmbudo
                        key={c.clave}
                        c={c}
                        indice={i}
                        onAbrir={onAbrir}
                        onFicha={setFicha}
                        abierta={ficha?.clave === c.clave}
                        alArrastrar={empezarArrastre}
                        alTerminar={terminarArrastre}
                        arrastrando={arrastrada?.clave === c.clave}
                        rebotada={rebotada === c.clave}
                        // El camino corto solo desde Contactados, y solo donde hay
                        // algo que asentar: un botón en toda tarjeta es ruido.
                        onCotizar={
                          esContactados && (c.precio_enviado || Boolean(c.interes_curso))
                            ? cotizarDesdeTarjeta
                            : undefined
                        }
                        cotizando={mover.isPending && mover.variables?.c.clave === c.clave}
                        columna={col.titulo}
                        lineas={lineas}
                        conAsignacion={veTodo}
                        esDeCampana={esDeCampana}
                      />
                    ))}

                    {enEtapa.length === 0 && !esDestino && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-3 pb-10">
                        {/* El ícono de la columna, grande y tenue (la maqueta del dueño). El
                            texto sigue diciendo CÓMO se llena: una columna en cero que no lo
                            explica es la mitad del problema de esta pantalla. */}
                        {(() => {
                          const IconoVacio = ICONO_DE_ETAPA[col.id];
                          return IconoVacio ? (
                            <span
                              aria-hidden
                              className="flex size-12 items-center justify-center rounded-full bg-card text-muted-foreground/60 shadow-[0_1px_2px_rgba(14,42,82,0.05)]"
                            >
                              <IconoVacio size={22} strokeWidth={1.5} />
                            </span>
                          ) : null;
                        })()}
                        <p className="max-w-[24ch] text-center text-[11px] leading-relaxed text-muted-foreground">
                          {vacioDeColumna(recorte, col.vacio, origenDelVacio(mesa, col.id), col.id)}
                        </p>
                      </div>
                    )}

                    {esDestino && (
                      <div className="rounded-xl border border-dashed border-primary/60 p-3 text-center text-[11px] text-primary">
                        Suelta acá
                      </div>
                    )}

                    {columna.hayMas && (
                      <button
                        type="button"
                        onClick={columna.cargarMas}
                        disabled={columna.cargandoMas}
                        className="rounded-xl border border-dashed border-border py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
                      >
                        {columna.cargandoMas
                          ? 'Trayendo…'
                          : faltan > 0
                            ? `Ver más · faltan ${cifra(faltan)}`
                            : 'Ver más'}
                      </button>
                    )}
                  </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* LA FICHA AL COSTADO — se superpone al tablero a propósito (el porqué,
          con la cuenta de píxeles, está en `HojaContacto`). Sin scrim: se puede
          tocar otra tarjeta y la hoja cambia de persona sin cerrarse, que es
          justo lo que se hace cuando se está eligiendo a quién atender.
          `cerrarAlTocarAfuera` sí cierra al tocar el FONDO del tablero (pedido
          del dueño): se apaga junto con el Escape mientras hay un modal de
          compuerta encima, por el mismo motivo — sin eso, tocar «Registrar
          venta» del modal (que cae «afuera» de la hoja) la cerraría de una.

          El Escape se le apaga mientras hay un modal de compuerta encima: los
          dos escuchan en captura, y sin esto una sola tecla cerraría el modal de
          la venta Y la ficha de la persona a la que se le estaba por registrar. */}
      {ficha && (
        <HojaContacto
          conversacion={ficha}
          onCerrar={() => setFicha(null)}
          escapeActivo={pendienteInteres == null && ventaPara == null}
          cerrarAlTocarAfuera={pendienteInteres == null && ventaPara == null}
          miVendedora={miVendedora}
          esDeCampana={esDeCampana}
          onMandarCorreo={onMandarCorreo}
          onEscribir={onEscribir}
        />
      )}

      {/* Las compuertas guían: el modal pide lo que falta, ahí mismo. */}
      {pendienteInteres && (
        <ModalInteresCotizado c={pendienteInteres} onGuardado={guardadoInteres} onCancelar={cancelarInteres} />
      )}
      {ventaPara && (
        <ModalVentaCierre
          c={ventaPara}
          onCerrar={() => setVentaPara(null)}
          onAbrir={onAbrir}
          onAgendarBienvenida={onAgendarBienvenida}
        />
      )}
    </div>
  );
}
