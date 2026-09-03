import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Layers,
  LayoutGrid,
  List,
  Megaphone,
  Search,
  Star,
  Tag,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  avisosDe,
  campanasDe,
  filtrarContactos,
  inicialesDe,
  nombreVisible,
  productividad,
  puntoDePrioridad,
  quienRegistro,
  useContactosRegistrados,
  type ContactoRegistrado,
} from './contactosRegistrados';
import { NuevoContacto } from './NuevoContacto';
import { PanelContacto } from './PanelContacto';
import { BotonAsignarEtiqueta, useEtiquetasDeVarios } from './EtiquetasContacto';
import { BotonFavorito } from './BotonFavorito';
import { useCategorias } from '../gestion/categorias';
import { claseBorde, CLASE_TEXTO, resolverColor } from '../../dominio/paletaCategorias';
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
export function VistaContactosCampana({
  esCandidato = false,
  onEscribir,
}: {
  /** ¿Es el candidato? Decide si ve «Nuevo contacto». El server niega de verdad. */
  esCandidato?: boolean;
  /** Puente a Mensajes, para el botón «Mensaje» del panel. */
  onEscribir?: (telefono: string) => void;
}) {
  const { data, isLoading, isError } = useContactosRegistrados();
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
  const [pagina, setPagina] = useState(1);

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

  /** 50 por página (pedido del 24-ago-2026) — clampeada */
  const TAMANO_PAGINA = 50;
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / TAMANO_PAGINA));
  const paginaSegura = Math.min(Math.max(1, pagina), totalPaginas);
  const visiblesPagina = useMemo(
    () => visibles.slice((paginaSegura - 1) * TAMANO_PAGINA, paginaSegura * TAMANO_PAGINA),
    [visibles, paginaSegura],
  );

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
            placeholder="Buscar por nombre, teléfono, campaña, aviso, prioridad o agente…"
            aria-label="Buscar contactos"
            className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>

        {esCandidato && <NuevoContacto />}

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

      {/* Fila 2: Filtros específicos por Campaña, Aviso, Registro, Prioridad, Etiquetas, Agente, Favoritos */}
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
          etiqueta="Aviso"
          placeholder="Todos los avisos"
          valor={aviso}
          onCambiar={setAviso}
          opciones={avisos}
        />

        <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-border bg-card p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setEstadoRegistro('todos')}
            aria-pressed={estadoRegistro === 'todos'}
            className={
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors ' +
              (estadoRegistro === 'todos' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')
            }
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setEstadoRegistro('registrados')}
            aria-pressed={estadoRegistro === 'registrados'}
            className={
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors ' +
              (estadoRegistro === 'registrados' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')
            }
          >
            Registrados
          </button>
          <button
            type="button"
            onClick={() => setEstadoRegistro('ingresados')}
            aria-pressed={estadoRegistro === 'ingresados'}
            className={
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors ' +
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
              Los contactos se registran desde el chat, con el botón «Contacto» de la barra
              {esCandidato && ', o con «Nuevo contacto» acá arriba'}. Acá van apareciendo todos los del equipo.
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
                <th className="px-5 py-3 font-semibold w-[28%]">Contacto</th>
                <th className="px-4 py-3 font-semibold w-[18%]">Teléfono</th>
                <th className="px-4 py-3 font-semibold w-[20%]">Campaña</th>
                <th className="px-4 py-3 font-semibold w-[20%]">Aviso</th>
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

      <div className="flex shrink-0 items-center justify-center gap-3 border-t border-border bg-card px-4 py-2 text-xs">
        <button
          type="button"
          disabled={paginaSegura <= 1}
          onClick={() => setPagina(paginaSegura - 1)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-foreground hover:bg-muted disabled:opacity-30"
        >
          <ChevronLeft size={13} /> Anterior
        </button>
        <span className="tabular-nums text-muted-foreground">
          {paginaSegura} de {totalPaginas.toLocaleString('es')}
        </span>
        <button
          type="button"
          disabled={paginaSegura >= totalPaginas}
          onClick={() => setPagina(paginaSegura + 1)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-foreground hover:bg-muted disabled:opacity-30"
        >
          Siguiente <ChevronRight size={13} />
        </button>
      </div>
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
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-[200px]" title={`Aviso: ${c.aviso}`}>
            <Layers size={12} className="shrink-0 text-muted-foreground/70" />
            <span className="truncate">{c.aviso}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {etiquetas.map((etq) => {
            const color = resolverColor(etq, categorias);
            return (
              <span
                key={etq}
                className={
                  'inline-flex items-center rounded-full border bg-card px-2 py-0.5 text-[10px] font-semibold ' +
                  claseBorde(color) +
                  (color ? ' ' + CLASE_TEXTO[color] : ' text-muted-foreground')
                }
              >
                {etq}
              </span>
            );
          })}
          <BotonAsignarEtiqueta clave={c.clave} asignadas={etiquetas} compacto />
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

      {(c.campanaNombre || c.aviso) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-1.5 text-[10px]">
          {c.campanaNombre && (
            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary" title={`Campaña: ${c.campanaNombre}`}>
              <Megaphone size={10} className="shrink-0" />
              <span className="truncate max-w-[120px]">{c.campanaNombre}</span>
            </span>
          )}
          {c.aviso && (
            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground" title={`Aviso: ${c.aviso}`}>
              <Layers size={10} className="shrink-0" />
              <span className="truncate max-w-[110px]">{c.aviso}</span>
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {etiquetas.map((etq) => {
          const color = resolverColor(etq, categorias);
          return (
            <span
              key={etq}
              className={
                'inline-flex items-center rounded-full border bg-card px-1.5 py-0.5 text-[10px] font-semibold ' +
                claseBorde(color) +
                (color ? ' ' + CLASE_TEXTO[color] : ' text-muted-foreground')
              }
            >
              {etq}
            </span>
          );
        })}
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
}: {
  icono: LucideIcon;
  etiqueta: string;
  placeholder: string;
  valor: string;
  opciones: (string | { valor: string; rotulo: string })[];
  onCambiar: (v: string) => void;
}) {
  return (
    <span className="relative">
      <Icono size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <select
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        aria-label={etiqueta}
        className="appearance-none rounded-lg border border-border bg-card py-2 pl-7 pr-6 text-xs font-medium text-foreground outline-none transition-colors focus:border-primary"
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
