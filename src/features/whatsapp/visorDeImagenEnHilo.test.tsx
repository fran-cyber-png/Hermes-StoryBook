// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { esperarA, montar, reposar, teclear, tocar, type Montado } from '../../pruebas/dom';
import { HiloWhatsapp } from './HiloWhatsapp';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * LA IMAGEN AMPLIADA DEL HILO, Y LO QUE SE PUEDE HACER CON ELLA.
 *
 * ── Qué vigila ─────────────────────────────────────────────────────────────
 * Hasta el 11-sep-2026 tocar una foto la mostraba grande y nada más: la vendedora
 * no tenía cómo bajar el voucher que le mandó el lead para subirlo a Cerberus.
 * Lo que se fija acá es el CABLEADO —que el visor abra desde la burbuja, que las
 * acciones lleguen a la foto que se está mirando y no a la primera, que Responder
 * termine en la caja— porque la lógica pura ya tiene su test
 * (`visorDeImagen.test.ts`) y eso no alcanza para ver ninguna de esas tres cosas.
 */

const TELEFONO = '51987654321';
const NUMERO_PROPIO = '51984429504';

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
  ultimo_at: new Date().toISOString(),
  dias: 0,
  nivel: 0,
} as Conversacion;

const AHORA = new Date().toISOString();

/**
 * Como llegan de producción: el nombre del archivo es el de la bajada y `nombre` viene vacío.
 *
 * La hora está elegida: las 03:00 UTC del 2 de setiembre son las 22:00 del 1 en Lima. El nombre con que se
 * guarda sólo sale bien si usa el día DE LIMA del mensaje, no el de hoy ni el de UTC.
 */
const VOUCHER = {
  id: 1,
  direccion: 'entrante',
  autor: TELEFONO,
  texto: 'Ya pagué, te mando el voucher',
  occurred_at: '2026-09-02T03:00:00Z',
  external_id: 'wa:VOUCHER',
  media: { clase: 'imagen', archivo: 'wa-cloud-1873649201.jpg', mime: 'image/jpeg', nombre: null },
};
const FLYER = {
  id: 2,
  direccion: 'saliente',
  autor: 'luz',
  texto: null,
  occurred_at: AHORA,
  external_id: 'wa:FLYER',
  enviado_por: 'centurion:luz.huaman',
  media: { clase: 'imagen', archivo: 'wa-3EB0C4D2.png', mime: 'image/png', nombre: 'flyer-gestion-publica.png' },
};

let montado: Montado | null = null;

/**
 * 🔴 LA IMAGEN NO VIENE EN UN `Response` DE VERDAD — la misma lección que
 * `components/Avatar.test.tsx`. Con `new Response(blob)` la bajada tiene que leer
 * un stream en `res.blob()`: en la laptop (Node 26) andaba, y en el runner de CI
 * no llegaba y la burbuja quedaba en «No se pudo cargar el adjunto» — los doce
 * tests rojos por el entorno, no por el visor. Lo que se prueba acá es el visor,
 * no que undici sepa decodificar un blob.
 */
const IMAGEN = new Blob(['imagen'], { type: 'image/jpeg' });
const conImagenOk = () => ({ ok: true, status: 200, blob: async () => IMAGEN }) as unknown as Response;

function conMensajes(mensajes: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL) => {
      const url = String(entrada);
      const json = (c: unknown) =>
        new Response(JSON.stringify(c), { headers: { 'content-type': 'application/json' } });
      if (url.includes('/api/whatsapp/media/')) return conImagenOk();
      if (url.includes('/api/whatsapp/sesion')) return json({ estado: 'conectado', telefono: NUMERO_PROPIO });
      if (url.includes('/api/whatsapp/conversacion/')) return json({ telefono: TELEFONO, mensajes, origen: null });
      return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
    }),
  );
}

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis.navigator, 'clipboard');
});

async function abrirHilo(): Promise<Montado> {
  const m = montar(<HiloWhatsapp conversacion={CONVERSACION} />);
  montado = m;
  await esperarA(() => miniaturas().length > 0, 'las miniaturas de las imágenes');
  return m;
}

function miniaturas(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('button[aria-label="Ver la imagen completa"]')];
}
/** El visor va en un portal sobre `body`: se busca en el documento, no en el contenedor del hilo. */
function visor(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"][aria-label="Imagen ampliada"]');
}
function enVisor<T extends Element>(selector: string): T | null {
  return visor()?.querySelector<T>(selector) ?? null;
}
function descargar(): HTMLAnchorElement | null {
  return enVisor<HTMLAnchorElement>('a[aria-label="Descargar la imagen"]');
}

async function ampliar(indice = 0) {
  tocar(miniaturas()[indice]);
  await esperarA(() => Boolean(descargar()?.getAttribute('href')), 'el visor con la imagen bajada');
}

