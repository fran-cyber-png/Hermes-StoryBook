import type { Meta, StoryObj } from '@storybook/react-vite';
import { BadgeCanal, PildoraCanal, LogoDeCanal } from '../../components/BadgeCanal';

/**
 * La insignia de canal — disco (`BadgeCanal`), píldora con nombre (`PildoraCanal`)
 * o solo el logo (`LogoDeCanal`). Los cuatro colores son de marca externa; el
 * docblock de `BadgeCanal.tsx` documenta el contraste medido de cada uno
 * (Messenger y Facebook no llegan a 4.5:1 con ninguna tinta — es una decisión
 * del dueño, no un bug).
 */
const meta = {
  title: 'Átomos/BadgeCanal',
  component: BadgeCanal,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof BadgeCanal>;

export default meta;
type Story = StoryObj<typeof meta>;

const CANALES = ['whatsapp', 'instagram', 'facebook'] as const;

export const Disco: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {CANALES.map((canal) => (
        <BadgeCanal key={canal} canal={canal} size={20} />
      ))}
    </div>
  ),
};

export const DiscoComentario: Story = {
  name: 'Disco — comentario público (hueco)',
  render: () => (
    <div className="flex items-center gap-4">
      {CANALES.map((canal) => (
        <BadgeCanal key={canal} canal={canal} tipo="comentario" size={20} />
      ))}
    </div>
  ),
};

export const Messenger: Story = {
  name: 'Messenger (facebook + tipo=mensaje, no es Facebook)',
  args: { canal: 'facebook', tipo: 'mensaje', size: 20 },
};

export const Pildora: StoryObj<typeof PildoraCanal> = {
  render: () => (
    <div className="flex flex-col items-start gap-2">
      {CANALES.map((canal) => (
        <PildoraCanal key={canal} canal={canal} />
      ))}
      <PildoraCanal canal="facebook" tipo="mensaje" />
      <PildoraCanal canal="instagram" tipo="comentario" />
    </div>
  ),
};

export const SoloLogo: StoryObj<typeof LogoDeCanal> = {
  name: 'Solo el logo (selector de ColaUnificada)',
  render: () => (
    <div className="flex items-center gap-3 text-2xl">
      {CANALES.map((canal) => (
        <span key={canal} style={{ color: 'var(--navy-ink)' }}>
          <LogoDeCanal canal={canal} size={22} soloGlifo />
        </span>
      ))}
    </div>
  ),
};
