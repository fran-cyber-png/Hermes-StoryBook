import type { Meta, StoryObj } from '@storybook/react-vite';
import YaRespondido from '../../../features/canales/YaRespondido';
import type { EstadoDeRespuesta } from '../../../features/canales/respuestaUnica';

/**
 * LO QUE EL COMENTARIO YA TIENE, Y QUIÉN MÁS ESTÁ EN ÉL (ADR 0121).
 *
 * Va arriba de las cajas de respuesta, para leerse ANTES de escribir. Nació de un
 * caso real: un comentario recibió **cuatro respuestas** porque cada agente que lo
 * abría veía la caja vacía y asumía que nadie lo había contestado.
 *
 * Son dos avisos distintos, y la diferencia importa:
 *
 * · **Quién más lo tiene abierto** (azul) — es lo que evita escribir en vano.
 *   Todavía nadie respondió; alguien está por hacerlo.
 * · **Las respuestas que ya tiene** (verde) — con quién, cuándo y qué dijo. Ahí
 *   las cajas no se muestran hasta que la agente elige «Responder otra vez».
 *
 * ⚠️ **Sin dorado**: el dorado es tiempo que se acaba, y esto no apura a nadie.
 */
const meta = {
  title: 'Organismos/canales/YaRespondido',
  component: YaRespondido,
  parameters: { layout: 'padded' },
  args: { red: 'Facebook', otraVez: false, onResponderOtraVez: () => {} },
} satisfies Meta<typeof YaRespondido>;

export default meta;
type Story = StoryObj<typeof meta>;

const haceRato = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();

const estado = (e: Partial<EstadoDeRespuesta>): EstadoDeRespuesta => ({
  respuestas: [],
  respondiendo: [],
  ...e,
});

/** El caso que este componente existe para evitar: alguien más ya está escribiendo. */
export const AlguienLoEstaRespondiendo: Story = {
  name: 'Alguien lo está respondiendo ahora (nadie respondió todavía)',
  args: {
    estado: estado({ respondiendo: [{ quien: 'luz', nombre: 'Luz', desde: haceRato(1) }] }),
  },
};

export const VariasLoTienenAbierto: Story = {
  name: 'Varias lo tienen abierto',
  args: {
    estado: estado({
      respondiendo: [
        { quien: 'luz', nombre: 'Luz', desde: haceRato(1) },
        { quien: 'ventas10', nombre: 'Karina', desde: haceRato(3) },
      ],
    }),
  },
};

export const UnaRespuesta: Story = {
  name: 'Ya tiene una respuesta (desde Hermes)',
  args: {
    estado: estado({
      respuestas: [
        {
          origen: 'hermes',
          cuando: haceRato(40),
          quien: 'luz',
          nombre: 'Luz',
          texto: '¡Hola! Te escribimos por privado con toda la información 📩',
          conPrivado: true,
        },
      ],
    }),
  },
};

/**
 * La Página contestó por fuera de Hermes (Business Suite, el celular). Se dice
 * «Desde Facebook» porque no hay a quién atribuirlo: el `quien` viene en `null`.
 */
export const RespondidoDesdeFacebook: Story = {
  name: 'Respondido desde Facebook (fuera de Hermes)',
  args: {
    estado: estado({
      respuestas: [
        {
          origen: 'facebook',
          cuando: haceRato(120),
          quien: null,
          nombre: null,
          texto: 'Gracias por escribirnos 🙌',
          conPrivado: false,
        },
      ],
    }),
  },
};

/** El caso que dio origen al componente: el comentario que juntó varias respuestas. */
export const VariasRespuestas: Story = {
  name: 'Varias respuestas (el caso que originó esto)',
  args: {
    estado: estado({
      respuestas: [
        {
          origen: 'hermes',
          cuando: haceRato(180),
          quien: 'luz',
          nombre: 'Luz',
          texto: 'Hola, te mandamos la info por privado.',
          conPrivado: true,
        },
        {
          origen: 'hermes',
          cuando: haceRato(95),
          quien: 'ventas10',
          nombre: 'Karina',
          texto: 'Con gusto, revisá tu Messenger 📩',
          conPrivado: true,
        },
        { origen: 'facebook', cuando: haceRato(20), quien: null, nombre: null, texto: 'Ya te respondimos 🙌', conPrivado: false },
      ],
      respondiendo: [{ quien: 'ventas7', nombre: 'Andrea', desde: haceRato(1) }],
    }),
  },
};

/** Solo salió el privado: no hay nada publicado que mostrar, y se dice. */
export const SoloPorPrivado: Story = {
  args: {
    estado: estado({
      respuestas: [
        { origen: 'hermes', cuando: haceRato(15), quien: 'luz', nombre: 'Luz', texto: null, conPrivado: true },
      ],
    }),
  },
};

/**
 * 📱 En el celular la lista arranca plegada, con la última respuesta en un
 * renglón: en 390 px la lista entera empujaba las cajas fuera de la pantalla.
 */
export const Plegable: Story = {
  name: 'Plegable (celular)',
  args: {
    plegable: true,
    sinPresencia: true,
    estado: estado({
      respuestas: [
        { origen: 'hermes', cuando: haceRato(180), quien: 'luz', nombre: 'Luz', texto: 'Te mandamos la info por privado.', conPrivado: true },
        { origen: 'hermes', cuando: haceRato(95), quien: 'ventas10', nombre: 'Karina', texto: 'Revisá tu Messenger 📩', conPrivado: true },
      ],
    }),
  },
};

/** Ya eligió responder otra vez: las cajas están abiertas y el botón sobra. */
export const YaEligioResponderOtraVez: Story = {
  name: 'Ya eligió «Responder otra vez» (sin botón)',
  args: {
    otraVez: true,
    estado: estado({
      respuestas: [
        { origen: 'hermes', cuando: haceRato(40), quien: 'luz', nombre: 'Luz', texto: 'Te escribimos por privado 📩', conPrivado: true },
      ],
    }),
  },
};
