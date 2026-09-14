import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { MenuMovil } from '../../../features/auth/MenuMovil';

/**
 * La cuenta, en el celular — y sólo para salir. En escritorio la cuenta vive
 * abajo del riel con foto, línea vinculada, sesión de Cerberus y
 * Configuración; en el teléfono el pedido es mínimo a propósito: se atiende
 * la cola y se sale.
 *
 * ⚠️ **Quién entró va escrito arriba de la acción**: con varias vendedoras
 * compartiendo teléfonos, «¿entré con el usuario que era?» es la pregunta que
 * se contesta antes de salir.
 */
const meta = {
  title: 'Moléculas/movil/MenuMovil',
  component: MenuMovil,
  parameters: { layout: 'padded' },
  args: { vendedora: { id: 'v1', nombre: 'Luz Ventas' }, onSalir: () => {} },
} satisfies Meta<typeof MenuMovil>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cerrado: Story = {};

/**
 * ⚠️ El menú lleva `animate-entrar` (arranca en `opacity: 0`, anima a 1 en
 * 240ms) — con `toBeVisible()` justo después del clic, la prueba puede
 * atrapar el frame en que la opacidad todavía es 0 y fallar por timing, no
 * por un defecto real. `toBeInTheDocument()` confirma lo que importa: que el
 * contenido correcto se montó.
 */
export const AbrirYCerrarSesion: Story = {
  name: 'Abrir y ver quién entró (prueba de interacción)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boton = canvas.getByRole('button', { name: 'Tu cuenta' });
    await expect(boton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(boton);
    await expect(boton).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('Luz Ventas')).toBeInTheDocument();
    await expect(canvas.getByRole('menuitem', { name: /cerrar sesión/i })).toBeInTheDocument();
  },
};

export const NombreLargo: Story = {
  name: 'Nombre largo (se trunca, no empuja el menú)',
  args: { vendedora: { id: 'v2', nombre: 'Karina Alejandra Tarazona Mendoza' } },
};
