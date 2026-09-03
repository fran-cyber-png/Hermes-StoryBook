import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectorFechaHora } from '../../../features/agenda/SelectorFechaHora';

const meta = {
  title: 'Moléculas/agenda/SelectorFechaHora',
  component: SelectorFechaHora,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SelectorFechaHora>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinElegir: Story = {
  args: { valor: null, onSeleccionar: () => {}, hoy: new Date(2026, 8, 3) },
};

export const ConFecha: Story = {
  args: { valor: new Date(2026, 8, 10, 15, 30), onSeleccionar: () => {}, hoy: new Date(2026, 8, 3) },
};
