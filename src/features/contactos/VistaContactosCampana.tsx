import { useMemo, useState } from 'react';
import {
  type ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Flame,
  Layers,
  LayoutGrid,
  List,
  Map as MapIcon,
  MapPin,
  Megaphone,
  Search,
  Star,
  Tag,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Paginador } from '../../components/Paginador';
import {
  avisosDe,
  campanasDe,
  filtrarContactos,
  inicialesDe,
  locacionDe,
  nombreVisible,
  productividad,
  puntoDePrioridad,
  quienRegistro,
  useContactosRegistrados,
  type ContactoRegistrado,
} from './contactosRegistrados';
import { PanelMapaContactos } from './PanelMapaContactos';
import { PanelContacto } from './PanelContacto';
import { BotonAsignarEtiqueta, PildoraEtiqueta, useEtiquetasDeVarios } from './EtiquetasContacto';
import { BotonFavorito } from './BotonFavorito';
import { useCategorias } from '../gestion/categorias';
import { resolverColor } from '../../dominio/paletaCategorias';
import { formatoTelefono } from '../../lib/formato';

/**
 * CONTACTOS — la vista del módulo de CAMPAÑA.
 *
 * ══ POR QUÉ NO ES LA MISMA VISTA QUE LA DE VENTAS ═══════════════════════════
 *
 * En ventas (`VistaPersonas.tsx`), la vista se apoya en el padrón de icarus
 * (ADR 0035) y en Cerberus: busca por DNI, por teléfono, ofrece diplomados y
 * cursos pasados, y calcula la compra promedio. Todo eso le pertenece a la
 * Escuela.
 *
 * En campaña no hay icarus ni Cerberus (y sus rutas ya son 403 para este
 * módulo, `modulos/modulo.ts`): lo que hay es **lo que el equipo va anotando
 * desde el chat** (`contacto_ficha`, ADR 0060) o que ingresa por campañas/anuncios.
 *
 * Misma entrada del riel («Contactos»), DOS mundos según el módulo.
 */

/**
 * Columna única, sin celda: `useReactTable` la exige pero acá solo se usa la
 * tabla como motor de PAGINACIÓN — las filas se siguen dibujando con
 * `<FilaContacto>`/`<TarjetaContacto>`, no con `flexRender`. Fuera del
 * componente para no recrearla en cada render.
 */
const COLUMNAS_CAMPANA: ColumnDef<ContactoRegistrado>[] = [{ accessorKey: 'clave' }];

