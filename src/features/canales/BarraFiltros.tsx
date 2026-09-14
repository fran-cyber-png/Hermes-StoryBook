import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown, Search, Settings2, Smartphone, Tags, X } from 'lucide-react';
import {
  CLASE_FONDO,
  CLASE_FONDO_SUAVE,
  CLASE_TEXTO,
  esColorCategoria,
} from '../../dominio/paletaCategorias';
import { categoriasOrdenadas, CHIPS_EN_BARRA, FILTROS_SEC, LINEA_MIAS, type CategoriaEnBarra, type FiltroSec } from '../../dominio/cola';
import { seDibujaElSelector, tagDeTransporte, type OpcionDeLinea } from './alcance';
import { useEfectoAlCambiar } from '../../lib/useEfectoAlCambiar';
import { usePopover } from '../../lib/teclado/usePopover';

/**
 * LA BARRA DE FILTROS DE LA COLA — una sola fila que se corre de izquierda a
 * derecha con los filtros que sirven Y las listas de la vendedora.
 *
 * Antes eran dos chips sueltos («Piden info» y «Por vencer») debajo de los tabs,
 * y las categorías vivían escondidas detrás del botón de Listas. El dueño pidió
 * juntarlo: «podemos mejorar el "piden info" y "por vencer" que no me termina de
 * convencer, y además agregar etiquetas ahí en scroll de izquierda a derecha».
 *
 * Tres reglas de esta barra:
 *
 *  1. **Cada chip trae su número.** Un filtro sin la cifra obliga a probarlo para
 *     saber si vale la pena; con 1.866 conversaciones eso es un salto al vacío.
 *  2. **El chip encendido se apaga solo.** El activo lleva su propia ✕: salir del
 *     filtro es un gesto, en el mismo lugar donde se entró.
 *  3. **El scroll se nota.** Si hay más chips a la derecha, un degradado lo dice.
 *     Sin barra de scroll a la vista (fea en un panel de 360 px), pero navegable
 *     con la rueda del mouse, con Tab y con las flechas ← →.
 *  4. **Un chip que siempre diría cero no se dibuja.** Los dos del bot solo
 *     aparecen cuando tienen algo que decir: el bot corre en una línea de
 *     cuatro, y en las otras tres serían dos chips muertos ocupando el ancho de
 *     los que sí se usan todos los días. Es la misma regla del selector de línea
 *     («un selector de un solo elemento no es una elección, es ruido»), y tiene
 *     un efecto que buscamos: **el chip apareciendo ES el aviso**.
 *
 * ══ LÍNEA Y CATEGORÍAS DEJARON DE SER FILAS QUE SE CORTAN (10-sep-2026) ══
 *
 * Hasta acá las dos eran segmentados que se corrían horizontal — la línea en su
 * propia pista desde el 6-ago (ver más abajo por qué), las categorías adentro de
 * la pista de filtros. Las dos formas comparten el mismo techo: una fila tiene un
 * ancho fijo, y ni el degradado ni el scroll con rueda avisan bien pasadas las
 * ~10-12 opciones. Con 10-11 líneas y 12 categorías ya rompía (ver el docblock
 * viejo, abajo); escalando a 20-30 líneas y ~15 categorías, una fila deja de ser
 * la forma correcta.
 *
 * Las dos pasan a ser un BOTÓN COMPACTO que abre un panel (`SelectorLinea`,
 * `SelectorCategorias`): ninguno tapa la lista de conversaciones —siguen
 * filtrando en el lugar, como siempre—, y los dos viven exactamente donde vivía
 * la fila que reemplazan. El modo «Listas» (pantalla completa, `ListaCategorias`)
 * se retira: cumplía el mismo trabajo que ahora hace el panel de categorías, sin
 * tapar nada.
 *
 * ══ DOS FILAS, NO UNA (6-ago-2026) — Y SIGUE SIENDO ASÍ ══
 * La línea y los filtros comparten forma —controles que se corren— pero no
 * plano: la línea elige **qué cola**, los chips recortan **dentro** de ella.
 * Compartían una sola pista y con cuatro líneas vivas el segmentado se comía los
 * 336 px enteros: en la captura del dueño, «Piden info» quedaba cortado contra
 * el borde y **«Sin responder» no se veía en absoluto** — había que descubrir a
 * mano que la barra scrolleaba.
 *
 * Eso pasó a ser inaceptable el día que la cola ordenó por la banda de leído
 * (`server/src/cola/estadoSql.ts`): desde ahí lo que ya se miró baja, y **«Sin
 * responder» es la red de seguridad** que devuelve la deuda entera. Una red de
 * seguridad detrás de un scroll horizontal invisible no es una red.
 *
 * 🔴 **Y EL 22-AGO-2026 LOS TRES CHIPS DEL TRABAJO DIARIO SE DESTRUYERON**
 * («Preguntaron precio», «Te escribieron», «Puedo escribirle» — pedido del
 * dueño: «no me sirven de nada»). `CHIPS_EN_BARRA` (`dominio/cola.ts`) es hoy
 * solo los dos del bot; el resto de esta fila la ocupan las ETIQUETAS del
 * catálogo, que ganan el ancho que los tres dejaron libre. El criterio y la
 * medición de abajo describen por qué esos tres existieron —siguen siendo
 * `FiltroSec` válidos, alcanzables desde otro lado de la app— no un pedido de
 * traerlos de vuelta.
 */
