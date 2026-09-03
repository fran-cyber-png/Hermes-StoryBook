import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ResumenIa } from '../../../features/panel/ResumenIa';

/** El resumen IA colapsable del panel de contacto. Sin verde: es provisional, no una venta. */
const meta = {
  title: 'Moléculas/panel/ResumenIa',
  component: ResumenIa,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ResumenIa>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cerrado: Story = {
  args: { texto: 'Preguntó por el Diplomado en Inteligencia y Contrainteligencia, todavía no confirmó el pago.' },
};

export const SinResumen: Story = { name: 'Sin resumen (no existe el endpoint)', args: { texto: null } };

export const Expandir: Story = {
  name: 'Expandir (prueba de interacción)',
  args: { texto: 'Preguntó por el diplomado y pidió el temario completo por WhatsApp.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boton = canvas.getByRole('button', { name: /mostrar u ocultar resumen/i });
    await expect(boton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(boton);
    await expect(boton).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText(/pidió el temario/)).toBeVisible();
  },
};
