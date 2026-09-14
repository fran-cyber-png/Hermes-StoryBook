import { useState, type ReactNode } from 'react';
import { AtSign, CalendarDays, Check, Copy, Flag, GraduationCap, Link2, Mail, Pencil, Tag } from 'lucide-react';
import type { ResumenCompras } from '../cerberus/ficha';
import { PildoraCanal } from '../../components/BadgeCanal';
import { Avatar } from '../../components/Avatar';
import { Bandera } from '../../components/Bandera';
import type { PaisDelContacto } from '../../dominio/pais';
import { quiereFoto } from '../../dominio/fotoVisible';
import { ETAPA_CHIP, rotuloEtapa } from '../../lib/etapas';
import { rotuloDelMotivo } from '../../lib/motivosDePerdida';
import {
  CLASE_FONDO,
  CLASE_TEXTO,
  claseBorde,
  resolverColor,
} from '../../dominio/paletaCategorias';
import type { AcentoContacto } from './estadoContacto';
import { ResumenIa } from './ResumenIa';

export interface MetaContacto {
  origen: string;
  /**
   * EL PORQUÉ DEL «ORIGEN» — el `title` de esa celda (`dominio/origen.ts`).
   *
   * No es decoración: la celda muestra dos palabras y la que más se va a leer
   * es «Sin origen», que sin explicación se entiende como «no vino de pauta».
   * Son cosas distintas, y confundirlas es lo que dejó a un lead de anuncio
   * recibiendo un saludo genérico el 6-sep-2026.
   */
  ayudaOrigen?: string;
  /**
   * CÓMO SE LLAMA EL SEGUNDO PAR — «Campaña» por defecto, y no siempre.
   *
   * 🔴 Estaba clavado en «Campaña» y por eso afirmaba de más: con el anuncio
   * sin resolver contra Meta —el 60 % de los leads de pauta— lo que caía en esa
   * celda era el TITULAR del creativo, presentado como si fuera el nombre de
   * una campaña. Quien elige el rótulo es `metaDeContacto.ts`, que es quien
   * sabe qué dato consiguió.
   */
  rotuloCampana?: string;
  campana: string;
  primerContacto: string;
}

interface PropsEncabezado {
  /**
   * ⚠️ **`iniciales` se retiró: eran DOS algoritmos para el mismo dato.** Este
   * encabezado recibía las iniciales ya calculadas por `PanelDerecho` (un
   * `split` propio) mientras `components/Avatar.tsx` tiene su `iniciales()`, que
   * es la que usan la fila de la cola y la tarjeta del Pipeline. Con dos, la
   * misma persona podía abreviarse distinto en dos pantallas — y de hecho el
   * `Avatar` maneja casos que la copia no (nombre vacío, una sola palabra).
   */
  nombre: string;
  telefono: string;
  canal: string;
  /** Para la píldora de canal: un comentario público no es un directo (ADR 0078). */
  tipoDeFila?: string;
  /**
   * EL TELÉFONO CRUDO — para la FOTO de perfil, no para mostrarlo (`telefono`
   * ya viene formateado). Sin él se dibujan las iniciales, como siempre.
   */
  telefonoCrudo?: string | null;
  /** La línea por la que entró: sin esto la foto se pide por la primera línea
   *  armada, y con dos líneas whatsmeow eso filtra la foto de un contacto de una
   *  cuenta hacia la otra (docblock de `Avatar`). */
  numeroPropio?: string | null;
  acento: AcentoContacto;
  tituloEstado: string;
  compras: ResumenCompras | null;
  chips: string[];
  /**
   * LA ETAPA DEL EMBUDO, la efectiva que ya dice el server (ADR 0013).
   *
   * 🔴 **Viajaba en `Conversacion` y este panel no la leía nunca** (`grep
   * etapa_efectiva src/features/panel/` daba cero). No es un olvido cosmético:
   * `BarraGestion` —el único lugar que la dibuja— se monta SÓLO en
   * `ConversacionActiva`, o sea en el chat. En el Pipeline y en el padrón, donde
   * este mismo panel se abre como hoja (`HojaContacto`), la etapa no se veía en
   * ninguna parte de la pantalla.
   *
   * ⚠️ Acá se MUESTRA, no se declara: cambiarla sigue siendo de la barra del
   * chat, que es la que tiene las compuertas del server y la confirmación de
   * `perdido`. Dos lugares que la escriban serían dos vocabularios en dos meses.
   *
   * ⚠️ Opcional: ausente = server viejo o respuesta rehidratada del caché
   * (ADR 0007), y ahí no se dibuja nada — como antes de este frente.
   */
  etapa?: string | null;
  /**
   * POR QUÉ SE PERDIÓ (ADR 0107): la pérdida vigente, que sólo se lee con `etapa: perdido`.
   * El motivo va al lado de «Dijo que no» y el detalle, al pasar el mouse. Ausente o sin
   * motivo = sólo la etapa, como antes: no se inventa uno.
   */
  perdida?: { motivo: string | null; detalle: string | null } | null;
  /**
   * LAS ETIQUETAS ASIGNADAS, de solo lectura y con el color del catálogo del
   * módulo de quien mira (ADR 0078). Mismo argumento que la etapa: en dos de los
   * tres lugares donde vive este panel no existe la barra que las pone.
   */
  etiquetas?: readonly string[];
  /** El catálogo con color. Sin él las píldoras salen neutras, nunca sin dibujarse. */
  categorias?: readonly { nombre: string; color: string }[];
  /**
   * LA TARJETA DE IDENTIDAD — lo que antes vivía en la pestaña «Datos» (dueño,
   * 13-sep-2026: «ya no existirá, lo pondremos de forma elegante arriba: 1
   * número, 1 correo, 1 nombre, 1 país»). Todo viene resuelto: este componente
   * dibuja, no decide precedencias.
   *
   * Opcional: sin ella se dibuja la cabecera de siempre (la galería vieja, un
   * uso suelto).
   */
  identidad?: IdentidadDeCabecera;
  meta?: MetaContacto | null;
  cargandoMeta?: boolean;
  resumenIa?: string | null;
  onOrigenClick?: () => void;
  onCampanaClick?: () => void;
  onPrimerContactoClick?: () => void;
}