/** ¿Hay más chips a la izquierda / a la derecha de lo que se ve? (los 4 px son ruido de subpíxel). */
function sombrasDe(el: HTMLElement): { izq: boolean; der: boolean } {
  return { izq: el.scrollLeft > 4, der: el.scrollWidth - el.clientWidth - el.scrollLeft > 4 };
}

/**
 * El ancho de los dos degradados de borde, en px — es el `w-8` de sus clases,
 * dicho como número porque el traer-a-la-vista tiene que HACER LA CUENTA con él.
 * Si alguien cambia el `w-8`, esta constante va en el mismo commit: si no, el
 * chip activo vuelve a quedar medio tapado y no hay test que lo vea (jsdom no
 * hace layout).
 */
const ANCHO_VELO = 32;

/** Sin acentos y en minúsculas — para buscar, nunca para mostrar. Mismo criterio que `lib/producto.ts`. */
function sinAcentos(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * UNA FILA QUE SE CORRE — el andamio compartido por los filtros secundarios: el
 * scroll horizontal, el degradado que avisa que hay más, la rueda del mouse y las
 * flechas ← →.
 */
function Pista({
  etiqueta,
  activo,
  children,
}: {
  etiqueta: string;
  /**
   * Lo que está encendido en esta pista. NO se dibuja: es la DEPENDENCIA que
   * dispara el traer-a-la-vista de abajo. Va como valor y no como booleano para
   * que cambiar de una opción activa a otra también cuente.
   */
  activo?: string;
  children: ReactNode;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const [sombra, setSombra] = useState({ izq: false, der: false });

  /** Solo re-renderiza si la respuesta CAMBIÓ: el scroll dispara decenas de eventos. */
  function medir() {
    const el = pista.current;
    if (!el) return;
    const nueva = sombrasDe(el);
    setSombra((prev) => (prev.izq === nueva.izq && prev.der === nueva.der ? prev : nueva));
  }

  useEfectoAlCambiar([], () => {
    const el = pista.current;
    if (!el) return;
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);

    /**
     * La rueda del mouse: en un trackpad el gesto horizontal ya llega como
     * `deltaX`, pero con una rueda común solo hay `deltaY` — y sin esto la
     * página entera se movía mientras la barra se quedaba quieta. Va con
     * `passive: false` a mano porque React registra `onWheel` como pasivo y ahí
     * `preventDefault()` no hace nada.
     */
    function rueda(e: WheelEvent) {
      const barra = pista.current;
      if (!barra || barra.scrollWidth <= barra.clientWidth) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // gesto ya horizontal: que lo maneje el navegador
      e.preventDefault();
      barra.scrollLeft += e.deltaY;
    }
    el.addEventListener('wheel', rueda, { passive: false });
    return () => {
      observador.disconnect();
      el.removeEventListener('wheel', rueda);
    };
    // Se cablea una vez sobre el nodo de la pista: no depende de nada del render.
  });

  /**
   * LO ENCENDIDO SE TRAE A LA VISTA. A 360 px con muchos chips vivos, el chip
   * ACTIVO quedaba scrolleado fuera de la pista. Un control cuyo estado activo
   * no se ve no informa, desinforma — se lee como si estuviera en la primera
   * opción.
   *
   * 🔴 **A MANO SOBRE `scrollLeft`, NUNCA con `scrollIntoView`.** Se probó con
   * `scrollIntoView({ block: 'nearest' })` y **scrollea los ancestros igual**: al
   * cargar, los chips activos de las barras de más abajo arrastraban la PÁGINA
   * ENTERA hacia ellos y la cola aparecía empezada por la mitad (se ve en la
   * captura que lo detectó). `nearest` acota cuánto, no a quién. Tocando solo el
   * `scrollLeft` de esta pista, no hay ancestro que se entere.
   *
   * El aire es **el ancho del degradado** (`w-8`), no un número lindo: los dos
   * velos se pintan ENCIMA de la pista, así que dejar menos deja el chip activo
   * medio desteñido — que es peor que no traerlo, porque parece deshabilitado.
   * Cuando el activo es el último, sumar 32 se pasa del scroll máximo, el
   * navegador lo recorta al final y ahí el degradado se apaga solo: el chip queda
   * entero y sin velo. La cuenta ya lleva su propio caso borde resuelto.
   */
  useEffect(() => {
    const cont = pista.current;
    const el = cont?.querySelector<HTMLElement>('[data-chip][aria-pressed="true"]');
    if (!cont || !el) return;
    const caja = cont.getBoundingClientRect();
    const chip = el.getBoundingClientRect();
    // jsdom no hace layout: todos los rects son 0 y no se mueve nada. Correcto.
    if (chip.left < caja.left) cont.scrollLeft -= caja.left - chip.left + ANCHO_VELO;
    else if (chip.right > caja.right) cont.scrollLeft += chip.right - caja.right + ANCHO_VELO;
  }, [activo]);

  /** Flechas ← → entre chips (patrón `toolbar` de ARIA); Inicio/Fin a los extremos. */
  function onTeclas(e: KeyboardEvent<HTMLDivElement>) {
    const teclas = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!teclas.includes(e.key)) return;
    const chips = Array.from(pista.current?.querySelectorAll<HTMLButtonElement>('[data-chip]') ?? []);
    if (chips.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const actual = chips.findIndex((c) => c === document.activeElement);
    const destino =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? chips.length - 1
          : Math.min(Math.max((actual < 0 ? 0 : actual) + (e.key === 'ArrowRight' ? 1 : -1), 0), chips.length - 1);
    chips[destino]?.focus();
    chips[destino]?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }

  return (
    /* `-mx-2` + `px-2` en la pista: la barra SANGRA hasta el borde del panel. Si
       se quedara dentro del padding, el último chip se cortaría en seco contra
       el borde y el degradado quedaría 8 px adentro, sin tapar el corte —que es
       justo lo que tiene que disimular—.
       ⚠️ **Este número es el `px-2` del contenedor de `ColaUnificada.tsx`
       (08-sep-2026, corrección del mismo día), no un `3` suelto**: son el
       mismo padding, uno cancelándolo y el otro reponiéndolo — si alguno de
       los dos cambia sin el otro, el sangrado se corre y el primer chip queda
       desalineado del resto de la cabecera. */
    <div className="relative -mx-2 min-w-0 flex-1">
      <div
        ref={pista}
        role="toolbar"
        aria-label={etiqueta}
        onScroll={medir}
        onKeyDown={onTeclas}
        className="sin-riel flex items-center gap-1.5 overflow-x-auto scroll-smooth px-2 py-0.5"
      >
        {children}
      </div>

      {/* Que se note que hay más: degradado en el borde, nunca una barra de scroll. */}
      <div
        aria-hidden="true"
        className={
          'pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-card via-card/80 to-transparent transition-opacity duration-200 ' +
          (sombra.izq ? 'opacity-100' : 'opacity-0')
        }
      />
      <div
        aria-hidden="true"
        className={
          'pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/80 to-transparent transition-opacity duration-200 ' +
          (sombra.der ? 'opacity-100' : 'opacity-0')
        }
      />
    </div>
  );
}

/**
 * EL SELECTOR DE LÍNEA — un botón, no una fila (10-sep-2026).
 *
 * `opciones` ya llega resuelta de `alcance.ts` (Todas / Las mías / cada línea
 * viva). Acá adentro:
 *
 *   · **«Todas» + TU LÍNEA PRINCIPAL** quedan fijas arriba del todo. La
 *     segunda YA NO es el agregado «Las mías» (pedido del dueño, 10-sep-2026):
 *     es tu línea EXCLUSIVA por su nombre real («Darwin»), y tocarla filtra
 *     SOLO esa línea — lo mismo que tocarla más abajo en la lista, nada más
 *     que fija arriba porque es la que se usa todo el día. El viejo agregado
 *     (`LINEA_MIAS`) sigue existiendo en `opciones` —otras pantallas podrían
 *     necesitarlo— pero este selector ya no lo ofrece.
 *   · **El resto** (lo que compartís con el equipo, tipo «Ventas Meta», y lo
 *     que es enteramente de otra persona) va bajo «Otras líneas», colapsado
 *     detrás de «Ver las N líneas» pasado cierto tamaño — así quien atiende
 *     2-3 líneas de las 24 no tiene que scrollear nada para llegar a las
 *     suyas. Buscar cuenta como pedir ver el resto: tipear ya lo destapa.
 */
function SelectorLinea({
  opciones,
  lineaActiva,
  onLinea,
}: {
  opciones: readonly OpcionDeLinea[];
  lineaActiva: string;
  onLinea: (numero: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [expandido, setExpandido] = useState(false);
  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-20' });

  const activa = opciones.find((o) => o.numero === lineaActiva);
  const todas = opciones.find((o) => o.numero === '');
  const reales = opciones.filter((o) => o.numero !== '' && o.numero !== LINEA_MIAS);
  /** La primera exclusiva (nadie más la atiende): la que de verdad trajiste vos. */
  const miLinea = reales.find((o) => o.mias && !o.compartida);
  const fijas = [todas, miLinea].filter((o): o is OpcionDeLinea => Boolean(o));
  /**
   * Lo que sigue siendo tuyo (compartido, tipo «Ventas Meta») va ANTES que lo
   * enteramente ajeno — sigue siendo más relevante para vos que la línea de
   * otra persona, aunque ya no tenga su propio encabezado.
   */
  const otras = reales
    .filter((o) => o !== miLinea)
    .sort((a, b) => Number(b.mias) - Number(a.mias));

  /**
   * ⚠️ **Colapsar «otras» SOLO por encima de este número.** Con un equipo
   * chico —tu línea + 2-3 ajenas— esconderlas detrás de un clic es más
   * fricción que la que resuelve: el colapso existe para las 20-30 líneas de
   * quien ve todo, no para cualquier lista con algo de resto. Por debajo, se
   * ve todo directo — que es como se comporta hoy una vendedora con pocas
   * líneas propias, sin ningún control nuevo en el medio.
   */
  const muchasLineas = reales.length > 6;

  const q = sinAcentos(busqueda.trim());
  const coincide = (o: OpcionDeLinea) => !q || sinAcentos(o.etiqueta).includes(q) || o.numero.includes(busqueda.trim());
  const fijasFiltradas = q ? fijas.filter(coincide) : fijas;
  const verResto = !muchasLineas || expandido || q !== '';
  const otrasFiltradas = verResto ? otras.filter(coincide) : [];

  function elegir(numero: string) {
    onLinea(numero);
    setAbierto(false);
    setBusqueda('');
    setExpandido(false);
  }

  function fila(o: OpcionDeLinea) {
    const activaEsta = o.numero === lineaActiva;
    return (
      <button
        key={o.numero || 'todas'}
        type="button"
        data-linea-item
        title={o.titulo}
        aria-pressed={activaEsta}
        onClick={() => elegir(o.numero)}
        className={
          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] font-semibold transition-[background-color,box-shadow] ' +
          (activaEsta ? 'bg-secondary text-secondary-foreground' : 'text-foreground hover:bg-card hover:shadow-sm')
        }
      >
        <span className="min-w-0 flex-1 truncate">{o.etiqueta}</span>
        {tagDeTransporte(o.transporte) && (
          <span className="shrink-0 rounded-[3px] bg-muted px-1 text-[9px] font-bold tracking-wide text-muted-foreground">
            {tagDeTransporte(o.transporte)}
          </span>
        )}
      </button>
    );
  }

  return (
    <span className="relative inline-flex self-start">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label="Elegir la línea de WhatsApp"
        title="Elegir la línea de WhatsApp"
        className="flex max-w-[13rem] items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Smartphone size={11} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{activa?.etiqueta ?? 'Todas'}</span>
        <ChevronDown
          size={11}
          className={'shrink-0 text-muted-foreground transition-transform ' + (abierto ? 'rotate-180' : '')}
          aria-hidden="true"
        />
      </button>

      {abierto && (
        <>
          <span {...propsOverlay} />
          <div
            role="menu"
            aria-label="Líneas de WhatsApp"
            className="absolute left-0 top-8 z-30 w-64 rounded-xl border border-muted-foreground/20 bg-card p-1.5 shadow-panel-flotante"
          >
            {muchasLineas && (
              <div className="mb-1 flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1">
                <Search size={11} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  autoFocus
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar línea o número…"
                  aria-label="Buscar línea o número"
                  className="min-w-0 flex-1 bg-transparent text-[11.5px] text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            )}

            {/* Zona fijada, sobre un celeste apenas visible: la sombra de
                arriba separa el panel entero del blanco de atrás, y este tinte
                separa «lo que siempre está» del resto adentro del panel. */}
            {fijasFiltradas.length > 0 && <div className="mb-1 rounded-lg bg-secondary/50 p-1">{fijasFiltradas.map(fila)}</div>}

            <div className="max-h-52 overflow-y-auto rounded-lg bg-muted/70 p-1">
              {otrasFiltradas.length > 0 && (
                <>
                  {/* Visualmente distinta de un simple subtítulo (pedido del
                      dueño, 10-sep-2026): una píldora, no solo texto — para
                      que se note que separa «tu línea» del resto. */}
                  <p className="mb-0.5 mt-0.5 inline-block rounded-full bg-card px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground shadow-sm">
                    Otras líneas
                  </p>
                  {otrasFiltradas.map(fila)}
                </>
              )}
              {verResto && otrasFiltradas.length === 0 && otras.length > 0 && (
                <p className="px-2 py-2 text-[11px] text-muted-foreground">Sin resultados.</p>
              )}
            </div>

            {!verResto && otras.length > 0 && (
              <button
                type="button"
                onClick={() => setExpandido(true)}
                className="mt-1 w-full rounded-lg py-1.5 text-center text-[11px] font-bold text-primary hover:bg-primary/5"
              >
                Ver las {otras.length} líneas
              </button>
            )}
          </div>
        </>
      )}
    </span>
  );
}

/**
 * EL SELECTOR DE CATEGORÍAS — un botón + una grilla, no una fila ni un modo de
 * pantalla completa (10-sep-2026, reemplaza el modo «Listas»).
 *
 * La grilla de dos columnas muestra TODO el catálogo (`categoriasOrdenadas`,
 * favoritas primero) con su color y su conteo — el mismo lenguaje visual de
 * siempre, solo que ya no depende del ancho de una fila. «Administrar
 * categorías» abre el mismo panel de siempre (`GestorCategorias`, vía
 * `onAdministrarCategorias`): esto no toca el CRUD, solo la puerta de entrada.
 */
function SelectorCategorias({
  catalogo,
  categoriaActiva,
  onCategoria,
  onAdministrarCategorias,
}: {
  catalogo?: readonly CategoriaEnBarra[];
  categoriaActiva: string | null;
  onCategoria: (c: { nombre: string; color: string } | null) => void;
  onAdministrarCategorias: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const { propsOverlay } = usePopover(abierto, () => setAbierto(false), { z: 'z-20' });

  const lista = categoriasOrdenadas(catalogo);
  const q = sinAcentos(busqueda.trim());
  const filtradas = q ? lista.filter((c) => sinAcentos(c.nombre).includes(q)) : lista;
  const activa = lista.find((c) => c.nombre === categoriaActiva);
  const colorActiva = activa && esColorCategoria(activa.color) ? activa.color : null;

  function elegir(c: CategoriaEnBarra) {
    const color = esColorCategoria(c.color) ? c.color : 'pizarra';
    onCategoria(categoriaActiva === c.nombre ? null : { nombre: c.nombre, color });
    setAbierto(false);
    setBusqueda('');
  }

  function administrar() {
    setAbierto(false);
    onAdministrarCategorias();
  }

  return (
    <span className="relative inline-flex shrink-0 self-start">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label="Elegir categoría"
        title="Elegir categoría"
        className="flex max-w-[11rem] items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {colorActiva ? (
          <span className={'size-2 shrink-0 rounded-full ' + CLASE_FONDO[colorActiva]} aria-hidden="true" />
        ) : (
          <Tags size={11} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate capitalize">
          {activa?.nombre ?? (lista.length === 0 ? 'Crear categorías' : 'Categorías')}
        </span>
        {activa ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Quitar el filtro «${activa.nombre}»`}
            onClick={(e) => {
              e.stopPropagation();
              onCategoria(null);
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              onCategoria(null);
            }}
            className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X size={10} />
          </span>
        ) : (
          <ChevronDown
            size={11}
            className={'shrink-0 text-muted-foreground transition-transform ' + (abierto ? 'rotate-180' : '')}
            aria-hidden="true"
          />
        )}
      </button>

      {abierto && (
        <>
          <span {...propsOverlay} />
          <div
            role="menu"
            aria-label="Categorías"
            className="absolute left-0 top-8 z-30 w-72 rounded-xl border border-muted-foreground/20 bg-card p-1.5 shadow-panel-flotante"
          >
            {lista.length > 6 && (
              <div className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1">
                <Search size={11} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  autoFocus
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar categoría…"
                  aria-label="Buscar categoría"
                  className="min-w-0 flex-1 bg-transparent text-[11.5px] text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            )}

            {lista.length === 0 ? (
              <div className="px-2 py-6 text-center">
                <p className="text-[11.5px] text-muted-foreground">Todavía no tienes categorías.</p>
                <button
                  type="button"
                  onClick={administrar}
                  className="mt-2 rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  Crear la primera →
                </button>
              </div>
            ) : (
              <div className="grid max-h-52 grid-cols-2 gap-0.5 overflow-y-auto rounded-lg bg-muted/70 p-1">
                {filtradas.map((c) => {
                  const color = esColorCategoria(c.color) ? c.color : 'pizarra';
                  const esActiva = categoriaActiva === c.nombre;
                  return (
                    <button
                      key={c.nombre}
                      type="button"
                      data-cat-item
                      aria-pressed={esActiva}
                      title={esActiva ? `Salir de la lista «${c.nombre}»` : `Ver solo «${c.nombre}»`}
                      onClick={() => elegir(c)}
                      className={
                        'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold capitalize transition-[background-color,box-shadow] ' +
                        (esActiva ? CLASE_FONDO_SUAVE[color] + ' ' + CLASE_TEXTO[color] : 'text-foreground hover:bg-card hover:shadow-sm')
                      }
                    >
                      <span className={'size-2 shrink-0 rounded-full ' + CLASE_FONDO[color]} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                      {c.conteo > 0 && (
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                          {c.conteo.toLocaleString('es')}
                        </span>
                      )}
                    </button>
                  );
                })}
                {filtradas.length === 0 && (
                  <p className="col-span-2 px-2 py-3 text-center text-[11px] text-muted-foreground">Sin resultados.</p>
                )}
              </div>
            )}

            {lista.length > 0 && (
              <button
                type="button"
                onClick={administrar}
                className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-secondary py-1.5 text-[11px] font-bold text-secondary-foreground transition-colors hover:bg-secondary/70"
              >
                <Settings2 size={11} /> Administrar categorías
              </button>
            )}
          </div>
        </>
      )}
    </span>
  );
}

export function BarraFiltros({
  filtroSec,
  onFiltro,
  conteos,
  catalogo,
  categoriaActiva,
  onCategoria,
  onAdministrarCategorias,
  opciones = [],
  lineaActiva = '',
  onLinea,
  extraDerecha,
}: {
  filtroSec: FiltroSec;
  onFiltro: (f: FiltroSec) => void;
  /**
   * Cuántas filas daría cada filtro dentro del recorte actual (el server los
   * cuenta). `preguntoPrecio`/`teEscribieron`/`puedoEscribirle` ya NO dibujan
   * chip (destruidos el 22-ago-2026) — quedan opcionales porque el server los
   * sigue mandando (otras pantallas los usan, ej. el CTA de la cola vacía) y
   * este componente simplemente no los mira más.
   */
  conteos?: {
    preguntoPrecio?: number;
    teEscribieron?: number;
    /** Sin chip desde el 11-ago-2026 (eran 505, el 93 % de más de una semana). */
    sinResponder?: number;
    yaCompraron?: number;
    botEscalada?: number;
    botCaliente?: number;
    /** Sin chip desde el 22-ago-2026. */
    puedoEscribirle?: number;
  };
  catalogo?: readonly CategoriaEnBarra[];
  categoriaActiva: string | null;
  onCategoria: (c: { nombre: string; color: string } | null) => void;
  /** Abre el panel de administración de categorías (`GestorCategorias`). */
  onAdministrarCategorias: () => void;
  /**
   * QUÉ COLAS PUEDE MIRAR, **ya decidido** — `opcionesDeLinea` en `alcance.ts`.
   *
   * 🔴 **Llega armado y no se calcula acá, y eso ES el arreglo del 7-sep-2026.**
   * Antes esta barra recibía `lineas` + `hayMias` y llamaba a `opcionesDeLinea`
   * por su cuenta, mientras `ColaUnificada` la llamaba OTRA VEZ para resolver
   * `lineaEfectiva`. Dos llamadas a la misma regla con dos juegos de argumentos:
   * cuando la regla ganó un tercero (`veTodo`, el rol), había dos lugares donde
   * olvidarlo y el olvido no tiene síntoma — el selector se dibuja igual, con la
   * lista equivocada. Con la decisión hecha UNA vez arriba, no hay dónde
   * divergir (#37).
   *
   * Con menos de dos opciones el selector no se dibuja (`seDibujaElSelector`).
   */
  opciones?: readonly OpcionDeLinea[];
  /** El número propio elegido; `''` = todas, `LINEA_MIAS` = las asignadas a quien mira. */
  lineaActiva?: string;
  onLinea?: (numero: string) => void;
  /**
   * Lo que va pegado al borde derecho de la FILA 1 (línea + categorías): el
   * rótulo de la cola (`RotuloDeLaCola`) o el sello de frescura
   * (`SelloDeAntes`), lo que esté vivo en `ColaUnificada`. Bajó de la fila de
   * los tabs a ésta (pedido del dueño) para que quede a la altura de
   * «Todas»/«Categorías» y no de «Todo»/«No leídos».
   */
  extraDerecha?: ReactNode;
}) {
  /** Solo los dos del bot llegan a tener chip hoy (`CHIPS_EN_BARRA`). */
  const conteoDe = (valor: string) =>
    valor === 'bot-escalada' ? conteos?.botEscalada : valor === 'bot-caliente' ? conteos?.botCaliente : undefined;

  /**
   * Se esconden en cero (regla 4 del docblock). El ACTIVO se dibuja siempre,
   * aunque el recorte lo haya dejado en cero: si desapareciera al filtrar, la
   * vendedora se quedaría mirando una cola vacía sin el chip que la apaga — el
   * mismo motivo por el que la categoría activa entra a la barra aunque el
   * tope la dejara afuera.
   */
  const visibles = FILTROS_SEC.filter(
    (f) => CHIPS_EN_BARRA.includes(f.valor) && (filtroSec === f.valor || (conteoDe(f.valor) ?? 0) > 0),
  );

  return (
    <div className="flex flex-col gap-1">
      {/* ══ FILA 1 — LÍNEA + CATEGORÍAS: LOS DOS ELIGEN QUÉ MIRAR, NO RECORTAN
          DENTRO ═══════════════════════════════════════════════════════════
          Los dos son botones compactos desde el 10-sep-2026 (ver el docblock
          del archivo), así que ya no necesitan una fila cada uno: comparten la
          de arriba, línea primero —decide QUÉ cola— y categorías al lado. */}
      <div className="flex items-center gap-1.5">
        {seDibujaElSelector(opciones) && onLinea && (
          <SelectorLinea opciones={opciones} lineaActiva={lineaActiva} onLinea={onLinea} />
        )}
        <SelectorCategorias
          catalogo={catalogo}
          categoriaActiva={categoriaActiva}
          onCategoria={onCategoria}
          onAdministrarCategorias={onAdministrarCategorias}
        />
        {extraDerecha && <span className="ml-auto shrink-0">{extraDerecha}</span>}
      </div>

      {/* ══ FILA 2 — LOS FILTROS QUE RECORTAN DENTRO DE LA COLA YA ELEGIDA ══
          Acá vive «Sin responder», que desde la banda de leído es la red de
          seguridad de la cola entera: lo que ya miré baja, y este chip lo trae
          de vuelta con su número. Sin chips que mostrar, la fila entera no se
          dibuja — nada que gastar el alto de una fila vacía. */}
      {/* Ocultos SOLO visualmente (pedido del dueño): «Pidió ayuda» y «El bot
          los ve calientes» siguen calculándose y siguen siendo `FiltroSec`
          alcanzables desde otro lado de la app — `hidden` y no un `return`
          temprano, para no tocar la lógica de `visibles`/`conteoDe` de arriba. */}
      {visibles.length > 0 && (
        <div className="hidden items-center gap-1.5">
          <Pista etiqueta="Afinar la cola" activo={filtroSec}>
            {visibles.map((f) => {
                const activo = filtroSec === f.valor;
                const n = conteoDe(f.valor);
                return (
                  <button
                    key={f.valor}
                    data-chip
                    type="button"
                    aria-pressed={activo}
                    title={activo ? `Quitar el filtro «${f.label}»` : f.ayuda}
                    onClick={() => onFiltro(activo ? '' : f.valor)}
                    className={
                      'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ' +
                      'transition-[background-color,border-color,color] duration-200 ease-house active:scale-[0.97] ' +
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
                      (activo
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground')
                    }
                  >
                    {f.label}
                    {typeof n === 'number' && (
                      <span className={'font-mono tabular-nums ' + (activo ? 'text-primary-foreground/70' : 'text-muted-foreground/70')}>
                        {n.toLocaleString('es')}
                      </span>
                    )}
                    {activo && <X size={11} className="shrink-0" aria-hidden="true" />}
                  </button>
                );
            })}
          </Pista>
        </div>
      )}
    </div>
  );
}
