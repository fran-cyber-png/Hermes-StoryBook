import { useEffect, useState } from 'react';
import { Plus, Search, ShoppingCart } from 'lucide-react';
import {
  totalCarrito,
  useFormularioVenta,
  useProductos,
  type ProductoCurso,
  type ProductoElegido,
} from '../venta/useVenta';
import { LineaProducto } from '../venta/LineaProducto';
import { cn } from '../../lib/utils';
import { encabezadoSeccion } from './estiloSeccion';

/**
 * EL CARRITO DE LA FICHA — qué quiere llevarse el cliente, ANTES de registrar
 * la venta. Vive en el panel de la conversación, no en el formulario de venta:
 * la vendedora lo arma mientras charla, y al tocar «Registrar venta» esos
 * mismos productos —con el precio que ya haya anotado acá— ya están puestos
 * en el carrito de `FormularioVenta` — no hay que volver a buscarlos ni a
 * retipear el número.
 *
 * ⚠️ **El precio SÍ viaja acá** (decisión del 20-ago-2026, revierte la del
 * 19-ago): sin él, lo que la vendedora negociaba mientras charlaba se perdía
 * al abrir el formulario, que arrancaba siempre en el de promoción del
 * catálogo. Sigue siendo editable en los dos lugares — esto es lo que
 * ARRANCA anotado, no lo que queda cerrado: el precio final se sigue
 * negociando recién al registrar.
 *
 * ⚠️ **LA MONEDA SE ELIGE ACÁ, NO SE ADIVINA** (20-ago-2026): el catálogo de
 * Cerberus casi nunca trae la suya (`ProductoCurso.moneda` viene `''` para
 * casi todo — ver `useVenta.ts`), y mostrar un monto sin moneda es la forma
 * más barata de que alguien lo lea como dólares sin serlo. El selector es UNO
 * para todo el carrito —no por producto: una venta es en una sola moneda—.
 * Prioridad para arrancarlo, de más a menos informado: la última que se usó
 * (`localStorage`, la misma llave que `FormularioVenta` ya escribe al
 * registrar) · si nunca hubo una, **USD** (pedido del dueño, 20-ago-2026) ·
 * si ni siquiera esa existe en el catálogo del día, queda sin elegir. Sigue
 * siendo editable siempre — un default no es un candado.
 *
 * 🔴 **`monedaId` VIVE EN `PanelDerecho`, NO ACÁ ADENTRO** (20-ago-2026): con
 * un `useState` local, elegir PEN en el carrito y tocar «Registrar venta»
 * abría `FormularioVenta` preguntando «Elige moneda» de cero — dos selects
 * que se veían iguales y eran DOS ELECCIONES. Es el mismo motivo por el que
 * `carrito` ya vivía arriba: `VentaDesdeElPanel`/`FormularioVenta` necesitan
 * esto como semilla al abrir, y solo `PanelDerecho` los ve a los dos.
 * **Y es de ida y vuelta**: si la vendedora la corrige adentro del
 * formulario, este selector se actualiza solo (`onMonedaCambiar` en
 * `PanelDerecho`) — a propósito distinto de cómo se tratan cantidad y
 * precio, que sí son de una sola vía.
 *
 * Solo de la SESIÓN (decisión explícita, 19-ago-2026): vive en `useState` de
 * `PanelDerecho`, igual que el carrito de `FormularioVenta` hoy — se pierde si
 * se cierra la conversación o se recarga la app. Persistirlo de verdad es
 * otro frente si hace falta.
 */
