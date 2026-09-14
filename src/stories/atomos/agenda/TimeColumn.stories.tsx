import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimeColumn } from '../../../features/agenda/components/TimeColumn';

/**
 * La columna de horas de la agenda: las 24, en la voz «instrumento» (mono), con
 * la hora actual en tinta plena y el resto al 60 % — así la vista se ubica sola
 * sin que ninguna hora grite.
 *
 * Cada hora mide 60 px exactos, que es la unidad con la que se posicionan los
 * eventos y la línea del ahora.
 */
const meta = {
  title: 'Átomos/agenda/TimeColumn',
  component: TimeColumn,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="flex h-80 overflow-y-auto rounded-xl border border-border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TimeColumn>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sin `ahora` ninguna hora se destaca: es la agenda de otro día. */
export const OtroDia: Story = {
  name: 'Otro día (ninguna hora destacada)',
};

export const ConHoraActual: Story = {
  name: 'Hoy (la hora actual en tinta plena)',
  args: { ahora: new Date(2026, 8, 14, 9, 20) },
};

export const Medianoche: Story = {
  name: 'Medianoche (el borde de la lista)',
  args: { ahora: new Date(2026, 8, 14, 0, 5) },
};
