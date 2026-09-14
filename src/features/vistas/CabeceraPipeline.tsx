import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { insigniaDe, LogoDeCanal } from '../../components/BadgeCanal';
import { ayudaDeCanal, TODOS_LOS_CANALES, type CanalDeLaMesa } from './canalDeMesa';
import { cifra, SEMAFORO_META } from '../../lib/formato';
import { DIAS_DE_LA_COLA } from './franja';
import { hayRango, type RangoDeMesa } from './mesa';
import { leyendaDelTablero, type OpcionDeLeyenda, type ResumenTablero } from './resumen';
import type { Recorte, RecorteSemaforo } from './tablero';

/**
 * LA FILA DE ARRIBA DEL PIPELINE — lo que se trabaja, en una línea.
 *
 * 🔴 **Acá no hay KPIs, y es a propósito.** El dueño partió las pantallas el
 * 10-sep-2026: lo que se TRABAJA vive en el Pipeline y lo que se MIDE en el
 * Dashboard, y ninguna cifra vive en los dos. Esta fila dice sólo lo que le
 * sirve a quien va a atender: cuántas conversaciones son nuevas hoy y de qué
 * tamaño es la mesa,
 * qué rango se está mirando, y el semáforo — que acá no es un número para mirar
 * sino un RECORTE para tocar.
 *
 * ⚠️ **La leyenda recorta LA MESA**: tocar «Verdes 278» deja sólo verdes en las
 * cinco columnas a la vez. Mientras está puesta, las columnas no ofrecen su
 * propio recorte (`VistaEmbudo`): un eje por vez, igual que franja y recorte
 * adentro de una columna.
 *
 * Qué se cuenta vive en `resumen.ts` (puro, con tests); qué convive con qué, en
 * `mesa.ts`. Acá sólo se dibuja.
 */

/**
 * EL RANGO — la misma franja en las cinco columnas (`franjaEn=*`, #946), sobre el
 * último mensaje de cada conversación. «30 d» es lo que la cola ya mira y no
 * manda franja.
 *
 * ⚠️ **Con un server que no publica `recortesDisponibles`, «Hoy» y «7 d» se ven
 * apagados y dicen por qué**: ahí `*` se leería como una columna que no existe, y
 * el tablero entero daría 400. `aria-disabled` y no `disabled`: un botón
 * `disabled` no recibe el mouse, y entonces tampoco muestra el `title` que
 * explica por qué no se puede tocar.
 */
const RANGOS: readonly { id: RangoDeMesa; rotulo: string; ayuda: string; alcance: string }[] = [
  {
    id: 'hoy',
    rotulo: 'Hoy',
    ayuda: 'Sólo las conversaciones con algún mensaje de hoy, en todas las columnas',
    alcance: 'con mensajes hoy',
  },
  {
    id: 'd7',
    rotulo: '7 d',
    ayuda: 'Sólo las conversaciones con algún mensaje en los últimos 7 días, en todas las columnas',
    alcance: 'con mensajes en 7 días',
  },
  {
    id: 'cola',
    rotulo: `${DIAS_DE_LA_COLA} d`,
    ayuda: `Todo lo que mira el tablero: los últimos ${DIAS_DE_LA_COLA} días`,
    alcance: `en ${DIAS_DE_LA_COLA} días`,
  },
];

