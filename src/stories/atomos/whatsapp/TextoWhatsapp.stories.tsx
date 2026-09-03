import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextoWhatsapp } from '../../../features/whatsapp/TextoWhatsapp';

/** Un texto de WhatsApp pintado como lo ve el cliente: *negrita*, _cursiva_, ~tachado~, enlaces. */
const meta = {
  title: 'Átomos/whatsapp/TextoWhatsapp',
  component: TextoWhatsapp,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TextoWhatsapp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConFormato: Story = {
  args: { texto: '¡Hola! *El diplomado* dura 3 meses y arranca en _setiembre_. Info: https://goberna.us/diplomado' },
};

export const Plano: Story = { args: { texto: 'Cuánto cuesta la campaña de 3 meses?' } };
