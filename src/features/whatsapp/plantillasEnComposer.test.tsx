// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { escribir, montar, reposar, teclear, tocar, type Montado } from '../../pruebas/dom';
import { HiloWhatsapp } from './HiloWhatsapp';
import type { Conversacion } from '../../dominio/conversaciones';
import { limpiarPiezas } from './procedenciaComposer';
import { limpiarBorrador } from './borradorComposer';

/**
 * LAS PLANTILLAS EN LA CAJA — el CABLEADO (ADR 0062).
 *
 * `plantillasAMano.ts` ya está testeado puro (dónde se inserta, qué queda
 * seleccionado, qué es un hueco). Lo que ningún test puro puede ver es lo de acá,
 * y son tres cosas:
 *
 *   🔴 **elegir una plantilla NO manda nada.** El botón vive pegado al de enviar,
 *      en la pantalla desde la que se le escribe a un lead real. Si un clic
 *      mandara, el error se descubre del lado del lead.
 *   🔴 **el envío declara la pieza** (`hsm:<nombre>`, vía `composer-hsm`): sin eso
 *      la plantilla sale como línea de base y no se puede medir nunca — y encima
 *      contamina la fila contra la que se compara todo lo demás.
 *   🔴 **el catálogo no se pide hasta que se abre.** Detrás hay una request a la
 *      Graph API con 15 s de techo, y abrir una conversación es la acción más
 *      frecuente del día.
 */

const TELEFONO = '51987654321';
const NUMERO_PROPIO = '51984429504';
const AHORA = new Date().toISOString();

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
  ultimo_at: AHORA,
  dias: 0,
  nivel: 0,
} as Conversacion;

const FORO = '🏛️XII FORO DE ESTADO\n*Único pago de S/360.00*';
const CON_HUECO = 'Hola {{1}}, quedó confirmada tu inscripción.';

const CATALOGO = {
  plantillas: [
    { nombre: 'confirmacion', idioma: 'es_PE', categoria: 'UTILITY', cuerpo: CON_HUECO, headerDeImagen: false },
    { nombre: 'foro_estado_5_ago', idioma: 'es_PE', categoria: 'MARKETING', cuerpo: FORO, headerDeImagen: true },
  ],
  ocultas: { noAprobadas: 1, sinCuerpo: 0 },
};

let montado: Montado | null = null;
let enviados: Record<string, unknown>[] = [];
let pedidosDeCatalogo = 0;
/** Qué contesta el catálogo. Se pisa por test para el caso del fallo de Meta. */
let responderCatalogo: () => Response;

