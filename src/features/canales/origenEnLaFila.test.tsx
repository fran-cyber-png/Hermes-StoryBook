// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { montar, reposar, type Montado } from '../../pruebas/dom';
import { ColaUnificada } from './ColaUnificada';

/**
 * ══ EL ORIGEN LLEGA A LA PANTALLA — CABLEADO, NO REGLA (ADR 0024) ══════════
 *
 * 🔴 **`dominio/origen.test.ts` ya prueba que la función contesta bien, y eso
 * no dice NADA sobre si la vendedora lo ve.** Ésa es la lección que este repo
 * ya pagó dos veces: `escapeDePopover.ts` estaba testeada hasta el hueso y la
 * app perdió el Escape global porque el defecto estaba en el cableado, y el
 * chip de etapa no se dibujó nunca durante 28 días con su regla en verde.
 *
 * Y acá el riesgo es peor que en esos dos, porque el defecto que este frente
 * arregla **era exactamente eso**: `whatsapp/origen.ts` capturaba el anuncio
 * desde siempre, la cola lo servía en `origen_anuncio`, y la fila lo dibujaba
 * sólo cuando el último mensaje no traía texto. La regla estaba bien; nadie la
 * llamaba donde importaba.
 *
 * ── Los datos son los REALES de producción del 7-sep-2026 ──────────────────
 * · Luis López Loarte — ad 120249753997080789, resuelto contra Meta.
 * · Rafael — ad 120253750387870341, SIN resolver (el 60 % de los leads de pauta).
 * · Ing. Mario Sánchez — `origen` nulo en sus 8 mensajes. El caso del reclamo.
 */

let montado: Montado | null = null;
const fetchOriginal = globalThis.fetch;

const BASE = {
  canal: 'whatsapp',
  tipo: 'mensaje',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 3,
  dias: 1,
  nivel: 3,
  ultimo_at: new Date().toISOString(),
  referencia: new Date().toISOString(),
};

/** Vino de un anuncio que Meta ya nombró. */
const LUIS = {
  ...BASE,
  clave: 'conv:whatsapp:51913750960:51970356062',
  persona_id: '51913750960',
  persona_nombre: 'LUIS LOPEZ LOARTE',
  numero_propio: '51970356062',
  texto: 'Buenas tardes, quisiera información',
  origen_anuncio: {
    fuente: 'anuncio',
    adId: '120249753997080789',
    titulo: '🎓 Diploma Internacional de Inteligencia y Contrainteligencia',
  },
};

/** Mismo hecho, sin que nadie le haya preguntado a Meta todavía. */
const RAFAEL = {
  ...BASE,
  clave: 'conv:whatsapp:59171888979:59178814740',
  persona_id: '59171888979',
  persona_nombre: 'Rafael',
  numero_propio: '59178814740',
  texto: 'Hola',
  origen_anuncio: {
    fuente: 'anuncio',
    adId: '120253750387870341',
    titulo: 'La política no se improvisa. Se planifica.',
  },
};

/**
 * EL CASO DEL RECLAMO: ocho mensajes, `origen` nulo en los ocho. Antes de este
 * frente su fila era, en este punto, idéntica a la de alguien que sí vino de
 * pauta — y ese silencio es lo que se leyó como «no vino de ningún lado».
 */
const MARIO = {
  ...BASE,
  clave: 'conv:whatsapp:5215521440000:5215610584485',
  persona_id: '5215521440000',
  persona_nombre: 'Ing. Mario Sánchez',
  numero_propio: '5215610584485',
  texto: 'si seguí tu anuncio en Facebook deberías saber qué necesito',
  origen_anuncio: null,
  ultima_origen: null,
};

/** Un comentario de Facebook: su origen es la publicación, no una etiqueta. */
const COMENTARIO = {
  ...BASE,
  clave: 'int:9001',
  canal: 'facebook',
  tipo: 'comentario',
  clave_persona: null,
  persona_id: '77001',
  persona_nombre: 'Ana Ruiz',
  numero_propio: null,
  texto: 'Precio?',
  contexto_texto: 'Diplomado en Inteligencia 27',
  n: 1,
};

