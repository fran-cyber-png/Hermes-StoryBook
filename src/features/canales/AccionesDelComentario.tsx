import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, EyeOff, Loader2, Lock, MessageCircle, Trash2 } from 'lucide-react';
import { api, ErrorApi } from '../../lib/datos/cliente';
import type { Capacidades } from './puedeEscribirPrivado';
import ConfirmarModeracion, { type QueConfirmar } from './ConfirmarModeracion';

/**
 * ¿QUÉ PUEDES HACER CON ESTE COMENTARIO? — las cuatro acciones, en una fila.
 *
 * Fase 7 del rediseño (25-ago-2026). Fusiona dos componentes que hasta hoy
 * vivían separados y decían cosas del mismo comentario en dos lugares:
 * `QuePuedoHacer` (una lista vertical de tres filas informativas) y
 * `AccionesDeModeracion` (dos botones sueltos más arriba).
 *
 * ══ 🔴 POR QUÉ SE FUSIONAN, Y NO ES SÓLO ESTÉTICA ═══════════════════════════
 *
 * El diseño pedía ocultar y borrar en DOS lugares: como botones debajo de la
 * publicación **y** como cards debajo del comentario. Son la misma acción sobre
 * el mismo objeto — el comentario, no el post: el server las expone en
 * `POST /api/comentario/:id/moderar`. Dibujarlas dos veces obliga a la vendedora
 * a preguntarse si son distintas, que es el problema que la fase 3 identifica
 * para el botón de «Ver en Facebook» y resuelve dejando uno solo. Acá se aplica
 * el mismo criterio.
 *
 * ══ LAS CUATRO NO SON LA MISMA CLASE DE COSA, Y SE NOTA ═════════════════════
 *
 * Las dos primeras **llevan a escribir** (bajan el foco a su caja); las dos
 * últimas **hacen algo en Facebook, ahora**. Por eso las destructivas piden
 * confirmación y las otras no. Se dibujan iguales porque comparten el lugar y
 * el momento de la decisión, no porque hagan lo mismo.
 *
 * ⚠️ **El estado de cada una viene de dos fuentes distintas**: si se puede
 * escribir en privado lo dice `/api/persona/:id/puede-privado` (la ventana de 7
 * días de Meta) y si se puede ocultar o borrar lo dice
 * `/api/comentario/:id/contexto` (`can_hide`/`can_remove`, que Meta contesta por
 * comentario). No se colapsan en un solo booleano: apagan cards distintas por
 * motivos distintos, y el motivo se dice al pie.
 */

interface EstadoEnMeta {
  can_hide?: boolean;
  is_hidden?: boolean;
  can_remove?: boolean;
}

export type AccionModeracion = 'ocultar' | 'mostrar' | 'eliminar';

/** La ventana de Meta para escribirle en privado a quien comenta. */
const VENTANA_PRIVADO_DIAS = 7;

interface Props {
  interactionId: number;
  estado: EstadoEnMeta;
  /** No se pudo leer el comentario en Meta: no se sabe qué permite. */
  degradado?: boolean;
  cargando: boolean;
  /** Lo que dijo `/api/persona/:id/puede-privado`. `null` = todavía no contestó. */
  cap: Capacidades | null;
  /** Bajar el foco a la caja de respuesta pública / privada. */
  onEscribirPublico: () => void;
  onEscribirPrivado: () => void;
  /**
   * 🔴 **AVISA CUANDO SU MODAL ESTÁ ABIERTO, y no es un detalle de cortesía.**
   * `useEscape` registra en CAPTURA sobre `window`, y `stopPropagation()` no
   * frena a un hermano registrado en el mismo nodo: con el modal abierto, un
   * Escape cerraba el modal **y también la conversación entera**, dejando a la
   * vendedora en la lista sin saber por qué. El panel usa esto para apagar su
   * propio Escape mientras el modal manda — que es para lo que el `activo` del
   * hook existe. Lo encontró apretando Escape, no un test.
   */
  onModal?: (abierto: boolean) => void;
}

type Tono = 'verde' | 'azul' | 'ambar' | 'rojo';

/**
 * El color de cada card, por TONO y no por hexadecimal.
 *
 * ⚠️ **Los tokens del repo, no el azul de Facebook literal.** El diseño pide
 * «azul similar al de Facebook» y colores fijos (`#F8FAFC`), pero Hermes tiene
 * modo oscuro y su propia paleta: clavar hexadecimales dejaría esta pantalla
 * ilegible en oscuro, sin que ningún test lo vea. Se respeta la JERARQUÍA que el
 * diseño pide —azul lo principal, rojo sólo lo destructivo, ámbar la
 * advertencia, verde lo positivo— con los tokens que ya existen.
 */
