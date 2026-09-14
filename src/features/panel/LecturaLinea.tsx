import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import {
  autorDe,
  lecturaDe,
  opcionesDeCorreccion,
  pideVeredicto,
  valorRevocado,
  type Afirmacion,
  type Veredicto,
} from '../../dominio/lecturas';

/**
 * UN RENGLÓN DE LO QUE EL SISTEMA LEYÓ, AL LADO DEL CHAT (ADR 0095 §7).
 *
 * La política vive en `dominio/lecturas.ts`; acá se dibuja y se cablea. Es un
 * componente aparte de `EventoLinea` y no una rama adentro: ese ya lleva cinco
 * tipos de evento con sus propios estados, y una fila que pide un VEREDICTO no
 * se parece a ninguno — tiene acciones que escriben contra una regla.
 *
 * ── DOS DECISIONES DE FORMA QUE NO SON COSMÉTICAS ───────────────────────────
 *
 * 1. 🔴 **Las acciones van SIEMPRE VISIBLES**, y no al hover como Editar y
 *    Borrar de un evento humano. Son la única fuente de correcciones etiquetadas
 *    que el sistema va a tener —hoy hay cero— y esconderlas detrás de un puntero
 *    las mata en la hoja de contacto en móvil, donde no hay hover, y las esconde
 *    de quien no sabe que existen. Editar un evento propio es mantenimiento;
 *    esto es juicio.
 * 2. 🔴 **La evidencia es un ANCLA al mensaje, no una cita suelta.** El timeline
 *    está al lado del chat: tocar la cita lleva el hilo al mensaje exacto. Es la
 *    lección de ADR 0018 —el juicio se da con el contexto delante— aplicada
 *    donde sale gratis. Una cita copiada envejece; un ancla no. Y por eso no hay
 *    modal: un modal tapa justo lo que hay que mirar para decidir.
 */
