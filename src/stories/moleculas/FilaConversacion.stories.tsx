import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FilaConversacion } from '../../features/canales/FilaConversacion';
import { crearConversacionMock } from '../fixtures/conversacion';

/**
 * La fila de la cola unificada — el elemento que más veces se dibuja en toda
 * la app. `c` es el dominio `Conversacion`; ver `src/stories/fixtures/conversacion.ts`
 * para la fábrica de datos de prueba.
 */
const meta = {
  title: 'Moléculas/FilaConversacion',
  component: FilaConversacion,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FilaConversacion>;

export default meta;
type Story = StoryObj<typeof meta>;

function Envoltorio(props: Partial<React.ComponentProps<typeof FilaConversacion>>) {
  const [seleccionada, setSeleccionada] = useState(false);
  return (
    <div className="max-w-md rounded-lg border border-border bg-card">
      <FilaConversacion
        c={crearConversacionMock()}
        seleccionada={seleccionada}
        onAbrir={() => setSeleccionada((v) => !v)}
        {...props}
      />
    </div>
  );
}

export const SinResponder: Story = {
  name: 'Sin responder (pidió precio)',
  render: () => <Envoltorio />,
};

export const Seleccionada: Story = {
  render: () => <Envoltorio seleccionada c={crearConversacionMock()} />,
};

export const Respondida: Story = {
  render: () => (
    <Envoltorio
      c={crearConversacionMock({
        respondida: true,
        no_leido: false,
        texto: 'Perfecto, te paso el temario por acá.',
        pregunto: false,
        pregunto_precio: false,
        nivel: 5,
      })}
    />
  ),
};

export const Comentario: Story = {
  name: 'Comentario público de Instagram',
  render: () => (
    <Envoltorio
      c={crearConversacionMock({
        clave: 'int:998877',
        canal: 'instagram',
        tipo: 'comentario',
        texto: '¿Este diplomado tiene certificado internacional?',
        n: 1,
      })}
    />
  ),
};

export const Lead: Story = {
  name: 'Lead de formulario (sin conversación todavía)',
  render: () => (
    <Envoltorio
      c={crearConversacionMock({
        clave: 'lead:123',
        canal: 'landing',
        tipo: 'lead',
        texto: null,
        pregunto: false,
        ventana_abierta: false,
        nivel: 0,
      })}
    />
  ),
};

export const VentanaPorVencer: Story = {
  name: 'Ventana de 24h por vencer',
  render: () => (
    <Envoltorio
      c={crearConversacionMock({
        nivel: 2,
        ventana_cierra: new Date(Date.now() + 1000 * 60 * 45).toISOString(),
      })}
    />
  ),
};
