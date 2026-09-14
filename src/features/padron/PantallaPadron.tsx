import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  AlertTriangle,
  ArrowDownUp,
  BadgeCheck,
  ChevronDown,
  Loader2,
  MessageCircle,
  Search,
  ShieldOff,
  X,
} from 'lucide-react';
import { Paginador } from '../../components/Paginador';
import {
  cabeceraQuieta,
  CeldaPersona,
  celdaDeCabecera,
  celdaQuieta,
  tablaQuieta,
} from '../../components/TablaQuieta';
import { cifra, fechaCorta, formatoTelefono } from '../../lib/formato';
import { controlDeBarraClass } from '../../lib/styles';
import { conversacionDeTelefono } from '../../dominio/conversacionNueva';
import { HojaContacto } from '../panel/HojaContacto';
import type { DestinoCorreo } from '../../lib/puente';
import { useSesionWa } from '../whatsapp/conversacionWa';
import { AvisoDeDueno, BarraReparto, BotonDeReparto, Confirmacion, useReparto } from './BarraReparto';
import { useDeshacer } from './Deshacer';
import { BotonFiltros, ChipsActivos, PanelLateralFiltros } from './PanelFiltros';
import { SelectorDeVista } from './SelectorDeVista';
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
  nombreCorto,
  usePadron,
  useFacetas,
  useRepartoPadron,
  type ContactoPadron,
  type FiltrosPadron,
} from './padron';
import {
  aplicarVista,
  chipsDelRecorte,
  vistasDelPadron,
  vistaVigente,
  type VistaDelPadron,
} from './vistasDelPadron';

/**
 * Columna única, sin celda: `useReactTable` la exige pero acá solo se usa la
 * tabla como motor de PAGINACIÓN — las filas se siguen dibujando con `<Fila>`,
 * no con `flexRender`. Fuera del componente para no recrearla en cada render.
 */
