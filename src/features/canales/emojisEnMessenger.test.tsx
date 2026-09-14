// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { esperarA, escribir, montar, reposar, teclear, tocar, type Montado } from '../../pruebas/dom';
import { simularPantalla, type PantallaSimulada } from '../../pruebas/pantalla';
import { HiloMessenger } from './HiloMessenger';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * EL SELECTOR DE EMOJIS EN EL REDACTOR DE MESSENGER — el CABLEADO (ADR 0126, #1083).
 *
 * Mismo panel de mentira y por lo mismo que `whatsapp/emojisEnComposer.test.tsx`: la lista
 * virtualizada de `frimousse` no pinta filas en jsdom. Lo que se prueba es lo del redactor.
 */
vi.mock('../../components/SelectorDeEmojis', () => ({
  SelectorDeEmojis: ({ onElegir }: { onElegir: (emoji: string) => void }) => (
    <div role="dialog" aria-label="Elegir un emoji">
      <button type="button" onClick={() => onElegir('🙏')}>
        🙏
      </button>
    </div>
  ),
}));

const conversacion = {
  clave: 'conv:facebook:27797148129984063:',
  canal: 'facebook',
  tipo: 'mensaje',
  persona_id: '27797148129984063',
  persona_nombre: 'Rocío Janet Herrera',
  numero_propio: null,
  texto: 'Hola',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: '2026-09-14T15:09:56Z',
  ultimo_at: '2026-09-14T15:09:56Z',
  dias: 0,
  nivel: 5,
} as Conversacion;

const HILO = {
  historial: [{ id: 1, direccion: 'entrante', autor: 'persona', texto: 'Hola, ¿cuándo llegan?', occurred_at: '2026-09-14T15:09:56Z' }],
  nombre: 'Rocío Janet Herrera',
  total: 1,
  ventana: { puede: true, restanteMs: 3_600_000, explicacion: 'Puedes escribirle por 1 h 0 min más.' },
};

let vista: Montado | null = null;
let pantalla: PantallaSimulada | null = null;
let enviados: Record<string, unknown>[] = [];

function servidor() {
  enviados = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const json = (c: unknown) => new Response(JSON.stringify(c), { headers: { 'content-type': 'application/json' } });
      if ((init?.method ?? 'GET') === 'POST') {
        enviados.push(JSON.parse(String(init?.body ?? '{}')));
        return json({ ok: true });
      }
      return json(HILO);
    }),
  );
}

afterEach(() => {
  vista?.desmontar();
  vista = null;
  pantalla?.restaurar();
  pantalla = null;
  vi.unstubAllGlobals();
});

const redactor = () => vista?.contenedor.querySelector('textarea') as HTMLTextAreaElement | null;
const botonEmojis = () => vista?.contenedor.querySelector<HTMLButtonElement>('button[aria-label="Emojis"]') ?? null;
const panel = () => vista?.contenedor.querySelector('[aria-label="Elegir un emoji"]') ?? null;

async function abrir() {
  servidor();
  vista = montar(<HiloMessenger conversacion={conversacion} />);
  await esperarA(() => redactor() !== null, 'el redactor abierto');
}

async function elegirEmoji() {
  tocar(botonEmojis()!);
  await esperarA(() => panel() !== null, 'el panel de emojis abierto');
  tocar([...panel()!.querySelectorAll('button')].find((b) => b.textContent === '🙏')!);
  await reposar();
}

describe('el selector de emojis en Messenger', () => {
  test('elegir mete el emoji donde está el cursor, devuelve el foco y deja el panel abierto', async () => {
    await abrir();
    escribir(redactor()!, 'muchas  gracias');
    redactor()!.setSelectionRange(7, 7);

    await elegirEmoji();

    expect(redactor()!.value).toBe('muchas 🙏 gracias');
    expect(document.activeElement).toBe(redactor());
    expect(panel()).not.toBeNull();
  });

  test('Enter manda el emoji tal cual, y al mandar el panel se cierra', async () => {
    await abrir();
    escribir(redactor()!, 'gracias ');
    redactor()!.setSelectionRange(8, 8);
    await elegirEmoji();

    teclear('Enter', { target: redactor()! });
    await esperarA(() => enviados.length === 1, 'el envío');
    expect(enviados[0].texto).toBe('gracias 🙏');
    expect(panel()).toBeNull();
  });

  test('Escape con el foco en la caja cierra el panel', async () => {
    await abrir();
    await elegirEmoji();
    teclear('Escape', { target: redactor()! });
    await reposar();
    expect(panel()).toBeNull();
  });

  test('en el celular no hay botón', async () => {
    pantalla = simularPantalla(390);
    await abrir();
    expect(botonEmojis()).toBeNull();
  });
});