/**
 * ══ LOS CANALES — la fila de íconos que recorta la mesa (13-sep-2026; ══
 * ampliada a ventas el mismo día)
 *
 * Qué se ofrece y qué viaja lo decide `canalDeMesa.ts`; acá sólo se dibuja. Es un
 * segmentado, como el rango de al lado: siempre hay uno puesto, y «Todos» es la
 * suma, no la ausencia de filtro escondida. Nació sólo para campaña; ventas la
 * recibe con la MISMA lista de `opciones` que le pasa `VistaEmbudo`, más el par
 * Formulario que campaña no ofrece — este componente no distingue módulos, sólo
 * dibuja lo que le llega.
 *
 * 🔴 **DOS GRUPOS EN UNA FILA, separados por un filete**: MENSAJES (WhatsApp,
 * Instagram, Messenger) y COMENTARIOS (Facebook, Instagram). Y el comentario se
 * dibuja HUECO —un aro del color de la marca— y el mensaje sin aro: es la
 * convención de la casa para ese mismo par (`BadgeCanal`: «lleno = te escribieron ·
 * hueco = lo escribieron en público»). Sin eso, «Mensajes de Instagram» y
 * «Comentarios de Instagram» serían el mismo glifo dos veces.
 *
 * ⚠️ **Y EN VENTAS, UN TERCER GRUPO** (`grupo: 'formulario'`, sólo si `opciones`
 * lo trae): un formulario no es un DM ni algo público, así que no entra a
 * ninguno de los otros dos — otro filete, y sin aro ni disco (no es una marca).
 *
 * ⚠️ **El ícono apagado conserva su color de marca**, más tenue, y no se pasa a
 * gris: un glifo de WhatsApp en gris se lee como «WhatsApp roto», no como «no
 * elegido» — lo mostró la primera captura del riel de Mensajes
 * (`canales/RielDeCanales.tsx`). Encendido, el disco se llena con el color de la
 * marca y la tinta que ese color pide (`insigniaDe`): sobre el verde de WhatsApp
 * el blanco da 1,98:1. «Todos» y «Formulario», que no son una marca, van en el
 * navy de la casa.
 *
 * ⚠️ **Con el canal del puente puesto no se enciende ninguno**: la mesa la acota
 * el chip «Canal: …» de al lado, y tocar un ícono lo reemplaza.
 */
function FiltroDeCanal({
  opciones,
  elegido,
  onElegir,
}: {
  opciones: readonly CanalDeLaMesa[];
  elegido: string | null;
  onElegir: (id: string) => void;
}) {
  const boton = (c: CanalDeLaMesa) => {
    // Color, logo y tinta del PAR canal · tipo: la fuente única de `BadgeCanal`.
    // `insignia` es `null` para Formulario (`landing` no es una marca): ahí
    // `LogoDeCanal` recibe el canal crudo y dibuja su propio trazo de la casa
    // en vez de quedarse sin ícono (antes de Formulario, `insignia` siempre
    // existía para todo lo que esta fila ofrecía, así que este `??` no cambia
    // ningún ícono de campaña).
    const insignia = insigniaDe(c.canal, c.tipo ?? undefined);
    return (
      <BotonDeCanal
        key={c.id}
        rotulo={c.label}
        nombre={c.corto}
        ayuda={ayudaDeCanal(c)}
        marca={insignia ? { color: insignia.color, tinta: insignia.tinta } : undefined}
        publico={c.tipo === 'comentario'}
        activo={elegido === c.id}
        onElegir={() => onElegir(c.id)}
      >
        <LogoDeCanal canal={insignia?.logo ?? c.canal} soloGlifo size={12} />
      </BotonDeCanal>
    );
  };
  const mensajes = opciones.filter((c) => c.grupo === 'mensajes');
  const comentarios = opciones.filter((c) => c.grupo === 'comentarios');
  // Sólo en ventas (`canalDeMesa.ts#FORMULARIO`): un lead de landing no es un
  // mensaje ni un comentario, así que no entra en ninguno de los dos grupos.
  const formulario = opciones.filter((c) => c.grupo === 'formulario');
  return (
    <div role="group" aria-label="Canal" className="flex items-center gap-0.5 rounded-full border border-border p-0.5">
      <BotonDeCanal
        rotulo="Todos"
        nombre="Todos"
        ayuda="Todos los canales juntos: mensajes y comentarios"
        activo={elegido === TODOS_LOS_CANALES}
        onElegir={() => onElegir(TODOS_LOS_CANALES)}
      >
        {/* Una cuadrícula, como «Todos» en el riel: la SUMA de los canales. */}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="8" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
          <rect x="13" y="13" width="8" height="8" rx="2" />
        </svg>
      </BotonDeCanal>
      <span aria-hidden className="mx-0.5 h-3.5 w-px bg-border" />
      <div role="group" aria-label="Mensajes" className="flex items-center gap-0.5">
        {mensajes.map(boton)}
      </div>
      {comentarios.length > 0 && (
        <>
          <span aria-hidden className="mx-0.5 h-3.5 w-px bg-border" />
          <div role="group" aria-label="Comentarios" className="flex items-center gap-0.5">
            {comentarios.map(boton)}
          </div>
        </>
      )}
      {formulario.length > 0 && (
        <>
          <span aria-hidden className="mx-0.5 h-3.5 w-px bg-border" />
          <div role="group" aria-label="Formulario" className="flex items-center gap-0.5">
            {formulario.map(boton)}
          </div>
        </>
      )}
    </div>
  );
}

