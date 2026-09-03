import type { Meta, StoryObj } from '@storybook/react-vite';
import { Marca, Escudo } from '../../components/Marca';

/** La marca — [escudo dorado] │ HERMES. El escudo es la única pieza dorada permanente. */
const meta = {
  title: 'Átomos/Marca',
  component: Marca,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Marca>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Lockup: Story = { args: {} };
export const SoloEscudo: StoryObj<typeof Escudo> = { render: () => <Escudo size={40} /> };
