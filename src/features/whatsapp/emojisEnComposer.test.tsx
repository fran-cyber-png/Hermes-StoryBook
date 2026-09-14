// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { esperarA, escribir, montar, reposar, teclear, tocar, type Montado } from '../../pruebas/dom';
import { simularPantalla, type PantallaSimulada } from '../../pruebas/pantalla';
import { HiloWhatsapp } from './HiloWhatsapp';
import { leerBorrador } from './borradorComposer';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * EL SELECTOR DE EMOJIS EN EL COMPOSER DE WHATSAPP — el CABLEADO (ADR 0126, #1081).
 *
 * El panel de verdad (`frimousse`) no se puede montar acá: su lista es virtualizada y jsdom
 * no mide nada ni tiene `ResizeObserver`, así que no pintaría ni una fila. Se reemplaza por
 * uno de mentira con la MISMA firma (`onElegir`, `onCerrar`), y lo que se prueba es lo que
 * decide el composer: dónde entra el emoji, a dónde vuelve el foco, qué cierra el panel y
 * qué sale al mandar. El panel real se verifica en `/galeria-composer.html?emojis=abierto`.
 */
vi.mock('../../components/SelectorDeEmojis', () => ({
  SelectorDeEmojis: ({ onElegir, onCerrar }: { onElegir: (emoji: string) => void; onCerrar: () => void }) => (
    <div role="dialog" aria-label="Elegir un emoji">
      <button type="button" onClick={() => onElegir('😊')}>
        😊
      </button>
      <button type="button" onClick={onCerrar}>
        cerrar
      </button>
    </div>
  ),
}));

const TELEFONO = '51987654321';
const NUMERO_PROPIO = '51984429504';
const AHORA = new Date().toISOString();

const CONVERSACION = {
  clave: `conv:whatsapp:${TELEFONO}:${NUMERO_PROPIO}`,
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: TELEFONO,
  persona_nombre: 'Javier',
  numero_propio: NUMERO_PROPIO,
  texto: 'hola',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: 'r1',
  ultimo_at: AHORA,
  dias: 0,
  nivel: 0,
} as Conversacion;

const LA_PREGUNTA = { id: 2, direccion: 'entrante', autor: TELEFONO, texto: '¿Y con tarjeta?', occurred_at: AHORA, external_id: 'wa:LA_PREGUNTA' };

let montado: Montado | null = null;
let pantalla: PantallaSimulada | null = null;
let enviados: Record<string, unknown>[] = [];

function conSesion(estadoSesion = 'conectado') {
  enviados = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      const json = (c: unknown) => new Response(JSON.stringify(c), { headers: { 'content-type': 'application/json' } });
      if (url.includes('/api/whatsapp/sesion')) return json({ estado: estadoSesion, telefono: NUMERO_PROPIO });
      if (url.includes('/api/whatsapp/conversacion/')) return json({ telefono: TELEFONO, mensajes: [LA_PREGUNTA], origen: null });
      if (url.includes('/api/whatsapp/enviar')) {
        enviados.push(JSON.parse(String(init?.body ?? '{}')));
        return json({ ok: true, idExterno: 'wa:nuevo' });
      }
      return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
    }),
  );
}

afterEach(() => {
  montado?.desmontar();
  montado = null;
  pantalla?.restaurar();
  pantalla = null;
  vi.unstubAllGlobals();
});

async function abrir(sugerencia?: Parameters<typeof HiloWhatsapp>[0]['sugerencia']): Promise<Montado> {
  const m = montar(<HiloWhatsapp conversacion={{ ...CONVERSACION, persona_id: `${TELEFONO}` }} sugerencia={sugerencia} />);
  await reposar();
  montado = m;
  return m;
}

const botonEmojis = (m: Montado) => m.contenedor.querySelector<HTMLButtonElement>('button[aria-label="Emojis"]');
const panel = (m: Montado) => m.contenedor.querySelector('[aria-label="Elegir un emoji"]');
const caja = (m: Montado) => m.contenedor.querySelector('textarea')!;
const botonDe = (m: Montado, texto: string) =>
  [...m.contenedor.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === texto)!;

async function abrirPanel(m: Montado) {
  tocar(botonEmojis(m)!);
  await esperarA(() => Boolean(panel(m)), 'el panel de emojis abierto');
}

describe('el selector de emojis en el composer de WhatsApp', () => {
  test('el botón está junto a la caja, y abre el panel', async () => {
    conSesion();
    const m = await abrir();
    expect(botonEmojis(m)).not.toBeNull();
    await abrirPanel(m);
  });

  test('en revisión de una sugerencia no hay botón, igual que no hay clip', async () => {
    conSesion();
    const m = await abrir({
      id: 7,
      texto: 'Hola Javier, te comparto el temario.',
      campana: 'Gestión Pública',
      paso: { actual: 3, total: 12 },
      trabajando: false,
      onAprobar: () => {},
      onDescartar: () => {},
    });
    expect(botonEmojis(m)).toBeNull();
  });

  test('en el celular no hay botón: el teclado del teléfono ya tiene emojis', async () => {
    pantalla = simularPantalla(390);
    conSesion();
    expect(botonEmojis(await abrir())).toBeNull();
  });

  test('con la sesión caída, el botón está apagado', async () => {
    conSesion('desconectado');
    expect(botonEmojis(await abrir())?.disabled).toBe(true);
  });

  test('elegir mete el emoji donde está el cursor, devuelve el foco a la caja y deja el panel abierto', async () => {
    conSesion();
    const m = await abrir();
    escribir(caja(m), 'hola  mundo');
    caja(m).setSelectionRange(5, 5);

    await abrirPanel(m);
    tocar(botonDe(m, '😊'));
    await reposar();

    expect(caja(m).value).toBe('hola 😊 mundo');
    expect(document.activeElement).toBe(caja(m));
    expect(panel(m)).not.toBeNull();
    // Y queda en el borrador de ESTA conversación, como lo que se tipea.
    expect(leerBorrador(TELEFONO)).toBe('hola 😊 mundo');
  });

  test('Escape cierra primero el panel; recién el segundo suelta la cita', async () => {
    conSesion();
    const m = await abrir();
    const responder = [...m.contenedor.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.getAttribute('aria-label') === 'Responder citando este mensaje',
    )!;
    tocar(responder);
    await reposar();
    await abrirPanel(m);
    tocar(botonDe(m, '😊'));
    await reposar();

    teclear('Escape', { target: caja(m) });
    await reposar();
    expect(panel(m)).toBeNull();
    expect(m.contenedor.textContent).toContain('Respondiendo a Javier');

    teclear('Escape', { target: caja(m) });
    await reposar();
    expect(m.contenedor.textContent).not.toContain('Respondiendo a Javier');
  });

  test('Enter manda el emoji tal cual, y al mandar el panel se cierra', async () => {
    conSesion();
    const m = await abrir();
    escribir(caja(m), 'gracias ');
    caja(m).setSelectionRange(8, 8);
    await abrirPanel(m);
    tocar(botonDe(m, '😊'));
    await reposar();

    teclear('Enter', { target: caja(m) });
    await esperarA(() => enviados.length === 1, 'el envío');
    expect(enviados[0].texto).toBe('gracias 😊');
    expect(panel(m)).toBeNull();
  });
});