function BotonDeCanal({
  rotulo,
  nombre,
  ayuda,
  marca,
  publico = false,
  activo,
  onElegir,
  children,
}: {
  /** El `aria-label`: único, porque hay dos Instagram. */
  rotulo: string;
  /**
   * Lo que se lee al lado del logo cuando está ELEGIDO (la maqueta del dueño): la
   * píldora activa dice qué canal se está mirando, y las demás sólo muestran el logo.
   */
  nombre?: string;
  /** El `title`: qué trae ese ícono. */
  ayuda: string;
  /** Sin marca, el navy de la casa («Todos»). */
  marca?: { color: string; tinta: string };
  /** Un COMENTARIO: apagado se dibuja con un aro del color de la marca (hueco = en público). */
  publico?: boolean;
  activo: boolean;
  onElegir: () => void;
  children: ReactNode;
}) {
  const estilo = marca
    ? activo
      ? { backgroundColor: marca.color, color: marca.tinta }
      : { color: marca.color, ...(publico ? { boxShadow: `inset 0 0 0 1.5px ${marca.color}` } : {}) }
    : undefined;
  return (
    <button
      type="button"
      aria-label={rotulo}
      aria-pressed={activo}
      title={ayuda}
      onClick={onElegir}
      style={estilo}
      className={
        // `h-5`: con la fila de canales, a 1280 «Tablero · Lista» y «Atender
        // siguiente» bajaban a un segundo renglón (lo mostró la captura). Sólo la
        // ELEGIDA se ensancha para decir su nombre; las demás siguen de 20 px.
        'flex h-5 items-center justify-center rounded-full transition-[background-color,color,opacity] duration-200 ease-house focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
        (activo && nombre ? 'gap-1 pl-1 pr-1.5 ' : 'w-5 ') +
        (activo
          ? marca
            ? ''
            : 'bg-navy text-white'
          : (marca ? '' : 'text-navy-ink ') + 'opacity-60 hover:bg-secondary hover:opacity-100')
      }
    >
      {children}
      {activo && nombre && <span className="whitespace-nowrap text-[11px] font-semibold leading-none">{nombre}</span>}
    </button>
  );
}

