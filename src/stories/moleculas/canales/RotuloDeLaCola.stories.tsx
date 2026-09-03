import type { Meta, StoryObj } from '@storybook/react-vite';
import { RotuloDeLaCola } from '../../../features/canales/RotuloDeLaCola';

/** El contador «N en cola» / «N para ti» de la cabecera de Mensajes. */
const meta = {
  title: 'Moléculas/canales/RotuloDeLaCola',
  component: RotuloDeLaCola,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof RotuloDeLaCola>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EnCola: Story = { args: { total: 984 } };
export const Recortada: Story = { name: 'Recortada (línea propia)', args: { total: 41, recortada: true, lineaPropia: true } };
