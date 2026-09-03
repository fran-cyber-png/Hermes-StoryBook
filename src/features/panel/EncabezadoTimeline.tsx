import { Tag } from 'lucide-react';
import type { ResumenCompras } from '../cerberus/ficha';
import { PildoraCanal } from '../../components/BadgeCanal';
import { Avatar } from '../../components/Avatar';
import { quiereFoto } from '../../dominio/fotoVisible';
import { ETAPA_CHIP, rotuloEtapa } from '../../lib/etapas';
import {
  CLASE_FONDO,
  CLASE_TEXTO,
  claseBorde,
  resolverColor,
} from '../../dominio/paletaCategorias';
import { BloqueMeta, BloqueMetaSkeleton, type CampoMeta } from './BloqueMeta';
import type { AcentoContacto } from './estadoContacto';
import { ResumenIa } from './ResumenIa';

interface MetaContacto {
  origen: string;
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
   * LAS ETIQUETAS ASIGNADAS, de solo lectura y con el color del catálogo del
   * módulo de quien mira (ADR 0078). Mismo argumento que la etapa: en dos de los
   * tres lugares donde vive este panel no existe la barra que las pone.
   */
  etiquetas?: readonly string[];
  /** El catálogo con color. Sin él las píldoras salen neutras, nunca sin dibujarse. */
  categorias?: readonly { nombre: string; color: string }[];
  meta?: MetaContacto | null;
  cargandoMeta?: boolean;
  resumenIa?: string | null;
  onOrigenClick?: () => void;
  onCampanaClick?: () => void;
  onPrimerContactoClick?: () => void;
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
    { label: 'Origen', valor: meta.origen, onClick: handlers.onOrigenClick },
    { label: 'Campaña', valor: meta.campana, onClick: handlers.onCampanaClick },
    {
      label: 'Primer contacto',
      valor: meta.primerContacto ? fechaConHora(meta.primerContacto) : meta.primerContacto,
      onClick: handlers.onPrimerContactoClick,
    },
    /* 🔴 **«ASIGNADA» SE RETIRÓ: era una celda que no podía tener valor nunca.**
       `PanelDerecho` la construía con `asignadoA: ''` clavado —nunca hubo un
       llamador que la llenara— y `BloqueMeta` pinta `valor || '—'`, así que la
       ficha afirmaba «ASIGNADA · —» sobre TODA conversación, incluidas las que
       sí tienen dueña. Peor: contradecía al control real que está 40 px más
       arriba en la misma hoja (`PasarConversacion`, que sí lee
       `conversacion.asignada_a`). De quién es una conversación se lee ahí, que
       además se puede tocar. */
  ];
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
  etiquetas,
  categorias,
  meta,
  cargandoMeta,
  resumenIa,
  onOrigenClick,
  onCampanaClick,
  onPrimerContactoClick,
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
      <div className="flex items-start gap-3">
        <span className="relative shrink-0">
          {/*
            52 px y no 72. Dos letras derivadas del nombre que está escrito a su
            derecha no aportan un dato, orientan. A 72 px se comía un tercio del
            ancho de una columna de 360 y empujaba fuera de la primera pantalla
            todo lo que sí es dato.

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
            className="size-[52px] rounded-full bg-navy font-heading text-base font-bold text-white"
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
            <h2 className="font-heading text-[17px] font-bold leading-tight text-foreground">{nombre}</h2>
            {/* Un badge vacío no se dibuja: en campaña el estado del contacto
                no tiene nada que afirmar (ver `estadoContacto.ts`), y un
                pastillón en blanco al lado del nombre se lee como un dato que
                no cargó. */}
            {tituloEstado && (
              <span className={'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ' + BADGE_ACENTO[acento]}>
                {tituloEstado}
              </span>
            )}
          </div>
          {/* El canal deja de ser texto crudo en minúscula («whatsapp») y pasa a
              la píldora con logo que ADR 0078 puso en la fila de la cola: misma
              fuente de verdad, y de paso distingue un comentario público de un
              directo, que acá tampoco se distinguía. */}
          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            <PildoraCanal canal={canal} tipo={tipoDeFila} />
            {telefono && (
              <p className="min-w-0 truncate text-[11px] tabular-nums text-muted-foreground">{telefono}</p>
            )}
          </div>
          {compras && (
            <p className="mt-1 text-[11px] font-semibold tabular-nums text-success">
              {compras.n} {compras.n === 1 ? 'compra' : 'compras'} · {compras.total} {compras.moneda}
            </p>
          )}
        </div>
      </div>

      {/* ══ ETAPA Y ETIQUETAS ═══════════════════════════════════════════════
          En el MISMO renglón y no en dos secciones: las dos contestan «cómo
          está clasificada esta persona», y separarlas costaba dos encabezados
          para cuatro píldoras. Van debajo del bloque de identidad —no al lado
          del nombre— porque con tres etiquetas el renglón 1 se parte. */}
      {(chipEtapa || conEtiquetas) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {chipEtapa && etapa && (
            <span className={'rounded-full px-2 py-0.5 text-[11px] font-semibold ' + chipEtapa}>
              {rotuloEtapa(etapa)}
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

      {campos && (
        <div className="mt-3">
          <BloqueMeta campos={campos} />
        </div>
      )}
      {!campos && cargandoMeta && (
        <div className="mt-3">
          <BloqueMetaSkeleton cantidad={4} />
        </div>
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
