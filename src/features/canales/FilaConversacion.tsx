import { useEffect, useRef, useState, type Ref } from 'react';
import { Bot, Check, ClipboardList, Hourglass, Link2, Megaphone, Pin, Star, UserRound } from 'lucide-react';
import { hace } from '../../lib/datos/frescura';
import { formatoTelefono, horasDesde, SEMAFORO_META } from '../../lib/formato';
import { textoDePreview } from '../../lib/preview';
import { ETAPA_CHIP, rotuloEtapa } from '../../lib/etapas';
import {
  CLASE_FONDO,
  CLASE_FONDO_SUAVE,
  CLASE_FONDO_TENUE,
  CLASE_TEXTO,
  colorDeAvatar,
  resolverColor,
} from '../../dominio/paletaCategorias';
import { cursoDeFila, detalleDeCurso } from '../../dominio/curso';
import { deDondeVino, type ClaseOrigen } from '../../dominio/origen';
import { marcaDeCliente, type NivelCliente } from '../../dominio/cliente';
import { marcaDelBot, type TonoBot } from '../../dominio/bot';
import { nombreCorto } from '../../dominio/dueno';
import { PildoraCanal } from '../../components/BadgeCanal';
import { Avatar } from '../../components/Avatar';
import { VENTANA_DIAS } from './types';
import { ayudaDeAntiguedad, lecturaDeVentana, plazoDuro, type ColorVentana } from '../../dominio/ventana';
import { idDeComentario, type Conversacion } from '../../dominio/conversaciones';
import { transporteDeLinea, type LineaWhatsapp } from '../../dominio/lineas';
import { esPrioritaria, quiereFoto, siguienteConFoto } from '../../dominio/fotoVisible';
import { PastillaRespondido, PastillaTieneAbierto } from './PastillasDelComentario';

/**
 * Prende `conFoto` con el propio IntersectionObserver de la fila (guardarraíl
 * anti-ban de #71/#59, lógica pura en `fotoVisible.ts`). Las primeras N filas
 * ni observan: ya arrancan con `conFoto` en `true`, así el primer pintado no
 * tiene el parpadeo iniciales→foto. El resto observa hasta que entra al
 * viewport UNA vez — ahí se desconecta (sticky, no repite el fetch al
 * scrollear de un lado a otro). Las filas de canales sin foto (FB/IG,
 * `quiereFoto`) ni instancian el observer.
 *
 * `root`: el que clipea la fila no es el viewport del documento, es el `<div
 * data-scroll-cola>` de `ColaUnificada` — sin decirle eso al observer,
 * `rootMargin` mide contra la ventana entera y no anticipa nada real.
 */
/**
 * Los tres colores de la ventana (`dominio/ventana.ts`), en la tinta de esta
 * fila.
 *
 * ⚠️ **Corrección de colorimetría (28-ago-2026, pedido del dueño)**: el fondo
 * subió de `/10` a `/15`. A `/10` el tinte quedaba casi indistinguible del
 * fondo de la tarjeta —la píldora se leía por el borde de la forma, no por el
 * color—, así que la escala de tres colores (verde/amarillo/rojo) perdía
 * fuerza justo donde tiene que gritar más: la roja, a minutos de cerrarse.
 */
const CLASE_POR_COLOR_VENTANA: Record<ColorVentana, string> = {
  verde: 'bg-success/15 text-success',
  amarillo: 'bg-warning/15 text-warning-foreground',
  rojo: 'bg-destructive/15 text-destructive',
};

function useConFotoVisible(indice: number | undefined, canal: string) {
  const prioritaria = esPrioritaria(indice) && quiereFoto(canal);
  const [conFoto, setConFoto] = useState(prioritaria);
  const elRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (conFoto || !quiereFoto(canal) || typeof IntersectionObserver === 'undefined') return;
    const el = elRef.current;
    if (!el) return;
    const root = el.closest<HTMLElement>('[data-scroll-cola]');
    const observer = new IntersectionObserver(
      (entradas) => setConFoto((actual) => siguienteConFoto(actual, entradas)),
      { root, rootMargin: '200px' }, // llega un poco antes de que la fila esté del todo a la vista
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [conFoto, canal]);

  return { conFoto, elRef };
}

/**
 * LA MARCA DE EX-CLIENTE (#133): tres pesos del MISMO verde, que en Hermes ya
 * significa «cliente» (la banda del panel derecho, ADR 0017 §1 — si acá fuera de
 * otro color, el mismo hecho tendría dos idiomas). Rampa: fondo tenue → fondo
 * fuerte → sólido, del que compró una vez al VIP. **Sin oro**: el oro es tiempo
 * que se acaba y un cliente no es un reloj.
 *
 * ⚠️ **SIN BORDE, misma familia que «Preguntó» (corrección 28-ago-2026, pedido
 * del dueño)**: antes era una píldora con borde a propósito, para desambiguar
 * de forma contra el resto de los chips de la fila. El pedido nuevo va al
 * revés — «todos los chips de la fila deben tener una UI similar a
 * Preguntó»— así que la rampa de intensidad ahora vive solo en la opacidad
 * del fondo (10% → 20% → sólido), no en el grosor del trazo.
 */
const CLASE_MARCA: Record<NivelCliente, string> = {
  compro: 'bg-success/10 text-success',
  recompro: 'bg-success/20 text-success',
  vip: 'bg-success text-success-foreground',
};

/**
 * LO QUE EL BOT DIJO — píldora de FONDO tenue, como toda señal automática de la
 * casa («Cotizado», «Se enfrió»; ADR 0016). Fondo y no borde es lo que la separa
 * de una categoría manual sin leer un tooltip: esta no la puso nadie y no se
 * puede borrar. **Sin oro** — el oro es tiempo que se acaba y esto no es un reloj.
 *
 * `rojo` para la escalada (el bot se frenó: mientras nadie entre, el lead no
 * recibe nada) y `naranja` para la caliente (una oportunidad que el bot sigue
 * trabajando). Los dos de la paleta cerrada `--cat-*`, la misma de las otras
 * señales — una señal, un vocabulario.
 *
 * El ícono no es decoración: «Caliente» a secas chocaría con la temperatura que
 * la fila ya codifica en la banda de 3 px (`temperatureOf`, que mide días de
 * espera). El ícono dice de quién es la opinión antes de leerla.
 */
const CLASE_BOT: Record<TonoBot, string> = {
  escalada: CLASE_FONDO_TENUE.rojo + ' ' + CLASE_TEXTO.rojo,
  caliente: CLASE_FONDO_TENUE.naranja + ' ' + CLASE_TEXTO.naranja,
};

