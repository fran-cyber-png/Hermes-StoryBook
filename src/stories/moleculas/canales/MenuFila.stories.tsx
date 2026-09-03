import type { Meta, StoryObj } from '@storybook/react-vite';
import { MenuFila } from '../../../features/canales/MenuFila';

/** El menú de acciones (⋮) de cada fila de la cola: fijar, favorita, marcar leído. */
const meta = {
  title: 'Moléculas/canales/MenuFila',
  component: MenuFila,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof MenuFila>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinMarcar: Story = {
  args: { clave: 'conv:1', estado: {}, onFijar: () => {}, onFavorita: () => {}, onLeido: () => {} },
};

export const Favorita: Story = {
  args: { clave: 'conv:1', estado: { favorita: true }, onFijar: () => {}, onFavorita: () => {}, onLeido: () => {} },
};
