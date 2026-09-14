import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  PastillaRespondido,
  PastillaTieneAbierto,
} from '../../../features/canales/PastillasDelComentario';

/**
 * LAS DOS PASTILLAS DE UN COMENTARIO, EN LA LISTA (ADR 0121).
 *
 * Existen para que no haya que ABRIR un comentario para saber si ya tiene
 * respuesta o si otra agente lo está respondiendo — que es exactamente lo que
 * termina en dos respuestas al mismo comentario cuando varias personas atienden
 * la misma Página.
 *
 * ⚠️ **Verde y azul, nunca dorado**: en Hermes el dorado significa tiempo que se
 * acaba, y ninguno de estos dos hechos apura a nadie.
 *
 * Se dibujan en dos superficies con cajas distintas: `fila` (la cola, cápsula sin
 * borde) y `tarjeta` (el Pipeline, cápsula con borde).
 */
const meta = {
  title: 'Moléculas/canales/PastillasDelComentario',
  component: PastillaRespondido,
  parameters: { layout: 'padded' },
  /**
   * ⚠️ El ancho del envoltorio NO es decoración: `PastillaTieneAbierto` lleva
   * `max-w-[60%]` + `truncate` para no comerse la fila cuando hay varios nombres.
   * Suelta en un canvas sin ancho, el 60 % es de nada y el nombre sale cortado
   * («Lu…») — la historia mostraría un defecto que el componente no tiene. 360 px
   * es el ancho real de la columna de la cola.
   */
  decorators: [
    (Story) => (
      <div className="max-w-[360px] rounded-lg border border-dashed border-border p-3">
        <Story />
      </div>
    ),
  ],
  args: { en: 'fila' },
} satisfies Meta<typeof PastillaRespondido>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Respondido: Story = {
  name: 'Respondido — en la fila de la cola',
};

export const RespondidoEnTarjeta: Story = {
  name: 'Respondido — en la tarjeta del Pipeline (con borde)',
  args: { en: 'tarjeta' },
};

export const LasDosSuperficies: Story = {
  name: 'Las dos cajas, lado a lado',
  render: () => (
    <div className="flex flex-col items-start gap-3 text-sm">
      <span className="flex items-center gap-2">
        <PastillaRespondido en="fila" />
        <span className="text-muted-foreground">en la fila</span>
      </span>
      <span className="flex items-center gap-2">
        <PastillaRespondido en="tarjeta" />
        <span className="text-muted-foreground">en la tarjeta</span>
      </span>
    </div>
  ),
};

/**
 * `PastillaTieneAbierto` lee las presencias de toda la pantalla con una sola
 * consulta (`GET /api/responder/presencias`). Acá se le siembra la respuesta en
 * el caché de react-query en vez de mockear `fetch`: es la misma que devolvería
 * el server, sin la espera ni el estado de carga.
 */
function ConPresencias({
  presencias,
  children,
}: {
  presencias: Record<string, { quien: string; nombre: string | null; desde: string }[]>;
  children: React.ReactNode;
}) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  cliente.setQueryData(['responder', 'presencias'], presencias);
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}

const AHORA = new Date().toISOString();

export const UnaPersonaLoTieneAbierto: Story = {
  name: 'Lo tiene abierto — una persona',
  render: () => (
    <ConPresencias presencias={{ '4821': [{ quien: 'luz', nombre: 'Luz', desde: AHORA }] }}>
      <PastillaTieneAbierto interactionId={4821} en="fila" />
    </ConPresencias>
  ),
};

export const VariasPersonas: Story = {
  name: 'Lo tienen abierto — varias personas',
  render: () => (
    <ConPresencias
      presencias={{
        '4821': [
          { quien: 'luz', nombre: 'Luz', desde: AHORA },
          { quien: 'ventas10', nombre: 'Karina', desde: AHORA },
        ],
      }}
    >
      <PastillaTieneAbierto interactionId={4821} en="tarjeta" />
    </ConPresencias>
  ),
};

/** Sin nadie adentro no se dibuja nada — el hueco es la respuesta correcta. */
export const NadieLoTieneAbierto: Story = {
  name: 'Nadie lo tiene abierto (no dibuja nada)',
  render: () => (
    <ConPresencias presencias={{}}>
      <span className="text-sm text-muted-foreground">
        [acá iría la pastilla, y no se dibuja a propósito]
        <PastillaTieneAbierto interactionId={4821} en="fila" />
      </span>
    </ConPresencias>
  ),
};
