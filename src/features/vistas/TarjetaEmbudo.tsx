import { useEffect, useRef, useState } from 'react';
import {
  AlarmClock,
  ArrowLeft,
  BadgeCheck,
  BadgeDollarSign,
  Bot,
  Check,
  ClipboardList,
  GraduationCap,
  History,
  Hourglass,
  Loader2,
  Megaphone,
} from 'lucide-react';
import { marcaDeCliente } from '../../dominio/cliente';
import { marcaDeAsignacion } from '../../dominio/dueno';
import { idDeComentario, type Conversacion } from '../../dominio/conversaciones';
import { transporteDeLinea, type LineaWhatsapp } from '../../dominio/lineas';
import { Avatar } from '../../components/Avatar';
import { BotonAbrirChat } from './BotonAbrirChat';
import { insigniaDe, LogoDeCanal } from '../../components/BadgeCanal';
import { detalleDeCurso } from '../../dominio/curso';
import { esPrioritaria, quiereFoto, siguienteConFoto } from '../../dominio/fotoVisible';
import { marcaDelBot, type TonoBot } from '../../dominio/bot';
import { porqueDestacable } from '../../dominio/semaforo';
import { hace } from '../../lib/datos/frescura';
import { lecturaDeVentana, plazoDuro } from '../../dominio/ventana';
import { lecturaDeAntiguedad } from '../../dominio/antiguedad';
import { etiquetaDeMedia } from '../../lib/etiquetaMedia';
import { bordePropuestaSemaforo, horasDesde, tempClass } from '../../lib/formato';
import { cotizarEnUnClic, cursoDeTarjeta, haceCorto, nombreDeTarjeta, turnoDeTarjeta } from './tarjeta';
import { PildoraAsignacion } from './PildoraAsignacion';
import { PastillaRespondido, PastillaTieneAbierto } from '../canales/PastillasDelComentario';

/**
 * LA TARJETA DEL PIPELINE — lo que decide a quién tocar y qué decirle.
 *
 * La anterior mostraba nombre + hora + un pedazo del último mensaje, y con los
 * datos reales las 1.389 tarjetas de Contactados salían idénticas: el pedazo de
 * mensaje era NUESTRA plantilla, repetida. Ahora la tarjeta dice, en este orden:
 *
 *   1. QUIÉN — la foto y el nombre del formulario, no el pushname «🦋W».
 *   2. DE QUIÉN ES EL TURNO y hace cuánto — el ✓ de «le contestamos» y la flecha
 *      de «nos escribió», con la tinta de temperatura de la casa.
 *   3. DE QUÉ CURSO — el interés registrado o el que eligió en el formulario.
 *   4. SI YA LE PASAMOS EL PRECIO — y ahí mismo el botón para asentarlo.
 *
 * La tarjeta CRECE CON LO QUE TIENE QUE DECIR: una conversación sin curso ni
 * precio ocupa un renglón; una que ya está cotizada de hecho ocupa dos y trae su
 * acción. Densidad donde no hay nada que contar, detalle donde sí.
 *
 * El oro no aparece acá salvo en el seguimiento VENCIDO: es el único plazo duro
 * de esta pantalla, y el oro significa tiempo que se acaba, nada más.
 */

/**
 * EL VEREDICTO DEL BOT, EN LOS TONOS DE ESTA TARJETA.
 *
 * Los mismos dos hechos que la fila de la cola (`FilaConversacion`), traducidos
 * a la paleta del `Chip` de acá: **rojo** la escalada —el bot se frenó y hay un
 * lead esperando a una persona— y **amarillo** la caliente, que es una
 * oportunidad y no una deuda.
 *
 * ⚠️ **Nunca oro.** El oro de esta app significa tiempo que se acaba y nada más
 * (`src/index.css`); una escalada apura, pero no tiene reloj.
 */
const TONO_BOT: Record<TonoBot, 'rojo' | 'amarillo'> = {
  escalada: 'rojo',
  caliente: 'amarillo',
};

