import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectorImportancia } from '../../../features/agenda/SelectorImportancia';

const meta = {
  title: 'Moléculas/agenda/SelectorImportancia',
  component: SelectorImportancia,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SelectorImportancia>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinElegir: Story = { args: { onChange: () => {} } };
export const Deshabilitado: Story = { args: { onChange: () => {}, disabled: true } };