const COLUMNAS_PADRON: ColumnDef<ContactoPadron>[] = [{ accessorKey: 'id' }];

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
 *
 * ── Una fila de controles, no seis (ADR 0102, 10-sep-2026) ──
 * «Siento que está muy desordenado, no se ve limpio como la referencia» (el
 * dueño). Antes de la primera fila de datos había pestañas, buscador + reparto,
 * orden + País + Filtros, chips, la franja «Para repartir hoy» y la línea de
 * conteo. No faltaba ningún dato: sobraban capas. Ahora: vista · buscador ·
 * Filtros, y a la derecha orden y Repartir; los chips sólo si algo refina a la
 * vista; el conteo, al pie junto al paginador.
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
   * LAS VISTAS MIRAN «SIN ASIGNAR», NO EL FILTRO QUE EL SUPERVISOR TENGA
   * PUESTO — a propósito, ver `vistasDelPadron`. Consulta aparte, fija, para que
   * «En negociación · 5.792» sea siempre «5.792 sin asignar», nunca «5.792 en el
   * padrón entero».
   */
  const facetasSinAsignar = useFacetas({ sinHabilitar: true }, soySupervisor);

  /**
   * «SIN ASIGNAR» POR DEFECTO — pedido del dueño (24-ago-2026), pero SOLO
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
   * UNA VISTA SALTA, NO REFINA — a diferencia de `cambiar`, que MEZCLA sobre lo
   * que ya está puesto, esto REEMPLAZA el recorte (`aplicarVista`). Si no, la
   * cifra que la vista mostró podría no coincidir con lo que termina mostrando la
   * tabla. Es también «Limpiar filtros»: volver a poner la vista que ya está.
   *
   * ⚠️ **Borra también el texto buscado**, a propósito y como el atajo que
   * reemplaza: el texto es parte del recorte, y una vista que dejara «gonzález»
   * puesto prometería una cifra que la tabla no devuelve.
   */
  function elegirVista(vista: VistaDelPadron) {
    setTexto('');
    setFiltros((f) => aplicarVista(f, vista));
    setSeleccion(NADA);
  }

  const contactos = data?.contactos ?? [];
  const total = data?.total ?? 0;
  const porPagina = data?.porPagina ?? 50;
  const paginaActual = data?.paginaActual ?? 1;
  const ultimaPagina = Math.max(1, Math.ceil(total / porPagina));
  // «¿Hay algo recortando?», para el texto del vacío. No es «Filtros N»: acá
  // cuentan también la vista y el texto buscado, porque cualquiera de los dos
  // puede ser el motivo de que no aparezca nadie.
  const activos = contarActivos(conBusqueda);

  const vistas = vistasDelPadron({
    sinAsignar: {
      etapa: facetasSinAsignar.data?.facetas.etapa,
      sinRepartir: facetasSinAsignar.data?.asignadoA?.sinRepartir,
      lineas: facetasSinAsignar.data?.entroPorLinea,
    },
    carga: repartoQuery.data?.carga,
  });
  const vigente = vistaVigente(conBusqueda, vistas);
  const chips = chipsDelRecorte(conBusqueda, vigente, facetas.data?.entroPorLinea);
  /**
   * «ASIGNADO A» SE DIBUJA SÓLO SI DICE ALGO.
   *
   *   · Si el server no lo mandó: ausente no es «sin dueña» (ver
   *     `ContactoPadron.asignadoA`), y una columna entera de «—» sobre un server
   *     que no preguntó se leería como «todo esto está libre».
   *   · Con «sin asignar» puesto: ahí diría «—» en las 50 filas por definición, y
   *     es justo la vista con la que abre el supervisor.
   */
  const conDueno =
    soySupervisor &&
    !conBusqueda.sinHabilitar &&
    contactos.length > 0 &&
    contactos.every((c) => c.asignadoA !== undefined);

  /**
   * La paginación real la sigue sirviendo el server (`filtros.pagina`); esto es
   * `manualPagination` — react-table solo administra el estado y las reglas de
   * «puedo ir atrás/adelante», nunca recorta `contactos` por su cuenta.
   */
  const tablaPadron = useReactTable({
    data: contactos,
    columns: COLUMNAS_PADRON,
    state: { pagination: { pageIndex: paginaActual - 1, pageSize: porPagina } },
    pageCount: ultimaPagina,
    manualPagination: true,
    onPaginationChange: (updater) => {
      const actual = { pageIndex: paginaActual - 1, pageSize: porPagina };
      const siguiente = typeof updater === 'function' ? updater(actual) : updater;
      setFiltros((f) => ({ ...f, pagina: siguiente.pageIndex + 1 }));
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const idsDeLaPagina = contactos.map((c) => c.id);
  const todaLaPaginaElegida =
    idsDeLaPagina.length > 0 && idsDeLaPagina.every((id) => estaElegido(seleccion, id));
  const elegidos = cuantos(seleccion, total);
  const desde = (paginaActual - 1) * porPagina + 1;

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
      <div className="shrink-0 border-b border-border bg-card px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {soySupervisor && (
            <SelectorDeVista
              vistas={vistas}
              vigente={vigente}
              onElegir={elegirVista}
              estadoDelReparto={repartoQuery.isError ? 'error' : repartoQuery.isPending ? 'cargando' : 'listo'}
            />
          )}

          <label className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setFiltros((f) => ({ ...f, pagina: 1 }));
                setSeleccion(NADA);
              }}
              placeholder="Nombre, teléfono, correo o DNI"
              aria-label="Buscar en el padrón"
              className="h-8 w-full rounded-lg border border-border bg-card pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            {texto && (
              <button
                type="button"
                aria-label="Borrar la búsqueda"
                onClick={() => setTexto('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </label>

          {soySupervisor && (
            <BotonFiltros cuantos={chips.length} abierto={filtrosAbiertos} onAbrirCerrar={setFiltrosAbiertos} />
          )}

          {soySupervisor && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <SelectorOrden orden={filtros.orden} onCambiar={(orden) => cambiar({ orden })} />
              {/* El reparto sigue siendo un control FIJO (regla del dueño,
                  24-ago-2026): nunca aparece-y-desaparece con la selección. Ver
                  el docblock de `BotonDeReparto`. */}
              <BotonDeReparto
                reparto={reparto}
                destinos={repartoQuery.data?.destinos ?? []}
                carga={repartoQuery.data?.carga ?? []}
              />
            </div>
          )}
        </div>

        {soySupervisor && (
          <ChipsActivos chips={chips} onQuitar={cambiar} onLimpiar={() => vigente && elegirVista(vigente)} />
        )}
      </div>

      <AvisoDeDueno reparto={reparto} />

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
              Elegir los {cifra(total)} de este filtro
            </button>
          </div>
        )}

        {soySupervisor && seleccion.modo === 'recorte' && (
          <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border bg-navy/5 px-4 py-2 text-xs">
            <span className="font-semibold text-navy-ink">
              Están elegidos los {cifra(elegidos)} contactos de este filtro
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
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : contactos.length === 0 ? (
          <Vacio soySupervisor={soySupervisor} hayFiltro={activos > 0} />
        ) : (
          <table className={tablaQuieta}>
            <thead className={cabeceraQuieta}>
              <tr>
                {soySupervisor && (
                  <th className={`${celdaDeCabecera} w-10`}>
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
                <th className={celdaDeCabecera}>Quién</th>
                <th className={celdaDeCabecera}>Teléfono</th>
                <th className={celdaDeCabecera}>País</th>
                <th className={celdaDeCabecera}>Curso / compra</th>
                <th className={celdaDeCabecera}>Compró</th>
                {conDueno && <th className={celdaDeCabecera}>Asignado a</th>}
                <th
                  className={celdaDeCabecera}
                  title="Cuándo se cargó al sistema, no siempre cuándo escribió por primera vez — se está por corregir con la fecha real."
                >
                  Cargado
                </th>
                <th className={`${celdaDeCabecera} w-12`}>
                  <span className="sr-only">Abrir el chat</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {contactos.map((c) => (
                <Fila
                  key={c.id}
                  c={c}
                  elegible={soySupervisor}
                  conDueno={conDueno}
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

      {/* EL PIE: cuántos hay y cuáles se ven, al lado del paginador. La mitad
          «se ven 1–50» es el aviso de la regla dura #7 — cuántos NO se están
          viendo —, y va acá porque es lo que el paginador recorre. */}
      <Paginador
        paginaActual={paginaActual}
        totalPaginas={ultimaPagina}
        puedeAnterior={paginaActual > 1}
        puedeSiguiente={paginaActual < ultimaPagina}
        onAnterior={() => tablaPadron.previousPage()}
        onSiguiente={() => tablaPadron.nextPage()}
        onIrA={(n) => tablaPadron.setPageIndex(n - 1)}
        resumen={
          data ? (
            <>
              {isFetching && <Loader2 size={11} className="animate-spin" />}
              {/* Cada mitad en un renglón que no se parte: en angosto el pie baja
                  la segunda mitad entera, no una palabra por renglón. */}
              <span className="whitespace-nowrap">
                <span className="font-semibold tabular-nums text-foreground">{cifra(total)}</span>{' '}
                {soySupervisor
                  ? total === 1
                    ? 'contacto'
                    : 'contactos'
                  : total === 1
                    ? 'contacto que te repartieron'
                    : 'contactos que te repartieron'}
              </span>
              {total > contactos.length && contactos.length > 0 && (
                <span className="whitespace-nowrap tabular-nums">
                  · se ven {cifra(desde)}–{cifra(desde + contactos.length - 1)}
                </span>
              )}
            </>
          ) : null
        }
      />

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
  conDueno,
  elegido,
  onElegir,
  onEscribir,
  onFicha,
  abierta,
}: {
  c: ContactoPadron;
  elegible: boolean;
  /** Si la columna «Asignado a» está puesta (la decide la pantalla, no la fila). */
  conDueno: boolean;
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
  const temperatura = c.creadoEn
    ? TEMPERATURE_META[temperaturaDeEntrada(c.creadoEn, new Date()) ?? 'helado'].bar
    : null;
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
        `transition-colors ${elegido ? 'bg-primary/5' : 'hover:bg-muted/50'}` +
        (conFicha ? ' cursor-pointer' : '') +
        // De cuál se está leyendo la ficha. Tiene que ganarle al `hover:` de
        // arriba: con la hoja abierta el puntero está del otro lado de la
        // pantalla, y sin marca no hay forma de saber a quién se está mirando.
        // `bg-secondary` y no `bg-muted`: el gris de la casa es #F5F7FB, a un
        // pelo del blanco de la tabla, y sobre un renglón no se ve. El tinte
        // azul es el mismo que marca «mira esta» en el radar.
        (abierta ? ' bg-secondary hover:bg-secondary' : '')
      }
    >
      {elegible && (
        // El clic del check NO abre la ficha: repartir es la acción de esta
        // columna, y tildar 50 filas abriendo 50 hojas sería inusable.
        <td className={celdaQuieta} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            aria-label={`Elegir a ${c.nombre ?? c.id}`}
            checked={elegido}
            onChange={() => onElegir()}
            className="size-3.5 accent-navy"
          />
        </td>
      )}
      <td className={`${celdaQuieta} max-w-[16rem]`}>
        <CeldaPersona
          nombre={c.nombre}
          detalle={c.correo}
          insignia={
            // La misma señal de «Entró» (`temperaturaEntrada.ts`), repetida acá
            // porque con el panel de filtros abierto esa columna queda del otro
            // lado del scroll horizontal — sin esto, filtrar tapa justo la
            // frescura que se está buscando (Estephano, 24-ago).
            temperatura && c.creadoEn ? (
              <span
                className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-card ${temperatura}`}
                title={`Entró ${fechaCorta(c.creadoEn)}`}
              />
            ) : undefined
          }
        />
      </td>
      <td className={`${celdaQuieta} whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground`}>
        {telefono ? formatoTelefono(telefono) : '—'}
      </td>
      <td className={`${celdaQuieta} text-xs text-muted-foreground`}>{c.pais ?? '—'}</td>
      {/*
        🔴 DOS DATOS DISTINTOS EN UNA COLUMNA, y por eso se dibujan distinto.
        `comprado` es lo que PAGÓ (sale de la venta) y va con peso; `curso` es lo
        que DECLARÓ en la landing y va tenue, en cursiva y rotulado. Antes se
        mostraba solo el declarado, y por eso la tabla se leía al revés: filas con
        curso que decían «no compró» junto a filas sin curso que decían «Sí».
      */}
      <td className={`${celdaQuieta} max-w-[14rem]`}>
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
      <td className={celdaQuieta}>
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
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            <AlertTriangle size={10} /> sin respaldo
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      {conDueno && (
        <td className={celdaQuieta}>
          {c.asignadoA ? (
            <CeldaPersona compacta nombre={nombreCorto(c.asignadoA)} titulo={c.asignadoA} />
          ) : (
            // Se preguntó y no tiene dueña: un guion tenue, no un rótulo. «Sin
            // asignar» repetido en 50 filas de la vista «Sin asignar» es ruido.
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      )}
      <td className={`${celdaQuieta} whitespace-nowrap text-xs tabular-nums text-muted-foreground`}>
        {/* La rampa de temperatura: cortes PROPIOS del padrón (7/30/180 días),
            no los de `leads/temperature.ts` (pensados para horas de una
            conversación de WhatsApp) — con esos, casi todo el padrón saldría
            «helado» el primer día. Ver `temperaturaEntrada.ts`. */}
        {c.creadoEn && temperatura ? (
          <span className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${temperatura}`} />
            {fechaCorta(c.creadoEn)}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className={`${celdaQuieta} text-center`}>
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
            aria-label={`Abrir el chat con ${c.nombre ?? telefono}`}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <MessageCircle size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}

/**
 * EL ORDEN — no filtra, así que no vive entre los filtros ni cuenta en «Filtros
 * N» (ADR 0102). Nativo a propósito: cuatro opciones fijas, sin conteos ni
 * búsqueda. Las opciones llevan el fondo de la tarjeta explícito: sin eso, en
 * tema oscuro el menú nativo puede abrir claro con la letra clara encima.
 */
function SelectorOrden({
  orden,
  onCambiar,
}: {
  orden: FiltrosPadron['orden'];
  onCambiar: (orden: NonNullable<FiltrosPadron['orden']>) => void;
}) {
  return (
    <label className={`${controlDeBarraClass} relative cursor-pointer pr-7`}>
      <ArrowDownUp size={13} className="text-muted-foreground" />
      <select
        value={orden ?? 'recientes'}
        onChange={(e) => onCambiar(e.target.value as NonNullable<FiltrosPadron['orden']>)}
        aria-label="Ordenar"
        className="cursor-pointer appearance-none bg-transparent text-xs font-semibold text-foreground outline-none [&>option]:bg-card [&>option]:text-foreground"
      >
        <option value="recientes">Más nuevos</option>
        <option value="antiguos">Más antiguos</option>
        <option value="mas_gastaron">Los que más gastaron</option>
        <option value="nombre">Por nombre</option>
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2 text-muted-foreground" />
    </label>
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
