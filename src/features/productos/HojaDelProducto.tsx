import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEscape } from '../../lib/teclado/useEscape';
import { useLocalStorage } from '../../lib/useLocalStorage';
import { useCatalogoHechos, type HechoDelCatalogo } from '../hechos/catalogo';
import { BotonCopiar } from './BotonCopiar';
import { Portada } from './Portada';
import { datosPorPais } from './porPais';
import { familiaYEdicion, monto, precioDe, textoDePrecio, type Producto } from './productos';

/** El último país elegido en la hoja — por navegador: la vendedora de México abre México. */
const CLAVE_PAIS = 'hermes.productos.pais';

/**
 * LA HOJA DE UN PRODUCTO — lo que se abre al tocar una tarjeta (ADR 0106).
 *
 * Tiene la ÚNICA acción primaria de la vista, «Copiar precio para el chat», y debajo
 * lo que la tarjeta no puede cargar: el precio y el pago por país, las ediciones que
 * Cerberus sigue marcando Disponible y las dadas de baja.
 *
 * Se superpone a la grilla (el molde de `HojaDeLaPieza`, sin scrim) para poder tocar
 * otra tarjeta y que la hoja cambie sin cerrarse; la grilla le deja su lugar con
 * padding y pasa sola a una columna menos. En el teléfono ocupa la pantalla entera.
 * Escape la cierra: `useEscape` registra en captura y corta la propagación, así el
 * shell no se entera (ADR 0024).
 */