beforeEach(() => {
  enviados = [];
  pedidosDeCatalogo = 0;
  limpiarPiezas();
  // ⚠️ El borrador vive a nivel de MÓDULO (sobrevive a que React desmonte), así
  // que sin esto el texto de un caso hidrata la caja del siguiente y el test de
  // «pegó exactamente el cuerpo» pasa a medir el arrastre del anterior.
  limpiarBorrador(TELEFONO);
  const json = (c: unknown, status = 200) =>
    new Response(JSON.stringify(c), { status, headers: { 'content-type': 'application/json' } });
  responderCatalogo = () => json(CATALOGO);

  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      if (url.includes('/api/campana/plantillas/a-mano')) {
        pedidosDeCatalogo += 1;
        return responderCatalogo();
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

async function abrir(sugerencia?: Parameters<typeof HiloWhatsapp>[0]['sugerencia']): Promise<Montado> {
  const m = montar(<HiloWhatsapp conversacion={CONVERSACION} sugerencia={sugerencia} />);
  await reposar();
  montado = m;
  return m;
}

const caja = (m: Montado) => m.contenedor.querySelector('textarea')!;
const boton = (m: Montado) => m.contenedor.querySelector<HTMLButtonElement>('[aria-label="Plantillas aprobadas"]');
const panel = (m: Montado) => m.contenedor.querySelector('[role="listbox"][aria-label="Plantillas aprobadas"]');
const opciones = (m: Montado) => [...m.contenedor.querySelectorAll('[role="option"]')];

/**
 * Abre el cajón y espera a que la respuesta del catálogo llegue y se pinte.
 *
 * Dos `reposar()`: el primero deja salir el `fetch` y el segundo deja que
 * TanStack Query pase de «pidiendo» a «llegó» (o a «falló»). Con uno solo, el
 * test lee la pantalla mientras todavía dice «Preguntándole a Meta…» y falla —o
 * peor, pasa— por el motivo equivocado.
 */
async function abrirCajon(m: Montado) {
  tocar(boton(m)!);
  await reposar();
  await reposar();
}

describe('el botón', () => {
  test('está al lado del clip y el cajón arranca cerrado', async () => {
    const m = await abrir();
    expect(boton(m)).toBeTruthy();
    expect(panel(m)).toBeNull();
  });

  test('🔴 el catálogo NO se pide hasta que se abre', async () => {
    const m = await abrir();
    expect(pedidosDeCatalogo).toBe(0);
    await abrirCajon(m);
    expect(pedidosDeCatalogo).toBe(1);
  });

  test('EN MODO REVISIÓN no existe: ahí la caja es para aprobar, no para escribir', async () => {
    const m = await abrir({
      id: 7,
      texto: 'Hola, gracias por escribirnos.',
      campana: null,
      paso: { actual: 1, total: 3 },
      trabajando: false,
      onAprobar: () => {},
      onDescartar: () => {},
    });
    expect(boton(m)).toBeNull();
  });
});

describe('el cajón', () => {
  test('lista las aprobadas y avisa de lo que la plantilla NO trae al pegarse', async () => {
    const m = await abrir();
    await abrirCajon(m);
    expect(opciones(m)).toHaveLength(2);
    expect(m.contenedor.textContent).toContain('XII FORO DE ESTADO');
    // El flyer no viaja con el texto, y el precio de Goberna vive adentro del flyer.
    expect(m.contenedor.textContent).toContain('lleva imagen');
    expect(m.contenedor.textContent).toContain('1 hueco');
  });

  test('lo que Meta no aprobó no se ofrece, pero se DICE cuánto falta', async () => {
    const m = await abrir();
    await abrirCajon(m);
    expect(m.contenedor.textContent).toContain('Hay 1 que Meta no tiene aprobada');
  });

  test('🔴 un fallo de Meta NO se dibuja como «no hay plantillas»', async () => {
    // La reacción razonable a «no hay ninguna» es ir a crear una que ya existe.
    responderCatalogo = () =>
      new Response(JSON.stringify({ ok: false, motivo: 'meta_indisponible', message: 'Falta META_WABA_ID.' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      });
    const m = await abrir();
    await abrirCajon(m);
    expect(m.contenedor.textContent).toContain('No se pudo preguntar por las plantillas');
    expect(m.contenedor.textContent).toContain('META_WABA_ID');
    expect(m.contenedor.textContent).not.toContain('No hay ninguna plantilla aprobada');
  });

  test('buscar filtra por una palabra del cuerpo', async () => {
    const m = await abrir();
    await abrirCajon(m);
    const buscar = m.contenedor.querySelector('input[type="text"], input:not([type])') as HTMLInputElement;
    escribir(buscar, 'S/360');
    await reposar();
    expect(opciones(m)).toHaveLength(1);
  });
});

describe('elegir una plantilla', () => {
  test('🔴 la PEGA en la caja y NO manda nada', async () => {
    const m = await abrir();
    await abrirCajon(m);
    tocar(opciones(m)[1]!); // el foro
    await reposar();

    expect(caja(m).value).toBe(FORO);
    expect(enviados).toHaveLength(0);
    expect(panel(m)).toBeNull();
  });

  test('no pisa el borrador que ella estaba escribiendo', async () => {
    const m = await abrir();
    const t = caja(m);
    escribir(t, 'Hola Javier,');
    t.selectionStart = t.value.length;
    t.dispatchEvent(new Event('select', { bubbles: true }));
    await reposar();

    await abrirCajon(m);
    tocar(opciones(m)[1]!);
    await reposar();

    expect(caja(m).value).toBe(`Hola Javier,\n${FORO}`);
  });

  test('la plantilla con hueco deja el `{{1}}` marcado en la caja de verdad', async () => {
    const m = await abrir();
    await abrirCajon(m);
    tocar(opciones(m)[0]!);
    await reposar();
    // `setSelectionRange` va en el frame siguiente (React todavía no pintó).
    await new Promise((listo) => requestAnimationFrame(listo));

    const t = caja(m);
    expect(t.value.slice(t.selectionStart!, t.selectionEnd!)).toBe('{{1}}');
  });

  test('Escape cierra el cajón y no toca la caja', async () => {
    const m = await abrir();
    await abrirCajon(m);
    const buscar = m.contenedor.querySelector('input') as HTMLInputElement;
    teclear('Escape', { target: buscar });
    await reposar();
    expect(panel(m)).toBeNull();
    expect(caja(m).value).toBe('');
  });
});

describe('la procedencia', () => {
  test('🔴 el envío declara `hsm:<nombre>` por la vía `composer-hsm`', async () => {
    const m = await abrir();
    await abrirCajon(m);
    tocar(opciones(m)[1]!);
    await reposar();

    teclear('Enter', { target: caja(m) });
    await reposar();

    expect(enviados).toHaveLength(1);
    expect(enviados[0].pieza).toMatchObject({
      clase: 'hsm',
      ref: 'foro_estado_5_ago',
      via: 'composer-hsm',
      editada: false,
    });
    // El texto que se hashea es el cuerpo APROBADO: así esta fila casa con las
    // que mandó la campaña con la misma plantilla.
    expect((enviados[0].pieza as { textoPieza: string }).textoPieza).toBe(FORO);
  });

  test('si le agrega algo, sigue siendo la misma pieza y queda marcada como editada', async () => {
    const m = await abrir();
    await abrirCajon(m);
    tocar(opciones(m)[1]!);
    await reposar();

    const t = caja(m);
    escribir(t, `${t.value}\n¿Te reservo un lugar?`);
    await reposar();
    teclear('Enter', { target: caja(m) });
    await reposar();

    expect(enviados[0].pieza).toMatchObject({ clase: 'hsm', ref: 'foro_estado_5_ago', editada: true });
  });
});
