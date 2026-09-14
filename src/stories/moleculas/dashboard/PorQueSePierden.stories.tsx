import type { Meta, StoryObj } from '@storybook/react-vite';
import { PorQueSePierden } from '../../../features/dashboard/PorQueSePierden';

/**
 * Por qué se pierden — el bloque de «El negocio». Cuenta la MISMA cohorte que
 * la tabla de al lado: las que llegaron en el período y hoy están en «Dijo que
 * no», por el motivo que declaró quien las atendía.
 *
 * ⚠️ **Lo más probable es que diga cero, y está bien que lo diga.** En este
 * negocio la gente se calla — en ventas no hubo un solo «perdido» declarado en
 * toda la historia. El estado vacío explica de dónde sale el dato (una persona
 * lo declara) en vez de parecer un error.
 */
const meta = {
  title: 'Moléculas/dashboard/PorQueSePierden',
  component: PorQueSePierden,
  parameters: { layout: 'padded' },
  args: { llegaron: 340 },
} satisfies Meta<typeof PorQueSePierden>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ElCasoMasComun: Story = {
  name: 'El caso más común: nadie declaró nada',
  args: { perdidas: { total: 0, porMotivo: [] } },
};

export const ConMotivos: Story = {
  args: {
    perdidas: {
      total: 12,
      porMotivo: [
        { motivo: 'precio', n: 5 },
        { motivo: 'horario_o_fecha', n: 3 },
        { motivo: 'compro_en_otro_lado', n: 2 },
        { motivo: 'sin_interes', n: 1 },
        { motivo: 'no_contesta', n: 1 },
      ],
    },
  },
};

export const ConMotivoSinDeclarar: Story = {
  name: 'Con una pérdida de antes de que se pidiera el motivo',
  args: {
    perdidas: {
      total: 4,
      porMotivo: [
        { motivo: 'precio', n: 3 },
        { motivo: null, n: 1 },
      ],
    },
  },
};

/** Server viejo o caché rehidratado: no se dibuja nada, ni el título. */
export const SinDato: Story = {
  name: 'Sin el dato (server viejo — no dibuja nada)',
  args: { perdidas: undefined },
};
