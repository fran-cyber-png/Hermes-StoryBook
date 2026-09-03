import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { BotonFavorito } from '../../features/contactos/BotonFavorito';

/** La estrella de favorito: la misma pieza en la tabla, la cuadrícula y el detalle. */
const meta = {
  title: 'Átomos/BotonFavorito',
  component: BotonFavorito,
  parameters: { layout: 'centered' },
  args: { clave: 'contacto-1', favorito: false },
} satisfies Meta<typeof BotonFavorito>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinMarcar: Story = {};

export const Favorito: Story = { args: { favorito: true } };

export const Compacto: Story = { args: { favorito: true, compacto: true } };

export const ClicMarca: Story = {
  args: { favorito: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boton = canvas.getByRole('button', { name: 'Marcar como favorito' });
    await expect(boton).toBeInTheDocument();
    await userEvent.click(boton);
  },
};
