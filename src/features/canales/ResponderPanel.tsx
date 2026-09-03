import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Lock, MessageCircle, Send, Trash2, X } from 'lucide-react';
import { api, ErrorApi } from '../../lib/datos/cliente';
import { sectionLabel } from '../../lib/styles';
import { iniciales } from '../../lib/iniciales';
import { useEscape } from '../../lib/teclado/useEscape';
import type { Interaccion } from './types';
import { TIPO_META, tipoDe } from './tipos';
import { daysSince } from '../leads/temperature';
import { porQueNoPuedePrivado, useCapacidades } from './puedeEscribirPrivado';
import AccionesDelComentario from './AccionesDelComentario';
import { AvisoDeOculto, ContenidoDelComentario } from './ContenidoDelComentario';
import { siguientePlantillaPublica } from '../../dominio/plantillaPublica';
import { nombreCanal } from '../../components/BadgeCanal';
import {
  AdjuntoDelComentario,
  PublicacionOriginal,
  useContextoDelComentario,
} from './ContextoDelComentario';

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
 */

const PLANTILLA_PUBLICA_SOLA =
  'Hola — con gusto. Escríbenos por mensaje privado y te mandamos el programa completo con fechas y precios.';

interface Props {
  interaccion: Interaccion | null;
  onCerrar: () => void;
  onRespondido: (id: number) => void;
  /** Modo racha (Fase 3): si App la pasa, el «Respondido» ofrece saltar a la siguiente de la cola. */
  onSiguiente?: () => void;
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
  /** Salió el público y el privado NO. La respuesta SÍ está publicada. */
  parcial: string | null;
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
              {parcial ? 'Respondido solo en público' : 'Respondido'}
            </div>
            {parcial ? (
              <>
                <p className="mt-1 text-xs leading-relaxed text-gold-ink">
                  Tu comentario público sí se publicó en {red}, pero <strong>el mensaje privado no
                  salió</strong>, así que esa persona sigue esperando. Para que no quedara una promesa
                  falsa, se publicó el texto que <em>no</em> da por hecho el privado.
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  Qué pasó: {parcial}
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

export default function ResponderPanel({ interaccion, onCerrar, onRespondido, onSiguiente }: Props) {
  const [publico, setPublico] = useState('');
  const [privado, setPrivado] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Salió el público pero NO el privado. Es su propio estado y no un error,
   * porque la respuesta SÍ está publicada: tratarlo como fallo haría que la
   * vendedora la mande de nuevo y termine con dos comentarios en el post.
   */
  const [parcial, setParcial] = useState<string | null>(null);
  /**
   * El PSID de la conversación de Messenger que el privado abrió. Sólo se
   * setea si el privado salió: es lo que habilita «Seguir en Messenger».
   */
  const [psid, setPsid] = useState<string | null>(null);
  /**
   * Las dos cajas, para que las cards de arriba puedan bajar el foco. Es lo que
   * convierte «Responder en público» de un rótulo en una acción (fase 7).
   */
  const cajaPublica = useRef<HTMLTextAreaElement>(null);
  const cajaPrivada = useRef<HTMLTextAreaElement>(null);
  /** ¿El modal de ocultar/eliminar está abierto? Decide de quién es el Escape. */
  const [modalDeModeracion, setModalDeModeracion] = useState(false);

  const id = interaccion?.id;
  const cap = useCapacidades(id);

  useEffect(() => {
    setPublico('');
    setPrivado('');
    // `cap` ya no se limpia acá: lo maneja `useCapacidades`, que lo pone en
    // `null` al cambiar de comentario y descarta la respuesta que llega tarde.
    setLink(null);
    setEnviado(false);
    setError(null);
    setParcial(null);
    setPsid(null);
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
   * 🔴 **LA PLANTILLA PÚBLICA DEPENDE DE SI EL PRIVADO SE PUEDE**, y por eso
   * esto es un efecto y no un valor inicial: `cap` llega DESPUÉS del primer
   * render. Sin esto, el texto sugerido diría «te escribimos por privado» sobre
   * un comentario al que Meta no deja escribirle — la promesa falsa que este
   * panel entero existe para no volver a publicar.
   *
   * Cuando sí se puede, la frase sale de `siguientePlantillaPublica`
   * (`dominio/plantillaPublica`), sorteada evitando repetir la última — el
   * porqué de sortear (y no repetir siempre la misma) está allá.
   *
   * ⚠️ **No hace falta una guarda contra el doble invoque de `StrictMode`
   * acá.** `useCapacidades` ya descarta la respuesta vieja con su propio
   * `vigente` (ver `puedeEscribirPrivado.ts`), así que `cap` pasa de `null` a
   * un valor real UNA sola vez por apertura — este efecto corre una sola vez
   * de verdad para esa transición, y no gasta dos tiradas del sorteo.
   */
  useEffect(() => {
    if (!cap) return;
    setPublico(cap.puedePrivado ? siguientePlantillaPublica() : PLANTILLA_PUBLICA_SOLA);
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

  if (!interaccion) return null;

  const meta = TIPO_META[tipoDe(interaccion)];
  const esComentario = interaccion.tipo === 'comentario';
  const dias = daysSince(interaccion.occurred_at);
  const puedePrivado = cap?.puedePrivado ?? false;

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

  async function enviar() {
    if (!interaccion) return;
    setEnviando(true);
    setError(null);
    setParcial(null);
    setPsid(null);

    // Por `api()` (Bearer incluido): esto publica en Facebook en nombre de
    // Goberna — es exactamente lo que el perímetro existe para custodiar.
    try {
      const res = await api<{ type: string; errores?: string[]; privado?: string; psid?: string }>(`/api/responder/${interaccion.id}`, {
        method: 'POST',
        body: JSON.stringify({
          mensajePublico: publico,
          // 🔴 EL TEXTO DE REPUESTO, y por qué viaja SIEMPRE.
          //
          // Si el privado falla, el server publica ESTE en lugar del de arriba
          // — que típicamente dice «te escribimos por privado» y sería mentira.
          // Sin él, el server corta con 409 y no se publica NADA: es lo que
          // dejó a la campaña sin poder responder ni en público (24-ago-2026).
          mensajePublicoSinPrivado: PLANTILLA_PUBLICA_SOLA,
          mensajePrivado: puedePrivado ? privado : '',
        }),
      });
      if (res.type === 'enviado' || res.type === 'parcial') {
        setEnviado(true);
        // `parcial` = el comentario público está publicado y el privado no salió.
        setParcial(res.type === 'parcial' ? (res.errores?.join(' · ') ?? null) : null);
        /**
         * 🔴 EL PSID SÓLO SE GUARDA SI EL PRIVADO SALIÓ DE VERDAD.
         *
         * Es lo que decide si se ofrece «Seguir en Messenger». Apoyarse en que
         * el POST devolvió 200 no alcanza: con `parcial` el 200 significa que
         * salió el público y el privado NO, y ahí no hay ningún hilo que abrir.
         * Ofrecerlo igual repetiría la clase de defecto que este panel existe
         * para evitar — prometer algo que no pasó.
         */
        setPsid(res.privado && res.psid ? res.psid : null);
        onRespondido(interaccion.id);
      } else {
        setError(res.errores?.join(' · ') ?? 'No se pudo enviar.');
      }
    } catch (e) {
      setError(
        e instanceof ErrorApi ? (e.errores?.join(' · ') ?? e.message) : 'No se pudo enviar.',
      );
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
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-panel">
        {/* Cabecera del contacto — la misma anatomía en los tres canales */}
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[11px] bg-secondary font-heading text-xs font-bold text-navy-ink">
              {avatarIniciales}
            </span>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-heading text-sm font-bold text-foreground">
                  {interaccion.canal === 'instagram' && interaccion.persona_nombre ? '@' : ''}
                  {nombre}
                </span>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.chip}`}>
                  <meta.icon size={11} />
                  {meta.label}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {red} · {cuando}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden p-4">
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

            {contexto.data?.adjunto && <AdjuntoDelComentario adjunto={contexto.data.adjunto} />}

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
                onEscribirPrivado={() => cajaPrivada.current?.focus()}
                onModal={setModalDeModeracion}
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
              ) : (
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
                      onChange={(e) => setPublico(e.target.value)}
                      placeholder="Lo que ve todo el mundo…"
                      className="min-h-24 w-full resize-y rounded-xl border border-border bg-muted p-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                    />
                    <span className="text-[11px] leading-snug text-muted-foreground">
                      Todos podrán verla en la publicación.
                    </span>
                  </label>

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
                      className="min-h-24 w-full resize-y rounded-xl border border-border bg-muted p-3 text-sm text-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed"
                    />
                    <span className="text-[11px] leading-snug text-muted-foreground">
                      No será visible en la publicación.
                    </span>
                  </label>
                </div>
              )}

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
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
            y si el privado falla publica `mensajePublicoSinPrivado` — un texto
            distinto que no promete nada. Es una transacción. Dos botones
            independientes habilitan publicar el público prometiendo un privado
            que nunca salió, que es exactamente el defecto que este panel existe
            para evitar (ver el docblock de arriba: «se aprendió rompiéndolo»), y
            ningún test lo vería, porque cada envío por separado funciona bien.

            ⚠️ **El `aria-label` CONTIENE la palabra visible.** Un nombre
            accesible que no incluya el rótulo que se ve rompe el «Label in Name»
            de WCAG: quien maneja la app por voz dice «Enviar» y el comando no
            engancha con un botón que se llama «Responder a esta persona».
          */}
        {esComentario && !enviado && (
          <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-border px-4 py-2.5">
            <p className="text-[11px] leading-snug text-muted-foreground">
              Se envía solo a esta persona. Puedes borrarlo después.
            </p>
            <button
              type="button"
              onClick={enviar}
              disabled={enviando || !publico.trim()}
              aria-label="Enviar la respuesta a esta persona"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-transform duration-200 ease-house hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 active:scale-[0.98] disabled:opacity-40"
            >
              <Send size={14} />
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </footer>
        )}
    </div>
  );
}
