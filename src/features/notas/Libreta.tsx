import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorLibreta } from './editor';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Link2,
  Notebook,
  Paperclip,
  Pin,
  Plus,
  Search,
  Star,
  Undo2,
} from 'lucide-react';
import { BarraDeDibujo, GROSORES, PALETA, type Herramienta } from './dibujo/BarraDeDibujo';
import { CapaDeAnotaciones } from './dibujo/CapaDeAnotaciones';
import { SelectorDeColor } from './dibujo/SelectorDeColor';
import { useAnotaciones } from './dibujo/useAnotaciones';
import { CAPA_BASE, paraGuardar, type Figura } from './dibujo/figuras';
import {
  CAPAS_INICIALES,
  agregarCapa,
  borrarCapa,
  cambiarCapa,
  capasNecesarias,
  duplicarCapa,
  moverCapa,
  type Capa,
} from './dibujo/capas';
import { PanelDeCapas } from './dibujo/PanelDeCapas';
import { agregarReciente, leerRecientes } from './dibujo/coloresRecientes';
import { ModalDePlantillas } from './ModalDePlantillas';
import { ModalDeRespuestasRapidas } from './ModalDeRespuestasRapidas';
import { PantallaHechos } from '../hechos/PantallaHechos';
import { AccionesDePagina } from './AccionesDePagina';
import { MenuDeFila, type AccionDeFila } from './MenuDeFila';
import { ModalDeLink } from './ModalDeLink';
import { AuditoriaDeLink } from './AuditoriaDeLink';
import { ColumnaDeEscritura, EditorPerezoso, precargarEditor } from './perezosos';
import { PantallaDividida } from './PantallaDividida';
import { NuevaPagina } from './NuevaPagina';
import { PaginaDocumento } from './PaginaDocumento';
import { ErrorDeDocumento, descargarDocumento, subirDocumento } from './documentos';
import { TituloEditable } from './TituloEditable';
import { BarraDePestanas } from './BarraDePestanas';
import { usePestanas, siguienteAlCerrar, type RefPestana } from './pestanas';
import { dondeDeVista, mismaVista, mismoUsuario, nombreCorto, useEspacios, type VistaLibreta } from './espacios';
import { SelectorDeEspacio } from './SelectorDeEspacio';
import { ModalDeEspacios } from './ModalDeEspacios';
import { MenuDeConfiguracion } from './MenuDeConfiguracion';
import { ModalDeConfirmacion } from './ModalDeConfirmacion';
import { FiltroDeTipoDeArchivo, type AlcanceDeFiltro } from './FiltroDeTipoDeArchivo';
import { tokenDeLaUrl, usePaginaPorLink } from './porLink';
import { renglonDeEstado } from './guardado';
import { useAutoguardado, type ContenidoDePagina } from './useAutoguardado';
import { ErrorApi } from '../../lib/datos/cliente';
import {
  ETIQUETA_DE_CLASE,
  MAX_FIJADAS_POR_APARTADO,
  type ClaseDeArchivo,
  type Nota,
  claseDeArchivo,
  docParaEditor,
  resumenDeNota,
  tituloDeNota,
  useBuscarNotas,
  useFavoritas,
  useMutacionesNotas,
  useNotaPorId,
  useNotas,
  usePapelera,
} from './notas';

/**
 * LA LIBRETA — el espacio de trabajo privado de la vendedora. La OCTAVA VISTA
 * del riel (⌘8), y también la tecla `n` de siempre.
 *
 * ══ POR QUÉ AHORA SÍ ES UNA VISTA DEL RIEL (ADR 0034) ═══════════════════════
 *
 * Acá decía «el riel se queda en SEIS» y que esto era una superficie que se
 * abre con `n` — la categoría de la Cabina (`?`) e Ivi (`i`). El criterio de
 * ADR 0016 no cambió y **es el que la hace entrar**: el riel es para LUGARES.
 * La Cabina e Ivi no son lugares, son CONSULTAS que abres, usas y cierras; una
 * libreta es un lugar — entras, estás un rato, vuelves.
 *
 * Lo que sí cambió es la evidencia. Aquella decisión (#197) se tomó cuando la
 * libreta era chica y no entraba gente nueva. Al 4-ago-2026 entran seis
 * vendedores el mismo día y la tabla `notas` tiene **cero filas**: nadie
 * escribió nunca una. Se abría con una tecla que nadie enseñó y no tenía ícono
 * en ningún lado.
 *
 * ══ EL ESCAPE SIGUE SIN MANEJARSE ACÁ ═══════════════════════════════════════
 *
 * Antes porque el componente vivía montado con la app y un `useEscape` sin su
 * condición de abierta **se come el Escape de todos** (pasó con `ConsultaIvi`:
 * dejaron de andar cerrar la conversación, cerrar la Cabina y cerrar la libreta
 * — ADR 0024). Ahora por un motivo distinto y más simple: **de una vista no se
 * sale con Escape**, se va a otra. Como en Dashboard o Pipeline, acá Escape no
 * hace nada. No agregar un listener propio.
 *
 * ══ LO QUE NO HACE, POR REGLA ═══════════════════════════════════════════════
 *
 * **No tiene botón de mandar.** De una nota no se deriva nada: ni etapa, ni
 * recordatorio, ni envío (ADR 0012). Si se pareciera a una respuesta rápida
 * rompería «un envío = una acción humana». Se archiva, no se borra. Y **sin
 * oro**: el dorado significa tiempo que se acaba, y acá no se acaba nada.
 */

/** Lo que la lista tiene seleccionado: una nota guardada, o una página en blanco. */
type Seleccion = { tipo: 'nota'; id: number; origen: Nota['origen'] } | { tipo: 'nueva' } | null;

const CLAVE_LIBRETA = 'general';

function mismaSeleccion(a: Seleccion, b: Seleccion): boolean {
  if (a === null || b === null) return a === b;
  if (a.tipo !== b.tipo) return false;
  return a.tipo === 'nota' && b.tipo === 'nota' ? a.id === b.id : true;
}

/**
 * LA HOJA: el documento con su capa de anotaciones encima.
 *
 * ══ POR QUÉ ESTE ENVOLTORIO EXISTE ══════════════════════════════════════════
 *
 * Es el `relative` que le da a la capa su sistema de coordenadas. `absolute
 * inset-0` adentro de acá mide **exactamente el alto del contenido** —no el de
 * la ventana—, y es lo que hace que las anotaciones scrolleen pegadas al texto
 * sin una línea de código de scroll (ver `CapaDeAnotaciones`).
 *
 * También es el punto donde el texto y el dibujo se juntan y siguen separados:
 * el editor no sabe que hay una capa encima, y la capa no sabe qué dice el
 * texto. Lo único que comparten es este rectángulo.
 *
 * ⚠️ SIN `max-w` ACÁ, A PROPÓSITO (19-ago-2026). Esto envuelve TODO lo que
 * `ZonaDeTrabajo` reciba, pantalla dividida incluida: un `max-w-3xl` en este
 * nivel encajonaba las DOS mitades adentro de un mismo cajón de 768 px, en vez
 * de dejarlas repartirse el ancho real entre la lista y la barra de dibujo. El
 * ancho de lectura de una página simple lo pone `.bn-editor` en `index.css`.
 */
function Hoja({
  children,
  anotaciones,
  herramienta,
  color,
  grosor,
  opacidad,
  capaActiva,
  capas,
  pedirImagen,
  onSubiendo,
  onSalirDelDibujo,
  editor,
  hojaA4,
  contenedorArchivo,
}: {
  children: React.ReactNode;
  anotaciones: ReturnType<typeof useAnotaciones> | null;
  herramienta: Herramienta;
  color: string;
  grosor: number;
  opacidad: number;
  capaActiva: string;
  capas: Capa[];
  pedirImagen(abrir: (() => void) | null): void;
  onSubiendo(subiendo: boolean): void;
  onSalirDelDibujo(): void;
  /** La instancia viva de BlockNote, para anclar las figuras al párrafo. Ver `CapaDeAnotaciones`. */
  editor: EditorLibreta | null;
  /** El nodo de `.hoja-a4` donde `CapaDeAnotaciones` porta su canvas. Ver `perezosos.tsx`. */
  hojaA4: HTMLDivElement | null;
  /** El gemelo de `hojaA4` para una página-archivo (Word/txt). Ver `PaginaDocumento.tsx`. */
  contenedorArchivo: HTMLElement | null;
}) {
  return (
    // ⚠️ Ya NO es el contenedor del canvas (08-sep-2026): `CapaDeAnotaciones`
    // porta todo su contenido dentro de `.hoja-a4` — es la única caja que de
    // verdad scrollea el texto. Este `div` queda como quedó, sin tocarlo más
    // de lo necesario para este arreglo.
    <div className="relative px-6 py-8">
      {children}
      {anotaciones && (
        <CapaDeAnotaciones
          anotaciones={anotaciones}
          herramienta={herramienta}
          color={color}
          grosor={grosor}
          opacidad={opacidad}
          capaId={capaActiva}
          capas={capas}
          pedirImagen={pedirImagen}
          onSubiendo={onSubiendo}
          onSalirDelDibujo={onSalirDelDibujo}
          editor={editor}
          hojaA4={hojaA4}
          contenedorArchivo={contenedorArchivo}
        />
      )}
    </div>
  );
}

/**
 * LA ZONA DE TRABAJO: el documento que scrollea + la barra de la derecha.
 *
 * ══ POR QUÉ ES UN COMPONENTE APARTE Y VA CON `key` ══════════════════════════
 *
 * Porque acá viven las anotaciones de la página abierta, y **cambiar de página
 * tiene que empezarlas de cero**. Con la `key` puesta afuera, React remonta esto
 * al saltar de nota y el hook se resiembra solo — la misma técnica que ya usa
 * `EditorDePagina`, y por el mismo motivo: sin remontar, la capa seguiría
 * mostrando los círculos de la página anterior sobre el texto de la nueva, y el
 * primer trazo los guardaría todos en la página equivocada.
 *
 * También es lo que junta al documento con la barra sin que el editor sepa que
 * la barra existe: acá adentro son dos hermanos en una fila.
 */
