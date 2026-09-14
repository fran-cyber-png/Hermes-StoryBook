import type { Meta, StoryObj } from '@storybook/react-vite';
import { VisorDeAdjunto } from '../../components/VisorDeAdjunto';
import { imagenDePost } from '../fixtures/imagenComentario';

/**
 * El visor: un adjunto en grande, con Descargar y Cerrar a la vista. Lo usan los
 * hilos de WhatsApp y Messenger y los comentarios de Facebook e Instagram, y no
 * sabe nada de ninguno — recibe qué mostrar y qué hacer al descargar.
 *
 * Abre lo que se puede MIRAR: imagen, video y PDF. El resto de los documentos se
 * descarga directo, porque el navegador no sabe mostrarlos.
 *
 * Se cierra con Escape, con la X o con un clic en el fondo oscuro; un clic
 * SOBRE el adjunto no cierra (en la imagen alterna el tamaño real).
 *
 * ⚠️ Se dibuja en un **portal sobre `body`**: nace dentro de una burbuja, y una
 * burbuja recién llegada entra con una animación de `transform` — un ancestro con
 * `transform` vuelve a `fixed` relativo a ÉL, y el visor quedaría del tamaño de
 * la fila en vez de la pantalla. Por eso en Storybook ocupa todo el canvas.
 */
const meta = {
  title: 'Organismos/VisorDeAdjunto',
  component: VisorDeAdjunto,
  parameters: { layout: 'fullscreen' },
  args: {
    clase: 'imagen',
    src: imagenDePost,
    nombre: 'pieza-de-campaña.png',
    onCerrar: () => {},
  },
} satisfies Meta<typeof VisorDeAdjunto>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Imagen: Story = {
  args: { onDescargar: () => {} },
};

/** Sin `onDescargar` no hay botón: nunca se dibuja una acción que no hace nada. */
export const SinDescarga: Story = {
  name: 'Sin descarga (no se dibuja el botón)',
};

export const Sticker: Story = {
  args: { clase: 'sticker', nombre: 'sticker.webp', onDescargar: () => {} },
};

/**
 * El video y el PDF llegan como `blob:` o como una URL que la etiqueta pueda
 * pedir sin sesión. Acá no hay archivo real: se ve el marco del visor, que es lo
 * que estas dos historias tienen para mostrar.
 *
 * ⚠️ El `src` es un `data:` mínimo y no una cadena vacía: `<video src="">` hace
 * que el navegador vuelva a pedir la página entera, y lo avisa por consola. Lo
 * marcó la suite de vitest en su primera corrida.
 */
const SIN_ARCHIVO_REAL = 'data:application/octet-stream;base64,AAAA';

export const Video: Story = {
  args: { clase: 'video', src: SIN_ARCHIVO_REAL, nombre: 'grabación.mp4', onDescargar: () => {} },
};

export const Documento: Story = {
  name: 'Documento (PDF)',
  args: { clase: 'documento', src: SIN_ARCHIVO_REAL, nombre: 'voucher-de-pago.pdf', onDescargar: () => {} },
};
