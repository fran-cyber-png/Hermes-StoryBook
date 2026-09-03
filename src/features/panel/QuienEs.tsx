import { useState } from 'react';
import { Link2, Mail, Pencil, UserRound } from 'lucide-react';
import { encabezadoSeccion } from './estiloSeccion';
import { PRIORIDADES, type FichaLocal } from './fichaLocal';
import type { Ficha } from '../cerberus/ficha';
import { etiquetaFuente, type LeadForm } from '../cerberus/leadForm';
import { useUnificado } from '../identidad/enlaces';
import { BuscadorContactos } from '../identidad/BuscadorContactos';
import { nombreCanal } from '../../components/BadgeCanal';
import { etiquetaDeOrigen } from '../identidad/etiquetaOrigen';
import type { DestinoCorreo } from '../../lib/puente';

/**
 * QUIÉN ES — EL ÚNICO BLOQUE DE IDENTIDAD DEL PANEL.
 *
 * ══ LA PREGUNTA QUE LO ORIGINA ═════════════════════════════════════════════
 *
 * *«La ficha de Cerberus y la ficha del contacto prácticamente deberían ser la
 * misma, ¿no?»* — el dueño, 24-ago-2026, con dos capturas.
 *
 * Sí. Contestan la MISMA pregunta —quién es esta persona— desde FUENTES
 * distintas, y el panel las dibujaba como **un bloque por fuente**: la ficha
 * rápida de Hermes, la ficha de Cerberus y «Del formulario web». El resultado
 * medido en su captura (un cliente real, anonimizado acá):
 *
 *   · `un correo real de 30 caracteres` **dos veces**, cada una con su propio
 *     botón «Escribirle» — dos controles que hacen lo mismo, a 40 px.
 *   · «Diploma Élite del Gestor Parlamentario» **dos veces** (la meta del
 *     encabezado y «Del formulario web»).
 *   · La compra de 300 PEN del 28/04 **dos veces** (el timeline y «Compras»).
 *
 * 🔴 **Y la precedencia YA EXISTÍA: lo que no la seguía era el DIBUJO.**
 * `panel/identidad.ts` arbitra el nombre (Cerberus > formulario > alias de
 * WhatsApp, #118) y `fichaLocal.ts:prellenar` arbitra los cinco campos del
 * drawer (anotado > Cerberus > formulario > alias). O sea que el repo ya sabía
 * cuál gana para cada hecho — pero la pantalla, en vez de resolver el hecho una
 * vez, renderizaba cada fuente por separado.
 *
 * 🔴 **La prueba de que no es una opinión de estilo**: `BloqueLeadForm` ya
 * recibía `sinNombre={embebida}`, un parche por-bloque para tapar exactamente
 * esta repetición en el campo donde más gritaba. Se venían tapando de a uno. La
 * regla acá es la misma que el repo aplica a las fronteras: no se parchea ruta
 * por ruta, se arregla el seam.
 *
 * ══ LA REGLA ═══════════════════════════════════════════════════════════════
 *
 * **UN CAMPO POR HECHO, resuelto por precedencia, con la FUENTE anotada al
 * lado** — nunca un bloque por fuente. La fuente no es decoración: es lo que
 * separa «lo dijo el cliente en el chat» de «lo firmó en Cerberus», y ADR 0017
 * ya exigía «la procedencia a la vista» para el nombre.
 *
 * ⚠️ **Lo que NO entra acá, a propósito**: las COMPRAS. Un folio con estado,
 * fecha y monto no es un campo de identidad, es una transacción — otra forma,
 * otra pregunta («qué compró»), y se sigue leyendo en `FichaContacto`.
 */

type Campo = {
  rotulo: string;
  valor: string;
  /** De dónde salió. Vacío = no hace falta decirlo (lo anotó quien mira). */
  fuente?: string;
  mono?: boolean;
  /** Sólo el correo: mandar un mail. Va UNA vez, en el campo que lo tiene. */
  onCorreo?: () => void;
};

