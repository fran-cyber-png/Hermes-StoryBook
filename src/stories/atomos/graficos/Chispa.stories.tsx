import type { Meta, StoryObj } from '@storybook/react-vite';
import { Chispa } from '../../../components/graficos/Chispa';

/** El sparkline «TÚ» del Dashboard — una línea sin ejes, 14 puntos. */
const meta = {
  title: 'Átomos/Gráficos/Chispa',
  component: Chispa,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Chispa>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Subiendo: Story = {
  args: { valores: [3, 4, 2, 5, 6, 5, 7, 8, 6, 9, 10, 8, 11, 12], etiqueta: 'Mensajes por día, últimos 14 días: hoy 12' },
};

export const Plana: Story = {
  args: { valores: [4, 4, 4, 4, 4, 4], etiqueta: 'Sin variación' },
};
