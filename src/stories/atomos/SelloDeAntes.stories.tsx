import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelloDeAntes } from '../../components/SelloDeAntes';

/** «Esto es de antes» — aparece cuando la pantalla se pinta desde el caché persistido (ADR 0007). */
const meta = {
  title: 'Átomos/SelloDeAntes',
  component: SelloDeAntes,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SelloDeAntes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Quieto: Story = { args: { texto: 'Datos de hace 4 min', actualizando: false } };
export const Actualizando: Story = { args: { texto: 'Datos de hace 4 min', actualizando: true } };
