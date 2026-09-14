import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EditorLibreta } from '../editor';
import { imagenDelPortapapeles, medidaAlPegar, subirImagen, traerBitmap } from './adjuntos';
import { dibujaAlgo, type Herramienta } from './BarraDeDibujo';
import {
  type Ancla,
  type Caja,
  type Esquina,
  type Figura,
  type Punto,
  CAJA_POR_DEFECTO,
  archivosDeFiguras,
  cajaDeFigura,
  duplicar,
  figuraTocada,
  figurasEnCaja,
  moverFigura,
  nuevaBase,
  puntoDeAncla,
  redimensionarCaja,
  redimensionarImagen,
  tiradorTocado,
} from './figuras';
import { resolverAncla, useReflowPorAnclas } from './anclaje';
import { CajaFlotante } from './CajaFlotante';
import { type Capa, opacidadEfectiva, seleccionables, visibles } from './capas';
import { LADO_TIRADOR, pintar } from './pintar';
import type { Anotaciones } from './useAnotaciones';

/**
 * LA CAPA TRANSPARENTE — un canvas sin fondo, apoyado sobre el documento.
 *
 * ══ CÓMO SE PARA ENCIMA DEL TEXTO SIN TAPARLO ═══════════════════════════════
 *
 * 🔴 **VIVE DENTRO DE `.hoja-a4`, VÍA PORTAL — y no siempre fue así**
 * (08-sep-2026). Hasta acá el canvas era `absolute inset-0` adentro del
 * `<div>` de `Hoja` (`Libreta.tsx`), un hermano de `.hoja-a4`. Eso funcionaba
 * mientras `.hoja-a4` crecía con su contenido; desde que tiene ALTURA FIJA y
 * scroll PROPIO (`index.css`, 04-sep-2026), es `.hoja-a4` quien de verdad
 * mueve el texto al scrollear — y un canvas que vive AFUERA de esa caja no se
 * entera: se queda quieto en pantalla mientras el texto se escapa por dentro.
 * Medido: círculo dibujado alrededor de una palabra, la palabra se va scroll
 * abajo y el círculo se queda flotando donde estaba. Por eso ahora
 * `createPortal` lo manda literalmente ADENTRO de `.hoja-a4` (ver el `return`,
 * más abajo) — recién ahí vuelve a ser cierto que:
 *
 *  · **El scroll no necesita una línea de código.** El canvas es parte del
 *    contenido que scrollea, así que un círculo alrededor de una palabra se va
 *    con esa palabra. Si en cambio la capa estuviera fija al viewport (o,
 *    como pasó, fuera de la caja que scrollea), habría que restarle el
 *    `scrollTop` a cada figura en cada rueda del mouse, y cualquier
 *    desincronización se vería como el dibujo despegándose del texto.
 *
 *  · **Las coordenadas del puntero son las del documento.** `getBoundingClientRect`
 *    ya descuenta el scroll, así que `clientX - caja.left` cae directo en el
 *    sistema de coordenadas en el que se guardan las figuras. No hay conversión.
 *
 *  · **El canvas crece con la página.** Ya no mide su contenedor —que ahora
 *    es `.hoja-a4`, de alto FIJO— sino `editor.domElement` (el texto de
 *    verdad, que sigue creciendo con su contenido igual que siempre). Ver el
 *    docblock de la sección «Medir».
 *
 * ══ LO QUE DECIDE SI ESTO ES USABLE: `pointer-events` ═══════════════════════
 *
 * 🔴 Con el modo texto activo la capa lleva `pointer-events: none`, y sin eso
 * NADA de la Libreta funciona: el canvas cubre el documento entero, así que se
 * comería cada clic, cada selección de texto y cada tecla. La página se vería
 * perfecta y sería de solo lectura, sin un solo error en la consola.
 *
 * Al elegir una herramienta pasa a `auto` y la capa captura el puntero. Volver
 * al puntero la vuelve a apagar.
 *
 * ⚠️ **Y desde el portal, ese `auto` tiene que ser EXPLÍCITO.** El `<div>` que
 * se porta entero lleva `pointer-events-none` (para no tapar el editor con un
 * envoltorio transparente que no dibuja nada), y `pointer-events` SE HEREDA —
 * a diferencia de casi todo en CSS. «No poner `-none`» en el canvas ya no
 * alcanza para recuperar el puntero: hace falta `pointer-events-auto` a mano.
 */

/** El radio del borrador y del agarre, en píxeles del documento. */
const RADIO_TOQUE = 8;

/** Cuánto corren las flechas del teclado, sueltas y con Shift. */
const PASO_FLECHA = 1;
const PASO_FLECHA_LARGO = 10;

/** El tamaño del rótulo sale del grosor elegido: una perilla menos en la barra. */
function tamanoDeRotulo(grosor: number): number {
  return 12 + grosor * 4;
}

/**
 * Tope de píxeles del buffer antes de bajar a densidad 1.
 *
 * Una página larga puede medir varios miles de píxeles de alto. A densidad 2 eso
 * son cuatro bytes por cada píxel de un buffer que crece con el cuadrado: una
 * hoja de 700 × 8.000 pasaría de los 200 MB de textura. Preferimos un trazo un
 * poco menos nítido en una página larguísima antes que quedarnos sin memoria.
 */
const TOPE_PIXELES = 4_000_000;

/** Lo que se llevó el último ⌘C. De módulo: se pega entre páginas distintas. */
let portapapelesInterno: Figura[] = [];