const TONOS: Record<Tono, { icono: string; borde: string }> = {
  verde: { icono: 'bg-temp-fresco/12 text-temp-fresco', borde: 'hover:border-temp-fresco/40' },
  azul: { icono: 'bg-primary/12 text-primary', borde: 'hover:border-primary/40' },
  ambar: { icono: 'bg-gold/20 text-gold-ink', borde: 'hover:border-gold/50' },
  rojo: { icono: 'bg-destructive/10 text-destructive', borde: 'hover:border-destructive/40' },
};

function Card({
  tono,
  icono: Icono,
  titulo,
  detalle,
  onClick,
  apagada,
  trabajando,
}: {
  tono: Tono;
  icono: typeof MessageCircle;
  titulo: string;
  detalle: string;
  onClick: () => void;
  apagada?: boolean;
  trabajando?: boolean;
}) {
  const t = TONOS[tono];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={apagada || trabajando}
      className={
        'flex min-w-0 flex-col items-start gap-1.5 rounded-xl border border-border bg-card p-2.5 text-left ' +
        'transition-[border-color,background-color,transform] duration-200 ease-house ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 ' +
        'disabled:cursor-not-allowed disabled:opacity-45 ' +
        (apagada || trabajando ? '' : `cursor-pointer hover:bg-muted/40 active:scale-[0.98] ${t.borde}`)
      }
    >
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${t.icono}`}>
        {trabajando ? <Loader2 size={14} className="animate-spin" /> : <Icono size={14} />}
      </span>
      <span className="text-xs font-bold leading-tight text-foreground">{titulo}</span>
      {/*
        Dos líneas y se corta. La fase 7 pide cards «no excesivamente altas»
        porque el objetivo es ahorrar vertical (fase 11): una descripción de
        cuatro líneas en la card más alta estira las cuatro.
      */}
      <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{detalle}</span>
    </button>
  );
}

export default function AccionesDelComentario({
  interactionId,
  estado,
  degradado,
  cargando,
  cap,
  onEscribirPublico,
  onEscribirPrivado,
  onModal,
}: Props) {
  /**
   * Qué se está por confirmar, o `null`. Reemplaza al `confirmandoBorrado` que
   * transformaba el propio botón: ese segundo clic caía en el MISMO lugar de la
   * pantalla que el primero, así que un doble clic apurado borraba sin que nadie
   * leyera nada (fase 10).
   */
  const [confirmando, setConfirmando] = useState<QueConfirmar | null>(null);

  // El aviso viaja en un efecto y no adentro del `setConfirmando`: así vale
  // igual para las tres puertas que lo cierran (Cancelar, la X, el Escape) y
  // para el `onSuccess` de la mutación, sin repetir la llamada en cuatro lados.
  useEffect(() => {
    onModal?.(confirmando !== null);
  }, [confirmando, onModal]);
  const [hecho, setHecho] = useState<string | null>(null);
  const clienteDeConsultas = useQueryClient();

  const moderar = useMutation({
    mutationFn: (accion: AccionModeracion) =>
      api<{ ok: true; mensaje: string }>(`/api/comentario/${interactionId}/moderar`, {
        method: 'POST',
        body: JSON.stringify({ accion }),
      }),
    onSuccess: (r) => {
      setHecho(r.mensaje);
      setConfirmando(null);
      void clienteDeConsultas.invalidateQueries({ queryKey: ['comentario-contexto', interactionId] });
      void clienteDeConsultas.invalidateQueries({ queryKey: ['conversaciones'] });
    },
  });

  const estaOculto = estado.is_hidden === true;
  /**
   * 🔴 **MIENTRAS SE LE PREGUNTA A META, LAS DOS DESTRUCTIVAS NO SE PUEDEN
   * APRETAR.** La versión vertical que esto reemplaza no dibujaba ningún botón
   * hasta saber la respuesta; las cards se dibujan siempre (fase 7: «se ve pero
   * apagada»), así que el candado se mueve al `disabled` — si no, en el segundo
   * que tarda la consulta alguien puede borrar un comentario que Meta no dejaba
   * borrar, y eso no se deshace desde Hermes.
   *
   * Lo atrapó `moderarComentario.test.tsx` al repuntarlo a este componente.
   */
  const noPuedeOcultar = cargando || (estado.can_hide === false && !estaOculto);
  const noPuedeBorrar = cargando || estado.can_remove === false;
  const trabajando = moderar.isPending;
  const puedePrivado = cap?.puedePrivado ?? false;

  const explicacionPrivado =
    cap?.motivo === 'ventana-cerrada'
      ? `Meta lo permite solo 7 días. Este ya tiene ${cap.dias}.`
      : cap?.motivo === 'privacidad'
        ? 'Esta persona no acepta mensajes de páginas.'
        : cap?.motivo === 'instagram'
          ? 'En Instagram, Meta lo tiene tras una revisión de app.'
          : 'Meta no lo permite en este comentario.';

  // La cuenta regresiva: oro ANTES de que sea tarde, no después.
  const quedan =
    puedePrivado && typeof cap?.dias === 'number' ? VENTANA_PRIVADO_DIAS - cap.dias : null;

  return (
    <section>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        ¿Qué puedes hacer con este comentario?
      </h3>

      {/*
        Cuatro columnas en la mesa ancha, dos cuando la columna se angosta. No se
        bajan nunca a una sola: apiladas ocupan lo mismo que la lista vertical que
        esto vino a reemplazar.
      */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Card
          tono="verde"
          icono={MessageCircle}
          titulo="Responder en público"
          detalle="Siempre se puede, sin importar la antigüedad. Lo ven todos los que miran el post."
          onClick={onEscribirPublico}
        />
        <Card
          tono="azul"
          icono={Lock}
          titulo="Enviar mensaje privado"
          detalle={
            puedePrivado
              ? 'Le llega por Messenger aunque nunca te haya escrito. Una sola vez por comentario.'
              : explicacionPrivado
          }
          onClick={onEscribirPrivado}
          apagada={!puedePrivado}
        />
        {/*
          🔴 **La card se ve pero APAGADA cuando Meta no deja, con el motivo al
          pie.** Medido el 25-ago-2026: de cuatro comentarios reales, `can_hide`
          fue `true` en dos y `false` en dos — un botón siempre habilitado falla
          la mitad de las veces y el error de Meta no explica cuál. Esconderla
          tampoco sirve: la vendedora no sabría que la función existe.
        */}
        <Card
          tono="ambar"
          icono={EyeOff}
          titulo={estaOculto ? 'Volver a mostrarlo' : 'Ocultar comentario'}
          detalle={
            estaOculto
              ? 'Vuelve a ser visible para todos en la publicación.'
              : 'Deja de verse en la publicación. Quien lo escribió sigue viéndolo.'
          }
          /*
            ⚠️ **Volver a mostrarlo NO pide confirmación.** La fase 10 pide
            confirmar «ocultar», y eso es lo que se hace; deshacerlo es volver al
            estado normal y ponerle una puerta sería fricción sobre la salida.
          */
          onClick={() => (estaOculto ? moderar.mutate('mostrar') : setConfirmando('ocultar'))}
          apagada={noPuedeOcultar}
          trabajando={trabajando}
        />
        {/*
          ⚠️ **Borrar confirma en la propia card, no con un `confirm()`.** Un
          diálogo nativo bloquea el hilo y en la cáscara de escritorio se ve
          ajeno; además la guía del proyecto prohíbe los modales del navegador.
          La card cambia su título y vuelve sola al perder el foco.
        */}
        <Card
          tono="rojo"
          icono={Trash2}
          titulo="Eliminar comentario"
          detalle="Se elimina de Facebook para siempre. No se puede deshacer."
          onClick={() => setConfirmando('eliminar')}
          apagada={noPuedeBorrar}
          trabajando={trabajando}
        />
      </div>

      {/* Los motivos y los avisos, al pie: en la card no entran sin estirarlas. */}
      {cargando && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 size={11} className="animate-spin" /> Viendo qué se puede hacer en Facebook…
        </p>
      )}
      {!cargando && estado.can_hide === false && !estaOculto && (
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          Facebook no deja ocultar este comentario. Suele pasar con los de la propia Página y con las
          respuestas dentro de un hilo.
        </p>
      )}
      {!cargando && estado.can_remove === false && (
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          Facebook no deja borrar este comentario desde acá.
        </p>
      )}
      {degradado && (
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          No pudimos leer el comentario en Facebook, así que no sabemos qué permite. Puedes intentarlo
          igual.
        </p>
      )}

      {/*
        ⚠️ **LOS DOS AVISOS DE LA VENTANA VAN EN RECUADRO, no como una nota al pie
        más.** La fase 7 dejó la cuenta regresiva con el mismo tratamiento que
        «Facebook no deja ocultar este comentario» — una línea gris entre otras — y
        ahí se pierde: es lo único de este bloque que habla de TIEMPO QUE SE ACABA,
        que es exactamente lo que el oro significa en este repo.
      */}
      {quedan != null && quedan <= 2 && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-gold/10 px-3 py-2 text-[11px] font-semibold leading-snug text-gold-ink">
          <Clock size={12} className="mt-px shrink-0" />
          <span>
            {quedan <= 0
              ? 'Hoy es el último día para poder escribirle en privado.'
              : quedan === 1
                ? 'Te queda 1 día para poder escribirle en privado.'
                : `Te quedan ${quedan} días para poder escribirle en privado.`}
          </span>
        </p>
      )}

      {/*
        🔴 **«YA NO SE PUEDE» NO ES «TE QUEDAN 2 DÍAS», y por eso son dos avisos y
        no uno con otro texto.** El de arriba pide apurarse; éste explica una
        puerta que ya se cerró — y sobre todo POR QUÉ conviene no repetirlo, que
        es la única parte accionable que le queda a quien lo lee.

        🔴 **Y acá se había PERDIDO.** El rediseño lo colapsó en el `detalle` de la
        card apagada («Meta lo permite solo 7 días. Este ya tiene N»): cuerpo chico,
        gris, adentro de una tarjeta desactivada — o sea el lugar de la pantalla
        que la vista aprende a saltear. `QuePuedoHacer.tsx`, el componente que
        esto reemplaza, lo dibujaba como bloque propio.
      */}
      {!puedePrivado && cap?.motivo === 'ventana-cerrada' && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-[11px] leading-snug text-gold-ink">
          <Clock size={12} className="mt-px shrink-0" />
          <span>
            <strong className="font-semibold">La ventana se cerró.</strong> Meta deja escribirle por
            privado a quien comenta solo durante 7 días. Después, solo queda el comentario público.
            Por eso responder rápido no es una preferencia: es la diferencia entre poder hablarle o no.
          </span>
        </p>
      )}

      {/*
        🔴 **«NO ACEPTA MENSAJES DE PÁGINAS» NO ES LA VENTANA, y por eso es un
        tercer aviso y no una variante del de arriba.** Los dos apagan la caja
        privada, pero el de la ventana es NUESTRO retraso —apurarse lo evitaba— y
        éste es una decisión de la otra persona en su propio teléfono: no había
        nada que hacer más rápido. Contarlos con el mismo texto le enseñaría a la
        vendedora a apurarse por algo que no depende de ella.

        ⚠️ **No dice qué ajuste tocó esa persona.** Meta contesta
        `can_reply_privately: false` y no explica por qué; el motivo `privacidad`
        es lo que INFERIMOS dentro de la ventana de 7 días. Se describe el efecto,
        no una pantalla de su teléfono que nadie miró.

        ⚠️ **El aviso vive acá y no en el clic de la card**: la card es un
        `<button disabled>` y un botón deshabilitado no dispara ningún clic, así
        que «avisar cuando lo intente» ahí no existe como evento. Lo que sí ve la
        vendedora cuando lo intenta es la caja privada apagada, y ésa dice el
        mismo motivo por `porQueNoPuedePrivado`.
      */}
      {!puedePrivado && cap?.motivo === 'privacidad' && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-[11px] leading-snug text-gold-ink">
          <Lock size={12} className="mt-px shrink-0" />
          <span>
            <strong className="font-semibold">No se le puede escribir en privado.</strong>{' '}
            {explicacionPrivado} Es una configuración suya, no un plazo vencido: responder más rápido
            no lo habría cambiado. Queda el comentario público, que sí le llega.
          </span>
        </p>
      )}

      {confirmando && (
        <ConfirmarModeracion
          que={confirmando}
          onCancelar={() => setConfirmando(null)}
          onConfirmar={() => moderar.mutate(confirmando)}
        />
      )}

      {hecho && <p className="mt-2 text-xs font-semibold text-foreground">{hecho}</p>}
      {moderar.isError && (
        <p className="mt-2 text-xs font-semibold text-destructive">
          {moderar.error instanceof ErrorApi
            ? ((moderar.error.cuerpo as { error?: string } | undefined)?.error ??
              'No se pudo hacer. Puedes intentarlo de nuevo en un momento.')
            : 'No se pudo hacer. Puedes intentarlo de nuevo en un momento.'}
        </p>
      )}
    </section>
  );
}
