// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import { limpiarBlobsAutenticados, useBlobAutenticado } from './blobAutenticado';

/**
 * EL RIESGO QUE INTRODUJO EL FRENO, Y SU CANDADO.
 *
 * El freno existe para los reintentos que NADIE PIDIÓ: el avatar que se vuelve
 * a bajar en cada montaje del panel. Pero el mismo hook sirve a lo pesado
 * (video, audio, documentos), donde la bajada arranca recién cuando la
 * vendedora TOCA — y ahí un reintento es una persona diciendo «prueba de nuevo».
 *
 * Si el freno no distinguiera esos dos casos, el arreglo de rendimiento le
 * rompería el botón a la vendedora **en silencio**: el botón se sigue
 * dibujando, se sigue pudiendo tocar, y no sale ningún pedido. Esto solo se ve
 * montando y tocando: el test puro de `frenoDeMedia.ts` fija que `olvidar()`
 * suelta la URL, no que alguien lo llame.
 */

const URL_PESADA = 'http://localhost:4100/api/whatsapp/media/video.mp4';

function Pesado() {
  const { bajando, fallo, pedir } = useBlobAutenticado(URL_PESADA, { alPedir: true });
  return (
    <button type="button" onClick={pedir}>
      {bajando ? 'bajando' : fallo ? 'no se pudo cargar' : 'ver'}
    </button>
  );
}

let montado: Montado | null = null;
let pedidos: string[] = [];

beforeEach(() => {
  limpiarBlobsAutenticados();
  pedidos = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      pedidos.push(String(url));
      return new Response('{}', { status: 503 });
    }),
  );
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
  limpiarBlobsAutenticados();
});

describe('lo pesado, que se baja solo cuando alguien lo pide', () => {
  test('nada se baja hasta que se toca', async () => {
    montado = montar(<Pesado />);
    await reposar();
    expect(pedidos).toHaveLength(0);
  });

  test('🔴 el clic humano le gana al freno: el segundo toque VUELVE a pedir', async () => {
    montado = montar(<Pesado />);
    const boton = montado.contenedor.querySelector('button')!;

    tocar(boton);
    await reposar();
    expect(pedidos).toHaveLength(1);
    expect(boton.textContent).toBe('no se pudo cargar');

    // Sin esperar un solo milisegundo: es un reintento que alguien PIDIÓ.
    tocar(boton);
    await reposar();
    expect(pedidos).toHaveLength(2);
  });
});
