import type { Meta, StoryObj } from '@storybook/react-vite';
import { PildoraAsignacion } from '../../features/vistas/PildoraAsignacion';

/**
 * A quién está asignada una conversación — una sola píldora para la tarjeta del
 * Pipeline y para la Lista, así las dos vistas no pueden decirlo distinto.
 *
 * QUÉ dice lo decide `marcaDeAsignacion` (`dominio/dueno.ts`); este componente
 * sólo pone la forma.
 *
 * ⚠️ **Neutra y sin oro**: no apura nada, dice de quién es. Y «Sin asignar» va
 * con el contorno PUNTEADO, que es la forma que la casa ya usa para «esto no lo
 * tiene nadie todavía» — mide igual que la llena para que la tarjeta no salte.
 */
const meta = {
  title: 'Átomos/PildoraAsignacion',
  component: PildoraAsignacion,
  parameters: { layout: 'centered' },
  args: { marca: { asignada: true, texto: 'Luz', titulo: 'Asignada a Luz' } },
} satisfies Meta<typeof PildoraAsignacion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Asignada: Story = {};

export const SinAsignar: Story = {
  name: 'Sin asignar (contorno punteado)',
  args: { marca: { asignada: false, texto: 'Sin asignar', titulo: 'Todavía no la tomó nadie' } },
};

/** Las dos juntas: miden lo mismo, que es el punto. */
export const LadoALado: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <PildoraAsignacion marca={{ asignada: true, texto: 'Luz', titulo: 'Asignada a Luz' }} />
      <PildoraAsignacion marca={{ asignada: false, texto: 'Sin asignar', titulo: 'Todavía no la tomó nadie' }} />
    </div>
  ),
};

export const NombreLargo: Story = {
  args: { marca: { asignada: true, texto: 'Karina Tarazona', titulo: 'Asignada a Karina Tarazona' } },
};
