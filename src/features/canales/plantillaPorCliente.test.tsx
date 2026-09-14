// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { escribir, esperarA, montar, reposar, type Montado } from '../../pruebas/dom';
import ResponderPanel from './ResponderPanel';
import type { Interaccion } from './types';
import type { Conversacion } from '../../dominio/conversaciones';
import { olvidarUltimaPlantilla } from '../../dominio/plantillaPublica';

/**
 * NINGÚN TEXTO DE UN CLIENTE LE APARECE A OTRO — el CABLEADO, montando el panel.
 *
 * Medido en producción el 11-sep-2026, en la Página de Américo (22:45 a 23:07
 * UTC): de 27 respuestas públicas, 13 llevaban el texto de la Escuela y 14 las
 * frases que se escribieron para Betto, 6 de ellas con «…trabajando por un solo
 * Áncash». El panel elegía la sugerencia sin mirar de quién es la Página.
 *
 * Los fragmentos van copiados literales del incidente y NO importados de la
 * lista: si vinieran de ahí, cambiar la lista cambiaría también lo que el test
 * busca, y el test no podría decir nunca que algo se coló.
 */
const DE_LA_ESCUELA = 'te mandamos el programa completo con fechas y precios';
const DE_BETTO = [
  'Seguimos trabajando con la convicción',
  'Gracias por acompañarnos en este camino',
  'trabajando por un solo Áncash',
];

const COMENTARIO: Interaccion = {
  id: 1,
  canal: 'facebook',
  tipo: 'comentario',
  persona_nombre: null,
  texto: 'Fuerza Américo',
  contexto_texto: null,
  occurred_at: new Date(1_700_000_000_000).toISOString(),
  status: 'pendiente',
  pide_info: false,
  ventana_abierta: true,
  dias: 1,
};

const CONVERSACION: Conversacion = {
  clave: 'int:1',
  canal: 'facebook',
  tipo: 'comentario',
  persona_id: null,
  persona_nombre: null,
  numero_propio: null,
  texto: 'Fuerza Américo',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: COMENTARIO.occurred_at,
  ultimo_at: COMENTARIO.occurred_at,
  dias: 1,
  nivel: 2,
};

/** De quién es la Página, tal como lo contesta `/puede-privado`. Vacío = un server que no lo dice. */
let pagina: { modulo?: 'ventas' | 'campana'; cliente?: string | null };
let puedePrivado: boolean;
let vista: Montado;
/** Si está, `/puede-privado` no contesta hasta que se resuelva: la vendedora alcanza a escribir antes. */
let demora: Promise<void> | null;

