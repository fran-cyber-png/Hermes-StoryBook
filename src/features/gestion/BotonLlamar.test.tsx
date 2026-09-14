// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversacion } from '../../dominio/conversaciones';
import { montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import { BotonLlamar } from './BotonLlamar';

/**
 * EL BOTÓN «LLAMAR» DE LA CABECERA, CON LA LLAMADA POR WHATSAPP DETRÁS (ADR 0123).
 *
 * ── El caso medido el 14-sep-2026 ──────────────────────────────────────────
 * En una conversación de Ventas Meta (Cloud API, canal whatsapp, con teléfono), el dueño tocó
 * este botón y le salió el marcador de macOS — sin una palabra de por qué no fue la llamada por
 * WhatsApp que Hermes ya sabe hacer (`PanelLlamada`, en la ficha de la derecha). Estos tres casos
 * fijan que el clic SIEMPRE conteste con algo: llama, pide permiso, o dice por qué no puede.
 *
 * `llamar` de `llamadaActual.ts` se mockea entero: es un módulo con estado singleton (WebRTC,
 * micrófono, señalización) que no se puede ejercitar en jsdom, y no es lo que este archivo prueba
 * — lo que prueba es que EL BOTÓN lo invoca (o no) en el momento correcto.
 */

vi.mock('../llamadas/llamadaActual', () => ({ llamar: vi.fn() }));
vi.mock('../../lib/enlacesExternos', () => ({ abrirExterno: vi.fn() }));

const CLAVE = 'conv:whatsapp:51999888777:51984429504';
const LINEA = '51984429504';
const TELEFONO = '51999888777';

function conv(sobre: Partial<Conversacion> = {}): Conversacion {
  return {
    clave: CLAVE,
    canal: 'whatsapp',
    tipo: 'mensaje',
    persona_id: TELEFONO,
    persona_nombre: null,
    numero_propio: LINEA,
    texto: null,
    contexto_texto: null,
    respondida: false,
    ventana_abierta: true,
    pregunto: false,
    n: 1,
    referencia: 'wamid.1',
    ultimo_at: '2026-09-14T10:00:00.000Z',
    dias: 0,
    nivel: 0,
    ...sobre,
  };
}

let montado: Montado | null = null;

beforeEach(() => {
  // El mismo candado que `EtiquetasContacto.test.tsx`: `api()` lee el token con
  // `tokenGuardado()` → `localStorage.getItem`, y jsdom no trae `localStorage`. Sin esto
  // CUALQUIER request (aun la que el test no espera que salga) revienta antes del `fetch`
  // stubeado, y un test que mira "no se llamó a fetch" pasaría por el motivo equivocado.
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  });
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function llamarMock() {
  const { llamar } = await import('../llamadas/llamadaActual');
  return llamar as unknown as ReturnType<typeof vi.fn>;
}

async function abrirExternoMock() {
  const { abrirExterno } = await import('../../lib/enlacesExternos');
  return abrirExterno as unknown as ReturnType<typeof vi.fn>;
}

describe('BotonLlamar — llamable, con permiso vigente', () => {
  it('(a) llama por WhatsApp y NO abre el marcador', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { headers: { 'content-type': 'application/json' } })));

    montado = montar(<BotonLlamar telefono={TELEFONO} conversacion={conv()} />, (qc) => {
      qc.setQueryData(['llamadas', 'activas'], { ok: true, activa: true, linea: LINEA });
      qc.setQueryData(['llamadas', 'permiso', CLAVE], {
        estado: 'permanente',
        venceEn: null,
        puedePedir: false,
        puedeLlamar: true,
      });
    });
    await reposar();

    tocar(montado.contenedor.querySelector('button')!);
    await reposar();

    expect(await llamarMock()).toHaveBeenCalledWith(CLAVE, TELEFONO);
    expect(await abrirExternoMock()).not.toHaveBeenCalled();
    // Sin popover: el clic resolvió la llamada, no hay nada más que mostrar.
    expect(montado.contenedor.textContent).not.toContain('Copiar');
  });
});

describe('BotonLlamar — llamable, sin permiso', () => {
  it('(b) pide permiso (no abre el marcador) y muestra el estado en palabras', async () => {
    // Responde las DOS rutas que este caso puede tocar: el pedido en sí, y el refetch del
    // permiso que dispara `onSettled` al invalidar (`usePedirPermisoDeLlamada`) — invalidar una
    // query activa la vuelve a pedir, y eso es lo correcto: sin esto, un segundo toque no vería
    // que Meta ya contestó.
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/llamadas/pedir-permiso')) {
        return new Response(
          JSON.stringify({ ok: true, mensaje: 'Pedido enviado. Cuando la persona acepte, vas a poder llamarla.' }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ ok: true, permiso: { estado: 'sin_permiso', venceEn: null, puedePedir: true, puedeLlamar: false } }),
        { headers: { 'content-type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    montado = montar(<BotonLlamar telefono={TELEFONO} conversacion={conv()} />, (qc) => {
      qc.setQueryData(['llamadas', 'activas'], { ok: true, activa: true, linea: LINEA });
      qc.setQueryData(['llamadas', 'permiso', CLAVE], {
        estado: 'sin_permiso',
        venceEn: null,
        puedePedir: true,
        puedeLlamar: false,
      });
    });
    await reposar();

    tocar(montado.contenedor.querySelector('button')!);
    await reposar();
    await reposar();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/llamadas/pedir-permiso'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(await llamarMock()).not.toHaveBeenCalled();
    expect(await abrirExternoMock()).not.toHaveBeenCalled();
    expect(montado.contenedor.textContent).toContain(
      'Le pedimos permiso para llamarlo; cuando acepte en su WhatsApp, vuelve a tocar Llamar.',
    );
  });
});

describe('BotonLlamar — no llamable', () => {
  it('(c) abre el marcador (red de seguridad) y el popover dice el motivo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { headers: { 'content-type': 'application/json' } })));

    // El caso medido: Ventas Meta, canal y línea correctos, pero esta cuenta no tiene las
    // llamadas activas — `activa: false`.
    montado = montar(<BotonLlamar telefono={TELEFONO} conversacion={conv()} />, (qc) => {
      qc.setQueryData(['llamadas', 'activas'], { ok: true, activa: false, linea: LINEA });
    });
    await reposar();

    tocar(montado.contenedor.querySelector('button')!);
    await reposar();

    expect(await abrirExternoMock()).toHaveBeenCalledWith(`tel:+${TELEFONO}`);
    expect(await llamarMock()).not.toHaveBeenCalled();
    // Nunca se consulta el permiso de algo que no es llamable.
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(montado.contenedor.textContent).toContain(`+${TELEFONO}`);
    expect(montado.contenedor.textContent).toContain('Tu usuario no tiene las llamadas activas.');
  });
});

describe('BotonLlamar — sin conversación (contactos de campaña, Personas)', () => {
  it('se comporta exactamente como antes de ADR 0123: marcador, sin motivo', async () => {
    montado = montar(<BotonLlamar telefono={TELEFONO} />);
    await reposar();

    tocar(montado.contenedor.querySelector('button')!);
    await reposar();

    expect(await abrirExternoMock()).toHaveBeenCalledWith(`tel:+${TELEFONO}`);
    expect(montado.contenedor.textContent).toContain(`+${TELEFONO}`);
    expect(montado.contenedor.textContent).toContain('Si el marcador no se abrió, cópialo');
    // Ninguno de los cinco motivos: sin conversación, la regla no aplica.
    expect(montado.contenedor.textContent).not.toContain('llamadas activas');
    expect(montado.contenedor.textContent).not.toContain('lead sin chat');
  });
});
