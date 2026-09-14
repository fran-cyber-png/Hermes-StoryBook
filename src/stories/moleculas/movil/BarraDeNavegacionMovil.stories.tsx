import type { Meta, StoryObj } from '@storybook/react-vite';
import { BarraDeNavegacionMovil } from '../../../features/movil/BarraDeNavegacionMovil';

/**
 * La píldora flotante de abajo en el celular — Mensajes y Pipeline, **solo
 * para campaña**. En el celular no hay riel de vistas, así que hasta esta
 * pieza (ADR 0113) Mensajes era la única pantalla; un comando de campaña
 * trabaja dos cosas desde el teléfono: contestar y ver el embudo.
 *
 * Las vendedoras de la Escuela no la ven — quien la monta decide
 * (`esDeCampana` en `App.tsx`), no este componente.
 *
 * ⚠️ **Flota sobre la lista**: el envoltorio es `absolute` con
 * `pointer-events-none`, así que a los costados de la píldora se sigue
 * pudiendo tocar la lista de atrás. Acá va sobre un fondo con contenido de
 * ejemplo para que eso se note.
 */
const meta = {
  title: 'Moléculas/movil/BarraDeNavegacionMovil',
  component: BarraDeNavegacionMovil,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="relative h-64 overflow-hidden bg-secondary/30">
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-10 rounded-lg bg-card shadow-sm" />
          ))}
        </div>
        <Story />
      </div>
    ),
  ],
  args: { onElegir: () => {} },
} satisfies Meta<typeof BarraDeNavegacionMovil>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EnMensajes: Story = {
  args: { activa: 'bandeja' },
};

export const EnPipeline: Story = {
  args: { activa: 'embudo' },
};

/** Con un chat abierto encima, la barra sale del foco y del lector de pantalla. */
export const Oculta: Story = {
  name: 'Oculta (con un chat encima)',
  args: { activa: 'bandeja', hidden: true },
};