export function CabeceraPipeline({
  resumen,
  recorte,
  onRecorte,
  rango,
  onRango,
  rangoDisponible,
  totalDelRango,
  recorteDelDia,
  cargando,
  pista,
  acciones,
  linea,
  canal,
  canales,
  desgloseDelRango = false,
}: {
  /**
   * ¿El desglose ya es del rango puesto (`mesaPorCanal`, campaña)? Entonces la
   * leyenda cuenta lo mismo que se ve y deja de avisar «En 30 d:». Ausente = el
   * desglose de siempre, de 30 días.
   */
  desgloseDelRango?: boolean;
  /**
   * La fila de íconos de canal (`canalDeMesa.ts`): campaña y, desde el
   * 13-sep-2026, también ventas — con su propia lista de `opciones`
   * (`canalesDeLaMesa('ventas')`, que además incluye Formulario). `elegido: null`
   * = manda el canal del puente, y no se enciende ninguno. Ausente = no se dibuja.
   */
  canales?: { opciones: readonly CanalDeLaMesa[]; elegido: string | null; onElegir: (id: string) => void } | null;
  resumen: ResumenTablero;
  /** El recorte de la mesa: una luz, un recorte del día, o `todas`. */
  recorte: Recorte;
  /** Tocar la luz activa la apaga: quien llama decide, esto sólo avisa cuál se tocó. */
  onRecorte: (luz: RecorteSemaforo) => void;
  rango: RangoDeMesa;
  onRango: (rango: RangoDeMesa) => void;
  /** ¿El server sabe mirar un rango en todas las columnas? (`recortesDisponibles`, #946). */
  rangoDisponible: boolean;
  /**
   * Con «Hoy» o «7 d» puesto, cuántas conversaciones tienen mensajes en el rango:
   * lo que sirvió cada columna, sumado. `null` con «30 d», donde manda el desglose.
   */
  totalDelRango: number | null;
  /**
   * El recorte del día puesto en la mesa (hoy lo trae el puente del Dashboard),
   * con su ✕. Sin chip sería una mesa más chica sin ninguna explicación.
   * `n` = cuántas deja (lo que sirvieron las columnas); `null` mientras carga.
   */
  recorteDelDia?: { nombre: string; n: number | null; onQuitar: () => void } | null;
  cargando: boolean;
  /** Mientras se arrastra, explica las compuertas en lugar de la cobertura. */
  pista?: ReactNode;
  /** El conmutador de vista y «Atender siguiente». */
  acciones?: ReactNode;
  /**
   * La línea que acota el tablero entero (el puente del Dashboard). Se ve como un
   * chip con su ✕: un filtro que llega de otra pantalla y no se ve acá sería un
   * tablero más chico sin ninguna explicación.
   */
  linea?: { etiqueta: string; onQuitar: () => void } | null;
  /** El canal que acota el tablero (los DMs que no entraron por ninguna línea). Mismo chip que la línea. */
  canal?: { etiqueta: string; onQuitar: () => void } | null;
}) {
  return (
    <section
      aria-label="Resumen del tablero"
      // `gap-x-3` y no 4 desde que entró la fila de canales: a 1280 los grupos no
      // entraban en un renglón y las acciones bajaban solas (lo mostró la captura).
      // Con la fila de canales, `gap-x-2`: la píldora elegida dice su nombre, y medido
      // a 1280 la fila pedía 1.285 px de 1.256 — «Atender siguiente» bajaba de renglón.
      className={
        'mb-2 flex min-h-8 shrink-0 flex-wrap items-center gap-y-2 px-1 ' + (canales ? 'gap-x-2' : 'gap-x-3')
      }
    >
      {/* El canal va PRIMERO: todas las cifras de la fila —y las de las columnas—
          son de ese canal, así que se lee antes que ellas. */}
      {canales && (
        <>
          <FiltroDeCanal opciones={canales.opciones} elegido={canales.elegido} onElegir={canales.onElegir} />
          <Separador />
        </>
      )}
      {pista ?? <Cobertura resumen={resumen} cargando={cargando} rango={rango} totalDelRango={totalDelRango} />}
      <Separador />
      <Rango rango={rango} onRango={onRango} disponible={rangoDisponible} />
      {linea && (
        <ChipDeAlcance
          rotulo="Línea"
          etiqueta={linea.etiqueta}
          quitar={`Quitar la línea ${linea.etiqueta}`}
          onQuitar={linea.onQuitar}
        />
      )}
      {canal && (
        <ChipDeAlcance
          rotulo="Canal"
          etiqueta={canal.etiqueta}
          quitar={`Quitar el canal ${canal.etiqueta}`}
          onQuitar={canal.onQuitar}
        />
      )}
      {recorteDelDia && (
        <ChipDeAlcance
          // La cifra va en el chip que la nombra, como «Verdes 278» en la leyenda.
          etiqueta={`${recorteDelDia.nombre.charAt(0).toUpperCase()}${recorteDelDia.nombre.slice(1)}${
            recorteDelDia.n != null ? ` · ${cifra(recorteDelDia.n)}` : ''
          }`}
          quitar={`Quitar el recorte «${recorteDelDia.nombre}»`}
          onQuitar={recorteDelDia.onQuitar}
        />
      )}
      {/* Sin desglose (N4 antes que N5) no hay luces que contar: la leyenda
          calla en vez de decir cuatro ceros que no son ciertos. */}
      {!cargando && resumen.hayDetalle && (
        <>
          <Separador />
          <Leyenda
            opciones={leyendaDelTablero(resumen, recorte)}
            activo={recorte}
            onTocar={onRecorte}
            deTreintaDias={hayRango(rango) && !desgloseDelRango}
          />
        </>
      )}
      {acciones && <div className="ml-auto flex items-center gap-2">{acciones}</div>}
    </section>
  );
}

