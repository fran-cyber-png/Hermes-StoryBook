// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import { BotonLlamar } from './BotonLlamar';

/**
 * EL CLIC TIENE QUE RESPONDER — sea que Meta acepte o rechace el pedido.
 *
 * El defecto real (25-ago-2026): `onSuccess`/`onError` sólo cerraban la
 * confirmación y no mostraban nada — la vendedora clickeaba «¿Segura?» y el
 * botón volvía a su estado inicial en silencio, indistinguible de un botón
 * roto. Esto se prueba montando de verdad, porque un test puro sobre
 * `cuerpoPermisoLlamada` no ve el CABLEADO del clic (ADR 0024).
 */

let m: Montado | null = null;
const fetchDeVerdad = globalThis.fetch;

function servidorQueContesta(status: number, cuerpo: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch;
}

afterEach(() => {
  m?.desmontar();
  m = null;
  globalThis.fetch = fetchDeVerdad;
});

const boton = () => m!.contenedor.querySelector('button') as HTMLButtonElement;
const texto = () => m!.contenedor.textContent ?? '';

describe('BotonLlamar', () => {
  it('avisa cuando Meta acepta el pedido de permiso', async () => {
    servidorQueContesta(200, { ok: true, mensaje: 'Solicitud de permiso enviada. Espera a que la persona acepte.' });
    m = montar(<BotonLlamar telefono="51999000111" />);

    tocar(boton());
    await reposar();
    tocar(boton());
    await reposar();

    expect(texto()).toContain('Solicitud de permiso enviada');
  });

  it('muestra el motivo cuando Meta rechaza el pedido, no lo esconde', async () => {
    servidorQueContesta(400, {
      ok: false,
      message: 'La persona no ha escrito recientemente. Pídele que te escriba primero.',
    });
    m = montar(<BotonLlamar telefono="51999000111" />);

    tocar(boton());
    await reposar();
    tocar(boton());
    await reposar();

    expect(texto()).toContain('no ha escrito recientemente');
  });
});
