import { Minus, Plus, Trash2 } from 'lucide-react';
import { precioDe, type ProductoCurso } from './useVenta';

/**
 * UNA LÍNEA DEL CARRITO — el mismo componente para `CarritoDeseado` (el
 * panel, antes de registrar) y `FormularioVenta` (el modal, al registrar).
 *
 * Nació de un pedido concreto (20-ago-2026): las dos cartas armaban esta fila
 * a mano y las dos quedaban apretadas de la misma forma — nombre, stepper,
 * un precio sin decir de qué era y el subtotal pegado al tacho de basura,
 * todo en una sola línea. La referencia que se pidió imitar es la propia
 * tabla de Cerberus (`Detalle de Productos`): **Precio Regular** (el del
 * catálogo, fijo — no se edita) al lado de **Precio Venta** (lo pactado,
 * editable), cada uno con su rótulo, y el Subtotal en su propia fila. Con dos
 * cartas independientes esto se iba a desalinear nueve la primera vez que
 * alguien tocara una sin acordarse de la otra — por eso ahora es un
 * componente y no una receta copiada dos veces (#37).
 */
export function LineaProducto({
  producto,
  cantidad,
  precio,
  moneda,
  onCantidad,
  onPrecio,
  onQuitar,
}: {
  producto: ProductoCurso;
  cantidad: number;
  /** El precio VENTA — lo pactado, como texto porque se está tipeando. */
  precio: string;
  /**
   * La moneda a mostrar. Nunca sale de `producto.moneda` acá adentro: quien
   * llama decide (la del carrito o la del formulario) — ver el porqué en cada
   * uno de los dos llamadores.
   */
  moneda: string;
  onCantidad: (delta: number) => void;
  onPrecio: (precio: string) => void;
  onQuitar: () => void;
}) {
  const subtotal = precioDe(precio) * cantidad;

  return (
    <li className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 text-[11px] font-semibold leading-snug text-foreground">
          {producto.nombre}
        </span>
        <button
          type="button"
          aria-label={`Quitar ${producto.nombre}`}
          onClick={onQuitar}
          className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* El stepper es UN control, no tres piezas sueltas: un borde
          compartido con divisores internos, e íconos en vez de "−"/"+" de
          texto (la línea base de esos dos glifos no coincide en todas las
          fuentes, y quedaban desalineados). */}
      <div className="mt-2 flex h-6 w-fit items-stretch overflow-hidden rounded-md border border-border bg-card">
        <button
          type="button"
          aria-label="Una menos"
          onClick={() => onCantidad(-1)}
          className="grid w-6 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
        >
          <Minus size={11} aria-hidden />
        </button>
        <span className="grid min-w-[1.625rem] place-items-center border-x border-border text-[11px] font-semibold tabular-nums text-foreground">
          {cantidad}
        </span>
        <button
          type="button"
          aria-label="Una más"
          onClick={() => onCantidad(1)}
          className="grid w-6 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
        >
          <Plus size={11} aria-hidden />
        </button>
      </div>

      {/* Precio Regular / Precio Venta, con rótulo — el molde de Cerberus.
          El regular NO se toca acá: es el dato del catálogo, y mostrarlo
          editable prometería un cambio que no hace nada (Cerberus no lo
          acepta en la venta). */}
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div>
          <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Precio regular
          </span>
          <div className="mt-0.5 flex h-6 items-center gap-1 rounded-md border border-border bg-muted/70 px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {moneda && <span className="shrink-0 uppercase">{moneda}</span>}
            <span className="truncate">{producto.precioNormal.toFixed(2)}</span>
          </div>
        </div>
        <div>
          <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Precio venta
          </span>
          <div className="mt-0.5 flex h-6 items-stretch overflow-hidden rounded-md border border-border bg-card focus-within:border-primary">
            {moneda && (
              <span className="grid shrink-0 place-items-center border-r border-border bg-muted px-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                {moneda}
              </span>
            )}
            <input
              type="text"
              inputMode="decimal"
              value={precio}
              onChange={(e) => onPrecio(e.target.value)}
              placeholder={producto.precioPromocion.toFixed(2)}
              aria-label={`Precio de venta de ${producto.nombre}`}
              className="w-full min-w-0 px-1.5 text-right text-[11px] font-semibold tabular-nums text-navy-ink outline-none"
            />
          </div>
        </div>
      </div>

      {/* El subtotal SIEMPRE se dice, en su propia fila con rótulo — como en
          Cerberus, aunque repita el precio venta cuando la cantidad es 1: es
          mejor una fila que dice lo mismo dos veces y clara, que un número
          más metido al final de la fila del stepper. */}
      {subtotal > 0 && (
        <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-1.5 text-[11px]">
          <span className="font-medium text-muted-foreground">Subtotal</span>
          <span className="font-bold tabular-nums text-navy-ink">
            {moneda ? `${moneda} ` : ''}
            {subtotal.toFixed(2)}
          </span>
        </div>
      )}
    </li>
  );
}
