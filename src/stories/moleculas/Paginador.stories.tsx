import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Paginador } from '../../components/Paginador';

/**
 * El pie de página de una tabla (el padrón y la Lista del Pipeline).
 *
 * ⚠️ Recibe **números, no la instancia `Table` de react-table**: ese objeto es
 * referencialmente idéntico entre renders (react-table lo muta in-place), y el
 * React Compiler de este proyecto decidiría que no hay nada que repintar — el
 * síntoma era que la página avanzaba pero el número quedaba pegado.
 */
const meta = {
  title: 'Moléculas/Paginador',
  component: Paginador,
  parameters: { layout: 'padded' },
  args: {
    paginaActual: 1,
    totalPaginas: 12,
    puedeAnterior: false,
    puedeSiguiente: true,
    onAnterior: () => {},
    onSiguiente: () => {},
    onIrA: () => {},
  },
} satisfies Meta<typeof Paginador>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Con estado real, para poder navegar de verdad en el panel. */
function Envoltorio({ total, resumen }: { total: number; resumen?: string }) {
  const [pagina, setPagina] = useState(1);
  return (
    <Paginador
      paginaActual={pagina}
      totalPaginas={total}
      puedeAnterior={pagina > 1}
      puedeSiguiente={pagina < total}
      onAnterior={() => setPagina((p) => Math.max(1, p - 1))}
      onSiguiente={() => setPagina((p) => Math.min(total, p + 1))}
      onIrA={(p) => setPagina(Math.min(Math.max(1, p), total))}
      resumen={resumen}
    />
  );
}

export const Navegable: Story = {
  render: () => <Envoltorio total={12} />,
};

/**
 * Con `resumen` el pie se dibuja **aunque haya una sola página**: cuántos hay no
 * depende de que haya a dónde paginar (ADR 0102).
 */
export const ConResumen: Story = {
  name: 'Con resumen (padrón)',
  render: () => <Envoltorio total={1465} resumen="73.200 contactos · se ven 1–50" />,
};

export const UnaSolaPagina: Story = {
  name: 'Una sola página (sin resumen, casi no se dibuja)',
  render: () => <Envoltorio total={1} />,
};

export const Avanzar: Story = {
  name: 'Avanzar (prueba de interacción)',
  render: () => <Envoltorio total={12} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const siguiente = canvas.getByRole('button', { name: /siguiente/i });
    await userEvent.click(siguiente);
    await expect(canvas.getByRole('button', { name: /anterior/i })).toBeEnabled();
  },
};
