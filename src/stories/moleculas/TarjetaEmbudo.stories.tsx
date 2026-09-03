import type { Meta, StoryObj } from '@storybook/react-vite';
import { TarjetaEmbudo } from '../../features/vistas/TarjetaEmbudo';
import { crearConversacionMock } from '../fixtures/conversacion';

/**
 * La tarjeta del Pipeline. Bug #3 de la bitácora de Figma vive acá: el borde
 * izquierdo de 2px en `border-box` le come ancho al contenido — en Figma se
 * compensó sumando al padding.
 */
const meta = {
  title: 'Moléculas/TarjetaEmbudo',
  component: TarjetaEmbudo,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TarjetaEmbudo>;

export default meta;
type Story = StoryObj<typeof meta>;

const propsBase = {
  indice: 0,
  onAbrir: () => {},
  alArrastrar: () => {},
  alTerminar: () => {},
  arrastrando: false,
  rebotada: false,
  cotizando: false,
  columna: 'Te esperan',
};

export const TeEsperan: Story = {
  render: () => <TarjetaEmbudo c={crearConversacionMock()} {...propsBase} />,
};

export const Abierta: Story = {
  render: () => <TarjetaEmbudo c={crearConversacionMock()} {...propsBase} abierta />,
};

export const Arrastrando: Story = {
  render: () => <TarjetaEmbudo c={crearConversacionMock()} {...propsBase} arrastrando />,
};

export const PlazoVencido: Story = {
  name: 'Con plazo vencido (39 min → 0, chip rojo)',
  render: () => (
    <TarjetaEmbudo
      c={crearConversacionMock({ nivel: 1, ventana_cierra: new Date(Date.now() - 1000 * 60 * 5).toISOString() })}
      {...propsBase}
    />
  ),
};

export const Rebotada: Story = {
  name: 'Rebotada (el drop no se pudo guardar)',
  render: () => <TarjetaEmbudo c={crearConversacionMock()} {...propsBase} rebotada />,
};