/**
 * DE DÓNDE VINO — el ícono de cada clase de origen (`dominio/origen.ts`).
 *
 * `desconocido` NO tiene ícono, y eso es la mitad del diseño: los tres estados
 * que se saben se dibujan con fondo lleno y un glifo, y el que no se sabe se
 * dibuja como un **contorno punteado vacío**. La forma dice «acá falta un dato»
 * sin gastar un color — y no puede gastarlo, porque el único color que le
 * quedaría libre a una señal permanente sería el oro, y en Hermes el oro
 * significa una sola cosa: tiempo que se acaba. Un origen no es un reloj.
 */
const ICONO_ORIGEN: Record<ClaseOrigen, typeof Megaphone | null> = {
  anuncio: Megaphone,
  landing: Link2,
  formulario: ClipboardList,
  desconocido: null,
};

/**
 * 🔴 **LAS DOS CAJAS MIDEN LO MISMO DE ALTO, Y ESTÁ HECHO A PROPÓSITO.**
 *
 * La llena lleva `py-px` (1 px arriba + 1 abajo) y la punteada lleva `py-0` con
 * `border` (1 px arriba + 1 abajo): **2 px en los dos casos**. Si la punteada
 * conservara el `py-px` de sus hermanas, el borde le sumaría 2 px y la fila
 * entera crecería — sólo en las filas sin origen, o sea en la mayoría, y esa es
 * exactamente la clase de diferencia que el rediseño del 28-ago-2026 vino a
 * matar («una fila iba de 66 px a 84, a 102 según qué le tocara»).
 *
 * Se copian las clases de CAJA de la píldora que ya existe, nunca un alto
 * clavado: mismo criterio que el hueco invisible del final del renglón.
 * **Medido en Chromium el 7-sep-2026 sobre la galería: 17,75 px las cuatro.**
 *
 * ⚠️ **Dos constantes y no un `Record<ClaseOrigen, string>`**: eran cuatro
 * claves con tres strings IDÉNTICOS, o sea un mapa que fingía cuatro casos donde
 * el eje real es uno solo — **se sabe o no se sabe**. Con el mapa, agregar una
 * clase obligaba a copiar el mismo string por cuarta vez, y nada impedía que la
 * copia nueva saliera distinta de las otras tres.
 */
const CAJA_SABIDO = 'bg-muted py-px text-muted-foreground';
const CAJA_DESCONOCIDO = 'border border-dashed border-border py-0 text-muted-foreground';

/**
 * ⚠️ **LA PÍLDORA "DE QUIÉN ES" SE SACÓ DEL RENGLÓN 1 (28-ago-2026, pedido del
 * dueño)**: quedaba duplicada con el ícono de agente asignado debajo del
 * avatar (mismo dato, `c.asignada_a`, con su propio hover mostrando el
 * nombre) — dos maneras de decir lo mismo en la misma fila. El ícono debajo
 * del avatar es AHORA la única forma de ver quién la tiene, para cualquier
 * conversación (propia o ajena).
 *
 * `marcaDeDueno` (`dominio/dueno.ts`) se queda sin ningún llamador en todo el
 * repo después de este cambio — `PasarConversacion`/`tenencia.ts` sólo la
 * MENCIONAN en un comentario; usan `mismaVendedora`/`rotuloDePersona` del
 * mismo archivo, no `marcaDeDueno` en sí. No se borra desde acá: no es parte
 * de lo que se pidió corregir, y borrar una función de un archivo de dominio
 * compartido es una decisión aparte.
 */

/**
 * Una conversación en la cola: quién (con su urgencia a la derecha), qué dijo,
 * y — solo si hay — las etiquetas. Lo pendiente habla en tinta plena; lo
 * respondido baja a gris — la página decide qué se lee primero.
 *
 * Sucedió a `FilaInteraccion` (archivada, ver ADR 0004). La banda de 3 px de la
 * izquierda es SIEMPRE temperatura, en esta lista y en todas; el oro aparece
 * solo en la ventana de Meta corriendo: tiempo que se acaba.
 *
 * 🔴 **REDISEÑO DEL 22-AGO-2026** (pedido del dueño: el canal y las etiquetas
 * necesitaban más protagonismo — ver `docs/evidencia/prototipo-rediseno-fila.png`,
 * dos variantes comparadas antes de tocar este componente). Dos cambios:
 *   · El canal deja de ser un disco de 14px sobre el avatar y pasa a una
 *     píldora con NOMBRE completo (`PildoraCanal`), primero en el renglón 1.
 *   · Las categorías dejan de competir por espacio en el renglón 2 (donde se
 *     recortaban a una + «+N») y pasan a su PROPIO renglón, sin recorte —
 *     invisible cuando no hay ninguna.
 */
