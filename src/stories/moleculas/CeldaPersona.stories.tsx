import type { Meta, StoryObj } from '@storybook/react-vite';
import { CeldaPersona } from '../../components/TablaQuieta';
import { BadgeCanal } from '../../components/BadgeCanal';

/**
 * La persona dentro de una tabla: avatar + nombre, y opcionalmente una segunda
 * línea tenue.
 *
 * ⚠️ **`alLado` y `insignia` no son lo mismo, y la diferencia importa**: la
 * insignia va MONTADA sobre el avatar (el punto de frescura del padrón), y
 * `alLado` va EN LÍNEA después del nombre. El canal de una conversación va al
 * lado y nunca montado: achicado sobre el avatar, el círculo verde de WhatsApp
 * se lee como el punto verde del semáforo, que es otra cosa.
 */
const meta = {
  title: 'Moléculas/CeldaPersona',
  component: CeldaPersona,
  parameters: { layout: 'padded' },
  args: { nombre: 'Andrea Quispe' },
} satisfies Meta<typeof CeldaPersona>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SoloNombre: Story = {};

export const ConDetalle: Story = {
  name: 'Con segunda línea (correo)',
  args: { nombre: 'Andrea Quispe', detalle: 'andrea.quispe@gmail.com' },
};

export const ConCanalAlLado: Story = {
  name: 'Con el canal al lado (Lista del Pipeline)',
  args: { nombre: 'Andrea Quispe', alLado: <BadgeCanal canal="whatsapp" size={13} /> },
};

export const ConInsignia: Story = {
  name: 'Con insignia sobre el avatar (frescura del padrón)',
  args: {
    nombre: 'Andrea Quispe',
    detalle: 'Diplomado en Inteligencia',
    insignia: <span className="block size-2 rounded-full bg-temp-fresco ring-2 ring-card" />,
  },
};

export const Compacta: Story = {
  name: 'Compacta (columna secundaria, ej. «Asignado a»)',
  args: { nombre: 'Luz Ventas', compacta: true },
};

/** Sin nombre: la tabla no puede dejar la celda vacía y callarse. */
export const SinNombre: Story = {
  args: { nombre: null, detalle: '+51 943 348 051' },
};
