import { useMemo, useState } from 'react';
import { ChevronDown, Package, Search } from 'lucide-react';
import { sectionLabel } from '../../lib/styles';
import {
  categoriasDe,
  conteosPorCategoria,
  conteosPorDivision,
  conteosPorNegocio,
  divisionesDe,
  filtrarProductos,
  negociosDe,
  FILTROS_VACIOS,
  MONEDA_DEL_CATALOGO,
  useCatalogoProductos,
  type EstadoProducto,
  type FiltrosProductos,
} from './productos';

const ROTULO_ESTADO: Record<EstadoProducto, string> = {
  todos: 'Todos',
  disponible: 'Disponible',
  no_disponible: 'No disponible',
};

/**
 * PRODUCTOS — el catálogo de Cerberus, para MIRAR.
 *
 * No es el buscador del carrito (`CarritoDeseado`, `FormularioVenta`): ese
 * arma una venta y por eso solo ofrece lo `Disponible`. Esto es al revés —
 * la pregunta que responde es «¿qué vendemos, a cuánto y con qué SKU?», y
 * para eso hace falta poder ver también lo que se dio de baja: un producto
 * que dejó de venderse sigue siendo parte del catálogo que hay que conocer.
 *
 * ── LOS CUATRO FILTROS, todos combobox (revierte los chips del 20-ago) ──
 * Categoría, Negocio y División son de UN solo valor —«Curso Online o
 * E-Book a la vez» casi no se pide, y con 14 valores los chips ocupaban dos
 * filas—; Estado es el vocabulario cerrado de Cerberus, no derivado:
 * Disponible / No disponible / Todos. Los tres derivados (Categoría, Negocio,
 * División) muestran cuántos productos agregaría CADA opción, calculado sin
 * su propio filtro (mismo criterio que las facetas del padrón).
 *
 * Solo lectura: acá no se crea, edita ni borra nada — eso se sigue haciendo
 * en Cerberus. `soloPara: noEsDeCampana` en el riel (`App.tsx`): es el
 * catálogo de productos de la Escuela, y una campaña no vende nada.
 */
