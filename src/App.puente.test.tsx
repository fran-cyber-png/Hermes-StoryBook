// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, teclear, type Montado } from './pruebas/dom';
import App from './App';

/**
 * EL PUENTE DEL DASHBOARD AL PIPELINE, CABLEADO EN EL SHELL (ADR 0104).
 *
 * Qué recorte lleva cada cifra lo fija `features/dashboard/hoy.test.ts`; que el número
 * que se dibuja lo dispare, `PanelHoy.test.tsx`; cómo lo aplica el Pipeline,
 * `features/vistas/VistaEmbudo.test.tsx`. Lo que ninguno de los tres ve es el tramo del
 * medio, que vive en `App.tsx`: guardar el puente, cambiar a la vista del Pipeline,
 * pasárselo como `recorteInicial` y soltarlo cuando la vista avisa que lo usó. Un cable
 * olvidado ahí deja las tres pruebas en verde y todas las cifras de «Hoy» abriendo el
 * Pipeline sin recorte (ADR 0024: el defecto suele estar en quién llama a la regla).
 *
 * Las dos vistas se reemplazan por dobles que exponen sus props: lo que se prueba es el
 * shell, no las pantallas. El server contesta 503 a todo menos `/api/auth/yo`, igual que
 * en `App.test.tsx`, y por el mismo motivo.
 */

const { PUENTE } = vi.hoisted(() => ({
  PUENTE: { tipo: 'pipeline', recorte: { sinRespuesta24h: true }, canal: 'facebook' } as const,
}));

vi.mock('./features/dashboard/VistaDashboard', () => ({
  VistaDashboard: ({ onAbrirPipeline }: { onAbrirPipeline: (p: typeof PUENTE) => void }) => (
    <button type="button" data-doble="dashboard" onClick={() => onAbrirPipeline(PUENTE)}>
      una cifra de «Hoy»
    </button>
  ),
}));

vi.mock('./features/vistas/VistaEmbudo', () => ({
  VistaEmbudo: ({ recorteInicial, onConsumido }: { recorteInicial?: unknown; onConsumido?: () => void }) => (
    <div data-doble="pipeline">
      <output data-recorte>{JSON.stringify(recorteInicial ?? null)}</output>
      <button type="button" data-doble="consumido" onClick={() => onConsumido?.()}>
        ya lo usé
      </button>
    </div>
  ),
}));

let montado: Montado | null = null;

/** Un token que `quienDiceSer` acepta sin server: `<id>|<vencimiento>` en base64url (el de `App.test.tsx`). */
function tokenVivo(id = 'ana'): string {
  const cuerpo = btoa(`${id}|${Date.now() + 60 * 60 * 1000}`)
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${cuerpo}.firma-que-nadie-mira-acá`;
}

beforeEach(() => {
  localStorage.setItem('hermes.token', tokenVivo());
  history.replaceState(null, '', window.location.pathname);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/api/auth/yo')) {
        return new Response(JSON.stringify({ vendedora: { id: 'ana', nombre: 'Ana Lucía', puedeEntrenar: true }, cerberus: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('{"ok":false,"message":"el test no levanta server"}', {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
  localStorage.clear();
});

const $ = <T extends Element>(selector: string) => montado!.contenedor.querySelector<T>(selector);
const vistaActual = () => montado!.contenedor.querySelector('h1')?.textContent?.trim() ?? '';
/** Lo que el Pipeline recibió como `recorteInicial`; `undefined` = el Pipeline no está montado. */
const recorteDelPipeline = (): unknown => {
  const salida = $('[data-recorte]');
  return salida ? JSON.parse(salida.textContent ?? 'null') : undefined;
};

describe('el puente del Dashboard llega al Pipeline', () => {
  it('una cifra de «Hoy» abre el Pipeline con SU recorte, y el shell lo suelta cuando la vista lo usó', async () => {
    montado = montar(<App />);
    await reposar();
    await esperarA(() => $('[data-doble="dashboard"]') !== null, 'el Dashboard (doble) se montó');

    $<HTMLButtonElement>('[data-doble="dashboard"]')!.click();
    await esperarA(() => recorteDelPipeline() !== undefined, 'tocar la cifra montó el Pipeline');
    expect(vistaActual()).toBe('Pipeline');
    expect(recorteDelPipeline()).toEqual(PUENTE);

    $<HTMLButtonElement>('[data-doble="consumido"]')!.click();
    await esperarA(() => recorteDelPipeline() === null, 'el shell soltó el puente cuando el Pipeline avisó que lo usó');
  });

  it('volver al Pipeline por el riel no reaplica un recorte que ya se usó', async () => {
    montado = montar(<App />);
    await reposar();
    await esperarA(() => $('[data-doble="dashboard"]') !== null, 'el Dashboard (doble) se montó');
    $<HTMLButtonElement>('[data-doble="dashboard"]')!.click();
    await esperarA(() => recorteDelPipeline() !== undefined, 'tocar la cifra montó el Pipeline');
    $<HTMLButtonElement>('[data-doble="consumido"]')!.click();
    await esperarA(() => recorteDelPipeline() === null, 'el shell soltó el puente');

    teclear('1', { meta: true });
    await esperarA(() => vistaActual() === 'Dashboard', '⌘1 volvió al Dashboard');
    teclear('2', { meta: true });
    await esperarA(() => recorteDelPipeline() !== undefined, '⌘2 volvió a montar el Pipeline');
    expect(recorteDelPipeline()).toBeNull();
  });
});
