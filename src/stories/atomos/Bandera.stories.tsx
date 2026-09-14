import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bandera } from '../../components/Bandera';

/**
 * La bandera del país de un contacto — SVG, **nunca un emoji**: en WebView2 (la
 * cáscara Tauri donde corre casi todo el equipo) 🇵🇪 sale como las letras «PE».
 *
 * El dibujo se carga perezoso (`BanderaDibujo.tsx`, fuera del chunk de arranque):
 * mientras llega se reserva el mismo rectángulo, así el nombre del país no salta.
 * Por eso al abrir esta historia puede verse un instante el rectángulo gris.
 */
const meta = {
  title: 'Átomos/Bandera',
  component: Bandera,
  parameters: { layout: 'centered' },
  args: { iso: 'PE', nombre: 'Perú' },
} satisfies Meta<typeof Bandera>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Peru: Story = {};

const PAISES = [
  { iso: 'PE', nombre: 'Perú' },
  { iso: 'MX', nombre: 'México' },
  { iso: 'CO', nombre: 'Colombia' },
  { iso: 'AR', nombre: 'Argentina' },
  { iso: 'CL', nombre: 'Chile' },
  { iso: 'EC', nombre: 'Ecuador' },
  { iso: 'ES', nombre: 'España' },
  { iso: 'US', nombre: 'Estados Unidos' },
];

export const Catalogo: Story = {
  name: 'Las que existen (solo las de dominio/pais.ts)',
  render: () => (
    <ul className="flex list-none flex-col gap-2 text-sm">
      {PAISES.map((p) => (
        <li key={p.iso} className="flex items-center gap-2">
          <Bandera iso={p.iso} nombre={p.nombre} />
          <span className="text-foreground">{p.nombre}</span>
          <code className="text-xs text-muted-foreground">{p.iso}</code>
        </li>
      ))}
    </ul>
  ),
};

/**
 * Un país que no está en el catálogo **no dibuja nada** — nunca una bandera
 * equivocada. Acá se ve el hueco, que es la respuesta correcta.
 */
export const SinBandera: Story = {
  name: 'ISO desconocido (no dibuja nada, a propósito)',
  render: () => (
    <div className="flex items-center gap-2 text-sm">
      <Bandera iso="JP" nombre="Japón" />
      <span className="text-muted-foreground">Japón — sin dibujo, el hueco es correcto</span>
    </div>
  ),
};
