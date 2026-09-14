// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, teclear, tocar, type Montado } from '../../pruebas/dom';
import { GrabadorDeVoz } from './GrabadorDeVoz';

/**
 * EL CABLEADO DEL MICRÓFONO — lo que las reglas de `notaDeVoz.ts` no pueden ver.
 *
 * Que Escape cancele, que detener MANDE (la decisión es mandar al detener, sin
 * paso de revisión), que la luz del micrófono se apague, y que un envío fallido
 * no tire la grabación. Todo eso vive en listeners y en el orden de un `onstop`,
 * no en una función pura.
 *
 * El micrófono y `MediaRecorder` son de mentira (jsdom no los trae); ffmpeg
 * también, porque lo que se prueba es qué hace el componente con la nota, no la
 * conversión.
 */

vi.mock('./convertirNotaDeVoz', () => ({
  precalentarMotor: vi.fn(async () => {}),
  prepararNotaDeVoz: vi.fn(async () => ({
    archivo: new File(['OggS'], 'nota-de-voz.ogg', { type: 'audio/ogg; codecs=opus' }),
    segundos: 3,
    onda: null,
  })),
}));

const { prepararNotaDeVoz } = await import('./convertirNotaDeVoz');

let pista: { stop: ReturnType<typeof vi.fn> };
let getUserMedia: ReturnType<typeof vi.fn>;

class GrabadorFalso {
  static isTypeSupported = (t: string) => t.startsWith('audio/webm');
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm;codecs=opus';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['grabado']) });
    this.onstop?.();
  }
}

beforeEach(() => {
  pista = { stop: vi.fn() };
  getUserMedia = vi.fn(async () => ({ getTracks: () => [pista] }));
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder = GrabadorFalso;
  vi.mocked(prepararNotaDeVoz).mockClear();
});

let montado: Montado | null = null;
afterEach(() => {
  montado?.desmontar();
  montado = null;
  delete (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
});

function boton(nombre: string): HTMLButtonElement {
  const b = document.querySelector<HTMLButtonElement>(`button[aria-label="${nombre}"]`);
  if (!b) throw new Error(`no está el botón «${nombre}»\n\n${document.body.innerHTML}`);
  return b;
}

const hay = (nombre: string) => Boolean(document.querySelector(`button[aria-label="${nombre}"]`));

async function grabar() {
  tocar(boton('Grabar una nota de voz'));
  await esperarA(() => hay('Detener y enviar'), 'que arranque la grabación');
}

describe('GrabadorDeVoz', () => {
  it('sin micrófono en el entorno no se ofrece: un botón que no puede grabar es peor que ninguno', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    montado = montar(<GrabadorDeVoz mostrarBoton deshabilitado={false} onEnviar={vi.fn()} onAviso={vi.fn()} />);
    expect(hay('Grabar una nota de voz')).toBe(false);
  });

  it('🔴 al detener SALE: manda el ogg con su duración, y apaga el micrófono', async () => {
    const onEnviar = vi.fn(async () => {});
    montado = montar(<GrabadorDeVoz mostrarBoton deshabilitado={false} onEnviar={onEnviar} onAviso={vi.fn()} />);

    await grabar();
    tocar(boton('Detener y enviar'));
    await esperarA(() => onEnviar.mock.calls.length === 1, 'que la nota salga');

    const [archivo, voz] = onEnviar.mock.calls[0] as unknown as [File, { segundos: number }];
    expect(archivo.type).toBe('audio/ogg; codecs=opus');
    expect(voz).toEqual({ segundos: 3, onda: null });
    expect(pista.stop).toHaveBeenCalled();
    await esperarA(() => hay('Grabar una nota de voz') && !hay('Detener y enviar'), 'volver a reposo');
  });

  it('🔴 Escape cancela: no sale nada y el micrófono se apaga', async () => {
    const onEnviar = vi.fn(async () => {});
    montado = montar(<GrabadorDeVoz mostrarBoton deshabilitado={false} onEnviar={onEnviar} onAviso={vi.fn()} />);

    await grabar();
    const evento = teclear('Escape');
    await reposar();

    expect(evento.defaultPrevented).toBe(true);
    expect(hay('Detener y enviar')).toBe(false);
    expect(pista.stop).toHaveBeenCalled();
    expect(onEnviar).not.toHaveBeenCalled();
    expect(prepararNotaDeVoz).not.toHaveBeenCalled();
  });

  it('🔴 si el envío falla la grabación NO se pierde: reintentar manda la misma nota, sin reconvertir', async () => {
    const onEnviar = vi
      .fn<(archivo: File, voz: unknown) => Promise<void>>()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValueOnce(undefined);
    montado = montar(<GrabadorDeVoz mostrarBoton deshabilitado={false} onEnviar={onEnviar} onAviso={vi.fn()} />);

    await grabar();
    tocar(boton('Detener y enviar'));
    await esperarA(() => hay('Reintentar'), 'que ofrezca reintentar');

    tocar(boton('Reintentar'));
    await esperarA(() => onEnviar.mock.calls.length === 2, 'el segundo intento');
    expect(onEnviar.mock.calls[1][0]).toBe(onEnviar.mock.calls[0][0]);
    expect(prepararNotaDeVoz).toHaveBeenCalledTimes(1);
  });

  it('un permiso negado se explica, y no queda grabando', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    const onAviso = vi.fn();
    montado = montar(<GrabadorDeVoz mostrarBoton deshabilitado={false} onEnviar={vi.fn()} onAviso={onAviso} />);

    tocar(boton('Grabar una nota de voz'));
    await esperarA(() => onAviso.mock.calls.some(([m]) => typeof m === 'string'), 'el aviso del permiso');

    expect(onAviso).toHaveBeenLastCalledWith(expect.stringMatching(/permiso/));
    expect(hay('Detener y enviar')).toBe(false);
    expect(boton('Grabar una nota de voz').disabled).toBe(false);
  });
});
