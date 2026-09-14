// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { escribir, montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import { HiloWhatsapp } from './HiloWhatsapp';
import type { Conversacion } from '../../dominio/conversaciones';
import { limpiarPiezas } from './procedenciaComposer';
import { limpiarBorrador } from './borradorComposer';

/**
 * LA VARITA EN LA CAJA — el CABLEADO (#918).
 *
 * `varita.ts` (front) y `bot/varita.ts` (server) están testeados por su lado.
 * Lo que ningún test puro puede ver es lo de acá, y son tres cosas:
 *
 *   🔴 **apretar la varita NO manda nada.** El botón vive pegado al de enviar,
 *      en la pantalla desde la que se le escribe a un lead real. Es el mismo
 *      riesgo que se fijó para las plantillas y por el mismo motivo: si un clic
 *      mandara, el error se descubre del lado del lead.
 *   🔴 **el desenlace viaja, y viaja con el texto que salió.** Es el paso que
 *      convierte a la varita en algo medible: sin él, `bot_sugerencias` queda
 *      lleno de filas `pendiente` y «¿ya puede responder?» sigue sin respuesta.
 *      El test manda un texto CORREGIDO a propósito — el caso normal, no el
 *      raro— porque es el que distingue reportar lo que salió de reportar la
 *      propuesta original.
 *   🔴 **el botón está aunque el bot esté apagado.** Apagar el bot es «que no
 *      le escriba solo a los leads»; acá no sale nada sin que alguien lo lea.
 *      Si el botón dependiera del modo, la varita no existiría en la única
 *      línea que hoy la necesita.
 */

const TELEFONO = '51987654321';
const NUMERO_PROPIO = '51984429504';
const AHORA = new Date().toISOString();

const CONVERSACION = {
  clave: `conv:whatsapp:${TELEFONO}:${NUMERO_PROPIO}`,
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: TELEFONO,
  persona_nombre: 'Irma',
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

const PROPUESTA = 'Hola Irma, cuéntame qué problemática te preocupa más de tu provincia.';

let montado: Montado | null = null;
let enviados: Record<string, unknown>[] = [];
let redactados = 0;
let desenlaces: { id: string; cuerpo: Record<string, unknown> }[] = [];
let responderRedactar: () => Response;

beforeEach(() => {
  enviados = [];
  redactados = 0;
  desenlaces = [];
  limpiarPiezas();
  limpiarBorrador(TELEFONO);
  const json = (c: unknown, status = 200) =>
    new Response(JSON.stringify(c), { status, headers: { 'content-type': 'application/json' } });
  responderRedactar = () => json({ id: 77, texto: PROPUESTA, motivo: null });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      if (url.includes('/api/bot/redactar')) {
        redactados += 1;
        return responderRedactar();
      }
      const desenlace = url.match(/\/api\/bot\/sugerencias\/(\d+)/);
      if (desenlace) {
        desenlaces.push({ id: desenlace[1]!, cuerpo: JSON.parse(String(init?.body ?? '{}')) });
        return json({ desenlace: 'usada' });
      }
      if (url.includes('/api/whatsapp/sesion')) return json({ estado: 'conectado', telefono: NUMERO_PROPIO });
      if (url.includes('/api/whatsapp/conversacion/')) return json({ telefono: TELEFONO, mensajes: [], origen: null });
      if (url.includes('/api/hechos/catalogo')) return json({ hechos: [], editable: true, origen: 'tabla' });
      if (url.includes('/api/whatsapp/enviar')) {
        enviados.push(JSON.parse(String(init?.body ?? '{}')));
        return json({ ok: true, idExterno: 'wa:1' });
      }
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
  const m = montar(<HiloWhatsapp conversacion={CONVERSACION} />);
  await reposar();
  montado = m;
  return m;
}

const caja = (m: Montado) => m.contenedor.querySelector('textarea')!;
const varita = (m: Montado) =>
  m.contenedor.querySelector<HTMLButtonElement>('[aria-label="Pedirle al bot qué responder"]');
const enviar = (m: Montado) => m.contenedor.querySelector<HTMLButtonElement>('[aria-label="Enviar"]')!;

async function pedir(m: Montado) {
  tocar(varita(m)!);
  await reposar();
  await reposar();
}

test('el botón está en el composer, sin depender del modo del bot', async () => {
  const m = await abrir();
  expect(varita(m)).not.toBeNull();
});

test('🔴 pedir una sugerencia NO manda nada: el texto queda en la caja', async () => {
  const m = await abrir();
  await pedir(m);

  expect(redactados).toBe(1);
  expect(enviados).toHaveLength(0);
  expect(caja(m).value).toBe(PROPUESTA);
});

test('🔴 al enviar, el desenlace viaja con el texto que SALIÓ, no con la propuesta original', async () => {
  const m = await abrir();
  await pedir(m);

  // La vendedora lo corrige antes de mandar: es el caso normal, no el raro.
  const corregido = 'Hola Irma, cuéntame qué te preocupa más de Áncash.';
  escribir(caja(m), corregido);
  await reposar();

  tocar(enviar(m));
  await reposar();
  await reposar();

  expect(enviados).toHaveLength(1);
  expect(desenlaces).toHaveLength(1);
  expect(desenlaces[0]!.id).toBe('77');
  expect(desenlaces[0]!.cuerpo.textoFinal).toBe(corregido);
  expect(caja(m).value).toBe('');
});

test('mandar tal cual también reporta: el server decide si fue `usada`', async () => {
  const m = await abrir();
  await pedir(m);

  tocar(enviar(m));
  await reposar();
  await reposar();

  expect(desenlaces[0]!.cuerpo.textoFinal).toBe(PROPUESTA);
});

test('pedir otra sin mandar la anterior la cierra: «pedí y no me sirvió» se cuenta', async () => {
  const m = await abrir();
  await pedir(m);
  await pedir(m);

  expect(redactados).toBe(2);
  expect(desenlaces).toHaveLength(1);
  expect(desenlaces[0]!.cuerpo.textoFinal).toBeNull();
});

test('si el bot no tiene nada que decir, lo dice en cristiano y no toca la caja', async () => {
  responderRedactar = () =>
    new Response(
      JSON.stringify({ id: 9, texto: null, motivo: 'no hay ningún mensaje del lead que responder' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  const m = await abrir();
  escribir(caja(m), 'lo que ella venía escribiendo');
  await reposar();

  await pedir(m);

  expect(caja(m).value).toBe('lo que ella venía escribiendo');
  expect(m.contenedor.textContent).toContain('Todavía no hay nada que responder acá');
});