export interface IdentidadDeCabecera {
  /** De dónde sale el nombre («de Cerberus»): va al `title` del nombre, no a la vista. */
  procedenciaNombre?: string | null;
  /** El pushname de WhatsApp cuando difiere del nombre: también al `title`, nunca se pierde. */
  alias?: string | null;
  pais: PaisDelContacto | null;
  /** De dónde salió el país declarado («de Cerberus», «de icarus»). */
  fuentePais?: string | null;
  /** Ocupación y empresa, en ese orden y ya sin vacíos. */
  detalles: readonly string[];
  correo: { valor: string; fuente?: string };
  cargandoCorreo?: boolean;
  /** Sin handler el correo se lee pero no se ofrece escribirle: nunca un botón que no hace nada. */
  escribirCorreo?: () => void;
  /** Las fichas unidas, ya nombradas («Instagram · @karen»). */
  tambien?: readonly string[];
  /** El `title` del chip de estado: el código de cliente y el DNI de Cerberus. */
  detalleEstado?: string | null;
  onEditar?: () => void;
  onUnir?: () => void;
  /** «Llamar por WhatsApp», ya armado: va como ícono en el renglón del número. Sin él, no hay llamada. */
  llamar?: ReactNode;
  /**
   * Los cursos que le interesan, para un renglón de «Origen». Vacío o `undefined`
   * (en campaña el interés es 403) = no hay renglón: la tarjeta compacta no dibuja
   * huecos (dueño, 13-sep-2026).
   */
  interes?: readonly string[];
  /** La prioridad que anotó el equipo en la ficha rápida. */
  prioridad?: { rotulo: string; punto: string } | null;
}

/** Un ícono que se toca, del tamaño de un dedo y no de un píxel (28 px), con su nombre para el lector. */
function BotonDeCabecera({ etiqueta, onClick, children }: { etiqueta: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={etiqueta}
      aria-label={etiqueta}
      className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-[background-color,color,transform] duration-200 ease-house hover:bg-muted hover:text-foreground active:scale-[0.94] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
    >
      {children}
    </button>
  );
}

