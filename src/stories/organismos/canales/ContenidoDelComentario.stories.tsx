import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContenidoDelComentario } from '../../../features/canales/ContenidoDelComentario';

/** El comentario, dibujado según de qué está hecho: burbuja de texto, emojis grandes, o nada. */
const meta = {
  title: 'Organismos/canales/ContenidoDelComentario',
  component: ContenidoDelComentario,
  parameters: { layout: 'padded' },
  args: { fileteCanal: 'border-l-primary' },
} satisfies Meta<typeof ContenidoDelComentario>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Texto: Story = {
  args: { texto: 'Betto tú sí me das confianza!!! Todo el apoyo desde Chimbote' },
};

export const SoloEmojis: Story = {
  name: 'Solo emojis (se agrandan, sin burbuja)',
  args: { texto: '👏👏👏😍' },
};

export const MuchosEmojis: Story = {
  name: 'Más de 8 emojis (vuelve a texto normal)',
  args: { texto: '😂😂😂😂😂😂😂😂😂😂' },
};

export const Bandera: Story = {
  name: 'Solo una bandera (cuenta como emoji)',
  args: { texto: '🇵🇪' },
};

export const Vacio: Story = {
  name: 'Vacío (sticker sin texto — no dibuja nada)',
  args: { texto: '' },
};
