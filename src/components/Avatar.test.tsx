// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { montar, reposar, type Montado } from '../pruebas/dom';
import { limpiarBlobsAutenticados } from '../lib/datos/blobAutenticado';
import { ESPERA_BASE_MS } from '../lib/datos/frenoDeMedia';
import { Avatar } from './Avatar';

/**
 * EL CABLEADO DEL FRENO — lo que el test puro de `frenoDeMedia.ts` no puede ver.
 *
 * La decisión («un 404 no se vuelve a pedir, un 503 sí pero cada vez menos»)
 * está fijada aparte y hasta el hueso. Lo que se fija ACÁ es que esa decisión
 * esté ENCHUFADA: que el hook consulte el freno antes del fetch y lo anote
 * después. Es exactamente la forma del defecto de ADR 0024 —`escapeDePopover`
 * testeada al detalle y la app perdiendo el Escape igual, porque el agujero
 * estaba en el cableado— y es la forma del defecto que este PR viene a
 * arreglar: la regla «no vuelvas a pedir lo que ya sabes» ya existía en el
 * SERVER (cachea el 404 siete días) y el cliente la ignoraba.
 *
 * Se monta el `Avatar` y no el hook pelado a propósito: el pedido real nace de
 * un montaje, y lo que produce los 6.233 pedidos diarios es justamente que cada
 * montaje vuelva a preguntar.
 */

const TELEFONO = '51955950559';

/**
 * 🔴 LA RESPUESTA CON FOTO NO ES UN `Response` DE VERDAD, Y ESO ES EL ARREGLO.
 *
 * `new Response(blob)` obliga a `bajarMedia` a leer un STREAM en `res.blob()`, y
 * cuántas veces cruza eso el event loop depende de la máquina: acá se resolvía
 * en un turno y en el runner de CI no llegaba en cinco segundos. Los fallos
 * (404 · 503 · 401) no tienen ese problema porque con `res.ok` en false el
 * cuerpo **no se lee nunca** — o sea que el único punto inestable del archivo
 * era el camino del 200.
 *
 * Lo que este test tiene que probar es NUESTRO cableado —que el freno se
 * consulte antes del fetch y se anote después—, no que undici sepa decodificar
 * un blob. Con `blob()` resolviendo derecho, toda la cadena queda en microtasks
 * y un solo `reposar()` la drena entera, en cualquier máquina.
 */
const PIXEL = new Blob(['x'], { type: 'image/png' });
const conFotoOk = () => ({ ok: true, status: 200, blob: async () => PIXEL }) as unknown as Response;

let montado: Montado | null = null;
let pedidos: string[] = [];
let respuesta: () => Response;

/**
 * 🔴 EL RELOJ SE ADELANTA, NO SE CONGELA.
 *
 * Para mirar el backoff hay que saltar media hora sin esperarla, y la forma
 * obvia —clavar `Date.now()` en un número— rompe a cualquiera que mida cuánto
 * pasó. `esperarA` (`pruebas/dom.tsx`) es el caso concreto: vence por
 * `Date.now()`, así que con el reloj clavado su vencimiento por TIEMPO no
 * dispara nunca y queda colgado del tope anti-cuelgue de 2.000 turnos — en la
 * laptop son milisegundos, en un runner cargado son más que los 5 s de vitest,
 * y el síntoma es un «Test timed out» que se lee como «el componente no
 * dibuja», que es lo contrario de lo que está pasando.
 *
 * Con un desfase el tiempo real sigue corriendo —lo que espera de verdad vence
 * de verdad— y el salto sigue siendo instantáneo. Hoy este archivo no llama a
 * `esperarA`, pero el reloj es global: dejarlo clavado sería una trampa para el
 * próximo test que se agregue acá.
 */
const AHORA_REAL = Date.now.bind(Date);
let desfase = 0;

beforeEach(() => {
  limpiarBlobsAutenticados(); // el caché y el freno son de módulo: viven entre tests
  pedidos = [];
  desfase = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => AHORA_REAL() + desfase);
  respuesta = conFotoOk;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      pedidos.push(String(url));
      return respuesta();
    }),
  );
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  limpiarBlobsAutenticados();
});

