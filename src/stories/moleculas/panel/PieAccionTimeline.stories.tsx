import type { Meta, StoryObj } from '@storybook/react-vite';
import { PieAccionTimeline } from '../../../features/panel/PieAccionTimeline';

/** El pie del panel de contacto: «Registrar venta» o «Anotar quién es» según el módulo. */
const meta = {
  title: 'Moléculas/panel/PieAccionTimeline',
  component: PieAccionTimeline,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PieAccionTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

const estadoNuevo = {
  tono: 'nuevo' as const,
  acento: 'neutro' as const,
  titulo: 'Contacto nuevo',
  compras: null,
  detalle: null,
  enfriada: false,
};
const estadoCliente = {
  tono: 'cliente' as const,
  acento: 'cliente' as const,
  titulo: 'Ya es cliente',
  compras: null,
  detalle: 'Compró el Diplomado en abril',
  enfriada: false,
};

export const RegistrarVenta: Story = {
  args: { estado: estadoNuevo, onVender: () => {}, tieneFicha: false },
};

export const YaEsCliente: Story = {
  args: { estado: estadoCliente, onVender: () => {}, tieneFicha: false },
};

export const AnotarQuienEs: Story = {
  name: 'Anotar quién es (campaña)',
  args: { estado: estadoNuevo, onAnotarQuienEs: () => {}, tieneFicha: false },
};
