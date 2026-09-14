import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { MenuDeConfiguracion } from '../../../features/notas/MenuDeConfiguracion';

/**
 * «Configuración» al pie del riel de la Libreta — fusiona dos acciones de
 * administración que antes competían por el mismo lugar fijo (apilarlas
 * empujaba la lista de páginas hacia arriba).
 *
 * El alto es `h-14` **fijo y no derivado del contenido**: es el mismo alto
 * exacto que el pie de paginación de al lado, para que las dos líneas
 * divisorias queden a la misma altura — reportado con una captura cuando no
 * coincidían.
 */
const meta = {
  title: 'Moléculas/notas/MenuDeConfiguracion',
  component: MenuDeConfiguracion,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-64 rounded-lg border border-dashed border-border">
        <Story />
      </div>
    ),
  ],
  args: { onAdministrarEspacios: () => {}, onConfigurarRespuestas: () => {} },
} satisfies Meta<typeof MenuDeConfiguracion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cerrado: Story = {};

export const AbrirYElegir: Story = {
  name: 'Abrir el menú y elegir una opción (prueba de interacción)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boton = canvas.getByRole('button', { name: 'Configuración' });
    await expect(boton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(boton);
    await expect(boton).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('Administrar espacios')).toBeVisible();
    await userEvent.click(canvas.getByText('Administrar espacios'));
    // Se cierra solo al elegir una opción.
    await expect(boton).toHaveAttribute('aria-expanded', 'false');
  },
};

export const ClicAfueraCierra: Story = {
  name: 'Clic afuera cierra (prueba de interacción)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boton = canvas.getByRole('button', { name: 'Configuración' });
    await userEvent.click(boton);
    await expect(boton).toHaveAttribute('aria-expanded', 'true');
    // Fuera del componente, adentro del decorador — simula el resto de la pantalla.
    await userEvent.click(canvasElement);
    await expect(boton).toHaveAttribute('aria-expanded', 'false');
  },
};