/** Copiar el número con su `+`: el gesto que más se hace con él fuera de Hermes. Confirma 1,6 s y vuelve. */
function CopiarNumero({ numero }: { numero: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <BotonDeCabecera
      etiqueta={copiado ? 'Número copiado' : 'Copiar el número'}
      onClick={() => {
        void navigator.clipboard?.writeText(numero);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1600);
      }}
    >
      {copiado ? <Check size={14} className="text-success" aria-hidden /> : <Copy size={14} aria-hidden />}
    </BotonDeCabecera>
  );
}

const BADGE_ACENTO: Record<AcentoContacto, string> = {
  cliente: 'border-success/30 bg-success/10 text-success',
  alerta: 'border-warning/30 bg-warning/10 text-warning-foreground',
  frio: 'border-temp-frio/30 bg-temp-frio/10 text-temp-frio',
  neutro: 'border-border bg-muted text-muted-foreground',
};

function fechaConHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const fecha = d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fecha} · ${hora}`;
}

/** Un renglón de «De dónde viene»: el rótulo, lo que se sabe y el porqué al pasar el mouse. */
interface CampoMeta {
  label: string;
  valor: string;
  ayuda?: string;
  onClick?: () => void;
}

/** «» o «Sin origen» es una respuesta vacía: se lee apagada, sin píldora ni borde punteado. */
function esRespuestaVacia(valor: string): boolean {
  const s = valor.trim();
  return s === '' || /^sin /i.test(s);
}

/** El rótulo chiquito que nombra cada tarjeta de la cabecera («Contacto», «Origen»), ADENTRO de la tarjeta. */
const ROTULO_DE_TARJETA = 'px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground';

/**
 * UN RENGLÓN DE TARJETA CON ÍCONO — la forma compacta de «Origen» (dueño, 13-sep-2026,
 * sobre una referencia: «que sea más compacto»). El ícono dice qué es y el rótulo
 * queda para el lector de pantalla (`data-rotulo`): a la vista, «Landing · Diploma
 * Élite…» ya se entiende sin «Origen:» adelante.
 */
function FilaDeTarjeta({
  icono,
  rotulo,
  ayuda,
  onClick,
  children,
}: {
  icono: ReactNode;
  rotulo: string;
  ayuda?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const clase = 'flex min-h-8 w-full min-w-0 items-center gap-2.5 px-3 py-1 text-left text-[12.5px] text-foreground';
  const contenido = (
    <>
      <span className="grid size-4 shrink-0 place-items-center text-muted-foreground">{icono}</span>
      <span data-rotulo className="sr-only">
        {rotulo}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      title={ayuda}
      onClick={onClick}
      className={clase + ' rounded-lg transition-colors duration-150 ease-house hover:bg-muted/60'}
    >
      {contenido}
    </button>
  ) : (
    <div title={ayuda} className={clase}>
      {contenido}
    </div>
  );
}

/**
 * ORIGEN Y CAMPAÑA EN UN RENGLÓN, y el primer contacto en otro. «Sin origen» se sigue
 * diciendo con su porqué en el `title` (7-sep-2026): no saber de dónde vino es una
 * respuesta, no un hueco. Una campaña vacía no se dibuja.
 */
function FilasDeOrigen({ campos }: { campos: readonly CampoMeta[] }) {
  const [origen, ...resto] = campos;
  if (!origen) return null;
  const primerContacto = resto.find((c) => c.label === 'Primer contacto');
  const campana = resto.find((c) => c.label !== 'Primer contacto');
  const conCampana = campana && !esRespuestaVacia(campana.valor);
  return (
    <>
      <FilaDeTarjeta icono={<Link2 size={14} aria-hidden />} rotulo={origen.label} ayuda={origen.ayuda} onClick={origen.onClick}>
        <span className={esRespuestaVacia(origen.valor) ? 'text-muted-foreground/70' : 'font-medium'}>
          {origen.valor || 'Sin origen'}
        </span>
        {conCampana && (
          <>
            <span aria-hidden className="text-muted-foreground">
              {' · '}
            </span>
            <span data-rotulo className="sr-only">
              {campana.label}
            </span>
            <span>{campana.valor}</span>
          </>
        )}
      </FilaDeTarjeta>
      {primerContacto && (
        <FilaDeTarjeta
          icono={<CalendarDays size={14} aria-hidden />}
          rotulo={primerContacto.label}
          onClick={primerContacto.onClick}
        >
          <span className="tabular-nums">{primerContacto.valor}</span>
        </FilaDeTarjeta>
      )}
    </>
  );
}


function armarCampos(
  meta: MetaContacto | null | undefined,
  handlers: {
    onOrigenClick?: () => void;
    onCampanaClick?: () => void;
    onPrimerContactoClick?: () => void;
  },
): CampoMeta[] | null {
  if (!meta) return null;
  return [
    { label: 'Origen', valor: meta.origen, ayuda: meta.ayudaOrigen, onClick: handlers.onOrigenClick },
    {
      label: meta.rotuloCampana ?? 'Campaña',
      valor: meta.campana,
      /* El mismo `title` que «Origen»: el valor se trunca a una línea y el
         porqué —incluida la campaña entera cuando la hay— vive ahí. */
      ayuda: meta.ayudaOrigen,
      onClick: handlers.onCampanaClick,
    },
    /**
     * 🔴 **«PRIMER CONTACTO» YA NO SE DIBUJA VACÍO, y esto es consecuencia de
     * que el bloque haya dejado de depender del formulario.** Antes sólo había
     * bloque cuando había lead, y entonces la fecha existía siempre. Desde que
     * «Origen» se dibuja para toda conversación, este par salía «—» en las
     * 3.257 fichas de anuncio sin formulario: la conversación no manda ninguna
     * fecha de primer contacto, así que el hueco no era «todavía no lo sabemos»
     * sino «acá nunca va a haber nada».
     *
     * ⚠️ **No contradice el «—» de `RenglonDeContexto`**, que existe para decir «el
     * campo está, sin valor» — eso sigue valiendo para «Campaña», donde el dato
     * puede llegar. Acá no puede.
     */
    ...(meta.primerContacto
      ? [
          {
            label: 'Primer contacto',
            valor: fechaConHora(meta.primerContacto),
            onClick: handlers.onPrimerContactoClick,
          },
        ]
      : []),
    /* 🔴 **«ASIGNADA» SE RETIRÓ: era una celda que no podía tener valor nunca.**
       `PanelDerecho` la construía con `asignadoA: ''` clavado —nunca hubo un
       llamador que la llenara— y el renglón pinta `valor || '—'`, así que la
       ficha afirmaba «ASIGNADA · —» sobre TODA conversación, incluidas las que
       sí tienen dueña. Peor: contradecía al control real que está 40 px más
       arriba en la misma hoja (`PasarConversacion`, que sí lee
       `conversacion.asignada_a`). De quién es una conversación se lee ahí, que
       además se puede tocar. */
  ];
}

/** El `title` del nombre: de dónde sale y cómo se hace llamar en WhatsApp. */
function tituloDelNombre(identidad: IdentidadDeCabecera | undefined): string {
  if (!identidad) return '';
  return [
    identidad.procedenciaNombre && `Nombre ${identidad.procedenciaNombre}`,
    identidad.alias && `En WhatsApp: ${identidad.alias}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * LA BANDERA, EL PAÍS Y A QUÉ SE DEDICA, en un renglón bajo el nombre.
 *
 * ⚠️ Un país que salió del código del número lo dice al pasar el mouse: dice dónde
 * se sacó la línea, no dónde vive la persona (`dominio/pais.ts`).
 */