describe('descargar la imagen ampliada', () => {
  test('🔴 el visor trae «Descargar», que baja ESA imagen con el mismo nombre que la burbuja, no el del disco', async () => {
    conMensajes([VOUCHER]);
    await abrirHilo();
    await ampliar();

    const enlace = descargar()!;
    expect(enlace.getAttribute('href')).toMatch(/^blob:/);
    expect(enlace.getAttribute('download')).toBe('imagen-2026-09-01.jpg');
    // Y es el mismo que ofrece la burbuja: la misma foto no se guarda con dos nombres.
    expect(document.querySelector('button[title="Descargar imagen-2026-09-01.jpg"]')).not.toBeNull();
    expect(enlace.textContent).toContain('Descargar');
  });

  test('con nombre original, se baja con ese nombre y no con el del disco', async () => {
    conMensajes([FLYER]);
    await abrirHilo();
    await ampliar();
    expect(descargar()!.getAttribute('download')).toBe('flyer-gestion-publica.png');
  });

  /** El velo cierra con un clic: si el clic en una acción subiera hasta él, descargar cerraría la foto. */
  test('🔴 tocar una acción NO cierra el visor', async () => {
    conMensajes([VOUCHER]);
    await abrirHilo();
    await ampliar();

    descargar()!.addEventListener('click', (e) => e.preventDefault()); // jsdom no navega
    tocar(descargar()!);
    tocar(enVisor('button[aria-label="Girar a la derecha"]')!);
    tocar(enVisor('button[aria-label="Acercar"]')!);
    await reposar();
    expect(visor()).not.toBeNull();
  });

  test('tocar el fondo o «Cerrar» lo cierra, y Escape también', async () => {
    conMensajes([VOUCHER]);
    await abrirHilo();

    await ampliar();
    tocar(visor()!);
    expect(visor()).toBeNull();

    await ampliar();
    tocar(enVisor('button[aria-label="Cerrar"]')!);
    expect(visor()).toBeNull();

    await ampliar();
    teclear('Escape');
    expect(visor()).toBeNull();
  });
});

describe('lo que dice el visor', () => {
  test('quién la mandó y el texto que vino con la foto', async () => {
    conMensajes([VOUCHER]);
    await abrirHilo();
    await ampliar();
    expect(visor()!.textContent).toContain('Javier');
    expect(visor()!.textContent).toContain('Ya pagué, te mando el voucher');
  });

  test('una saliente dice quién la mandó desde Hermes', async () => {
    conMensajes([FLYER]);
    await abrirHilo();
    await ampliar();
    expect(visor()!.textContent).toContain('Luz.huaman');
  });
});

describe('pasar de una foto a otra', () => {
  test('🔴 «Siguiente» cambia la foto, y la descarga es la de la foto nueva', async () => {
    conMensajes([VOUCHER, FLYER]);
    await abrirHilo();
    await ampliar(0);

    expect(visor()!.textContent).toContain('1 de 2');
    expect(enVisor('button[aria-label="Imagen anterior"]')).toBeNull();
    tocar(enVisor('button[aria-label="Imagen siguiente"]')!);
    await esperarA(() => descargar()?.getAttribute('download') === 'flyer-gestion-publica.png', 'la descarga de la segunda foto');
    expect(visor()!.textContent).toContain('2 de 2');
    expect(enVisor('button[aria-label="Imagen siguiente"]')).toBeNull();
  });

  /**
   * La tecla sale del `body` y no del visor A PROPÓSITO. Es el caso que encontró
   * la captura: alejar hasta 1× deshabilita «Alejar», el botón suelta el foco al
   * `body`, y con las teclas escuchadas en el diálogo las flechas quedaban mudas.
   */
  test('🔴 con las flechas del teclado también, aunque el foco se haya ido del visor', async () => {
    conMensajes([VOUCHER, FLYER]);
    await abrirHilo();
    await ampliar(1);

    (document.activeElement as HTMLElement | null)?.blur();
    teclear('ArrowLeft');
    await esperarA(() => descargar()?.getAttribute('download') === 'imagen-2026-09-01.jpg', 'volver a la primera foto');
  });

  test('una sola foto no dibuja flechas ni contador', async () => {
    conMensajes([VOUCHER]);
    await abrirHilo();
    await ampliar();
    expect(enVisor('button[aria-label="Imagen siguiente"]')).toBeNull();
    expect(visor()!.textContent).not.toContain('1 de 1');
  });
});

describe('responder citando la foto', () => {
  test('🔴 cierra el visor y deja la tirita de la cita arriba de la caja', async () => {
    conMensajes([VOUCHER]);
    const m = await abrirHilo();
    await ampliar();

    tocar(enVisor('button[aria-label="Responder citando esta imagen"]')!);
    await reposar();
    expect(visor()).toBeNull();
    expect(m.contenedor.textContent).toContain('Respondiendo a Javier');
  });
});

describe('copiar la imagen', () => {
  test('sin portapapeles de imágenes no se ofrece: un botón que no puede copiar parece que anduvo', async () => {
    conMensajes([VOUCHER]);
    await abrirHilo();
    await ampliar();
    expect(enVisor('button[aria-label="Copiar la imagen"]')).toBeNull();
  });

  test('con portapapeles, escribe un PNG y lo confirma con palabras', async () => {
    const escrito: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      'ClipboardItem',
      class {
        items: Record<string, unknown>;
        constructor(items: Record<string, unknown>) {
          this.items = items;
        }
      },
    );
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { write: async (items: Array<{ items: Record<string, unknown> }>) => void escrito.push(items[0].items) },
      configurable: true,
    });
    // jsdom no dibuja: el lienzo se remienda para que devuelva un PNG cualquiera.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage() {} } as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (listo) {
      listo(new Blob(['png'], { type: 'image/png' }));
    });

    conMensajes([VOUCHER]);
    await abrirHilo();
    await ampliar();

    tocar(enVisor('button[aria-label="Copiar la imagen"]')!);
    await esperarA(() => visor()!.textContent!.includes('Copiada'), 'el acuse de copiado');
    expect(Object.keys(escrito[0])).toEqual(['image/png']);
    vi.restoreAllMocks();
  });
});
