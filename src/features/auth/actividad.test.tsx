// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montar, type Montado } from '../../pruebas/dom';
import { api } from '../../lib/datos/cliente';
import { useEstadoDeActividad, useLatidoDeSesion } from './actividad';

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

/**
 * La sonda cablea los DOS hooks, que es lo que hace la app: la raíz late y el
 * modal cronometra. Los casos de abajo no cambiaron de exigencia — lo que se
 * mide sigue siendo el cronómetro y el heartbeat.
 */
function Sonda({ id }: { id: string | null }) {
  const fuente = useLatidoDeSesion(id);
  const { activo, transcurrido } = useEstadoDeActividad(fuente);
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

/**
 * ══ 🔴 EL CANDADO QUE ESTE FRENTE VINO A PONER (8-sep-2026) ═════════════════
 *
 * `useActividadDeSesion` era UN hook con un `setInterval` de un segundo adentro,
 * y `AppAutenticada` lo llamaba en la raíz: **toda la app se re-renderizaba una
 * vez por segundo, todo el día**, para animar el `HH:mm:ss` de un modal cerrado.
 *
 * Lo que se afirma acá es lo único que impide que vuelva: el hook de la RAÍZ no
 * puede re-renderizar por tiempo. Si alguien le devuelve el tick, este test se
 * pone rojo con un número enorme de renders.
 *
 * ⚠️ Se cuentan los renders de un componente que llama SOLO al latido — que es
 * exactamente el papel que `AppAutenticada` tiene.
 */
describe('🔴 el latido de la raíz no re-renderiza por tiempo', () => {
  it('cinco minutos de reloj no agregan ni un render', async () => {
    relojDeMentira();
    vi.mocked(api).mockImplementation(() => Promise.resolve({ iniciadaEn: new Date().toISOString() }));

    let renders = 0;
    function SondaRaiz() {
      renders++;
      useLatidoDeSesion('luz');
      return null;
    }

    montado = montar(<SondaRaiz />);
    await correrElReloj(0); // deja resolver el latido inicial (setIniciadaEn)
    const trasElArranque = renders;

    await correrElReloj(5 * 60_000);

    expect(
      renders,
      `la raíz se re-renderizó ${renders - trasElArranque} veces en 5 minutos: el tick volvió a subir`,
    ).toBe(trasElArranque);
  });

  it('y el cronómetro, apagado con `corriendo: false`, tampoco', async () => {
    relojDeMentira();
    vi.mocked(api).mockImplementation(() => Promise.resolve({ iniciadaEn: new Date().toISOString() }));

    let renders = 0;
    function SondaApagada() {
      renders++;
      const fuente = useLatidoDeSesion('luz');
      useEstadoDeActividad(fuente, false);
      return null;
    }

    montado = montar(<SondaApagada />);
    await correrElReloj(0);
    const trasElArranque = renders;

    await correrElReloj(60_000);

    expect(renders).toBe(trasElArranque);
  });
});