function ZonaDeTrabajo({
  hoja,
  editor,
  hojaA4,
  contenedorArchivo,
  onGuardarAnotaciones,
  onPedirConfirmacion,
  children,
}: {
  /** Abre el modal de confirmación compartido de `Libreta` — ver su docblock. */
  onPedirConfirmacion: (v: { titulo: string; mensaje: string; textoConfirmar: string; onConfirmar: () => void }) => void;
  /**
   * La página abierta, o `null` cuando lo que se muestra no es un documento
   * (la bienvenida, «elige una página», un link roto). Con `null` esto es un
   * contenedor con scroll y nada más: ni capa, ni barra.
   */
  hoja: { anotacionesIniciales: unknown; soloLectura: boolean } | null;
  /**
   * La instancia viva del editor de la página principal, o `null` sin una
   * todavía montada (o sin editor — una página-archivo, una histórica). Viaja
   * hasta `CapaDeAnotaciones` para anclar las figuras al párrafo.
   */
  editor: EditorLibreta | null;
  /** El nodo de `.hoja-a4` donde `CapaDeAnotaciones` porta su canvas. Ver `perezosos.tsx`. */
  hojaA4: HTMLDivElement | null;
  /** El gemelo de `hojaA4` para una página-archivo (Word/txt). Ver `PaginaDocumento.tsx`. */
  contenedorArchivo: HTMLElement | null;
  onGuardarAnotaciones(figuras: Figura[]): void;
  children: React.ReactNode;
}) {
  const [herramienta, setHerramienta] = useState<Herramienta>('puntero');
  const [color, setColor] = useState<string>(PALETA[0]);
  const [grosor, setGrosor] = useState<number>(GROSORES[1]);
  const [opacidad, setOpacidad] = useState(1);
  const [capaActiva, setCapaActiva] = useState(CAPA_BASE);
  const [capas, setCapas] = useState<Capa[]>(CAPAS_INICIALES);
  const [panelDeCapas, setPanelDeCapas] = useState(false);
  const [selectorDeColor, setSelectorDeColor] = useState(false);
  /**
   * El color de antes de abrir el selector, para que «Cancelar» pueda volver.
   * Se toma al ABRIR y no en cada render: durante la vista previa `color` ya
   * cambió, y leerlo entonces devolvería el color previsualizado.
   */
  const [colorAlAbrir, setColorAlAbrir] = useState(PALETA[0] as string);
  const [recientes, setRecientes] = useState<string[]>(leerRecientes);
  const [subiendo, setSubiendo] = useState(false);
  /**
   * El abridor del buscador de archivos, que vive en la CAPA (ahí está el
   * `<input type="file">`, porque ahí se sabe dónde soltar la imagen) y lo
   * dispara un botón de la BARRA. Esto es el cable entre los dos hermanos.
   */
  const [abrirArchivo, setAbrirArchivo] = useState<{ abrir: () => void } | null>(null);
  /**
   * 🔴 `useCallback` y no una flecha suelta. La capa registra el abridor desde un
   * efecto que depende de esta función; con una identidad nueva en cada render,
   * el efecto vuelve a correr, vuelve a llamar a este `setState` con un objeto
   * NUEVO, y eso dispara otro render — un bucle infinito que cuelga la pestaña.
   */
  const registrarAbridor = useCallback(
    (abrir: (() => void) | null) => setAbrirArchivo(abrir ? { abrir } : null),
    [],
  );

  const anotaciones = useAnotaciones({
    iniciales: hoja?.anotacionesIniciales,
    onGuardar: onGuardarAnotaciones,
  });

  /**
   * ELEGIR UN COLOR HACE DOS COSAS DISTINTAS, y cuál depende de si hay algo
   * seleccionado. Es la convención de todo editor de dibujo:
   *
   *  · **Con figuras elegidas** las REPINTA — es lo que uno espera al marcar un
   *    trazo y tocar el rojo. Va como un solo paso de deshacer.
   *  · **Sin nada elegido** queda como el color del próximo trazo.
   *
   * En los dos casos el color pasa a «recientes»: la lista es de lo que se USÓ,
   * y usarlo para repintar cuenta igual que usarlo para dibujar.
   */
  /**
   * Las capas que la página necesita: las declaradas más una por cada `capaId`
   * huérfano de las figuras. Sin esto, una página guardada con figuras en una
   * capa que ya no existe las dejaría invisibles e inalcanzables.
   */
  const capasVivas = capasNecesarias(capas, anotaciones.figuras);

  /**
   * LA OPACIDAD HACE LO MISMO QUE EL COLOR, y antes no.
   *
   * Con objetos elegidos los atenúa; sin nada elegido queda para los próximos.
   * El deslizador solo guardaba el valor futuro, así que sobre una selección no
   * pasaba nada — se veía como un control roto.
   */
  const elegirOpacidad = (o: number) => {
    setOpacidad(o);
    anotaciones.opacarSeleccion(o);
  };

  /** Mientras se arrastra por el selector: se ve, pero no se anota. */
  const previsualizarColor = (c: string) => {
    setColor(c);
    anotaciones.pintarSeleccion(c);
  };

  /** Elegido de verdad (paleta, reciente o «Aceptar»): además va a la lista. */
  const elegirColor = (c: string) => {
    previsualizarColor(c);
    setRecientes(agregarReciente(c));
  };

  /**
   * ⚠️ Sobre una página de SOLO LECTURA las anotaciones **se ven pero no se
   * tocan**: la herramienta queda clavada en `puntero` y la barra no se dibuja.
   * Dejar la barra ahí sería ofrecer dibujar sobre una histórica de `gestiones`
   * — el trazo saldría en pantalla y no se guardaría nunca.
   */
  const puedeDibujar = hoja !== null && !hoja.soloLectura;
  const herramientaEfectiva: Herramienta = puedeDibujar ? herramienta : 'puntero';

  return (
    // 🔴 `min-w-0` en LOS DOS niveles (19-ago-2026): sin esto, cada flex item
    // vale `min-width: auto` (el ancho mínimo de su CONTENIDO, no cero) y se
    // niega a encogerse por debajo de lo que la hoja/una tabla ancha pidan —
    // empujando la barra de dibujo (fija, `w-12`) fuera de la pantalla en vez
    // de dejar que `overflow-y-auto`, más abajo, se ocupe. Mismo arreglo un
    // nivel más afuera, en el `<main>` de `Libreta.tsx`.
    <div className="flex min-h-0 min-w-0 flex-1">
      {/* EL SCROLL ES DE ESTA COLUMNA, no de la fila: la barra tiene que quedarse
          quieta mientras la página se desplaza debajo. */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {hoja ? (
          <Hoja
            anotaciones={anotaciones}
            herramienta={herramientaEfectiva}
            opacidad={opacidad}
            capaActiva={capaActiva}
            capas={capasVivas}
            color={color}
            grosor={grosor}
            pedirImagen={registrarAbridor}
            onSubiendo={setSubiendo}
            onSalirDelDibujo={() => setHerramienta('puntero')}
            editor={editor}
            hojaA4={hojaA4}
            contenedorArchivo={contenedorArchivo}
          >
            {children}
          </Hoja>
        ) : (
          children
        )}
      </div>

      {/*
        EL PANEL DE CAPAS, a la izquierda de la barra: es donde hay lugar. Se
        monta acá y no adentro de la barra para que su ancho no pelee con los
        48 px de la columna de botones.
      */}
      {puedeDibujar && panelDeCapas && (
        <div className="relative">
          <div className="absolute bottom-2 right-2 z-30">
            <PanelDeCapas
              capas={capasVivas}
              figuras={anotaciones.figuras}
              capaActiva={capaActiva}
              haySeleccion={anotaciones.seleccionadas.length > 0}
              onCapaActiva={setCapaActiva}
              onCambiarCapa={(id, cambios) => setCapas(cambiarCapa(capasVivas, id, cambios))}
              onRenombrar={(id, nombre) => setCapas(cambiarCapa(capasVivas, id, { nombre }))}
              onAgregar={() => {
                const r = agregarCapa(capasVivas, capaActiva);
                setCapas(r.capas);
                // La nueva queda activa: es lo que se espera al apretar «+».
                setCapaActiva(r.nueva.id);
                // Y si había algo elegido en el lienzo, se muda con ella: crear
                // una capa para lo que ya se tiene a mano no debería obligar a
                // volver a elegirlo después para recién ahí poder mandarlo.
                if (anotaciones.seleccionadas.length > 0) anotaciones.moverSeleccionACapa(r.nueva.id);
              }}
              onDuplicar={(id) => {
                const r = duplicarCapa(capasVivas, anotaciones.figuras, id);
                if (!r) return;
                setCapas(r.capas);
                setCapaActiva(r.nueva.id);
                // Las copias van por el hook para que entren al historial: un
                // ⌘Z tiene que poder deshacer «dupliqué una capa».
                anotaciones.reemplazar(r.figuras);
              }}
              onBorrar={(id) => {
                const r = borrarCapa(capasVivas, anotaciones.figuras, id);
                if (!r) return;
                const borrar = () => {
                  setCapas(r.capas);
                  if (capaActiva === id) setCapaActiva(r.activaNueva);
                  anotaciones.reemplazar(
                    anotaciones.figuras.filter((f) => f.capaId !== id),
                    [],
                  );
                };
                /**
                 * 🔴 SE PREGUNTA SOLO SI SE LLEVA ALGO. Un modal sobre una capa
                 * vacía es una fricción que enseña a apretar «Eliminar» sin
                 * leer — y entonces el día que la capa tenga ocho objetos, la
                 * confirmación tampoco se lee.
                 */
                if (r.seLleva.length > 0) {
                  const cuantos = r.seLleva.length;
                  onPedirConfirmacion({
                    titulo: '¿Eliminar esta capa?',
                    mensaje: `También se eliminan los ${cuantos} ${cuantos === 1 ? 'elemento' : 'elementos'} que contiene.`,
                    textoConfirmar: 'Eliminar',
                    onConfirmar: borrar,
                  });
                  return;
                }
                borrar();
              }}
              onMover={(id, hacia) => setCapas(moverCapa(capasVivas, id, hacia))}
              onOrdenar={anotaciones.ordenarSeleccion}
              onMoverSeleccionA={anotaciones.moverSeleccionACapa}
            />
          </div>
        </div>
      )}

      {/*
        EL SELECTOR AVANZADO. Fuera de la barra, por el mismo motivo que el panel
        de capas: la barra scrollea (`overflow-y-auto`) y recorta todo lo que se
        posicione fuera de su caja. Adentro se montaba y no se veía.
      */}
      {puedeDibujar && selectorDeColor && (
        <div className="relative">
          <div className="absolute bottom-2 right-2 z-40">
            <SelectorDeColor
              inicial={colorAlAbrir}
              onVistaPrevia={previsualizarColor}
              onCancelar={() => setSelectorDeColor(false)}
              onAceptar={(c) => {
                elegirColor(c);
                setSelectorDeColor(false);
              }}
            />
          </div>
        </div>
      )}

      {puedeDibujar && (
        <BarraDeDibujo
          herramienta={herramienta}
          color={color}
          grosor={grosor}
          opacidad={opacidad}
          recientes={recientes}
          capasAbiertas={panelDeCapas}
          selectorAbierto={selectorDeColor}
          puedeDeshacer={anotaciones.puedeDeshacer}
          puedeRehacer={anotaciones.puedeRehacer}
          hayAlgo={anotaciones.hayAlgo}
          hayImagenSubiendo={subiendo}
          onHerramienta={setHerramienta}
          onColor={elegirColor}
          onGrosor={setGrosor}
          onOpacidad={elegirOpacidad}
          onCapas={() => setPanelDeCapas((v) => !v)}
          onSelector={() => {
            // Al abrir se recuerda el color actual: es lo que «Cancelar» restaura.
            if (!selectorDeColor) setColorAlAbrir(color);
            setSelectorDeColor((v) => !v);
          }}
          onImagen={() => abrirArchivo?.abrir()}
          onDeshacer={anotaciones.deshacer}
          onRehacer={anotaciones.rehacer}
          onLimpiar={anotaciones.limpiar}
        />
      )}
    </div>
  );
}

/**
 * QUÉ ACCIÓN OFRECE `FilaPagina` — el tipo vive en `MenuDeFila.tsx` (04-sep-2026)
 * junto con el menú `⋮` que las dibuja todas: dos formas mutuamente excluyentes,
 * nunca las dos juntas.
 *
 *   · **`normal`**: fijar/desfijar (favoritas), mover, compartir y archivar. Es
 *     lo de siempre, para cualquier vista que no sea la Papelera — «mover» y
 *     «compartir» se sumaron acá el 04-sep-2026, ver ADR 0093 (antes solo
 *     existían en `AccionesDePagina.tsx`, viendo la página ya ABIERTA).
 *   · **`papelera`**: restaurar (desarchivar) + eliminar para siempre. Una
 *     página ya archivada no se puede volver a fijar, mover ni compartir desde
 *     acá — esas son acciones de una página VIVA.
 */

/** Un renglón de la lista de páginas. */
function FilaPagina({
  nota,
  activa,
  autora,
  onAbrir,
  accion,
  onRenombrar,
  deEspacio = null,
}: {
  nota: Nota;
  activa: boolean;
  /**
   * A quién mostrar como autora, o `null` para no mostrar a nadie.
   *
   * ⚠️ **En la libreta privada NO se dibuja**, y no es por ahorrar píxeles: todas
   * las páginas son tuyas, así que tu propio nombre repetido en cada renglón es
   * ruido puro. En un espacio compartido es al revés — es la mitad de la
   * información, porque decide a quién preguntarle por ese precio.
   */
  autora: string | null;
  onAbrir: () => void;
  accion: AccionDeFila;
  /**
   * Renombrar SIN abrir la página primero (26-ago-2026, botón «Editar» en el
   * hover). Solo se ofrece para `'archivo'` — ver el porqué en el `if` de
   * más abajo.
   */
  onRenombrar: (texto: string) => void;
  /**
   * DE QUÉ ESPACIO VINO (04-sep-2026) — solo se pasa en la Papelera, que desde
   * ADR 0093 también trae lo archivado de tus espacios (antes solo mostraba tu
   * libreta privada). Sin esto, una página de «Oximoron» archivada se vería
   * IGUAL que una privada en la misma lista — y «restaurar» la devuelve a un
   * espacio que la fila ni menciona.
   */
  deEspacio?: string | null;
}) {
  const titulo = tituloDeNota(nota);
  const resumen = resumenDeNota(nota);
  const historica = nota.origen === 'gestion';
  /**
   * ⚠️ **SOLO archivo, y no es una limitación de la UI — es del MODELO.** El
   * título de una página de texto no es un campo propio: es la primera línea
   * de `doc`, y el server lo REDERIVA de ahí en cada autoguardado
   * (`prepararContenido`, `server/src/notas/notas.ts`). Un botón que solo
   * mandara `texto` sin `doc` renombraría la fila en el acto, pero el
   * próximo carácter que se escriba en el editor —en cualquier parte de la
   * página, no solo el título— lo pisaría en silencio con la primera línea
   * de siempre. Un archivo no tiene ese problema: su `texto` NO se deriva de
   * nada, es el único lugar donde vive el nombre.
   */
  const puedeRenombrar = nota.tipo === 'archivo';
  const [editando, setEditando] = useState(false);

  return (
    <div
      className={`group relative rounded-lg border px-3 py-2 transition ${
        activa ? 'border-primary bg-secondary' : 'border-transparent hover:bg-muted'
      }`}
    >
      {/* `items-start`, no `items-center`: con un resumen de dos líneas el
          bloque de acciones de la derecha tiene que arrancar arriba, alineado
          con el título — centrado se veía descolgado hacia el medio de la fila. */}
      <div className="flex items-start gap-1">
        {(() => {
          const contenido = (
            <>
              <div className="flex items-center gap-1.5">
                {nota.fijada && <Pin className="size-3 shrink-0 text-muted-foreground" aria-label="fijada" />}
                {/* Igual que el Pin de arriba: se ve SIEMPRE, no solo al hover —
                    es la única forma de reconocer, de un vistazo por la lista,
                    cuál está en Favoritos (04-sep-2026, ADR 0093). */}
                {nota.favorita && <Star className="size-3 shrink-0 fill-amber-400 text-amber-500" aria-label="favorita" />}
                {editando ? (
                  <TituloEditable
                    valor={nota.texto}
                    placeholder="Nombra la página"
                    autoFocus
                    onGuardar={onRenombrar}
                    onTerminar={() => setEditando(false)}
                    className="h-6 min-w-0 flex-1 rounded border border-input bg-card px-1.5 text-sm font-medium text-foreground outline-none focus:border-ring"
                  />
                ) : (
                  <span className="truncate text-sm font-medium text-foreground">{titulo || 'Sin título'}</span>
                )}
                {/* 🔴 QUE ESTÁ AFUERA SE DICE EN LA LISTA, no solo al abrirla. Es la
                    única forma de contestar «¿qué tengo publicado?» de un vistazo — sin
                    esto, compartir sería una acción sin inventario. */}
                {nota.token && (
                  <Link2 className="size-3 shrink-0 text-muted-foreground" aria-label="tiene link público" />
                )}
              </div>
              {resumen && <p className="mt-0.5 truncate text-xs text-muted-foreground">{resumen}</p>}
              <p className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                {/* QUIÉN LA ESCRIBIÓ va PRIMERO, antes de la fecha: en un espacio del
                    equipo, «de quién es esto» se pregunta antes que «de cuándo es».
                    Sin oro — acá no se acaba ningún tiempo. */}
                {autora && <span className="font-medium text-foreground/70">{autora}</span>}
                <span>{new Date(nota.creadoAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</span>
                {/* EL CLIP VA DESPUÉS DE LA FECHA — a pedido: antes competía con el
                    título por el mismo renglón angosto; acá es un dato más del pie,
                    junto con la etiqueta de tipo y la de gestión. */}
                {nota.tipo === 'archivo' && (
                  <Paperclip className="size-3 shrink-0" aria-label="documento adjuntado" />
                )}
                {/* 🔴 QUÉ ES, NO SI SE TOCÓ (04-sep-2026, a pedido explícito) — antes
                    acá decía «· editada» cuando `editadoAt` existía. Reemplazado por
                    la clase de la página (Página/PDF/Word/Bloc, `claseDeArchivo`):
                    de un vistazo por la lista, sin abrir nada. */}
                {!historica && <span>{ETIQUETA_DE_CLASE[claseDeArchivo(nota)]}</span>}
                {historica && (
                  <span className="rounded border border-dashed border-border px-1 py-px" title="Quedó de una gestión: se lee, no se edita">
                    de gestión
                  </span>
                )}
                {deEspacio && (
                  <span className="rounded border border-dashed border-border px-1 py-px" title="Restaurarla la devuelve a este espacio">
                    de {deEspacio}
                  </span>
                )}
              </p>
            </>
          );
          // 🔴 EN LA PAPELERA NO SE ABRE: una página archivada no se edita
          // desde acá (restaurar o eliminar para siempre, nada más), así que
          // el título no es un botón — sería prometer un clic que no hace nada.
          return accion.tipo === 'papelera' ? (
            <div className="block min-w-0 flex-1 text-left">{contenido}</div>
          ) : (
            <button type="button" onClick={onAbrir} className="block min-w-0 flex-1 text-left">
              {contenido}
            </button>
          );
        })()}

        {/*
          🔴 EN EL FLUJO NORMAL, NO `absolute` — antes se superponía al título
          (`absolute right-1.5 top-1.5`) y con un nombre largo tapaba las
          últimas letras justo donde estaban los botones, los dos ilegibles a
          la vez. Acá reserva su propio ancho SIEMPRE (el título trunca
          alrededor, nunca por debajo) y solo la OPACIDAD cambia con el hover
          — el espacio no aparece ni desaparece, así que nada salta de lugar.
        */}
        {!historica && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {/*
              LA ESTRELLA (04-sep-2026, ADR 0093) — ocupa el lugar donde antes
              estaba el lápiz de "Renombrar" (que se mudó adentro del menú `⋮`,
              ver `MenuDeFila`). A diferencia del lápiz, no es solo para
              `'archivo'`: cualquier página se puede favoritear, y solo desde
              una vista VIVA (`accion.tipo === 'normal'`) — una de la Papelera
              no se toca desde acá.
            */}
            {accion.tipo === 'normal' && (
              <button
                type="button"
                onClick={accion.onFavorito}
                aria-label={nota.favorita ? 'Quitar de Favoritos' : 'Marcar como favorita'}
                aria-pressed={nota.favorita}
                className={`rounded p-1 hover:bg-card ${
                  nota.favorita ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Star className={`size-3.5 ${nota.favorita ? 'fill-current' : ''}`} />
              </button>
            )}
            <MenuDeFila
              fijada={nota.fijada}
              accion={accion}
              onRenombrar={puedeRenombrar ? () => setEditando(true) : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function Libreta({ vendedoraId }: { vendedoraId?: string | null }) {
  /**
   * EL FILTRO LIVIANO (03-sep-2026) — recorta, al instante y sin ir al
   * server, la lista de la vista actual por título/resumen. Reemplaza a la
   * caja de búsqueda global que había acá (`useBuscarNotas`, que seguía
   * viva para `PantallaDividida`/`PanelNotas` — no se tocó, solo dejó de
   * usarse en este lugar puntual, a pedido explícito).
   */
  const [filtro, setFiltro] = useState('');
  /** El filtro por tipo de archivo (03-sep-2026), vacío = sin filtro — ver `FiltroDeTipoDeArchivo.tsx`. */
  const [tiposElegidos, setTiposElegidos] = useState<Set<ClaseDeArchivo>>(new Set());
  /**
   * EL ALCANCE (03-sep-2026) — dónde buscar: `'todas'` (mi libreta entera),
   * `'favoritas'` (mi libreta, solo fijadas) o el id de un espacio puntual.
   * Vacío = sin restricción (busca en TODO: mi libreta + cada espacio).
   */
  const [alcanceElegido, setAlcanceElegido] = useState<Set<AlcanceDeFiltro>>(new Set());
  /** La página de la LISTA (03-sep-2026), 1-indexada — ver el docblock de `notasVisibles`, más abajo. */
  const [paginaDeLista, setPaginaDeLista] = useState(1);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  /** Lo recién archivado, para poder deshacerlo. Se limpia solo. */
  const [archivada, setArchivada] = useState<{ id: number; titulo: string } | null>(null);
  /**
   * EL AVISO DEL TOPE DE "FIJAR" (04-sep-2026, ADR 0093) — el 409
   * `apartado-lleno` que el server manda cuando ya hay `MAX_FIJADAS_POR_APARTADO`
   * en este mismo apartado (la libreta privada, o ESTE espacio puntual). Se
   * limpia sola en el próximo intento — no hace falta un botón de cerrar para
   * un aviso que dura lo que dura un vistazo.
   */
  const [avisoFijar, setAvisoFijar] = useState<string | null>(null);
  /**
   * QUÉ SE ESTÁ MIRANDO EN EL RIEL (03-sep-2026) — reemplaza a `donde`: son
   * CUATRO vistas posibles, no dos (ver `VistaLibreta` en `espacios.ts`).
   * Arranca en `'todas'`, que es —carácter por carácter— lo que antes se
   * llamaba "Mi libreta". El efecto de más abajo la corre al primer espacio
   * en cuanto hay alguno, igual que antes.
   */
  const [vista, setVista] = useState<VistaLibreta>({ tipo: 'todas' });
  /**
   * EL PANEL DE "PÁGINAS" — flotante, superpuesto sobre el contenido (no lo
   * empuja). Un clic en el riel sobre una fila NUEVA cambia `vista` y ABRE
   * este panel; sobre la MISMA fila que ya estaba elegida, solo hace toggle
   * — ver `alElegirVista`, más abajo.
   */
  const [panelAbierto, setPanelAbierto] = useState(false);
  /**
   * EL RIEL + EL PANEL, juntos — para poder cerrar el panel al tocar afuera de
   * los DOS, mismo patrón que `NuevaPagina.tsx` (`caja`, ahí). Tiene que
   * envolver también al riel: si solo envolviera el panel, tocar una fila del
   * riel para ABRIR una vista distinta contaría como "afuera" y este mismo
   * efecto la cerraría en el mismo gesto que `alElegirVista` la abre.
   */
  const rielYPanelRef = useRef<HTMLDivElement>(null);
  /**
   * EL BUSCADOR + EL FILTRO DE TIPO (03-sep-2026) — desde que se mudaron a la
   * fila de "Nueva página", viven AFUERA de `rielYPanelRef` (esa fila no es
   * ni el riel ni el panel). Sin este segundo `ref`, tocar adentro del
   * buscador contaba como "afuera" para el efecto de más abajo, y cerraba
   * el panel EN EL MISMO CLIC con el que se lo quería usar — reportado como
   * que el buscador "no era fijo".
   */
  const filtrosRef = useRef<HTMLDivElement>(null);
  /**
   * SI LLEGAMOS POR UN LINK INTERNO, la página que ese link señala.
   *
   * `useState(tokenDeLaUrl)` y no una llamada suelta: se lee **una vez, en el
   * primer render**, y el hash se limpia ahí mismo. Con una llamada en el cuerpo
   * del componente, cada re-render volvería a mirar una URL que ya se vació.
   */
  const [tokenEntrante] = useState(tokenDeLaUrl);
  const porLink = usePaginaPorLink(tokenEntrante);

  /**
   * EL MODAL DE PLANTILLAS VIVE ACÁ Y NO ADENTRO DE `EditorDePagina`
   * (ver su docblock): esta página del componente NO se remonta al crear la
   * primera página, así que el modal sobrevive esa transición. Lo que SÍ
   * cambia con cada remonte es CÓMO pegar —la instancia de `editor` es otra—,
   * y por eso viaja por una `ref` que la página activa se encarga de mantener
   * al día (`registrarPegado`, más abajo).
   */
  const [plantillasAbierto, setPlantillasAbierto] = useState(false);
  const pegarPlantillaRef = useRef<((texto: string) => void) | null>(null);
  const abrirPlantillas = useCallback(() => setPlantillasAbierto(true), []);
  const registrarPegado = useCallback((fn: ((texto: string) => void) | null) => {
    pegarPlantillaRef.current = fn;
  }, []);
  /**
   * LA INSTANCIA VIVA DEL EDITOR DE LA PÁGINA PRINCIPAL (no la mitad derecha de
   * la pantalla dividida, que es OTRA página con su propia `PantallaDividida`,
   * fuera de esta capa de anotaciones). A diferencia de `pegarPlantillaRef`,
   * esto SÍ tiene que ser estado: `CapaDeAnotaciones` la necesita como prop
   * para re-suscribirse cuando cambia (`dibujo/anclaje.ts`), y un `ref` no
   * dispara ese re-render.
   */
  const [editorListo, setEditorListo] = useState<EditorLibreta | null>(null);
  const registrarEditor = useCallback((editor: EditorLibreta | null) => setEditorListo(editor), []);
  /**
   * EL NODO DOM DE `.hoja-a4` — donde `CapaDeAnotaciones` porta su canvas
   * (08-sep-2026). Mismo ciclo de vida que `editorListo`: se resetea solo al
   * desmontar `ColumnaDeEscritura` (cambio de página, remonte por `key` de
   * `ZonaDeTrabajo`).
   */
  const [hojaA4Lista, setHojaA4Lista] = useState<HTMLDivElement | null>(null);
  const registrarHojaA4 = useCallback((el: HTMLDivElement | null) => setHojaA4Lista(el), []);
  /**
   * EL GEMELO DE `hojaA4Lista`, PARA UNA PÁGINA-ARCHIVO (08-sep-2026): el
   * `<div>`/`<pre>` que scrollea de verdad un Word o un .txt subido
   * (`PaginaDocumento.tsx` → `VisorDocx`/`VisorTxt`). Un PDF no tiene
   * equivalente —el visor nativo del navegador no presta su DOM— así que ahí
   * esto se queda en `null` y `CapaDeAnotaciones` cae al camino de siempre
   * (sin portar, medido contra `Hoja`).
   */
  const [contenedorArchivoListo, setContenedorArchivoListo] = useState<HTMLElement | null>(null);
  const registrarContenedorDeArchivo = useCallback(
    (el: HTMLElement | null) => setContenedorArchivoListo(el),
    [],
  );
  /**
   * RESPUESTAS RÁPIDAS — mismo molde que el modal de arriba, mismo `ref` de
   * pegado (pegar es genérico: no le importa si el texto vino de una
   * plantilla propia o del catálogo de `hechos`). Dos estados aparte porque
   * son dos catálogos distintos con su propio ciclo de abrir/cerrar.
   */
  const [respuestasAbierto, setRespuestasAbierto] = useState(false);
  const abrirRespuestasRapidas = useCallback(() => setRespuestasAbierto(true), []);
  /** El botón «Configurar Respuestas Rápidas» al pie de la lista abre la MISMA
   * pantalla de administración que ya usa el composer de WhatsApp — no hay
   * una segunda forma de crear o editar una respuesta (#37). */
  const [configurarRespuestasAbierto, setConfigurarRespuestasAbierto] = useState(false);
  /**
   * ADMINISTRAR ESPACIOS (03-sep-2026) — el estado vivía en `SelectorDeEspacio.tsx`
   * con su propio botón fijo; se mudó acá al fusionarse con "Configurar
   * Respuestas Rápidas" en un solo menú de "Configuración" al pie del riel.
   */
  const [administrandoEspacios, setAdministrandoEspacios] = useState(false);
  /**
   * UNA CONFIRMACIÓN PENDIENTE (03-sep-2026) — reemplaza los dos
   * `window.confirm` nativos de este archivo (reportado con una captura: el
   * diálogo del navegador no se lee como parte de Hermes). Un solo estado
   * compartido y no dos, porque las dos confirmaciones son la misma FORMA
   * («¿hacer esto? — no se puede deshacer») con distinto texto: borrar una
   * capa de dibujo y eliminar una página para siempre de la Papelera.
   * `onConfirmar` guarda lo que `window.confirm` hacía DESPUÉS de la
   * pregunta — acá no puede ser código que sigue de largo porque el modal
   * responde en otro render, no en la misma llamada.
   */
  const [confirmacion, setConfirmacion] = useState<{ titulo: string; mensaje: string; textoConfirmar: string; onConfirmar: () => void } | null>(
    null,
  );

  /**
   * COMPARTIR DESDE LA FILA (04-sep-2026, ADR 0093) — guarda solo el `id`, no
   * una foto de la `Nota`: se busca en `notas` (más abajo, la lista VIVA de la
   * vista actual) en cada render, igual que `paginaAbierta`. Con una foto
   * fija, «Generar el link» habría dejado el modal mostrando el token de
   * ANTES de la mutación hasta que algo más forzara un refetch — justo lo que
   * el propio `ModalDeLink` promete no hacer.
   */
  const [compartiendoId, setCompartiendoId] = useState<number | null>(null);
  /** `link` es el modal de configuración, `registro` el Audit Log — mismo par que `AccionesDePagina.tsx` tenía antes de este cambio. */
  const [vistaCompartir, setVistaCompartir] = useState<'link' | 'registro'>('link');

  /** Las tres vistas de "MI LIBRETA" son SIEMPRE la libreta privada — ver `VistaLibreta`. */
  const donde = dondeDeVista(vista);
  const enPapelera = vista.tipo === 'papelera';
  const termino = filtro.trim();
  /**
   * TRES FUENTES, no una — para que el riel pueda mostrar los contadores de
   * "Todas las páginas"/"Favoritas"/"Papelera" SIEMPRE, sin importar qué vista
   * esté mirando ahora mismo: si estoy parada en "Personal", el riel igual
   * tiene que poder decir "Papelera 3". `privadas` y `papelera` se piden
   * SIEMPRE; `delEspacio` solo cuando la vista es un espacio puntual.
   */
  const privadas = useNotas(CLAVE_LIBRETA, null);
  const delEspacio = useNotas(CLAVE_LIBRETA, donde, vista.tipo === 'espacio');
  const papelera = usePapelera(CLAVE_LIBRETA);
  /**
   * FAVORITOS (04-sep-2026, ADR 0093) — SIEMPRE se pide, igual que `papelera`:
   * el contador del riel ("Favoritas 3") tiene que verse sin importar qué
   * vista esté activa. Cruza TODOS los apartados (la libreta privada + cada
   * espacio del que la vendedora es miembro) — decisión explícita del dueño,
   * mismo criterio que ya tiene la Papelera.
   */
  const favoritas = useFavoritas(CLAVE_LIBRETA);
  const {
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
  } = useMutacionesNotas(CLAVE_LIBRETA, donde);

  /**
   * LAS PESTAÑAS (26-ago-2026) — ver `pestanas.ts` para el modelo entero.
   * Acá solo las dos operaciones que cruzan estado que SÍ vive en este
   * componente (`donde`, `seleccion`): activar una mueve el selector de
   * espacio si hace falta, y cerrar la ACTIVA elige cuál queda mirándose
   * (`siguienteAlCerrar`, pura y testeada aparte).
   */
  const pestanas = usePestanas();
  function activarPestana(ref: RefPestana) {
    // Saltar de pestaña NO toca `panelAbierto`: es un salto directo a una
    // página, no un "voy a elegir algo" — abrir el panel encima sería un
    // popup que nadie pidió. Solo mueve `vista` si hace falta (la pestaña
    // es de otro lugar), y ahí sí se limpia el "Deshacer" del lugar anterior.
    if (ref.espacioId !== donde) {
      setVista(ref.espacioId === null ? { tipo: 'todas' } : { tipo: 'espacio', id: ref.espacioId });
      setArchivada(null);
    }
    setSeleccion({ tipo: 'nota', id: ref.id, origen: 'nota' });
  }
  function cerrarPestana(id: number) {
    const activaId = seleccion?.tipo === 'nota' && seleccion.origen === 'nota' ? seleccion.id : null;
    const siguiente = siguienteAlCerrar(pestanas.abiertas, id, activaId);
    pestanas.cerrar(id);
    if (siguiente === undefined) return; // no era la pestaña activa: la selección no se toca
    if (siguiente === null) setSeleccion(null);
    else activarPestana(siguiente);
  }

  /**
   * ADJUNTAR UN DOCUMENTO (26-ago-2026): sube el archivo y crea la página en un
   * solo gesto. `subiendoDocumento` deshabilita el menú de `NuevaPagina`
   * mientras tanto —dos subidas pisadas del mismo archivo crearían dos
   * páginas—, y `errorDocumento` vive acá y no adentro del menú para que el
   * aviso no desaparezca si el menú ya se cerró solo.
   */
  const [subiendoDocumento, setSubiendoDocumento] = useState(false);
  const [errorDocumento, setErrorDocumento] = useState<string | null>(null);
  const adjuntarDocumento = useCallback(
    async (archivo: File) => {
      setSubiendoDocumento(true);
      setErrorDocumento(null);
      try {
        const subido = await subirDocumento(archivo);
        const r = await crearDocumento.mutateAsync(subido);
        setSeleccion({ tipo: 'nota', id: r.nota.id, origen: 'nota' });
        pestanas.abrir({ id: r.nota.id, espacioId: donde, tipo: 'archivo' });
        setPanelAbierto(false);
      } catch (e) {
        setErrorDocumento(e instanceof ErrorDeDocumento ? e.message : 'No se pudo adjuntar el documento.');
      } finally {
        setSubiendoDocumento(false);
      }
    },
    [crearDocumento, donde, pestanas],
  );
  /**
   * DIVIDIR PANTALLA (17-ago-2026): «estoy eligiendo con qué otra página se
   * divide ésta». Local y ajeno a la base — lo persistido es
   * `paginaAbierta.paginaDivididaId`, que MANDA sobre esto en cuanto existe
   * (ver el render, más abajo). Se apaga solo al cambiar de página: si no,
   * el selector de la anterior quedaría abierto encima de la nueva.
   */
  const [mostrarSelectorDivision, setMostrarSelectorDivision] = useState(false);
  // Los espacios ya vienen cacheados por el selector: es la MISMA queryKey, así
  // que esto no dispara un request nuevo — solo lee lo que ya está.
  const espacios = useEspacios();

  /**
   * AL ENTRAR, si ya hay algún espacio, arranca AHÍ y no en Mi libreta —
   * decisión del dueño (17-ago-2026): con espacios de equipo en uso, la
   * privada deja de ser lo primero que se ve, aunque sigue existiendo y
   * accesible desde el selector.
   *
   * Se dispara UNA sola vez por montaje (`yaEntro`), no en cada render con
   * `donde === null`: si no fuera así, volver a "Mi libreta" a mano desde el
   * selector la traería de vuelta al espacio en el próximo render, y el botón
   * quedaría muerto. Espera a que la consulta resuelva (`espacios.data`, no
   * `.isPending`) para no pisar un `donde` que YA cambió por otro camino —p.ej.
   * llegar por un link— mientras el pedido todavía viaja.
   */
  const yaEntro = useRef(false);
  useEffect(() => {
    if (yaEntro.current || !espacios.data) return;
    yaEntro.current = true;
    if (espacios.data.length > 0) setVista({ tipo: 'espacio', id: espacios.data[0].id });
  }, [espacios.data]);

  /**
   * LA LISTA DE LA VISTA ACTUAL, ya recortada. Tres pasos, cada uno opcional:
   *
   *   1. la fuente — privadas, un espacio puntual, o archivadas (`papelera`);
   *   2. "Favoritas" filtra `fijada` EN EL CLIENTE — ya llegó todo en memoria
   *      con el paso 1 (es la misma consulta que "Todas"), así que no hace
   *      falta pedirle nada nuevo al server;
   *   3. el filtro liviano de texto, también en el cliente — sin el `q` que
   *      antes armaba `useBuscarNotas`.
   */
  const notasDeVista = enPapelera
    ? (papelera.data ?? [])
    : vista.tipo === 'espacio'
      ? (delEspacio.data ?? [])
      : (privadas.data ?? []);
  /**
   * 🔴 «FAVORITAS» YA NO FILTRA `notasDeVista` EN EL CLIENTE (04-sep-2026,
   * ADR 0093) — antes leía `fijada` sobre lo que ya había llegado con el paso
   * 1 (la libreta privada), porque las dos cosas coincidían: fijar era
   * favoritear. Ahora son campos independientes y Favoritos CRUZA espacios
   * (decisión explícita del dueño), así que necesita su PROPIA consulta
   * (`useFavoritas`, arriba) — filtrar `notasDeVista` nunca podría traer lo
   * favorito de un espacio que la vista actual ni está mirando.
   */
  const notasDeFavoritas = vista.tipo === 'favoritas' ? (favoritas.data ?? []) : notasDeVista;
  /**
   * LOS CONTADORES DEL RIEL — de `privadas`/`papelera`/`favoritas` directo,
   * NUNCA de `notasDeVista`: tienen que verse siempre, sin importar qué vista
   * esté activa (parada en "Personal", el riel igual dice "Papelera 3").
   */
  const totalCount = privadas.data?.length ?? 0;
  const favoritasCount = favoritas.data?.length ?? 0;
  const papeleraCount = papelera.data?.length ?? 0;

  /**
   * EL MODO FILTRO (03-sep-2026) — con texto, tipo o alcance activos, la
   * BASE deja de ser "la vista que el riel eligió" y pasa a ser una
   * búsqueda GLOBAL (mi libreta + CADA espacio, server-side vía
   * `useBuscarNotas`, la misma ruta que ya usan `PantallaDividida`/
   * `PanelNotas`, acotada acá a `CLAVE_LIBRETA`): es lo que "el filtro
   * busca en mi libreta y tus espacios al mismo tiempo" pide. La Papelera
   * queda AFUERA a propósito — `buscarNotas` ya excluye lo archivado, así
   * que buscar ahí adentro nunca podría devolver nada; sigue con su propio
   * filtro de texto local, como antes.
   */
  const enModoFiltroGlobal = !enPapelera && (termino.length > 0 || tiposElegidos.size > 0 || alcanceElegido.size > 0);
  const busquedaGlobal = useBuscarNotas(filtro, { clave: CLAVE_LIBRETA, activo: enModoFiltroGlobal });
  const baseDeNotas = enModoFiltroGlobal ? (busquedaGlobal.data ?? []) : notasDeFavoritas;

  // El texto: `buscarNotas` ya lo aplicó server-side en modo filtro — acá
  // solo hace falta el filtro local de la Papelera (que nunca entra a ese modo).
  const notasDelTermino =
    !enModoFiltroGlobal && termino
      ? baseDeNotas.filter((n) => {
          const enTitulo = tituloDeNota(n).toLowerCase().includes(termino.toLowerCase());
          const enResumen = (resumenDeNota(n) ?? '').toLowerCase().includes(termino.toLowerCase());
          return enTitulo || enResumen;
        })
      : baseDeNotas;

  /**
   * EL ALCANCE — "todas" y "favoritas" son de mi libreta privada
   * (`espacioId === null`); cualquier otra clave es el id de un espacio
   * puntual. Vacío = sin restricción (ya viene de mi libreta + todos los
   * espacios, así que no hace falta filtrar más).
   */
  const notasDeAlcance =
    alcanceElegido.size > 0
      ? notasDelTermino.filter((n) => {
          const espacioId = n.espacioId ?? null;
          // 🔴 `n.favorita`, no `n.fijada` (04-sep-2026, ADR 0093): con «fijar»
          // convertido en un tope de orden y «favorita» cruzando espacios, este
          // checkbox tiene que reconocer TODA página favorita, esté donde esté —
          // no solo la privada, como cuando las dos cosas eran una sola.
          return espacioId === null
            ? alcanceElegido.has('todas') || (alcanceElegido.has('favoritas') && n.favorita)
            : alcanceElegido.has(espacioId) || (alcanceElegido.has('favoritas') && n.favorita);
        })
      : notasDelTermino;

  /** El filtro por tipo de archivo, sobre lo que ya recortó todo lo demás — los tres a la vez, no uno u otro. */
  const notas =
    tiposElegidos.size > 0 ? notasDeAlcance.filter((n) => tiposElegidos.has(claseDeArchivo(n))) : notasDeAlcance;
  /**
   * LA PAGINACIÓN DEL PANEL (03-sep-2026) — `notas` sigue siendo la lista
   * ENTERA (la busca `paginaAbierta`, más abajo, y son los contadores del
   * riel): lo que se recorta es solo `notasVisibles`, la porción que
   * `.map()` dibuja. Se llama «de lista» y no «página» a secas porque acá
   * mismo «página» ya significa otra cosa (un documento de la Libreta).
   */
  const POR_PAGINA_DE_LISTA = 20;
  const totalPaginasDeLista = Math.max(1, Math.ceil(notas.length / POR_PAGINA_DE_LISTA));
  const paginaDeListaSegura = Math.min(paginaDeLista, totalPaginasDeLista);
  const notasVisibles = notas.slice(
    (paginaDeListaSegura - 1) * POR_PAGINA_DE_LISTA,
    paginaDeListaSegura * POR_PAGINA_DE_LISTA,
  );
  // Cambiar de lugar o de filtro vuelve a la página 1 — sin esto, entrar a la
  // Papelera parada en la página 3 de "Todas las páginas" se ve como que
  // faltan las primeras filas, cuando en realidad es una lista distinta.
  useEffect(() => {
    setPaginaDeLista(1);
    setAvisoFijar(null);
  }, [donde, enPapelera, vista.tipo, termino, tiposElegidos, alcanceElegido]);
  const enListaActual =
    seleccion?.tipo === 'nota' ? notas.find((n) => n.id === seleccion.id && n.origen === seleccion.origen) : undefined;
  /**
   * 🔴 SI YA NO ESTÁ EN LA LISTA DE ESTA VISTA, SE TRAE APARTE (04-sep-2026) —
   * el otro lado de sacar `setSeleccion(null)` de `alElegirVista`. Tocar un
   * espacio del riel para mirar su lista cambia `donde`, y `notas` (de acá
   * arriba) queda acotada a ESE lugar — una página abierta de OTRO lugar
   * (la libreta privada, u otro espacio) deja de aparecer ahí, aunque
   * `seleccion` la siga señalando. `useNotaPorId` la trae por su cuenta,
   * sin importar qué vista esté mirando el riel — mismo seam que ya usan
   * `PantallaDividida.tsx` y la barra de pestañas.
   *
   * ⚠️ **Solo cuando hace falta** (`enListaActual` es `undefined`): mientras
   * la página abierta siga siendo de la vista actual —el caso de SIEMPRE—,
   * sale de la lista que ya está en memoria, sin una consulta de más ni el
   * parpadeo de abrir en blanco mientras esa consulta vuelve.
   *
   * ⚠️ **Solo `origen: 'nota'`**: una histórica de `gestiones` no tiene
   * `GET /api/notas/:id` que la resuelva (viven en otra tabla, de solo
   * lectura) — si se abre una y se cambia de espacio, se pierde, como
   * pasaba antes. Es un camino angosto: las históricas solo aparecen en la
   * libreta privada, así que hace falta cruzar A un espacio con una de
   * ésas abierta, un cruce que además no tiene nada que guardar del otro
   * lado.
   */
  const necesitaPorId = seleccion?.tipo === 'nota' && seleccion.origen === 'nota' && !enListaActual;
  const porId = useNotaPorId(necesitaPorId && seleccion ? seleccion.id : null);
  const paginaAbierta = enListaActual ?? (necesitaPorId ? porId.data : undefined);
  /** `null`/ausente = pantalla simple. Viene de la nota, así que sobrevive a un reload. */
  const divididaId = paginaAbierta?.paginaDivididaId ?? null;
  /** Misma receta que `paginaAbierta`: se busca en la lista VIVA, nunca una foto. */
  const notaCompartiendo = compartiendoId !== null ? (notas.find((n) => n.id === compartiendoId) ?? null) : null;

  /**
   * PRECARGAR EL EDITOR (ver `perezosos.tsx`): se pide SIEMPRE y sin esperar
   * — entrar a la Libreta es entrar a escribir, así que el chunk viaja
   * mientras la vendedora todavía está eligiendo la página.
   */
  useEffect(() => {
    precargarEditor();
  }, []);

  // Cambiar de página apaga el selector de división de la anterior — si no,
  // «Dividir pantalla» quedaría abierto encima de una página que no lo pidió.
  useEffect(() => {
    setMostrarSelectorDivision(false);
  }, [seleccion]);

  /**
   * El autoguardado vive en su propio hook (`useAutoguardado`), y no por
   * prolijidad: adentro de este componente era un `catch {}` que nadie podía
   * interrogar, y de ahí salieron el «Guardado» falso, la doble creación y la
   * pérdida de lo pendiente al salir. Ahí están los tres, con sus tests.
   *
   * Una página `nueva` todavía no tiene fila: `idActual: null` es lo que le
   * dice al hook que el primer guardado es un POST.
   */
  const { estado: estadoGuardado, alCambiar } = useAutoguardado({
    // El `origen` IMPORTA: el id de una página histórica es de `gestiones`, y
    // mandarlo a `PATCH /api/notas/:id` escribiría sobre la nota que
    // casualmente tenga ese número. Esas son de solo lectura: destino `null`.
    destino:
      seleccion === null
        ? null
        : seleccion.tipo === 'nueva'
          ? { tipo: 'nueva' as const }
          : seleccion.origen === 'nota'
            ? { tipo: 'nota' as const, id: seleccion.id }
            : null,
    puertas: {
      actualizar: (v) => autoguardar.mutateAsync(v),
      crear: (v) => crear.mutateAsync(v),
    },
    alCrear: (id) => {
      setSeleccion({ tipo: 'nota', id, origen: 'nota' });
      pestanas.abrir({ id, espacioId: donde, tipo: 'texto' });
    },
  });


  /**
   * La página que vino por link se abre SOLA y por encima de la lista: quien
   * hizo clic en un link quería ESA página, no la Libreta.
   *
   * ⚠️ No se toca `donde` ni `seleccion`: la página puede vivir en un espacio del
   * que no eres miembro —el link es lo que te da acceso, no la membresía—, y
   * mover el selector ahí mostraría una lista que el server va a negar con 403.
   */
  const deLink = porLink.data?.nota ?? null;

  /**
   * QUÉ PÁGINA ESTÁ EN LA HOJA. Es la `key` de la zona de trabajo —remonta las
   * anotaciones al saltar de nota— y la misma que ya usa cada `EditorDePagina`.
   */
  const claveDePagina = deLink
    ? `link-${deLink.id}`
    : seleccion === null
      ? 'ninguna'
      : seleccion.tipo === 'nueva'
        ? 'nueva'
        : `${seleccion.origen}-${seleccion.id}`;

  /**
   * LA HOJA ABIERTA, o `null` cuando lo que se muestra no es un documento.
   *
   * Decide tres cosas de una sola vez: si hay capa de anotaciones, si hay barra
   * a la derecha, y con qué se siembra la capa. Tenerlo en UN lugar es lo que
   * impide que «se ve la barra» y «se puede guardar» se contesten distinto —
   * ofrecer dibujar sobre algo que no se guarda es la peor de las dos.
   */
  const hoja: { anotacionesIniciales: unknown; soloLectura: boolean } | null = deLink
    ? { anotacionesIniciales: deLink.anotaciones, soloLectura: !porLink.data?.puedeEditar }
    : seleccion?.tipo === 'nueva'
      ? { anotacionesIniciales: null, soloLectura: false }
      : paginaAbierta
        ? {
            anotacionesIniciales: paginaAbierta.anotaciones,
            // Una histórica de `gestiones` se lee y no se edita — tampoco se anota.
            soloLectura: paginaAbierta.origen === 'gestion',
          }
        : null;

  /**
   * LO ÚLTIMO QUE SE SABE DE LA PÁGINA ABIERTA — el documento y la capa.
   *
   * ══ POR QUÉ HACE FALTA ESTE PAR DE REFERENCIAS ══════════════════════════════
   *
   * El texto y el dibujo cambian por caminos distintos (el editor y la capa) y
   * ninguno de los dos conoce al otro, pero el guardado es UNO. Sin esto, el
   * PATCH que sale al dibujar llevaría solo `anotaciones` y el que sale al
   * teclear solo `doc`; funciona —el server trata la ausencia como «no lo
   * toques»— **hasta la página nueva**: ahí el primer guardado es un POST, y si
   * el primer gesto fue dibujar, la página nacería sin el texto que ya se había
   * escrito en el mismo segundo.
   *
   * ⚠️ Se vacían al CAMBIAR DE PÁGINA, en el render y no en un efecto: un efecto
   * corre después de pintar, y un trazo hecho en ese hueco mandaría el `doc` de
   * la página anterior sobre la nueva. Es la misma técnica que `useAutoguardado`
   * usa para resetear su estado.
   */
  const contenido = useRef<ContenidoDePagina>({});
  const clavePreviaDeHoja = useRef(claveDePagina);
  if (clavePreviaDeHoja.current !== claveDePagina) {
    clavePreviaDeHoja.current = claveDePagina;
    contenido.current = {};
  }

  const alCambiarDoc = (doc: unknown) => {
    contenido.current.doc = doc;
    alCambiar({ ...contenido.current });
  };

  const alCambiarAnotaciones = (figuras: Figura[]) => {
    // `paraGuardar` redondea las coordenadas: es lo que baja el JSON a la mitad
    // y decide si una página muy anotada entra en el tope.
    contenido.current.anotaciones = paraGuardar(figuras);
    alCambiar({ ...contenido.current });
  };

  // El filtro es client-side (ver `notas`, más arriba): la fuente que carga
  // o falla es SIEMPRE la consulta de base, nunca el filtro.
  const cargando = enPapelera ? papelera.isPending : vista.tipo === 'espacio' ? delEspacio.isPending : privadas.isPending;
  const fallo = enPapelera ? papelera.isError : vista.tipo === 'espacio' ? delEspacio.isError : privadas.isError;
  /**
   * ¿Es la PRIMERA vez? Solo en "Todas las páginas": una Papelera o unas
   * Favoritas vacías son el estado normal de un día cualquiera, no «todavía
   * no escribiste nada» — y sin término de filtro, porque «nada con ese
   * filtro» no es una libreta vacía.
   */
  const recienEmpieza = vista.tipo === 'todas' && !termino && !cargando && !fallo && notas.length === 0;
  /**
   * 🔴 LA BIENVENIDA ES SOLO DE LA LIBRETA PRIVADA — y esto no es estética.
   *
   * Se lleva la pantalla ENTERA, selector incluido. En un espacio compartido
   * recién creado (que está vacío por definición, siempre) eso escondía la única
   * forma de volver a «Mi libreta»: la vendedora quedaba encerrada adentro de un
   * lugar vacío, y el único camino de vuelta era recargar la app.
   *
   * Además el texto miente ahí: dice «es tuya, nadie más la ve» sobre un espacio
   * que ve todo el equipo.
   */
  const enSuLibretaPrivada = donde === null;
  /**
   * LA BIENVENIDA SE LLEVA LA PANTALLA ENTERA — lista y buscador incluidos.
   *
   * Con la lista al lado quedaban dos avisos de vacío mirándose («Tu libreta
   * está en blanco» y «Todavía no escribiste nada acá») y dos botones que hacen
   * lo mismo; y un buscador sobre cero páginas es una calle sin salida.
   *
   * Pide `seleccion === null` y no solo la libreta vacía, y esa parte es la que
   * importa: al tocar «Escribir la primera» los muebles vuelven **en ese clic**.
   * Si dependiera solo de `notas.length`, volverían solos a los 800 ms, cuando
   * el autoguardado crea la fila — o sea, un salto de layout mientras escribe.
   */
  const enBienvenida = recienEmpieza && seleccion === null && enSuLibretaPrivada;

  /**
   * UN CLIC EN EL RIEL — cambia de vista y abre, o hace toggle si ya estabas
   * ahí. La única lógica de "abrir/cerrar el panel" del componente entero:
   * vive acá y no en `SelectorDeEspacio` (que solo reporta qué fila se tocó)
   * para que no haya dos lugares decidiendo lo mismo (#37).
   */
  const alElegirVista = useCallback(
    (v: VistaLibreta) => {
      if (mismaVista(vista, v)) {
        setPanelAbierto((abierto) => !abierto);
        return;
      }
      setVista(v);
      setPanelAbierto(true);
      // 🔴 YA NO `setSeleccion(null)` (04-sep-2026, a pedido explícito): esto
      // cerraba la página abierta con solo tocar un espacio del riel para
      // MIRAR su lista — ni siquiera hacía falta elegir una página nueva. El
      // panel de "Páginas" ya se superpone sin empujar nada (`absolute`, ver
      // más abajo); ahora tampoco tapa la página abierta, que sigue viéndose
      // y autoguardándose atrás — igual que un `Ctrl+Tab` que no cierra la
      // pestaña de la que salís. `paginaAbierta` (más abajo) sabe resolverla
      // aunque ya no esté en la lista de ESTA vista.
      // `setArchivada(null)` sigue: el «Deshacer» es del LISTADO que se deja
      // de mirar, no de la página abierta.
      setArchivada(null);
    },
    [vista],
  );

  // CERRAR EL PANEL AL TOCAR AFUERA — mismo patrón que `NuevaPagina.tsx`
  // (`pointerdown` en `document`, capturando, con un `ref` que envuelve TODO
  // lo interactivo: riel + panel). Tocar el contenido principal (el editor,
  // la cabecera) es lo único que cuenta como "afuera".
  useEffect(() => {
    if (!panelAbierto) return;
    const afuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rielYPanelRef.current?.contains(t) || filtrosRef.current?.contains(t)) return;
      setPanelAbierto(false);
    };
    document.addEventListener('pointerdown', afuera, true);
    return () => document.removeEventListener('pointerdown', afuera, true);
  }, [panelAbierto]);

  return (
    // Una VISTA, no una hoja: sin `fixed`, sin `z-50` y sin `role="dialog"` —
    // ocupa la columna de contenido igual que Dashboard o Pipeline, y la
    // cabecera de `App.tsx` ya dice de dónde salió («Libreta»).
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Tu libreta">
      {/* LA FILA DE PESTAÑAS — arriba de todo, como en un navegador. Se
          esconde sola si no hay ninguna abierta (`BarraDePestanas` devuelve
          `null`): una libreta recién empezada no tiene por qué mostrar una
          franja vacía. */}
      <BarraDePestanas
        abiertas={pestanas.abiertas}
        activaId={seleccion?.tipo === 'nota' && seleccion.origen === 'nota' ? seleccion.id : null}
        onActivar={activarPestana}
        onCerrar={cerrarPestana}
      />
      {/* «NUEVA PÁGINA» + LA BARRA DE ESTADO, DEBAJO DE PESTAÑAS (03-sep-2026)
          — pedido con una captura del botón: se muda de la punta del riel a
          esta fila, y «Mi libreta» pasa a ocupar el lugar que el botón
          tenía ARRIBA del riel (ver `<aside>`, más abajo). La fila ya NO se
          esconde en la bienvenida (antes sí) porque el botón tiene que
          seguir ahí para poder crear la primera página; lo que se esconde
          es solo el texto de «Guardado», que no tiene nada que decir
          todavía. El título no se repite acá — lo pone la cabecera de la
          app. El buscador que vivía acá se fue (03-sep-2026): lo reemplaza
          el filtro liviano del panel de "Páginas". */}
      <div className="flex shrink-0 border-b border-border">
        {/* `ml-3` — EL MISMO margen izquierdo que `m-3` le da a `<aside>` más
            abajo (03-sep-2026, a pedido explícito: el botón quedaba 12px más
            a la izquierda que "Mi libreta" y "Todas las páginas", dos
            insets distintos para lo que se lee como la misma columna). */}
        <div className="ml-3 w-56 shrink-0 border-r border-border">
          <NuevaPagina
            onNueva={() => {
              setSeleccion({ tipo: 'nueva' });
              setPanelAbierto(false);
            }}
            onDocumento={adjuntarDocumento}
            subiendoDocumento={subiendoDocumento}
            errorDocumento={errorDocumento}
          />
        </div>
        <div className="flex flex-1 items-center px-4">
          {/* EL BUSCADOR + EL FILTRO, FIJO ARRIBA (03-sep-2026, a pedido
              explícito) — antes vivía adentro del panel de "Páginas" (y
              después, solo mientras el panel estaba abierto); ahora está
              SIEMPRE acá, sin depender de ningún clic previo. Escribir o
              tocar el filtro ABRE el panel solo — es lo que lo deja ver, ver
              `abrirPanelConFiltro` más abajo. "Guardado" se mudó a la
              cabecera de la página abierta (junto a Mover/Compartir), que
              es de donde ya no competía por este lugar.
              🔴 `ref={filtrosRef}` — este bloque vive AFUERA de
              `rielYPanelRef` (no es ni el riel ni el panel), así que el
              "clic afuera cierra" de más abajo necesita saber que ACÁ
              adentro también cuenta como "adentro" — si no, tocar el
              buscador para escribir cerraba el panel en el mismo gesto.
              `w-80` — el MISMO ancho que el panel de "Páginas" (`w-80`, más
              abajo): sin este tope se estiraba con `flex-1` hasta el borde
              de la pantalla, mucho más ancho que la lista que filtra. */}
          {/* `ml-2` — el panel de "Páginas" (más abajo) arranca 8px más a la
              derecha que esta fila sin este ajuste: el panel hereda su
              posición del margen del riel (`m-3`) y ESTA fila la suya de
              `px-4` del contenedor, dos cálculos que no daban el mismo
              número. Medido con Playwright y no a ojo — reportado con una
              captura como que "no está alineado con este contenedor". */}
          {/* `px-2` en un div INTERNO, no en éste (04-sep-2026, a pedido
              explícito) — este `w-80` sigue siendo el mismo ancho que el
              panel de "Páginas" (así el cálculo de arriba no se toca), pero
              antes el buscador+filtro llenaba ese ancho de punta a punta,
              CERO inset, mientras "Nueva página" —el otro control de esta
              misma fila— vive metida 8px para adentro de SU columna
              (`NuevaPagina.tsx`, el wrapper `px-2 py-2`). Con el inset acá
              adentro, esta fila queda proporcionalmente más chica que el
              panel de abajo, igual que "Nueva página" lo es de "Mi
              libreta" — antes se leía más ancha/grande que su propio molde. */}
          <div ref={filtrosRef} className="ml-2 w-80 max-w-full px-2">
            <div className="flex items-center gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  onFocus={() => setPanelAbierto(true)}
                  placeholder="Filtrar páginas…"
                  aria-label="Filtrar páginas"
                  // `h-[42px]` — EL MISMO alto que la caja de "Nueva página"
                  // (`NuevaPagina.tsx`, medido con Playwright: 42px), no el
                  // `h-8` genérico de un input suelto — a pedido explícito de
                  // que el filtro tome esa altura.
                  className="h-[42px] w-full rounded-lg border border-input bg-card pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
                />
              </div>
              <FiltroDeTipoDeArchivo
                elegidos={tiposElegidos}
                onCambiar={setTiposElegidos}
                espacios={espacios.data ?? []}
                alcance={alcanceElegido}
                onCambiarAlcance={setAlcanceElegido}
                onAbrir={() => setPanelAbierto(true)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/*
          EL RIEL + EL PANEL DE "PÁGINAS" (03-sep-2026) — el riel es angosto y
          SIEMPRE visible; el panel es un flotante que se abre/cierra ENCIMA
          del editor, sin correrlo ni achicarlo (`position: absolute`, no un
          hermano flex más). Ya no hace falta el maestro-detalle de teléfono
          que tenía el aside viejo (ocultarse cuando hay una página abierta):
          el panel flotando resuelve solo el mismo problema — nunca compite
          por el ancho del editor, esté abierto o cerrado.

          🔴 UNA TARJETA FLOTANTE, no una columna pegada al borde (03-sep-2026)
          — mismo molde que `ColaUnificada.tsx` (`rounded-2xl bg-card
          shadow-panel`, con el margen que la separa del resto en vez de un
          `border-r` pegado). Pedido con una captura de esa cola como
          referencia: «desde Nueva página hasta Configuración» es literal —
          el margen y el redondeo envuelven TODO el riel, de punta a punta,
          nada de lo de adentro cambió.
        */}
        {/* 🔴 EL PANEL VA AFUERA DEL `<aside>`, COMO HERMANO — no como hijo
            (03-sep-2026). El riel necesita su propio `overflow-hidden` para
            que las esquinas redondeadas recorten lo de adentro (el mismo
            motivo que `ColaUnificada.tsx`); pero el panel se posiciona
            AFUERA de la caja del riel (`left-full`), y ese MISMO
            `overflow-hidden` se lo comía en silencio — quedaba en el DOM,
            con su `getBoundingClientRect()` perfecto, pero invisible: lo
            recortaba su propio padre. `rielYPanelRef` se mudó a este
            envoltorio para que el "clic afuera cierra" siga contando como
            "adentro" tanto al riel como al panel. */}
        <div ref={rielYPanelRef} className="relative flex">
        <aside className="m-3 flex w-56 shrink-0 flex-col overflow-hidden rounded-2xl bg-card shadow-panel">
          {/* "NUEVA PÁGINA" se mudó a la fila debajo de pestañas (03-sep-2026):
              "MI LIBRETA" pasa a ser lo primero del riel. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SelectorDeEspacio
              vista={vista}
              onElegir={alElegirVista}
              totalCount={totalCount}
              favoritasCount={favoritasCount}
              papeleraCount={papeleraCount}
            />
          </div>

          {/* «CONFIGURACIÓN» — al pie del RIEL, no del panel: no depende de qué
              vista esté abierta ni de tener el panel visible. Fusiona
              "Administrar espacios" (mudado desde `SelectorDeEspacio.tsx`) y
              "Configurar Respuestas Rápidas", que antes competían por este
              mismo lugar fijo (03-sep-2026). */}
          <MenuDeConfiguracion
            onAdministrarEspacios={() => setAdministrandoEspacios(true)}
            onConfigurarRespuestas={() => setConfigurarRespuestasAbierto(true)}
          />
        </aside>

        {/* EL PANEL DE "PÁGINAS" — `absolute`, anclado al borde derecho del
            riel (el envoltorio de arriba es `relative`). MISMA tarjeta que
            el riel (`rounded-2xl bg-card shadow-panel`, 03-sep-2026: pedido
            con el riel ya así, para que las dos se lean como el mismo
            lenguaje) en vez del rectángulo recto de antes — `ml-3`/
            `inset-y-3` calcan el `m-3` del riel, así quedan a la misma
            distancia del borde de arriba/abajo y con el mismo aire de
            separación entre las dos. No empuja nada, se superpone al
            editor. */}
        {panelAbierto && (
          <div className="absolute left-full inset-y-3 z-20 ml-3 flex w-80 max-w-[85vw] flex-col overflow-hidden rounded-2xl bg-card shadow-panel">
              {/* El buscador + el filtro de tipo se mudaron arriba, a la fila
                  de "Nueva página" (03-sep-2026, a pedido explícito) — acá ya
                  no hay más encabezado que la lista misma.
                  `py-2` (antes `pt-3 pb-3`, a pedido explícito de alinear
                  esto con "Mi libreta") — EL MISMO padding que el
                  envoltorio de `SelectorDeEspacio.tsx` en el riel de al
                  lado, para que las dos columnas arranquen a la misma
                  distancia del borde de arriba. */}
              <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
                {!deLink && !enPapelera && seleccion?.tipo === 'nueva' && (
                  <div className="rounded-lg border border-primary bg-secondary px-3 py-2">
                    <span className="text-sm font-medium text-foreground">Página nueva</span>
                    <p className="mt-0.5 text-xs text-muted-foreground">Se guarda sola al escribir</p>
                  </div>
                )}

                {avisoFijar && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-secondary px-2 py-1.5 text-xs text-foreground">
                    <Pin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    {avisoFijar}
                  </p>
                )}

                {cargando && <p className="px-2 py-3 text-sm text-muted-foreground">Cargando…</p>}
                {fallo && <p className="px-2 py-3 text-sm text-destructive">No se pudieron traer tus páginas.</p>}
                {!cargando && !fallo && notas.length === 0 && (
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    {termino
                      ? 'Nada con ese filtro.'
                      : enPapelera
                        ? 'La Papelera está vacía.'
                        : vista.tipo === 'favoritas'
                          ? 'Todavía no marcaste ninguna página como favorita.'
                          : enSuLibretaPrivada
                            ? 'Todavía no escribiste nada acá.'
                            : // En un espacio, «no escribiste» sería falso: puede haber
                              // escrito cualquiera de los miembros, y no lo hizo nadie.
                              'Nadie escribió nada acá todavía.'}
                  </p>
                )}

                {notasVisibles.map((n) => (
                  <FilaPagina
                    key={`${n.origen}-${n.id}`}
                    nota={n}
                    // En un espacio, quién la escribió — salvo si eres tú: «Tú» en
                    // cada renglón propio sería el mismo ruido que en la libreta.
                    // Es la misma regla que `canales/dueno.ts` en la fila de la cola.
                    autora={
                      enSuLibretaPrivada || mismoUsuario(n.vendedoraId, vendedoraId) ? null : nombreCorto(n.vendedoraId)
                    }
                    deEspacio={
                      enPapelera && n.espacioId != null
                        ? (espacios.data ?? []).find((e) => e.id === n.espacioId)?.nombre ?? null
                        : null
                    }
                    activa={mismaSeleccion(seleccion, { tipo: 'nota', id: n.id, origen: n.origen })}
                    onAbrir={() => {
                      setSeleccion({ tipo: 'nota', id: n.id, origen: n.origen });
                      // Solo `origen: 'nota'` se abre en pestaña — ver el porqué en
                      // `pestanas.ts`: una histórica de `gestiones` no tiene
                      // `GET /api/notas/:id` que la resuelva.
                      if (n.origen === 'nota') pestanas.abrir({ id: n.id, espacioId: donde, tipo: n.tipo ?? 'texto' });
                      // Elegir una página CIERRA el panel — es lo que la deja
                      // ver: un panel que se queda abierto encima taparía la
                      // página que se acaba de abrir.
                      setPanelAbierto(false);
                    }}
                    onRenombrar={(texto) => editar.mutate({ id: n.id, texto })}
                    accion={
                      enPapelera
                        ? {
                            tipo: 'papelera',
                            onRestaurar: () => desarchivar.mutate(n.id),
                            onEliminarParaSiempre: () => {
                              const titulo = tituloDeNota(n) || 'Sin título';
                              // 🔴 IRREVERSIBLE, Y NO HAY «DESHACER» POSIBLE ACÁ —
                              // a diferencia de archivar (que sí lo tiene, más
                              // abajo), esto borra la fila de la base de verdad.
                              // Mismo patrón que ya usa este archivo para "borrar
                              // esta capa" (`PanelDeCapas.onBorrar`, más arriba).
                              setConfirmacion({
                                titulo: `¿Eliminar «${titulo}» para siempre?`,
                                mensaje: 'No se puede deshacer.',
                                textoConfirmar: 'Eliminar para siempre',
                                onConfirmar: () => eliminarParaSiempre.mutate(n.id),
                              });
                            },
                            onDescargar: n.tipo === 'archivo' && n.archivo ? () => void descargarDocumento(n.archivo!) : undefined,
                          }
                        : {
                            tipo: 'normal',
                            onFijar: () => {
                              setAvisoFijar(null);
                              editar.mutate(
                                { id: n.id, fijada: !n.fijada },
                                {
                                  // 🔴 SOLO el 409 `apartado-lleno` es un aviso — cualquier
                                  // otro fallo (red, 403…) no tiene nada nuevo que decir acá,
                                  // así que no se silencia con un mensaje que no le
                                  // corresponde.
                                  onError: (e) => {
                                    if (e instanceof ErrorApi && e.status === 409) {
                                      setAvisoFijar(
                                        `Ya tienes ${MAX_FIJADAS_POR_APARTADO} páginas fijadas acá — desfija una antes de fijar otra.`,
                                      );
                                    }
                                  },
                                },
                              );
                            },
                            onFavorito: () => editar.mutate({ id: n.id, favorita: !n.favorita }),
                            onArchivar: () => {
                              archivar.mutate(n.id);
                              // El camino de VUELTA. Lo pidió el review del PR #47 y el
                              // arreglo quedó en `PanelNotas`, el componente que ya no se
                              // monta: al pasar la Libreta al riel volvió a ser un clic sin
                              // retorno sobre algo que la vendedora escribió.
                              setArchivada({ id: n.id, titulo: tituloDeNota(n) || 'Sin título' });
                              // Una página archivada no se puede seguir mirando. `cerrarPestana`
                              // hace las dos cosas: si tenía pestaña, la saca; y si ERA la
                              // página abierta, elige a cuál pasar (o vuelve a la lista) —
                              // reemplaza el `setSeleccion(null)` que había acá antes, que
                              // se pisaba con esto mismo cuando las dos condiciones daban a
                              // la vez.
                              cerrarPestana(n.id);
                            },
                            // MOVER Y COMPARTIR (04-sep-2026, ADR 0093) — se sumaron acá al
                            // consolidarse en el menú `⋮` de la fila; antes solo existían en
                            // `AccionesDePagina.tsx`, viendo la página ya abierta.
                            onMover: (destino) => {
                              mover.mutate({ id: n.id, destino });
                              // Si ESTA fila es la página abierta, se fue de esta lista: igual
                              // que el camino viejo (`AccionesDePagina` → `onMover`, más abajo).
                              // Si no es la abierta, no hay nada más que tocar — la lista se
                              // refresca sola con la invalidación de la mutación.
                              if (mismaSeleccion(seleccion, { tipo: 'nota', id: n.id, origen: n.origen })) {
                                setSeleccion(null);
                              }
                            },
                            onCompartir: () => {
                              setCompartiendoId(n.id);
                              setVistaCompartir('link');
                            },
                            // 🔴 `n.espacioId`, NO el `donde` de la vista actual
                            // (04-sep-2026) — con Favoritos cruzando espacios, una fila
                            // de acá puede vivir en un espacio distinto al que el riel
                            // tiene elegido; `donde` seguiría diciendo `null` (las tres
                            // vistas de "MI LIBRETA" son siempre privadas para
                            // `dondeDeVista`) y "Mover" mostraría mal cuál es su lugar
                            // actual — sin marcar "Mi libreta" como destino ya elegido,
                            // y sin preguntar «esto se lo saca a tu equipo» al moverla a
                            // la libreta privada.
                            donde: n.espacioId ?? null,
                            espacios: espacios.data ?? [],
                            vendedoraId,
                            onDescargar: n.tipo === 'archivo' && n.archivo ? () => void descargarDocumento(n.archivo!) : undefined,
                          }
                    }
                  />
                ))}
              </div>

              {/* DESHACER — al pie de la lista y no como toast flotante: la lista es
                  donde la página desapareció, así que es donde se la busca. Se va
                  sola en cuanto se archiva otra o se toca «Deshacer». No aplica
                  DENTRO de la Papelera: ahí lo que se deshace es archivar, y
                  archivar ya no está entre las acciones que se ofrecen. */}
              {archivada && !enPapelera && (
                <div className="m-2 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    Archivaste «{archivada.titulo}»
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      desarchivar.mutate(archivada.id);
                      setArchivada(null);
                    }}
                    className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Undo2 className="size-3.5" />
                    Deshacer
                  </button>
                </div>
              )}

              {/* PAGINACIÓN (03-sep-2026) — al pie del panel, FUERA del
                  `overflow-y-auto` de la lista: fija, no se va con el
                  scroll, justo donde termina la última página de la lista.
                  Las flechas son solo el ícono, sin «Anterior»/«Siguiente»
                  al lado — a pedido explícito. SIEMPRE visible, aunque haya
                  una sola página (con las flechas deshabilitadas): a
                  pedido, después de que escondida con pocas filas se leyera
                  como que la paginación no se había hecho.
                  🔴 `h-14` FIJO, el MISMO alto exacto que
                  `MenuDeConfiguracion.tsx` usa para "Configuración": los dos
                  pies sacaban su alto de su propio contenido (íconos acá,
                  texto ahí) y salía un número distinto en cada uno — la
                  línea divisoria entre panel y riel quedaba a distinta
                  altura, reportado con una captura. Con el mismo alto FIJO
                  en los dos, ya no depende de calcarle el padding a mano. */}
              <div className="flex h-14 shrink-0 items-center justify-center border-t border-border px-2">
                  {/* UN SOLO CHIP, no tres piezas sueltas flotando en la fila
                      (03-sep-2026, a pedido explícito — "luce raro" con una
                      captura mostrando huecos grandes entre flecha y número).
                      El borde y el fondo ahora envuelven a las TRES partes
                      juntas, así se leen como un único control de paginación
                      en vez de un botón + una caja + texto suelto + otro
                      botón, cada uno con su propio aire alrededor. */}
                  <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setPaginaDeLista((p) => Math.max(1, p - 1))}
                      disabled={paginaDeListaSegura <= 1}
                      aria-label="Página anterior"
                      className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition hover:bg-card hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    <div className="flex items-center gap-1 px-0.5 text-xs text-muted-foreground">
                      <input
                        type="number"
                        min={1}
                        max={totalPaginasDeLista}
                        value={paginaDeListaSegura}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isInteger(n)) setPaginaDeLista(Math.min(Math.max(1, n), totalPaginasDeLista));
                        }}
                        aria-label="Ir a la página"
                        // `[appearance:textfield]` + ocultar los spinners nativos
                        // (WebKit): un `<input type="number">` de fábrica trae
                        // flechitas propias que compiten visualmente con las
                        // de acá al lado — dos pares de flechas para lo mismo.
                        // Sin borde ni fondo propio (antes `border border-input
                        // bg-card`): adentro del chip ya tiene el suyo, uno
                        // más acá volvía a partir el control en pedazos.
                        className="h-6 w-6 rounded-md text-center text-sm font-medium text-foreground outline-none [appearance:textfield] focus:bg-card [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="font-medium">/ {totalPaginasDeLista}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaginaDeLista((p) => Math.min(totalPaginasDeLista, p + 1))}
                      disabled={paginaDeListaSegura >= totalPaginasDeLista}
                      aria-label="Página siguiente"
                      className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition hover:bg-card hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
            </div>
        )}
        </div>

        {/* EL EDITOR */}
        <main
          // 🔴 `min-w-0` (19-ago-2026): sin esto, un flex item vale `min-width:
          // auto` por default — el ANCHO MÍNIMO de su CONTENIDO, no cero. Con una
          // hoja A4 que preferiría 21cm o una tabla ancha adentro del editor, este
          // `<main>` se negaba a encogerse por debajo de eso y empujaba TODO —
          // la barra de dibujo, el riel, la ventana entera — a un scroll
          // horizontal en vez de dejar que `.hoja-a4` se achique como ya sabe
          // hacer (`width: 100%`). Mismo arreglo, un nivel más adentro, en
          // `ZonaDeTrabajo` (más abajo en este archivo).
          className={`flex min-h-0 min-w-0 flex-1 flex-col md:flex ${
            seleccion === null && !enBienvenida ? 'hidden' : 'flex'
          }`}
        >
          {/* La vuelta a la lista, solo en teléfono: en desktop la lista nunca se fue. */}
          {seleccion !== null && (
            <button
              type="button"
              onClick={() => setSeleccion(null)}
              className="flex shrink-0 items-center gap-1 px-4 pt-3 text-sm text-muted-foreground hover:text-foreground md:hidden"
            >
              <ChevronLeft className="size-4" />
              Tus páginas
            </button>
          )}

          {/*
            LA ZONA DE TRABAJO envuelve TODAS las ramas y no solo las del editor:
            se excluyen solas (cada una tiene su condición) y así la capa y la
            barra se montan en un único lugar. Con un envoltorio por rama, las
            tres tendrían que acordarse de pasarle lo mismo.

            La `key` es lo que remonta las anotaciones al cambiar de página.
          */}
          <ZonaDeTrabajo
            key={claveDePagina}
            hoja={hoja}
            editor={editorListo}
            hojaA4={hojaA4Lista}
            contenedorArchivo={contenedorArchivoListo}
            onGuardarAnotaciones={alCambiarAnotaciones}
            onPedirConfirmacion={setConfirmacion}
          >
          {/*
            LA PRIMERA VEZ ENSEÑA QUÉ PONER.

            La tabla `notas` tenía CERO filas el 4-ago-2026: la herramienta
            existía entera y nadie la usó. Una pantalla que dice «elige una
            página» cuando no hay ninguna no ayuda a empezar — y «cualquier
            cosa, tipo Notion» es justo lo que cuesta arrancar sin un ejemplo.

            Es un estado de la PANTALLA, no una fila sembrada en la base: leer
            no escribe (la regla de toda la casa), no puede resucitar después de
            archivarla, y desaparece sola en cuanto hay una página de verdad.
          */}
          {deLink && (
            <>
              {/* El aviso queda AFUERA de la hoja A4, alineado con el borde del
                  texto (`w-[21cm]` + `px-[2.5cm]`, el mismo par que usa
                  `anchoDeAcciones` más abajo): es un dato sobre la página, no
                  parte de ella — meterlo adentro le pondría el fondo de la hoja
                  a un aviso que no es lo que la vendedora escribió. */}
              <div className="mx-auto box-border w-[21cm] max-w-full px-[2.5cm] pt-8">
                <div className="mb-4 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                  Llegaste por un link.{' '}
                  {porLink.data?.puedeEditar
                    ? 'Puedes editarla, y queda registrado que fuiste tú.'
                    : 'Se lee, no se edita.'}
                </div>
              </div>
              <ColumnaDeEscritura registrarHojaA4={registrarHojaA4}>
                <EditorPerezoso
                  key={`link-${deLink.id}`}
                  contenidoInicial={docParaEditor(deLink)}
                  soloLectura={!porLink.data?.puedeEditar}
                  onCambio={alCambiarDoc}
                  onAbrirPlantillas={abrirPlantillas}
                  onAbrirRespuestasRapidas={abrirRespuestasRapidas}
                  registrarPegado={registrarPegado}
                  registrarEditor={registrarEditor}
                />
              </ColumnaDeEscritura>
            </>
          )}

          {porLink.isError && (
            <div className="mx-auto max-w-3xl px-6 py-8">
              <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                Ese link ya no sirve. Pedile a quien te lo pasó que lo comparta de nuevo.
              </p>
            </div>
          )}

          {!deLink && !porLink.isError && enBienvenida && (
            <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-3 px-6">
              <Notebook className="size-8 text-muted-foreground/40" />
              <p className="text-center text-sm font-medium text-foreground">Tu libreta está en blanco</p>
              <p className="text-center text-xs text-muted-foreground">
                Anota lo que quieras. Es tuya: nadie más del equipo la ve, y de acá no sale ningún mensaje.
              </p>
              {/*
                Los ejemplos van ALINEADOS A LA IZQUIERDA: tres renglones
                centrados se leen como un párrafo partido, no como una lista, y
                lo único que tienen que hacer es dar una idea de qué poner.

                Y sobre `bg-card`, no en la bandeja hundida de ADR 0017: el
                fondo de una vista ya es `bg-muted`, así que ahí la bandeja no
                se ve — sería una caja que existe en el código y no en la
                pantalla. Acá el plano hundido es el de afuera.
              */}
              <ul className="w-full space-y-1 rounded-lg border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground">
                <li>· Los precios y las cuotas que más te preguntan</li>
                <li>· Cómo contestas las objeciones que se repiten</li>
                <li>· Lo que quedó pendiente con alguien, para mañana</li>
              </ul>
              <button
                type="button"
                onClick={() => setSeleccion({ tipo: 'nueva' })}
                className="mt-1 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
              >
                <Plus className="size-4" />
                Escribir la primera
              </button>
            </div>
          )}

          {!deLink && !porLink.isError && seleccion === null && !enBienvenida && (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <Notebook className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Elige una página, o crea una nueva.</p>
              {/* ⚠️ «Es tuya, nadie más la ve» es VERDAD solo en la libreta
                  privada. Dicho adentro de un espacio del equipo sería la peor
                  mentira posible de este frente: la que hace escribir un precio
                  mal puesto creyendo que no lo lee nadie. Lo único que se dice
                  siempre es lo que vale en los dos lados (ADR 0012). */}
              <p className="max-w-xs text-xs text-muted-foreground/80">
                {enSuLibretaPrivada
                  ? 'Es tuya: nadie más del equipo la ve. De acá no sale ningún mensaje.'
                  : 'Lo de acá lo ve todo el espacio. De acá no sale ningún mensaje.'}
              </p>
            </div>
          )}

          {!deLink && seleccion?.tipo === 'nueva' && (
            <ColumnaDeEscritura registrarHojaA4={registrarHojaA4}>
              <EditorPerezoso
                key="nueva"
                contenidoInicial={undefined}
                soloLectura={false}
                onCambio={alCambiarDoc}
                onAbrirPlantillas={abrirPlantillas}
                onAbrirRespuestasRapidas={abrirRespuestasRapidas}
                registrarPegado={registrarPegado}
                registrarEditor={registrarEditor}
              />
            </ColumnaDeEscritura>
          )}

          {!deLink && paginaAbierta && (() => {
            // PANTALLA DIVIDIDA (17-ago-2026): solo una página editable puede
            // pedirla (`AccionesDePagina` ni se dibuja sobre una histórica), y
            // solo se abre por elección propia o porque ya venía persistida.
            const dividiendo =
              paginaAbierta.origen === 'nota' && (mostrarSelectorDivision || divididaId !== null);
            /**
             * UNA PÁGINA-DOCUMENTO (26-ago-2026): segunda clase de página aparte
             * del BlockNote de siempre. Nunca pasa por el editor ni por el
             * autoguardado — es un archivo que ya está subido entero, no algo
             * que se escribe.
             */
            const esArchivo = paginaAbierta.origen === 'nota' && paginaAbierta.tipo === 'archivo';
            /**
             * 🔴 LA COLUMNA ANGOSTA ES DE LAS ACCIONES, NUNCA DEL EDITOR — y AFUERA
             * de la hoja A4, no adentro: «Mover / Compartir / Dividir» es una barra
             * sobre la página, no texto escrito en ella, así que no lleva el fondo
             * de `.hoja-a4`. `w-[21cm]` + `px-[2.5cm]` es EL MISMO par que usa
             * `.hoja-a4` en `index.css` (ancho total + margen), para que la barra
             * quede alineada con el borde del TEXTO — si cambia uno, mirar el otro.
             *
             * MISMA CLASE DIVIDIENDO O NO (19-ago-2026): `.hoja-a4` ahora se achica
             * a proporción en vez de desbordar (`aspect-ratio`, ver `index.css`), así
             * que la cabecera puede alinearse con ella en los dos casos por igual —
             * `max-w-full` la acompaña cuando el panel de la mitad es más angosto que
             * el ancho pedido.
             *
             * ⚠️ `pb-4`, NO EL `mb-4` QUE TENÍA `AccionesDePagina` (19-ago-2026): con
             * el margen puesto ACÁ, en el wrapper, la cabecera de la mitad derecha
             * (`PantallaDividida.tsx`) puede usar EXACTO el mismo par `pt-4 pb-4` y
             * las dos hojas A4 arrancan a la misma altura — antes cada lado medía
             * el espacio de arriba a su manera y no coincidían (issue reportado
             * 19-ago-2026).
             *
             * 🔴 `pt-4` (antes `pt-8`, 03-sep-2026 a pedido explícito) — "mucho
             * espacio en blanco por encima" con una captura mostrando la hoja
             * A4 empezando muy abajo, tanto con una sola página como
             * dividiendo. Medido con Playwright: de `<main>` a la fila de
             * Mover/Compartir había 108px con `pt-8`; con `pt-4` baja a 74px.
             * Sigue siendo el MISMO valor en `PantallaDividida.tsx` — si
             * cambia acá, cambia ahí.
             *
             * ⚠️ MISMO `w-[21cm]` DIVIDIENDO O NO. Hubo un `w-[15cm]` acá para
             * dividiendo, el mismo día que se sacó: dividir ya angosta el panel a
             * la mitad, y una hoja más chica encima de eso achicaba el lugar para
             * escribir más de lo que el pedido pedía — al revés de lo que se quería.
             *
             * ⚠️ `px-[1.27cm]` DIVIDIENDO, `px-[2.5cm]` SIN DIVIDIR (mismo día, otro
             * pedido): acompaña al margen angosto de `.hoja-a4--dividida`
             * (`ColumnaDeEscritura`, más abajo) — la barra tiene que alinearse con
             * el borde del texto, y ese borde se corrió al achicarse el margen.
             *
             */
            const anchoDeAcciones = dividiendo
              ? 'mx-auto box-border w-[21cm] max-w-full px-[1.27cm] pt-4 pb-4'
              : 'mx-auto box-border w-[21cm] max-w-full px-[2.5cm] pt-4 pb-4';
            // Cierra la pantalla dividida — eligiendo o ya persistida, las dos, y
            // desde CUALQUIER disparador: el botón de arriba (`AccionesDePagina`)
            // o la ✕ de adentro del panel (`PantallaDividida`). Antes la ✕ llamaba
            // solo a `setMostrarSelectorDivision(false)`, que no alcanza una vez
            // que `divididaId` ya existe (`dividiendo` sigue leyendo TRUE desde
            // ahí) — la ✕ se veía pero no hacía nada. Ver el mismo arreglo en el
            // botón de `AccionesDePagina`.
            const cerrarDivision = () => {
              if (divididaId !== null) cortarDivision.mutate(paginaAbierta.id);
              setMostrarSelectorDivision(false);
            };
            return (
              <div className={dividiendo ? 'flex flex-col items-stretch md:flex-row' : ''}>
                <div className={dividiendo ? 'min-w-0 md:w-1/2' : ''}>
                  {/* Mover, compartir y dividir van sobre una página GUARDADA y
                      editable: una histórica de `gestiones` no se puede mover (vive
                      en otra tabla) ni compartir, y una página en blanco todavía no
                      tiene id. */}
                  {paginaAbierta.origen === 'nota' && (
                    <div className={anchoDeAcciones + ' flex flex-wrap items-center justify-between gap-2'}>
                      {/* «GUARDADO» SE MUDÓ ACÁ (03-sep-2026) — el buscador
                          ahora vive fijo arriba, sin depender de si hay una
                          página abierta, así que ya no tenía un lugar fijo
                          para compartir con él. Este renglón sí depende de
                          que haya una página GUARDADA (mismo `if` de arriba
                          que ya exige `origen === 'nota'`), que es
                          justamente de lo único que "Guardado" puede hablar. */}
                      {(() => {
                        const r = renglonDeEstado(estadoGuardado, paginaAbierta.editadoAt ?? null);
                        if (!r.texto) return null;
                        return (
                          <span
                            className={'flex shrink-0 items-center gap-1 text-xs ' + (r.hayFallo ? 'font-medium text-destructive' : 'text-muted-foreground')}
                            aria-live="polite"
                            role={r.hayFallo ? 'alert' : undefined}
                          >
                            {r.hayFallo && <AlertTriangle className="size-3 shrink-0" />}
                            {r.texto}
                          </span>
                        );
                      })()}
                      <AccionesDePagina
                        nota={paginaAbierta}
                        // El botón se apoya en ESTO, no en `nota.paginaDivididaId` a
                        // secas: recién apretado «Dividir pantalla» ya está
                        // dividiendo (eligiendo, todavía sin persistir), y un
                        // segundo toque tiene que volver a una sola pantalla desde
                        // ahí también — no solo después de que el server confirme.
                        dividiendo={dividiendo}
                        onTocarDividir={() => setMostrarSelectorDivision(true)}
                        onCortarDivision={cerrarDivision}
                        onRenombrar={(texto) => editar.mutate({ id: paginaAbierta.id, texto })}
                      />
                    </div>
                  )}
                  {paginaAbierta.origen === 'gestion' && (
                    <div className={anchoDeAcciones}>
                      <p className="rounded-lg border border-dashed border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                        Esta quedó de una gestión vieja. Se lee, no se edita — la etapa de esa conversación se apoya en ella.
                      </p>
                    </div>
                  )}
                  {esArchivo ? (
                    // 🔴 SIN el tope de 21cm EN PANTALLA DIVIDIDA, a propósito
                    // (26-ago-2026): esa hoja A4 (pensada para un párrafo de
                    // prosa) dejaba «muy comprimido» un PDF o un Word ahí — el
                    // panel de una mitad ya es angosto de por sí, y capar
                    // encima de eso dejaba MENOS ancho del que el panel
                    // realmente tenía. Usa el ancho real del panel.
                    //
                    // 🔴 Y CON el tope, centrada, en pantalla SIMPLE
                    // (04-sep-2026, a pedido explícito: «que se abra centrada
                    // y con la dimensión horizontal y vertical de las hojas de
                    // página»). Es la reversa de la decisión de arriba, pero
                    // para el caso contrario: sin pantalla dividida de por
                    // medio, un documento a lo ancho de TODO el panel se leía
                    // desproporcionado al lado de una hoja de texto, que
                    // siempre está centrada y topeada a 21cm
                    // (`ColumnaDeEscritura`/`.hoja-a4`). `mx-auto max-w-[21cm]`
                    // es el MISMO par ancho+centrado que usa `.hoja-a4` — el
                    // alto YA coincidía de antes (`ALTO_VISOR` en
                    // `PaginaDocumento.tsx` es la misma fórmula que la altura
                    // de `.hoja-a4`), así que esto completa las dos
                    // dimensiones, no solo el alto.
                    //
                    // ⚠️ SIN `pt-3` (04-sep-2026, reportado con captura: el borde
                    // del documento arrancaba más abajo que la hoja de al lado).
                    // `.hoja-a4` (`ColumnaDeEscritura`) arranca INMEDIATAMENTE
                    // después de su cabecera, sin relleno propio — un `pt-3` acá
                    // sumaba 12px que el otro lado no tenía, y las dos cabeceras
                    // ya miden EXACTO lo mismo (medido: 60px, `pt-4 pb-4` +
                    // `min-h-7` en las dos, ver `PantallaDividida.tsx`). `pb-3`
                    // se queda: es espacio DESPUÉS del visor, no antes, y ahí no
                    // hay nada de al lado con qué desalinearse.
                    //
                    // ⚠️ Y SIN `px-3` EN LA RAMA SIN DIVIDIR (04-sep-2026): con
                    // el tope de arriba, un padding horizontal acá dejaba el
                    // visor 24px más angosto que `.hoja-a4` — medido con
                    // Playwright: 793,7px la hoja, 769,7px el visor, mismo
                    // centro pero DISTINTO ancho. El pedido explícito era la
                    // MISMA dimensión horizontal, no una parecida.
                    <div className={dividiendo ? 'px-3 pb-3' : 'mx-auto w-full max-w-[21cm] pb-3'}>
                      <PaginaDocumento
                        key={`${paginaAbierta.origen}-${paginaAbierta.id}`}
                        nota={paginaAbierta}
                        registrarContenedorDeArchivo={registrarContenedorDeArchivo}
                      />
                    </div>
                  ) : (
                    <ColumnaDeEscritura dividida={dividiendo} registrarHojaA4={registrarHojaA4}>
                      <EditorPerezoso
                        key={`${paginaAbierta.origen}-${paginaAbierta.id}`}
                        contenidoInicial={docParaEditor(paginaAbierta)}
                        soloLectura={paginaAbierta.origen === 'gestion'}
                        onCambio={alCambiarDoc}
                        onAbrirPlantillas={abrirPlantillas}
                        onAbrirRespuestasRapidas={abrirRespuestasRapidas}
                        registrarPegado={registrarPegado}
                        registrarEditor={registrarEditor}
                      />
                    </ColumnaDeEscritura>
                  )}
                </div>

                {dividiendo && (
                  <div className="min-w-0 border-t border-border md:w-1/2 md:border-l md:border-t-0">
                    <PantallaDividida
                      key={paginaAbierta.id}
                      paginaIzquierdaId={paginaAbierta.id}
                      divididaId={divididaId}
                      notasDisponibles={notas}
                      mutaciones={{ crear, editar, dividir, crearDocumento }}
                      onCerrar={cerrarDivision}
                    />
                  </div>
                )}
              </div>
            );
          })()}
          </ZonaDeTrabajo>
        </main>
      </div>

      {/* Acá y no adentro de `EditorDePagina`: ver el docblock de `abrirPlantillas`. */}
      {plantillasAbierto && (
        <ModalDePlantillas
          onCerrar={() => setPlantillasAbierto(false)}
          onElegir={(texto) => {
            pegarPlantillaRef.current?.(texto);
            setPlantillasAbierto(false);
          }}
        />
      )}

      {/* Igual molde que arriba: elegir una respuesta la pega y cierra en el
          mismo clic. Se abre desde el `/` del editor y desde ningún otro
          lugar — administrar es una pantalla aparte, ver más abajo. */}
      {respuestasAbierto && (
        <ModalDeRespuestasRapidas
          onCerrar={() => setRespuestasAbierto(false)}
          onElegir={(texto) => {
            pegarPlantillaRef.current?.(texto);
            setRespuestasAbierto(false);
          }}
        />
      )}

      {/* «Configurar Respuestas Rápidas», desde el menú de Configuración. */}
      {configurarRespuestasAbierto && (
        <PantallaHechos enModal onCerrar={() => setConfigurarRespuestasAbierto(false)} />
      )}

      {/* «Administrar espacios», desde el mismo menú — mudado desde
          `SelectorDeEspacio.tsx` (03-sep-2026). */}
      {administrandoEspacios && <ModalDeEspacios onCerrar={() => setAdministrandoEspacios(false)} />}

      {/* La confirmación compartida — ver el docblock de `confirmacion`. */}
      {confirmacion && (
        <ModalDeConfirmacion
          titulo={confirmacion.titulo}
          mensaje={confirmacion.mensaje}
          textoConfirmar={confirmacion.textoConfirmar}
          peligroso
          onConfirmar={() => {
            confirmacion.onConfirmar();
            setConfirmacion(null);
          }}
          onCancelar={() => setConfirmacion(null)}
        />
      )}

      {/* COMPARTIR DESDE LA FILA — ver el docblock de `compartiendoId`. Si la
          nota se fue de la lista VIVA en el medio (se archivó, se movió a
          donde ya no se busca), `notaCompartiendo` da `null` y el modal
          simplemente no se dibuja — no hay nada más viejo que mostrar. */}
      {notaCompartiendo && vistaCompartir === 'link' && (
        <ModalDeLink
          nota={notaCompartiendo}
          onCerrar={() => setCompartiendoId(null)}
          onGuardar={(v) => abrirLink.mutate({ id: notaCompartiendo.id, ...v })}
          onCortar={() => cortarLink.mutate(notaCompartiendo.id)}
          onVerRegistro={() => setVistaCompartir('registro')}
        />
      )}
      {notaCompartiendo && vistaCompartir === 'registro' && (
        <AuditoriaDeLink notaId={notaCompartiendo.id} onCerrar={() => setVistaCompartir('link')} />
      )}
    </section>
  );
}
