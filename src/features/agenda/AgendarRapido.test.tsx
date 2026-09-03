// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { montar, reposar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { AgendarRapido } from './AgendarRapido';

/**
 * EL CABLEADO DE `senalAbrir` — lo que ningún test puro puede ver.
 *
 * Mismo motivo que `RegistrarEvento.test.tsx`: `senalAbrir` es lo que el
 * atajo `A` del shell (`App.tsx`) dispara con una conversación abierta en
 * Mensajes, y una regresión ahí solo se ve montando.
 */

const CONVERSACION: Conversacion = {
  clave: 'conv:whatsapp:51984429504:51955950559',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51955950559',
  persona_nombre: 'Jorge Martin',
  numero_propio: '51984429504',
  texto: null,
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: '2026-08-18T16:09:00.000Z',
  ultimo_at: '2026-08-18T16:09:00.000Z',
  dias: 0,
  nivel: 5,
};

let montado: Montado | null = null;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 503 })),
  );
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
});

function estaAbierto(m: Montado): boolean {
  return m.contenedor.textContent?.includes('Cae en tu Agenda') ?? false;
}

describe('el popover de Agendar', () => {
  test('nace cerrado y abre con su propio disparador', async () => {
    montado = montar(<AgendarRapido conversacion={CONVERSACION} />);
    await reposar();
    expect(estaAbierto(montado)).toBe(false);

    montado.contenedor.querySelector<HTMLButtonElement>('button[title="Agendar seguimiento (A)"]')?.click();
    await reposar();
    expect(estaAbierto(montado)).toBe(true);
  });

  test('🔴 `senalAbrir` abre el popover — es lo que el atajo `A` dispara desde el shell', async () => {
    montado = montar(<AgendarRapido conversacion={CONVERSACION} senalAbrir={0} />);
    await reposar();
    expect(estaAbierto(montado)).toBe(false);

    montado.repintar(<AgendarRapido conversacion={CONVERSACION} senalAbrir={1} />);
    await reposar();
    expect(estaAbierto(montado)).toBe(true);
  });

  test('una segunda señal reabre aunque ya se haya cerrado a mano', async () => {
    montado = montar(<AgendarRapido conversacion={CONVERSACION} senalAbrir={0} />);
    await reposar();
    montado.repintar(<AgendarRapido conversacion={CONVERSACION} senalAbrir={1} />);
    await reposar();
    expect(estaAbierto(montado)).toBe(true);

    // Cerrarlo a mano, con el mismo disparador (toggle).
    montado.contenedor.querySelector<HTMLButtonElement>('button[title="Agendar seguimiento (A)"]')?.click();
    await reposar();
    expect(estaAbierto(montado)).toBe(false);

    montado.repintar(<AgendarRapido conversacion={CONVERSACION} senalAbrir={2} />);
    await reposar();
    expect(estaAbierto(montado)).toBe(true);
  });
});
