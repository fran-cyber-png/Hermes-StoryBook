import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BookOpen, Briefcase, ExternalLink, GraduationCap, Mail, RefreshCw, ShoppingBag, Sparkles, UserPlus } from 'lucide-react';
import { fechaCorta } from '../../lib/formato';
import { sectionLabel } from '../../lib/styles';
import type { Conversacion } from '../../dominio/conversaciones';
import { Avatar } from '../../components/Avatar';
import { BloqueLeadForm, useLeadForm } from './BloqueLeadForm';
import { personaEsTelefono } from '../../dominio/canal';
import { quiereFoto } from '../../dominio/fotoVisible';
import { PersonaUnificada } from '../identidad/PersonaUnificada';
import { useFicha } from './useFicha';
import { resumenCompras, type Ficha } from './ficha';
import type { LeadForm } from './leadForm';
import type { DestinoCorreo } from '../../lib/puente';
import { usePadron, type PadronDeTelefono } from '../panel/usePadron';

/**
 * LA FICHA DEL CONTACTO — el DETALLE de Cerberus, dentro de su pestaña.
 *
 * ── Qué cambió con el rediseño del panel ──
 * El veredicto («¿ya compró? ¿cuánto?») subió a la banda de estado: arriba de
 * todo, siempre visible, con color. Es lo que se lee en el primer segundo y lo
 * que cambia el tono de la conversación. Acá abajo queda el DETALLE que se
 * consulta cuando hace falta —código de cliente, DNI, correo, la lista de
 * compras con folio y fecha— más lo que declaró el formulario.
 *
 * Lo que esta pestaña YA NO pone (y por eso el panel dejó de repetirse):
 *   · el encabezado con el nombre → `panel/BandaEstado`
 *   · la cifra héroe de compras   → `panel/BandaEstado` (una línea, no un titular)
 *   · «Le interesa»               → `panel/BloqueInteres`, fuera de las pestañas
 *   · próxima acción y registrar venta → `panel/AccionesContacto`
 *
 * Ese último movimiento arregla un bug real: «Registrar venta» vivía adentro de
 * esta pestaña, así que abrir «Notas» hacía desaparecer el botón que cierra la
 * venta.
 *
 * Cuatro estados, porque colapsarlos miente: cliente / persona nueva / cargando /
 * Cerberus caído. JAMÁS mostrar «no figura» cuando lo que pasó es que la API
 * falló: son cosas opuestas.
 */

export type { Ficha, VentaFicha } from './ficha';

/**
 * #1033 — LO QUE EL PANEL YA TRAJO. Con esto el componente no pregunta nada por
 * su cuenta: dentro del panel, la ficha, el padrón y el formulario vienen del
 * perfil armado en Hermes (`panel/usePerfil.ts`), y pedirlos otra vez acá
 * volvería a abrir la consulta EN VIVO a Cerberus que ese perfil vino a sacar
 * — la pestaña está montada aunque no se vea (`hidden`), así que se pediría en
 * cada apertura. Sin esto (uso suelto), pregunta como siempre.
 */
export interface DatosDeLaFicha {
  ficha: Ficha | undefined;
  cargando: boolean;
  error: boolean;
  padron: PadronDeTelefono | null;
  lead: LeadForm | null;
}

const CERBERUS = import.meta.env.VITE_CERBERUS_URL ?? 'https://app.goberna.us';

/** El mismo trío de clases que `BADGE_ACENTO` en `EncabezadoTimeline.tsx`: pill con borde, fondo y tinta a juego. */
function claseEstadoVenta(estado: string): string {
  if (/pagad/i.test(estado)) return 'border-success/30 bg-success/10 text-success';
  if (/anul/i.test(estado)) return 'border-destructive/30 bg-destructive/10 text-destructive';
  return 'border-border bg-muted text-muted-foreground';
}

