import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  GraduationCap,
  Search,
  Shirt,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { BotonCopiar } from './BotonCopiar';
import { HojaDelProducto } from './HojaDelProducto';
import { Portada } from './Portada';
import {
  agruparEnProductos,
  categoriasDe,
  conBajas,
  conBusqueda,
  conDivision,
  conNegocio,
  dadosDeBajaEn,
  divisionesDe,
  filtrar,
  monto,
  negocioInicial,
  negociosDe,
  precioDe,
  RECORTE_INICIAL,
  seDibuja,
  textoDePrecio,
  useCatalogoProductos,
  type Opcion,
  type Precio,
  type Producto,
  type ProductoCatalogo,
  type Recorte,
} from './productos';

/** Dónde se recuerda el último negocio elegido — por navegador, como el panel colapsado. */
const CLAVE_NEGOCIO = 'hermes.productos.negocio';

/**
 * Los tres negocios que llegan. «Consultoria» no está porque el server no lo manda
 * (`cerberus/negociosDeVentas.ts`, enmienda a ADR 0106 del 12-sep-2026); uno que no
 * esté acá cae en `Store`.
 */
const ICONO_NEGOCIO: Record<string, LucideIcon> = {
  Escuela: GraduationCap,
  Editorial: BookOpen,
  LifeStyle: Shirt,
};

/**
 * PRODUCTOS — el catálogo de Cerberus por negocio, para CONSULTAR (ADR 0106).
 *
 * Reemplaza a la tabla de una fila por SKU con cuatro selectores que no se hablaban.
 * No es el buscador del carrito (`FormularioVenta`): ese arma una venta y por eso sólo
 * ofrece lo `Disponible`. Esto responde «¿qué vendemos, a cuánto y con qué SKU?», y
 * por eso también deja mirar lo dado de baja.
 *
 * ── LA FORMA, DE ARRIBA A ABAJO ──
 *   1. **Negocio**: el filtro principal, siempre a la vista, con cuántos productos
 *      tiene. Se recuerda el último elegido (D1).
 *   2. **División y Categoría**: sólo si tienen más de una opción DENTRO de lo
 *      elegido arriba (regla del cero), y lo que ya no existe se suelta.
 *   3. **La grilla**: una tarjeta por producto, con portada. Responde al ancho de SU
 *      contenedor (container queries), no al de la ventana: con la hoja abierta a
 *      1280 px pasa sola de 4 a 3 columnas, y en el teléfono la tarjeta es un
 *      renglón con miniatura.
 *   4. **La hoja** del producto, con la ÚNICA acción primaria de la pantalla.
 *
 * Solo lectura: acá no se crea, edita ni borra nada — eso se sigue haciendo en
 * Cerberus. `soloPara: noEsDeCampana` en el riel (`App.tsx`): es el catálogo de la
 * Escuela, y una campaña no vende nada.
 *
 * `inicial` existe para la galería y los tests (abrir con un recorte o una hoja
 * puestos). La app no lo pasa.
 */
export function VistaProductos({
  inicial,
}: {
  inicial?: { recorte?: Partial<Recorte>; detalle?: string | null };
} = {}) {
  const { data: catalogo, isError, error, refetch, isFetching } = useCatalogoProductos();

  // Sin datos todavía: o se está pidiendo o falló. Con datos y un refresco fallido,
  // se sigue mostrando lo que había — tirar el catálogo por un reintento sería peor.
  if (catalogo === undefined) {
    return isError ? (
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
    ) : (
      <Esqueleto />
    );
  }

  if (catalogo.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <p className="max-w-sm text-center text-[11px] leading-relaxed text-muted-foreground">
          Cerberus no tiene productos cargados.
        </p>
      </div>
    );
  }

  return <CatalogoPorNegocio catalogo={catalogo} actualizando={isFetching} inicial={inicial} />;
}

