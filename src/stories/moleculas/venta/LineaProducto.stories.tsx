import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LineaProducto } from '../../../features/venta/LineaProducto';
import type { ProductoCurso } from '../../../features/venta/useVenta';

/**
 * Una línea del carrito — el mismo componente para `CarritoDeseado` (el panel,
 * antes de registrar) y `FormularioVenta` (el modal, al registrar).
 *
 * El molde imita la tabla de Cerberus a propósito: **Precio Regular** (del
 * catálogo, fijo) al lado de **Precio Venta** (lo pactado, editable), cada uno
 * con su rótulo. Con dos cartas armando esto a mano por separado, se iba a
 * desalinear la primera vez que alguien tocara una sin acordarse de la otra.
 */
const producto: ProductoCurso = {
  id: 'p1',
  sku: 'DIP-INT-2026',
  nombre: 'Diplomado en Inteligencia y Contrainteligencia',
  precioNormal: 1500,
  precioPromocion: 1200,
  moneda: 'S/',
};

/** Con estado real, para poder tipear el precio y mover el stepper en el panel. */
function Envoltorio({
  cantidadInicial = 1,
  precioInicial = '1200',
  moneda = 'S/',
}: {
  cantidadInicial?: number;
  precioInicial?: string;
  moneda?: string;
}) {
  const [cantidad, setCantidad] = useState(cantidadInicial);
  const [precio, setPrecio] = useState(precioInicial);
  return (
    <ul className="max-w-xs list-none">
      <LineaProducto
        producto={producto}
        cantidad={cantidad}
        precio={precio}
        moneda={moneda}
        onCantidad={(d) => setCantidad((c) => Math.max(1, c + d))}
        onPrecio={setPrecio}
        onQuitar={() => {}}
      />
    </ul>
  );
}

const meta = {
  title: 'Moléculas/venta/LineaProducto',
  component: LineaProducto,
  parameters: { layout: 'padded' },
  /** Las historias arman su propio `Envoltorio` (necesitan estado); estos args
   *  cumplen los obligatorios del tipo y alimentan Controls. */
  args: {
    producto,
    cantidad: 1,
    precio: '1200',
    moneda: 'S/',
    onCantidad: () => {},
    onPrecio: () => {},
    onQuitar: () => {},
  },
} satisfies Meta<typeof LineaProducto>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactiva: Story = {
  name: 'Con el stepper y el precio editables',
  render: () => <Envoltorio />,
};

export const SinMoneda: Story = {
  name: 'Sin moneda (Cerberus no la trajo)',
  render: () => <Envoltorio moneda="" />,
};

export const CantidadMultiple: Story = {
  name: 'Varias unidades (el subtotal multiplica)',
  render: () => <Envoltorio cantidadInicial={3} />,
};

export const PrecioVacio: Story = {
  name: 'Precio vacío (sin subtotal — no se dibuja la fila)',
  render: () => <Envoltorio precioInicial="" />,
};