/**
 * EL FILETE DE LA LUZ (13-sep-2026, la maqueta que eligió el dueño: «el color aparece
 * SÓLO como señal»). Hasta ese día la luz era un degradado de fondo con el borde
 * entero teñido (`fondoSemaforo`, D1 del 8-sep); ahora es un filete izquierdo sobre una
 * tarjeta blanca. Nació en campaña y el 14-sep-2026 el dueño lo pidió para la Escuela
 * («el nuevo diseño a escuela ventas»): es la tarjeta de las DOS mesas. Los mismos
 * cuatro tokens `--sem-*`, así que el ámbar sigue sin ser oro. Literales enteros para
 * que Tailwind los encuentre. `fondoSemaforo` sigue viviendo en `lib/formato.ts` para
 * el kanban del Dashboard, que es de otro frente.
 */
const FILETE_DE_LUZ = {
  verde: 'border-l-sem-verde',
  ambar: 'border-l-sem-ambar',
  gris: 'border-l-sem-gris',
  rojo: 'border-l-sem-rojo',
} as const;

/** Cuántas tarjetas de cada columna piden foto sin esperar al scroll (anti-ban #59). */
const CON_FOTO_ARRIBA = 8;

function useConFotoVisible(indice: number, canal: string) {
  const prioritaria = esPrioritaria(indice, CON_FOTO_ARRIBA) && quiereFoto(canal);
  const [conFoto, setConFoto] = useState(prioritaria);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conFoto || !quiereFoto(canal) || typeof IntersectionObserver === 'undefined') return;
    const el = elRef.current;
    if (!el) return;
    const root = el.closest<HTMLElement>('[data-scroll-columna]');
    const observer = new IntersectionObserver(
      (entradas) => setConFoto((actual) => siguienteConFoto(actual, entradas)),
      { root, rootMargin: '160px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [conFoto, canal]);

  return { conFoto, elRef };
}

/** El chip de un dato de la tarjeta: neutro, con borde, nunca sombra ni oro. */
function Chip({
  icono,
  children,
  titulo,
  tono = 'neutro',
  encoge = false,
  alFinal = false,
}: {
  icono?: React.ReactNode;
  children: React.ReactNode;
  titulo?: string;
  tono?: 'neutro' | 'marca' | 'oro' | 'rojo' | 'amarillo' | 'verde' | 'suave';
  /** Quién cede el ancho cuando no alcanza. Solo el curso encoge; los rótulos cortos, nunca. */
  encoge?: boolean;
  /** Se va al extremo derecho del renglón (la antigüedad en campaña, como en la maqueta). */
  alFinal?: boolean;
}) {
  const tonos = {
    neutro: 'border-border text-muted-foreground',
    /* La píldora chica y clara de campaña: sin borde, un gris de fondo. Neutra a
       propósito: la antigüedad no vence, y un color la confundiría con la luz. */
    suave: 'border-transparent bg-secondary text-muted-foreground',
    marca: 'border-navy/20 bg-secondary text-secondary-foreground',
    /* El ORO significa tiempo que se acaba y NADA más (`src/index.css`). Ya no
       lo lleva ningún chip de esta tarjeta (la ventana pasó a la escala de
       tres colores, 20-ago-2026); queda declarado para que si algún chip lo
       toma en el futuro, sepa que significa «ahora» y nada más. */
    oro: 'border-gold/40 bg-gold/20 text-gold-ink',
    /* Los tres colores de la ventana (`dominio/ventana.ts`, `color`): verde
       24h→12h · amarillo 11h→6h · rojo 5h→1min. */
    verde: 'border-success/40 bg-success/10 text-success',
    amarillo: 'border-warning/40 bg-warning/10 text-warning-foreground',
    rojo: 'border-destructive/40 bg-destructive/10 text-destructive',
  };
  return (
    <span
      title={titulo}
      className={
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[11px] font-semibold ' +
        (encoge ? 'min-w-0 shrink ' : 'shrink-0 ') +
        (alFinal ? 'ml-auto ' : '') +
        tonos[tono]
      }
    >
      {icono}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function TarjetaEmbudo({
  c,
  indice,
  onAbrir,
  onFicha,
  abierta,
  alArrastrar,
  alTerminar,
  arrastrando,
  rebotada,
  onCotizar: onCotizarDeLaColumna,
  cotizando,
  columna,
  lineas = [],
  conAsignacion = false,
  esDeCampana = false,
}: {
  /**
   * 🔴 **En campaña la tarjeta no muestra nada de la Escuela** (regla del dueño,
   * 11-sep-2026): ni curso, ni «Ya compró», ni «Saben el precio», ni el atajo a
   * Cotizados. Ausente = ventas, la tarjeta de siempre.
   */
  esDeCampana?: boolean;
  c: Conversacion;
  indice: number;
  onAbrir: (c: Conversacion) => void;
  /** Un clic en la tarjeta abre la ficha al costado, sin salir del tablero. */
  onFicha?: (c: Conversacion) => void;
  /** Esta es la que está en la hoja: se marca, o no se sabe de cuál se está leyendo. */
  abierta?: boolean;
  alArrastrar: (c: Conversacion) => void;
  alTerminar: () => void;
  arrastrando: boolean;
  rebotada: boolean;
  /** El camino corto a Cotizados. `null` = esta columna no lo ofrece. */
  onCotizar?: (c: Conversacion) => void;
  cotizando: boolean;
  /** El título de la columna, solo para el `title` de la antigüedad («lleva 3 d en Cotizados»). */
  columna?: string;
  /**
   * Las líneas de WhatsApp que están corriendo, para el botón que lleva al chat.
   * Vienen por prop y no de `useLineas()` acá adentro: son cientos de tarjetas y
   * cada una abriría su propia suscripción a la query para leer la misma lista.
   * Ausente = sin nada que elegir, y el botón se comporta como siempre.
   */
  lineas?: LineaWhatsapp[];
  /**
   * ¿Quien mira supervisa? Entonces la tarjeta dice a quién está asignada, y
   * «Sin asignar» cuando no la tiene nadie (`marcaDeAsignacion`). El rol lo decide
   * el server y baja con las líneas (`veTodo`); acá no se deduce de nada.
   */
  conAsignacion?: boolean;
}) {
  const { conFoto, elRef } = useConFotoVisible(indice, c.canal);
  /**
   * ⚠️ ARRASTRAR NO ES CLICKEAR, y el navegador no siempre está de acuerdo.
   *
   * La tarjeta es `draggable` desde #60: soltarla en otra columna la mueve de
   * etapa. Un drag que empieza y termina sobre la misma tarjeta —soltar sin
   * moverse, o cancelar con Escape— puede terminar disparando `click`, y ahí
   * cada arrastre fallido abriría la ficha encima del tablero que se estaba
   * ordenando. La marca se levanta en el tick siguiente al `dragend`, que es
   * cuando el `click` ya pasó de largo.
   */
  const huboArrastre = useRef(false);
  const nombre = nombreDeTarjeta(c);
  const { turno, apremia } = turnoDeTarjeta(c);
  const curso = cursoDeTarjeta(c, { esDeCampana });
  /** «Ya te compró» — la misma marca que la fila de la cola (`dominio/cliente.ts`). En campaña, nada de la Escuela. */
  const marca = esDeCampana ? null : marcaDeCliente(c);
  const unClic = cotizarEnUnClic(c, { esDeCampana });
  // Precio y cotizar son de ventas: en campaña ni el chip ni el atajo, aunque la columna lo ofrezca.
  const precioEnviado = !esDeCampana && Boolean(c.precio_enviado);
  const onCotizar = esDeCampana ? undefined : onCotizarDeLaColumna;
  /**
   * 🔴 El dato YA VIAJABA en esta conversación y la tarjeta no lo miraba.
   * `GET /tablero` y `GET /` comparten `consultarCola`, así que cada tarjeta del
   * Pipeline llegaba con `bot_escalada` y `bot_temperatura` adentro desde que la
   * cola los sirve. La escalada se veía en Mensajes y no acá — o sea, en todos
   * lados menos donde se elige a quién tocar.
   *
   * `marcaDelBot` calla `tibio` y `frio` a propósito, y eso vale igual acá: son
   * tres de cada cuatro conversaciones, y una columna de 1.389 tarjetas con un
   * chip en casi todas no ayuda a elegir. Se leen en la ficha (`lecturaDelBot`),
   * que es donde ya elegiste y hay lugar.
   */
  const bot = marcaDelBot(c);
  const asignacion = conAsignacion ? marcaDeAsignacion(c) : null;
  /** El id del comentario, o `null` si la tarjeta es un chat. Prende sus pastillas (ADR 0121), igual que en la fila de la cola. */
  const idComentario = idDeComentario(c);
  /** La luz del filete: sin `luz` es gris, nunca se asume otro color (`tablero.ts#luzDeTarjeta`). */
  const luz = c.luz ?? 'gris';
  /**
   * El canal va AL LADO del nombre, en su color: encima del avatar tapaba las iniciales
   * (13-sep-2026, campaña; 14-sep, las dos mesas). Un formulario no tiene insignia
   * (`landing` no es una marca) y lo dice su propio chip en el segundo renglón.
   */
  const canalJuntoAlNombre = insigniaDe(c.canal, c.tipo);
  const horas = horasDesde(c.referencia);

  // El preview solo cuando la pelota es NUESTRA: si el último mensaje es el
  // nuestro, lo que se lee es la plantilla que mandamos — la misma en decenas de
  // tarjetas. Ahí el renglón no aporta y la tarjeta se calla.
  const preview =
    turno !== 'silencio'
      ? c.texto || etiquetaDeMedia(c.ultima_clase) || (c.ultima_origen?.fuente === 'anuncio' ? '📣 Vino del anuncio' : '')
      : '';

  /**
   * Cuánto le queda de ventana. Se recalcula en cada render y no se memoiza: el
   * dato ES el paso del tiempo, y un `useMemo` con `[c]` lo congelaría hasta que
   * la tarjeta cambie por otro motivo. Mismo criterio que `FilaConversacion`.
   */
  // 🔴 En campaña no hay reloj de arena (dueño, 13-sep-2026: «quítale el chip [⧗ 6 d]
  // a todo el pipeline, que quede el del hace tiempo»). Queda la antigüedad.
  const ventana = esDeCampana
    ? null
    : lecturaDeVentana(
        c.ventana_cierra,
        new Date(),
        // Misma regla que la fila de la cola: sin plazo que se cumpla, no hay cuenta
        // regresiva que dibujar (`plazoDuro`). `lineas` ya llegaba acá para el botón
        // de abrir chat — no hace falta ninguna prop nueva.
        plazoDuro(transporteDeLinea(lineas, c.numero_propio)),
      );

  /**
   * CUÁNTO LLEVA EN SU COLUMNA (`canales/antiguedad.ts`). Es el dato que separa a
   * dos tarjetas que la etapa iguala: la que recibió el precio hace 40 minutos y
   * la que lo recibió hace tres semanas y no contestó nunca.
   *
   * `yaVisible` es lo que ya dice el reloj de arriba: cuando los dos números
   * coinciden —el caso más común— la tarjeta se calla en vez de repetirse.
   * También sin memoizar: el dato ES el paso del tiempo.
   */
  const antiguedad = lecturaDeAntiguedad(c.etapa_desde, new Date(), {
    columna,
    yaVisible: haceCorto(horas),
  });

  const haySegundoRenglon = Boolean(
    // `landing` entra a la lista porque su píldora VIVE en ese renglón: un lead
    // sin curso ni preview no dibujaría el renglón, y entonces la marca que lo
    // distingue de un chat desaparecería justo en la tarjeta más pobre.
    // ⚠️ `bot` entra por el MISMO motivo que `landing`, y su ausencia era un
    // defecto: una conversación escalada sin curso, sin precio, sin ventana, sin
    // antigüedad y sin preview calculaba la marca y no dibujaba el renglón — el
    // chip desaparecía justo en la tarjeta más pobre, que es donde más falta hace.
    // ⚠️ `asignacion` entra por lo mismo que `bot` y `landing`: una tarjeta sin
    // ningún otro chip calcularía «Sin asignar» y no lo dibujaría nunca.
    // ⚠️ Un comentario entra por lo mismo: sus pastillas (ADR 0121) viven en ese
    // renglón. La de quién lo tiene abierto llega después y puede no dibujar nada,
    // así que el renglón lleva `empty:hidden` y no ocupa lugar si queda vacío.
    // El preview va en su propio renglón (arriba de éste), así que no cuenta acá.
    curso || bot || asignacion || precioEnviado || ventana || antiguedad || onCotizar || c.canal === 'landing' || idComentario !== null,
  );

  return (
    <div
      ref={elRef}
      draggable
      role={onFicha ? 'button' : undefined}
      tabIndex={onFicha ? 0 : undefined}
      aria-label={onFicha ? `Ver la ficha de ${nombre.texto}` : undefined}
      onClick={
        onFicha
          ? () => {
              if (huboArrastre.current) return;
              onFicha(c);
            }
          : undefined
      }
      onKeyDown={
        onFicha
          ? (e) => {
              // Solo cuando el foco está en la tarjeta misma: si no, Enter sobre
              // el botón de «Cotizado» abriría la ficha además de cotizar.
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onFicha(c);
              }
            }
          : undefined
      }
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        huboArrastre.current = true;
        alArrastrar(c);
      }}
      onDragEnd={() => {
        window.setTimeout(() => {
          huboArrastre.current = false;
        }, 0);
        alTerminar();
      }}
      data-luz={luz}
      className={
        // ⚠️ EL SEMÁFORO REEMPLAZÓ A `tempBorde` ACÁ (D1, 8-sep-2026): la luz dejó de
        // ser un filete de TEMPERATURA. Del 8 al 13-sep fue un degradado de fondo en
        // toda la tarjeta (`fondoSemaforo`) con el borde entero tintado; desde la
        // maqueta que eligió el dueño es otra vez un filete izquierdo, ahora de la
        // LUZ (`FILETE_DE_LUZ`): tarjeta blanca, el borde casi invisible y el color
        // sólo a la izquierda. Primero en campaña, desde el 14-sep en las dos mesas.
        'group cursor-grab rounded-xl border border-l-[3px] border-border bg-card py-2 pl-2.5 pr-2 shadow-[0_1px_2px_rgba(14,42,82,0.05)] transition-[box-shadow,opacity,transform] duration-200 ease-house hover:shadow-panel active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
        FILETE_DE_LUZ[luz] +
        ' ' +
        bordePropuestaSemaforo(c.origen_semaforo) +
        (arrastrando ? ' scale-[0.98] opacity-40' : '') +
        (rebotada ? ' ring-1 ring-temp-frio' : '') +
        // De cuál se está leyendo la ficha. Navy y no oro: acá no hay ningún
        // reloj corriendo, es solo «esta es la que estás mirando».
        (abierta ? ' ring-1 ring-navy' : '')
      }
    >
      {/* ── QUIÉN, Y DE QUIÉN ES EL TURNO ── */}
      <div className="flex items-center gap-2">
        <span className="relative shrink-0">
          <Avatar
            nombre={nombre.texto}
            telefono={c.canal === 'whatsapp' ? c.persona_id : null}
            numeroPropio={c.numero_propio}
            conFoto={conFoto}
            className="size-7 rounded-full bg-secondary text-[10px] font-bold text-navy-ink"
          />
        </span>

        <span className="flex min-w-0 flex-1 items-center gap-1">
          <span
            title={nombre.delFormulario ? `${nombre.texto} · del formulario` : nombre.texto}
            className={
              'min-w-0 truncate font-heading text-[13px] ' +
              (turno === 'silencio' ? 'font-medium text-foreground/85' : 'font-bold text-foreground')
            }
          >
            {nombre.texto}
          </span>
          {nombre.delFormulario && (
            <ClipboardList
              size={10}
              className="shrink-0 text-muted-foreground"
              aria-label="Nombre del formulario que llenó"
            />
          )}
          {canalJuntoAlNombre && (
            <span
              role="img"
              aria-label={canalJuntoAlNombre.nombre}
              title={canalJuntoAlNombre.nombre}
              className="flex shrink-0"
              style={{ color: canalJuntoAlNombre.color }}
            >
              <LogoDeCanal canal={canalJuntoAlNombre.logo} soloGlifo size={11} />
            </span>
          )}
        </span>

        {turno === 'vencido' ? (
          <span
            title={`El seguimiento que agendaste venció · ${hace(horas)}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gold/20 px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-gold-ink"
          >
            <AlarmClock size={11} /> venció
          </span>
        ) : (
          <span
            title={
              (turno === 'silencio' ? 'Le contestamos y no volvió · ' : 'Te está esperando · ') +
              hace(horas)
            }
            className={
              // Sin monoespaciada: «5 m» en mono le quitaba al nombre el ancho que lo
              // dejaba en «Javier Per…» (lo mostró la captura de campaña, 13-sep-2026).
              'inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums ' +
              (apremia ? 'font-bold text-temp-fresco' : tempClass(c.referencia))
            }
          >
            {turno === 'silencio' ? (
              <Check size={11} className="text-success" aria-label="le contestamos" />
            ) : (
              <ArrowLeft size={11} aria-label="te escribió" />
            )}
            {haceCorto(horas)}
          </span>
        )}

        {/* Lleva al chat, y con varias líneas corriendo pregunta primero por
            cuál. El menú y la regla de cuándo aparece viven en el componente:
            acá sería un `useState` más adentro de una tarjeta que se dibuja
            cientos de veces. */}
        <BotonAbrirChat c={c} lineas={lineas} onAbrir={onAbrir} />
      </div>

      {/* ── EL SEMÁFORO, EN PALABRAS (ADR 0095) ──
          La evidencia de la luz: por qué esta tarjeta se pintó así. Va en una
          línea bajo el nombre, alineada con él (pl-9, el mismo hueco que deja
          el avatar de size-7 + su gap-2). El `title` es el tooltip nativo —
          la frase completa al pasar el cursor, como pide el dueño («usemos
          los tooltips para comunicar»).
          ⚠️ Sólo cuando cuenta algo que la luz sola no dice (`porqueDestacable`):
          los tres porqués de relleno iban en el 90 % de las tarjetas de
          «Saben el precio» y «Contestaron» (medido el 10-sep-2026), y un renglón
          idéntico en miles de tarjetas es la lección de ADR 0016 con el preview.
          🔴 En campaña tampoco se dicen los de PRECIO (regla del dueño, 13-sep-2026). */}
      {porqueDestacable(c.porque, { esDeCampana }) && (
        <p
          title={c.porque ?? undefined}
          className="mt-0.5 truncate pl-9 text-[11.5px] text-muted-foreground"
        >
          {c.porque}
        </p>
      )}

      {/* EL PREVIEW TIENE SU RENGLÓN (la maqueta del dueño, 13-sep-2026): una línea gris
          y truncada, debajo del nombre. Metido entre los chips quedaba en «Ya no
          necesito qu…» al lado de la antigüedad, y en ventas ni se dibujaba cuando la
          tarjeta traía curso o precio — o sea, justo en las que más había que leer. */}
      {preview && (
        <p title={preview} className="mt-1 truncate pl-9 text-xs text-muted-foreground">
          {preview}
        </p>
      )}

      {/* ── DE QUÉ, Y QUÉ FALTA PARA COBRARLO ── */}
      {haySegundoRenglon && (
        /*
         * 🔴 `flex-wrap`, y no es cosmética: sin él los chips que no entraban se
         * CORTABAN EN SILENCIO. Con «Precio» y la ventana ya puestos, agregar el
         * del bot dejaba «Pr…» y el reloj a medias — o sea que la tarjeta perdía
         * un dato para mostrar otro, sin decirlo. Envolver es lo que esta tarjeta
         * ya declara que hace: «CRECE CON LO QUE TIENE QUE DECIR».
         *
         * Sólo cambia las tarjetas que YA estaban perdiendo información; una con
         * uno o dos chips se dibuja idéntica.
         */
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 pl-9 empty:hidden">
          {/*
            🔴 SIN CONVERSACIÓN — la marca que separa dos trabajos OPUESTOS que
            comparten columna. A quien te escribió le contestas y es gratis; a
            éste hay que ABRIRLE el chat en frío, que en las líneas whatsmeow es
            el camino corto al ban (regla dura #7). Sin esto las dos tarjetas se
            ven iguales y la vendedora no puede saber cuál es cuál.

            ⚠️ Va en el SEGUNDO renglón y no al lado del nombre: ahí la píldora
            se comía el nombre («A…», «L…») en una columna de 225 px, y el nombre
            es lo que identifica a la persona. Lo mostró la captura.

            Se decide por `canal` y no por el prefijo de la clave: el canal es el
            dato, la clave es plomería.
          */}
          {/*
            VA PRIMERO, y es lo único de esta fila de chips que pide una acción
            AHORA: una escalada es un lead sin bot y sin persona. Aparece poco
            —sólo escalada o caliente—, así que estar adelante no le quita lugar
            a nada en la tarjeta promedio.
          */}
          {bot && (
            <Chip
              icono={<Bot size={10} className="shrink-0" aria-hidden="true" />}
              tono={TONO_BOT[bot.tono]}
              titulo={bot.titulo}
            >
              {bot.texto}
            </Chip>
          )}
          {/* ¿Ya está respondido? ¿Quién lo tiene abierto? Sólo en comentarios, las mismas pastillas que la cola (ADR 0121). */}
          {idComentario !== null && c.respondida && <PastillaRespondido en="tarjeta" />}
          {idComentario !== null && <PastillaTieneAbierto interactionId={idComentario} en="tarjeta" />}
          {c.canal === 'landing' && (
            <Chip
              tono="neutro"
              titulo="Llenó el formulario y todavía no existe conversación: hay que abrirla"
            >
              Formulario
            </Chip>
          )}
          {/*
            «CLIENTE» — el chip que ANTES no estaba en el Pipeline, y por eso
            este cambio no se podía hacer sin él.
            🔴 Hasta el 9-set-2026 «ya compró» era una LUZ VERDE del semáforo, y
            era el 79 % de los verdes (2.542 de 3.272): en una campaña a alumnos
            pintaba la lista entera por construcción y escondía a los ~24 que sí
            preguntaron el precio. Sacarla de la luz es correcto —haber comprado
            antes no es intención de comprar hoy— pero el dato NO se puede
            perder: es el lead más barato de convertir que hay. En la cola ya lo
            decía esta misma píldora (`FilaConversacion`); acá no existía, así
            que sacar la luz sin agregar el chip le habría quitado el dato al
            Pipeline en vez de dejar de repetirlo.
            Mismo `marcaDeCliente` que la fila: una sola definición de qué se
            dice, para que las dos pantallas no puedan decir cosas distintas.
          */}
          {marca && (
            <Chip
              tono="verde"
              icono={<BadgeCheck size={10} className="shrink-0" />}
              titulo={marca.titulo}
            >
              {marca.texto}
            </Chip>
          )}
          {curso && (
            <Chip
              tono="marca"
              encoge
              // El icono dice DE DÓNDE salió el curso, que es lo que decide
              // cuánto vale: birrete = lo asentó la vendedora · portapapeles = lo
              // eligió ella en el formulario · megáfono = solo es el anuncio por
              // el que entró. El `title` lo dice con todas las letras.
              icono={
                curso.fuente === 'interes' ? (
                  <GraduationCap size={10} className="shrink-0" />
                ) : curso.fuente === 'lead' ? (
                  <ClipboardList size={10} className="shrink-0" />
                ) : (
                  <Megaphone size={10} className="shrink-0" />
                )
              }
              titulo={detalleDeCurso(curso)}
            >
              {curso.nombre}
            </Chip>
          )}
          {precioEnviado && (
            <Chip
              icono={<BadgeDollarSign size={10} className="shrink-0" />}
              titulo="Ya le mandaste el precio o la forma de pagar"
            >
              Precio
            </Chip>
          )}
          {/*
            LA VENTANA, EN TODAS LAS COLUMNAS (ADR 0041). No alcanza con el chip
            de recorte de Contactados: el caso que más vale del tablero es un
            COTIZADO con la ventana abierta —sabe el precio Y se le puede
            escribir gratis ahora—, y esa columna no tiene recorte. La píldora lo
            dice sin filtrar nada.

            Misma lectura que la fila de la cola (`dominio/ventana.ts`), así que
            «6 h» significa lo mismo en las dos pantallas. Escala de tres
            colores (20-ago-2026) — ya no oro, ver el porqué en `Chip`.
          */}
          {ventana && (
            <Chip
              /* RELOJ DE ARENA, no reloj: es lo único de la tarjeta que cuenta
                 hacia ATRÁS. La fila de la cola usa el mismo (`FilaConversacion`),
                 porque es la misma señal — con dos íconos para un mismo dato,
                 quien aprende uno no reconoce el otro. */
              icono={<Hourglass size={10} className="shrink-0" />}
              titulo={`${ventana.ayuda} — sin pagar una plantilla`}
              tono={ventana.color}
            >
              {ventana.texto}
            </Chip>
          )}
          {/*
            CUÁNTO LLEVA EN LA COLUMNA. Sin oro a propósito (`canales/antiguedad.ts`):
            el oro significa «tiempo que se acaba» y acá no hay ningún plazo
            corriendo — una conversación vieja no vence, se enfría. Va en tinta
            neutra, con el reloj de HISTORIAL — que la distingue del reloj de
            ARENA de la ventana, justo al lado, que sí es una cuenta regresiva.
          */}
          {/*
            A QUIÉN ESTÁ ASIGNADA — sólo para quien supervisa. Neutro y sin oro:
            no apura nada, dice de quién es. «Sin asignar» va con el contorno
            PUNTEADO, la forma que la casa ya usa para «esto no lo tiene nadie
            todavía» (`dominio/origen.ts`), y mide lo mismo que la píldora llena
            (borde + `py-px` en las dos) para que la tarjeta no salte de alto.
            La dueña va a la izquierda y la antigüedad al extremo derecho, en una
            píldora clara: el orden de la maqueta (13-sep-2026).
          */}
          {asignacion && <PildoraAsignacion marca={asignacion} />}
          {antiguedad && (
            <Chip icono={<History size={10} className="shrink-0" />} titulo={antiguedad.ayuda} tono="suave" alFinal>
              {antiguedad.texto}
            </Chip>
          )}
          {onCotizar && (
            <button
              type="button"
              disabled={cotizando}
              onClick={(e) => {
                e.stopPropagation();
                onCotizar(c);
              }}
              title={
                unClic
                  ? `Marcar que ya sabe el precio de «${unClic.etiqueta}»`
                  : 'Marcar que ya sabe el precio — te va a pedir el curso'
              }
              // Quieta por defecto: son 611 tarjetas con este botón y 611 CTAs
              // gritando son ruido. Se enciende al pasar por encima.
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-px text-[11px] font-bold text-primary/70 transition-[background-color,color,transform] duration-200 ease-house group-hover:bg-primary/10 group-hover:text-primary focus-visible:bg-primary/10 focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.97] disabled:opacity-50"
            >
              {cotizando ? <Loader2 size={10} className="animate-spin" /> : <GraduationCap size={10} />}
              {/* El botón es un ATAJO a la columna, así que dice el nombre de la
                  columna en singular — no un verbo que no está en ningún lado. */}
              Sabe el precio
            </button>
          )}
        </div>
      )}
    </div>
  );
}
