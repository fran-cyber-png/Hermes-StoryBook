import type { Meta, StoryObj } from '@storybook/react-vite';
import { FranjaEtiquetas } from '../../features/senales/FranjaEtiquetas';
import { mockFetch } from '../fixtures/mockApi';

/**
 * Lo que esta conversación ES, de un vistazo — dos familias de etiqueta en la
 * misma línea, a propósito: el ojo lee «etiqueta» en las dos, y lo que las
 * distingue es el DIBUJO, no un ícono ni un tooltip.
 *
 * · **automática** (`Cotizado`, `Se enfrió`) — píldora de FONDO tenue. La pone
 *   el hilo, se recalcula sola, no se puede borrar.
 * · **manual** (categorías) — píldora de BORDE de color. La pone la vendedora,
 *   y se edita en la barra de arriba del chat — acá es de solo lectura.
 *
 * Pide tres rutas (`/api/senales`, `/api/categorias`, `/api/gestiones/etiquetas`);
 * se siembran con `mockFetch` en vez de dejarlas fallar, porque el punto de esta
 * historia es mostrar las dos familias juntas.
 */
const CLAVE = 'conv:whatsapp:51943348051:51963139984';

const meta = {
  title: 'Moléculas/FranjaEtiquetas',
  component: FranjaEtiquetas,
  parameters: { layout: 'padded' },
  args: { clave: CLAVE },
} satisfies Meta<typeof FranjaEtiquetas>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LasDosFamilias: Story = {
  name: 'Automática + manual (el caso completo)',
  decorators: [
    (Story) => {
      mockFetch([
        {
          fragmento: '/api/senales',
          cuerpo: {
            umbralDias: 3,
            senales: {
              [CLAVE]: {
                clave: CLAVE,
                etiquetas: [
                  { clave: 'cotizado', rotulo: 'Cotizado', color: 'azul', detalle: 'Se le mandó el precio hace 2 días' },
                ],
                corroborada: true,
                enfriamiento: { enfriada: false, diasDeSilencio: null, motivo: '' },
                cotizacion: null,
              },
            },
          },
        },
        { fragmento: '/api/categorias', cuerpo: { categorias: [], supervisor: false } },
        {
          fragmento: '/api/gestiones/etiquetas',
          cuerpo: { etiquetas: { [CLAVE]: ['Interesados', 'Sin responder 48h'] } },
        },
      ]);
      return <Story />;
    },
  ],
};

export const SoloAutomatica: Story = {
  name: 'Solo automática (se enfrió)',
  decorators: [
    (Story) => {
      mockFetch([
        {
          fragmento: '/api/senales',
          cuerpo: {
            umbralDias: 3,
            senales: {
              [CLAVE]: {
                clave: CLAVE,
                etiquetas: [{ clave: 'enfriado', rotulo: 'Se enfrió', color: 'naranja', detalle: 'Sin respuesta hace 4 días' }],
                corroborada: true,
                enfriamiento: { enfriada: true, diasDeSilencio: 4, motivo: 'silencio' },
                cotizacion: null,
              },
            },
          },
        },
        { fragmento: '/api/categorias', cuerpo: { categorias: [], supervisor: false } },
        { fragmento: '/api/gestiones/etiquetas', cuerpo: { etiquetas: {} } },
      ]);
      return <Story />;
    },
  ],
};

/** Sin ninguna etiqueta de ningún tipo, el componente no dibuja nada — ni un contenedor vacío. */
export const SinEtiquetas: Story = {
  decorators: [
    (Story) => {
      mockFetch([
        { fragmento: '/api/senales', cuerpo: { umbralDias: 3, senales: {} } },
        { fragmento: '/api/categorias', cuerpo: { categorias: [], supervisor: false } },
        { fragmento: '/api/gestiones/etiquetas', cuerpo: { etiquetas: {} } },
      ]);
      return <Story />;
    },
  ],
};
