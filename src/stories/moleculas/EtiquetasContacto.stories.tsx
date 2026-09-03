import type { Meta, StoryObj } from '@storybook/react-vite';
import { EtiquetasContacto } from '../../features/contactos/EtiquetasContacto';

/** La tarjeta de etiquetas del panel de contacto. Sin backend, muestra el estado vacío — un estado real, no un roto. */
const meta = {
  title: 'Moléculas/EtiquetasContacto',
  component: EtiquetasContacto,
  parameters: { layout: 'padded' },
  args: { clave: 'contacto-1' },
} satisfies Meta<typeof EtiquetasContacto>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinBackend: Story = {};