export function CapaDeAnotaciones({
  anotaciones,
  herramienta,
  color,
  grosor,
  opacidad,
  capaId,
  capas,
  pedirImagen,
  onSubiendo,
  onSalirDelDibujo,
  editor,
  hojaA4,
  contenedorArchivo,
}: {
  anotaciones: Anotaciones;
  herramienta: Herramienta;
  color: string;
  grosor: number;
  /** 0–1, la que llevarán las figuras nuevas. */
  opacidad: number;
  /** En qué capa caen las figuras nuevas. */
  capaId: string;
  /** Las capas de la página: deciden qué se ve y qué se puede agarrar. */
  capas: Capa[];
  /**
   * Registra el abridor del buscador de archivos, para que el botón «Imagen» de
   * la barra —que vive en otro componente— pueda dispararlo. Se pasa hacia
   * arriba una función en vez de bajar el `<input>`: el input tiene que estar
   * ACÁ, donde se sabe dónde soltar la imagen.
   */
  pedirImagen?: (abrir: (() => void) | null) => void;
  /** Le avisa a la barra que hay una subida en curso, para apagar el botón. */
  onSubiendo?: (subiendo: boolean) => void;
  /** Para que Escape devuelva la página al modo texto sin ir hasta la barra. */
  onSalirDelDibujo(): void;
  /**
   * LA INSTANCIA VIVA DE BLOCKNOTE, o `null/undefined` sin una (solo lectura
   * histórica, página-archivo). Anclar una figura al párrafo (`dibujo/
   * anclaje.ts`) la necesita, y desde el 08-sep-2026 TAMBIÉN mide el alto real
   * de la página con ella (ver el docblock de la sección «Medir», más abajo) —
   * sin editor, la capa entera no tiene dónde apoyarse y no se pinta nada.
   */
  editor?: EditorLibreta | null;
  /**
   * EL NODO DOM DE `.hoja-a4` — DÓNDE se porta todo lo que sigue (el canvas,
   * las cajas flotantes, el input del rótulo, el aviso), CUANDO existe.
   * `.hoja-a4` es la única caja que de verdad scrollea el texto (`index.css`,
   * altura fija + `overflow-y: auto` desde el 04-sep-2026); un dibujo
   * posicionado AFUERA de ella —que es como vivía antes— se queda quieto en
   * pantalla mientras el texto se escapa por su propio scroll.
   *
   * ⚠️ **`null` NO significa "no dibujar", significa "sin portar A ESTE
   * nodo".** Una página de TEXTO sin este nodo (todavía no montó — instante
   * transitorio) simplemente espera. Una página-ARCHIVO (PDF/Word/txt,
   * `PaginaDocumento.tsx`) JAMÁS tiene `.hoja-a4` —no pasa por BlockNote— y
   * ahí se mira `contenedorArchivo` en su lugar (o, sin ninguno de los dos —
   * un PDF—, el camino de antes del 08-sep-2026: canvas de hijo directo, sin
   * portar). Ver el `return` de más abajo y el docblock de «Medir».
   */
  hojaA4?: HTMLDivElement | null;
  /**
   * EL GEMELO DE `hojaA4` PARA UNA PÁGINA-ARCHIVO (08-sep-2026): el
   * `<div>`/`<pre>` que scrollea de verdad un Word o un .txt subido
   * (`VisorDocx`/`VisorTxt` en `PaginaDocumento.tsx`). Mismo motivo que
   * `.hoja-a4` — esos visores TAMBIÉN tienen altura fija y scroll propio
   * (`ALTO_VISOR`, `overflow-y-auto`/`overflow-auto`), así que un canvas
   * afuera de ellos se queda quieto mientras el documento se escapa por su
   * scroll.
   *
   * ⚠️ **Un PDF no tiene equivalente.** `VisorPdf` usa un `<embed>` —el
   * visor NATIVO del navegador—, y ese visor no le presta su DOM a nadie: no
   * hay forma de saber, desde acá, a qué página o a qué scroll está el PDF
   * en un momento dado. Con un PDF, `hojaA4` y `contenedorArchivo` quedan los
   * dos en `null`, y el dibujo cae al camino de siempre: correcto mientras se
   * ve la PRIMERA pantalla del documento, pero sin acompañar el scroll
   * INTERNO del visor si el PDF tiene más de una pantalla de alto — una
   * limitación real, no un descuido, y no hay arreglo posible sin cambiar el
   * visor entero por uno que renderice a un `<canvas>` propio (pdf.js).
   */
  contenedorArchivo?: HTMLElement | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const [medida, setMedida] = useState({ ancho: 0, alto: 0 });
  /**
   * DÓNDE EMPIEZA EL TEXTO DENTRO DE `.hoja-a4`, en el espacio de su
   * CONTENIDO (invariante al scroll — ver el docblock de la sección «Medir»).
   * `.hoja-a4` tiene 2,5cm de padding (1,27cm dividiendo): un envoltorio
   * `inset-0` ahí adentro cae en el borde de ESE padding, no donde el texto
   * arranca de verdad. Sin este offset, todo lo dibujado aparece corrido esos
   * mismos centímetros — el defecto que motivó medirlo.
   */
  const [origen, setOrigen] = useState({ x: 0, y: 0 });
  const [enCurso, setEnCurso] = useState<Figura | null>(null);
  const [lazo, setLazo] = useState<Caja | null>(null);
  const [escribiendo, setEscribiendo] = useState<{ en: Punto; valor: string } | null>(null);
  /**
   * QUÉ CAJA SE ESTÁ EDITANDO, o `null`.
   *
   * 🔴 Es el interruptor entre «modo edición de texto» y «modo selección de
   * objetos». Con una caja abierta, su `contenteditable` se queda el teclado
   * entero: ⌘A selecciona SU texto y Suprimir borra caracteres. Sin ninguna, el
   * teclado es de la capa. Ver `CajaFlotante`.
   */
  const [editandoCaja, setEditandoCaja] = useState<string | null>(null);
  const [subiendo, setSubiendoLocal] = useState(false);
  const onSubiendoRef = useRef(onSubiendo);
  onSubiendoRef.current = onSubiendo;
  // Un solo lugar cambia la bandera y avisa hacia arriba: con dos `setState`
  // sueltos en cada rama del `try/finally`, el botón se queda apagado el día que
  // alguien agregue un `return` temprano.
  const setSubiendo = useCallback((v: boolean) => {
    setSubiendoLocal(v);
    onSubiendoRef.current?.(v);
  }, []);
  /** Sube cuando termina de bajar un bitmap, para forzar el repintado. */
  const [imagenesListas, setImagenesListas] = useState(0);

  /** Lo que había al empezar el gesto, para poder apilarlo al cerrarlo. */
  const previas = useRef<Figura[] | null>(null);
  /** El arrastre de figuras elegidas: desde dónde y cómo estaban. */
  const arrastre = useRef<{ desde: Punto; originales: Figura[] } | null>(null);
  /** El arrastre de un tirador: qué esquina y cuál era la imagen. */
  const escalado = useRef<{ esquina: Esquina; original: Figura } | null>(null);

  const activa = dibujaAlgo(herramienta);
  const { figuras, seleccionadas, elegidas } = anotaciones;

  /**
   * 🔴 LAS DOS LISTAS DERIVADAS, y no da igual cuál se use.
   *
   * `paraVer` es lo que se pinta (capa visible). `paraTocar` es lo que el clic,
   * el borrador y el lazo pueden agarrar (visible Y no bloqueada). Toda búsqueda
   * de figuras pasa por `paraTocar` — es lo que hace que «bloqueada» sea una
   * regla y no un estilo. Ver `capas.ts`.
   */
  const paraVer = visibles(figuras, capas);
  const paraTocar = seleccionables(figuras, capas);

  /* ── Ancla al párrafo ──────────────────────────────────────────────────── */

  /**
   * A QUÉ BLOQUE ANCLAR UNA FIGURA NUEVA (o una que se acaba de mover). Sin
   * `editor` —solo lectura sin editor vivo— no hay nada que resolver: la
   * figura nace o queda sin `ancla`, que es exactamente el comportamiento de
   * siempre.
   */
  const anclarA = useCallback(
    (punto: Punto): Ancla | undefined => {
      if (!editor) return undefined;
      const contenedor = canvasRef.current?.getBoundingClientRect();
      if (!contenedor) return undefined;
      return resolverAncla(editor, contenedor, punto) ?? undefined;
    },
    [editor],
  );

  useReflowPorAnclas(
    editor,
    figuras,
    hojaA4 ?? null,
    useCallback((r) => anotaciones.reubicarPorAncla(r.cambios, r.perdidos), [anotaciones]),
  );

  /**
   * RE-ANCLA las figuras de `ids` contra su posición ACTUAL en `fs`. Se llama
   * al terminar un arrastre o un redimensionado: sin esto, mover un dibujo a
   * otro párrafo lo dejaría anclado al de antes, y el próximo reflow lo
   * tironearía hacia donde ya no está.
   *
   * ⚠️ No se usa para el paso de las flechas del teclado ni para duplicar: los
   * dos corren pocos píxeles (1 a 10, o el desplazamiento fijo de `duplicar`),
   * así que cruzan a otro bloque tan rara vez que no vale la complejidad extra
   * de hacer llegar el DOM hasta `useAnotaciones` (que es puro a propósito).
   * Si el usuario de verdad lo movió lejos, el arrastre con el mouse sí pasa
   * por acá.
   */
  const reancorar = useCallback(
    (fs: Figura[], ids: string[]): Figura[] => {
      if (ids.length === 0) return fs;
      const elegidos = new Set(ids);
      return fs.map((f) => (elegidos.has(f.id) ? { ...f, ancla: anclarA(puntoDeAncla(f)) } : f));
    },
    [anclarA],
  );

  /* ── Medir ─────────────────────────────────────────────────────────────── */

  /**
   * 🔴 SE MIDE EL EDITOR, NO EL CONTENEDOR (08-sep-2026, corrige el bug de
   * "todo se mueve al scrollear").
   *
   * Hasta acá se medía `canvasRef.current?.parentElement` — que, desde que el
   * canvas se porta dentro de `.hoja-a4` (ver el retorno de este componente,
   * más abajo), ES `.hoja-a4`: una caja de ALTO FIJO (`.hoja-a4` en
   * `index.css`, 04-sep-2026) que scrollea su contenido por dentro. Medir su
   * `clientHeight` daría el alto VISIBLE (unos 776px en una pantalla común),
   * nunca el del texto completo — el canvas quedaría recortado a la primera
   * pantalla y cualquier dibujo más abajo del corte no se vería NUNCA.
   *
   * `editor.domElement` (el `.bn-editor` de verdad) no tiene alto fijo: crece
   * con su contenido igual que antes de esa fecha. Medirlo A ÉL da el alto
   * real del texto, sea cual sea, y es lo que hace que el canvas — ahora dentro
   * de `.hoja-a4` — cubra la página ENTERA y scrollee con ella.
   *
   * ══ Y POR QUÉ TAMBIÉN SE MIDE `origen` ══════════════════════════════════════
   *
   * 🔴 `.hoja-a4` tiene 2,5cm de padding (1,27cm dividiendo). Un envoltorio
   * `absolute inset-0` puesto ADENTRO de ella cae en el borde de SU padding —
   * que es el borde de la tarjeta, no donde el texto arranca después de ese
   * padding— así que todo lo dibujado aparecía corrido esos centímetros hacia
   * arriba y a la izquierda (medido: 94,5px, exactos los 2,5cm). `origen` es
   * ese offset, y se resta la posición actual de scroll para que el número
   * quede fijo en el espacio del CONTENIDO — invariante a cuánto se haya
   * scrolleado en el momento de medir.
   *
   * ══ Y UN WORD/TXT SUBIDO SE MIDE CONTRA SU PROPIO VISOR ═════════════════════
   *
   * `contenedorArchivo` (`VisorDocx`/`VisorTxt`) es a la vez la caja que
   * scrollea Y el lugar donde vive el contenido —a diferencia de `.hoja-a4`,
   * que solo scrollea y le presta el contenido a `.bn-editor`—, así que
   * `origen` acá es simplemente su padding (`p-6`/`p-4`, leído del `computed
   * style` en vez de a mano, para no duplicar el número de Tailwind), y el
   * alto es su `scrollHeight` — el contenido real, no la caja fija. Un
   * `ResizeObserver` sobre ESTE contenedor no ve crecer su contenido interno
   * (la caja no cambia de tamaño cuando el documento es más largo, solo su
   * `scrollHeight`), así que la señal de que hay algo nuevo que medir es un
   * `MutationObserver` sobre sus hijos — es como `docx-preview` y el texto
   * de `VisorTxt` entran, así que es lo único que de verdad avisa.
   *
   * ══ Y SIN NINGUNO DE LOS DOS (un PDF) NO HAY NADA DE ESTO QUE MEDIR ════════
   *
   * 🔴 El visor nativo del PDF (`<embed>`) no le presta su DOM a nadie —ver el
   * docblock de `contenedorArchivo`—, así que acá se vuelve al método de
   * ANTES del 08-sep-2026: medir el contenedor de VERDAD (el `<div>` de
   * `Hoja`) y renderizar sin portar —ver el `return`, más abajo—, `origen` en
   * `{0, 0}` porque ese contenedor no tiene ningún padding ajeno que
   * corregir. Sin este camino, la capa entera quedaba en blanco sobre un
   * archivo: ni `hojaA4` ni `contenedorArchivo` llegan a existir con un PDF,
   * y antes de este arreglo eso hacía que ni el canvas se montara.
   *
   * ⚠️ **`canvasRef.current?.parentElement` NO ES `Hoja`, es EL PROPIO
   * ENVOLTORIO** (`contenido`, el `<div>` `absolute` de más abajo) — y medir
   * SU tamaño para decidir SU PROPIO tamaño es un lazo que nunca despega
   * (nace en `{0, 0}` y se queda ahí para siempre). Hace falta subir un nivel
   * más, a `.parentElement.parentElement`, que es recién `Hoja`.
   */
  useLayoutEffect(() => {
    if (editor && hojaA4) {
      const raiz = editor.domElement;
      if (!raiz) return;

      const medir = () => {
        const r = raiz.getBoundingClientRect();
        const base = hojaA4.getBoundingClientRect();
        setMedida({ ancho: r.width, alto: r.height });
        setOrigen({
          x: r.left - base.left + hojaA4.scrollLeft,
          y: r.top - base.top + hojaA4.scrollTop,
        });
      };
      medir();
      if (typeof ResizeObserver === 'undefined') return;
      const observador = new ResizeObserver(medir);
      observador.observe(raiz);
      return () => observador.disconnect();
    }

    if (contenedorArchivo) {
      const medir = () => {
        const cs = getComputedStyle(contenedorArchivo);
        const relleno = {
          arriba: parseFloat(cs.paddingTop) || 0,
          izq: parseFloat(cs.paddingLeft) || 0,
          derecha: parseFloat(cs.paddingRight) || 0,
          abajo: parseFloat(cs.paddingBottom) || 0,
        };
        setMedida({
          ancho: contenedorArchivo.clientWidth - relleno.izq - relleno.derecha,
          alto: Math.max(
            contenedorArchivo.scrollHeight - relleno.arriba - relleno.abajo,
            contenedorArchivo.clientHeight - relleno.arriba - relleno.abajo,
          ),
        });
        setOrigen({ x: relleno.izq, y: relleno.arriba });
      };
      medir();

      let observadorResize: ResizeObserver | undefined;
      if (typeof ResizeObserver !== 'undefined') {
        observadorResize = new ResizeObserver(medir);
        observadorResize.observe(contenedorArchivo);
      }
      let observadorMutacion: MutationObserver | undefined;
      if (typeof MutationObserver !== 'undefined') {
        observadorMutacion = new MutationObserver(medir);
        observadorMutacion.observe(contenedorArchivo, { childList: true, subtree: true, characterData: true });
      }
      return () => {
        observadorResize?.disconnect();
        observadorMutacion?.disconnect();
      };
    }

    const caja = canvasRef.current?.parentElement?.parentElement;
    if (!caja) return;
    const medir = () => {
      setMedida({ ancho: caja.clientWidth, alto: caja.clientHeight });
      setOrigen({ x: 0, y: 0 });
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(caja);
    return () => observador.disconnect();
  }, [editor, hojaA4, contenedorArchivo]);

  /* ── Traer las imágenes ────────────────────────────────────────────────── */

  /**
   * Las imágenes se bajan cuando aparecen en la capa, y el contador fuerza un
   * repintado al llegar cada una. Sin esto, una página con imágenes se abre
   * mostrando los huecos punteados y no se rellenan hasta que algo más provoque
   * un render.
   */
  useEffect(() => {
    let vivo = true;
    for (const archivo of archivosDeFiguras(figuras)) {
      void traerBitmap(archivo).then((b) => {
        if (b && vivo) setImagenesListas((n) => n + 1);
      });
    }
    return () => {
      vivo = false;
    };
  }, [figuras]);

  /* ── Pintar ────────────────────────────────────────────────────────────── */

  const dpr = medida.ancho * medida.alto > TOPE_PIXELES ? 1 : Math.min(window.devicePixelRatio || 1, 2);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || medida.ancho === 0) return;
    pintar(ctx, enCurso ? [...paraVer, enCurso] : paraVer, {
      dpr,
      seleccionadas,
      lazo,
      // Los recuadros y tiradores solo con la herramienta de selección: con el
      // lápiz en la mano serían cajas azules que no hacen nada.
      conAdornos: herramienta === 'seleccion',
      // La opacidad final es la del objeto POR la de su capa. Se resuelve acá y
      // no en el pintor: quien pinta no conoce las capas, y la de la capa es una
      // lente que no está guardada en la figura (ver `capas.ts`).
      opacidadDe: (f) => opacidadEfectiva(f, capas),
    });
  }, [paraVer, enCurso, medida, dpr, seleccionadas, lazo, herramienta, imagenesListas, capas]);

  /* ── Puntero ───────────────────────────────────────────────────────────── */

  const puntoDe = useCallback((e: { clientX: number; clientY: number }): Punto => {
    const caja = canvasRef.current?.getBoundingClientRect();
    if (!caja) return [0, 0];
    // `getBoundingClientRect` ya descuenta el scroll: esto cae directo en
    // coordenadas del documento, que es donde viven las figuras.
    return [e.clientX - caja.left, e.clientY - caja.top];
  }, []);

  function cerrarRotulo(confirmando: boolean) {
    if (!escribiendo) return;
    const texto = escribiendo.valor.trim();
    const base = previas.current ?? figuras;
    setEscribiendo(null);
    previas.current = null;
    if (!confirmando || texto === '') return;
    anotaciones.confirmar(
      [
        ...base,
        {
          ...nuevaBase({ opacidad, capaId }),
          ancla: anclarA(escribiendo.en),
          clase: 'rotulo',
          color,
          tamano: tamanoDeRotulo(grosor),
          en: escribiendo.en,
          texto,
        },
      ],
      base,
    );
  }

  const alBajar = (e: React.PointerEvent) => {
    if (!activa) return;
    // Tocar el lienzo cierra la caja que se estaba escribiendo: es «hacer clic
    // afuera», y devuelve el teclado a la capa.
    if (editandoCaja) setEditandoCaja(null);
    // Un rótulo a medio escribir se cierra al tocar otra parte: es lo que hace
    // cualquier editor, y evita dejarlo colgado sin saber cómo salir.
    if (escribiendo) {
      cerrarRotulo(true);
      return;
    }

    const p = puntoDe(e);
    previas.current = figuras;
    e.currentTarget.setPointerCapture(e.pointerId);

    /**
     * LA HERRAMIENTA TEXTO CREA UNA CAJA Y LA ABRE PARA ESCRIBIR.
     *
     * Nace con texto de arranque en vez de vacía, y no es un capricho: `parsear`
     * descarta las cajas sin texto (un objeto invisible que ocupa lugar es peor
     * que ninguno), así que una caja vacía guardada desaparecería al recargar.
     * Con el texto puesto y seleccionado, la primera tecla lo reemplaza.
     */
    if (herramienta === 'caja') {
      const nueva: Figura = {
        ...nuevaBase({ opacidad, capaId }),
        ancla: anclarA(p),
        clase: 'caja',
        x: p[0],
        y: p[1],
        ancho: CAJA_POR_DEFECTO.ancho,
        alto: CAJA_POR_DEFECTO.alto,
        texto: 'Anotación',
        fuente: CAJA_POR_DEFECTO.fuente,
        tamano: CAJA_POR_DEFECTO.tamano,
        negrita: CAJA_POR_DEFECTO.negrita,
        cursiva: CAJA_POR_DEFECTO.cursiva,
        subrayado: CAJA_POR_DEFECTO.subrayado,
        alineacion: CAJA_POR_DEFECTO.alineacion,
        color,
      };
      anotaciones.agregar([nueva]);
      setEditandoCaja(nueva.id);
      previas.current = null;
      return;
    }

    if (herramienta === 'rotulo') {
      setEscribiendo({ en: p, valor: '' });
      return;
    }

    if (herramienta === 'borrador') {
      const victima = paraTocar[figuraTocada(paraTocar, p, RADIO_TOQUE)];
      if (victima) anotaciones.vistaPrevia(figuras.filter((f) => f.id !== victima.id));
      return;
    }

    if (herramienta === 'seleccion') {
      // 1) ¿Un tirador? Va PRIMERO: los tiradores caen sobre el borde de la
      //    imagen, así que preguntar por la figura antes se llevaría el gesto.
      if (elegidas.length === 1 && (elegidas[0].clase === 'imagen' || elegidas[0].clase === 'caja')) {
        const c = cajaDeFigura(elegidas[0]);
        const esquina = tiradorTocado(
          { x1: c.x1 - 6, y1: c.y1 - 6, x2: c.x2 + 6, y2: c.y2 + 6 },
          p,
          LADO_TIRADOR,
        );
        if (esquina) {
          escalado.current = { esquina, original: elegidas[0] };
          return;
        }
      }

      // 2) ¿Una figura? Con ⇧ se suma o se saca de la selección.
      const tocada = paraTocar[figuraTocada(paraTocar, p, RADIO_TOQUE)];
      if (tocada) {
        const id = tocada.id;
        let ids = seleccionadas;
        // `Ctrl`/`⌘` suma o saca de la selección — lo pedido. `Shift` hace lo
        // mismo porque es lo que la mano espera en cualquier lista.
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          ids = seleccionadas.includes(id) ? seleccionadas.filter((x) => x !== id) : [...seleccionadas, id];
          anotaciones.elegir(ids);
        } else if (!seleccionadas.includes(id)) {
          // Tocar algo que NO estaba elegido reemplaza la selección; tocar algo
          // que sí estaba la conserva, para poder arrastrar el grupo entero.
          ids = [id];
          anotaciones.elegir(ids);
        }
        arrastre.current = { desde: p, originales: figuras.filter((f) => ids.includes(f.id)) };
        return;
      }

      // 3) Nada debajo: empieza el lazo. Sin sumar, se limpia lo que había.
      if (!(e.ctrlKey || e.metaKey || e.shiftKey)) anotaciones.elegir([]);
      setLazo({ x1: p[0], y1: p[1], x2: p[0], y2: p[1] });
      return;
    }

    // ⚠️ La herramienta NO es la clase de la figura: el `lapiz` produce un
    // `trazo`. Escribir `clase: herramienta` guardaba figuras con una clase que
    // `parsear` no conoce — se dibujaban en la sesión y desaparecían al recargar.
    if (herramienta === 'lapiz' || herramienta === 'resaltador') {
      setEnCurso({
        ...nuevaBase({ opacidad, capaId }),
        ancla: anclarA(p),
        clase: herramienta === 'lapiz' ? 'trazo' : 'resaltador',
        color,
        grosor,
        puntos: [p],
      });
      return;
    }
    setEnCurso({
      ...nuevaBase({ opacidad, capaId }),
      ancla: anclarA(p),
      clase: herramienta,
      color,
      grosor,
      desde: p,
      hasta: p,
    });
  };

  const alMover = (e: React.PointerEvent) => {
    // `e.buttons === 0` es «se soltó afuera y volvió»: sin esto el trazo sigue
    // dibujándose al pasar el mouse por encima después de haber soltado.
    if (!activa || e.buttons === 0) return;
    const p = puntoDe(e);

    if (herramienta === 'borrador' && previas.current) {
      const victima = paraTocar[figuraTocada(paraTocar, p, RADIO_TOQUE)];
      if (victima) anotaciones.vistaPrevia(figuras.filter((f) => f.id !== victima.id));
      return;
    }

    if (herramienta === 'seleccion') {
      const esc = escalado.current;
      if (esc) {
        // Una caja de texto solo cambia de ANCHO: el alto lo pone el contenido
        // con word-wrap. Una imagen cambia las dos, y Shift libera su proporción.
        const nueva =
          esc.original.clase === 'caja'
            ? redimensionarCaja(esc.original, esc.esquina, p)
            : esc.original.clase === 'imagen'
              ? redimensionarImagen(esc.original, esc.esquina, p, e.shiftKey)
              : esc.original;
        anotaciones.vistaPrevia(figuras.map((f) => (f.id === nueva.id ? nueva : f)));
        return;
      }

      const arr = arrastre.current;
      if (arr) {
        const dx = p[0] - arr.desde[0];
        const dy = p[1] - arr.desde[1];
        const porId = new Map(arr.originales.map((f) => [f.id, f]));
        anotaciones.vistaPrevia(
          figuras.map((f) => {
            const original = porId.get(f.id);
            return original ? moverFigura(original, dx, dy) : f;
          }),
        );
        return;
      }

      if (lazo) setLazo({ ...lazo, x2: p[0], y2: p[1] });
      return;
    }

    setEnCurso((actual) => {
      if (!actual) return actual;
      if (actual.clase === 'trazo' || actual.clase === 'resaltador') {
        return { ...actual, puntos: [...actual.puntos, p] };
      }
      if (actual.clase === 'rotulo' || actual.clase === 'imagen') return actual;
      return { ...actual, hasta: p };
    });
  };

  const alSoltar = () => {
    if (!activa) return;
    const base = previas.current;

    if (herramienta === 'borrador') {
      // El borrador no apila un paso por figura: arrastrar sobre cinco trazos es
      // UN borrado, y un solo «deshacer» los devuelve a los cinco.
      if (base && base !== figuras) anotaciones.confirmar(figuras, base);
      previas.current = null;
      return;
    }

    if (herramienta === 'seleccion') {
      if (lazo) {
        anotaciones.elegir(figurasEnCaja(paraTocar, lazo));
        setLazo(null);
      } else if ((arrastre.current || escalado.current) && base && base !== figuras) {
        // Los ids que de verdad se movieron: el arrastre trae varios, el
        // redimensionado uno solo.
        const movidos = arrastre.current
          ? arrastre.current.originales.map((f) => f.id)
          : escalado.current
            ? [escalado.current.original.id]
            : [];
        // Solo se apila si de verdad cambió algo: un clic para elegir no es un
        // cambio y no tiene por qué gastar un paso de deshacer.
        anotaciones.confirmar(reancorar(figuras, movidos), base);
      }
      arrastre.current = null;
      escalado.current = null;
      previas.current = null;
      return;
    }

    if (herramienta === 'rotulo') return; // lo cierra su propio input

    const terminada = enCurso;
    setEnCurso(null);
    previas.current = null;
    if (!terminada || !base) return;

    // Un clic sin arrastrar con una forma no deja nada: un rectángulo de área
    // cero es una figura invisible que después hay que borrar a ciegas.
    if ('desde' in terminada) {
      const largo = Math.hypot(terminada.hasta[0] - terminada.desde[0], terminada.hasta[1] - terminada.desde[1]);
      if (largo < 2) return;
    }

    anotaciones.confirmar([...base, terminada], base);
  };

  /* ── Imágenes ──────────────────────────────────────────────────────────── */

  /**
   * MONTA UNA IMAGEN EN LA CAPA.
   *
   * `donde` es opcional: cuando se pega con el teclado no hay puntero, así que
   * cae en el CENTRO DE LO QUE SE ESTÁ VIENDO. Ponerla en el origen del
   * documento la dejaría fuera de pantalla en una página larga — pegar algo y no
   * verlo aparecer se lee como que no funcionó.
   */
  const montarImagen = useCallback(
    async (datos: Blob, donde?: Punto) => {
      setSubiendo(true);
      anotaciones.avisar(null);
      try {
        const subido = await subirImagen(datos);
        const { ancho, alto } = medidaAlPegar(
          { ancho: subido.ancho, alto: subido.alto },
          medida.ancho || 700,
        );

        let centro = donde;
        if (!centro) {
          const caja = canvasRef.current?.getBoundingClientRect();
          // `-caja.top` es cuánto de la página quedó por encima del viewport:
          // sumarle media ventana da el centro de lo que se ve, en coordenadas
          // del documento.
          const y = caja ? -caja.top + window.innerHeight / 2 : (medida.alto || 400) / 2;
          centro = [(medida.ancho || 700) / 2, Math.max(alto / 2, y)];
        }

        anotaciones.agregar([
          {
            ...nuevaBase({ opacidad, capaId }),
            ancla: anclarA(centro),
            clase: 'imagen',
            archivo: subido.archivo,
            x: centro[0] - ancho / 2,
            y: centro[1] - alto / 2,
            ancho,
            alto,
            naturalAncho: subido.ancho,
            naturalAlto: subido.alto,
          },
        ]);
      } catch (e) {
        anotaciones.avisar(e instanceof Error ? e.message : 'No se pudo pegar la imagen.');
      } finally {
        setSubiendo(false);
      }
    },
    [anotaciones, medida.ancho, medida.alto, anclarA],
  );

  /** Le da a la barra el abridor del buscador de archivos. */
  useEffect(() => {
    if (!pedirImagen) return;
    pedirImagen(activa || herramienta === 'puntero' ? () => archivoRef.current?.click() : null);
    return () => pedirImagen(null);
  }, [pedirImagen, activa, herramienta]);

  /* ── Portapapeles ──────────────────────────────────────────────────────── */

  /**
   * ⌘V CON UNA IMAGEN ADENTRO.
   *
   * Va en `document` y no en el canvas, y hace falta: un `paste` solo llega al
   * elemento con foco, y al pegar recién llegado de otra aplicación el foco
   * puede estar en cualquier parte. Se filtra por «hay una página abierta y una
   * imagen en el portapapeles», y **solo entonces** se cancela el evento — si no,
   * pegar texto en la Libreta dejaría de funcionar.
   */
  useEffect(() => {
    const alPegar = (e: ClipboardEvent) => {
      const archivo = imagenDelPortapapeles(e.clipboardData);
      if (archivo) {
        e.preventDefault();
        void montarImagen(archivo);
        return;
      }
      // Sin imagen en el sistema: si hay algo copiado ACÁ y estamos en modo
      // dibujo, se pega eso. Con el modo texto puesto no se toca nada — pegar
      // texto en el editor tiene que seguir siendo lo normal.
      if (activa && portapapelesInterno.length > 0) {
        e.preventDefault();
        anotaciones.agregar(duplicar(portapapelesInterno));
      }
    };
    document.addEventListener('paste', alPegar);
    return () => document.removeEventListener('paste', alPegar);
  }, [activa, anotaciones, montarImagen]);

  /* ── Cajas de texto ────────────────────────────────────────────────────── */

  /**
   * ESCRIBIR EN UNA CAJA SE GUARDA COMO UN GESTO, no tecla por tecla.
   *
   * `vistaPrevia` mientras se teclea y `confirmar` recién al cerrar la edición:
   * con un paso de deshacer por carácter, un ⌘Z borraría una letra y escribir un
   * párrafo llenaría la pila con cien entradas inútiles.
   */
  const textoDeCaja = useCallback(
    (id: string, texto: string) => {
      anotaciones.vistaPrevia(figuras.map((f) => (f.id === id && f.clase === 'caja' ? { ...f, texto } : f)));
    },
    [anotaciones, figuras],
  );

  /**
   * El alto MEDIDO del contenido. No pasa por la pila ni por el guardado: es una
   * consecuencia del texto, no una decisión de nadie. Apilarlo metería un paso
   * de deshacer por cada línea que aparece al angostar la caja.
   */
  const altoDeCaja = useCallback(
    (id: string, alto: number) => {
      anotaciones.vistaPrevia(figuras.map((f) => (f.id === id && f.clase === 'caja' ? { ...f, alto } : f)));
    },
    [anotaciones, figuras],
  );

  const cerrarEdicion = useCallback(() => {
    setEditandoCaja(null);
    // Lo tecleado se baja al guardado en un solo paso. `previas` es lo que había
    // antes de abrir la caja, o lo actual si nunca se tocó nada.
    anotaciones.confirmar(figuras, previas.current ?? figuras);
    previas.current = null;
  }, [anotaciones, figuras]);

  /* ── Teclado ───────────────────────────────────────────────────────────── */

  const alTeclear = (e: React.KeyboardEvent) => {
    // 🔴 Con una caja abierta el teclado es SUYO. La caja ya frena la
    // propagación, pero esta guarda es la que sostiene la regla aunque el foco
    // termine en otra parte: sin ella, ⌘A adentro de una caja seleccionaría
    // todas las figuras en vez de su texto.
    if (!activa || editandoCaja) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onSalirDelDibujo();
      return;
    }

    // Las flechas corren lo elegido. Shift corre más — el paso fino sirve para
    // encajar una flecha contra una palabra, el largo para reacomodar.
    const flechas: Record<string, Punto> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direccion = flechas[e.key];
    if (direccion && seleccionadas.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      const paso = e.shiftKey ? PASO_FLECHA_LARGO : PASO_FLECHA;
      anotaciones.correrSeleccion(direccion[0] * paso, direccion[1] * paso);
      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && seleccionadas.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      anotaciones.borrarSeleccion();
      return;
    }

    if (!(e.metaKey || e.ctrlKey)) return;
    const tecla = e.key.toLowerCase();

    if (tecla === 'z') {
      // 🔴 Se frena la propagación: sin esto BlockNote deshace ADEMÁS su propio
      // paso y se pierden dos cosas distintas de un solo tecleo.
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) anotaciones.rehacer();
      else anotaciones.deshacer();
      return;
    }
    if (tecla === 'y') {
      e.preventDefault();
      e.stopPropagation();
      anotaciones.rehacer();
      return;
    }
    if (tecla === 'a') {
      e.preventDefault();
      e.stopPropagation();
      anotaciones.elegir(paraTocar.map((f) => f.id));
      return;
    }
    if (seleccionadas.length === 0) return;

    if (tecla === 'c') {
      e.preventDefault();
      e.stopPropagation();
      portapapelesInterno = elegidas;
      return;
    }
    if (tecla === 'x') {
      e.preventDefault();
      e.stopPropagation();
      portapapelesInterno = elegidas;
      anotaciones.borrarSeleccion();
      return;
    }
    if (tecla === 'd') {
      e.preventDefault();
      e.stopPropagation();
      anotaciones.duplicarSeleccion();
    }
  };

  const cursor =
    herramienta === 'rotulo' ? 'cursor-text' : herramienta === 'seleccion' ? 'cursor-default' : 'cursor-crosshair';

  /**
   * ══ TODO EL CONTENIDO — portado, o inline según haya `.hoja-a4` o no ═══════
   *
   * Con `.hoja-a4` (una página de TEXTO, con editor), esto se porta ahí
   * adentro con `createPortal` (ver más abajo): es la única caja que de
   * verdad scrollea el texto, así que dibujar arriba de ella exige vivir
   * ADENTRO. Una página-ARCHIVO Word/txt no tiene `.hoja-a4` —nunca pasa por
   * BlockNote— pero SÍ tiene su propio visor con scroll propio
   * (`contenedorArchivo`, ver su docblock): ahí se porta A ÉSE en su lugar.
   * Solo con NINGUNO de los dos (un PDF, o el instante transitorio antes de
   * que el nodo exista) este MISMO árbol se renderiza EN SU LUGAR de siempre,
   * hermano de `{children}` dentro de `Hoja` — el comportamiento de antes del
   * 08-sep-2026, que sigue siendo el correcto ahí porque no hay ninguna caja
   * con scroll propio de la que colgarse.
   *
   * Un solo `div` es lo que se porta (o se planta): `.hoja-a4 > *`
   * (`index.css`) le da `flex` a TODO hijo directo, y un `<canvas>`/`<input>`
   * sueltos como hijos directos heredarían esa regla junto con ella. Este
   * envoltorio, `absolute`, queda afuera del flujo —la regla no le hace
   * nada— y es el ÚNICO que la hereda cuando se porta; los de adentro se
   * posicionan contra ÉL. `pointer-events-none` porque es un div sin nada
   * propio que decir: si no, taparía cada clic al texto de abajo, aunque no
   * haya ni un trazo puesto.
   *
   * ⚠️ `left`/`top` son `origen`, NO `0`: con `.hoja-a4`, `origen` corrige su
   * padding (ver el docblock de «Medir»); sin ella, ya viene en `{0, 0}`. El
   * ancho/alto explícitos son los mismos que ya lleva el canvas — puestos acá
   * además, todo lo de adentro (`CajaFlotante` incluida) queda en el MISMO
   * sistema de coordenadas sin que cada una tenga que saber de este offset
   * por su cuenta.
   */
  const contenido = (
    <div
      className="pointer-events-none absolute"
      style={{ left: origen.x, top: origen.y, width: medida.ancho, height: medida.alto }}
    >
      <canvas
        ref={canvasRef}
        width={Math.max(1, Math.round(medida.ancho * dpr))}
        height={Math.max(1, Math.round(medida.alto * dpr))}
        style={{ width: medida.ancho || '100%', height: medida.alto || '100%' }}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onKeyDown={alTeclear}
        // El `tabIndex` es lo que deja que Suprimir, las flechas y ⌘Z lleguen
        // acá; solo cuando la capa está activa, o robaría el tabulador.
        tabIndex={activa ? 0 : undefined}
        // 🔴 LA LÍNEA QUE DECIDE TODO. Ver el docblock: sin el `none`, la capa se
        // come cada clic del editor de texto que hay debajo.
        // ⚠️ `pointer-events` SE HEREDA (a diferencia de casi todo lo demás en
        // CSS): desde que este canvas vive dentro del `div` envoltorio con
        // `pointer-events-none` (ver el `return` de más abajo), «no poner
        // `-none`» YA NO ALCANZA para volver a capturar el puntero — hace
        // falta el `-auto` explícito, o se hereda el `none` del padre y la
        // capa activa se queda sorda a cada clic.
        className={
          'absolute inset-0 z-10 outline-none ' +
          (activa ? `pointer-events-auto touch-none ${cursor}` : 'pointer-events-none')
        }
        // No es una imagen con contenido propio: es una capa sobre el documento.
        role="application"
        aria-label={
          activa
            ? `Capa de anotaciones activa (${herramienta}). Escape vuelve al texto.`
            : 'Capa de anotaciones en reposo'
        }
      />

      {/* El buscador de archivos. Oculto: lo dispara el botón de la barra.
          `aria-label` porque desde que existe `NuevaPagina.tsx` (26-ago-2026)
          ya no es el ÚNICO `input[type="file"]` de la Libreta — sin esto, un
          selector genérico no sabe distinguir «elegir imagen» de «elegir
          documento». */}
      <input
        ref={archivoRef}
        type="file"
        aria-label="Elegir imagen"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          // El valor se limpia para que elegir DOS VECES el mismo archivo
          // vuelva a disparar `change` — si no, la segunda vez no pasa nada.
          e.target.value = '';
          if (archivo) void montarImagen(archivo);
        }}
      />

      {/*
        LAS CAJAS DE TEXTO. Van FUERA del canvas —son DOM de verdad— pero adentro
        del mismo contenedor, así que comparten coordenadas y scrollean igual.
        Solo se dibujan las de una capa visible.
      */}
      {paraVer
        .filter((f): f is Extract<Figura, { clase: 'caja' }> => f.clase === 'caja')
        .map((f) => (
          <CajaFlotante
            key={f.id}
            // La caja es DOM, así que su opacidad no pasa por el pintor: se le
            // entrega ya resuelta, o una capa al 40 % dejaría los trazos
            // atenuados y los textos opacos.
            figura={{ ...f, opacidad: opacidadEfectiva(f, capas) }}
            editando={editandoCaja === f.id}
            elegida={seleccionadas.includes(f.id)}
            /**
             * 🔴 SOLO en modo SELECCIÓN, no con «cualquier herramienta activa»
             * (08-sep-2026, corrige "a veces no deja dibujar"). La caja es un
             * `<div>` de verdad, POR ENCIMA del canvas (z-index 11 contra 10,
             * ver su docblock) — con cualquier otra herramienta puesta
             * (lápiz, elipse, borrador…), su `onPointerDown` no hace nada
             * para esos casos, pero mientras `interactiva` fuera `activa`
             * (cualquier herramienta) el clic SE QUEDABA en la caja igual: el
             * navegador entrega el evento al elemento de MÁS ARRIBA, y ese
             * clic nunca llegaba al canvas. Medido: un trazo que empieza
             * adentro del rectángulo de una caja existente —así no se vea
             * nada ahí, el fondo es transparente— no dispara ni `alBajar`.
             * Con la capa en reposo (`activa` falso) esto ya pasaba lo mismo
             * de siempre; el arreglo es que TAMPOCO bloquee con el lápiz en
             * la mano.
             */
            interactiva={herramienta === 'seleccion'}
            onTexto={(t) => textoDeCaja(f.id, t)}
            onAlto={(alto) => altoDeCaja(f.id, alto)}
            onEmpezarAEditar={() => {
              previas.current = figuras;
              setEditandoCaja(f.id);
            }}
            onTerminarDeEditar={cerrarEdicion}
            onPointerDown={(e) => {
              // Como objeto, el puntero de la caja es el de la capa: así se la
              // arrastra y se la suma a una selección con las mismas reglas que
              // un trazo, sin una segunda implementación.
              if (herramienta === 'seleccion') alBajar(e);
            }}
          />
        ))}

      {escribiendo && (
        <input
          autoFocus
          value={escribiendo.valor}
          onChange={(e) => setEscribiendo({ ...escribiendo, valor: e.target.value })}
          onBlur={() => cerrarRotulo(true)}
          onKeyDown={(e) => {
            // El teclado del rótulo NO sube: una `Enter` que llegue a BlockNote
            // parte la página en dos mientras se escribe sobre el dibujo.
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              cerrarRotulo(true);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cerrarRotulo(false);
            }
          }}
          aria-label="Texto de la anotación"
          placeholder="Escribe y Enter"
          // `pointer-events-auto`: mismo motivo que el canvas — el padre lo
          // hereda en `none` y esta caja SIEMPRE está activa mientras existe.
          className="pointer-events-auto absolute z-20 rounded border border-dashed border-primary bg-card/90 px-1 outline-none"
          style={{
            left: escribiendo.en[0],
            top: escribiendo.en[1],
            color,
            fontSize: tamanoDeRotulo(grosor),
            width: Math.max(140, (escribiendo.valor.length + 2) * tamanoDeRotulo(grosor) * 0.6),
          }}
        />
      )}

      {(anotaciones.aviso || subiendo) && (
        <p
          className={
            'sticky bottom-2 z-20 mx-2 rounded px-2 py-1 text-xs ' +
            (anotaciones.aviso
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-secondary text-secondary-foreground')
          }
          role={anotaciones.aviso ? 'alert' : 'status'}
        >
          {anotaciones.aviso ?? 'Subiendo la imagen…'}
        </p>
      )}
    </div>
  );

  if (hojaA4) return createPortal(contenido, hojaA4);
  if (contenedorArchivo) return createPortal(contenido, contenedorArchivo);
  return contenido;
}
