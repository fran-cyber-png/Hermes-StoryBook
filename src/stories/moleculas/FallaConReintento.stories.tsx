import type { Meta, StoryObj } from '@storybook/react-vite';
import { FallaConReintento } from '../../components/FallaConReintento';
import { ErrorApi } from '../../lib/datos/cliente';

/**
 * Una falla que se puede reintentar, dicha en pantalla — no una pantalla en
 * blanco ni un spinner eterno.
 *
 * La regla que decide el texto: **si la falla trae nombre propio del server
 * (`ErrorApi` con `codigo`), se muestra ESE mensaje**, porque el server es el que
 * sabe qué pasó; si no, el genérico que pasa quien la monta.
 *
 * Existe porque una cola vacía sin explicación se lee como «estás al día», que es
 * la mentira más cara de esta app.
 */
const meta = {
  title: 'Moléculas/FallaConReintento',
  component: FallaConReintento,
  parameters: { layout: 'padded' },
  args: {
    error: new Error('Network request failed'),
    generico: 'No se pudo cargar la cola.',
    onReintentar: () => {},
  },
} satisfies Meta<typeof FallaConReintento>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Generico: Story = {
  name: 'Falla sin nombre (usa el texto genérico)',
};

export const ConMensajeDelServer: Story = {
  name: 'El server dijo qué pasó (gana su mensaje)',
  args: {
    error: new ErrorApi(
      'No pudimos leer qué líneas te tocan, así que preferimos no mostrarte una cola incompleta.',
      503,
      undefined,
      undefined,
      'lineas_no_leidas',
    ),
  },
};

export const Reintentando: Story = {
  name: 'Reintento en vuelo (el botón no se puede tocar)',
  args: { reintentando: true },
};

export const Compacta: Story = {
  name: 'Compacta (una línea dentro de otro bloque)',
  args: { compacta: true, generico: 'No se pudo cargar el historial.' },
};
