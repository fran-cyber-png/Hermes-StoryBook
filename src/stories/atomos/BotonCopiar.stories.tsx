import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { BotonCopiar } from '../../features/productos/BotonCopiar';

/**
 * Copiar un texto para pegarlo en el chat — el gesto de toda la vista Productos.
 *
 * **Copiar no es enviar**: la vendedora lo pega, lo lee y lo manda ella. Por eso
 * Productos no tiene un «Mandar» — medido, la vista se abre unas 4 veces al día
 * y no sale ni un envío de ahí: es una vista de CONSULTA.
 *
 * ⚠️ «Copiado» se dice **sólo si el portapapeles aceptó**. Sin permiso,
 * `writeText` rechaza y el botón no cambia: decir «Copiado» sin haberlo hecho es
 * peor que no decir nada.
 */
const meta = {
  title: 'Átomos/BotonCopiar',
  component: BotonCopiar,
  parameters: { layout: 'centered' },
  args: { texto: 'Diplomado en Inteligencia — S/ 1,200. Inicia el 3 de octubre.', rotulo: 'Copiar' },
} satisfies Meta<typeof BotonCopiar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Secundario: Story = {
  name: 'Secundario (la tarjeta y los datos por país)',
};

/** La ÚNICA acción primaria de la pantalla, en la hoja del producto. */
export const Principal: Story = {
  args: { principal: true, rotulo: 'Copiar precio para el chat' },
};

export const ConDescripcion: Story = {
  name: 'Con descripción para lectores de pantalla',
  args: { rotulo: 'Copiar', descripcion: 'Copiar el precio del Diplomado en Inteligencia' },
};

/**
 * Cambia el `navigator.clipboard` por uno controlado y lo devuelve al terminar.
 * Sin esto las dos pruebas de abajo dependerían del permiso de portapapeles del
 * navegador que las corra, que en headless no está dado — y el resultado diría
 * más del entorno que del componente.
 */
async function conPortapapeles(acepta: boolean, prueba: () => Promise<void>) {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async () => { if (!acepta) throw new Error('sin permiso'); } },
  });
  try {
    await prueba();
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else delete (navigator as { clipboard?: unknown }).clipboard;
  }
}

/** Con el portapapeles aceptando: pasa a «Copiado» con el check en verde. */
export const AlCopiar: Story = {
  name: 'Al copiar (prueba de interacción)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await conPortapapeles(true, async () => {
      const boton = canvas.getByRole('button');
      await expect(boton).toHaveTextContent('Copiar');
      await userEvent.click(boton);
      await expect(canvas.getByRole('button')).toHaveTextContent('Copiado');
    });
  },
};

/**
 * 🔴 **La regla que de verdad importa**: sin permiso de portapapeles, `writeText`
 * rechaza y el botón **no dice «Copiado»**. Decirlo sin haber copiado es peor que
 * no decir nada — la vendedora pegaría lo que tenía de antes sin enterarse.
 *
 * La primera versión de esta historia asumía el caso feliz y falló en el
 * navegador de pruebas, donde el permiso no está dado. El componente estaba bien;
 * la prueba estaba mal.
 */
export const SinPermisoNoMiente: Story = {
  name: 'Sin permiso no miente (prueba de interacción)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await conPortapapeles(false, async () => {
      const boton = canvas.getByRole('button');
      await userEvent.click(boton);
      await expect(canvas.getByRole('button')).toHaveTextContent('Copiar');
    });
  },
};
