import type { Meta, StoryObj } from '@storybook/react-vite';
import { BarraFiltros } from '../../../features/canales/BarraFiltros';

/** La barra de filtros de la cola unificada — filtro rápido, categorías, líneas. */
const meta = {
  title: 'Moléculas/canales/BarraFiltros',
  component: BarraFiltros,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof BarraFiltros>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Sin `conteos` ni `catalogo` no hay nada que mostrar: los chips del bot se
 * esconden en cero (regla de la casa, ver el docblock de `BarraFiltros.tsx`)
 * y sin catálogo no hay listas — solo queda «Crear listas». Es el estado
 * correcto, no uno roto.
 */
export const SinFiltros: Story = {
  args: {
    filtroSec: '',
    onFiltro: () => {},
    categoriaActiva: null,
    onCategoria: () => {},
    onListas: () => {},
  },
};

export const ConChipsYListas: Story = {
  name: 'Con chips del bot y listas (uso real)',
  args: {
    filtroSec: 'bot-caliente',
    onFiltro: () => {},
    conteos: { botEscalada: 4, botCaliente: 12 },
    catalogo: [
      { nombre: 'Interesados', color: 'azul', conteo: 38 },
      { nombre: 'Sin responder 48h', color: 'naranja', conteo: 9 },
    ],
    categoriaActiva: 'Interesados',
    onCategoria: () => {},
    onListas: () => {},
  },
};

export const ConLineas: Story = {
  name: 'Con selector de línea (dos líneas vivas)',
  args: {
    filtroSec: '',
    onFiltro: () => {},
    categoriaActiva: null,
    onCategoria: () => {},
    onListas: () => {},
    lineas: [
      { numero: '51963139984', etiqueta: 'Ventas Perú', estado: 'conectada' },
      { numero: '51987654321', etiqueta: 'Ventas Meta', estado: 'conectada' },
    ],
    onLinea: () => {},
    hayMias: true,
  },
};
