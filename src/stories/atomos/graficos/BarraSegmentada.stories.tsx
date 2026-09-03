import type { Meta, StoryObj } from '@storybook/react-vite';
import { BarraSegmentada } from '../../../components/graficos/BarraSegmentada';

/** La barra del embudo — un segmento por etapa, ancho proporcional a `n`. */
const meta = {
  title: 'Átomos/Gráficos/BarraSegmentada',
  component: BarraSegmentada,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof BarraSegmentada>;

export default meta;
type Story = StoryObj<typeof meta>;

const segmentos = [
  { id: 'nunca', n: 11, color: 'bg-muted-foreground/30', label: 'Nunca contestaron' },
  { id: 'te-esperan', n: 4, color: 'bg-primary', label: 'Te esperan' },
  { id: 'contestaron', n: 22, color: 'bg-temp-tibio', label: 'Contestaron' },
  { id: 'saben-precio', n: 9, color: 'bg-temp-frio', label: 'Saben el precio' },
  { id: 'compraron', n: 1, color: 'bg-success', label: 'Compraron' },
];

export const Embudo: Story = {
  args: { segmentos, className: 'w-80' },
};

export const ConActivo: Story = {
  name: 'Con un segmento activo',
  args: { segmentos, activo: 'te-esperan', onSegmento: () => {}, className: 'w-80' },
};
