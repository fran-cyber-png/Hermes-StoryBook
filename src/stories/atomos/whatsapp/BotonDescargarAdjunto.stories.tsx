import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { BotonDescargarAdjunto } from '../../../features/whatsapp/BotonDescargarAdjunto';

/**
 * DESCARGAR un adjunto, en las acciones de la burbuja del hilo. Al lado de
 * Responder y Copiar, con su mismo molde.
 *
 * Existe aparte del visor porque **un audio o un Excel no se abren en grande**, y
 * una foto se quiere guardar sin tener que abrirla primero. Va en los dos
 * sentidos: se guarda tanto lo que mandó el lead como lo que salió de Hermes.
 *
 * ⚠️ **Está SIEMPRE en el DOM e invisible hasta el hover** (`opacity-0` +
 * `group-hover/burbuja`), y eso no es un detalle de estilo: montarlo recién al
 * pasar el mouse por encima haría que el primer clic caiga en la nada. Por eso
 * estas historias lo envuelven en una burbuja con la clase `group/burbuja` —
 * **pasá el mouse por encima para verlo**.
 *
 * No pide nada a la red al montarse: `useBlobAutenticado` corre en modo
 * `alPedir`, así que la bajada arranca recién cuando alguien toca el botón.
 */
const meta = {
  title: 'Átomos/whatsapp/BotonDescargarAdjunto',
  component: BotonDescargarAdjunto,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="group/burbuja flex max-w-xs items-end gap-2 rounded-2xl rounded-br-md bg-secondary px-3.5 py-2 text-sm text-navy-ink shadow-sm">
        <span>Te paso el comprobante 📄</span>
        <Story />
      </div>
    ),
  ],
  args: {
    media: { clase: 'documento', archivo: 'abc123', mime: 'application/pdf', nombre: 'voucher.pdf' },
    cuando: new Date().toISOString(),
  },
} satisfies Meta<typeof BotonDescargarAdjunto>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EnLaBurbuja: Story = {
  name: 'En la burbuja (pasá el mouse por encima)',
};

export const Audio: Story = {
  args: {
    media: { clase: 'audio', archivo: 'def456', mime: 'audio/ogg', nombre: null, voz: { segundos: 14 } },
  },
};

export const Imagen: Story = {
  args: { media: { clase: 'imagen', archivo: 'ghi789', mime: 'image/jpeg', nombre: null } },
};

/**
 * La regla que esta historia protege: el botón tiene que estar en el DOM aunque
 * no se vea. Si algún día alguien lo monta condicionalmente al hover, el primer
 * clic se pierde — y sin este test nadie se entera.
 */
export const SiempreEnElDom: Story = {
  name: 'Siempre en el DOM, aunque invisible (prueba)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boton = canvas.getByRole('button', { name: /descargar/i });
    await expect(boton).toBeInTheDocument();
    await expect(boton).toBeEnabled();
  },
};