export function FilaConversacion({
  c,
  seleccionada,
  onAbrir,
  etapa,
  mostrarPregunto = true,
  catalogoCategorias,
  esNueva = false,
  indice,
  tabIndex,
  onFocus,
  lineas = [],
  ref,
  esDeCampana = false,
}: {
  c: Conversacion;
  /**
   * 🔴 **En campaña la fila no muestra nada de la Escuela** (regla del dueño,
   * 11-sep-2026, lo reportó la cola de Américo): ni el chip de curso, ni la
   * marca de cliente, ni «Preguntó precio». Ausente = ventas, la fila de siempre.
   */
  esDeCampana?: boolean;
  seleccionada: boolean;
  onAbrir: (c: Conversacion) => void;
  /** Etapa del embudo si el shell la conoce — chip vía `ETAPA_CHIP` compartido. */
  etapa?: string | null;
  /** Dentro del filtro de pedidos el chip es redundante: se apaga desde afuera. */
  mostrarPregunto?: boolean;
  /** El catálogo de la vendedora, para resolver el color de la píldora de categoría (#49). */
  catalogoCategorias?: readonly { nombre: string; color: string }[];
  /** Solo la fila recién llegada por SSE entra animada, nunca la lista entera. */
  esNueva?: boolean;
  /** Posición en la lista — decide si es de las primeras N con foto prioritaria (`fotoVisible.ts`). */
  indice?: number;
  /** Roving tabindex: la cola se recorre con ↑↓ + Enter. */
  tabIndex?: number;
  onFocus?: () => void;
  /**
   * Las líneas VIVAS, para saber por qué transporte sale esta conversación
   * (`transporteDeLinea`). Default `[]` a propósito: sin lista, el transporte es
   * desconocido y la ventana se dibuja como siempre — nunca se esconde por no
   * haber cargado todavía.
   */
  lineas?: readonly LineaWhatsapp[];
  ref?: Ref<HTMLButtonElement>;
}) {
  const { conFoto, elRef } = useConFotoVisible(indice, c.canal);
  // EL SEMÁFORO REEMPLAZA A `temperatureOf`/`TEMPERATURE_META` ACÁ (#826, S.2):
  // la banda ya no dice antigüedad, dice interés de compra. Todos llegan
  // grises (D2): `c.luz` ausente (server sin la migración) también cae ahí.
  const temp = SEMAFORO_META[c.luz ?? 'gris'];
  const restan = VENTANA_DIAS - c.dias;
  /**
   * Cuánto le queda de ventana a esta conversación. Se recalcula en cada render
   * y no se memoiza: el dato ES el paso del tiempo, y un `useMemo` con `[c]` lo
   * congelaría hasta que la fila cambie por otro motivo.
   */
  /**
   * La cuenta regresiva sólo se dibuja donde hay un plazo que se cumpla
   * (`plazoDuro`): en whatsmeow Meta no rechaza nada, así que un «quedan 4 h»
   * ahí promete un vencimiento que no ocurre. Sin la lista todavía cargada,
   * `transporteDeLinea` da `undefined` y se dibuja como siempre.
   */
  const hayPlazo = plazoDuro(transporteDeLinea(lineas, c.numero_propio));
  const ventana = lecturaDeVentana(c.ventana_cierra, new Date(), hayPlazo);
  /**
   * ══ QUÉ NÚMERO VA EN EL GLOBITO ═════════════════════════════════════════════
   *
   * `sin_leer` cuando el server lo manda, y el conteo viejo cuando no. La
   * distinción vive acá arriba y no adentro del JSX porque la usan DOS cosas —el
   * número y el `title`— y con la condición escrita dos veces el globito diría
   * «3 sin leer» sobre los mensajes de la conversación el día que una de las dos
   * se toque.
   *
   * ⚠️ **`!== undefined` y no un truthy**: `sin_leer: 0` es un hecho («lo leíste
   * todo») y tiene que APAGAR el globito, no caer al respaldo. Con `??` sobre un
   * truthy, el cero se leería como ausente y la fila volvería a mostrar `n`,
   * justo en el caso que este frente arregla.
   */
  const globitoCuentaSinLeer = c.sin_leer !== undefined;
  const globito = globitoCuentaSinLeer ? c.sin_leer! : c.n > 1 && !c.respondida ? c.n : 0;
  /**
   * ¿ESTÁ SIN ABRIR? (rediseño 28-ago-2026, pedido del dueño) — misma cuenta que
   * el globito de arriba, así que "hay un globito" y "el mensaje está sin abrir"
   * son la MISMA pregunta dicha dos veces. Gobierna el peso del preview y el tono
   * de la hora: en negrita/oscuro mientras nadie abrió el chat, y baja a gris en
   * cuanto se abre — el mismo criterio que el punto azul de "Sin leer" ya usaba.
   */
  const sinAbrir = globito > 0;
  /**
   * EL MEJOR NOMBRE QUE HAY, misma jerarquía que `panel/identidad.ts` (sin
   * Cerberus: acá no hay margen para preguntarle al ERP por cada fila de la
   * cola) — formulario > lo que el equipo anotó a mano en «Registrar
   * contacto» > pushname de WhatsApp. Sin esto, un contacto de campaña
   * registrado a mano (sin Cerberus ni formulario) seguía mostrando el
   * teléfono pelado en la fila, aunque ya tuviera nombre guardado.
   */
  const nombreDeFicha = [c.ficha_nombre, c.ficha_apellido].filter(Boolean).join(' ').trim() || null;
  const mejorNombre = c.lead_nombre || nombreDeFicha || c.persona_nombre;
  const esTelefono = !mejorNombre && c.canal === 'whatsapp' && c.persona_id != null;
  const nombre = mejorNombre ?? (esTelefono ? formatoTelefono(c.persona_id!) : 'Usuario');
  /** El id del comentario, o `null` si la fila es un chat. Es lo que prende sus pastillas (ADR 0121). */
  const idComentario = idDeComentario(c);
  // Horas reales desde la referencia — `c.dias` son días enteros, así que abajo
  // de un día daba siempre 0 → "hace 1 min". Con las horas, "hace 3 horas" es cierto.
  const horas = horasDesde(c.referencia);
  // EL COLOR DEL AVATAR (rediseño 28-ago-2026): la semilla es el ID de la
  // persona y no el nombre — dos Sandra distintas no pueden caer en el mismo
  // color por compartir nombre, y la MISMA persona tiene que caer siempre en el
  // mismo color aunque le cambien el nombre en Cerberus.
  const colorAvatar = colorDeAvatar(c.persona_id ?? nombre);

  /**
   * ══ "ABIERTO/SIN ABRIR" — SÓLO PESO, SIN OPACIDAD (corrección 28-ago-2026,
   * pedido del dueño) ══
   *
   * El CSS exportado del Figma («Copy as code → CSS», sin login) mostraba
   * `opacity: 0.75` en el avatar y en la columna de texto de las filas
   * abiertas, y esa fue la primera implementación. El dueño la vio en la app
   * y la sacó a propósito: **no va opacidad, sólo el cambio de peso**. Queda
   * escrito para que no se reintroduzca leyendo de nuevo el CSS del Figma —
   * ese archivo describe el mockup estático, no necesariamente el
   * comportamiento final que el dueño quiere en el producto.
   *
   *  · El COLOR del nombre y del preview NUNCA cambia: los dos son siempre
   *    `#0E2A52` — el token `--navy-ink`, no `--foreground` (son valores
   *    distintos, `#0E2A52` vs `#16213A`).
   *  · El color de la hora NUNCA cambia tampoco: siempre `#5B6B86`
   *    (`--muted-foreground`).
   *  · Lo único que cambia con el estado es el PESO — 700 (bold) sin abrir,
   *    400 (regular) abierto — en preview y hora (el nombre queda SIEMPRE en
   *    700, sin importar el estado). `pesoDinamico` es ese peso.
   */
  const tintaTexto = 'text-navy-ink';
  const pesoNombre = esTelefono ? 'font-mono font-bold tabular-nums' : 'font-bold';
  const pesoDinamico = sinAbrir ? 'font-bold' : 'font-normal';
  const chipEtapa = etapa ? (ETAPA_CHIP[etapa] ?? 'bg-secondary text-secondary-foreground') : '';
  // Las categorías de la fila, resueltas al color de quien mira (#49). La píldora
  // usa BORDE de color (nunca sombra, nunca oro) — la banda de 3px es temperatura.
  const categorias = c.categorias ?? [];
  const catalogo = catalogoCategorias ?? [];
  /**
   * EL CURSO MANDA SOBRE «PIDE INFO» (#72). En el censo de producción del
   * 25-jul-2026, 311 de 1.867 conversaciones llevan «Pide info» — pero entre las
   * 478 que están sin responder (donde la vendedora realmente trabaja) son 311:
   * dos de cada tres. Un chip que aparece en dos de cada tres filas del trabajo
   * pendiente no ayuda a elegir a quién atender primero; QUÉ CURSO quiere, sí.
   *
   * Conviven como pidió el dueño, pero en una fila de 360 px no entran los dos:
   * cuando se sabe el curso, gana el curso (es el dato más accionable), y
   * «Pide info» queda de respaldo para las filas sin curso conocido.
   */
  const curso = cursoDeFila(c, { esDeCampana });
  /**
   * ¿YA NOS COMPRÓ? (#133) — 140 de las 1.997 conversaciones vivas, hoy
   * indistinguibles de un desconocido. Va en el renglón 1 porque es identidad
   * («quién es»), no estado del hilo, y pegada al nombre porque lo califica.
   *
   * Lo que cede espacio es el NOMBRE, que ya truncaba: un nombre cortado sigue
   * reconociéndose, una marca ausente es invisible. Y solo cede en el 7% de las
   * filas.
   */
  const marca = esDeCampana ? null : marcaDeCliente(c);
  /**
   * EL VEREDICTO DEL BOT (`bot.ts`), y ocupa el MISMO lugar que el curso.
   *
   * No es que sobre espacio: en 360 px el renglón 2 ya lleva curso + preview
   * (las categorías tienen su PROPIO renglón desde el rediseño del
   * 22-ago-2026, ver más abajo). La razón es que los dos responden la misma
   * pregunta —«¿qué pasa con esta?»— y el bot da la respuesta más fuerte: «el
   * bot se frenó y te espera» manda sobre «quiere el diploma de Inteligencia».
   *
   * ⚠️ Y hay un precio, escrito para que sea una decisión y no un accidente: en
   * las filas donde el bot habló, el chip de curso no se ve. Hoy no cuesta nada
   * —el bot corre en UNA línea que vende UN diploma, así que ahí el curso dice lo
   * mismo en todas las filas—, pero el día que el bot atienda una línea con
   * varios cursos hay que volver acá.
   */
  const bot = marcaDelBot(c);
  /**
   * DE DÓNDE VINO ESTA PERSONA (`dominio/origen.ts`) — y si no se sabe, que lo
   * diga. `null` sólo en los comentarios, donde el origen es la publicación que
   * la fila ya muestra abajo con «en “…”».
   */
  const origen = deDondeVino(c);

  return (
    <button
      type="button"
      ref={(el) => {
        // Dos dueños del mismo nodo: el roving-tabindex del shell (`ref`,
        // viene de afuera) y el IntersectionObserver de la foto (`elRef`,
        // interno). React 19 no mergea refs solo — se hace a mano acá.
        elRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onClick={() => onAbrir(c)}
      className={
        // `pr-3`, chico: la flechita ▼ del menú de la fila (`MenuFila`, se monta
        // afuera del botón) vive ahora en la esquina INFERIOR derecha
        // (rediseño 28-ago-2026, pedido del dueño — antes arriba, pegada a la
        // hora), así que sólo el renglón de abajo (etiquetas) necesita reservarle
        // sitio — ver el `pr-7` de esa fila más abajo. Las dos filas de arriba
        // (nombre/hora, preview/conteo) ya no tienen que ceder ancho por ella:
        // por eso van «más a la derecha» que antes.
        // Padding vertical `py-2.5` (10px) y `gap-1` (4px) entre las dos
        // mitades — los números EXACTOS del CSS exportado del Figma
        // (`padding: 10px 4px 10px 0px`, `gap: 10px` en la fila, 4px en la
        // columna de texto): ya no son una compresión a ojo, son el dato real.
        'group relative flex w-full flex-col gap-1 border-b border-border py-2.5 pl-4 pr-3 text-left transition-colors last:border-b-0 ' +
        (seleccionada
          ? 'bg-secondary shadow-[inset_-3px_0_0_var(--color-primary)] active:bg-muted'
          : c.respondida
            ? 'bg-success/5'
            : 'hover:bg-muted/50') +
        (esNueva ? ' animate-in fade-in slide-in-from-top-1 duration-300 ease-house' : '')
      }
    >
      {/* Banda de temperatura: 3px a la izquierda, codifica urgencia sin
          palabras. `rounded-sm` + inset por `top-2.5`/`bottom-2.5` (no
          `inset-y-0`): el CSS del Figma la dibuja como una barra que FLOTA,
          separada del borde de arriba y abajo por el mismo padding de la
          fila (10px) y con las puntas redondeadas — no una barra a sangre
          completa pegada a las líneas divisorias. */}
      <span className={'absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-sm ' + temp.bar} aria-hidden="true" />

      {/*
        ══ FILA DE ARRIBA: AVATAR + NOMBRE/PREVIEW (rediseño 28-ago-2026) ══

        El avatar es hermano DIRECTO de la columna nombre+preview —no de toda la
        fila, que además lleva las etiquetas más abajo—, así que su alto lo
        marca exactamente ese par de renglones (pedido del dueño: «el círculo
        debe tener el mismo alto desde el nombre hasta el mensaje»), y no crece
        de más cuando la fila de etiquetas se hace más alta por el `flex-wrap`.
      */}
      <div className="flex items-center gap-3">
        {/* El canal se lee como píldora en el renglón 1 (rediseño 22-ago-2026,
            #48-global): un disco de 14px sobre el avatar era casi invisible y
            el dueño pidió más protagonismo para IG/FB/WhatsApp.

            ⚠️ **`size-9` (36px), el número EXACTO del Figma** — no una
            estimación. Las dos vueltas anteriores (56px, después 48px) salían
            de mirar la proporción en una captura; el CSS exportado de la fila
            real dice `width: 36px; height: 36px` sin ambigüedad, y el color
            sigue saliendo de `colorDeAvatar` (variado por contacto) con la
            letra en blanco.

            ⚠️ **Sin `opacity-75`, a propósito**: el Figma la traía en las
            filas abiertas, pero el dueño la sacó al verla en la app — ver el
            docblock de `pesoDinamico` más arriba. El avatar se queda a
            opacidad plena siempre. */}
        {/* ⚠️ **El logo del canal vuelve al avatar (pedido del dueño, 07-sep-2026)**:
            enmienda puntual del rediseño 22-ago-2026 que lo había sacado de acá por
            «casi invisible» a 14px sobre el borde — ese argumento era sobre la
            posición vieja (un disco flotando sobre el borde superior). Acá va
            integrado en la esquina inferior derecha del círculo, y REEMPLAZA a la
            píldora del renglón 1 (corrección del mismo día: el dueño la vio
            duplicada — el mismo logo dicho dos veces en la misma fila — así que la
            del renglón 1 se saca, y el nombre pasa a arrancar en la misma X que el
            preview de abajo).
            `PildoraCanal … conEtiqueta={false}` y no `BadgeCanal`: éste último, a
            14px, dibuja un disco de color LISO —sin el glifo— porque `conInicial`
            exige 18px o más; lo que el dueño pidió ver es el LOGO, no un punto de
            color, y `PildoraCanal` es la única pieza que ya sabe dibujar el glifo
            pelado (WhatsApp/IG) o autocontenido (FB/Messenger, vía `soloGlifo`)
            sobre su propio disco.
            Sin `ring`/halo (corrección del mismo día, el dueño lo vio como un
            borde blanco de más): el logo se apoya directo sobre el color del
            avatar, sin separación. */}
        <span className="relative shrink-0">
          <Avatar
            nombre={c.persona_nombre}
            telefono={c.canal === 'whatsapp' ? c.persona_id : null}
            numeroPropio={c.numero_propio}
            conFoto={conFoto}
            className={'size-9 rounded-full text-[13px] font-bold leading-[18px] text-white ' + CLASE_FONDO[colorAvatar]}
          />
          <span className="absolute -bottom-0.5 -right-0.5">
            <PildoraCanal canal={c.canal} tipo={c.tipo} conEtiqueta={false} />
          </span>
        </span>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          {/* Renglón 1: quién, y a la derecha la urgencia — nombre y hora
              CENTRADOS entre sí (`items-center`, no `items-start`: con la
              ventana + hora en un solo bloque a la derecha, un `items-start`
              los desalineaba contra el nombre de la izquierda). */}
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              {/* ⚠️ **El logo del canal SE SACÓ DE ACÁ (07-sep-2026, pedido del
                  dueño)**: quedaba dicho dos veces en la misma fila — ya vive en
                  la esquina inferior derecha del avatar (ver el docblock ahí
                  arriba) — y el nombre pasa a ser el PRIMER elemento del
                  renglón, alineado en la misma X que el preview de abajo (que
                  tampoco lleva ícono al frente). El `title`/`aria-label` del
                  logo en el avatar sigue diciendo de qué canal es. */}
              {/* Pin: por qué esta fila está en la banda de arriba. Navy, no oro. */}
              {c.fijada && (
                <Pin size={12} fill="currentColor" className="shrink-0 text-navy-ink" aria-label="Fijada" />
              )}
              {/* ⚠️ **El punto azul de "sin leer" se sacó (28-ago-2026, pedido
                  del dueño)**: era redundante al lado del nombre — el peso
                  bold del preview/hora y el globito de conteo (renglón 2) ya
                  dicen "sin abrir" sin gastar un ícono más pegado al nombre.
                  `c.no_leido` sigue existiendo y gobernando esos otros dos
                  (ver `sinAbrir`/`globito` más arriba); sólo este punto
                  puntual desaparece. */}
              {/* `title`: el renglón 1 acumula marcas (cliente, dueño, etapa) y
                  en el peor caso —los tres a la vez, ~4 % de las filas— el
                  nombre trunca fuerte. «Un nombre cortado sigue
                  reconociéndose» vale hasta cierto punto: con el hover,
                  siempre.

                  ⚠️ **`text-[12.5px]`, `text-navy-ink`: los valores EXACTOS
                  del Figma** (`font-size: 12.5px`, `color: #0E2A52` — que es
                  el token `--navy-ink`, NO `--foreground`, aunque los dos se
                  vean parecidos). Antes esto era `text-base` (16px) sobre
                  `text-foreground`: una estimación de cuando sólo había una
                  foto comprimida para mirar. */}
              <span
                title={nombre}
                className={`truncate text-[12.5px] leading-[17px] ${pesoNombre} ${tintaTexto}`}
              >
                {nombre}
              </span>
              {/* A la derecha del nombre — misma UI que «Preguntó» (sin
                  borde, `px-1 py-px`), sólo que en verde: ver el docblock de
                  `CLASE_MARCA` más arriba. */}
              {marca && (
                <span
                  title={marca.titulo}
                  className={
                    'shrink-0 rounded-full px-1 py-px text-[10.5px] font-semibold ' +
                    (marca.nivel === 'compro' ? '' : 'tabular-nums ') +
                    CLASE_MARCA[marca.nivel]
                  }
                >
                  {marca.texto}
                </span>
              )}
              {/* Favorita: estrella navy (el oro es SOLO tiempo que se acaba). */}
              {c.favorita && (
                <Star size={12} fill="currentColor" className="shrink-0 text-navy-ink" aria-label="Favorita" />
              )}
              {/* UNA conversación, así que singular — y por el rótulo canónico:
                  esta píldora pintaba el IDENTIFICADOR crudo con un
                  `capitalize` de CSS, que con ids de una palabra se veía bien
                  de casualidad. */}
              {/* `rounded-full` (corrección 28-ago-2026, contra el Figma):
                  pasó por `rounded` y después por `rounded-md` en dos vueltas
                  anteriores de este mismo pedido —«que tenga el mismo borde
                  que "se le puede escribir"»—, y las dos fueron un tanteo
                  sobre una foto de referencia comprimida. Con el Figma real
                  al lado (zoom ×3) se ve sin ambigüedad: «Preguntó» Y la
                  ventana son cápsulas completas, extremos semicirculares, no
                  un rectángulo con esquina suave. Un chip de fondo suave
                  tiene que compartir la MISMA forma sin importar de qué dato
                  hable. */}
              {etapa && (
                <span className={'shrink-0 rounded-full px-1 py-px text-[10.5px] font-semibold ' + chipEtapa}>
                  {rotuloEtapa(etapa)}
                </span>
              )}
            </span>
            {/*
              ══ LA VENTANA VA A LA IZQUIERDA DE «HACE…», LAS DOS EN UN SOLO
              RENGLÓN (rediseño 28-ago-2026, pedido del dueño) ══

              Hasta acá el bloque de la derecha apilaba dos renglones (la
              píldora arriba, la hora abajo), y por eso hacía falta un hueco
              invisible que reservara la altura del renglón que faltaba cuando
              no había ventana (ver ADR del 26-ago-2026 más arriba en el
              historial del archivo). En una sola línea horizontal esa
              diferencia de alto ya no existe —con o sin píldora la fila mide
              lo mismo—, así que el hueco se borra con ella: no es una
              simplificación de estilo, es la consecuencia directa del layout
              nuevo.
            */}
            <span className="flex shrink-0 items-center gap-1.5">
              {/*
                SE LE PUEDE ESCRIBIR — la ventana de conversación
                (`ventana.ts`). Cubre los dos plazos con una sola marca: 24 h
                desde que la persona escribió en un chat, 7 días desde que
                comentó en FB/IG. Antes acá solo entraban los comentarios, así
                que en WhatsApp —que es donde Goberna vende— la puerta se
                cerraba sin que nada lo dijera.

                TRES COLORES SEGÚN CUÁNTO FALTA (decisión del dueño,
                20-ago-2026): verde de 24 h a 12 h, amarillo de 11 h a 6 h,
                rojo de 5 h a 1 min — la misma escala de `dominio/ventana.ts`,
                sin distinguir canal (`colorDeVentana` solo mira `falta`). El
                fondo de las tres es `/15` desde el 28-ago-2026 — ver el
                docblock de `CLASE_POR_COLOR_VENTANA` más arriba.

                ⚠️ **`font-semibold` y `text-[10.5px]`, no `font-bold`/
                `text-xs`**: el CSS exportado de la fila real dice
                `font-weight: 600` y `font-size: 10.5px` para el texto de esta
                píldora — un peso menos que lo que tenía antes.
              */}
              {ventana ? (
                <span
                  title={ventana.ayuda}
                  className={
                    'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold ' +
                    CLASE_POR_COLOR_VENTANA[ventana.color]
                  }
                >
                  <Hourglass size={10} />
                  {ventana.texto}
                </span>
              ) : (
                /* RESPALDO para un server que todavía no manda `ventana_cierra`:
                   N4 (front) va solo y N5 (server) es un botón, así que existe
                   una ventana de deploy con el front nuevo y el server viejo.
                   Sin esto, en esa franja los comentarios perderían su cuenta
                   regresiva — una regresión silenciosa que nadie ata al
                   deploy. */
                /* ⚠️ El respaldo va con la MISMA guarda que la píldora de
                   arriba: es la misma promesa dicha con otro dato. Sin esto,
                   durante la franja de deploy (N4 va solo, N5 es un botón) una
                   línea whatsmeow volvería a mostrar una cuenta regresiva — el
                   defecto reapareciendo justo donde nadie lo va a estar
                   mirando. */
                hayPlazo &&
                c.ventana_abierta && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/20 px-1.5 py-0.5 text-[10.5px] font-semibold text-gold-ink">
                    <Hourglass size={10} />
                    {restan <= 1 ? 'último día' : `quedan ${restan} días`}
                  </span>
                )
              )}
              {/* EL SEGUNDO RELOJ. Mide otra cosa que la píldora de arriba —lo
                  que PASÓ, no lo que falta— y encima cambia de referencia
                  según si le contestamos (`ayudaDeAntiguedad`). Los dos en
                  horas y pegados se leen como el mismo dato dicho dos veces;
                  por eso a su izquierda va un RELOJ DE ARENA (tiempo que se
                  acaba) y acá el `title` dice qué se está midiendo.

                  ══ SÓLO PESO, NUNCA COLOR NI OPACIDAD (28-ago-2026) ══ El
                  color de este texto es SIEMPRE `#5B6B86`
                  (`--muted-foreground`): no hay dos grises. Lo único que
                  cambia con `sinAbrir` es el PESO: 700 sin abrir, 400 abierta
                  — `pesoDinamico`, la misma variable que usa el preview de
                  abajo, para que las dos nunca puedan decir cosas distintas.
                  El CSS del Figma también traía `opacity-75` en el
                  contenedor de las filas abiertas; el dueño la sacó al verla
                  en la app (ver el docblock de `pesoDinamico` más arriba) —
                  acá no queda ningún resto de esa opacidad. */}
              <span
                title={ayudaDeAntiguedad(c.respondida)}
                className={
                  'inline-flex shrink-0 items-center gap-1 font-mono text-[10.5px] leading-[14px] tabular-nums text-muted-foreground ' +
                  pesoDinamico
                }
              >
                {/* En un comentario lo dice la pastilla «Respondido» de abajo: el ✓ acá sería el mismo dato dos veces. */}
                {c.respondida && idComentario === null && (
                  <Check size={11} className="shrink-0 text-success" aria-label="respondida" />
                )}
                {hace(horas)}
              </span>
            </span>
          </div>

          {/* Renglón 2: qué dijo, y a la derecha el conteo de sin leer. El
              chip de bot/curso/«Preguntó» vive en la fila de abajo, junto con
              las etiquetas (rediseño 28-ago-2026, pedido del dueño: el
              mensaje de la persona va solo en su línea, como en la imagen de
              referencia) — antes competía acá por espacio con el preview y lo
              recortaba.

              ⚠️ **`text-[11.5px]`, `text-navy-ink`, peso dinámico** — los
              valores exactos del CSS del Figma: el color NUNCA cambia
              (`#0E2A52` sin abrir o abierta), y lo que distingue un estado del
              otro es sólo el peso (`pesoDinamico`: 700 sin abrir, 400
              abierta). No hay opacidad de por medio: el Figma la traía y el
              dueño la sacó al verla en la app (ver el docblock de
              `pesoDinamico` más arriba). */}
          <div className="flex items-center gap-1.5">
            <p className={`min-w-0 flex-1 truncate text-[11.5px] leading-4 ${pesoDinamico} ${tintaTexto}`}>
              {textoDePreview({
                texto: c.texto,
                clase: c.ultima_clase,
                origen: c.ultima_origen,
                soloClic: c.solo_clic,
              })}
            </p>
            {/*
              ══ EL CONTEO VUELVE AL AZUL DE "SIN LEER" (rediseño 28-ago-2026,
              pedido del dueño) ══

              Reemplaza la decisión del 26-ago-2026 de arriba (colorear el
              globito del color de marca del canal): ese cambio quedó bien
              documentado y sigue siendo válido como razonamiento, pero el
              pedido nuevo es explícito y va para el otro lado — el AZUL es el
              color que la fila ya usa para "esto está sin leer" (el puntito
              del renglón 1), y el conteo dice exactamente lo mismo con un
              número. Un solo color para una sola idea, en vez de dos idiomas
              (azul = sin leer, color de red = cuántos) para la misma
              pregunta.

              La cuenta sigue siendo la de `sin_leer`/`no_leido` — eso no
              cambió, sólo el color. Ver el docblock de `globito`/`sinAbrir`
              más arriba para esa parte de la lógica.
            */}
            {globito > 0 && (
              <span
                title={globitoCuentaSinLeer ? `${globito} sin leer` : `${globito} mensajes en la conversación`}
                className="shrink-0 rounded-full bg-primary px-1.5 py-px text-[11px] font-bold tabular-nums text-primary-foreground"
              >
                {globito}
              </span>
            )}
          </div>
        </div>
      </div>

      {/*
        ══ FILA DE ABAJO: EL AGENTE ASIGNADO + LAS ETIQUETAS (rediseño
        28-ago-2026, pedido del dueño: «el ícono de quien atendió debe
        alinearse con las etiquetas, como Preguntó») ══

        El ícono ya NO cuelga del avatar (ahí competía por altura con el
        nombre+preview, que es lo único que el avatar tiene que igualar —ver
        la fila de arriba). Vive en su PROPIA fila, en una columna del MISMO
        ancho que el avatar (`w-9`, el mismo número que `size-9` de arriba —
        si uno se achica, el otro tiene que hacerlo con él) para que las
        etiquetas de al lado sigan arrancando en la misma X que el nombre y
        el preview de arriba —así el ícono queda, de hecho, en la misma línea
        que «Preguntó».
      */}
      <div className="flex items-center gap-3">
        <div className="flex w-9 shrink-0 items-center justify-center">
          {/*
            EL AGENTE ASIGNADO — un ícono chico y neutro, no una píldora con
            texto: acá no hay espacio para un nombre y la fila ya lleva el
            chip de "de quién es" en el renglón 1 para el caso que sí importa
            accionar (una conversación AJENA). Éste es solo el dato en un
            vistazo, al pasar el mouse — y sólo el nombre, nada más: sin la
            palabra "asignado" ni el usuario completo.

            ⚠️ **Tamaño y color EXACTOS del Figma (cuarta vuelta, 28-ago-2026)**:
            19×19px, fondo plano `#E8E8E8` y el glifo en negro puro — ninguno
            de los dos es un token de `index.css` (ni `--muted`, ni
            `--muted-foreground`, que llevan un matiz azulado). Las vueltas
            anteriores probaron `bg-muted`, `bg-secondary` y
            `bg-muted-foreground/15` adivinando sobre una captura; el CSS
            exportado de la fila real no deja margen: es un gris neutro sin
            tinte de marca, y el glifo es `#000000`. Y a diferencia del avatar
            y del texto, este ícono NO lleva `opacity-75` en las filas
            abiertas — el CSS de las cuatro filas lo confirma. */}
          <span
            title={c.asignada_a ? nombreCorto(c.asignada_a) : undefined}
            className="flex size-[19px] items-center justify-center rounded-full bg-[#E8E8E8] text-black"
          >
            <UserRound size={12} aria-hidden="true" />
          </span>
        </div>

        {/* EL CHIP DE BOT/CURSO/«PREGUNTÓ», LAS ETIQUETAS Y EL CONTEXTO
            COMPARTEN ESTA FILA (pedido del dueño, 26-ago-2026 para
            etiquetas/contexto, y 28-ago-2026 para sumarle el chip: todas
            responden la misma pregunta —«¿qué más hay que saber de esta
            fila?»— y todas van bajo lo que dijo la persona, nunca al lado).
            Se reserva SIEMPRE, para que todas las filas midan lo mismo.

            `pr-7`: ahora que la flechita ▼ vive abajo a la derecha (rediseño
            28-ago-2026), es ESTA fila —y no toda la fila, como antes con
            `pr-9` en el botón— la que le reserva sitio. Las etiquetas nunca
            quedan tapadas ni saltan cuando la flechita aparece al pasar el
            mouse.

            Antes eran bloques opcionales sueltos, cada uno con su `mt` y su
            guarda. Medido: **+18 px cada uno**, así que una fila iba de 66 px
            a 84, a 102 según qué le tocara — y en la lista eso se ve como
            filas que no calzan.

            🔴 **ESTO ENMIENDA LA DECISIÓN DEL 22-AGO, Y HAY QUE DECIRLO.** Ese
            rediseño dice que el renglón de etiquetas se dibuja sólo si hay al
            menos una, porque «un renglón vacío en el 93%+ de las filas sin
            categoría sería puro aire». Sigue siendo cierto que es aire: lo
            que cambió es qué se prefiere pagar. El dueño eligió el aire antes
            que filas de alturas distintas. Si algún día se vuelve atrás, es
            acá y el argumento de 22-ago sigue en pie tal cual.

            ⚠️ **Las etiquetas NO se recortan a «+N»**: eso es lo que 22-ago
            prohíbe y no se toca. El contexto sí cede ancho —ya venía cortado
            a una línea— cuando comparte renglón con ellas. */}
        {/* `rounded-full` en los tres chips de acá abajo (bot, curso, «Preguntó»)
            — corrección del 28-ago-2026, pedido del dueño: «las etiquetas, las
            etapas y los mensajes del bot deben tener el mismo borde que "se le
            puede escribir"». Pasó por `rounded` y por `rounded-md` en dos
            vueltas previas del mismo pedido; el Figma (revisado con Playwright
            a zoom ×3, ver el docblock de la etapa más arriba) muestra sin
            ambigüedad que la ventana Y «Preguntó» son cápsulas completas —
            `rounded-full`, no un radio fijo—, y ahora todos estos chips
            comparten esa misma esquina.

            Sin opacidad acá tampoco: el Figma traía este renglón DENTRO de la
            misma columna «Texto» que el nombre y el preview, así que
            heredaba el `opacity-75` de las filas abiertas; el dueño la sacó
            en las tres partes a la vez. */}
        {/* ══ JERARQUÍA DE ESTE RENGLÓN (28-ago-2026, pedido del dueño) ══
            1º bot, 2º curso, 3º «Preguntó»/«Preguntó precio», 4º etiquetas
            manuales — mutuamente excluyentes los tres primeros (si uno falta,
            el siguiente ocupa su lugar; ya era así, sólo queda dicho acá) y
            las etiquetas siempre ADITIVAS después, todo en una sola fila que
            se acomoda de izquierda a derecha con `flex-wrap`.

            Los tres —bot, curso y etiquetas (ver más abajo)— comparten ahora
            la MISMA caja que «Preguntó»: `px-1 py-px`, sin borde. Antes tenían
            `px-1.5`, una pizca más ancho; el pedido fue que los cuatro se
            lean como la misma familia visual, y sus COLORES propios (el rojo/
            naranja del bot, el color hash del curso, el color de catálogo de
            cada etiqueta) no se tocan — sólo la caja. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pr-7">
          {/*
            ══ DE DÓNDE VINO, SIEMPRE, Y PRIMERO (7-sep-2026) ══════════════════

            🔴 **EL DEFECTO QUE ESTO CIERRA NO ERA UN DATO QUE FALTARA: ERA UNO
            QUE HERMES TENÍA Y NO DECÍA.** El origen se captura desde siempre
            (`server/src/whatsapp/origen.ts` lee el `externalAdReply` del
            Click-to-WhatsApp) y en la fila se asomaba **sólo cuando el último
            mensaje no traía texto** — o sea, casi nunca: era un respaldo del
            preview («📣 Vino del anuncio» en lugar de «(sin texto)»), no una
            señal. El 6-sep-2026 un lead escribió «si seguí tu anuncio en
            Facebook deberías saber qué necesito», recibió un saludo genérico y
            terminó tratado de grosero: quien atendía no tenía **nada** en
            pantalla que dijera de dónde venía.

            ⚠️ **VA PRIMERO, y es lo único que justifica moverse de la jerarquía
            del renglón.** El orden que fijó el dueño el 28-ago (1º bot, 2º
            curso, 3º «Preguntó», 4º etiquetas) **no se toca: esos cuatro
            siguen exactamente en ese orden entre ellos.** Lo que se le antepone
            es un marcador FIJO, y tiene que ir en la posición 0 por una razón
            mecánica, no estética: este contenedor es `flex-wrap`, así que
            cualquier chip que no sea el primero puede caer al renglón de abajo
            —o quedar fuera de vista— cuando la fila junta bot + curso + tres
            etiquetas. Un dato cuya única promesa es **estar siempre** no puede
            ocupar el único lugar donde a veces no está.

            ⚠️ **No repite el chip de curso, aunque los dos salgan del mismo
            anuncio.** El curso contesta QUÉ QUIERE (sale del titular del
            creativo, `dominio/curso.ts`); esto contesta DE DÓNDE VINO. Por eso
            acá va la CLASE en dos palabras y no el nombre del anuncio: medidos
            el 7-sep-2026, los nombres reales son slugs genéricos («flyer
            principal» en 6 anuncios distintos, «reel jarvis», «busqueda
            osint») y la campaña que sí identifica el producto es un código
            interno largo —«[SEP][DIPICOT027] Diplomado en Inteligencia 27 -
            Perú»— que no entra en 360 px. El nombre, la campaña y el titular
            se leen en el `title`, y completos en la ficha.
          */}
          {origen && (
            <span
              title={origen.ayuda}
              data-origen={origen.clase}
              className={
                'flex shrink-0 items-center gap-1 rounded-full px-1 text-[10.5px] font-semibold ' +
                (origen.clase === 'desconocido' ? CAJA_DESCONOCIDO : CAJA_SABIDO)
              }
            >
              {(() => {
                const Icono = ICONO_ORIGEN[origen.clase];
                return Icono ? <Icono size={11} className="shrink-0" aria-hidden="true" /> : null;
              })()}
              {origen.etiqueta}
            </span>
          )}
          {/*
            ══ ¿YA ESTÁ RESPONDIDO? ¿QUIÉN LO TIENE ABIERTO? (ADR 0121) ══
            Sólo en comentarios, y pegadas al origen por lo mismo que el origen va
            primero: son marcas que tienen que estar SIEMPRE a la vista, y en un
            renglón `flex-wrap` lo de atrás es lo que cae. Con varias agentes en la
            misma Página, saberlo sin abrir es lo que evita la segunda respuesta.
          */}
          {idComentario !== null && c.respondida && <PastillaRespondido en="fila" />}
          {idComentario !== null && <PastillaTieneAbierto interactionId={idComentario} en="fila" />}
          {bot ? (
            <span
              title={bot.titulo}
              className={
                'flex max-w-[55%] shrink-0 items-center gap-1 truncate rounded-full px-1 py-px text-[10.5px] font-semibold ' +
                CLASE_BOT[bot.tono]
              }
            >
              <Bot size={11} className="shrink-0" aria-hidden="true" />
              {bot.texto}
            </span>
          ) : curso ? (
            /* El QUÉ: fondo suave del color de su familia (nunca borde +
               sombra, nunca oro — el oro es tiempo que se acaba, y un curso
               no es un reloj). El `title` dice de dónde salió el dato: el
               chip no miente. */
            <span
              title={detalleDeCurso(curso)}
              className={
                'max-w-[45%] shrink-0 truncate rounded-full px-1 py-px text-[10.5px] font-semibold ' +
                CLASE_FONDO_SUAVE[curso.color] +
                ' ' +
                CLASE_TEXTO[curso.color]
              }
            >
              {curso.nombre}
            </span>
          ) : (
            mostrarPregunto &&
            c.pregunto && (
              // `bg-secondary`, no `bg-primary/10` (corrección 28-ago-2026):
              // el CSS exportado de la fila real dice `background: #EFF4FE`,
              // que es literalmente nuestro token `--secondary` — no un tinte
              // de `--primary` calculado en runtime.
              <span className="shrink-0 rounded-full bg-secondary px-1 py-px text-[10.5px] font-semibold text-primary">
                {c.pregunto_precio && !esDeCampana ? 'Preguntó precio' : 'Preguntó'}
              </span>
            )
          )}
          {/*
            ══ SIN BORDE, Y CÁPSULA COMPLETA — TRES VUELTAS PARA LLEGAR ACÁ
            (28-ago-2026, todas pedido del dueño) ══
            1. «corrige los bordes de las etiquetas» sacó el CONTORNO, pero
               dejó `rounded-full` sobre una caja no cuadrada → una cápsula
               rara, distinta de «Preguntó» al lado.
            2. «el mismo borde que "se le puede escribir"» lo llevó a
               `rounded-md`, adivinando la forma de la ventana sin verla bien.
            3. Con el Figma real al lado (revisado con Playwright, zoom ×3) la
               forma correcta queda sin ambigüedad: «Preguntó» Y la ventana son
               CÁPSULAS completas — `rounded-full` era lo correcto desde la
               vuelta 1, sólo que entonces no tenía el ancho fijo que necesita
               (por eso se veía «rara»). El contorno sigue afuera.

            Antes era un contorno de color sobre `bg-card` (la «regla dura» de
            `dominio/paletaCategorias.ts`: píldora de BORDE, nunca de fondo).
            En ESTA fila específica esa regla queda reemplazada por la de
            fondo suave y la cápsula `rounded-full` — la misma forma que ya
            usan el chip de curso, «Preguntó», la etapa y la ventana: todos
            los chips de esta fila tienen que leerse como la MISMA familia,
            no como formas distintas compitiendo. El resto de la app —el
            selector de categorías, la barra de filtros— sigue usando
            `CLASE_BORDE` sin tocar; el `paletaCategorias.ts` documenta la
            regla general y esto es la excepción, no el reemplazo.
          */}
          {categorias.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {categorias.map((nombreCat) => {
                const color = resolverColor(nombreCat, catalogo);
                return (
                  <span
                    key={nombreCat}
                    title={nombreCat}
                    className={
                      'shrink-0 rounded-full px-1 py-px text-[10.5px] font-semibold capitalize ' +
                      (color ? CLASE_FONDO_SUAVE[color] + ' ' + CLASE_TEXTO[color] : 'bg-muted text-muted-foreground')
                    }
                  >
                    {nombreCat}
                  </span>
                );
              })}
            </div>
          )}
          {c.contexto_texto && c.tipo === 'comentario' && (
            <p className="min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground">en “{c.contexto_texto}”</p>
          )}
          {/*
            EL PISO DEL RENGLÓN — un clon invisible de una etiqueta.

            Va SIEMPRE, incluso cuando hay contenido, y por eso son dos cosas
            a la vez: reserva el renglón en la fila que no tiene nada, y le
            pone piso a la que sólo tiene contexto —que es `text-xs` y mide
            2 px menos que una píldora de etiqueta—. Sin él, esas dos filas
            volvían a diferir por poco, que es la clase de diferencia que no
            se explica mirando.

            🔴 Mismo criterio que el hueco de la píldora de ventana: se copian
            las clases de CAJA de lo que reserva, nunca un `min-h` con un
            número. Un alto clavado se desincroniza en silencio el día que la
            etiqueta cambie de padding, y el síntoma es exactamente el defecto
            que esto arregla.
          */}
          <span aria-hidden="true" className="invisible shrink-0 px-1 py-px text-[10.5px] font-semibold">
            ·
          </span>
        </div>
      </div>
    </button>
  );
}