/**
 * UN ALCANCE QUE LLEGÓ DE OTRA PANTALLA (la línea, el canal o el recorte del día
 * del puente del Dashboard), con su ✕. Se ve siempre: un filtro que llega de
 * afuera y no se ve acá es un tablero más chico sin ninguna explicación.
 */
function ChipDeAlcance({
  rotulo,
  etiqueta,
  quitar,
  onQuitar,
}: {
  /** «Línea», «Canal». Sin rótulo, la etiqueta ya dice qué es. */
  rotulo?: string;
  etiqueta: string;
  /** El `aria-label` del ✕: dice QUÉ se quita, no sólo «quitar». */
  quitar: string;
  onQuitar: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-navy/30 bg-secondary py-0.5 pl-2.5 pr-1 text-[11px] font-semibold text-foreground">
      {rotulo ? `${rotulo}: ${etiqueta}` : etiqueta}
      <button
        type="button"
        aria-label={quitar}
        onClick={onQuitar}
        className="rounded-full p-0.5 text-muted-foreground transition-colors duration-200 ease-house hover:bg-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <X size={11} />
      </button>
    </span>
  );
}

/**
 * Un hairline vertical entre grupos. En angosto la fila envuelve y sobra. Si
 * queda PRIMERO (la cobertura calla con un rango y un recorte del día puestos),
 * tampoco: sería una raya colgando al borde de la fila.
 */
function Separador() {
  return <span aria-hidden className="hidden h-4 w-px bg-border sm:block sm:first:hidden" />;
}

/**
 * «1.800 nuevas hoy · 12.531 en 30 días». Sin `nacioHoy` en el desglose (un
 * server que todavía no lo cuenta) queda la frase de siempre, sin un «0 hoy»
 * que se leería como un día sin leads.
 *
 * 🔴 **«Nuevas» y no «llegaron»**: nacer hoy incluye la difusión del día —las
 * conversaciones que abrimos nosotros—, y el Dashboard dice «escribieron por
 * primera vez hoy» con otro predicado (`escribioHoy`). Con la misma palabra en
 * las dos pantallas, 1.800 y 450 se leerían como una contradicción.
 *
 * Con un rango puesto, el tamaño es el del RANGO («3.200 con mensajes hoy») y
 * sale de lo que sirvió cada columna, porque el desglose no se recorta por él.
 * «Nuevas hoy» sigue siendo cierto con cualquier rango: una conversación que
 * nació hoy tiene mensajes de hoy.
 *
 * ⚠️ **Con un rango Y un recorte del día puestos, el tamaño se calla**
 * (`totalDelRango` llega `null`): el server sólo devuelve la intersección, y
 * escrita acá se leía como el tamaño del rango. Esa cifra va en el chip del
 * recorte.
 */
function Cobertura({
  resumen,
  cargando,
  rango,
  totalDelRango,
}: {
  resumen: ResumenTablero;
  cargando: boolean;
  rango: RangoDeMesa;
  totalDelRango: number | null;
}) {
  if (cargando) return <span className="h-3 w-44 animate-pulse rounded bg-secondary" />;
  const { nuevasHoy } = resumen;
  const conTamano = !hayRango(rango) || totalDelRango != null;
  if (!conTamano && nuevasHoy == null) return null;
  const total = hayRango(rango) ? (totalDelRango ?? 0) : resumen.total;
  const alcance = RANGOS.find((r) => r.id === rango)?.alcance ?? '';
  return (
    <p className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
      {nuevasHoy != null && (
        <>
          <span title="Conversaciones que empezaron hoy: las que te escribieron y las que abriste tú">
            <span className="font-heading text-sm font-bold text-foreground">{cifra(nuevasHoy)}</span>{' '}
            {nuevasHoy === 1 ? 'nueva' : 'nuevas'} hoy
          </span>
          {conTamano && (
            <span aria-hidden className="text-muted-foreground/50">
              ·
            </span>
          )}
        </>
      )}
      {conTamano && (
        <span title={hayRango(rango) ? 'Las conversaciones del tablero cuyo último mensaje cae en el rango' : undefined}>
          <span className="font-semibold text-foreground">{cifra(total)}</span>{' '}
          {nuevasHoy != null || hayRango(rango)
            ? alcance
            : `${total === 1 ? 'conversación' : 'conversaciones'} · últimos ${DIAS_DE_LA_COLA} días`}
        </span>
      )}
    </p>
  );
}

