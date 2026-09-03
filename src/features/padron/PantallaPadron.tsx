import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
  Search,
  ShieldOff,
  X,
} from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { fechaCorta, formatoTelefono } from '../../lib/formato';
import { conversacionDeTelefono } from '../../dominio/conversacionNueva';
import { HojaContacto } from '../panel/HojaContacto';
import type { DestinoCorreo } from '../../lib/puente';
import { useSesionWa } from '../whatsapp/conversacionWa';
import { AtajosDeReparto } from './AtajosDeReparto';
import { AvisoDeDueno, BarraReparto, Confirmacion, TiraDeReparto, useReparto } from './BarraReparto';
import { useDeshacer } from './Deshacer';
import { PanelFiltros, PanelLateralFiltros } from './PanelFiltros';
import { temperaturaDeEntrada } from './temperaturaEntrada';
import { TEMPERATURE_META } from '../leads/temperature';
import {
  alternarFila,
  alternarPagina,
  cuantos,
  estaElegido,
  NADA,
  ofrecerElRecorte,
  todoElRecorte,
  type Seleccion,
} from './seleccion';
import {
  contarActivos,
  usePadron,
  useFacetas,
  useRepartoPadron,
  type ContactoPadron,
  type FiltrosPadron,
} from './padron';

/**
 * EL PADRÓN — 72.923 contactos que nunca escribieron, en una tabla.
 *
 * ── Qué pregunta responde, y por qué no es la cola ──
 * La cola ordena por urgencia a quien YA escribió. Acá no hay urgencia: nadie
 * escribió. La pregunta es «¿a quiénes les hablamos ahora?», y se responde
 * recortando y repartiendo. Por eso es una tabla densa y no una lista de
 * tarjetas: se lee comparando renglones, no de a uno.
 *
 * ── Dos pantallas, una ruta ──
 * El supervisor ve el padrón entero y reparte. La vendedora ve **lo que le
 * habilitaron**, sin filtros de universo. Quién es quién lo decide el server y
 * llega en `supervisor`: acá no se decide nada, se dibuja lo que vino.
 */