/**
 * EL ÍCONO DEL NEGOCIO DE GOBERNA de una venta: el de su primer producto. Goberna es la Escuela,
 * Consultoria, Editorial y LifeStyle, y la tarjeta de la compra dice de cuál es de un vistazo.
 * Sin negocio, una bolsa: no se supone ninguno.
 */
export function IconoDeNegocio({ negocios, size = 16 }: { negocios?: readonly string[]; size?: number }) {
  const negocio = (negocios?.[0] ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  const Icono =
    negocio === 'escuela'
      ? GraduationCap
      : negocio.startsWith('consultor')
        ? Briefcase
        : negocio === 'editorial'
          ? BookOpen
          : negocio === 'lifestyle'
            ? Sparkles
            : ShoppingBag;
  return <Icono size={size} aria-hidden />;
}

/**
 * F.5 — QUÉ DIBUJAR EN «LO QUE COMPRÓ», una decisión pura y no un ternario
 * anidado en el JSX: hay DOS fuentes (las ventas de Cerberus y las que ya
 * conoce Hermes vía el padrón de icarus) y `ventasCount === null` no es lo
 * mismo que «cero» — es «no se pudo preguntar».
 */
type ModoCompras = 'del_padron' | 'sin_verificar' | 'sin_ventas' | 'de_cerberus';

function modoCompras(ventasCount: number | null, ventasLength: number, comprasDelPadron: number): ModoCompras {
  if (ventasCount === null) return comprasDelPadron > 0 ? 'del_padron' : 'sin_verificar';
  return ventasLength === 0 ? 'sin_ventas' : 'de_cerberus';
}

/**
 * EL VACÍO HONESTO — cuando de esta persona no sabemos nada: ni ficha de
 * Cerberus ni formulario. Un hueco en blanco haría pensar que algo no cargó.
 * Este dice las dos cosas que hacen falta: **que no hay nada** y **qué hacer**
 * —lo que averigües en el chat, anotalo, porque nadie más lo va a anotar—.
 * Si el formulario SÍ matcheó, esto no aparece: el bloque de abajo ya habla.
 *
 * ⚠️ `lead`: `undefined` = el llamador no lo trajo y se pregunta acá; `null` =
 * lo trajo y no hay formulario (#1033). Son dos respuestas distintas y por eso
 * no se colapsan en un `?? null`.
 */
function SinNadaQueMostrar({
  telefono,
  pushname,
  lead,
}: {
  telefono: string | null;
  pushname: string | null;
  lead?: LeadForm | null;
}) {
  const enVivo = useLeadForm(telefono, lead === undefined);
  const hayLead = lead === undefined ? Boolean(enVivo.data?.lead) : lead !== null;
  if ((lead === undefined && enVivo.isPending) || hayLead) return null;
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-3">
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <UserPlus size={13} className="mt-0.5 shrink-0" />
        <span>
          De {pushname ? <span className="font-semibold text-foreground">{pushname}</span> : 'esta persona'} no
          sabemos nada más: no compró nunca y tampoco llenó un formulario. Todo lo que averigües en el
          chat —el curso, el nombre real, cuándo puede pagar— anotalo en <b>Notas</b>: es el único
          lugar donde va a quedar.
        </span>
      </p>
    </div>
  );
}

