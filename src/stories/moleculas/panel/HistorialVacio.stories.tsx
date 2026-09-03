import type { Meta, StoryObj } from '@storybook/react-vite';
import { HistorialVacio } from '../../../features/panel/HistorialVacio';

const meta = {
  title: 'Moléculas/panel/HistorialVacio',
  component: HistorialVacio,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof HistorialVacio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDefecto: Story = {};
