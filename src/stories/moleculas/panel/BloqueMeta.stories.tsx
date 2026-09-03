import type { Meta, StoryObj } from '@storybook/react-vite';
import { BloqueMeta } from '../../../features/panel/BloqueMeta';

/** Los pares label+valor del panel de contacto (Nombre, Correo, País…). */
const meta = {
  title: 'Moléculas/panel/BloqueMeta',
  component: BloqueMeta,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof BloqueMeta>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Campos: Story = {
  args: {
    campos: [
      { label: 'Nombre', valor: 'Karen Tarazona Quispe', onClick: () => {} },
      { label: 'Correo', valor: 'k.tarazona.q@gmail.com', onClick: () => {} },
      { label: 'País', valor: '' },
    ],
  },
};
