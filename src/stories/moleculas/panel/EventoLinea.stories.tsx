import type { Meta, StoryObj } from '@storybook/react-vite';
import { EventoLinea } from '../../../features/panel/EventoLinea';

/** Un evento del timeline del contacto — la fila de Fila de timeline en Figma. */
const meta = {
  title: 'Moléculas/panel/EventoLinea',
  component: EventoLinea,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof EventoLinea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Confirmado: Story = {
  args: {
    e: { id: '1', tipo: 'registro', rotulo: 'Contacto registrado', valor: 'por Betto.romero', timestamp: new Date().toISOString(), estado: 'confirmado' },
    esUltimo: false,
  },
};

export const Editable: Story = {
  args: {
    e: { id: '2', tipo: 'nota', rotulo: 'Nombre identificado', valor: 'Karina Tarazona', timestamp: new Date().toISOString(), estado: 'manual', editable: true },
    esUltimo: true,
    onEditar: () => {},
    onBorrar: () => {},
  },
};

export const Pendiente: Story = {
  args: {
    e: { id: '3', tipo: 'enfriamiento', rotulo: 'Enfriamiento', valor: 'Sin respuesta desde hace 1 día', estado: 'pendiente' },
    esUltimo: true,
  },
};
