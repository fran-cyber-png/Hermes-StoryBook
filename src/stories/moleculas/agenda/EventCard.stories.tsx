import type { Meta, StoryObj } from '@storybook/react-vite';
import { EventCard } from '../../../features/agenda/components/EventCard';
import type { Recordatorio } from '../../../features/agenda/agenda';

/**
 * La tarjeta de un recordatorio en la grilla de la agenda: hora, importancia
 * (el punto de color) y la nota. Se dibuja igual arrastrable (en mes/semana)
 * o no (en el Gantt).
 */
const base: Recordatorio = {
  id: 1,
  clave: 'conv:whatsapp:51943348051:51963139984',
  canal: 'whatsapp',
  personaId: '51943348051',
  personaNombre: 'Andrea Quispe',
  numeroPropio: '51963139984',
  nota: 'Llamar para cerrar la inscripción',
  cuando: new Date().toISOString(),
  estado: 'pendiente',
  importancia: 'alta',
};

const meta = {
  title: 'Moléculas/agenda/EventCard',
  component: EventCard,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-56">
        <Story />
      </div>
    ),
  ],
  args: { recordatorio: base, vencido: false, onView: () => {} },
} satisfies Meta<typeof EventCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pendiente: Story = {};

export const Vencida: Story = {
  args: { vencido: true },
};

export const Hecha: Story = {
  name: 'Hecha (tachada, sin importar si era importante)',
  args: { recordatorio: { ...base, estado: 'hecho' } },
};

export const SinImportancia: Story = {
  args: { recordatorio: { ...base, importancia: undefined } },
};

export const Arrastrable: Story = {
  name: 'Arrastrable (mes/semana)',
  args: { draggable: true },
};

export const Arrastrando: Story = {
  name: 'Mientras se arrastra',
  args: { draggable: true, isDragging: true },
};