export function QuienEs({
  clave,
  nombreActual,
  ficha,
  cerberus,
  lead,
  intereses,
  cargando,
  esDeCampana,
  onEditar,
  onCorreo,
}: {
  clave: string;
  /** Cómo llamar a esta persona en la confirmación de «Unir fichas». */
  nombreActual: string;
  /** Lo ANOTADO por el equipo (`contacto_ficha`). Gana sobre todo lo demás. */
  ficha: FichaLocal | null | undefined;
  /** Lo que Cerberus sabe del CLIENTE. Sólo ventas. */
  cerberus?: Ficha;
  /** Lo que la persona llenó en el formulario. Sólo ventas. */
  lead?: LeadForm | null;
  intereses?: readonly string[];
  cargando: boolean;
  /**
   * ⚠️ **Espeja lo que el drawer ESCONDE, no lo que la tabla guarda.** «Empresa»
   * y «Interés» no se dibujan en campaña porque `FichaRapida` tampoco los ofrece
   * ahí: mostrarlos sería un dato que el operador ve y no puede corregir desde
   * ningún lado. Las columnas siguen existiendo — hay fichas de ventas con las dos.
   */
  esDeCampana: boolean;
  /** Abre el drawer. Sin handler no se dibuja el botón — nunca un no-op. */
  onEditar?: () => void;
  /** Puente a Correos. Sin él, el campo del correo se dibuja sin botón. */
  onCorreo?: (destino: DestinoCorreo) => void;
}) {
  const [uniendo, setUniendo] = useState(false);
  const { data: unificado } = useUnificado(clave);
  const origenes = unificado?.origenes ?? [];
  const cliente = cerberus?.estado === 'cliente' ? cerberus : null;

  const anotado = [ficha?.nombre, ficha?.apellido].filter((p) => p?.trim()).join(' ');
  const prioridad = PRIORIDADES.find((p) => p.id === ficha?.prioridad);

  /**
   * La precedencia, escrita una vez: lo ANOTADO por una persona gana sobre lo
   * que afirma Cerberus, y Cerberus sobre lo que se llenó en un formulario. Es
   * la misma escalera de `prellenar` y de `identidad.ts` — cada escalón es
   * alguien que escribió el dato con más intención que el anterior.
   */
  function primero(...candidatos: [string | null | undefined, string][]): { valor: string; fuente?: string } {
    for (const [v, fuente] of candidatos) if (v?.trim()) return { valor: v.trim(), fuente };
    return { valor: '' };
  }

  const nombre = primero([anotado, 'anotado'], [cliente?.nombre, 'Cerberus'], [lead?.nombre, 'del formulario']);
  const correo = primero(
    [ficha?.email, 'anotado'],
    [cliente?.correo, 'Cerberus'],
    [lead?.email, lead ? etiquetaFuente(lead.fuente) : 'del formulario'],
  );

  const campos: Campo[] = [
    { rotulo: 'Nombre', valor: nombre.valor, fuente: nombre.fuente },
    // Los tres de Cerberus no tienen competencia: no hay otra fuente que los
    // sepa, así que no pasan por la precedencia — pero sí dicen de dónde salen.
    ...(cliente?.codigo ? [{ rotulo: 'Cliente', valor: cliente.codigo, fuente: 'Cerberus', mono: true }] : []),
    ...(cliente?.dni ? [{ rotulo: 'DNI', valor: cliente.dni, fuente: 'Cerberus', mono: true }] : []),
    {
      rotulo: 'Correo',
      valor: correo.valor,
      fuente: correo.fuente,
      mono: true,
      // 🔴 UN SOLO «Escribirle», en el campo que tiene el correo. Antes había uno
      // por bloque: el de Cerberus y el del formulario, con la misma dirección.
      onCorreo:
        onCorreo && correo.valor
          ? () => onCorreo({ para: correo.valor, clave, nombre: nombre.valor || undefined })
          : undefined,
    },
    ...(esDeCampana ? [] : [{ rotulo: 'Empresa', valor: ficha?.empresa ?? '' }]),
    ...(esDeCampana ? [] : [{ rotulo: 'Interés', valor: (intereses ?? []).join(' · ') }]),
    // 🔴 UNA FICHA UNIDA ES UN HECHO SOBRE QUIÉN ES ESTA PERSONA, así que va como
    // un campo más y no como una sección aparte. Y **se dibuja siempre que haya
    // alguna**: el origen es la única forma de auditar una ficha unificada — si
    // mañana aparece un interés que nadie pidió por este chat, tiene que leerse
    // de un vistazo que vino de otro número.
    ...(origenes.length > 0
      ? [{
          rotulo: 'También',
          // `etiquetaDeOrigen` es la MISMA función que usa `PersonaUnificada`
          // para nombrar un origen: el teléfono formateado en WhatsApp, el
          // @usuario en Instagram. Con dos reglas, la misma ficha unida se
          // llamaría distinto en dos lugares de la app.
          valor: origenes
            .map((o) => `${nombreCanal(o.canal)} · ${etiquetaDeOrigen(o.canal, o.personaId, o.nombre)}`)
            .join('  ·  '),
        }]
      : []),
  ];

  return (
    <section aria-label="Quién es" className="border-t border-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className={encabezadoSeccion + ' mb-0'}>
          <UserRound size={14} className="text-muted-foreground" /> Quién es
        </h3>
        {/* ══ LOS DOS CONTROLES, CHIQUITOS Y ARRIBA A LA DERECHA ═════════════
            Pedido del dueño (24-ago-2026) para «Unir fichas», que era un botón
            punteado de ancho completo debajo de un párrafo explicativo — o sea
            el peso visual de una acción primaria para algo que se usa una vez
            cada muchas conversaciones. El párrafo se fue con él: lo que hace se
            lee en la confirmación, que es donde importa. */}
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setUniendo(true)}
            title="Si esta persona también te escribe desde otro número o desde otra red, une las dos fichas"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground transition-[background-color,color,transform] duration-200 ease-house hover:bg-muted hover:text-foreground active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            <Link2 size={11} aria-hidden />
            Unir
          </button>
          {onEditar && (
            <button
              type="button"
              onClick={onEditar}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-primary transition-[background-color,transform] duration-200 ease-house hover:bg-primary/10 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            >
              <Pencil size={11} aria-hidden />
              {ficha ? 'Editar' : 'Anotar'}
            </button>
          )}
        </div>
      </div>

      <dl className="mt-2 space-y-1">
        {campos.map((c) => (
          <div key={c.rotulo} className="flex items-baseline gap-3">
            <dt className="w-16 shrink-0 text-[11px] text-muted-foreground">{c.rotulo}</dt>
            {/* El hueco es un guion en tinta apagada, con el largo del renglón:
                se ve QUE falta sin que nadie tenga que leer que falta. El
                `title` conserva el matiz que la pantalla ya no gasta. */}
            <dd
              className="flex min-w-0 flex-1 items-baseline gap-1.5"
              title={c.valor ? undefined : `Sin ${c.rotulo.toLowerCase()} anotado`}
            >
              {/* Mientras la ficha viaja, el hueco tiene la FORMA de un renglón
                  cargando y no la de un dato vacío: sin esto, el primer frame
                  afirma «no hay correo» sobre algo que todavía no se preguntó. */}
              {cargando && !c.valor ? (
                <span
                  data-esqueleto="quien-es"
                  className="inline-block h-3 w-24 animate-pulse rounded bg-muted align-middle"
                />
              ) : (
                <>
                  {/* El valor completo va al `title`: en 360 px un correo real
                      se trunca —«unnombrelargodeverdad@gm…»— y truncado no sirve
                      para nada. El matiz se mueve al hover, no se borra. */}
                  <span
                    title={c.valor || undefined}
                    className={
                      'min-w-0 truncate text-xs ' +
                      (c.mono ? 'font-mono ' : '') +
                      (c.valor ? 'text-foreground' : 'text-muted-foreground/50')
                    }
                  >
                    {c.valor || '—'}
                  </span>
                  {/* La fuente en tinta apagada y entre paréntesis: se lee cuando
                      se la busca y no compite con el dato. */}
                  {c.valor && c.fuente && (
                    <span className="shrink-0 text-[10px] text-muted-foreground/70">{c.fuente}</span>
                  )}
                  {c.onCorreo && (
                    <button
                      type="button"
                      onClick={c.onCorreo}
                      title="Escribirle un correo"
                      aria-label="Escribirle un correo"
                      className="shrink-0 self-center rounded p-0.5 text-primary transition-[background-color,transform] duration-200 ease-house hover:bg-primary/10 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                    >
                      <Mail size={12} aria-hidden />
                    </button>
                  )}
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {prioridad && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          <span className={'size-1.5 rounded-full ' + prioridad.punto} aria-hidden />
          Prioridad {prioridad.rotulo.toLowerCase()}
        </p>
      )}

      {uniendo && (
        <BuscadorContactos
          clave={clave}
          nombreActual={nombreActual}
          yaEnlazadas={origenes.flatMap((o) => o.claves)}
          onCerrar={() => setUniendo(false)}
        />
      )}
    </section>
  );
}
