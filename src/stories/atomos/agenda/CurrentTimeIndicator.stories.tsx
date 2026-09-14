import type { Meta, StoryObj } from '@storybook/react-vite';
import { CurrentTimeIndicator } from '../../../features/agenda/components/CurrentTimeIndicator';

/**
 * LA LÍNEA DEL AHORA en la agenda — el punto y la raya dorados que cruzan la
 * grilla a la altura de la hora actual.
 *
 * Es uno de los pocos lugares donde el dorado está bien puesto: marca **tiempo**,
 * que es exactamente lo que el token significa en Hermes.
 *
 * ⚠️ Se posiciona en `absolute` contra la grilla (60 px por hora, más 3rem de
 * cabecera), así que sin un contenedor `relative` con alto no se ve. El
 * decorador de abajo es esa grilla — sin él la historia mostraría una línea
 * pegada arriba de todo, que no es como vive.
 */
const meta = {
  title: 'Átomos/agenda/CurrentTimeIndicator',
  component: CurrentTimeIndicator,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="relative h-64 overflow-hidden rounded-xl border border-border bg-card">
        <div className="h-12 border-b border-border bg-muted/40" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[60px] border-b border-border/20" />
        ))}
        <Story />
      </div>
    ),
  ],
  args: { horaActual: 1, minutoActual: 30 },
} satisfies Meta<typeof CurrentTimeIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AlaMedia: Story = {
  name: 'A la media (cae en el medio de la hora)',
};

export const EnPunto: Story = {
  name: 'En punto (pegada a la línea de la hora)',
  args: { horaActual: 2, minutoActual: 0 },
};

export const CasiLaSiguiente: Story = {
  name: 'Faltando 5 minutos',
  args: { horaActual: 2, minutoActual: 55 },
};
