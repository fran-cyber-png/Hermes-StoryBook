import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProximasActividades } from '../../../features/agenda/ProximasActividades';
import type { Recordatorio } from '../../../features/agenda/agenda';

/**
 * «¿Qué sigue?» — el resumen en la columna izquierda, bajo el minicalendario.
 * La grilla contesta «¿qué hay el 18?»; esto contesta la pregunta con la que
 * se abre la agenda.
 *
 * ⚠️ **Vive en una columna de 288px, por eso los grupos se APILAN** (scroll
 * vertical, no lateral): puesto al pie del calendario en fila, el scroll
 * lateral escondía todo menos el primer grupo.
 *
 * El agrupado (Vencidas / Hoy / próximos días) lo calcula `proximas.ts` de
 * verdad — no se simula acá, así que estas historias reflejan exactamente
 * cómo se agrupa en la app real.
 */
const AHORA = new Date();

function haceHoras(h: number): string {
  return new Date(AHORA.getTime() + h * 60 * 60_000).toISOString();
}

const base = {
  canal: 'whatsapp',
  numeroPropio: '51963139984',
  estado: 'pendiente' as const,
};

const meta = {
  title: 'Moléculas/agenda/ProximasActividades',
  component: ProximasActividades,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="h-96 w-72">
        <Story />
      </div>
    ),
  ],
  args: { ahora: AHORA, onVer: () => {} },
} satisfies Meta<typeof ProximasActividades>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SinNadaPendiente: Story = {
  name: 'Sin nada pendiente (día despachado)',
  args: { recordatorios: [] },
};

export const HoyYManana: Story = {
  name: 'Hoy y mañana, con una vencida',
  args: {
    recordatorios: [
      { id: 1, clave: 'c1', ...base, personaId: '51943348051', personaNombre: 'Andrea Quispe', nota: 'Llamar para cerrar', cuando: haceHoras(-3), importancia: 'alta' },
      { id: 2, clave: 'c2', ...base, personaId: '51987654321', personaNombre: 'Julián Loyola', nota: 'Enviar el temario', cuando: haceHoras(2) },
      { id: 3, clave: 'c3', ...base, personaId: null, personaNombre: null, nota: 'Seguimiento sin conversación atada', cuando: haceHoras(28) },
    ] satisfies Recordatorio[],
  },
};

/** Con más de las 12 que muestra de golpe: dice «+N más adelante». */
export const MuchasPendientes: Story = {
  name: 'Más de las que caben (+N más adelante)',
  args: {
    recordatorios: Array.from({ length: 18 }, (_, i) => ({
      id: i + 1,
      clave: `c${i}`,
      ...base,
      personaId: '51943348051',
      personaNombre: `Contacto ${i + 1}`,
      nota: `Seguimiento ${i + 1}`,
      cuando: haceHoras(i * 6),
    })) satisfies Recordatorio[],
  },
};
