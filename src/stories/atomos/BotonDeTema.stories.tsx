import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { BotonDeTema } from '../../components/BotonDeTema';

/**
 * La perilla claro/oscuro de la barra superior. Sin props — lee/escribe el
 * tema global (`lib/tema.ts`). La historia `Alternar` es una prueba de
 * INTERACCIÓN real: hace clic y comprueba que el ícono cambia de sol a luna.
 */
const meta = {
  title: 'Átomos/BotonDeTema',
  component: BotonDeTema,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof BotonDeTema>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDefecto: Story = {};

export const Alternar: Story = {
  name: 'Alternar tema (prueba de interacción)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boton = canvas.getByRole('button');
    const etiquetaInicial = boton.getAttribute('aria-label');
    await userEvent.click(boton);
    await expect(boton.getAttribute('aria-label')).not.toBe(etiquetaInicial);
    // deja el tema como estaba, para no ensuciar otras historias
    await userEvent.click(boton);
  },
};