function CatalogoPorNegocio({
  catalogo,
  actualizando,
  inicial,
}: {
  catalogo: readonly ProductoCatalogo[];
  actualizando: boolean;
  inicial?: { recorte?: Partial<Recorte>; detalle?: string | null };
}) {
  const productos = agruparEnProductos(catalogo);
  const [negocioGuardado, guardarNegocio] = useLocalStorage<string | null>(CLAVE_NEGOCIO, null);
  const [recorte, setRecorte] = useState<Recorte>(() => {
    const base = { ...RECORTE_INICIAL, ...inicial?.recorte };
    const negocio = inicial?.recorte?.negocio ?? negocioInicial(productos, negocioGuardado);
    const conElNegocio = conNegocio(productos, base, negocio);
    return base.division ? conDivision(productos, conElNegocio, base.division) : conElNegocio;
  });
  const [abierto, setAbierto] = useState<string | null>(inicial?.detalle ?? null);

  const negocios = negociosDe(productos, recorte);
  const divisiones = divisionesDe(productos, recorte);
  const categorias = categoriasDe(productos, recorte);
  const visibles = filtrar(productos, recorte);
  const bajas = dadosDeBajaEn(productos, recorte);
  const detalle = abierto ? (productos.find((p) => p.familia === abierto) ?? null) : null;
  const conDivisiones = seDibuja(divisiones);
  const conCategorias = seDibuja(categorias);

  function elegirNegocio(negocio: string) {
    setRecorte((r) => conNegocio(productos, r, negocio));
    guardarNegocio(negocio);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Con la hoja abierta la barra también le deja lugar, no sólo la grilla: a 768 px la
          hoja tapaba LifeStyle, Consultoría y el selector de Categoría. Lo encontró la
          captura que pidió la revisión cruzada de #961, no un test (jsdom no hace layout). */}
      <div
        className={cn(
          'shrink-0 space-y-2.5 border-b border-border bg-card px-4 py-3',
          detalle && 'md:pr-[25rem]',
        )}
      >
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <SelectorDeNegocio opciones={negocios} elegido={recorte.negocio} onElegir={elegirNegocio} />
          <label className="relative block w-full lg:ml-auto lg:w-72">
            <span className="sr-only">Buscar producto</span>
            <Search
              size={14}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            {/* 16 px en el teléfono: con menos, iOS hace zoom a la página al enfocar. */}
            <input
              type="search"
              value={recorte.q}
              onChange={(e) => setRecorte((r) => conBusqueda(productos, r, e.target.value))}
              placeholder="Buscar por nombre o SKU…"
              className="h-10 w-full rounded-lg border border-border bg-muted pl-8 pr-3 text-base outline-none transition-colors focus:border-primary focus:bg-card min-[480px]:text-[13px]"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(conDivisiones || conCategorias) && (
            <div
              className={cn(
                'grid w-full gap-2 min-[480px]:flex min-[480px]:w-auto min-[480px]:flex-wrap',
                conDivisiones && conCategorias ? 'grid-cols-2' : 'grid-cols-1',
              )}
            >
              {conDivisiones && (
                <Selector
                  etiqueta="División"
                  value={recorte.division}
                  opciones={divisiones}
                  onChange={(v) => setRecorte((r) => conDivision(productos, r, v))}
                />
              )}
              {conCategorias && (
                <Selector
                  etiqueta="Categoría"
                  value={recorte.categoria}
                  opciones={categorias}
                  onChange={(v) => setRecorte((r) => ({ ...r, categoria: v }))}
                />
              )}
            </div>
          )}
          {bajas > 0 && (
            <label className="inline-flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg pr-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
              <input
                type="checkbox"
                checked={recorte.conBajas}
                onChange={(e) => setRecorte((r) => conBajas(productos, r, e.target.checked))}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="relative h-4 w-7 rounded-full bg-border transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-3 after:rounded-full after:bg-card after:shadow-sm after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-3 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40"
              />
              Dados de baja <span className="tabular-nums">({bajas})</span>
            </label>
          )}
          <p aria-live="polite" className="ml-auto text-[11px] tabular-nums text-muted-foreground">
            {visibles.length} producto{visibles.length === 1 ? '' : 's'}
            {actualizando && ' · actualizando…'}
          </p>
        </div>
      </div>

      <div className={cn('@container min-h-0 flex-1 overflow-y-auto', detalle && 'md:pr-[24rem]')}>
        {visibles.length === 0 ? (
          <Vacio recorte={recorte} negocios={negocios} onIrA={elegirNegocio} />
        ) : (
          <ul className="grid grid-cols-1 gap-2 p-3 @min-[30rem]:grid-cols-2 @min-[30rem]:gap-3 @min-[30rem]:p-4 @min-[46rem]:grid-cols-3 @min-[62rem]:grid-cols-4 @min-[88rem]:grid-cols-5">
            {visibles.map((p) => (
              <li key={p.familia}>
                <TarjetaProducto
                  producto={p}
                  recorte={recorte}
                  abierta={p.familia === abierto}
                  onAbrir={() => setAbierto(p.familia)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {detalle && <HojaDelProducto key={detalle.familia} producto={detalle} onCerrar={() => setAbierto(null)} />}
    </div>
  );
}

/**
 * EL FILTRO PRINCIPAL. Botones y no un `<select>`: son pocos (tres desde el 12-sep-2026;
 * Consultoria la recorta el server), y el pedido es que este filtro se VEA como el
 * principal. En el teléfono van en 2×2 —todos a la vista, sin scroll horizontal que
 * esconda al último—; desde 480 px, en fila.
 */
function SelectorDeNegocio({
  opciones,
  elegido,
  onElegir,
}: {
  opciones: readonly Opcion[];
  elegido: string;
  onElegir: (negocio: string) => void;
}) {
  return (
    <div role="group" aria-label="Negocio" className="grid grid-cols-2 gap-1.5 min-[480px]:flex min-[480px]:flex-wrap">
      {opciones.map((o) => {
        const activo = o.valor === elegido;
        const Icono = ICONO_NEGOCIO[o.valor] ?? Store;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => onElegir(o.valor)}
            className={cn(
              'inline-flex h-10 min-w-0 items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition-[background-color,border-color,transform] duration-200 active:translate-y-px',
              activo
                ? 'border-navy bg-navy text-white'
                : 'border-border bg-card text-foreground hover:border-navy-muted hover:bg-secondary',
            )}
          >
            <Icono size={15} aria-hidden className={activo ? 'text-white/80' : 'text-muted-foreground'} />
            <span className="truncate">{o.valor}</span>
            <span
              className={cn(
                'ml-auto rounded-md px-1.5 py-px text-[11px] font-bold tabular-nums min-[480px]:ml-0',
                activo ? 'bg-white/15 text-white' : 'bg-muted text-muted-foreground',
              )}
            >
              {o.cuantos}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Un selector dependiente. El rótulo corto («División», no «Todas las divisiones») lo
 * pidió la captura a 390 px: con los 16 px que evitan el zoom de iOS, el largo se
 * cortaba en «Todas las divisi…».
 */
function Selector({
  etiqueta,
  value,
  opciones,
  onChange,
}: {
  etiqueta: string;
  value: string;
  opciones: readonly Opcion[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative block min-w-0 min-[480px]:w-48">
      <span className="sr-only">{etiqueta}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none truncate rounded-lg border border-border bg-muted pl-3 pr-8 text-base font-medium text-foreground outline-none transition-colors focus:border-primary min-[480px]:text-xs"
      >
        <option value="">{etiqueta}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.valor} ({o.cuantos})
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </label>
  );
}

function TarjetaProducto({
  producto,
  recorte,
  abierta,
  onAbrir,
}: {
  producto: Producto;
  recorte: Recorte;
  abierta: boolean;
  onAbrir: () => void;
}) {
  const lineaDePrecio = textoDePrecio(producto);
  return (
    <article
      className={cn(
        'relative flex h-full overflow-hidden rounded-xl border bg-card transition-[box-shadow,border-color] duration-200 @min-[30rem]:flex-col',
        abierta
          ? 'border-primary shadow-[0_0_0_1px_var(--primary)]'
          : 'border-border hover:border-navy-muted hover:shadow-[0_12px_28px_-20px_rgba(14,42,82,0.55)]',
      )}
    >
      {/* La tarjeta entera abre la hoja; el botón de copiar vive encima y no la abre. */}
      <button
        type="button"
        onClick={onAbrir}
        aria-label={`Ver el detalle de ${producto.nombre}`}
        className="absolute inset-0 z-0 cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      <Portada
        producto={producto}
        apagada={producto.aLaVenta.length === 0}
        className="pointer-events-none w-[5.5rem] shrink-0 self-stretch @min-[30rem]:aspect-[40/21] @min-[30rem]:w-full @min-[30rem]:self-auto"
      />
      <div className="pointer-events-none flex min-w-0 flex-1 flex-col gap-1 p-3">
        <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
          <p className="min-w-0 truncate font-medium">
            <span className="@min-[30rem]:hidden">
              {producto.categoria}
              {!recorte.division && producto.division ? ' · ' : ''}
            </span>
            {!recorte.division && producto.division}
          </p>
          <span className="shrink-0 font-mono text-[10px]">{producto.vigente.sku}</span>
        </div>
        <h3 className="line-clamp-2 font-heading text-[13px] font-semibold leading-snug text-navy-ink">
          {producto.nombre}
        </h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <PrecioCompacto precio={precioDe(producto.vigente)} />
          {lineaDePrecio !== null && (
            <span className="pointer-events-auto relative z-10">
              <BotonCopiar texto={lineaDePrecio} rotulo="Copiar" descripcion={`Copiar el precio de ${producto.nombre}`} />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function PrecioCompacto({ precio }: { precio: Precio }) {
  if (precio.sinPrecio) {
    return <span className="text-[11px] font-medium text-muted-foreground">Sin precio en Cerberus</span>;
  }
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 leading-tight">
      <span className="font-mono text-[15px] font-bold tabular-nums text-foreground">
        {monto(precio.vigente, precio.moneda)}
      </span>
      {precio.regular !== null && (
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground line-through">
          <span className="sr-only">precio regular </span>
          {monto(precio.regular, precio.moneda)}
        </span>
      )}
    </p>
  );
}

function Vacio({
  recorte,
  negocios,
  onIrA,
}: {
  recorte: Recorte;
  negocios: readonly Opcion[];
  onIrA: (negocio: string) => void;
}) {
  const enOtros = negocios.filter((o) => o.valor !== recorte.negocio && o.cuantos > 0);
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <p className="text-sm font-semibold text-foreground">
          {recorte.q ? `Nada con «${recorte.q}» en ${recorte.negocio}` : 'No hay productos con este recorte'}
        </p>
        {recorte.q && enOtros.length > 0 ? (
          <>
            <p className="mt-1 text-xs text-muted-foreground">Sí hay en otro negocio:</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {enOtros.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  onClick={() => onIrA(o.valor)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-secondary"
                >
                  Ver en {o.valor}
                  <span className="rounded bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{o.cuantos}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Prueba con otra palabra, con el SKU o saca algún recorte.</p>
        )}
      </div>
    </div>
  );
}

/** El esqueleto tiene la forma de lo que viene —negocios, un selector, la grilla—, no cuatro barras genéricas. */
function Esqueleto() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden bg-background" aria-busy="true" aria-label="Cargando el catálogo">
      <div className="space-y-2.5 border-b border-border bg-card px-4 py-3">
        <div className="grid grid-cols-2 gap-1.5 min-[480px]:flex">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-muted min-[480px]:w-32" />
          ))}
        </div>
        <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="@container">
        <ul className="grid grid-cols-1 gap-2 p-3 @min-[30rem]:grid-cols-2 @min-[30rem]:gap-3 @min-[30rem]:p-4 @min-[46rem]:grid-cols-3 @min-[62rem]:grid-cols-4 @min-[88rem]:grid-cols-5">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="h-24 animate-pulse rounded-xl bg-muted @min-[30rem]:h-64" />
          ))}
        </ul>
      </div>
    </div>
  );
}
