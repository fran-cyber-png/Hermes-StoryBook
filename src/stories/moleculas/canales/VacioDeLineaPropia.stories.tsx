import type { Meta, StoryObj } from '@storybook/react-vite';
import { VacioDeLineaPropia } from '../../../features/canales/VacioDeLineaPropia';

/** El texto de la cola vacía en el filtro «Las mías». */
const meta = {
  title: 'Moléculas/canales/VacioDeLineaPropia',
  component: VacioDeLineaPropia,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof VacioDeLineaPropia>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDefecto: Story = {};