/** Abre el contacto, deja que la bajada se asiente y lo cierra. Devuelve el HTML. */
async function abrirElContacto(): Promise<string> {
  const m = montar(<Avatar nombre="Ana Torres" telefono={TELEFONO} conFoto />);
  await reposar();
  const html = m.contenedor.innerHTML;
  m.desmontar();
  return html;
}

/** Igual, pero para otro contacto. Devuelve el HTML de ESE avatar. */
async function abrirOtroContacto(telefono: string, nombre: string): Promise<string> {
  const m = montar(<Avatar nombre={nombre} telefono={telefono} conFoto />);
  await reposar();
  const html = m.contenedor.innerHTML;
  m.desmontar();
  return html;
}

describe('el avatar y el freno de la foto', () => {
  test('con foto: se pide una vez y se dibuja la imagen', async () => {
    const html = await abrirElContacto();
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toContain(`/api/whatsapp/foto/${TELEFONO}`);
    expect(html).toContain('<img');
  });

  test('sin foto (404): se cae a las iniciales, no a un roto', async () => {
    respuesta = () => new Response(null, { status: 404 });
    const html = await abrirElContacto();
    expect(html).not.toContain('<img');
    expect(html).toContain('AT');
  });

  test('🔴 un 404 NO se vuelve a pedir al reabrir el contacto', async () => {
    respuesta = () => new Response(null, { status: 404 });
    await abrirElContacto();
    expect(pedidos).toHaveLength(1);
    await abrirElContacto();
    await abrirElContacto();
    expect(pedidos).toHaveLength(1);
    // Y tampoco mañana: el 404 se RECUERDA, no se frena. Sin adelantar el reloj
    // este test no distinguía las dos cosas — lo mostró la verificación en rojo,
    // donde leer el 404 como `no-se-pudo` lo dejaba verde igual.
    desfase += 24 * 60 * 60_000;
    await abrirElContacto();
    expect(pedidos).toHaveLength(1); // el server ya cachea ese «no» 7 días
  });

  test('🔴 un 503 tampoco se vuelve a pedir EN EL ACTO — pero sí más tarde', async () => {
    respuesta = () => new Response('{}', { status: 503 });
    await abrirElContacto();
    expect(pedidos).toHaveLength(1);

    // La ráfaga: la vendedora abre y cierra el contacto varias veces seguidas.
    await abrirElContacto();
    await abrirElContacto();
    expect(pedidos).toHaveLength(1);

    // Pasada la espera se vuelve a preguntar: frenar no es dejar de reintentar.
    desfase += ESPERA_BASE_MS;
    await abrirElContacto();
    expect(pedidos).toHaveLength(2);

    // Y la siguiente espera es el doble: la misma espera daría 88 pedidos al día.
    desfase += ESPERA_BASE_MS;
    await abrirElContacto();
    expect(pedidos).toHaveLength(2);
    desfase += ESPERA_BASE_MS;
    await abrirElContacto();
    expect(pedidos).toHaveLength(3);
  });

  test('🔴 la línea vuelve y la foto aparece: un ok en OTRO contacto suelta el freno', async () => {
    respuesta = () => new Response('{}', { status: 503 });
    await abrirElContacto();
    expect(pedidos).toHaveLength(1);

    // Otro contacto, ya con la línea montada: eso prueba que se puede preguntar.
    // Se espera a que la foto esté DIBUJADA, no a que el fetch haya salido: el
    // `ok` se anota al terminar la bajada, y ver el `<img>` es lo que garantiza
    // que ya terminó.
    respuesta = conFotoOk;
    await abrirOtroContacto('51999888777', 'Beto Ruiz');
    expect(pedidos).toHaveLength(2);

    // Sin adelantar el reloj, el primero se vuelve a pedir y carga.
    const html = await abrirElContacto();
    expect(pedidos).toHaveLength(3);
    expect(html).toContain('<img');
  });

  test('⚠️ un 401 no frena nada: lo arregla el auth, no el paso del tiempo', async () => {
    respuesta = () => new Response('{}', { status: 401 });
    await abrirElContacto();
    await abrirElContacto();
    expect(pedidos).toHaveLength(2);
  });

  test('el que sí cargó no se re-baja: eso ya lo hacía el caché de blobs', async () => {
    await abrirElContacto();
    const html = await abrirElContacto();
    expect(pedidos).toHaveLength(1);
    expect(html).toContain('<img');
  });
});