export function CarritoDeseado({
  productos,
  onCambiar,
  monedaId,
  onMonedaCambiar,
}: {
  productos: ProductoElegido[];
  onCambiar: (productos: ProductoElegido[]) => void;
  /** `''` = todavía sin elegir (recién abierta esta conversación). */
  monedaId: string;
  onMonedaCambiar: (monedaId: string) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const { data: prods } = useProductos(busqueda, busqueda.length >= 2);

  const { data: form } = useFormularioVenta(true);
  // Sin moneda todavía: la última usada (si sigue existiendo en el catálogo
  // de hoy) o, si nunca hubo una, USD. Recién puede resolverse cuando el
  // catálogo cargó, así que no puede ir en el `useState` de arriba — y por
  // eso vive acá, no en `PanelDerecho`: es la ÚNICA pieza que necesita
  // `form.monedas` para decidir.
  /**
   * ⚠️ **`?.` DESPUÉS DE `monedas`, TAMBIÉN — y es la misma cicatriz que ya está
   * escrita en `PanelDerecho` para `senales`.**
   *
   * `!form` sólo protege que la RESPUESTA sea undefined; si el cuerpo llega sin
   * la clave `monedas` —un cuerpo de error, una forma que cambió, un server
   * viejo— entonces `undefined.find` **tumba el panel entero**, y no hay
   * ErrorBoundary en `src/`: se lleva puesta la app con la conversación abierta.
   *
   * Lo destapó el test de `QuienEs`, que monta el panel con un cliente de
   * Cerberus —la única condición que hace aparecer este carrito— contra un stub
   * que no conocía esta ruta. En producción el modo de fallar es el mismo.
   */
  useEffect(() => {
    if (monedaId || !form?.monedas) return;
    const ultima = localStorage.getItem('hermes.ultimaMoneda');
    const preferida =
      form.monedas.find((m) => m.id === ultima) ??
      form.monedas.find((m) => m.nombre.trim().toUpperCase() === 'USD');
    if (preferida) onMonedaCambiar(preferida.id);
  }, [form, monedaId, onMonedaCambiar]);
  const monedaNombre = form?.monedas?.find((m) => m.id === monedaId)?.nombre ?? '';

  function agregar(p: ProductoCurso) {
    if (!productos.some((l) => l.producto.id === p.id)) {
      // Arranca en el de promoción del catálogo — el mismo punto de partida
      // que ya usaba `FormularioVenta`, ahora un paso antes.
      onCambiar([...productos, { producto: p, cantidad: 1, precio: String(p.precioPromocion) }]);
    }
    setBusqueda('');
  }
  function cantidad(id: string, delta: number) {
    onCambiar(productos.map((l) => (l.producto.id === id ? { ...l, cantidad: Math.max(1, l.cantidad + delta) } : l)));
  }
  function ponerPrecio(id: string, precio: string) {
    onCambiar(productos.map((l) => (l.producto.id === id ? { ...l, precio } : l)));
  }
  function quitar(id: string) {
    onCambiar(productos.filter((l) => l.producto.id !== id));
  }

  const totales = totalCarrito(productos, monedaNombre);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className={cn(encabezadoSeccion, 'mb-0')}>
          <ShoppingCart size={14} className="text-muted-foreground" /> Carrito
        </h3>
        {/* Solo aparece con algo adentro: en el carrito vacío no hay ningún
            precio que leer todavía, y preguntarla antes sería una pregunta
            sin uso. */}
        {productos.length > 0 && form && form.monedas.length > 0 && (
          <select
            value={monedaId}
            onChange={(e) => onMonedaCambiar(e.target.value)}
            aria-label="Moneda del carrito"
            className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground outline-none focus:border-primary"
          >
            <option value="">Moneda</option>
            {form.monedas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="relative">
        <Search
          size={12}
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto…"
          className="w-full rounded-lg border border-border bg-muted py-1.5 pl-7 pr-3 text-xs outline-none focus:border-primary"
        />
        {prods && busqueda.length >= 2 && prods.productos.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-panel">
            {prods.productos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => agregar(p)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-muted"
              >
                <Plus size={11} className="shrink-0 text-muted-foreground" />
                <span className="truncate">{p.nombre}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {productos.length === 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Sin productos todavía — busca arriba lo que el cliente quiere llevar. Puedes anotar un
          precio de referencia; se sigue pudiendo ajustar al registrar la venta.
        </p>
      ) : (
        <>
          <ul className="mt-2 flex flex-col gap-1.5">
            {productos.map((l) => (
              <LineaProducto
                key={l.producto.id}
                producto={l.producto}
                cantidad={l.cantidad}
                precio={l.precio ?? ''}
                moneda={monedaNombre}
                onCantidad={(delta) => cantidad(l.producto.id, delta)}
                onPrecio={(precio) => ponerPrecio(l.producto.id, precio)}
                onQuitar={() => quitar(l.producto.id)}
              />
            ))}
          </ul>

          {totales.length > 0 && (
            <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-[11px]">
              <span className="font-semibold text-muted-foreground">Total</span>
              <span className="font-bold tabular-nums text-navy-ink">
                {totales.map((t) => `${t.moneda} ${t.total.toFixed(2)}`.trim()).join(' + ')}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