export function LecturaLinea({
  a,
  esUltima,
  onVeredicto,
  onVerMensaje,
}: {
  a: Afirmacion;
  esUltima: boolean;
  /**
   * 🔴 **Recibe la REGLA, y ése es todo el punto del ticket.** La corrección se
   * registra contra la regla que produjo el dato (`escucha.apoyo`), no contra la
   * conversación: de ahí sale la precisión por regla, que es lo que autoriza a
   * una regla a pasar de «sugiere» a «declara» (ADR 0095 §8). Sin la regla en
   * esta firma, el clic escribe una corrección que no sirve para aprender.
   */
  onVeredicto?: (id: string, veredicto: Veredicto, regla: string, valor?: string) => void;
  /** Lleva el hilo al mensaje citado. Sin handler la cita se dibuja sin enlace. */
  onVerMensaje?: (evidencia: string) => void;
}) {
  const l = lecturaDe(a);
  const revocado = valorRevocado(a);
  const opciones = opcionesDeCorreccion(a.dimension);
  const decide = pideVeredicto(a) && onVeredicto != null;
  const [corrigiendo, setCorrigiendo] = useState(false);

  function dictaminar(veredicto: Veredicto, valor?: string) {
    onVeredicto?.(l.id, veredicto, l.regla, valor);
    setCorrigiendo(false);
  }

  return (
    <li className="relative flex gap-3 py-1.5 pl-1" data-lectura={l.id}>
      {/* EL PUNTO DICE QUIÉN, con la misma forma que el chip de la tarjeta:
          punteado = lo escribió una máquina y todavía nadie lo miró. Al
          dictaminarlo pasa a lleno, porque ahora lo sostiene una persona.
          No se inventó acá: `EventoLinea` ya usaba el aro punteado para
          «pendiente», que es la misma familia de «todavía no es un hecho». */}
      <span
        aria-hidden
        data-punto={l.veredicto ? 'resuelto' : 'sistema'}
        className={
          'relative z-10 mt-1 size-2.5 shrink-0 rounded-full ' +
          (l.veredicto ? 'bg-success' : 'border-2 border-dashed border-muted-foreground/50 bg-card')
        }
      />
      <span
        aria-hidden
        data-ultimo={esUltima || undefined}
        className="absolute bottom-[-0.375rem] left-2 top-4 w-px bg-border data-[ultimo]:hidden"
      />

      <div className="min-w-0 flex-1 pb-2">
        <div className="flex items-baseline gap-2">
          {/* EL VERBO Y EL VALOR, juntos. El verbo va en tinta apagada porque es
              la gramática de la fila —siempre uno de cuatro— y lo que hay que
              leer de un vistazo es QUÉ leyó, no que leyó. */}
          <span className="min-w-0 truncate text-xs">
            <span className="font-medium text-muted-foreground">{l.verbo}: </span>
            <span className="font-semibold text-foreground">{l.que}</span>
          </span>
          {l.confianza && (
            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
              · {l.confianza}
            </span>
          )}
          <time className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {hora(l.ocurridoAt)}
          </time>
        </div>

        {/* QUÉ MÁS, Y QUIÉN LO DIJO. El valor revocado va tachado al lado del
            vigente: corregir revoca, no borra, y los dos en la misma frase sin
            marca se leerían como dos datos. */}
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {l.detalle && <span>{l.detalle} · </span>}
          <span className="font-medium">{autorDe(l)}</span>
          {revocado && (
            <span>
              {' · antes decía '}
              <s className="text-muted-foreground/70 decoration-border">{revocado}</s>
            </span>
          )}
        </p>

        {l.cita && (
          <CitaDelMensaje
            texto={l.cita}
            onVer={l.evidencia && onVerMensaje ? () => onVerMensaje(l.evidencia!) : undefined}
          />
        )}

        {decide && !corrigiendo && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Accion principal onClick={() => dictaminar('acepta')}>
              <Check size={11} aria-hidden /> Está bien
            </Accion>
            {/* Sin lista cerrada de valores no se ofrece: mejor no ofrecer la
                acción que ofrecerla mutilada (`opcionesDeCorreccion`). */}
            {opciones.length > 0 && (
              <Accion onClick={() => setCorrigiendo(true)}>
                <Pencil size={11} aria-hidden /> Corregir
              </Accion>
            )}
            {/* El tercer veredicto: la lectura no está mal ni bien, el mensaje
                no venía al caso. Sin él eso se mete adentro de «Corregir» con un
                valor cualquiera y ensucia la precisión donde se la mide. */}
            <Accion onClick={() => dictaminar('no_aplica')}>No aplica</Accion>
          </div>
        )}

        {corrigiendo && (
          /* La corrección pasa EN LA FILA, sin modal — igual que «¿Borrar del
             timeline?» de `EventoLinea`. Un modal taparía el chat, que es contra
             lo que se verifica la lectura. */
          <div className="mt-1.5">
            <p className="text-[11px] text-foreground">¿Qué dice en realidad?</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {opciones.map((o) => (
                <Accion key={o.valor} onClick={() => dictaminar('corrige', o.valor)}>
                  {o.rotulo}
                </Accion>
              ))}
              <Accion onClick={() => setCorrigiendo(false)}>
                <X size={11} aria-hidden /> Cancelar
              </Accion>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * LA CITA, que es lo que vuelve verificable a la fila.
 *
 * Sin `onVer` se dibuja el texto y **no** el enlace: un «ver el mensaje» que no
 * lleva a ningún lado es peor que no ofrecerlo — la misma regla por la que el
 * repo no dibuja botones sin handler.
 */
function CitaDelMensaje({ texto, onVer }: { texto: string; onVer?: () => void }) {
  const cuerpo = (
    <>
      <span className="block italic">«{texto}»</span>
      {onVer && (
        <span className="mt-0.5 block font-heading text-[10.5px] font-semibold not-italic text-primary">
          ver el mensaje en el chat ↗
        </span>
      )}
    </>
  );
  const clase = 'mt-1 block w-full border-l-2 border-riel py-0.5 pl-2 text-left text-[11.5px] text-foreground';
  return onVer ? (
    <button type="button" onClick={onVer} className={clase + ' transition-colors hover:border-primary'}>
      {cuerpo}
    </button>
  ) : (
    <p className={clase}>{cuerpo}</p>
  );
}

function Accion({
  children,
  principal = false,
  onClick,
}: {
  children: React.ReactNode;
  principal?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-heading text-[11px] font-semibold transition-colors ' +
        (principal
          ? 'border-navy bg-navy text-white hover:bg-navy/90'
          : 'border-border bg-card text-navy-ink hover:bg-secondary')
      }
    >
      {children}
    </button>
  );
}

function hora(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
}
