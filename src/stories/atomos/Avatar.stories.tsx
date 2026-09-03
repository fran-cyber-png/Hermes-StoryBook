import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '../../components/Avatar';

/**
 * El avatar de un contacto: su foto de WhatsApp si la hay (con `conFoto`), las
 * iniciales si no. Ver el docblock de `src/components/Avatar.tsx` — reemplazó
 * cuatro copias de la misma función de iniciales.
 */
const meta = {
  title: 'Átomos/Avatar',
  component: Avatar,
  parameters: { layout: 'centered' },
  argTypes: {
    className: { control: 'text' },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

const clasePorDefecto =
  'size-10 rounded-full bg-primary/10 text-sm font-bold text-primary';

export const Iniciales: Story = {
  args: {
    nombre: 'Andrea Quispe',
    className: clasePorDefecto,
  },
};

export const SinNombre: Story = {
  name: 'Sin nombre (contacto anónimo)',
  args: {
    nombre: null,
    className: clasePorDefecto,
  },
};

export const Chico: Story = {
  args: {
    nombre: 'Job Meneses',
    className: 'size-6 rounded-full bg-primary/10 text-[10px] font-bold text-primary',
  },
};

export const Grande: Story = {
  args: {
    nombre: 'William Ayala Diestra',
    className: 'size-14 rounded-full bg-primary/10 text-lg font-bold text-primary',
  },
};

export const TintaNavy: Story = {
  name: 'Tinta navy (usada en el panel de contacto)',
  args: {
    nombre: 'Andrea Quispe',
    className: 'size-11 rounded-full bg-navy-muted text-sm font-bold text-navy-ink',
  },
};
