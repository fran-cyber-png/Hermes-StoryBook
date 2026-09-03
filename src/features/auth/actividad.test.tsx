// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montar, type Montado } from '../../pruebas/dom';
import { api } from '../../lib/datos/cliente';
import { useActividadDeSesion } from './actividad';

/**
 * EL LATIDO, MONTADO — mismo motivo que `useAutoguardado.test.tsx`: lo que hay
 * que ver es el CABLEADO (los listeners, los dos `setInterval`, la limpieza al
 * desmontar), no la matemática de formatear una fecha.
 *
 * ⚠️ Reloj falso ACOTADO a `setInterval`/`clearInterval`/`Date` — lo mismo que
 * el hook usa. Sin fingir `Date` el cronómetro no avanzaría con el reloj
 * (`Date.now()` seguiría siendo el real); fingiendo TODO (el default de
 * vitest) el scheduler de React se queda sin `setTimeout` y no pinta.
 */
vi.mock('../../lib/datos/cliente', () => ({ api: vi.fn() }));

function relojDeMentira() {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
}
async function correrElReloj(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function Sonda({ id }: { id: string | null }) {
  const { activo, transcurrido } = useActividadDeSesion(id);
  return (
    <div>
      <p data-activo>{String(activo)}</p>
      <p data-transcurrido>{transcurrido ?? ''}</p>
    </div>
  );
}

function leer(m: Montado, campo: 'activo' | 'transcurrido'): string {
  return m.contenedor.querySelector(`[data-${campo}]`)?.textContent ?? '';
}

let montado: Montado | null = null;

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('el cronómetro', () => {
  it('arranca con el iniciadaEn que devuelve el server, y tickea local cada segundo', async () => {
    relojDeMentira();
    vi.mocked(api).mockImplementation(() => Promise.resolve({ iniciadaEn: new Date().toISOString() }));
    montado = montar(<Sonda id="luz" />);
    await correrElReloj(0); // deja resolver el latido inicial

    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith('/api/actividad', { method: 'POST' });

    await correrElReloj(3000);
    expect(leer(montado, 'transcurrido')).toBe('00:00:03');
  });

  it('un F5 (nueva sesión) retoma el iniciadaEn real del server, no arranca de cero', async () => {
    relojDeMentira();
    const hace10min = new Date(Date.now() - 10 * 60_000).toISOString();
    vi.mocked(api).mockResolvedValue({ iniciadaEn: hace10min });
    montado = montar(<Sonda id="luz" />);
    await correrElReloj(0);

    expect(leer(montado, 'transcurrido')).toBe('00:10:00');
  });
});

describe('el heartbeat solo sale si hubo actividad real', () => {
  it('sin ningún click/tecla/scroll, pasados los 45 s NO manda un segundo latido', async () => {
    relojDeMentira();
    vi.mocked(api).mockImplementation(() => Promise.resolve({ iniciadaEn: new Date().toISOString() }));
    montado = montar(<Sonda id="luz" />);
    await correrElReloj(0);
    expect(api).toHaveBeenCalledTimes(1);

    await correrElReloj(50_000);
    expect(api, 'sin actividad, ultima_actividad_en se congela sola').toHaveBeenCalledTimes(1);
  });

  it('con un click de por medio, el siguiente intervalo SÍ manda el latido', async () => {
    relojDeMentira();
    vi.mocked(api).mockImplementation(() => Promise.resolve({ iniciadaEn: new Date().toISOString() }));
    montado = montar(<Sonda id="luz" />);
    await correrElReloj(0);
    expect(api).toHaveBeenCalledTimes(1);

    await correrElReloj(10_000);
    act(() => {
      window.dispatchEvent(new Event('click'));
    });
    await correrElReloj(40_000); // total 50s desde el arranque, con actividad a los 10s

    expect(api).toHaveBeenCalledTimes(2);
  });
});

describe('ACTIVO / INACTIVO', () => {
  it('empieza activo, y pasa a inactivo a los 2 minutos sin actividad', async () => {
    relojDeMentira();
    vi.mocked(api).mockImplementation(() => Promise.resolve({ iniciadaEn: new Date().toISOString() }));
    montado = montar(<Sonda id="luz" />);
    await correrElReloj(0);
    expect(leer(montado, 'activo')).toBe('true');

    await correrElReloj(2 * 60_000 + 1_000);
    expect(leer(montado, 'activo')).toBe('false');
  });

  it('una actividad reciente lo vuelve a poner ACTIVO', async () => {
    relojDeMentira();
    vi.mocked(api).mockImplementation(() => Promise.resolve({ iniciadaEn: new Date().toISOString() }));
    montado = montar(<Sonda id="luz" />);
    await correrElReloj(0);

    await correrElReloj(2 * 60_000 + 1_000);
    expect(leer(montado, 'activo')).toBe('false');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown'));
    });
    await correrElReloj(1_000);
    expect(leer(montado, 'activo')).toBe('true');
  });
});

describe('limpieza al desmontar / cambiar de sesión', () => {
  it('sin sesión (id null) no llama a la API ni arma nada', async () => {
    relojDeMentira();
    montado = montar(<Sonda id={null} />);
    await correrElReloj(60_000);
    expect(api).not.toHaveBeenCalled();
  });

  it('al desmontar, no quedan listeners ni intervalos: nada explota ni sigue latiendo', async () => {
    relojDeMentira();
    vi.mocked(api).mockImplementation(() => Promise.resolve({ iniciadaEn: new Date().toISOString() }));
    montado = montar(<Sonda id="luz" />);
    await correrElReloj(0);
    expect(api).toHaveBeenCalledTimes(1);

    montado.desmontar();
    montado = null;

    // Si algún listener o intervalo sobrevivió, esto tiraría (setState en un
    // componente desmontado) o mandaría más latidos.
    await expect(correrElReloj(120_000)).resolves.not.toThrow();
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('cambiar de vendedoraId (login de otra persona) reinicia el cronómetro', async () => {
    relojDeMentira();
    vi.mocked(api).mockImplementation(() => Promise.resolve({ iniciadaEn: new Date().toISOString() }));
    montado = montar(<Sonda id="luz" />);
    await correrElReloj(5_000);
    expect(leer(montado, 'transcurrido')).toBe('00:00:05');

    montado.repintar(<Sonda id="sindy" />);
    await correrElReloj(0);

    expect(leer(montado, 'transcurrido')).toBe('00:00:00');
    expect(api).toHaveBeenCalledTimes(2);
  });
});