export function PantallaPadron({
  onEscribir,
  miVendedora,
  onMandarCorreo,
}: {
  onEscribir?: (telefono: string) => void;
  /** Quién mira — la `HojaContacto` la necesita para el timeline (ADR 0037). */
  miVendedora?: string | null;
  /**
   * Puente a Correos, de paso hacia la ficha.
   *
   * ⚠️ **Acá es donde más se nota que falte**: al padrón se le escribe EN FRÍO,
   * y el correo es el único canal que no arriesga un ban (regla dura #7). Sin
   * este cable, la ficha del padrón muestra el correo del contacto y no ofrece
   * ninguna forma de usarlo.
   */
  onMandarCorreo?: (destino: DestinoCorreo) => void;
}) {
  const [texto, setTexto] = useState('');
  const [filtros, setFiltros] = useState<FiltrosPadron>({ pagina: 1, porPagina: 50 });
  const [seleccion, setSeleccion] = useState<Seleccion>(NADA);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  /**
   * DE QUIÉN SE ESTÁ LEYENDO LA FICHA. La tabla dice lo que icarus guardó; la
   * ficha dice lo que Cerberus sabe HOY — si compró, cuánto y con qué folios.
   * Son dos fuentes distintas y la segunda es la que decide a quién repartir.
   */
  const [ficha, setFicha] = useState<ContactoPadron | null>(null);
  // La línea propia con la que se arma la clave de conversación. Sin WhatsApp
  // conectado queda `null` y la ficha se abre igual (ver `conversacionDeTelefono`).
  const { data: sesionWa } = useSesionWa();
  const miLinea = sesionWa?.estado === 'conectado' ? sesionWa.telefono : null;
  /**
   * La conversación que consume el panel. Memoizada porque la fábrica estampa
   * `new Date()`: sin esto, cada render de la tabla —y la tabla se repinta con
   * cada tecla del buscador— devolvería un objeto nuevo y el panel entero se
   * recalcularía por debajo de una hoja que no cambió de persona.
   */
  const conversacionDeLaFicha = useMemo(
    () =>
      ficha?.telefono
        ? conversacionDeTelefono({
            telefono: ficha.telefono,
            numeroPropio: miLinea,
            nombre: ficha.nombre,
          })
        : null,
    [ficha?.telefono, ficha?.nombre, miLinea],
  );

  // El texto se difiere: escribir «gonzález» son ocho requests si cada tecla
  // dispara una consulta sobre 72.923 filas.
  const q = useDeferredValue(texto);
  const conBusqueda: FiltrosPadron = { ...filtros, q: q.trim() || undefined };

  const { data, isPending, isError, error, isFetching } = usePadron(conBusqueda);
  const soySupervisor = data?.supervisor ?? false;
  const facetas = useFacetas(conBusqueda, soySupervisor);
  const repartoQuery = useRepartoPadron(soySupervisor);
  /**
   * LOS ATAJOS MIRAN «SIN REPARTIR», NO EL FILTRO QUE EL SUPERVISOR TENGA
   * PUESTO — a propósito, ver el docblock de `AtajosDeReparto`. Consulta
   * aparte, fija, para que «En conversación · 512» sea siempre «512 sin
   * repartir», nunca «512 en el padrón entero».
   */
  const atajosFacetas = useFacetas({ sinHabilitar: true }, soySupervisor);

  /**
   * «SIN REPARTIR» POR DEFECTO — pedido del dueño (24-ago-2026), pero SOLO
   * para supervisor.
   *
   * 🔴 **Mandarlo de entrada, antes de saber el rol, rompería la pantalla de
   * la vendedora.** `donde.ts` (server) hace `soloEstos` (sus contactos ya
   * habilitados) AND `NOT IN habilitados` (todo lo YA habilitado) cuando
   * `sinHabilitar` viaja — para ella esas dos condiciones se contradicen
   * SIEMPRE, así que vería CERO contactos. El rol no se sabe hasta que la
   * primera respuesta vuelve, así que el default se aplica en un efecto,
   * DESPUÉS de confirmar `data.supervisor`, nunca en el estado inicial.
   */
  const defaultDeRepartoAplicado = useRef(false);
  useEffect(() => {
    if (data?.supervisor && !defaultDeRepartoAplicado.current) {
      defaultDeRepartoAplicado.current = true;
      setFiltros((f) => ({ ...f, sinHabilitar: true }));
    }
  }, [data?.supervisor]);

  /** Cualquier cambio de recorte vuelve a la página 1 y suelta la selección. */
  function cambiar(parcial: Partial<FiltrosPadron>) {
    // Quedarse en la página 7 de un recorte que ahora tiene 2 muestra una tabla
    // vacía sin motivo; y conservar la selección repartiría filas que ya no se ven.
    setFiltros((f) => ({ ...f, ...parcial, pagina: 1 }));
    setSeleccion(NADA);
  }

  /**
   * UN ATAJO SALTA A UNA VISTA, NO LA REFINA — a diferencia de `cambiar`, que
   * MEZCLA sobre lo que ya está puesto, esto REEMPLAZA todo. Si no, el número
   * que el atajo mostró (contra `{ sinHabilitar: true }` puro) podría no
   * coincidir con lo que la tabla termina mostrando bajo el filtro real.
   */
  function aplicarAtajo(parcial: Partial<FiltrosPadron>) {
    setTexto('');
    setFiltros({ pagina: 1, porPagina: 50, ...parcial });
    setSeleccion(NADA);
  }

  const contactos = data?.contactos ?? [];
  const total = data?.total ?? 0;
  const porPagina = data?.porPagina ?? 50;
  const paginaActual = data?.paginaActual ?? 1;
  const ultimaPagina = Math.max(1, Math.ceil(total / porPagina));
  const activos = contarActivos(conBusqueda);

  const idsDeLaPagina = contactos.map((c) => c.id);
  const todaLaPaginaElegida =
    idsDeLaPagina.length > 0 && idsDeLaPagina.every((id) => estaElegido(seleccion, id));
  const elegidos = cuantos(seleccion, total);

  const reparto = useReparto({
    seleccion,
    total,
    filtros: conBusqueda,
    onListo: (huboRecorte) => {
      setSeleccion(NADA);
      // El recorte que se veía ya no existe como tal: quedarse en la
      // página 5 de un filtro que ahora tiene 200 contactos muestra una
      // tabla vacía sin motivo. En modo `lista` no hace falta — se queda
      // en la misma página y se rellena sola con lo que sigue.
      if (huboRecorte) setFiltros((f) => ({ ...f, pagina: 1 }));
    },
  });
  const deshacer = useDeshacer(soySupervisor);

  if (isError) {
    return (
      <Aviso
        tono="error"
        titulo="No se pudo leer el padrón"
        // «no se pudo preguntar» ≠ «no hay». Cicatriz de ADR 0023: una lista vacía
        // acá se leería como que no hay contactos, y son 72.923.
        detalle={error instanceof Error ? error.message : 'El padrón no respondió.'}
      />
    );
  }

  if (data?.sinSupervisores) {
    return (
      <Aviso
        tono="aviso"
        titulo="Todavía nadie puede repartir el padrón"
        detalle="No hay ningún supervisor configurado en el server, así que nadie ve la lista completa. Se configura en el entorno de Hermes (HERMES_SUPERVISORES) y hace falta reiniciar."
      />
    );
  }

  return (
    // `relative`: la hoja de la ficha se ancla acá adentro, no al viewport.
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[15rem] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setFiltros((f) => ({ ...f, pagina: 1 }));
                setSeleccion(NADA);
              }}
              placeholder="Nombre, teléfono, correo o DNI"
              className="w-full rounded-full border border-border bg-muted py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            {texto && (
              <button
                type="button"
                aria-label="Borrar la búsqueda"
                onClick={() => setTexto('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-border hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </label>

          {/* El reparto vive ACÁ ahora, donde antes vivía «Más nuevos»
              (pedido del dueño, 24-ago-2026, viendo la pantalla en vivo): un
              control FIJO, nunca aparece-y-desaparece con la selección. El
              orden se mudó a la fila de filtros — ver el docblock de
              `TiraDeReparto` en `BarraReparto.tsx`. */}
          {soySupervisor && (
            <TiraDeReparto
              reparto={reparto}
              destinos={repartoQuery.data?.destinos ?? []}
              carga={repartoQuery.data?.carga ?? []}
            />
          )}
        </div>

        {soySupervisor && (
          <PanelFiltros
            filtros={conBusqueda}
            onCambiar={cambiar}
            onLimpiarTexto={() => setTexto('')}
            facetas={facetas.data?.facetas}
            entroPorLinea={facetas.data?.entroPorLinea}
            cargandoFacetas={facetas.isPending}
            abierto={filtrosAbiertos}
            onAbrirCerrar={setFiltrosAbiertos}
          />
        )}

        {soySupervisor && (
          <AtajosDeReparto
            facetas={atajosFacetas.data?.facetas}
            asignadoA={atajosFacetas.data?.asignadoA}
            entroPorLinea={atajosFacetas.data?.entroPorLinea}
            onElegir={aplicarAtajo}
          />
        )}

        <AvisoDeDueno reparto={reparto} />

        <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          {isFetching && <Loader2 size={11} className="animate-spin" />}
          <span className="font-semibold tabular-nums text-foreground">{total.toLocaleString('es')}</span>
          {soySupervisor ? (
            <>
              {total === 1 ? 'contacto en esta lista' : 'contactos en esta lista'}
              {/* El aviso de la regla dura #7: cuántos NO se están viendo. */}
              {total > porPagina && <span>· se ven {contactos.length} en esta página</span>}
            </>
          ) : (
            <>{total === 1 ? 'contacto que te repartieron' : 'contactos que te repartieron'}</>
          )}
        </p>
      </div>

      {/* La tabla y el panel de filtros viven en una fila: el panel EMPUJA el
          ancho de la tabla, nunca la tapa ni la saca de la pantalla. La
          primera versión de esto era un acordeón a ancho completo arriba de
          la tabla —Estephano la rechazó con razón: «para filtrar hay que
          perder de vista justo lo que se está filtrando», que es peor que las
          4 filas de chrome que esto vino a arreglar. */}
      <div className="flex min-h-0 flex-1">
      <div className="min-h-0 flex-1 overflow-auto">
        {/*
          LA BANDA DEL RECORTE ENTERO — el puente entre «los 50 de esta página» y
          «los 17.014 que filtré». Aparece SOLO con la página completa tildada y
          más contactos afuera: ofrecerla siempre sería ruido, y ofrecerla con la
          página a medias invita a saltar de 3 elegidos a 17.014 sin querer.
        */}
        {soySupervisor && ofrecerElRecorte(seleccion, idsDeLaPagina, total) && (
          <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border bg-navy/5 px-4 py-2 text-xs">
            <span className="text-muted-foreground">
              Elegiste {idsDeLaPagina.length} de esta página.
            </span>
            <button
              type="button"
              onClick={() => setSeleccion(todoElRecorte())}
              className="font-bold text-navy-ink underline underline-offset-2 hover:text-navy-ink/80"
            >
              Elegir los {total.toLocaleString('es')} de este filtro
            </button>
          </div>
        )}

        {soySupervisor && seleccion.modo === 'recorte' && (
          <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border bg-navy/5 px-4 py-2 text-xs">
            <span className="font-semibold text-navy-ink">
              Están elegidos los {elegidos.toLocaleString('es')} contactos de este filtro
              {seleccion.excluidos.length > 0 &&
                ` (sacaste ${seleccion.excluidos.length})`}
              .
            </span>
            <button
              type="button"
              onClick={() => setSeleccion(NADA)}
              className="font-bold text-navy-ink underline underline-offset-2 hover:text-navy-ink/80"
            >
              Elegir solo esta página
            </button>
          </div>
        )}

        {isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : contactos.length === 0 ? (
          <Vacio soySupervisor={soySupervisor} hayFiltro={activos > 0} />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                {soySupervisor && (
                  <th className="w-9 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Elegir toda la página"
                      checked={todaLaPaginaElegida}
                      onChange={(e) =>
                        setSeleccion((prev) => alternarPagina(prev, idsDeLaPagina, e.target.checked))
                      }
                      className="size-3.5 accent-navy"
                    />
                  </th>
                )}
                <th className="px-3 py-2 font-semibold">Quién</th>
                <th className="px-3 py-2 font-semibold">Teléfono</th>
                <th className="px-3 py-2 font-semibold">País</th>
                <th className="px-3 py-2 font-semibold">Curso / compra</th>
                <th className="px-3 py-2 font-semibold">Compró</th>
                <th
                  className="px-3 py-2 font-semibold"
                  title="Cuándo se cargó al sistema, no siempre cuándo escribió por primera vez — se está por corregir con la fecha real."
                >
                  Cargado
                </th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {contactos.map((c) => (
                <Fila
                  key={c.id}
                  c={c}
                  elegible={soySupervisor}
                  elegido={estaElegido(seleccion, c.id)}
                  onElegir={() => setSeleccion((prev) => alternarFila(prev, c.id))}
                  onEscribir={onEscribir}
                  onFicha={setFicha}
                  abierta={ficha?.id === c.id}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {soySupervisor && filtrosAbiertos && (
        <PanelLateralFiltros
          filtros={conBusqueda}
          onCambiar={cambiar}
          facetas={facetas.data?.facetas}
          asignadoA={facetas.data?.asignadoA}
          entroPorLinea={facetas.data?.entroPorLinea}
          cargandoFacetas={facetas.isPending}
          facetasConError={facetas.isError}
          total={total}
        />
      )}
      </div>

      {total > porPagina && (
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-border bg-card px-4 py-2 text-xs">
          <button
            type="button"
            disabled={paginaActual <= 1}
            onClick={() => setFiltros((f) => ({ ...f, pagina: (f.pagina ?? 1) - 1 }))}
            className="flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-foreground hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft size={13} /> Anterior
          </button>
          <span className="tabular-nums text-muted-foreground">
            {paginaActual} de {ultimaPagina.toLocaleString('es')}
          </span>
          <button
            type="button"
            disabled={paginaActual >= ultimaPagina}
            onClick={() => setFiltros((f) => ({ ...f, pagina: (f.pagina ?? 1) + 1 }))}
            className="flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-foreground hover:bg-muted disabled:opacity-30"
          >
            Siguiente <ChevronRight size={13} />
          </button>
        </div>
      )}

      {soySupervisor && (
        <>
          <Confirmacion reparto={reparto} />
          <BarraReparto reparto={reparto} deshacer={deshacer} onLimpiar={() => setSeleccion(NADA)} />
        </>
      )}

      {/* LA FICHA AL COSTADO. Lo que se ve acá no sale del padrón: la ficha de
          Cerberus y el formulario que llenó se buscan por TELÉFONO, en vivo. El
          timeline y las señales, en cambio, van por clave de conversación y para
          alguien que nunca escribió vienen vacíos — que es la verdad, no una
          falla de carga: el padrón son justamente los que nunca escribieron. */}
      {conversacionDeLaFicha && (
        <HojaContacto
          conversacion={conversacionDeLaFicha}
          onCerrar={() => setFicha(null)}
          miVendedora={miVendedora}
          onMandarCorreo={onMandarCorreo}
        />
      )}
    </div>
  );
}

function Fila({
  c,
  elegible,
  elegido,
  onElegir,
  onEscribir,
  onFicha,
  abierta,
}: {
  c: ContactoPadron;
  elegible: boolean;
  elegido: boolean;
  onElegir: () => void;
  onEscribir?: (telefono: string) => void;
  /** Un clic en la fila abre la ficha al costado. */
  onFicha?: (c: ContactoPadron) => void;
  abierta?: boolean;
}) {
  const telefono = (c.telefono ?? '').replace(/\D/g, '');
  // La ficha se busca POR TELÉFONO (así habla `cerberus/ficha.ts`): sin uno
  // usable no hay nada que abrir, y una hoja vacía se leería como «no es
  // cliente» cuando lo que pasa es que no se lo pudo preguntar.
  const conFicha = onFicha && telefono.length >= 8 ? () => onFicha(c) : null;
  return (
    <tr
      role={conFicha ? 'button' : undefined}
      tabIndex={conFicha ? 0 : undefined}
      aria-label={conFicha ? `Ver la ficha de ${c.nombre ?? telefono}` : undefined}
      onClick={conFicha ?? undefined}
      onKeyDown={
        conFicha
          ? (e) => {
              // Solo con el foco en la fila: si no, Espacio sobre el checkbox
              // de reparto abriría la ficha además de tildar.
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                conFicha();
              }
            }
          : undefined
      }
      className={
        `border-b border-border/60 transition-colors ${elegido ? 'bg-primary/5' : 'hover:bg-muted/50'}` +
        (conFicha ? ' cursor-pointer' : '') +
        // De cuál se está leyendo la ficha. Tiene que ganarle al `hover:` de
        // arriba: con la hoja abierta el puntero está del otro lado de la
        // pantalla, y sin marca no hay forma de saber a quién se está mirando.
        // `bg-secondary` y no `bg-muted`: el gris de la casa es #F5F7FB, a un
        // pelo del blanco de la tabla, y sobre un renglón de 32 px no se ve. El
        // tinte azul es el mismo que marca «mira esta» en el radar.
        (abierta ? ' bg-secondary hover:bg-secondary' : '')
      }
    >
      {elegible && (
        // El clic del check NO abre la ficha: repartir es la acción de esta
        // columna, y tildar 50 filas abriendo 50 hojas sería inusable.
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            aria-label={`Elegir a ${c.nombre ?? c.id}`}
            checked={elegido}
            onChange={() => onElegir()}
            className="size-3.5 accent-navy"
          />
        </td>
      )}
      <td className="max-w-[16rem] px-3 py-2">
        <div className="flex items-center gap-2">
          {/* `conFoto` NUNCA en esta tabla: se dibujan hasta 50 filas de una, y
              pedirle a WhatsApp una foto por fila es el patrón exacto que la
              regla dura #7 prohíbe (rate-limit, riesgo de ban). Iniciales solas,
              como manda el propio docblock de `Avatar`. */}
          <span className="relative shrink-0">
            <Avatar nombre={c.nombre} className="size-7 rounded-full bg-navy/10 text-[10px] font-bold text-navy-ink" />
            {/* La misma señal de «Entró» (`temperaturaEntrada.ts`), repetida acá
                porque con el panel de filtros abierto esa columna queda del
                otro lado del scroll horizontal — sin esto, filtrar tapa
                justo la frescura que se está buscando (Estephano, 24-ago). */}
            {c.creadoEn && (
              <span
                className={`absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-card ${TEMPERATURE_META[temperaturaDeEntrada(c.creadoEn, new Date()) ?? 'helado'].bar}`}
                title={`Entró ${fechaCorta(c.creadoEn)}`}
              />
            )}
          </span>
          <div className="min-w-0">
            <div className="truncate font-semibold text-foreground">{c.nombre ?? '—'}</div>
            {c.correo && <div className="truncate text-[11px] text-muted-foreground">{c.correo}</div>}
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-muted-foreground">
        {telefono ? formatoTelefono(telefono) : '—'}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{c.pais ?? '—'}</td>
      {/*
        🔴 DOS DATOS DISTINTOS EN UNA COLUMNA, y por eso se dibujan distinto.
        `comprado` es lo que PAGÓ (sale de la venta) y va con peso; `curso` es lo
        que DECLARÓ en la landing y va tenue, en cursiva y rotulado. Antes se
        mostraba solo el declarado, y por eso la tabla se leía al revés: filas con
        curso que decían «no compró» junto a filas sin curso que decían «Sí».
      */}
      <td className="max-w-[14rem] px-3 py-2">
        {c.comprado ? (
          <span className="block truncate text-xs font-medium text-foreground" title={c.comprado}>
            {c.comprado}
          </span>
        ) : c.curso ? (
          <span className="block truncate text-xs italic text-muted-foreground" title={`Le interesa: ${c.curso}`}>
            {c.curso}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        {c.comprado && c.curso && c.curso !== c.comprado && (
          <span className="block truncate text-[10px] italic text-muted-foreground" title={`Le interesa: ${c.curso}`}>
            le interesa: {c.curso}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        {/* 🔴 Verde SOLO con venta real. `compras` (el contador de icarus) miente
            en más de la mitad de los casos, así que cuando afirma sin respaldo se
            dibuja en gris y se dice de dónde salió — nunca como un cliente. */}
        {c.conVenta ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">
            <BadgeCheck size={11} /> Sí
          </span>
        ) : c.compras && c.compras > 0 ? (
          <span
            title="Quedó marcado como comprador al importar los contactos, pero no hay ninguna venta real que lo respalde. Pasa en más de la mitad del padrón."
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            <AlertTriangle size={10} /> sin respaldo
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground">
        {/* La rampa de temperatura: cortes PROPIOS del padrón (7/30/180 días),
            no los de `leads/temperature.ts` (pensados para horas de una
            conversación de WhatsApp) — con esos, casi todo el padrón saldría
            «helado» el primer día. Ver `temperaturaEntrada.ts`. */}
        {c.creadoEn ? (
          <span className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${TEMPERATURE_META[temperaturaDeEntrada(c.creadoEn, new Date()) ?? 'helado'].bar}`} />
            {fechaCorta(c.creadoEn)}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-3 py-2">
        {onEscribir && telefono.length >= 8 && (
          <button
            type="button"
            onClick={(e) => {
              // Abrir el chat se lleva la vista entera a Mensajes: dejar además
              // una ficha abierta atrás sería un rastro que nadie pidió.
              e.stopPropagation();
              onEscribir(telefono);
            }}
            title="Abrir el chat con esta persona"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-navy hover:text-white"
          >
            <MessageCircle size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}

function Vacio({ soySupervisor, hayFiltro }: { soySupervisor: boolean; hayFiltro: boolean }) {
  // Tres textos para tres situaciones que se ven igual: un filtro que no dio
  // nada, un padrón vacío, y una vendedora sin nada repartido.
  return (
    <div className="flex flex-col items-center gap-2 p-12 text-center">
      <ShieldOff size={26} className="text-muted-foreground/40" />
      <p className="max-w-sm text-sm text-muted-foreground">
        {hayFiltro
          ? 'Ningún contacto entra con este filtro. Prueba sacando alguno.'
          : soySupervisor
            ? 'El padrón no devolvió contactos.'
            : 'Todavía no te repartieron ningún contacto. Cuando el supervisor te reparta un lote, aparece acá.'}
      </p>
    </div>
  );
}

function Aviso({ tono, titulo, detalle }: { tono: 'error' | 'aviso'; titulo: string; detalle: string }) {
  const tinta =
    tono === 'error'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : 'border-warning/40 bg-warning/10 text-warning-foreground';
  return (
    <div className="flex min-h-0 flex-1 items-start justify-center p-8">
      <div className={`flex max-w-md items-start gap-2.5 rounded-2xl border p-4 text-sm ${tinta}`}>
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-bold">{titulo}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-90">{detalle}</p>
        </div>
      </div>
    </div>
  );
}