function servirCola(filas: unknown[]) {
  return (entrada: RequestInfo | URL) => {
    const url = String(entrada);
    if (url.includes('/api/conversaciones?')) {
      return Promise.resolve(
        new Response(JSON.stringify({ conversaciones: filas, total: filas.length, hayMas: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ message: 'no' }), { status: 404 }));
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', servirCola([LUIS]));
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.stubGlobal('fetch', fetchOriginal);
});

/** Varios turnos: la cola es `useInfiniteQuery` con media docena de satélites. */
async function pintar(filas: unknown[]) {
  vi.stubGlobal('fetch', servirCola(filas));
  montado = montar(<ColaUnificada seleccionada={null} onSeleccionar={() => {}} miVendedora="luz" />);
  for (let i = 0; i < 6; i++) await reposar();
  return montado.contenedor;
}

/** La píldora de origen, buscada por su marca — no por su texto ni por su color. */
function pildora(contenedor: HTMLElement): HTMLElement | null {
  return contenedor.querySelector('[data-origen]');
}

describe('la etiqueta de origen en la fila de la cola', () => {
  it('dice «Anuncio» cuando la conversación vino de un anuncio', async () => {
    const contenedor = await pintar([LUIS]);
    expect(contenedor.textContent).toContain('LUIS LOPEZ LOARTE');
    expect(pildora(contenedor)?.getAttribute('data-origen')).toBe('anuncio');
    expect(pildora(contenedor)?.textContent).toContain('Anuncio');
  });

  /**
   * 🔴 EL CANDADO DEL FRENTE. Antes, esta fila no decía absolutamente nada del
   * origen — ni siquiera que no se supiera. Si este test se pone rojo, lo que
   * se rompió es la promesa entera: «siempre dice de dónde viene».
   */
  it('dice «Sin origen» cuando NO se sabe — el caso de Mario Sánchez', async () => {
    const contenedor = await pintar([MARIO]);
    expect(contenedor.textContent).toContain('Ing. Mario Sánchez');
    expect(pildora(contenedor)?.getAttribute('data-origen')).toBe('desconocido');
    expect(pildora(contenedor)?.textContent).toContain('Sin origen');
  });

  it('la ayuda del «Sin origen» explica los dos motivos, ahí mismo en la fila', async () => {
    const contenedor = await pintar([MARIO]);
    const ayuda = pildora(contenedor)?.getAttribute('title') ?? '';
    expect(ayuda).toContain('antes de que su línea se enlazara');
    expect(ayuda).toContain('sin referral');
  });

  /**
   * El fallback medido: 1.954 de 3.257 leads de pauta llegan sin nombre
   * resuelto. Un `adId` de 18 dígitos en la fila sería ilegible — va al `title`.
   */
  it('un anuncio sin resolver sigue diciendo «Anuncio», y el adId sólo se lee en la ayuda', async () => {
    const contenedor = await pintar([RAFAEL]);
    const chip = pildora(contenedor);
    expect(chip?.textContent).toContain('Anuncio');
    expect(chip?.textContent).not.toContain('120253750387870341');
    expect(chip?.getAttribute('title')).toContain('120253750387870341');
    expect(chip?.getAttribute('title')).toContain('La política no se improvisa');
  });

  it('un comentario NO lleva etiqueta de origen: la fila ya muestra su publicación', async () => {
    const contenedor = await pintar([COMENTARIO]);
    expect(contenedor.textContent).toContain('Ana Ruiz');
    expect(pildora(contenedor)).toBeNull();
    expect(contenedor.textContent).not.toContain('Sin origen');
  });

  /**
   * ⚠️ Que las tres convivan importa: lo que la vendedora compara es una fila
   * contra la de al lado, y el valor de «Sin origen» es que se distinga de un
   * «Anuncio» sin tener que abrir ninguna de las dos.
   */
  it('en la misma lista, cada fila dice lo suyo', async () => {
    const contenedor = await pintar([LUIS, RAFAEL, MARIO]);
    const clases = [...contenedor.querySelectorAll('[data-origen]')].map((e) =>
      e.getAttribute('data-origen'),
    );
    expect(clases).toEqual(['anuncio', 'anuncio', 'desconocido']);
  });
});