function Rango({
  rango,
  onRango,
  disponible,
}: {
  rango: RangoDeMesa;
  onRango: (rango: RangoDeMesa) => void;
  disponible: boolean;
}) {
  return (
    <div role="group" aria-label="Rango" className="flex rounded-full border border-border p-0.5">
      {RANGOS.map((r) => {
        const activo = r.id === rango;
        const apagado = !disponible && r.id !== 'cola';
        return (
          <button
            key={r.id}
            type="button"
            aria-pressed={activo}
            aria-disabled={apagado || undefined}
            onClick={apagado ? undefined : () => onRango(r.id)}
            title={
              apagado
                ? `Todavía no: el tablero sólo sabe mirar los últimos ${DIAS_DE_LA_COLA} días. «${r.rotulo}» llega cuando el server acepte el rango en todas las columnas.`
                : r.ayuda
            }
            className={
              'rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors duration-200 ease-house focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
              (activo
                ? 'bg-navy text-white'
                : apagado
                  ? 'cursor-not-allowed text-muted-foreground/60'
                  : 'text-muted-foreground hover:text-foreground')
            }
          >
            {r.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/**
 * LA LEYENDA DEL SEMÁFORO, que es también su filtro. Se dibuja entera siempre;
 * la luz que no recortaría nada queda como texto, no como botón. El color va en
 * el punto (`--sem-*`), nunca en la letra.
 *
 * ⚠️ **Con «Hoy» o «7 d» puesto, las luces siguen contando 30 días** —el desglose
 * no se recorta por el rango (#946)— y eso se DICE en la fila: sin el «En 30 d»,
 * «Verdes 278» se leería como las verdes de hoy. Tocar una recorta lo que se
 * ve EN el rango puesto y no lo cambia (`mesa.ts`, 11-sep-2026): el número es de
 * 30 días, y el rótulo es lo que impide que se lea como el tamaño de la lista.
 */
function Leyenda({
  opciones,
  activo,
  onTocar,
  deTreintaDias,
}: {
  opciones: readonly OpcionDeLeyenda[];
  activo: Recorte;
  onTocar: (luz: RecorteSemaforo) => void;
  deTreintaDias: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={deTreintaDias ? `Semáforo de los últimos ${DIAS_DE_LA_COLA} días` : 'Semáforo'}
      className="flex flex-wrap items-center gap-1.5"
    >
      {deTreintaDias && (
        <span
          className="text-[11px] font-semibold text-muted-foreground"
          title={`Los números cuentan los últimos ${DIAS_DE_LA_COLA} días, no el rango puesto. Tocar una luz recorta lo que ves en el rango.`}
        >
          En {DIAS_DE_LA_COLA} d:
        </span>
      )}
      {opciones.map((o) => {
        const esActiva = activo === o.luz;
        const interior = (
          <>
            <span aria-hidden className={'size-2 shrink-0 rounded-full ' + SEMAFORO_META[o.luz].bar} />
            {o.label}
            <span className="tabular-nums">{cifra(o.n)}</span>
          </>
        );
        const clases =
          'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors duration-200 ease-house ';
        if (!o.clicable) {
          return (
            <span key={o.luz} title={o.ayuda} className={clases + 'border-transparent text-muted-foreground'}>
              {interior}
            </span>
          );
        }
        return (
          <button
            key={o.luz}
            type="button"
            aria-pressed={esActiva}
            title={o.ayuda}
            onClick={() => onTocar(o.luz)}
            className={
              clases +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
              (esActiva
                ? 'border-navy bg-navy text-white'
                : 'border-border text-muted-foreground hover:border-navy/40 hover:text-foreground')
            }
          >
            {interior}
          </button>
        );
      })}
    </div>
  );
}
