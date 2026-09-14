import type { Meta, StoryObj } from '@storybook/react-vite';
import { EventoLinea } from '../../../features/panel/EventoLinea';

/**
 * Un evento del timeline del contacto: punto de color por estado, ícono por tipo,
 * rótulo y hora. La línea conectora se corta en el último (`esUltimo`).
 *
 * ⚠️ Los botones de editar/borrar NO dependen de un flag `editable`: salen solo
 * cuando el evento es propio y de una persona (`eventoId` + `mio`) Y quien monta
 * pasó los dos handlers — la regla del componente es no dibujar nunca un botón
 * que no haga nada.
 */
const meta = {
  title: 'Moléculas/panel/EventoLinea',
  component: EventoLinea,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <ul className="max-w-md list-none rounded-xl border border-border bg-card p-3">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof EventoLinea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Registrado: Story = {
  name: 'Registrado a mano (dice quién)',
  args: {
    e: {
      id: '1',
      tipo: 'registrado',
      rotulo: 'Contacto registrado',
      timestamp: new Date().toISOString(),
      estado: 'manual',
      autor: 'Betto',
    },
    esUltimo: false,
  },
};

export const Propio: Story = {
  name: 'Propio y editable (aparece al pasar el mouse)',
  args: {
    e: {
      id: '2',
      tipo: 'registrado',
      rotulo: 'Llamada de seguimiento',
      timestamp: new Date().toISOString(),
      estado: 'manual',
      autor: 'Luz',
      comentario: 'Pidió que la llamemos el lunes por la tarde.',
      eventoId: 412,
      mio: true,
    },
    esUltimo: false,
    onEditar: () => {},
    onBorrar: () => {},
  },
};

export const Identidad: Story = {
  args: {
    e: {
      id: '3',
      tipo: 'identidad',
      rotulo: 'Nombre identificado',
      valor: 'Karina Tarazona',
      timestamp: new Date().toISOString(),
      estado: 'confirmado',
    },
    esUltimo: false,
  },
};

export const Compra: Story = {
  name: 'Compra (con el producto que se llevó)',
  args: {
    e: {
      id: '4',
      tipo: 'compra',
      rotulo: 'Compró',
      valor: 'S/ 1,200',
      detalle: 'Diplomado en Inteligencia y Contrainteligencia',
      timestamp: new Date().toISOString(),
      estado: 'confirmado',
    },
    esUltimo: false,
  },
};

export const SenalDeIa: Story = {
  name: 'Señal automática (tag, sin autor)',
  args: {
    e: {
      id: '5',
      tipo: 'cotizacion',
      rotulo: 'Se le cotizó',
      valor: 'Detectado en el mensaje saliente',
      timestamp: new Date().toISOString(),
      estado: 'senal',
    },
    esUltimo: false,
  },
};

export const Pendiente: Story = {
  name: 'Pendiente (punto punteado, es el último)',
  args: {
    e: {
      id: '6',
      tipo: 'enfriamiento',
      rotulo: 'Enfriamiento',
      valor: 'Sin respuesta desde hace 1 día',
      estado: 'pendiente',
    },
    esUltimo: true,
  },
};
