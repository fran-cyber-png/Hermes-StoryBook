import type { Meta, StoryObj } from '@storybook/react-vite';
import { BarraFiltros } from '../../../features/canales/BarraFiltros';

/** La barra de filtros de la cola unificada — chips del bot, listas de la vendedora, y el selector de línea. */
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
    onAdministrarCategorias: () => {},
  },
};

export const ConChipsYListas: Story = {
  name: 'Con chips del bot y listas (uso real)',
  args: {
    filtroSec: 'bot-caliente',
    onFiltro: () => {},
    conteos: { botEscalada: 4, botCaliente: 12 },
    /** Las favoritas van primero, y dentro de cada grupo manda `orden` (`categoriasDeLaBarra`). */
    catalogo: [
      { nombre: 'Interesados', color: 'azul', orden: 1, esFavorito: true, conteo: 38 },
      { nombre: 'Sin responder 48h', color: 'naranja', orden: 2, esFavorito: false, conteo: 9 },
    ],
    categoriaActiva: 'Interesados',
    onCategoria: () => {},
    onAdministrarCategorias: () => {},
  },
};

/**
 * El selector de línea recibe las opciones YA RESUELTAS (`opcionesDeLinea` en
 * `alcance.ts`), no la lista cruda: desde el 7-sep-2026 la regla se llama una
 * sola vez arriba, en `ColaUnificada`, para que no puedan divergir. Con menos de
 * dos opciones no se dibuja (`seDibujaElSelector`).
 */
export const ConLineas: Story = {
  name: 'Con selector de línea (dos líneas vivas)',
  args: {
    filtroSec: '',
    onFiltro: () => {},
    categoriaActiva: null,
    onCategoria: () => {},
    onAdministrarCategorias: () => {},
    opciones: [
      { numero: '', etiqueta: 'Todas', titulo: 'Ver todas las líneas juntas' },
      {
        numero: '51963139984',
        etiqueta: 'Ventas Perú',
        titulo: 'Ver solo lo que entró por Ventas Perú (51963139984)',
        transporte: 'cloud-api',
      },
      {
        numero: '51987654321',
        etiqueta: 'Ventas Meta',
        titulo: 'Ver solo lo que entró por Ventas Meta (51987654321)',
        transporte: 'cloud-api',
      },
    ],
    lineaActiva: '',
    onLinea: () => {},
  },
};