export function FichaContacto({
  conversacion,
  onCorreo,
  embebida = false,
  datos,
}: {
  conversacion: Conversacion;
  /**
   * Puente a Correos: prellena el Para con el correo de la ficha. **Sin esto la
   * acción no se muestra**, y eso fue exactamente lo que pasó durante casi un
   * mes — nadie pasaba esta prop (el porqué, en `PanelDerecho.tsx`).
   *
   * ⚠️ **Manda un objeto y no el `para` suelto**: un correo que sale de una
   * ficha viene de una conversación, y esa `clave` es lo que después lo ata al
   * timeline y a la medición (`lib/puente.ts`). La ficha la conoce porque tiene
   * la conversación entera; mandarla acá evita que cada llamador se acuerde.
   */
  onCorreo?: (destino: DestinoCorreo) => void;
  /**
   * Dentro del panel multifunción: el marco y el encabezado con la persona los
   * pone el panel. `false` = con su propia tarjeta (uso suelto).
   */
  embebida?: boolean;
  /** Lo que el llamador ya trajo (ver `DatosDeLaFicha`). Con esto no se pregunta nada acá. */
  datos?: DatosDeLaFicha;
}) {
  /**
   * La ficha se resuelve POR TELÉFONO — y ésa es la única pregunta que hay que
   * hacerle al canal acá. Decía `canal === 'whatsapp'`, que es una respuesta
   * correcta a otra pregunta: en un comentario de Meta el `persona_id` es un id
   * y no un número, pero en un lead de landing **es el teléfono**
   * (`cola/leadsCte.ts`). Con la versión vieja, la ficha de un lead salía vacía
   * y encima decía «este canal no lo trae» al lado de su propio número.
   */
  const esTelefono = personaEsTelefono(conversacion.canal, conversacion.persona_id);
  const telefono = conversacion.persona_id;
  /**
   * 🔴 **LA FOTO ES OTRA PREGUNTA, Y ACÁ NO SE COLAPSA.** Pedirle a WhatsApp la
   * foto de perfil de alguien a quien **nunca le escribimos** es exactamente lo
   * que #59 evita. Un lead de landing tiene teléfono y no tiene hilo: se le
   * busca la ficha, no la foto. Vive en `canales/fotoVisible.ts`.
   */
  const conFotoDePerfil = quiereFoto(conversacion.canal);
  const fichaEnVivo = useFicha(telefono, esTelefono && !datos);
  const data = datos ? datos.ficha : fichaEnVivo.data;
  const isPending = datos ? datos.cargando : fichaEnVivo.isPending;
  const isError = datos ? datos.error : fichaEnVivo.isError;
  /**
   * F.1/F.5 — LAS VENTAS QUE HERMES YA CONOCE, mientras el detalle de Cerberus
   * (el que trae `ventas`) siga vedado. No reemplaza a Cerberus cuando SÍ
   * respondió: sólo llena el hueco cuando `ventasCount` quedó en `null`
   * (sin verificar), que es el caso de icarus:23913 / GOB-10291 del diagnóstico.
   */
  const padronEnVivo = usePadron(telefono, esTelefono && !datos);
  const comprasDelPadron = (datos ? datos.padron?.compras : padronEnVivo.data?.padron?.compras) ?? [];
  const qc = useQueryClient();

  return (
    <div
      className={
        embebida
          ? 'flex h-full min-h-0 flex-col'
          : 'flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-panel'
      }
    >
      {!embebida && (
        <header className="shrink-0 border-b border-border px-4 py-3">
          <div className={sectionLabel}>Ficha del contacto</div>
          <div className="mt-1 flex items-center gap-2.5">
            <Avatar
              nombre={conversacion.persona_nombre ?? telefono}
              telefono={conFotoDePerfil ? telefono : null}
              numeroPropio={conversacion.numero_propio}
              conFoto={conFotoDePerfil}
              className="size-8 shrink-0 rounded-[11px] bg-secondary text-xs font-bold text-navy-ink"
            />
            <div className="min-w-0 truncate text-sm font-bold text-foreground">
              {conversacion.persona_nombre ?? telefono ?? 'Contacto'}
            </div>
          </div>
        </header>
      )}

      <div className={embebida ? 'min-h-0 flex-1 overflow-y-auto' : 'min-h-0 flex-1 overflow-y-auto p-4'}>
        {!esTelefono ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            La ficha de Cerberus se busca por teléfono, y este canal no trae uno.
          </p>
        ) : isPending ? (
          // Skeleton con la anatomía de la ficha — nunca un flash de «no es cliente».
          <div className="space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-11 animate-pulse rounded-lg bg-muted" />
            <div className="h-11 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : isError || data?.estado === 'error' ? (
          // Desde el 13-sep-2026 la cabecera no dice nada cuando la ficha no cargó
          // (no más «No se pudo saber»): acá va la frase corta, en palabras de la
          // vendedora, y la salida.
          <div className="flex flex-col items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-[11px] leading-relaxed text-warning-foreground">
            <span className="flex items-start gap-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {datos
                ? 'Las compras no cargaron. No es que no haya: vuelve a buscarlas.'
                : 'Cerberus cortó la consulta a los 12 segundos. Suele ser pasajero.'}
            </span>
            <button
              type="button"
              onClick={() => void qc.invalidateQueries({ queryKey: [datos ? 'perfil-contacto' : 'ficha', telefono] })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-warning/50 bg-card px-2 py-1 text-[11px] font-bold text-warning-foreground transition-colors hover:bg-warning/10"
            >
              <RefreshCw size={11} /> Buscar de nuevo
            </button>
          </div>
        ) : data?.estado === 'nuevo' ? (
          // La banda de arriba ya dijo «Lead nuevo»: repetirlo acá sería llenar
          // el panel con la misma frase dos veces. Lo que agrega esta pestaña es
          // lo ÚNICO que sí sabemos de ella — el formulario, abajo. Si tampoco
          // hay, `SinNadaQueMostrar` dice qué hacer en vez de dejar el hueco.
          <SinNadaQueMostrar
            telefono={telefono}
            pushname={conversacion.persona_nombre}
            lead={datos ? datos.lead : undefined}
          />
        ) : data?.estado === 'cliente' ? (
          <div className="flex flex-col gap-3.5">
            {/* ══ LOS CAMPOS DE IDENTIDAD SE FUERON A «QUIÉN ES» ═══════════
                🔴 **Código, DNI, país y correo eran la MISMA pregunta que la
                ficha rápida contestaba 200 px más arriba** («¿quién es esta
                persona?»), sólo que desde otra fuente — y el panel dibujaba un
                bloque por fuente en vez de un campo por hecho. El correo salía
                DOS veces, cada vez con su propio «Escribirle».

                Ahora los resuelve `panel/identidad.ts` con la precedencia que ya
                existía (`prellenar`, `identidad.ts`) y con la fuente anotada al
                lado de cada campo. Acá queda lo que NO es identidad: las
                COMPRAS, que son transacciones con folio, estado y monto.

                ⚠️ Fuera del panel (`embebida={false}`) este componente sigue
                siendo la ficha completa: ahí no hay ningún «Quién es» arriba
                que la reemplace. */}
            {!embebida && (
            <div>
              <div className="text-sm font-bold leading-snug text-foreground">{data.nombre}</div>
              {/* El nombre legal ya está en la banda de estado: acá van los datos
                  que la banda no puede llevar. */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                  {data.codigo}
                </span>
                {data.dni && (
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                    DNI {data.dni}
                  </span>
                )}
                {data.pais && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {data.pais}
                  </span>
                )}
              </div>
              {data.correo && (
                <div className="mt-2 flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate font-mono text-[11px] text-foreground">{data.correo}</span>
                  {onCorreo && (
                    <button
                      type="button"
                      onClick={() =>
                        onCorreo({
                          para: data.correo,
                          clave: conversacion.clave,
                          nombre: data.nombre ?? conversacion.persona_nombre ?? undefined,
                        })
                      }
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-secondary"
                    >
                      <Mail size={10} /> Escribirle
                    </button>
                  )}
                </div>
              )}
            </div>
            )}

            <div>
              {/* Un solo encabezado (dueño, 13-sep-2026: «que sea más compacto»): antes iban
                  «Lo que compró» y «Compras (1)» uno arriba del otro. */}
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Compras</h3>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {data.ventasCount === null ? 'sin verificar' : data.ventasCount}
                </span>
              </div>
              {/* 🔴 F.5 — `ventasCount: null` (el detalle de Cerberus no cargó) NO es
                  lo mismo que «cero ventas cargadas», y decían el mismo texto. Mientras
                  el detalle siga vedado, lo que Hermes YA sabe (`conversiones_wa`, vía
                  el padrón de icarus) llena el hueco — no reemplaza a Cerberus, avisa.
                  La decisión de qué mostrar vive en `modoCompras`, no acá. */}
              {(() => {
                const modo = modoCompras(data.ventasCount, data.ventas.length, comprasDelPadron.length);
                if (modo === 'del_padron') {
                  return (
                    <>
                      <p className="mb-1.5 text-[10px] leading-relaxed text-muted-foreground/70">
                        Sin verificar contra Cerberus — esto es lo que Hermes ya tiene registrado.
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {comprasDelPadron.map((c, i) => (
                          <li
                            key={c.folio ?? i}
                            className="flex items-center gap-2 rounded-xl border border-border p-2.5 text-[11px]"
                          >
                            {c.folio && <span className="font-mono font-semibold text-foreground">{c.folio}</span>}
                            {c.canal && (
                              <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                {c.canal}
                              </span>
                            )}
                            <span className="ml-auto shrink-0 font-mono tabular-nums text-muted-foreground">
                              {c.moneda} {c.monto}
                            </span>
                            {c.fecha && (
                              <span className="shrink-0 text-muted-foreground">{fechaCorta(c.fecha)}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  );
                }
                if (modo === 'sin_verificar') {
                  return (
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      No se pudo verificar el teléfono contra Cerberus (el detalle no respondió): puede
                      tener ventas que acá no se ven. Confírmalo en Cerberus antes de cotizarle de cero.
                    </p>
                  );
                }
                if (modo === 'sin_ventas') {
                  return (
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Figura como cliente pero no tiene ventas cargadas. Suele pasar cuando la venta se
                      cargó a otro documento: revisala en Cerberus antes de cotizarle de cero.
                    </p>
                  );
                }
                const resumen = resumenCompras(data.ventas);
                return (
                  <>
                    {/* UNA TARJETA POR VENTA (dueño, 13-sep-2026, sobre una referencia): el estado
                        y la fecha arriba, y lo que se llevó con el ícono de su negocio, el monto y
                        el folio. Lo que no es compra —una cotización, una anulada— se ve igual,
                        con su estado y el monto apagado. */}
                    <ul className="flex flex-col gap-2">
                      {data.ventas.map((v) => (
                        <li key={v.folio} className="rounded-xl border border-border/80 bg-card p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className={'rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ' + claseEstadoVenta(v.estado)}>
                              {v.estado}
                            </span>
                            <span className="text-[11px] tabular-nums text-muted-foreground">{fechaCorta(v.fecha)}</span>
                          </div>
                          <div className="mt-2.5 flex items-start gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-navy-ink">
                              <IconoDeNegocio negocios={v.negocios} />
                            </span>
                            <div className="min-w-0 flex-1">
                              {/* #1033 — qué se llevó: es lo que evita cotizarle lo mismo. Sin
                                  producto, el folio: nunca un nombre inventado. */}
                              <p className="text-[13px] font-semibold leading-snug text-foreground">
                                {(v.productos ?? []).length > 0 ? v.productos.join(', ') : v.folio}
                              </p>
                              <p
                                className={
                                  'mt-0.5 text-[13px] font-bold tabular-nums ' +
                                  (v.esCompra === false ? 'text-muted-foreground' : 'text-navy-ink')
                                }
                              >
                                {v.moneda} {v.monto}
                              </p>
                              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="font-mono">{v.folio}</span>
                                {/* #1033 — de qué negocio de Goberna es: la ficha no esconde ninguno. */}
                                {(v.negocios ?? []).map((negocio) => (
                                  <span key={negocio} className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium">
                                    {negocio}
                                  </span>
                                ))}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {/* El total en la moneda de la última compra (`resumenCompras`: nunca suma dos
                        monedas) y cuántas compras son, sin contar lo que no es compra. */}
                    {resumen && (
                      <div className="mt-2 grid grid-cols-2 divide-x divide-border/70 rounded-xl border border-border/80 bg-muted/30">
                        <div className="px-3 py-2">
                          <p className="text-[11px] text-muted-foreground">Total comprado</p>
                          <p className="text-[13px] font-bold tabular-nums text-foreground">
                            {resumen.moneda} {resumen.total}
                          </p>
                        </div>
                        <div className="px-3 py-2">
                          <p className="text-[11px] text-muted-foreground">Compras</p>
                          <p className="text-[13px] font-bold tabular-nums text-foreground">{data.ventasCount ?? resumen.n}</p>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* El link a Cerberus vive en la banda de estado, siempre visible.
                Acá solo cuando esta ficha se usa suelta, fuera del panel. */}
            {!embebida && (
              <a
                href={`${CERBERUS}/clientes/${data.id}/`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 self-start text-[11px] font-bold text-primary transition-colors hover:text-primary-hover hover:underline"
              >
                Ver la ficha completa en Cerberus <ExternalLink size={10} />
              </a>
            )}
          </div>
        ) : null}

        {/* Lo que Meta o la landing web ya sabía, por match de teléfono (#113):
            nombre real, EMAIL y campaña, marcados por origen. Va SIEMPRE (es dato
            de Hermes, no de Cerberus); se auto-oculta si el teléfono no matcheó
            ningún lead. */}
        {/* Los tres hechos que este bloque traía —nombre, correo y campaña— ya
            están arriba: los dos primeros como campos de «Quién es» (con la
            fuente anotada) y la campaña en la meta del encabezado, que la
            mostraba en paralelo desde siempre. Su `sinNombre={embebida}` era el
            parche por-campo de esta misma repetición. */}
        {!embebida && (
        <BloqueLeadForm
          telefono={telefono}
          activo={esTelefono}
          pushname={conversacion.persona_nombre}
          // ⚠️ EL CASO DEL LEAD DE LANDING (ADR 0051) NO PASA POR EL BLOQUE DE
          // ARRIBA: ahí `estado` es «nuevo», no «cliente», así que no hay
          // `data.correo` y el botón de Cerberus no existe. Su correo vive acá,
          // en lo que llenó el formulario —`/api/contactos/lead` lo devuelve— y
          // es el único canal con el que se le puede hablar hoy. Cablear solo
          // la mitad de Cerberus habría dejado «Escribirle» justo en la ficha
          // donde MÁS falta. La clave va también: un lead tiene conversación en
          // la cola aunque nadie le haya escrito.
          onCorreo={
            onCorreo
              ? (destino) => onCorreo({ ...destino, clave: destino.clave ?? conversacion.clave })
              : undefined
          }
          // Dentro del panel el nombre real ya encabeza la banda de estado: acá
          // sería la tercera vez que se lee el mismo nombre en la misma columna.
          sinNombre={embebida}
        />
        )}

        {/* «Unir Fichas» (#58): une la FICHA con la de otro número u otra red.
            Los hilos siguen separados.
            ⚠️ Dentro del panel lo dispara el botón chiquito de «Quién es»
            (pedido del dueño, 24-ago-2026): era un botón punteado de ancho
            completo debajo de un párrafo explicativo, o sea el peso de una
            acción primaria para algo que se usa una vez cada muchas
            conversaciones. Las fichas ya unidas se siguen viendo — como el
            campo «También», porque un origen es la única forma de auditar una
            ficha unificada. */}
        {!embebida && (
        <PersonaUnificada
          clave={conversacion.clave}
          nombreActual={conversacion.persona_nombre ?? telefono ?? 'este contacto'}
        />
        )}
      </div>
    </div>
  );
}
