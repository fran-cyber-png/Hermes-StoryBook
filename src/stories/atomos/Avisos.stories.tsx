import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Avisos } from '../../components/Avisos';
import { avisar } from '../../lib/avisos';

/**
 * El acuse flotante («✓ Contacto registrado»). Sin props: escucha el bus de
 * `lib/avisos.ts`. La única forma de verlo es DISPARAR el bus — con un botón
 * en la historia, o automáticamente en `play` (prueba de interacción real).
 */
const meta = {
  title: 'Átomos/Avisos',
  component: Avisos,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Avisos>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Disparado: Story = {
  name: 'Disparado (prueba de interacción)',
  render: () => (
    <div className="relative h-32 w-64">
      <Avisos />
      <button
        type="button"
        className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        onClick={() => avisar('Contacto registrado')}
      >
        Disparar aviso
      </button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Disparar aviso' }));
    await expect(await canvas.findByRole('status')).toHaveTextContent('Contacto registrado');
  },
};