export function VistaProductos() {
  const { data: productos, isPending, isError, error, refetch, isFetching } = useCatalogoProductos();
  const [filtros, setFiltros] = useState<FiltrosProductos>(FILTROS_VACIOS);

  const categorias = useMemo(() => categoriasDe(productos ?? []), [productos]);
  const negocios = useMemo(() => negociosDe(productos ?? []), [productos]);
  const divisiones = useMemo(() => divisionesDe(productos ?? []), [productos]);

  const conteosCategoria = useMemo(() => conteosPorCategoria(productos ?? [], filtros), [productos, filtros]);
  const conteosNegocio = useMemo(() => conteosPorNegocio(productos ?? [], filtros), [productos, filtros]);
  const conteosDivision = useMemo(() => conteosPorDivision(productos ?? [], filtros), [productos, filtros]);

  const filtrados = useMemo(() => filtrarProductos(productos ?? [], filtros), [productos, filtros]);

  if (isPending) {
    return (
      <div className="min-h-0 flex-1 space-y-2 p-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-xs font-medium text-foreground">No se pudo leer el catálogo de productos</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {error instanceof Error ? error.message : 'Cerberus no respondió.'}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 max-w-sm flex-1">
            <Search
              size={14}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={filtros.q}
              onChange={(e) => setFiltros((f) => ({ ...f, q: e.target.value }))}
              placeholder="Buscar por nombre o SKU…"
              className="h-9 w-full rounded-lg border border-border bg-muted pl-8 pr-3 text-xs outline-none focus:border-primary"
            />
          </div>

          {/* Los cuatro comparten ALTO, ANCHO y tipografía a propósito — es lo
              que hace que se lean como UN grupo de filtros y no como cuatro
              controles sueltos que quedaron cada uno con el ancho de su
              propio texto. */}
          <SelectorFiltro
            etiqueta="Categoría"
            value={filtros.categoria}
            onChange={(v) => setFiltros((f) => ({ ...f, categoria: v }))}
            placeholder="Todas las categorías"
            opciones={categorias.map((c) => ({ value: c, label: `${c} (${conteosCategoria.get(c) ?? 0})` }))}
          />
          <SelectorFiltro
            etiqueta="Negocio"
            value={filtros.negocio}
            onChange={(v) => setFiltros((f) => ({ ...f, negocio: v }))}
            placeholder="Todos los negocios"
            opciones={negocios.map((n) => ({ value: n, label: `${n} (${conteosNegocio.get(n) ?? 0})` }))}
          />
          <SelectorFiltro
            etiqueta="División"
            value={filtros.division}
            onChange={(v) => setFiltros((f) => ({ ...f, division: v }))}
            placeholder="Todas las divisiones"
            opciones={divisiones.map((d) => ({ value: d, label: `${d} (${conteosDivision.get(d) ?? 0})` }))}
          />
          <SelectorFiltro
            etiqueta="Estado"
            value={filtros.estado}
            onChange={(v) => setFiltros((f) => ({ ...f, estado: v as EstadoProducto }))}
            placeholder={null}
            opciones={[
              { value: 'disponible', label: ROTULO_ESTADO.disponible },
              { value: 'no_disponible', label: ROTULO_ESTADO.no_disponible },
              { value: 'todos', label: ROTULO_ESTADO.todos },
            ]}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtrados.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <p className="max-w-sm text-center text-[11px] leading-relaxed text-muted-foreground">
              {(productos?.length ?? 0) === 0
                ? 'Cerberus no tiene productos cargados.'
                : 'Nada matchea este filtro — prueba con otra búsqueda o saca algún recorte.'}
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className={'border-b border-border text-left ' + sectionLabel}>
                <th className="px-4 py-2.5 font-semibold">SKU</th>
                <th className="px-4 py-2.5 font-semibold">Producto</th>
                <th className="px-4 py-2.5 font-semibold">Negocio</th>
                <th className="px-4 py-2.5 font-semibold">División</th>
                <th className="px-4 py-2.5 text-right font-semibold">Precio Normal</th>
                <th className="px-4 py-2.5 text-right font-semibold">Precio Promoción</th>
                <th className="px-4 py-2.5 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => {
                const moneda = p.moneda || MONEDA_DEL_CATALOGO;
                return (
                  <tr
                    key={p.id}
                    className={
                      'border-b border-border/60 last:border-0 transition-colors hover:bg-muted/60 ' +
                      (i % 2 === 1 ? 'bg-muted/20' : '')
                    }
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 align-top font-mono text-[10px] text-muted-foreground">
                      {p.sku}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <div className="font-medium leading-snug text-foreground">{p.nombre}</div>
                      {p.categoria && (
                        <span className="mt-1 inline-flex rounded bg-secondary px-1.5 py-[1px] text-[10px] font-semibold text-secondary-foreground">
                          {p.categoria}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 align-top text-muted-foreground">
                      {p.negocio || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 align-top text-muted-foreground">
                      {p.division || '—'}
                    </td>
                    {/* Los dos precios, cada uno en su columna, tal cual — sin
                        tachado ni combinarlos en una sola celda: son DOS datos
                        de Cerberus (`precio_normal` / `precio_promocion`), no
                        una cuenta que Hermes arma. */}
                    <td className="whitespace-nowrap px-4 py-2.5 align-top text-right font-mono tabular-nums text-muted-foreground">
                      {moneda} {p.precioNormal.toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 align-top text-right font-mono font-semibold tabular-nums text-navy-ink">
                      {moneda} {p.precioPromocion.toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 align-top">
                      <span
                        className={
                          'inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-bold ' +
                          (p.disponible ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')
                        }
                      >
                        <span
                          aria-hidden
                          className={'size-1.5 rounded-full ' + (p.disponible ? 'bg-success' : 'bg-muted-foreground/50')}
                        />
                        {p.disponible ? 'Disponible' : 'Dado de baja'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-t border-border bg-card px-4 py-2 text-[11px] text-muted-foreground">
        <Package size={12} aria-hidden />
        {filtrados.length === (productos ?? []).length
          ? `${filtrados.length} producto${filtrados.length === 1 ? '' : 's'}`
          : `${filtrados.length} de ${(productos ?? []).length} productos`}
        {isFetching && <span className="ml-1">· actualizando…</span>}
      </div>
    </div>
  );
}

/**
 * Un `<select>` de filtro — los cuatro (Categoría, Negocio, División, Estado)
 * usan ÉSTE, nunca uno armado a mano por caso: es lo que garantiza el mismo
 * alto, ancho y tipografía en los cuatro, en vez de que cada uno termine con
 * el ancho de su propio texto y la fila se vea despareja.
 *
 * `appearance-none` + la flecha propia (`ChevronDown`) porque la flecha
 * NATIVA de un `<select>` la dibuja el sistema operativo — en Windows es más
 * angosta y se ve más arriba que en macOS— y con eso el mismo control se ve
 * distinto según quién lo mire, aunque el CSS sea idéntico.
 *
 * `placeholder` va como primera opción cuando el campo es «vacío = todos»
 * (Categoría, Negocio, División); `null` cuando el vocabulario ya es cerrado
 * y no hay un «vacío» que ofrecer (Estado, que siempre arranca en un valor
 * real).
 */
function SelectorFiltro({
  etiqueta,
  value,
  onChange,
  opciones,
  placeholder,
}: {
  etiqueta: string;
  value: string;
  onChange: (v: string) => void;
  opciones: { value: string; label: string }[];
  placeholder: string | null;
}) {
  return (
    <div className="relative w-44 shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={etiqueta}
        className="h-9 w-full appearance-none truncate rounded-lg border border-border bg-muted pl-3 pr-8 text-xs font-medium text-foreground outline-none focus:border-primary"
      >
        {placeholder !== null && <option value="">{placeholder}</option>}
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
