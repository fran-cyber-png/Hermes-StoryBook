// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { montar, reposar, tocar, escribir, type Montado } from '../../pruebas/dom';
import { HiloWhatsapp } from './HiloWhatsapp';
import type { Conversacion } from '../../dominio/conversaciones';
import { limpiarPiezas } from './procedenciaComposer';
import { limpiarBorrador } from './borradorComposer';

/**
 * ENVIAR COMO PLANTILLA REAL (ADR 0072) — el CABLEADO del botón que Sí
 * atraviesa la ventana de 24 h cerrada.
 *
 * Separado de `plantillasEnComposer.test.tsx` a propósito: ese archivo fija
 * el pegado-a-texto con una conversación de ventana ABIERTA (el caso normal),
 * y este frente solo existe cuando la ventana está CERRADA — mezclar los dos
 * fixtures en un mismo `beforeEach` hubiera significado reescribir la mitad
 * de los casos existentes para una condición que a ellos no les importa.
 */

const TELEFONO = '51987654321';
const NUMERO_PROPIO = '51984429504';
const AHORA = new Date();
const HACE_25H = new Date(AHORA.getTime() - 25 * 60 * 60 * 1000).toISOString();

const CONVERSACION_CERRADA = {
  clave: `conv:whatsapp:${TELEFONO}:${NUMERO_PROPIO}`,
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: TELEFONO,
  persona_nombre: 'Javier',
  numero_propio: NUMERO_PROPIO,
  texto: 'hola',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: false,
  ventana_cierra: HACE_25H,
  pregunto: false,
  n: 1,
  referencia: 'r1',
  ultimo_at: AHORA.toISOString(),
  dias: 1,
  nivel: 0,
} as Conversacion;

const FORO = '🏛️XII FORO DE ESTADO\n*Único pago de S/360.00*';
const CON_HUECO = 'Hola {{1}}, quedó confirmada tu inscripción.';

const CATALOGO = {
  plantillas: [
    { nombre: 'confirmacion', idioma: 'es_PE', categoria: 'UTILITY', cuerpo: CON_HUECO, headerDeImagen: false },
    { nombre: 'foro_estado_5_ago', idioma: 'es_PE', categoria: 'MARKETING', cuerpo: FORO, headerDeImagen: true },
  ],
  ocultas: { noAprobadas: 0, sinCuerpo: 0 },
};

let montado: Montado | null = null;
let enviosHsm: { url: string; init?: RequestInit }[] = [];
/** Feature-detección de la línea: el mock de `/sesion` la sirve. */
let puedeMandarPlantilla = true;

beforeEach(() => {
  enviosHsm = [];
  puedeMandarPlantilla = true;
  limpiarPiezas();
  limpiarBorrador(TELEFONO);
  const json = (c: unknown, status = 200) =>
    new Response(JSON.stringify(c), { status, headers: { 'content-type': 'application/json' } });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      if (url.includes('/api/campana/plantillas/a-mano')) return json(CATALOGO);
      if (url.includes('/api/whatsapp/enviar-plantilla')) {
        enviosHsm.push({ url, init });
        return json({ ok: true, idExterno: 'wa:hsm:1' });
      }
      if (url.includes('/api/whatsapp/sesion')) {
        return json({
          estado: 'conectado',
          telefono: NUMERO_PROPIO,
          transporte: 'cloud-api',
          puedeMandarPlantilla,
        });
      }
      if (url.includes('/api/whatsapp/conversacion/')) return json({ telefono: TELEFONO, mensajes: [], origen: null });
      if (url.includes('/api/hechos/catalogo')) return json({ hechos: [], editable: true, origen: 'tabla' });
      return json({}, 404);
    }),
  );
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
});

async function abrir(): Promise<Montado> {
  const m = montar(<HiloWhatsapp conversacion={CONVERSACION_CERRADA} />);
  await reposar();
  await reposar();
  montado = m;
  return m;
}

const botonPlantillas = (m: Montado) =>
  m.contenedor.querySelector<HTMLButtonElement>('[aria-label="Plantillas aprobadas"]');
const opciones = (m: Montado) => [...m.contenedor.querySelectorAll('[role="option"]')];
const botonEnviarReal = (m: Montado) =>
  [...m.contenedor.querySelectorAll('button')].find((b) => b.textContent?.includes('Enviar como plantilla real'));

async function abrirCajon(m: Montado) {
  tocar(botonPlantillas(m)!);
  await reposar();
  await reposar();
}

describe('el botón «enviar como plantilla real»', () => {
  test('se ofrece con la ventana cerrada y la línea en Cloud API', async () => {
    const m = await abrir();
    await abrirCajon(m);
    expect(opciones(m).length).toBeGreaterThan(0);
    expect(botonEnviarReal(m)).toBeTruthy();
  });

  test('NO se ofrece si la línea no puede mandar plantillas (server viejo o whatsmeow)', async () => {
    puedeMandarPlantilla = false;
    const m = await abrir();
    await abrirCajon(m);
    expect(botonEnviarReal(m)).toBeFalsy();
  });
});

describe('el mini-formulario', () => {
  test('clickear «enviar como plantilla real» cierra el cajón y abre el formulario, SIN pegar nada en la caja', async () => {
    const m = await abrir();
    await abrirCajon(m);
    tocar(botonEnviarReal(m)!);
    await reposar();

    expect(m.contenedor.querySelector('textarea')!.value).toBe('');
    expect(m.contenedor.textContent).toContain('Enviar «');
  });

  test('🔴 el botón Enviar está deshabilitado hasta llenar variables e imagen', async () => {
    const m = await abrir();
    await abrirCajon(m);
    tocar(botonEnviarReal(m)!); // el foro: 0 variables, headerDeImagen: true
    await reposar();

    const enviarBtn = [...m.contenedor.querySelectorAll('button')].find((b) => b.textContent === 'Enviar')!;
    expect(enviarBtn.disabled).toBe(true);
  });

  test('con variable llena y sin imagen requerida, Enviar se habilita', async () => {
    const m = await abrir();
    await abrirCajon(m);
    // La primera opción es «confirmacion»: 1 variable, sin header de imagen.
    tocar(opciones(m)[0]!);
    await reposar();
    // Pero acá el clic pega en la caja (opción normal) — hace falta el botón
    // secundario del RENGLÓN, no el de arriba. Reabrimos y usamos el correcto.
    await abrirCajon(m);
    const fila = opciones(m)[0]!;
    const botonSecundario = [...fila.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Enviar como plantilla real'),
    )!;
    tocar(botonSecundario);
    await reposar();

    const input = m.contenedor.querySelector('input:not([type])') as HTMLInputElement;
    escribir(input, 'Javier');
    await reposar();

    const enviarBtn = [...m.contenedor.querySelectorAll('button')].find((b) => b.textContent === 'Enviar')!;
    expect(enviarBtn.disabled).toBe(false);

    tocar(enviarBtn);
    await reposar();

    expect(enviosHsm).toHaveLength(1);
    const url = new URL(enviosHsm[0]!.url);
    expect(url.searchParams.get('nombrePlantilla')).toBe('confirmacion');
    expect(url.searchParams.get('variables')).toBe(JSON.stringify(['Javier']));
    expect(url.searchParams.get('referencia')).toBe(CONVERSACION_CERRADA.clave);
  });
});
