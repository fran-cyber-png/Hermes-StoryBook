import type { Meta, StoryObj } from '@storybook/react-vite';
import { TituloDeSeccion } from '../../components/TituloDeSeccion';

/**
 * El único `<h1>` de cada pantalla — «¿en qué vista estoy?». 24px/700. Ver el
 * docblock del componente: fija la jerarquía tipográfica de las diez vistas.
 */
const meta = {
  title: 'Átomos/TituloDeSeccion',
  component: TituloDeSeccion,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TituloDeSeccion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Contactos: Story = { args: { children: 'Contactos' } };
export const Pipeline: Story = { args: { children: 'Pipeline' } };
export const Mensajes: Story = { args: { children: 'Mensajes' } };
