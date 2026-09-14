import type { Meta, StoryObj } from '@storybook/react-vite';
import { TiraDeChips } from '../../../features/vistas/TiraDeChips';

/**
 * Una fila de chips que se corre de lado, con un desvanecido en el borde que
 * tiene más contenido — así un chip detrás de un scroll invisible no se pierde
 * sin que nadie se entere.
 *
 * Es la cicatriz de la barra de filtros de la cola: el chip de la deuda quedó
 * detrás de un scroll que no se veía. Acá el borde se desvanece justo para que
 * eso no pueda repetirse en silencio.
 */
function Chip({ children }: { children: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground">
      {children}
    </span>
  );
}

const meta = {
  title: 'Moléculas/vistas/TiraDeChips',
  component: TiraDeChips,
  parameters: { layout: 'padded' },
  /** Las historias arman su propio `render` con chips reales; esto sólo cumple
   *  el obligatorio del tipo y alimenta Controls. */
  args: { children: <span className="text-xs text-muted-foreground">chip</span> },
  decorators: [
    (Story) => (
      <div className="w-64 rounded-xl border border-dashed border-border bg-secondary/50 p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TiraDeChips>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Todos entran: sin desborde, no hay nada que desvanecer. */
export const SinDesborde: Story = {
  name: 'Sin desborde (todos entran)',
  render: () => (
    <TiraDeChips>
      <Chip>En ventana</Chip>
      <Chip>Cotizado</Chip>
    </TiraDeChips>
  ),
};

/**
 * El caso real que la justifica: «Saben el precio» a 1280px, con En ventana
 * (455) · Para seguir (764) · Se callaron (2.383) sin entrar en los ~217px de
 * la columna. El borde derecho se desvanece — pasá el mouse y arrastrá para
 * ver los que faltan.
 */
export const ConDesborde: Story = {
  name: 'Con desborde (borde desvanecido)',
  render: () => (
    <TiraDeChips>
      <Chip>En ventana · 455</Chip>
      <Chip>Para seguir · 764</Chip>
      <Chip>Se callaron · 2.383</Chip>
      <Chip>Cotizado · 128</Chip>
      <Chip>Sin responder · 40</Chip>
    </TiraDeChips>
  ),
};
