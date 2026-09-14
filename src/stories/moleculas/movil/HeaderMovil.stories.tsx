import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeaderMovil } from '../../../features/movil/HeaderMovil';

/**
 * El header del teléfono — reemplaza al riel lateral de vistas y a la barra de
 * arriba de escritorio, que ahí no caben. De dónde vengo (la flecha), dónde
 * estoy (el título), y las dos señales que no pueden esperar a que abras un
 * menú: el tema y si el bot tiene línea.
 *
 * ⚠️ El chip del bot **no es decoración** — dice si hay una máquina contestando
 * a los leads ahora mismo. En el teléfono se mira, no se administra.
 */
const meta = {
  title: 'Moléculas/movil/HeaderMovil',
  component: HeaderMovil,
  parameters: { layout: 'fullscreen' },
  args: { titulo: 'Mensajes' },
} satisfies Meta<typeof HeaderMovil>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sin `onVolver` la flecha no se dibuja: una flecha que no vuelve a ningún lado miente. */
export const Raiz: Story = {
  name: 'En la raíz (sin flecha de volver)',
};

export const ConVolver: Story = {
  args: { onVolver: () => {} },
};

export const BotSinLinea: Story = {
  name: 'El bot no tiene línea (aviso)',
  args: { onVolver: () => {}, titulo: 'Mensajes', aviso: 'El bot no tiene WhatsApp conectado' },
};

export const TituloLargo: Story = {
  name: 'Título largo (se trunca, no empuja los íconos)',
  args: { onVolver: () => {}, titulo: 'Diplomado en Inteligencia y Contrainteligencia' },
};
