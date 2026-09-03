import type { Meta, StoryObj } from '@storybook/react-vite';
import { Columnas } from '../../../components/graficos/Columnas';

/** Las columnas de «Los últimos 14 días» — con la fila-tooltip al pasar el mouse. */
const meta = {
  title: 'Átomos/Gráficos/Columnas',
  component: Columnas,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Columnas>;

export default meta;
type Story = StoryObj<typeof meta>;

const puntos = Array.from({ length: 14 }, (_, i) => ({
  dia: `2026-08-${(23 + i).toString().padStart(2, '0')}`,
  total: [5, 8, 12, 9, 14, 11, 6, 10, 13, 9, 15, 12, 8, 12][i],
  detalle: '9 chats · 3 comentarios · 2 formularios',
}));

export const CatorceDias: Story = {
  args: { puntos, resumen: 'Esta semana cayeron 89; la pasada, 61.', unidad: 'leads' },
};
