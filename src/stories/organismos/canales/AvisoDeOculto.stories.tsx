import type { Meta, StoryObj } from '@storybook/react-vite';
import { AvisoDeOculto } from '../../../features/canales/ContenidoDelComentario';

/** Se dice arriba del comentario cuando alguien lo ocultó en Facebook — "oculto" no es "borrado". */
const meta = {
  title: 'Organismos/canales/AvisoDeOculto',
  component: AvisoDeOculto,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AvisoDeOculto>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
