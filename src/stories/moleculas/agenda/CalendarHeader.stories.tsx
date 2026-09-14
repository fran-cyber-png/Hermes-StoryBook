import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarHeader } from '../../../features/agenda/components/CalendarHeader';

/**
 * La barra de la agenda. «Hoy» vive en el CENTRO, pegado al título — el botón
 * y el título contestan la misma pregunta («¿dónde estoy parada?») y
 * separados obligaban a cruzar la pantalla para volver.
 *
 * ⚠️ **El rótulo del botón CAMBIA con el foco, y no es cosmético**: pegado al
 * título, un «Hoy» fijo se lee como parte de la fecha de al lado. Parado en
 * otro día, la barra diría «Hoy · lunes, 10 de agosto» y juraría que el 10 es
 * hoy. Con `enHoy=false` dice «Volver a hoy», que es lo que hace.
 */
const meta = {
  title: 'Moléculas/agenda/CalendarHeader',
  component: CalendarHeader,
  parameters: { layout: 'padded' },
  args: {
    title: 'Miércoles, 14 de septiembre',
    modo: 'semana',
    onToday: () => {},
    onPrevious: () => {},
    onNext: () => {},
    onModoChange: () => {},
    onCreateClick: () => {},
  },
} satisfies Meta<typeof CalendarHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EnHoy: Story = {
  name: 'Mirando hoy (el botón dice «Hoy»)',
  args: { enHoy: true },
};

export const EnOtroDia: Story = {
  name: 'Parada en otro día (dice «Volver a hoy»)',
  args: { title: 'Lunes, 10 de agosto', enHoy: false },
};

export const ConVencidas: Story = {
  name: 'Con recordatorios vencidos',
  args: { enHoy: true, overdue: 3 },
};

export const ModoMes: Story = {
  args: { modo: 'mes', title: 'Septiembre 2026', enHoy: true },
};

export const ModoGantt: Story = {
  args: { modo: 'gantt', title: 'Vista Gantt', enHoy: true },
};
