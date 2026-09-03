import type { Meta, StoryObj } from '@storybook/react-vite';
import { BarraDePestanas } from '../../../features/notas/BarraDePestanas';
import type { RefPestana } from '../../../features/notas/pestanas';

const ABIERTAS: RefPestana[] = [
  { id: 1, espacioId: null, tipo: 'texto' },
  { id: 2, espacioId: null, tipo: 'diagrama' },
  { id: 3, espacioId: 4, tipo: 'archivo' },
];

/** La fila de pestañas de la Libreta — arriba de todo, como la de un navegador. Sin backend, cada título queda «…». */
const meta = {
  title: 'Moléculas/notas/BarraDePestanas',
  component: BarraDePestanas,
  parameters: { layout: 'padded' },
  args: { abiertas: ABIERTAS, activaId: 1, onActivar: () => {}, onCerrar: () => {} },
} satisfies Meta<typeof BarraDePestanas>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TresPestanas: Story = {};

export const SinNinguna: Story = { args: { abiertas: [] } };

export const SinPaginaActiva: Story = {
  name: 'Viendo la lista (sin activa)',
  args: { activaId: null },
};