function LineaDePais({ identidad }: { identidad: IdentidadDeCabecera }) {
  const { pais, detalles } = identidad;
  if (!pais && detalles.length === 0) return null;
  const tituloPais = pais
    ? pais.porNumero
      ? `${pais.nombre}, por el código del número: nadie lo declaró`
      : [pais.nombre, identidad.fuentePais && `declarado ${identidad.fuentePais}`].filter(Boolean).join(', ')
    : undefined;
  return (
    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
      {pais && (
        <span data-pais={pais.iso ?? ''} title={tituloPais} className="inline-flex shrink-0 items-center gap-1.5">
          {pais.iso && <Bandera iso={pais.iso} nombre={pais.nombre} />}
          <span className="text-foreground/80">{pais.nombre}</span>
        </span>
      )}
      {detalles.length > 0 && (
        <span title={detalles.join(' · ')} className="min-w-0 truncate">
          {pais ? '· ' : ''}
          {detalles.join(' · ')}
        </span>
      )}
    </p>
  );
}

export function EncabezadoTimeline({
  nombre,
  telefono,
  canal,
  tipoDeFila,
  telefonoCrudo,
  numeroPropio,
  acento,
  tituloEstado,
  compras,
  chips,
  etapa,
  perdida,
  etiquetas,
  categorias,
  meta,
  cargandoMeta,
  resumenIa,
  onOrigenClick,
  onCampanaClick,
  onPrimerContactoClick,
  identidad,
}: PropsEncabezado) {
  const campos = armarCampos(meta, {
    onOrigenClick,
    onCampanaClick,
    onPrimerContactoClick,
  });

  /**
   * El rótulo cae al identificador crudo si la etapa es una que este build no
   * conoce (`rotuloEtapa` degrada, ADR 0049): el vocabulario crece del lado del
   * server y los dos se despliegan por separado.
   */
  const chipEtapa = etapa ? (ETAPA_CHIP[etapa] ?? 'bg-muted text-muted-foreground') : null;
  const conEtiquetas = (etiquetas?.length ?? 0) > 0;

  return (
    <div className="shrink-0 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          {/*
            60 px y no 72 — sigue sin ser 72 por la misma razón de siempre (ver
            abajo), pero pasó de 52 a 60 (11-sep-2026, pedido del dueño: «la
            foto de perfil se agrandará un poco») para que, al lado, el bloque
            de nombre + teléfono + Cliente/Etapa entre en dos renglones sin
            leerse apretado contra un avatar chico.

            La razón original sigue de pie: a 72 px dos letras derivadas del
            nombre que está escrito a su derecha no aportan un dato, orientan,
            y esa talla se comía un tercio del ancho de una columna de 360 —
            60 crece el orientador sin llegar a pagar ese precio.

            🔴 **Y ahora es el `Avatar` compartido, con la FOTO de perfil.** Este
            encabezado pintaba sus propias iniciales a mano, así que era el único
            lugar de Hermes que veía a UNA persona y no le mostraba la cara — la
            fila de la cola y la tarjeta del Pipeline sí. El docblock de `conFoto`
            dice literalmente «prender SOLO donde se ve un contacto a la vez», que
            es la definición de esta pantalla.

            ⚠️ `quiereFoto` y no `canal === 'whatsapp'` escrito acá: es una de las
            cuatro preguntas que esa comparación contesta distinto (`dominio/canal.ts`),
            y un lead de `landing` no tiene foto que pedir porque nunca le escribimos.
          */}
          <Avatar
            nombre={nombre}
            telefono={telefonoCrudo}
            numeroPropio={numeroPropio}
            conFoto={quiereFoto(canal)}
            className="size-[60px] rounded-full bg-navy font-heading text-lg font-bold text-white"
          />
          {/* Puramente decorativo — no representa ningún dato (pedido explícito
              del dueño, 20-ago-2026: nada de lógica nueva en este restyle). */}
          <span
            aria-hidden="true"
            className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-success"
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {/* La procedencia y el alias viven en el `title`: la cabecera dice UN
                nombre (dueño, 13-sep-2026), y lo demás se lee cuando se busca. */}
            <h2
              title={tituloDelNombre(identidad) || undefined}
              className="min-w-0 font-heading text-[17px] font-bold leading-tight text-foreground"
            >
              {nombre}
            </h2>
            <div className="-mr-1.5 -mt-1 flex shrink-0 items-center gap-0.5">
              {identidad?.onEditar && (
                <BotonDeCabecera etiqueta="Editar la ficha" onClick={identidad.onEditar}>
                  <Pencil size={14} aria-hidden />
                </BotonDeCabecera>
              )}
              {identidad?.onUnir && (
                <BotonDeCabecera etiqueta="Unir con otra ficha de esta persona" onClick={identidad.onUnir}>
                  <Link2 size={14} aria-hidden />
                </BotonDeCabecera>
              )}
            </div>
          </div>
          {identidad ? (
            <LineaDePais identidad={identidad} />
          ) : (
            /* Sin tarjeta de identidad (un uso suelto): la línea de siempre, con
               la píldora del canal y el número. */
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <PildoraCanal canal={canal} tipo={tipoDeFila} />
              {telefono && (
                <p className="min-w-0 truncate text-[11px] tabular-nums text-muted-foreground">{telefono}</p>
              )}
            </div>
          )}
          {/* ══ EL ESTADO, EN EL RENGLÓN DE LO QUE AFIRMA ══════════════════════
              Iba al lado del nombre, y con los íconos de Editar y Unir le comía
              el ancho: en 390 px «José Francisco Lopez Fermin» se partía en cuatro
              renglones. Acá se lee junto a «1 compra · 2505 DOP», que es lo que
              lo respalda.

              Un badge vacío no se dibuja: en campaña el estado del contacto no
              tiene nada que afirmar (ver `estadoContacto.ts`), y un pastillón en
              blanco se lee como un dato que no cargó. */}
          {(tituloEstado || compras) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {tituloEstado && (
                <span
                  title={identidad?.detalleEstado ?? undefined}
                  className={'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ' + BADGE_ACENTO[acento]}
                >
                  {tituloEstado}
                </span>
              )}
              {compras && (
                <span className="text-[11px] font-semibold tabular-nums text-success">
                  {compras.n} {compras.n === 1 ? 'compra' : 'compras'} · {compras.total} {compras.moneda}
                </span>
              )}
            </div>
          )}
          {/* ══ ETAPA Y ETIQUETAS ═════════════════════════════════════════════
              Bajo el nombre y no en su propia sección: contestan «cómo está
              clasificada esta persona», que es parte de quién es. En el MISMO
              renglón porque separarlas costaba dos encabezados para cuatro
              píldoras. */}
          {(chipEtapa || conEtiquetas) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {chipEtapa && etapa && (
                <span
                  data-etapa={etapa}
                  // El detalle al pasar el mouse: el chip es una píldora, no un párrafo.
                  title={etapa === 'perdido' && perdida?.motivo && perdida.detalle ? perdida.detalle : undefined}
                  className={'rounded-full px-2 py-0.5 text-[11px] font-semibold ' + chipEtapa}
                >
                  {rotuloEtapa(etapa)}
                  {etapa === 'perdido' && perdida?.motivo ? ` · ${rotuloDelMotivo(perdida.motivo)}` : null}
                </span>
              )}
              {conEtiquetas && <Tag size={11} className="shrink-0 text-muted-foreground" aria-hidden />}
              {etiquetas?.map((etq) => {
                const color = resolverColor(etq, categorias ?? []);
                return (
                  <span
                    key={etq}
                    className={
                      'inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] font-semibold ' +
                      claseBorde(color) +
                      (color ? ' ' + CLASE_TEXTO[color] : ' text-muted-foreground')
                    }
                  >
                    {color && <span className={'size-1.5 rounded-full ' + CLASE_FONDO[color]} aria-hidden />}
                    {etq}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ CONTACTO: EL NÚMERO Y EL CORREO, UNO DE CADA UNO ═════════════════
          Una tarjeta de dos renglones y no una lista de rótulos: la vendedora
          viene a USAR estos dos datos (copiar el número, escribirle), así que cada
          renglón lleva sus acciones a la derecha, a mano. El panel de la ficha no
          le pasa `llamar`: la llamada es `PanelLlamada`, debajo de la cabecera
          (ADR 0123), y no un ícono que se salte la consulta del cupo a Meta.

          ⚠️ Sin `overflow-hidden`: si alguien le pasa `llamar`, su aviso flota
          debajo del ícono y lo cortaría. */}
      {identidad && (
        <section aria-label="Contacto" className="mt-3 rounded-xl border border-border/80 bg-muted/30">
          <h3 className={ROTULO_DE_TARJETA}>Contacto</h3>
        <dl className="divide-y divide-border/60">
          <div className="flex min-h-9 items-center gap-2.5 pl-3 pr-1.5">
            <dt className="sr-only">Número</dt>
            {/* El canal deja de ser texto crudo en minúscula («whatsapp») y pasa
                a la píldora con logo que ADR 0078 puso en la fila de la cola. */}
            <PildoraCanal canal={canal} tipo={tipoDeFila} conEtiqueta={false} />
            <dd
              className={
                'min-w-0 flex-1 truncate text-[13px] tabular-nums ' +
                (telefono ? 'font-medium text-foreground' : 'text-muted-foreground/60')
              }
            >
              {telefono || 'Sin número'}
            </dd>
            {telefono && identidad.llamar}
            {telefono && telefonoCrudo && <CopiarNumero numero={`+${telefonoCrudo.replace(/\D/g, '')}`} />}
          </div>
          <div className="flex min-h-9 items-center gap-2.5 pl-3 pr-1.5">
            <dt className="sr-only">Correo</dt>
            <AtSign size={15} className="shrink-0 text-muted-foreground" aria-hidden />
            {identidad.cargandoCorreo && !identidad.correo.valor ? (
              // Mientras la ficha viaja, la forma de un renglón cargando y no la de un
              // dato vacío: el primer frame no puede afirmar «sin correo».
              <dd data-esqueleto="correo" className="h-3 w-40 animate-pulse rounded bg-muted" />
            ) : (
              <dd
                title={
                  identidad.correo.valor
                    ? [identidad.correo.valor, identidad.correo.fuente && `Correo ${identidad.correo.fuente}`]
                        .filter(Boolean)
                        .join(' · ')
                    : 'Nadie anotó un correo todavía'
                }
                className={
                  'min-w-0 flex-1 truncate text-[13px] ' +
                  (identidad.correo.valor ? 'text-foreground' : 'text-muted-foreground/60')
                }
              >
                {identidad.correo.valor || 'Sin correo'}
              </dd>
            )}
            {identidad.escribirCorreo && identidad.correo.valor && (
              <BotonDeCabecera etiqueta="Escribirle un correo" onClick={identidad.escribirCorreo}>
                <Mail size={14} aria-hidden />
              </BotonDeCabecera>
            )}
          </div>
          {/* Una ficha unida es un hecho sobre quién es esta persona: se lee de un
              vistazo que un dato pudo venir de otro número o de otra red. */}
          {(identidad.tambien?.length ?? 0) > 0 && (
            <div className="flex min-h-8 items-center gap-2.5 py-1 pl-3 pr-3">
              <dt className="sr-only">También es</dt>
              <Link2 size={14} className="shrink-0 text-muted-foreground" aria-hidden />
              <dd title={identidad.tambien!.join(' · ')} className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                También {identidad.tambien!.join(' · ')}
              </dd>
            </div>
          )}
        </dl>
        </section>
      )}

      {/* ══ ORIGEN ══════════════════════════════════════════════════════════
          De dónde vino y cuándo, en renglones con ícono (dueño, 13-sep-2026, sobre una
          referencia compacta). El interés y la prioridad se suman sólo si existen:
          un renglón vacío es alto que no dice nada. */}
      {(campos || cargandoMeta || (identidad?.interes?.length ?? 0) > 0 || identidad?.prioridad) && (
        <section aria-label="Origen" className="mt-2 rounded-xl border border-border/80 bg-muted/30 pb-1">
          <h3 className={ROTULO_DE_TARJETA}>Origen</h3>
          {campos ? (
            <FilasDeOrigen campos={campos} />
          ) : cargandoMeta ? (
            [0, 1].map((i) => (
              <div key={i} aria-hidden data-esqueleto="meta" className="flex min-h-8 items-center gap-2.5 px-3 py-1">
                <span className="size-4 animate-pulse rounded bg-muted" />
                <span className="h-3 w-40 animate-pulse rounded bg-muted" />
              </div>
            ))
          ) : null}
          {identidad?.interes && identidad.interes.length > 0 && (
            <FilaDeTarjeta icono={<GraduationCap size={14} aria-hidden />} rotulo="Interés">
              {identidad.interes.join(', ')}
            </FilaDeTarjeta>
          )}
          {identidad?.prioridad && (
            <FilaDeTarjeta icono={<Flag size={14} aria-hidden />} rotulo="Prioridad">
              <span className="inline-flex items-center gap-1.5">
                <span className={'size-1.5 rounded-full ' + identidad.prioridad.punto} aria-hidden />
                Prioridad {identidad.prioridad.rotulo.toLowerCase()}
              </span>
            </FilaDeTarjeta>
          )}
        </section>
      )}

      <ResumenIa texto={resumenIa ?? null} />

      {chips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
