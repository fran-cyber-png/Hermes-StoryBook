import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { FiltroFaceta } from '../../features/padron/FiltroFaceta';
import type { OpcionFaceta } from '../../dominio/segmentosPadron';

const PAISES: OpcionFaceta[] = [
  { valor: 'Perú', contactos: 41230 },
  { valor: 'Colombia', contactos: 8120 },
  { valor: 'México', contactos: 6410 },
  { valor: 'Argentina', contactos: 3980 },
  { valor: 'Chile', contactos: 2210 },
  { valor: 'Honduras', contactos: 340 },
];

/** El desplegable de facetas del padrón: cada opción con su conteo, elegido primero en la lista. */
const meta = {
  title: 'Moléculas/FiltroFaceta',
  component: FiltroFaceta,
  parameters: { layout: 'centered' },
  args: { rotulo: 'País', opciones: PAISES, elegidos: [], cargando: false, onAlternar: () => {}, onLimpiar: () => {} },
} satisfies Meta<typeof FiltroFaceta>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinElegir: Story = {};

export const ConElegidos: Story = { args: { elegidos: ['Perú', 'Colombia'] } };

export const Cargando: Story = { args: { opciones: [], cargando: true } };

export const AbrirYBuscar: Story = {
  render: (args) => {
    function Envoltorio() {
      const [elegidos, setElegidos] = useState<string[]>([]);
      return (
        <FiltroFaceta
          {...args}
          elegidos={elegidos}
          onAlternar={(v) => setElegidos((xs) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]))}
          onLimpiar={() => setElegidos([])}
        />
      );
    }
    return <Envoltorio />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boton = canvas.getByRole('button', { name: /País/ });
    await userEvent.click(boton);
    const opcion = await canvas.findByText('Perú');
    await userEvent.click(opcion);
    await expect(canvas.getByText('1')).toBeInTheDocument();
  },
};
