import type { Meta, StoryObj } from '@storybook/react-vite';
import { MiniCalendario } from '../../../features/agenda/MiniCalendario';

const meta = {
  title: 'Moléculas/agenda/MiniCalendario',
  component: MiniCalendario,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof MiniCalendario>;

export default meta;
type Story = StoryObj<typeof meta>;

const hoy = new Date(2026, 8, 3);

export const ConRecordatorios: Story = {
  args: {
    foco: hoy,
    hoy,
    onClickDia: () => {},
    onCambiarMes: () => {},
    porDia: new Map([
      ['2026-09-08', [{ id: 1 }] as never],
      ['2026-09-15', [{ id: 2 }, { id: 3 }] as never],
    ]),
  },
};
