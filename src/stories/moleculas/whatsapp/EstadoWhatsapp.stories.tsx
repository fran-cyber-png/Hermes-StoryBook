import type { Meta, StoryObj } from '@storybook/react-vite';
import { EstadoWhatsapp } from '../../../features/whatsapp/EstadoWhatsapp';

/** El chip de salud de la línea de WhatsApp en la barra superior. Sin backend, muestra su estado de error/desconocido — un estado real, no un roto. */
const meta = {
  title: 'Moléculas/whatsapp/EstadoWhatsapp',
  component: EstadoWhatsapp,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof EstadoWhatsapp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinBackend: Story = {};