export function VistaContactosCampana({
  onEscribir,
}: {
  /** Puente a Mensajes, para el botón «Mensaje» del panel. */
  onEscribir?: (telefono: string) => void;
}) {
  const { data, isLoading, isError, refetch } = useContactosRegistrados();
  const [busqueda, setBusqueda] = useState('');
  const [campana, setCampana] = useState('');
  const [aviso, setAviso] = useState('');
  const [estadoRegistro, setEstadoRegistro] = useState<'todos' | 'registrados' | 'ingresados'>('todos');
  const [prioridad, setPrioridad] = useState('');
  const [etiqueta, setEtiqueta] = useState('');
  const [registradoPor, setRegistradoPor] = useState('');
  const [soloFavoritos, setSoloFavoritos] = useState(false);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [vista, setVista] = useState<'lista' | 'cuadricula'>('lista');
  /** 50 por página (pedido del 24-ago-2026). */
  const TAMANO_PAGINA = 50;
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: TAMANO_PAGINA });
  const [mapaAbierto, setMapaAbierto] = useState(false);

  const contactos = data?.contactos ?? [];
  const porTexto = useMemo(() => filtrarContactos(contactos, busqueda), [contactos, busqueda]);
  const porCampana = useMemo(
    () => (campana ? porTexto.filter((c) => c.campanaNombre === campana || c.campanaId === campana) : porTexto),
    [porTexto, campana],
  );
  const porAviso = useMemo(
    () => (aviso ? porCampana.filter((c) => c.aviso === aviso || c.adId === aviso) : porCampana),
    [porCampana, aviso],
  );
  const porEstado = useMemo(() => {
    if (estadoRegistro === 'registrados') return porAviso.filter((c) => c.registrado);
    if (estadoRegistro === 'ingresados') return porAviso.filter((c) => !c.registrado);
    return porAviso;
  }, [porAviso, estadoRegistro]);

  const porPrioridad = useMemo(
    () => (prioridad ? porEstado.filter((c) => c.prioridad?.toLowerCase() === prioridad.toLowerCase()) : porEstado),
    [porEstado, prioridad],
  );
  const porFavorito = useMemo(
    () => (soloFavoritos ? porPrioridad.filter((c) => c.favorito) : porPrioridad),
    [porPrioridad, soloFavoritos],
  );
  const porRegistrante = useMemo(
    () => (registradoPor ? porFavorito.filter((c) => quienRegistro(c.vendedoraId) === registradoPor) : porFavorito),
    [porFavorito, registradoPor],
  );

  // Las etiquetas de la lista visible, en UN pedido — no una consulta por fila.
  const claves = useMemo(() => porRegistrante.map((c) => c.clave), [porRegistrante]);
  const { data: etiquetasDe = {} } = useEtiquetasDeVarios(claves);
  const visibles = useMemo(
    () => (etiqueta ? porRegistrante.filter((c) => (etiquetasDe[c.clave] ?? []).includes(etiqueta)) : porRegistrante),
    [porRegistrante, etiqueta, etiquetasDe],
  );

  const campanas = useMemo(() => campanasDe(contactos), [contactos]);
  const avisos = useMemo(() => avisosDe(contactos, campana || undefined), [contactos, campana]);
  const { data: categorias = [] } = useCategorias();
  const porPersona = useMemo(() => productividad(data?.porPersona ?? []), [data?.porPersona]);
  const contactoSeleccionado = visibles.find((c) => c.clave === seleccionado) ?? null;

  // Mismo clamp que antes (`paginaSegura`): un filtro que recorta la lista no
  // resetea la página elegida, solo la muestra recortada mientras dure.
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / TAMANO_PAGINA));
  const pageIndexClamped = Math.min(pagination.pageIndex, totalPaginas - 1);

  const tablaContactos = useReactTable({
    data: visibles,
    columns: COLUMNAS_CAMPANA,
    state: { pagination: { ...pagination, pageIndex: pageIndexClamped } },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const visiblesPagina = tablaContactos.getRowModel().rows.map((r) => r.original);

  /** Quién registró o atendió a alguien, sin repetir */
  const registrantes = useMemo(() => {
    const nombres = new Set(contactos.map((c) => quienRegistro(c.vendedoraId)).filter(Boolean));
    return [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
  }, [contactos]);

  const hayFiltros = Boolean(
    busqueda.trim() ||
      campana ||
      aviso ||
      estadoRegistro !== 'todos' ||
      prioridad ||
      etiqueta ||
      registradoPor ||
      soloFavoritos,
  );

  const limpiarFiltros = () => {
    setBusqueda('');
    setCampana('');
    setAviso('');
    setEstadoRegistro('todos');
    setPrioridad('');
    setEtiqueta('');
    setRegistradoPor('');
    setSoloFavoritos(false);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
      {/* Fila 1: Buscador manda + Nuevo contacto + selector de vista */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, teléfono, campaña, anuncio, prioridad o agente…"
            aria-label="Buscar contactos"
            className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>

        <button
          type="button"
          onClick={() => setMapaAbierto(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary"
        >
          <MapIcon size={14} />
          Detalles
        </button>

        <span className="flex shrink-0 overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setVista('lista')}
            aria-label="Ver como lista"
            aria-pressed={vista === 'lista'}
            className={'p-2 transition-colors ' + (vista === 'lista' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onClick={() => setVista('cuadricula')}
            aria-label="Ver como cuadrícula"
            aria-pressed={vista === 'cuadricula'}
            className={'p-2 transition-colors ' + (vista === 'cuadricula' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
          >
            <LayoutGrid size={14} />
          </button>
        </span>
      </div>

      {/* Fila 2: Filtros específicos por Campaña, Anuncio, Registro, Prioridad, Etiquetas, Agente, Favoritos */}
      <div className="flex flex-wrap items-center gap-2">
        <SelectorFiltro
          icono={Megaphone}
          etiqueta="Campaña"
          placeholder="Todas las campañas"
          valor={campana}
          onCambiar={(c) => {
            setCampana(c);
            setAviso('');
          }}
          opciones={campanas}
        />

        <SelectorFiltro
          icono={Layers}
          etiqueta="Anuncio"
          placeholder="Todos los anuncios"
          valor={aviso}
          onCambiar={setAviso}
          opciones={avisos}
        />

        {/* Mismo alto que los `SelectorFiltro` de al lado: su `<select>` lleva
            `py-2`, así que estos botones lo copian — con el `p-0.5` que tenía
            este contenedor quedaban 4px más bajos que sus vecinos. */}
        <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-border bg-card text-xs">
          <button
            type="button"
            onClick={() => setEstadoRegistro('todos')}
            aria-pressed={estadoRegistro === 'todos'}
            title="Todos los contactos: los registrados a mano y los que solo entraron por chat o anuncio"
            className={
              'px-2.5 py-2 text-xs font-medium transition-colors ' +
              (estadoRegistro === 'todos' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')
            }
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setEstadoRegistro('registrados')}
            aria-pressed={estadoRegistro === 'registrados'}
            title="Contactos con ficha: alguien del equipo cargó sus datos a mano"
            className={
              'px-2.5 py-2 text-xs font-medium transition-colors ' +
              (estadoRegistro === 'registrados' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')
            }
          >
            Registrados
          </button>
          <button
            type="button"
            onClick={() => setEstadoRegistro('ingresados')}
            aria-pressed={estadoRegistro === 'ingresados'}
            title="Contactos que solo entraron por chat o anuncio: todavía nadie cargó su ficha a mano"
            className={
              'px-2.5 py-2 text-xs font-medium transition-colors ' +
              (estadoRegistro === 'ingresados' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')
            }
          >
            Solo ingresados
          </button>
        </div>

        <SelectorFiltro
          icono={Flame}
          etiqueta="Prioridad"
          placeholder="Todas las prioridades"
          valor={prioridad}
          onCambiar={setPrioridad}
          opciones={[
            { valor: 'alta', rotulo: 'Alta' },
            { valor: 'media', rotulo: 'Media' },
            { valor: 'baja', rotulo: 'Baja' },
          ]}
        />
        <SelectorFiltro
          icono={Tag}
          etiqueta="Etiquetas"
          placeholder="Todas las etiquetas"
          valor={etiqueta}
          onCambiar={setEtiqueta}
          opciones={categorias.map((c) => c.nombre)}
        />
        <SelectorFiltro
          icono={User}
          etiqueta="Agente"
          placeholder="Agentes"
          valor={registradoPor}
          onCambiar={setRegistradoPor}
          opciones={registrantes}
        />

        <button
          type="button"
          onClick={() => setSoloFavoritos((v) => !v)}
          aria-pressed={soloFavoritos}
          className={
            'flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ' +
            (soloFavoritos
              ? 'border-warning bg-warning/10 text-warning-foreground'
              : 'border-border bg-card text-foreground hover:border-primary')
          }
        >
          <Star size={13} className={soloFavoritos ? 'fill-warning text-warning' : 'text-muted-foreground'} />
          Favoritos
        </button>

        {hayFiltros && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="shrink-0 text-xs font-semibold text-primary hover:underline"
          >
            Limpiar filtros
          </button>
        )}

        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {hayFiltros && visibles.length !== contactos.length
            ? `${visibles.length} de ${contactos.length}`
            : `${contactos.length} ${contactos.length === 1 ? 'contacto' : 'contactos'}`}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && <p className="px-4 py-6 text-sm text-muted-foreground">Cargando…</p>}

        {isError && (
          <p className="px-4 py-6 text-sm text-danger">
            No se pudieron traer los contactos. Probá de nuevo en un momento.
          </p>
        )}

        {!isLoading && !isError && contactos.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Users size={22} className="text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Todavía no registraron a nadie</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Los contactos se registran desde el chat, con el botón «Contacto» de la barra. Acá
              van apareciendo todos los del equipo.
            </p>
          </div>
        )}

        {!isLoading && !isError && contactos.length > 0 && visibles.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">Ningún contacto coincide con los filtros.</p>
        )}

        {visibles.length > 0 && vista === 'lista' && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-semibold w-[24%]">Contacto</th>
                <th className="px-4 py-3 font-semibold w-[14%]">Teléfono</th>
                <th className="px-4 py-3 font-semibold w-[16%]">Campaña</th>
                <th className="px-4 py-3 font-semibold w-[16%]">Anuncio</th>
                <th className="px-4 py-3 font-semibold w-[16%]">Locación</th>
                <th className="px-5 py-3 font-semibold w-[14%] text-right">Etiquetas</th>
              </tr>
            </thead>
            <tbody>
              {visiblesPagina.map((c) => (
                <FilaContacto
                  key={c.clave}
                  c={c}
                  etiquetas={etiquetasDe[c.clave] ?? []}
                  categorias={categorias}
                  seleccionada={c.clave === seleccionado}
                  onSeleccionar={() => setSeleccionado(c.clave)}
                />
              ))}
            </tbody>
          </table>
        )}

        {visibles.length > 0 && vista === 'cuadricula' && (
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visiblesPagina.map((c) => (
              <TarjetaContacto
                key={c.clave}
                c={c}
                etiquetas={etiquetasDe[c.clave] ?? []}
                categorias={categorias}
                seleccionada={c.clave === seleccionado}
                onSeleccionar={() => setSeleccionado(c.clave)}
              />
            ))}
          </div>
        )}
      </div>

      <Paginador
        paginaActual={pageIndexClamped + 1}
        totalPaginas={totalPaginas}
        puedeAnterior={pageIndexClamped > 0}
        puedeSiguiente={pageIndexClamped < totalPaginas - 1}
        onAnterior={() => tablaContactos.previousPage()}
        onSiguiente={() => tablaContactos.nextPage()}
        onIrA={(n) => tablaContactos.setPageIndex(n - 1)}
      />
      </div>

      {porPersona.length > 1 && (
        <div className="shrink-0 rounded-xl border border-border bg-card px-4 py-2.5">
          <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Cuántos registró cada uno
          </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {porPersona.map((p) => (
              <span key={p.nombre} className="text-xs text-foreground">
                {p.nombre} <span className="font-semibold">{p.cuantos}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {contactoSeleccionado && (
        <PanelContacto contacto={contactoSeleccionado} onCerrar={() => setSeleccionado(null)} onEscribir={onEscribir} />
      )}

      {mapaAbierto && (
        <PanelMapaContactos contactos={visibles} onCerrar={() => setMapaAbierto(false)} onRefrescar={refetch} />
      )}
    </div>
  );
}

function FilaContacto({
  c,
  etiquetas,
  categorias,
  seleccionada,
  onSeleccionar,
}: {
  c: ContactoRegistrado;
  etiquetas: string[];
  categorias: { nombre: string; color: string }[];
  seleccionada: boolean;
  onSeleccionar: () => void;
}) {
  const punto = puntoDePrioridad(c.prioridad);
  return (
    <tr
      onClick={onSeleccionar}
      aria-current={seleccionada}
      className={
        'cursor-pointer border-b border-border/70 transition-colors last:border-b-0 hover:bg-muted/40 ' +
        (seleccionada ? 'bg-primary/5' : '')
      }
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {inicialesDe(nombreVisible(c))}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-foreground">{nombreVisible(c)}</span>
              {punto && (
                <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                  <span className={'size-1.5 rounded-full ' + punto.clase} />
                  {punto.rotulo}
                </span>
              )}
              {c.registrado === false && (
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Ingresado
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{c.vendedoraId ? quienRegistro(c.vendedoraId) : 'Sin agente'}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground tabular-nums">
        {c.telefono ? formatoTelefono(c.telefono) : '—'}
      </td>
      <td className="px-4 py-3.5">
        {c.campanaNombre ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground truncate max-w-[200px]" title={`Campaña: ${c.campanaNombre}`}>
            <Megaphone size={12} className="shrink-0 text-primary" />
            <span className="truncate">{c.campanaNombre}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        {c.aviso ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-[200px]" title={`Anuncio: ${c.aviso}`}>
            <Layers size={12} className="shrink-0 text-muted-foreground/70" />
            <span className="truncate">{c.aviso}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </td>
      {/* La ubicación que CLASIFICÓ el mapa (ADR 0088) — la dirección completa
          que se tipeó ahí vive en la ficha, no acá. Prioridad: el distrito
          PROPIO de la campaña si el punto cayó ahí: es el dato específico por
          el que se pregunta todos los días. Si no calzó con ninguno, la
          geografía real (pedido del 1-sep-2026): «distrito, departamento» o
          «provincia, departamento», nunca un nombre suelto — la columna no
          puede quedar en «—» solo porque la campaña todavía no cargó el
          distrito de esa zona. */}
      <td className="px-4 py-3.5">
        {/* El hover dice la DIRECCIÓN COMPLETA — la misma que la ficha y el
            panel del chat — para que las tres pantallas cuenten lo mismo de
            este contacto y la etiqueta corta no sea la única versión visible. */}
        {locacionDe(c) ? (
          <span
            className="flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-[160px]"
            title={c.direccion ? `${locacionDe(c)} — ${c.direccion}` : `Locación: ${locacionDe(c)}`}
          >
            <MapPin size={12} className="shrink-0 text-muted-foreground/70" />
            <span className="truncate">{locacionDe(c)}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {etiquetas.map((etq) => (
            <PildoraEtiqueta key={etq} clave={c.clave} etiqueta={etq} color={resolverColor(etq, categorias)} compacto />
          ))}
          {/* Es la ÚLTIMA columna, pegada al borde derecho de la tabla: abrir
              hacia la derecha (como la tarjeta) saca el popover del
              `overflow-hidden` que envuelve la tabla y lo recorta. */}
          <BotonAsignarEtiqueta clave={c.clave} asignadas={etiquetas} compacto abrirALaIzquierda />
          <BotonFavorito clave={c.clave} favorito={c.favorito} compacto />
        </div>
      </td>
    </tr>
  );
}

function TarjetaContacto({
  c,
  etiquetas,
  categorias,
  seleccionada,
  onSeleccionar,
}: {
  c: ContactoRegistrado;
  etiquetas: string[];
  categorias: { nombre: string; color: string }[];
  seleccionada: boolean;
  onSeleccionar: () => void;
}) {
  const punto = puntoDePrioridad(c.prioridad);
  return (
    <div
      onClick={onSeleccionar}
      aria-current={seleccionada}
      className={
        'cursor-pointer rounded-xl border bg-card p-3 transition-colors hover:border-primary/50 ' +
        (seleccionada ? 'border-primary bg-primary/5' : 'border-border')
      }
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
          {inicialesDe(nombreVisible(c))}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs font-semibold text-foreground">{nombreVisible(c)}</p>
            {punto && (
              <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                <span className={'size-1.5 rounded-full ' + punto.clase} />
                {punto.rotulo}
              </span>
            )}
            {c.registrado === false && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                Ingresado
              </span>
            )}
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">{c.telefono ? formatoTelefono(c.telefono) : '—'}</p>
        </div>
      </div>

      {(c.campanaNombre || c.aviso || locacionDe(c)) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-1.5 text-[10px]">
          {c.campanaNombre && (
            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary" title={`Campaña: ${c.campanaNombre}`}>
              <Megaphone size={10} className="shrink-0" />
              <span className="truncate max-w-[120px]">{c.campanaNombre}</span>
            </span>
          )}
          {c.aviso && (
            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground" title={`Anuncio: ${c.aviso}`}>
              <Layers size={10} className="shrink-0" />
              <span className="truncate max-w-[110px]">{c.aviso}</span>
            </span>
          )}
          {locacionDe(c) && (
            <span
              className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground"
              title={c.direccion ? `${locacionDe(c)} — ${c.direccion}` : `Locación: ${locacionDe(c)}`}
            >
              <MapPin size={10} className="shrink-0" />
              <span className="truncate max-w-[110px]">{locacionDe(c)}</span>
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {etiquetas.map((etq) => (
          <PildoraEtiqueta key={etq} clave={c.clave} etiqueta={etq} color={resolverColor(etq, categorias)} compacto />
        ))}
        <BotonAsignarEtiqueta clave={c.clave} asignadas={etiquetas} compacto />
        <span className="ml-auto">
          <BotonFavorito clave={c.clave} favorito={c.favorito} compacto />
        </span>
      </div>
    </div>
  );
}

function SelectorFiltro({
  icono: Icono,
  etiqueta,
  placeholder,
  valor,
  opciones,
  onCambiar,
  deshabilitado = false,
  tituloDeshabilitado,
}: {
  icono: LucideIcon;
  etiqueta: string;
  placeholder: string;
  valor: string;
  opciones: (string | { valor: string; rotulo: string })[];
  onCambiar: (v: string) => void;
  /** Sin función todavía: el `<select>` queda inerte, con su propio cursor y hover. */
  deshabilitado?: boolean;
  /** El texto del hover cuando `deshabilitado` — va en el CONTENEDOR, no en el `<select>`: un
      elemento `disabled` no siempre dispara el `title` nativo en todos los navegadores. */
  tituloDeshabilitado?: string;
}) {
  return (
    // `shrink-0`: sin esto, en la fila apretada el `<select>` se angostaba por
    // debajo del ancho de su propio texto antes de saltar de línea (el resto
    // de los controles de esta fila —Favoritos, el contador— ya lo tenían) y
    // su contenido se salía de la caja en vez de mostrarse completo.
    <span className="relative shrink-0" title={deshabilitado ? tituloDeshabilitado : undefined}>
      <Icono size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <select
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        aria-label={etiqueta}
        disabled={deshabilitado}
        className={
          'appearance-none rounded-lg border border-border bg-card py-2 pl-7 pr-6 text-xs font-medium text-foreground outline-none transition-colors focus:border-primary ' +
          (deshabilitado ? 'cursor-not-allowed opacity-60' : '')
        }
      >
        <option value="">{placeholder}</option>
        {opciones.map((o) => {
          const val = typeof o === 'string' ? o : o.valor;
          const rot = typeof o === 'string' ? o : o.rotulo;
          return (
            <option key={val} value={val}>
              {rot}
            </option>
          );
        })}
      </select>
    </span>
  );
}