beforeEach(() => {
  olvidarUltimaPlantilla();
  demora = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/puede-privado') && demora) await demora;
      const cuerpo = u.includes('/puede-privado')
        ? { puede: puedePrivado, motivo: puedePrivado ? null : 'ventana-cerrada', dias: 3, ...pagina }
        : u.includes('/contexto')
          ? { post: null, adjunto: null, estado: {} }
          : { permalink: null };
      return new Response(JSON.stringify(cuerpo), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vista?.desmontar();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function sugerida(): Promise<string> {
  vista = montar(
    <ResponderPanel interaccion={COMENTARIO} conversacion={CONVERSACION} onCerrar={() => {}} onRespondido={() => {}} />,
  );
  await reposar();
  return (vista.contenedor.querySelectorAll('textarea')[0] as HTMLTextAreaElement).value;
}

const ajenos = (texto: string, fragmentos: readonly string[]) => fragmentos.filter((f) => texto.includes(f));

for (const puede of [true, false]) {
  test(`🔴 un cliente de campaña sin textos propios (americo) abre la caja pública vacía — con privado ${puede ? 'posible' : 'imposible'}`, async () => {
    pagina = { modulo: 'campana', cliente: 'americo' };
    puedePrivado = puede;

    const texto = await sugerida();

    expect(ajenos(texto, [DE_LA_ESCUELA, ...DE_BETTO])).toEqual([]);
    expect(texto).toBe('');
  });
}

for (const puede of [true, false]) {
  test(`🔴 la Escuela no ve textos de campaña — con privado ${puede ? 'posible' : 'imposible'}`, async () => {
    pagina = { modulo: 'ventas', cliente: null };
    puedePrivado = puede;

    expect(ajenos(await sugerida(), DE_BETTO)).toEqual([]);
  });
}

test('🔴 Betto no ve el texto de la Escuela aunque no se pueda el privado', async () => {
  pagina = { modulo: 'campana', cliente: 'betto' };
  puedePrivado = false;

  expect(ajenos(await sugerida(), [DE_LA_ESCUELA])).toEqual([]);
});

test('🔴 si el server no dice de quién es la Página, la caja queda vacía', async () => {
  pagina = {};
  puedePrivado = true;

  expect(await sugerida()).toBe('');
});

/**
 * 🔴 LA SUGERENCIA NO PISA LO QUE LA VENDEDORA YA ESCRIBIÓ.
 *
 * `/puede-privado` puede tardar —si no está cacheado le pregunta a Meta— y la caja
 * pública ya está en pantalla. Pisarla al llegar la respuesta ya pasaba con las
 * frases sorteadas; con Américo, que no tiene textos, la caja se VACIABA y lo que la
 * agente había escrito a mano se perdía.
 */
for (const cliente of ['americo', 'betto']) {
  test(`🔴 lo escrito antes de que conteste /puede-privado no se borra — ${cliente}`, async () => {
    pagina = { modulo: 'campana', cliente };
    puedePrivado = true;
    let soltar = () => {};
    demora = new Promise<void>((listo) => {
      soltar = listo;
    });

    vista = montar(
      <ResponderPanel interaccion={COMENTARIO} conversacion={CONVERSACION} onCerrar={() => {}} onRespondido={() => {}} />,
    );
    await reposar();
    const [caja, cajaPrivada] = vista.contenedor.querySelectorAll<HTMLTextAreaElement>('textarea');
    escribir(caja, 'Gracias por el apoyo, un abrazo.');
    soltar();
    await esperarA(() => !cajaPrivada.placeholder.startsWith('Viendo si Meta'), 'que conteste /puede-privado');
    await reposar();

    expect(caja.value).toBe('Gracias por el apoyo, un abrazo.');
  });
}

/**
 * 🔴 REGLA DEL DUEÑO (12-sep-2026, por hermes-c5): «no debería decir nada de Áncash o
 * cosas relacionadas a Betto» en nada de Américo. Vale para cualquier cliente de
 * campaña que no sea `betto`, y para todo lo que el panel le ofrece a quien responde:
 * la caja pública, la privada, sus placeholders y el texto a la vista.
 *
 * ⚠️ **El azar va CLAVADO en tres puntos**, porque de las tres frases de Betto sólo
 * una dice «Áncash»: con el sorteo suelto, el panel de antes pasaba este test dos de
 * cada tres veces.
 *
 * 🔴 **Se siembran los dos candidatos a la vez** (candado 7). Si con Betto no
 * apareciera ninguna de las palabras, el test no estaría probando nada.
 */
const DE_BETTO_O_ANCASH = /[áÁaA]ncash|betto|barrionuevo|huaraz|chimbote/iu;

test('🔴 a un cliente de campaña que no es betto no se le ofrece nada de Betto ni de Áncash', async () => {
  const visto: Record<'betto' | 'americo', string[]> = { betto: [], americo: [] };

  for (const cliente of ['betto', 'americo'] as const) {
    for (const azar of [0, 0.5, 0.99]) {
      olvidarUltimaPlantilla();
      const clavado = vi.spyOn(Math, 'random').mockReturnValue(azar);
      pagina = { modulo: 'campana', cliente };
      for (const puede of [true, false]) {
        puedePrivado = puede;
        vista = montar(
          <ResponderPanel interaccion={COMENTARIO} conversacion={CONVERSACION} onCerrar={() => {}} onRespondido={() => {}} />,
        );
        await reposar();
        const cajas = [...vista.contenedor.querySelectorAll<HTMLTextAreaElement>('textarea')];
        visto[cliente].push(
          [vista.contenedor.textContent ?? '', ...cajas.map((c) => c.value), ...cajas.map((c) => c.placeholder)].join('\n'),
        );
        vista.desmontar();
      }
      clavado.mockRestore();
    }
  }

  expect(visto.betto.some((t) => DE_BETTO_O_ANCASH.test(t)), 'con Betto sembrado, alguna palabra tiene que aparecer').toBe(true);
  expect(visto.americo.map((t) => t.match(DE_BETTO_O_ANCASH)?.[0]).filter(Boolean)).toEqual([]);
});
