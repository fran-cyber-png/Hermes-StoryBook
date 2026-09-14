// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, tocar, type Montado } from './pruebas/dom';
import { simularPantalla, type PantallaSimulada } from './pruebas/pantalla';
import App from './App';

/**
 * LA FLECHA DE VOLVER, DE PUNTA A PUNTA — el shell, el chat REAL y el historial.
 *
 * `App.movil.test.tsx` reemplaza `ConversacionActiva` por uno de mentira para
 * fijar lo que el shell promete (pasar `onVolver`, alternar lista y chat), y
 * `canales/volverEnCelular.test.tsx` fija lo que promete el hilo (con `onVolver`
 * dibuja la flecha). Cada uno pasa con el cable del otro cortado: es el agujero
 * del candado #11 de CLAUDE.md —«un test de regla no reemplaza uno de
 * cableado»—. Acá no se reemplaza nada: se toca la fila, se espera la flecha que
 * dibuja la cabecera del chat de verdad, se toca, y se mira dónde quedaron la
 * lista y el historial.
 *
 * Solo tiene sentido con las dos mitades juntas (shell de celular + hilo de
 * celular); por eso vive en la rama que las junta.
 */

const AHORA = new Date().toISOString();
const LINEA = '51970356062';

const CONVERSACIONES = [
  ['51933330003', 'Rosa Quispe', 'Hola, ¿cuánto cuesta el diplomado?'],
  ['51955443322', 'Carlos Huamán', 'Ya hice el pago, les mando el voucher'],
].map(([telefono, nombre, texto]) => ({
  clave: `conv:whatsapp:${telefono}:${LINEA}`,
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: telefono,
  persona_nombre: nombre,
  numero_propio: LINEA,
  texto,
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: AHORA,
  ultimo_at: AHORA,
  dias: 0,
  nivel: 3,
}));

function tokenVivo(id = 'ana'): string {
  const cuerpo = btoa(`${id}|${Date.now() + 60 * 60 * 1000}`)
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${cuerpo}.firma-que-nadie-mira-acá`;
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

let montado: Montado | null = null;
let pantalla: PantallaSimulada | null = null;

beforeEach(() => {
  localStorage.setItem('hermes.token', tokenVivo());
  history.replaceState(null, '', window.location.pathname);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: unknown) => {
      const url = String(entrada);
      if (url.includes('/api/auth/yo')) return json({ vendedora: { id: 'ana', nombre: 'Ana Lucía' }, cerberus: true });
      if (url.includes('/api/conversaciones?') || url.endsWith('/api/conversaciones')) {
        return json({ conversaciones: CONVERSACIONES, total: CONVERSACIONES.length, hayMas: false });
      }
      if (url.includes('/api/whatsapp/conversacion/')) {
        return json({
          telefono: '51933330003',
          origen: null,
          mensajes: [
            { id: 1, direccion: 'entrante', autor: 'contacto', texto: 'Hola', occurred_at: AHORA, external_id: 'w1' },
          ],
        });
      }
      return json({ ok: false, message: 'el test no levanta server' }, 503);
    }),
  );
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  pantalla?.restaurar();
  pantalla = null;
  vi.unstubAllGlobals();
  localStorage.clear();
});

const lista = () => document.querySelector<HTMLElement>('[data-scroll-cola]');
const filaDe = (nombre: string) =>
  [...(lista()?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.includes(nombre));
const columnaDelChat = () => lista()?.closest('main')?.nextElementSibling as HTMLElement | null;
const flecha = () => document.querySelector<HTMLButtonElement>('button[aria-label="Volver a la lista"]');

async function abrirAppA(ancho: number) {
  pantalla = simularPantalla(ancho);
  montado = montar(<App />);
  await reposar();
  await esperarA(() => filaDe('Rosa Quispe') != null, 'que la cola traiga a Rosa');
}

describe('la flecha de volver, de punta a punta', () => {
  it('en el celular, el chat real dibuja la flecha y tocarla vuelve a la lista consumiendo la entrada', async () => {
    await abrirAppA(390);
    const antesDelChat = history.state;
    lista()!.scrollTop = 180;

    tocar(filaDe('Rosa Quispe')!);
    await esperarA(() => flecha() != null, 'que la cabecera del chat dibuje la flecha');

    tocar(flecha()!);
    await esperarA(() => columnaDelChat()?.hidden === true, 'que la flecha cierre el chat');

    expect(lista()?.closest('main')?.hasAttribute('inert')).toBe(false);
    expect(lista()!.scrollTop).toBe(180);
    expect(history.state).toEqual(antesDelChat);
  });

  it('en escritorio, el mismo chat no dibuja flecha', async () => {
    history.replaceState(null, '', `${window.location.pathname}?vista=bandeja`);
    await abrirAppA(1280);

    tocar(filaDe('Rosa Quispe')!);
    await esperarA(
      () => (columnaDelChat()?.textContent ?? '').includes('Rosa Quispe'),
      'que se abra el chat de Rosa',
    );

    expect(flecha()).toBeNull();
  });
});
