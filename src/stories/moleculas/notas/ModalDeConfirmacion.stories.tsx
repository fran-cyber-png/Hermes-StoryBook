import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ModalDeConfirmacion } from '../../../features/notas/ModalDeConfirmacion';

/**
 * Confirmar una acción — reemplaza el `window.confirm` nativo del navegador
 * (reportado con una captura: el diálogo de Chrome decía «localhost:5174
 * dice…», que es justo el problema — no se lee como parte de Hermes).
 *
 * 🔴 **`autoFocus` está en el botón CONFIRMAR, no en Cancelar** — lo encontró
 * la prueba de interacción de esta historia, no una lectura del código. Es la
 * misma clase de falla que `ConfirmarModeracion.tsx` (`features/canales/`)
 * documenta explícitamente por qué evitar: *«un modal que se abre con el botón
 * destructivo enfocado convierte un Enter de inercia —el mismo con el que se
 * venía escribiendo— en un borrado»*. Acá pasa exactamente eso, en la acción de
 * borrar una página. La historia documenta el comportamiento REAL (el foco
 * arranca en la acción), no el que sería correcto — no es tarea de una story
 * corregir el componente que retrata.
 */
const meta = {
  title: 'Moléculas/notas/ModalDeConfirmacion',
  component: ModalDeConfirmacion,
  parameters: { layout: 'fullscreen' },
  args: {
    titulo: '¿Borrar esta página?',
    mensaje: 'Se va a la papelera. Podés recuperarla desde ahí durante 30 días.',
    onConfirmar: () => {},
    onCancelar: () => {},
  },
} satisfies Meta<typeof ModalDeConfirmacion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};

export const Peligroso: Story = {
  name: 'Peligroso (botón rojo, sin vuelta atrás)',
  args: {
    titulo: '¿Eliminar para siempre?',
    mensaje: 'Ya no está en la papelera. Esta acción no se puede deshacer.',
    textoConfirmar: 'Eliminar',
    peligroso: true,
  },
};

export const TextosPersonalizados: Story = {
  name: 'Textos personalizados en los botones',
  args: {
    titulo: '¿Salir sin guardar?',
    mensaje: 'Tenés cambios sin guardar en esta página.',
    textoConfirmar: 'Salir de todos modos',
    textoCancelar: 'Seguir editando',
  },
};

/**
 * 🔴 Este test documenta un defecto, no una regla deseable: el foco arranca en
 * **Confirmar**, y en modo `peligroso` ese botón es el destructivo. Un Enter de
 * inercia justo después de abrir el modal confirma el borrado. Ver el docblock
 * de arriba — es la falla, capturada, para que quede visible.
 */
export const ElFocoArrancaEnLaAccion: Story = {
  name: '🔴 El foco arranca en la acción, no en Cancelar (defecto)',
  args: { peligroso: true, textoConfirmar: 'Eliminar' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const confirmar = canvas.getByRole('button', { name: 'Eliminar' });
    await expect(confirmar).toHaveFocus();
  },
};

/** No basta con que el modal siga en pantalla: hay que confirmar que Escape SÍ avisó a `onCancelar`. */
export const Escape: Story = {
  name: 'Escape llama a onCancelar (prueba de interacción)',
  args: { onCancelar: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alertdialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect(args.onCancelar).toHaveBeenCalledTimes(1);
  },
};

/** El clic afuera (el velo) cancela; el clic adentro del panel no. */
export const ClicAfuera: Story = {
  name: 'Clic en el velo llama a onCancelar (prueba de interacción)',
  args: { onCancelar: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('alertdialog'));
    await expect(args.onCancelar).toHaveBeenCalledTimes(1);
  },
};
