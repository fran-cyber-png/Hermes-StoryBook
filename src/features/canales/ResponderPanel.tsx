import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, ExternalLink, Lock, MessageCircle, Plus, Send, Trash2 } from 'lucide-react';
import { useEsMovil } from '../../lib/useEsMovil';
import { api, claves, ErrorApi } from '../../lib/datos/cliente';
import { sectionLabel } from '../../lib/styles';
import { iniciales } from '../../lib/iniciales';
import { useEscape } from '../../lib/teclado/useEscape';
import type { Conversacion } from '../../dominio/conversaciones';
import type { Interaccion } from './types';
import { TIPO_META, tipoDe } from './tipos';
import { daysSince } from '../leads/temperature';
import { porQueNoPuedePrivado, useCapacidades } from './puedeEscribirPrivado';
import AccionesDelComentario from './AccionesDelComentario';
import { AvisoDeOculto, ContenidoDelComentario } from './ContenidoDelComentario';
import { siguientePlantillaPublica } from '../../dominio/plantillaPublica';
import { nombreCanal } from '../../components/BadgeCanal';
import { CabeceraDeChat } from './CabeceraDeChat';
import {
  AdjuntoDelComentario,
  PublicacionOriginal,
  useContextoDelComentario,
} from './ContextoDelComentario';
import YaRespondido, { AvisoDePresencia } from './YaRespondido';
import { SIN_ESTADO, useEstadoDeRespuesta, usePresenciaEnComentario } from './respuestaUnica';

/**
 * Responder a quien comentó — la jugada que ManyChat convirtió en negocio.
 *
 * Dos mensajes DISTINTOS, no el mismo texto repetido:
 *   · el público es corto y remite al privado
 *   · el privado lleva la información de verdad
 *
 * Y el privado se manda PRIMERO. Si falla, no se publica nada — porque el
 * público suele prometerlo. Se aprendió rompiéndolo: se publicó "te enviamos
 * la info por privado", el privado falló, y quedó una mentira pública.
 *
 * 🔴 **Y lo que se publica es SIEMPRE lo que la vendedora tiene escrito**
 * (11-sep-2026). Hasta ese día, si el privado fallaba, el server publicaba en su
 * lugar un texto de la Escuela que nadie veía: en la Página de Américo salió 13
 * veces. Ahora el panel muestra por qué falló y ofrece publicar sola la
 * respuesta pública, con un clic que da ella.
 *
 * 🔴 **Y un comentario ya respondido no abre las cajas** (13-sep-2026). Varias
 * agentes atienden la misma Página, y el panel abría siempre con la caja vacía:
 * el comentario de Nina Silva recibió cuatro respuestas en once horas. Ahora
 * arriba se ve lo que ya tiene y quién más lo tiene abierto (`YaRespondido`), y
 * las cajas esperan a que la agente elija «Responder otra vez».
 */

/** Salió uno de los dos envíos y el otro no. */
interface Parcial {
  /** Qué falló, como lo tradujo el server. */
  causa: string;
  /** ¿El que salió fue el público? Si no, fue el privado. */
  salioElPublico: boolean;
}

interface Props {
  interaccion: Interaccion | null;
  /**
   * ══ LA `Conversacion` ENTERA, para `CabeceraDeChat`/`BarraGestion` (08-sep-2026) ══
   *
   * `interaccion` es un recorte que `ConversacionActiva` arma a mano (ver su
   * docblock) y no lleva `clave`/`persona_id`/`numero_propio` — lo que
   * `BarraGestion` necesita para la etapa, las etiquetas, el interés y el
   * reparto. Antes eso no hacía falta: `BarraGestion` la dibujaba
   * `ConversacionActiva`, aparte, con la `Conversacion` que sí tiene. Ahora que
   * la barra se mudó ADENTRO de esta cabecera (misma anatomía que
   * `HiloWhatsapp`), este panel necesita las dos cosas.
   */
  conversacion: Conversacion;
  /** Ver el mismo prop en `HiloWhatsapp` — viaja hasta `<BarraGestion embebida>`. */
  miVendedora?: string | null;
  esDeCampana?: boolean;
  onAbrirOtra?: (o: { clave: string; telefono: string | null }) => void;
  senales?: { registrar: number; estado: number; etiqueta: number; agendar: number };
  onCerrar: () => void;
  onRespondido: (id: number) => void;
  /** Modo racha (Fase 3): si App la pasa, el «Respondido» ofrece saltar a la siguiente de la cola. */
  onSiguiente?: () => void;
  /** El celular: volver a la lista. Ver `CabeceraDeChat.onVolver`. */
  onVolver?: () => void;
}