export function HojaDelProducto({ producto, onCerrar }: { producto: Producto; onCerrar: () => void }) {
  useEscape(onCerrar);
  const [todas, setTodas] = useState(false);
  const precio = precioDe(producto.vigente);
  const lineaDePrecio = textoDePrecio(producto);
  const nALaVenta = producto.aLaVenta.length;
  const ediciones = todas ? producto.aLaVenta : producto.aLaVenta.slice(0, 4);

  return (
    <aside
      role="dialog"
      aria-labelledby="hoja-producto-titulo"
      className="fixed inset-0 z-30 flex flex-col bg-background md:absolute md:inset-y-0 md:left-auto md:right-0 md:w-[24rem] md:border-l md:border-border md:shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.18)]"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2">
        <p className="truncate text-[11px] font-semibold text-muted-foreground">
          {[producto.negocio, producto.division].filter(Boolean).join(' · ')}
        </p>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el detalle"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Portada producto={producto} variante="hoja" apagada={nALaVenta === 0} className="aspect-[40/21] w-full" />
        <div className="space-y-5 p-4">
          <header>
            <h2 id="hoja-producto-titulo" className="text-balance font-heading text-lg font-bold leading-snug text-navy-ink">
              {producto.nombre}
            </h2>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {producto.vigente.sku}
              {producto.edicionVigente !== null && ` · edición ${producto.edicionVigente}`}
            </p>
          </header>

          <section aria-label="Precio" className="space-y-3">
            {lineaDePrecio === null ? (
              <p className="rounded-xl bg-muted px-3 py-2.5 text-center text-xs text-muted-foreground">
                Cerberus no tiene precio cargado para este producto: no hay nada que copiar.
              </p>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-mono text-[1.75rem] font-bold leading-none tabular-nums text-foreground">
                    {monto(precio.vigente, precio.moneda)}
                  </p>
                  {precio.regular !== null && (
                    <p className="text-right text-[11px] text-muted-foreground">
                      Regular{' '}
                      <span className="font-mono tabular-nums line-through">{monto(precio.regular, precio.moneda)}</span>
                    </p>
                  )}
                </div>
                <BotonCopiar texto={lineaDePrecio} rotulo="Copiar precio para el chat" principal />
              </>
            )}
          </section>

          <SeccionPorPais familia={producto.familia} />

          {nALaVenta > 1 && (
            <section aria-labelledby="hoja-ediciones-titulo">
              <h3 id="hoja-ediciones-titulo" className="text-xs font-semibold text-foreground">
                {nALaVenta} ediciones marcadas «Disponible»
              </h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Cerberus las sigue teniendo a la venta. La vigente es la de número más alto.
              </p>
              <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {ediciones.map((e, i) => {
                  const pe = precioDe(e);
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="font-medium text-foreground">Edición {familiaYEdicion(e.sku).edicion ?? '—'}</span>
                        <span className="truncate font-mono text-[10px] text-muted-foreground">{e.sku}</span>
                        {i === 0 && (
                          <span className="rounded bg-secondary px-1.5 py-px text-[10px] font-bold text-secondary-foreground">
                            vigente
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                        {pe.sinPrecio ? 'sin precio' : monto(pe.vigente, pe.moneda)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {nALaVenta > 4 && (
                <button
                  type="button"
                  onClick={() => setTodas((v) => !v)}
                  className="mt-2 text-[11px] font-semibold text-primary hover:underline"
                >
                  {todas ? 'Ver menos' : `Ver las ${nALaVenta}`}
                </button>
              )}
            </section>
          )}

          {producto.deBaja.length > 0 && (
            <details className="group rounded-xl border border-border bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-foreground">
                Dadas de baja ({producto.deBaja.length})
                <ChevronDown size={14} aria-hidden className="text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <ul className="divide-y divide-border border-t border-border">
                {producto.deBaja.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate font-mono">{e.sku}</span>
                    <span className="shrink-0 font-mono tabular-nums">{monto(precioDe(e).vigente)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
            Precios, ediciones y estado se editan en Cerberus; los datos por país, en Datos. Hermes sólo los lee.
          </p>
        </div>
      </div>
    </aside>
  );
}

/**
 * EL PRECIO Y EL PAGO POR PAÍS — de los Datos (tabla `hechos`), no de Cerberus, que no
 * guarda precio por país (`tb_moneda` sólo tiene tasas). A qué producto le toca cada
 * dato lo decide `datosPorPais`, por la familia del SKU.
 *
 * ⚠️ **Tres estados, no dos**: cargando no dibuja nada (es información secundaria y
 * un esqueleto acá empujaría la hoja); sin datos para este producto tampoco (regla del
 * cero); y si la consulta FALLÓ se dice, porque «no hay» y «no se pudo preguntar» son
 * opuestos y confundirlos manda a buscar el problema al lugar equivocado.
 */
function SeccionPorPais({ familia }: { familia: string }) {
  const { data, isError } = useCatalogoHechos();
  const [paisGuardado, guardarPais] = useLocalStorage<string | null>(CLAVE_PAIS, null);

  if (isError && !data) {
    return <p className="text-[11px] text-muted-foreground">No se pudieron leer los datos por país.</p>;
  }
  const datos = data ? datosPorPais(data.hechos, familia) : [];
  if (datos.length === 0) return null;

  const elegido = datos.find((d) => d.pais === paisGuardado) ?? datos[0];

  return (
    <section aria-labelledby="hoja-pais-titulo">
      <h3 id="hoja-pais-titulo" className="text-xs font-semibold text-foreground">
        Por país
      </h3>
      <div role="group" aria-label="País" className="mt-2 flex flex-wrap gap-1.5">
        {datos.map((d) => {
          const activo = d.pais === elegido.pais;
          return (
            <button
              key={d.pais}
              type="button"
              aria-pressed={activo}
              onClick={() => guardarPais(d.pais)}
              className={cn(
                'h-8 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors',
                activo
                  ? 'border-navy bg-navy text-white'
                  : 'border-border bg-card text-foreground hover:border-navy-muted hover:bg-secondary',
              )}
            >
              {d.nombre}
            </button>
          );
        })}
      </div>
      <div className="mt-3 space-y-2">
        {elegido.precio && <DatoCopiable titulo="Precio" hecho={elegido.precio} />}
        {elegido.pago && (
          <DatoCopiable titulo={elegido.pais === 'link-tarjeta' ? 'Pago con tarjeta' : 'Dónde pagar'} hecho={elegido.pago} />
        )}
      </div>
    </section>
  );
}

function DatoCopiable({ titulo, hecho }: { titulo: string; hecho: HechoDelCatalogo }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-muted-foreground">{titulo}</p>
        <BotonCopiar texto={hecho.texto} rotulo="Copiar" descripcion={`Copiar: ${hecho.rotulo}`} />
      </div>
      <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-foreground">{hecho.texto}</p>
    </div>
  );
}
