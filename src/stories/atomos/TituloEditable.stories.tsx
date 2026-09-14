import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { TituloEditable } from '../../features/notas/TituloEditable';

/** El título in-place de una página de la Libreta: guarda al perder el foco o con Enter, Escape descarta. */
const meta = {
  title: 'Átomos/TituloEditable',
  component: TituloEditable,
  parameters: { layout: 'centered' },
  /** Las historias usan `Envoltorio` (necesitan estado propio) y no miran estos
   *  args; están para cumplir los obligatorios del tipo y alimentar Controls. */
  args: { valor: 'Estrategia del diplomado', placeholder: 'Sin título', onGuardar: () => {} },
} satisfies Meta<typeof TituloEditable>;

export default meta;
type Story = StoryObj<typeof meta>;

function Envoltorio(props: { valorInicial: string; placeholder: string; autoFocus?: boolean }) {
  const [valor, setValor] = useState(props.valorInicial);
  return <TituloEditable valor={valor} placeholder={props.placeholder} onGuardar={setValor} autoFocus={props.autoFocus} />;
}

export const ConTitulo: Story = {
  render: () => <Envoltorio valorInicial="Estrategia del diplomado" placeholder="Sin título" />,
};

export const Vacio: Story = {
  render: () => <Envoltorio valorInicial="" placeholder="Sin título" />,
};

export const EditarYGuardar: Story = {
  render: () => <Envoltorio valorInicial="Notas de la campaña" placeholder="Sin título" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const campo = canvas.getByRole('textbox');
    await expect(campo).toHaveValue('Notas de la campaña');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Notas del reparto{Enter}');
    await expect(campo).toHaveValue('Notas del reparto');
  },
};
