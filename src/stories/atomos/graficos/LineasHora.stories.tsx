import type { Meta, StoryObj } from '@storybook/react-vite';
import { LineasHora } from '../../../components/graficos/LineasHora';

/** Entran/salen por hora del turno — la franja fuera de horario va sombreada. */
const meta = {
  title: 'Átomos/Gráficos/LineasHora',
  component: LineasHora,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof LineasHora>;

export default meta;
type Story = StoryObj<typeof meta>;

const puntos = Array.from({ length: 24 }, (_, hora) => ({
  hora,
  entran: hora >= 8 && hora <= 20 ? Math.round(3 + 5 * Math.sin(((hora - 8) / 12) * Math.PI)) : Math.round(Math.random() * 1),
  salen: hora >= 8 && hora <= 20 ? Math.round(2 + 4 * Math.sin(((hora - 8) / 12) * Math.PI)) : 0,
}));

export const TurnoDeOficina: Story = {
  args: { puntos, apertura: 8, cierre: 21 },
};
