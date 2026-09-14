import type { Meta, StoryObj } from '@storybook/react-vite';
import { ElegirLinea } from '../../../features/canales/ElegirLinea';

/** El modal para elegir por cuál línea de WhatsApp escribirle a alguien nuevo. */
const meta = {
  title: 'Moléculas/canales/ElegirLinea',
  component: ElegirLinea,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ElegirLinea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DosLineas: Story = {
  args: {
    telefono: '51943348051',
    /** `esMia` se llama `mias` desde que el mapa de asignación lo resuelve el server. */
    lineas: [
      { numero: '51963139984', etiqueta: 'Ventas Perú', estado: 'conectada', mias: true },
      { numero: '51987654321', etiqueta: 'Ventas Meta', estado: 'conectada', mias: false },
    ],
    onElegir: () => {},
    onCerrar: () => {},
  },
};