/**
 * LO QUE SE VE DESPUÉS DE RESPONDER.
 *
 * Sale del cuerpo de `ResponderPanel` en el rediseño (fase 8): ese componente
 * pasó de 461 a demasiadas líneas y este bloque —que tiene tres desenlaces
 * distintos— quedaba enterrado adentro de un ternario. **No cambia una coma de
 * su comportamiento**: es el mismo JSX, con las mismas tres ramas.
 */
function EstadoEnviado({
  parcial,
  psid,
  red,
  enviando,
  onBorrar,
  onSiguiente,
}: {
  /** Salió uno de los dos y el otro no. Cuál, lo dice `salioElPublico`. */
  parcial: Parcial | null;
  /** El PSID de la conversación que el privado abrió, o `null`. */
  psid: string | null;
  red: string;
  enviando: boolean;
  onBorrar: () => void;
  onSiguiente?: () => void;
}) {
  return (
          <div
            className={
              'rounded-xl border p-4 ' +
              (parcial
                ? 'border-warning/40 bg-warning/10'
                : 'border-temp-fresco/40 bg-temp-fresco/10')
            }
          >
            <div
              className={
                'flex items-center gap-2 text-sm font-bold ' +
                (parcial ? 'text-gold-ink' : 'text-temp-fresco')
              }
            >
              {parcial ? <AlertTriangle size={15} /> : <Check size={15} />}
              {parcial
                ? parcial.salioElPublico
                  ? 'Respondido solo en público'
                  : 'Respondido solo en privado'
                : 'Respondido'}
            </div>
            {parcial ? (
              <>
                <p className="mt-1 text-xs leading-relaxed text-gold-ink">
                  {parcial.salioElPublico ? (
                    <>
                      Tu comentario público sí se publicó en {red}, pero <strong>el mensaje privado no
                      salió</strong>, así que esa persona sigue esperando.
                    </>
                  ) : (
                    <>
                      El mensaje privado le llegó, pero <strong>tu respuesta pública no se publicó</strong> en{' '}
                      {red}.
                    </>
                  )}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  Qué pasó: {parcial.causa}
                </p>
              </>
            ) : psid ? (
              /**
               * 🔴 EL PRIVADO ABRIÓ UNA CONVERSACIÓN DE MESSENGER, y hasta
               * hoy eso no se decía en ningún lado: la vendedora leía «ya
               * está publicado» y el hilo moría ahí, aunque Meta hubiera
               * abierto un chat real con esa persona.
               *
               * Se pinta SÓLO con `psid`, o sea sólo cuando el privado
               * salió de verdad — no con el 200 del POST, que también
               * llega cuando salió el público y el privado no.
               */
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Ya está publicado en {red}, y el mensaje privado le llegó por{' '}
                <strong className="text-foreground">Messenger</strong>. La conversación queda
                abierta en la bandeja: cuando responda, la vas a ver ahí.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Ya está publicado en {red}.
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onBorrar}
                disabled={enviando}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:opacity-50"
              >
                <Trash2 size={12} />
                {enviando ? 'Borrando…' : 'Borrar mi respuesta'}
              </button>
              {onSiguiente && (
                <button
                  type="button"
                  onClick={onSiguiente}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white transition-transform duration-200 ease-house hover:bg-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 active:scale-[0.98]"
                >
                  Siguiente de la cola →
                </button>
              )}
            </div>
            {onSiguiente && (
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">Enter salta a la siguiente</p>
            )}
          </div>
  );
}

export default function ResponderPanel({
  interaccion,
  conversacion,
  miVendedora,
  esDeCampana,
  onAbrirOtra,
  senales,
  onCerrar,
  onRespondido,
  onSiguiente,
  onVolver,
}: Props) {
  const [publico, setPublico] = useState('');
  const [privado, setPrivado] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Salió uno de los dos y el otro no. Es su propio estado y no un error, porque
   * algo SÍ salió: tratarlo como fallo haría que la vendedora lo mande de nuevo y
   * termine con dos comentarios en el post, o con dos privados a la misma persona.
   */
  const [parcial, setParcial] = useState<Parcial | null>(null);
  /**
   * El PSID de la conversación de Messenger que el privado abrió. Sólo se
   * setea si el privado salió: es lo que habilita «Seguir en Messenger».
   */
  const [psid, setPsid] = useState<string | null>(null);
  /**
   * 🔴 EL PRIVADO FALLÓ Y NO SE PUBLICÓ NADA: la causa, en castellano.
   *
   * No es `error` porque tiene una salida que decide la vendedora: publicar sola
   * la respuesta pública que tiene escrita, con un botón visible. Hasta el
   * 11-sep-2026 esa decisión la tomaba el server, publicando otro texto.
   */
  const [retenido, setRetenido] = useState<string | null>(null);
  /**
   * CUÁNTAS RESPUESTAS TENÍA A LA VISTA cuando eligió «Responder otra vez», o
   * `null` si no lo eligió. Hasta que lo elige, un comentario con respuestas no
   * muestra las cajas (13-sep-2026).
   *
   * 🔴 **Es un número y no un booleano, y es el de ESE momento.** Con un booleano
   * y la cuenta en vivo, dos agentes que ven una respuesta y eligen las dos
   * «Responder otra vez» publicaban las dos: a la segunda le llegaba por el SSE la
   * respuesta de la primera, mandaba «vi 2» y el server la dejaba pasar (revisión
   * de spec del ADR 0115). Con el número guardado, si la lista crece mientras
   * escribe, las cajas se vuelven a cerrar solas, y el server frena igual lo que
   * se mande con una cuenta vieja.
   */
  const [vistasAlDecidir, setVistasAlDecidir] = useState<number | null>(null);
  /**
   * Las dos cajas, para que las cards de arriba puedan bajar el foco. Es lo que
   * convierte «Responder en público» de un rótulo en una acción (fase 7).
   */
  const cajaPublica = useRef<HTMLTextAreaElement>(null);
  const cajaPrivada = useRef<HTMLTextAreaElement>(null);
  /**
   * ¿LA VENDEDORA YA ESCRIBIÓ EN LA CAJA PÚBLICA? La sugerencia llega con `cap`, que
   * puede tardar —si no está cacheado, el server le pregunta a Meta—, y pisar lo
   * escrito al llegar borraba texto real: con Américo, que no tiene sugerencias, la
   * caja quedaba VACÍA (12-sep-2026). Un ref y no un estado: sólo lo lee el efecto.
   */
  const escribioEnLaPublica = useRef(false);
  /** ¿El modal de ocultar/eliminar está abierto? Decide de quién es el Escape. */
  const [modalDeModeracion, setModalDeModeracion] = useState(false);
  /**
   * 📱 ¿ABRIÓ LA CAJA PRIVADA? Sólo pesa en el celular (ADR 0121): ahí la privada
   * arranca plegada detrás de «+ Mensaje privado», porque dos cajas apiladas en
   * 390 px dejan la pública debajo del teclado. En la mesa ancha las dos van lado
   * a lado siempre, y esto no cambia nada.
   */
  const [privadoAbierto, setPrivadoAbierto] = useState(false);

  const id = interaccion?.id;
  const cap = useCapacidades(id);
  const qc = useQueryClient();

  useEffect(() => {
    setPublico('');
    setPrivado('');
    escribioEnLaPublica.current = false;
    // `cap` ya no se limpia acá: lo maneja `useCapacidades`, que lo pone en
    // `null` al cambiar de comentario y descarta la respuesta que llega tarde.
    setLink(null);
    setEnviado(false);
    setError(null);
    setParcial(null);
    setPsid(null);
    setRetenido(null);
    setVistasAlDecidir(null);
    setPrivadoAbierto(false);
    if (id) {
      // Por `api()`: la ruta está detrás del perímetro y necesita el Bearer.
      api<{ permalink?: string | null }>(`/api/persona/${id}/link`)
        .then((d) => setLink(d.permalink ?? null))
        .catch(() => setLink(null));
    }
  }, [id]);

  // Escape no destructivo: con el foco en un campo, Escape es del campo — jamás
  // cierra el panel con media respuesta escrita. Iba en burbuja y sin cortar el
  // evento, así que el mismo Escape seguía hasta el shell y cerraba TAMBIÉN la
  // conversación de atrás; `useEscape` va en captura y lo frena.
  // ⚠️ Apagado mientras el modal de moderación manda: los dos escuchan en
  // captura sobre `window` y un Escape cerraría los dos a la vez.
  useEscape(onCerrar, !modalDeModeracion);

  // Mesa de despacho: respondido + Enter = siguiente de la cola (si App la cableó).
  useEffect(() => {
    if (!enviado || !onSiguiente) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      e.preventDefault();
      onSiguiente();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enviado, onSiguiente]);

  /**
   * 🔴 **LA SUGERENCIA PÚBLICA SALE DEL CLIENTE DE LA PÁGINA**, y por eso esto
   * es un efecto y no un valor inicial: `cap` —que trae el módulo y el cliente
   * junto con si se puede el privado— llega DESPUÉS del primer render.
   *
   * La frase sale de `siguientePlantillaPublica` (`dominio/plantillaPublica`):
   * los textos del cliente de ESA Página, sorteados evitando repetir la última,
   * o la caja vacía si el cliente no tiene textos propios o no se sabe de quién
   * es. Hasta el 11-sep-2026 se elegía sólo por si se podía el privado, y en la
   * Página de Américo salieron textos de la Escuela y de Betto.
   *
   * ⚠️ **No hace falta una guarda contra el doble invoque de `StrictMode`
   * acá.** `useCapacidades` ya descarta la respuesta vieja con su propio
   * `vigente` (ver `puedeEscribirPrivado.ts`), así que `cap` pasa de `null` a
   * un valor real UNA sola vez por apertura — este efecto corre una sola vez
   * de verdad para esa transición, y no gasta dos tiradas del sorteo.
   */
  useEffect(() => {
    if (!cap || escribioEnLaPublica.current) return;
    setPublico(siguientePlantillaPublica(cap));
  }, [cap]);

  /**
   * ⚠️ **VA ANTES DEL `return null`, y no es estilo.** Un hook después de un
   * retorno temprano cambia la cantidad de hooks entre renders: al cerrar el
   * panel (`interaccion` pasa a `null`) React encuentra un hook de menos y tira.
   * Por eso el `id` se saca con `?.` y quien decide si el pedido sale es
   * `enabled`, no un `if`.
   *
   * Sólo para comentarios: un DM no tiene post ni se oculta, así que abrir un
   * mensaje no gasta un pedido a Meta.
   */
  const contexto = useContextoDelComentario(
    interaccion?.id ?? 0,
    interaccion?.tipo === 'comentario',
  );

  /**
   * LO QUE EL COMENTARIO YA TIENE, Y EL «LO TENGO ABIERTO» (13-sep-2026). Van
   * antes del `return null` por lo mismo que `contexto`.
   *
   * ⚠️ La presencia se apaga con `enviado`: quien ya respondió no «lo está
   * respondiendo», y seguir anunciándolo les diría a las demás algo falso.
   */
  const estadoDeRespuesta = useEstadoDeRespuesta(interaccion?.id ?? 0, interaccion?.tipo === 'comentario');
  usePresenciaEnComentario(interaccion?.id ?? 0, interaccion?.tipo === 'comentario' && !enviado);
  /** El celular cambia QUÉ se monta (el aviso fijo, la privada plegada), no sólo el estilo: por eso el hook. */
  const esMovil = useEsMovil();

  if (!interaccion) return null;

  const meta = TIPO_META[tipoDe(interaccion)];
  const esComentario = interaccion.tipo === 'comentario';
  const dias = daysSince(interaccion.occurred_at);
  const puedePrivado = cap?.puedePrivado ?? false;

  const yaTiene = estadoDeRespuesta.data ?? SIN_ESTADO;
  /**
   * Con respuestas previas, las cajas esperan a que la agente elija responder otra
   * vez. Y se vuelven a cerrar si desde entonces llegó otra.
   */
  const cajasCerradas =
    yaTiene.respuestas.length > 0 && (vistasAlDecidir === null || yaTiene.respuestas.length > vistasAlDecidir);
  const refrescarLoQueYaTiene = () => {
    if (id) void qc.invalidateQueries({ queryKey: claves.estadoDeRespuesta(id) });
  };
  /** Abre la privada (si estaba plegada, en el celular) y le da el foco cuando ya está montada. */
  const abrirPrivado = () => {
    setPrivadoAbierto(true);
    setTimeout(() => cajaPrivada.current?.focus(), 0);
  };
  /** Con algo escrito no se pliega nunca: esconder texto de la agente sería perderlo de vista. */
  const privadoPlegado = esMovil && !privadoAbierto && !privado.trim();

  // El nombre del canal se elige en UN solo lugar (`BadgeCanal`), o el día que
  // cambie —como pasó con Messenger— queda a medias entre dos archivos.
  const red = nombreCanal(interaccion.canal);
  const nombre =
    interaccion.persona_nombre ?? (interaccion.canal === 'instagram' ? 'Alguien en Instagram' : 'Usuario de Facebook');
  const avatarIniciales = iniciales(
    interaccion.persona_nombre ?? (interaccion.canal === 'instagram' ? 'IG' : 'FB'),
  );
  const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
  const fileteCanal = interaccion.canal === 'instagram' ? 'border-l-navy' : 'border-l-primary';

  /**
   * @param soloPublico la vendedora eligió publicar sola la respuesta pública
   *   después de que el privado falló: sale lo que tiene en la caja, sin privado.
   */
  async function enviar(soloPublico = false) {
    if (!interaccion) return;
    setEnviando(true);
    setError(null);
    setParcial(null);
    setPsid(null);
    setRetenido(null);

    // Por `api()` (Bearer incluido): esto publica en Facebook en nombre de
    // Goberna — es exactamente lo que el perímetro existe para custodiar.
    try {
      const res = await api<{ type: string; errores?: string[]; publico?: string; privado?: string; psid?: string }>(`/api/responder/${interaccion.id}`, {
        method: 'POST',
        // 🔴 SÓLO LOS DOS TEXTOS QUE ESTÁN EN PANTALLA. Hasta el 11-sep-2026
        // viajaba al lado un texto de repuesto de la Escuela, y el server lo
        // publicaba si el privado fallaba: en la Página de Américo salió 13
        // veces sin que nadie lo viera.
        body: JSON.stringify({
          mensajePublico: publico,
          mensajePrivado: !soloPublico && puedePrivado ? privado : '',
          // 🔴 CUÁNTAS RESPUESTAS PREVIAS TENÍA A LA VISTA (13-sep-2026). El server
          // frena el envío si el comentario ya tiene más: así «Responder otra vez»
          // no deja pasar la respuesta que otra agente mandó mientras ésta
          // escribía. Sin respuestas previas no viaja, y el cuerpo queda como antes.
          ...(vistasAlDecidir ? { respuestasVistas: vistasAlDecidir } : {}),
        }),
      });
      if (res.type === 'enviado' || res.type === 'parcial') {
        setEnviado(true);
        // `parcial` = salió uno de los dos y el otro no. Cuál, se lee de la respuesta.
        setParcial(
          res.type === 'parcial'
            ? {
                causa: res.errores?.join(' · ') ?? 'Uno de los dos envíos no salió.',
                salioElPublico: Boolean(res.publico),
              }
            : null,
        );
        /**
         * 🔴 EL PSID SÓLO SE GUARDA SI EL PRIVADO SALIÓ DE VERDAD.
         *
         * Es lo que decide si se ofrece «Seguir en Messenger». Apoyarse en que
         * el POST devolvió 200 no alcanza: con `parcial` puede haber salido sólo
         * el público, y ahí no hay ningún hilo que abrir. Ofrecerlo igual
         * repetiría la clase de defecto que este panel existe para evitar —
         * prometer algo que no pasó.
         */
        setPsid(res.privado && res.psid ? res.psid : null);
        onRespondido(interaccion.id);
        refrescarLoQueYaTiene();
      } else {
        setError(res.errores?.join(' · ') ?? 'No se pudo enviar.');
      }
    } catch (e) {
      // El 409 `privado_fallo` no es un error más: no salió nada y la vendedora
      // tiene una decisión que tomar (ver `retenido`).
      if (e instanceof ErrorApi && e.tipo === 'privado_fallo') {
        setRetenido(e.errores?.join(' · ') ?? e.message);
      } else if (e instanceof ErrorApi && (e.tipo === 'ya_respondido' || e.tipo === 'respondiendo')) {
        /**
         * 🔴 OTRA AGENTE SE ADELANTÓ (13-sep-2026). No salió nada. Las cajas se
         * vuelven a cerrar —lo escrito se conserva— y la lista trae la respuesta
         * nueva, para que decida viéndola. Queda la frase del server, que dice
         * quién respondió y qué.
         */
        setVistasAlDecidir(null);
        setError(e.errores?.join(' · ') ?? e.message);
        refrescarLoQueYaTiene();
      } else {
        setError(e instanceof ErrorApi ? (e.errores?.join(' · ') ?? e.message) : 'No se pudo enviar.');
      }
    } finally {
      setEnviando(false);
    }
  }

  async function borrar() {
    if (!interaccion) return;
    setEnviando(true);
    try {
      const res = await api<{ type: string }>(`/api/responder/${interaccion.id}`, { method: 'DELETE' });
      if (res.type === 'borrado') {
        setEnviado(false);
        setError(null);
        setParcial(null);
        setPsid(null);
        refrescarLoQueYaTiene();
      } else {
        setError('No se pudo borrar.');
      }
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo borrar.');
    } finally {
      setEnviando(false);
    }
  }

  // Vive en la columna central (des-modalizado): la cola y el panel de contexto
  // siguen visibles mientras se responde — la mesa no se tapa a sí misma.
  return (
    // En el celular ocupa la pantalla entera, con las mismas clases `max-md:`
    // que `HiloWhatsapp` (ver el comentario de su contenedor).
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-panel max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:z-30 max-md:h-dvh max-md:rounded-none max-md:shadow-none">
        {/* La misma cabecera que WhatsApp y Messenger (08-sep-2026, pedido del
            dueño) — ver `CabeceraDeChat`. El chip Comentario/Mensaje (`meta`)
            viaja como `extra`, pegado al bloque de nombre — es la marca de
            ESTE canal, no una acción, así que no compite con `BarraGestion`.
            Sin botón de cerrar: WhatsApp y Messenger tampoco lo tienen —
            `Escape` (`useEscape` arriba) y elegir otra fila de la cola hacen
            lo mismo. */}
        <CabeceraDeChat
          conversacion={conversacion}
          miVendedora={miVendedora}
          esDeCampana={esDeCampana}
          onAbrirOtra={onAbrirOtra}
          senales={senales}
          onVolver={onVolver}
          avatar={
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[11px] bg-secondary font-heading text-xs font-bold text-navy-ink">
              {avatarIniciales}
            </span>
          }
          nombre={
            <>
              {interaccion.canal === 'instagram' && interaccion.persona_nombre ? '@' : ''}
              {nombre}
            </>
          }
          subtitulo={
            <>
              {red} · {cuando}
            </>
          }
          extra={
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.chip}`}>
              <meta.icon size={11} />
              {meta.label}
            </span>
          }
        />

        {/*
          📱 EL AVISO DE PRESENCIA, FIJO BAJO LA CABECERA (ADR 0121). En el celular
          el cuerpo es una sola columna que se scrollea, y adentro el aviso se iba
          hacia arriba justo mientras la agente escribe. Afuera del scroll no se va.
          En la mesa ancha sigue donde estaba, en `YaRespondido`.
        */}
        {esMovil && esComentario && yaTiene.respondiendo.length > 0 && (
          <div className="shrink-0 border-b border-border bg-card px-3 py-2">
            <AvisoDePresencia respondiendo={yaTiene.respondiendo} conRespuestas={yaTiene.respuestas.length > 0} />
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden p-4 max-md:px-3">
          {/*
            ══ EL ORDEN DE LECTURA, INVERTIDO A PROPÓSITO (fases 2 y 12) ══════

            Hasta el 25-ago-2026 esto empezaba por el comentario y dejaba la
            publicación como un renglón al pie («Comentó en: …»). Se lee al
            revés de como se decide: nadie puede juzgar un «C👏👏👏» —ni saber si
            ocultarlo— sin saber sobre qué se comentó. El contexto va primero.

            🔴 **LA TARJETA SE DIBUJA SIEMPRE, aunque Meta no conteste.**
            Antes se dibujaba SÓLO con la respuesta de Meta y, sin ella, caía a
            un renglón suelto («Comentó en: …»). O sea que la pantalla cambiaba
            de FORMA según si el token de la Página funcionaba — y quien la
            abría no tenía cómo saber por qué a veces era una publicación y a
            veces una frase.

            El texto del post ya lo teníamos guardado (`contexto_texto`), así
            que el respaldo entra por la misma tarjeta y lo que falta —imagen,
            autor, fecha— simplemente no se dibuja. La jerarquía de la fase 12
            se sostiene con Meta caído.

            ⚠️ **Lo guardado NUNCA le gana a lo de Meta**: el `??` sólo entra
            cuando no hay post. Al revés se mostraría una copia vieja del texto
            cuando tenemos el actual al lado.
          */}
          {(contexto.data?.post ?? (interaccion.contexto_texto ? { texto: interaccion.contexto_texto, imagen: null, enlace: null } : null)) && (
            <PublicacionOriginal
              interactionId={interaccion.id}
              post={
                contexto.data?.post ?? {
                  texto: interaccion.contexto_texto,
                  imagen: null,
                  enlace: null,
                }
              }
            />
          )}

          {/*
            ══ EL COMENTARIO (fase 4) ════════════════════════════════════════

            Va debajo, con su propio título, para que se lea como respuesta a lo
            de arriba y no como el tema principal.
          */}
          <section>
            <h3 className="mb-2 flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <span>Comentario de {nombre}</span>
              <span className="font-normal normal-case tracking-normal">{cuando}</span>
            </h3>

            {contexto.data?.estado?.is_hidden === true && <AvisoDeOculto />}

            {/*
              El contenido se dibuja según de qué está hecho (fases 5 y 14): una
              burbuja si es texto, los emojis grandes si es sólo eso, y nada si
              viene vacío — que es el caso del sticker, cuyo `message` Meta manda
              en blanco y cuyo contenido pone `AdjuntoDelComentario`.
            */}
            <ContenidoDelComentario texto={interaccion.texto} fileteCanal={fileteCanal} />

            {contexto.data?.adjunto && (
              <AdjuntoDelComentario adjunto={contexto.data.adjunto} interactionId={interaccion.id} />
            )}

            {!interaccion.texto?.trim() && !contexto.data?.adjunto && !contexto.isPending && (
              // Decirlo es mejor que dejar el hueco: «no trae texto» y «no cargó»
              // se ven igual cuando no hay nada.
              <p className="text-sm italic text-muted-foreground">
                Este comentario no trae texto ni imagen que podamos mostrar.
              </p>
            )}

            {/*
              El enlace al COMENTARIO, que no es el mismo que el de la
              publicación: éste es el que sirve para moderarlo desde Facebook.
              Los dos existían antes sin decir a cuál llevaba cada uno.
            */}
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                Ver este comentario en {red}
                <ExternalLink size={11} />
              </a>
            )}
          </section>

          {esComentario ? (
            <>
              <AccionesDelComentario
                interactionId={interaccion.id}
                estado={contexto.data?.estado ?? {}}
                degradado={contexto.data?.degradado}
                cargando={contexto.isPending}
                cap={cap}
                onEscribirPublico={() => cajaPublica.current?.focus()}
                onEscribirPrivado={abrirPrivado}
                onModal={setModalDeModeracion}
              />

              <YaRespondido
                // Por comentario: sin `key`, la lista plegada o abierta del anterior quedaría en el siguiente.
                key={interaccion.id}
                estado={yaTiene}
                red={red}
                sinLista={enviado}
                sinPresencia={esMovil}
                plegable={esMovil}
                otraVez={!cajasCerradas}
                onResponderOtraVez={() => {
                  setVistasAlDecidir(yaTiene.respuestas.length);
                  setError(null);
                  // Las cajas recién se montan en el próximo render.
                  setTimeout(() => cajaPublica.current?.focus(), 0);
                }}
              />

              {enviado ? (
                <EstadoEnviado
                  parcial={parcial}
                  psid={psid}
                  red={red}
                  enviando={enviando}
                  onBorrar={borrar}
                  onSiguiente={onSiguiente}
                />
              ) : cajasCerradas ? null : (
                /*
                  ══ LAS DOS RESPUESTAS, LADO A LADO (fase 8) ══════════════════
                  Apiladas, la privada quedaba debajo del pliegue y se escribía
                  sin verla — que es justo la que lleva la información de verdad.
                  Mismo peso visual: la decisión de cuál usar es de quien
                  responde, no del diseño.
                */
                <div className="grid gap-3 lg:grid-cols-2">
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className={`flex items-center gap-1.5 ${sectionLabel}`}>
                      <MessageCircle size={12} /> Respuesta pública
                    </span>
                    <textarea
                      ref={cajaPublica}
                      value={publico}
                      onChange={(e) => {
                        escribioEnLaPublica.current = true;
                        setPublico(e.target.value);
                      }}
                      placeholder="Lo que ve todo el mundo…"
                      className="min-h-24 w-full resize-y rounded-xl border border-border bg-muted p-3 text-sm text-foreground outline-none transition-colors focus:border-primary max-md:min-h-20 max-md:text-base"
                    />
                    <span className="text-[11px] leading-snug text-muted-foreground">
                      Todos podrán verla en la publicación.
                    </span>
                  </label>

                  {privadoPlegado ? (
                    /*
                      📱 LA PRIVADA, PLEGADA (ADR 0121). Apagada, el botón también
                      dice por qué: es donde la agente intenta abrirla, y la frase
                      sale de `porQueNoPuedePrivado`, la misma que la caja.
                    */
                    <div className="flex min-w-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={abrirPrivado}
                        disabled={!puedePrivado}
                        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:text-muted-foreground"
                      >
                        <Plus size={14} />
                        Mensaje privado
                      </button>
                      {!puedePrivado && (
                        <span className="text-[11px] leading-snug text-muted-foreground">
                          {cap ? porQueNoPuedePrivado(cap) : 'Viendo si Meta deja escribirle en privado…'}
                        </span>
                      )}
                    </div>
                  ) : (
                  <label className={'flex min-w-0 flex-col gap-1.5 ' + (puedePrivado ? '' : 'opacity-40')}>
                    <span className={`flex items-center gap-1.5 ${sectionLabel}`}>
                      <Lock size={12} /> Respuesta privada
                      <span className="rounded-full bg-secondary px-1.5 py-px font-normal normal-case tracking-normal text-secondary-foreground">
                        por Messenger
                      </span>
                    </span>
                    <textarea
                      ref={cajaPrivada}
                      value={privado}
                      onChange={(e) => setPrivado(e.target.value)}
                      disabled={!puedePrivado}
                      /*
                        🔴 **APAGADA, LA CAJA DICE POR QUÉ — antes decía sólo QUE
                        no se puede.** «Meta no permite escribirle en privado a
                        esta persona» es cierto para los cuatro motivos y no
                        distingue el que la vendedora podía evitar (se pasó de los
                        7 días) del que no dependía de ella (esa persona no acepta
                        mensajes de páginas). Es el lugar donde INTENTA escribir,
                        así que es donde el motivo tiene que estar.

                        ⚠️ **La frase sale de `porQueNoPuedePrivado`, no se
                        escribe acá.** Esta caja y la card apagada de
                        `AccionesDelComentario` hablan del mismo hecho a diez
                        centímetros de distancia, y ya habían divergido una vez:
                        la card decía «Esta persona no acepta mensajes de páginas»
                        y esta caja, la frase genérica. Es #37 en su forma más
                        barata de arreglar y más cara de detectar — las dos se
                        veían bien por separado.
                      */
                      placeholder={
                        puedePrivado
                          ? 'La información de verdad va acá: fecha, lugar, precio, cómo inscribirse…'
                          : cap
                            ? porQueNoPuedePrivado(cap)
                            : 'Viendo si Meta deja escribirle en privado…'
                      }
                      className="min-h-24 w-full resize-y rounded-xl border border-border bg-muted p-3 text-sm text-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed max-md:min-h-20 max-md:text-base"
                    />
                    <span className="text-[11px] leading-snug text-muted-foreground">
                      No será visible en la publicación.
                    </span>
                  </label>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Con las cajas cerradas no hay nada escrito que publicar: llegó otra respuesta después del fallo. */}
              {retenido && !cajasCerradas && (
                /*
                  🔴 EL PRIVADO FALLÓ Y NO SALIÓ NADA (11-sep-2026). Antes el
                  server publicaba acá un texto de repuesto que nadie veía. Ahora
                  decide la vendedora: la causa a la vista, y un botón que publica
                  sola la respuesta pública tal como está en la caja —que sigue
                  editable arriba, por si quiere cambiarla antes—.
                */
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold">No se publicó nada.</p>
                      <p className="mt-1 text-xs leading-relaxed">{retenido}</p>
                      {publico.trim() && (
                        <p className="mt-1 text-xs leading-relaxed text-foreground">
                          La respuesta pública no sale sola cuando el privado falla. Si igual quieres
                          dejarla en {red}, revísala arriba y publícala sin el privado.
                        </p>
                      )}
                    </div>
                  </div>
                  {publico.trim() && (
                    <button
                      type="button"
                      onClick={() => void enviar(true)}
                      disabled={enviando}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:opacity-50"
                    >
                      <MessageCircle size={12} />
                      {enviando ? 'Publicando…' : 'Publicar solo la respuesta pública'}
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            /**
             * 🔴 RAMA MUERTA, Y ADEMÁS MENTIROSA. Decía «Todavía no se puede
             * responder a los mensajes de Messenger desde acá» — pero
             * `ConversacionActiva` desvía TODO `tipo='mensaje'` a
             * `HiloMessenger` antes de llegar acá, así que nunca se renderizó.
             * Y desde que el privado abre una conversación, esa frase se
             * contradice con la pantalla de al lado.
             */
            null
          )}
        </div>

        {/*
            EL PIE, EN UNA SOLA LÍNEA (26-ago-2026). Antes era un bloque de ancho
            completo con el texto de ayuda centrado debajo: ~104 px de alto para
            una sola acción, en una mesa que a 1280×720 pelea por cada píxel.
            Ahora la ayuda va a la izquierda y el botón a la derecha: ~56 px.

            🔴 **SIGUE SIENDO UN SOLO BOTÓN, Y ESO NO ES ESTÉTICA.** La propuesta
            original era un «Enviar» por caja. No se puede: `POST
            /api/responder/:id` recibe los DOS textos y manda el privado PRIMERO,
            y si el privado falla no publica nada: la vendedora decide, con otro
            clic, si publica sola la respuesta pública. Es una transacción. Dos botones
            independientes habilitan publicar el público prometiendo un privado
            que nunca salió, que es exactamente el defecto que este panel existe
            para evitar (ver el docblock de arriba: «se aprendió rompiéndolo»), y
            ningún test lo vería, porque cada envío por separado funciona bien.

            ⚠️ **El `aria-label` CONTIENE la palabra visible.** Un nombre
            accesible que no incluya el rótulo que se ve rompe el «Label in Name»
            de WCAG: quien maneja la app por voz dice «Enviar» y el comando no
            engancha con un botón que se llama «Responder a esta persona».

            ⚠️ Con las cajas cerradas por respuestas previas no hay pie: no hay
            nada escrito que enviar (13-sep-2026).
          */}
        {esComentario && !enviado && !cajasCerradas && (
          /*
            📱 En el celular el pie queda pegado abajo con el botón a lo ancho, y
            deja libre la zona segura del iPhone, igual que `HiloMessenger`. La
            ayuda se esconde: en 390 px empujaba el botón a media pantalla.
          */
          <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-4 py-2.5 max-md:px-3 max-md:pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
            <p className="text-[11px] leading-snug text-muted-foreground max-md:hidden">
              Se envía solo a esta persona. Puedes borrarlo después.
            </p>
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={enviando || !publico.trim()}
              aria-label="Enviar la respuesta a esta persona"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground max-md:flex-1 max-md:justify-center max-md:py-2.5 max-md:text-sm transition-transform duration-200 ease-house hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 active:scale-[0.98] disabled:opacity-40"
            >
              <Send size={14} />
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </footer>
        )}
    </div>
  );
}
