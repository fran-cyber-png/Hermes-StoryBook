import type { Meta, StoryObj } from '@storybook/react-vite';
import { AvisoFilaQueBajo } from '../../../features/canales/AvisoFilaQueBajo';

/**
 * El aviso sticky cuando la fila que estabas mirando bajó de posición en la
 * cola. `estado_conversacion.fijada` tenía CERO filas medido el 11-ago-2026 —
 * esta barra es lo que le dio uso al pin que ya existía.
 */
const meta = {
  title: 'Moléculas/canales/AvisoFilaQueBajo',
  component: AvisoFilaQueBajo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AvisoFilaQueBajo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConFijar: Story = {
  args: { aviso: { clave: 'conv:1', texto: 'Bajó porque alguien más entró antes.' }, onFijar: () => {} },
};

export const SinFijar: Story = {
  name: 'Sin la acción de fijar (nada abierto a mano)',
  args: { aviso: { clave: 'conv:1', texto: 'Bajó porque alguien más entró antes.' } },
};
