// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { PanelDerecho } from './PanelDerecho';

/**
 * ══ LA FICHA DICE DE DÓNDE VINO — SIEMPRE, Y CON EL NOMBRE PUESTO ══════════
 *
 * 🔴 **El defecto que esto cierra no era que faltara el dato: era que el bloque
 * entero no se dibujaba.** `EncabezadoTimeline` sólo recibía `meta` cuando había
 * un lead de FORMULARIO, así que la ficha de una conversación que llegó por un
 * anuncio de Click-to-WhatsApp —3.257 personas en producción— no decía una
 * palabra sobre su origen. Ni «vino de un anuncio», que Hermes tenía guardado
 * desde el primer mensaje, ni «no sabemos», que es la otra respuesta legítima.
 *
 * ⚠️ **Cableado, no regla** (ADR 0024). `dominio/origen.test.ts` ya prueba qué
 * contesta la función; lo que puede romperse acá es otra cosa: que nadie la
 * llame, que el hook no se dispare, o que `meta` vuelva a quedar condicionada al
 * formulario. Nada de eso lo ve un test puro.
 *
 * Los valores son los REALES de producción del 7-sep-2026.
 */

const MARIO: Conversacion = {
  clave: 'conv:whatsapp:5215521440000:5215610584485',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '5215521440000',
  persona_nombre: 'Ing. Mario Sánchez',
  numero_propio: '5215610584485',
  texto: 'si seguí tu anuncio en Facebook deberías saber qué necesito',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 8,
  referencia: '2026-09-06T19:33:24.000Z',
  ultimo_at: '2026-09-06T19:34:26.000Z',
  dias: 0,
  nivel: 3,
};

const LUIS: Conversacion = {
  ...MARIO,
  clave: 'conv:whatsapp:51913750960:51970356062',
  persona_id: '51913750960',
  persona_nombre: 'LUIS LOPEZ LOARTE',
  numero_propio: '51970356062',
  texto: 'Buenas tardes, quisiera información',
};

/**
 * Lo que devuelve `GET /api/whatsapp/conversacion/:telefono` para Luis: el
 * origen YA enriquecido por la ruta contra la Graph API — el único lugar del
 * sistema donde el `ad_id` se convierte en un nombre que se pueda leer.
 */
const HILO_DE_LUIS = {
  telefono: '51913750960',
  mensajes: [],
  origen: {
    fuente: 'anuncio',
    adId: '120249753997080789',
    titulo: '🎓 Diploma Internacional de Inteligencia y Contrainteligencia',
    anuncio: 'flyer principal',
    campana: '[SEP][DIPICOT027] Diplomado en Inteligencia 27 - Perú',
  },
};

/** Mario: la misma ruta, y el origen es `null`. Es un dato, no un hueco. */
const HILO_DE_MARIO = { telefono: '5215521440000', mensajes: [], origen: null };

let vista: Montado | null = null;
let pedidos: string[] = [];

function servir(hilo: unknown) {
  return (entrada: unknown) => {
    const url = String(entrada);
    pedidos.push(url);
    if (url.includes('/api/whatsapp/conversacion/')) {
      return Promise.resolve(
        new Response(JSON.stringify(hilo), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    // El resto falla, como en `PanelDerecho.campana.test.tsx`: lo que se prueba
    // es el origen, y el camino degradado es donde un dato que dependiera de
    // otra consulta se caería.
    return Promise.reject(new Error('sin server en el test'));
  };
}

beforeEach(() => {
  pedidos = [];
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

/** El texto de la ficha, una vez que el hilo contestó. */
async function fichaDe(conversacion: Conversacion, hilo: unknown): Promise<string> {
  vi.stubGlobal('fetch', vi.fn(servir(hilo)));
  vista = montar(<PanelDerecho conversacion={conversacion} miVendedora="luz" />);
  // Se espera el RÓTULO del renglón, no la palabra: desde la tarjeta compacta
  // (13-sep-2026) el título «Origen» ya está mientras carga, con el esqueleto adentro.
  await esperarA(
    () =>
      [...(vista?.contenedor.querySelectorAll('[data-rotulo]') ?? [])].some((e) => e.textContent === 'Origen'),
    'que la ficha dibuje el renglón de Origen',
  );
  return vista.contenedor.textContent ?? '';
}

describe('el origen en la ficha del contacto', () => {
  /**
   * 🔴 EL CANDADO DEL FRENTE, del lado de la ficha. Antes de esto, la pantalla
   * de Mario no tenía dónde decir «no sabemos»: el bloque no existía.
   */
  it('dice «Sin origen» cuando no se sabe — el caso de Mario Sánchez', async () => {
    const texto = await fichaDe(MARIO, HILO_DE_MARIO);
    expect(texto).toContain('Sin origen');
  });

  it('la ayuda del «Sin origen» explica los dos motivos, y no afirma que no hubo anuncio', async () => {
    await fichaDe(MARIO, HILO_DE_MARIO);
    const celda = [...(vista?.contenedor.querySelectorAll('[title]') ?? [])].find((e) =>
      (e.getAttribute('title') ?? '').includes('No sabemos por dónde llegó'),
    );
    const ayuda = celda?.getAttribute('title') ?? '';
    expect(ayuda).toContain('antes de que su línea se enlazara');
    expect(ayuda).toContain('sin referral');
    expect(ayuda).toContain('No quiere decir que no haya visto un anuncio');
  });

  /**
   * Acá está la mitad que la fila no puede dar: QUÉ anuncio. La fila muestra la
   * clase en dos palabras porque no tiene ancho; la ficha sí.
   *
   * ⚠️ **La celda lleva la CAMPAÑA, no el nombre del anuncio, y es a propósito.**
   * Los nombres reales de los anuncios son slugs genéricos —«flyer principal»
   * aparece en 6 anuncios distintos, «reel jarvis», «busqueda osint»— así que
   * no identifican nada; la campaña sí dice de qué oferta se trata. El nombre
   * del anuncio y el titular siguen a un hover de distancia, en el `title`, que
   * es donde un dato de auditoría pertenece.
   */
  it('con un anuncio resuelto la celda lleva la campaña, y el nombre queda en la ayuda', async () => {
    const texto = await fichaDe(LUIS, HILO_DE_LUIS);
    expect(texto).toContain('Anuncio');
    expect(texto).toContain('[SEP][DIPICOT027] Diplomado en Inteligencia 27 - Perú');
    const ayudas = [...(vista?.contenedor.querySelectorAll('[title]') ?? [])].map(
      (e) => e.getAttribute('title') ?? '',
    );
    expect(ayudas.some((a) => a.includes('«flyer principal»'))).toBe(true);
  });

  /**
   * 🔴 **EL RÓTULO NO PUEDE AFIRMAR DE MÁS, Y ACÁ SE MIRA EN LA PANTALLA.**
   * `metaDeContacto.test.ts` fija la decisión; esto fija que la decisión llegue
   * al DOM. Con el anuncio sin resolver —el 60 % de los leads de pauta— la
   * celda dice «ANUNCIO» y no «CAMPAÑA», porque lo que hay debajo es el titular
   * del creativo, no el nombre de una campaña de Meta.
   */
  it('un anuncio sin resolver se rotula «Anuncio», nunca «Campaña»', async () => {
    const hilo = {
      telefono: '59171888979',
      mensajes: [],
      origen: {
        fuente: 'anuncio',
        adId: '120253750387870341',
        titulo: 'La política no se improvisa. Se planifica.',
      },
    };
    const rafael: Conversacion = { ...LUIS, persona_id: '59171888979', persona_nombre: 'Rafael' };
    await fichaDe(rafael, hilo);
    /* 🔴 Se busca el RÓTULO de la celda, no la palabra suelta en el texto de la
       ficha: «Anuncio» aparece igual en la celda «Origen», así que un
       `textContent.toContain('Anuncio')` pasaba aunque el rótulo estuviera mal.
       Lo único que podía ponerse rojo era el `not`, y un test cuya mitad
       positiva no puede fallar es decorado. */
    // Desde el 13-sep-2026 la celda es un renglón de «De dónde viene» y su rótulo lleva
    // `data-rotulo` (antes se lo reconocía por ir en versalitas).
    const rotulos = [...(vista?.contenedor.querySelectorAll('[data-rotulo]') ?? [])].map((e) => e.textContent);
    expect(rotulos).toContain('Anuncio');
    expect(rotulos).not.toContain('Campaña');
    const celda = [...(vista?.contenedor.querySelectorAll('span') ?? [])].find(
      (e) => e.textContent === 'La política no se improvisa. Se planifica.',
    );
    expect(celda, 'el titular tiene que estar EN la celda, no sólo en el texto suelto').toBeTruthy();
  });

  /**
   * 🔴 **Este pedido no sólo LEE el nombre del anuncio: es lo que hace que
   * exista.** La ruta llama a `resolverAnuncio()` contra la Graph API y guarda
   * el resultado en `anuncio_resuelto` — el caché del que come la columna
   * «Campaña» de Contactos, que nunca pregunta. Si la ficha dejara de pedirlo,
   * el que se queda sin nombres es Contactos, y ahí nadie se enteraría.
   */
  it('pide el hilo, que es lo que dispara la resolución contra Meta', async () => {
    await fichaDe(LUIS, HILO_DE_LUIS);
    const delOrigen = pedidos.filter((p) => p.includes('/api/whatsapp/conversacion/51913750960'));
    expect(delOrigen.length).toBeGreaterThan(0);
    // Con la línea, como el chat: sin ella el server puede atribuirle a esta
    // conversación el anuncio por el que la persona entró a la OTRA (#50).
    expect(delOrigen[0]).toContain('numeroPropio=51970356062');
  });

  /** Sin teléfono no hay a quién preguntarle: no se pide, y no se cuelga. */
  it('un comentario de Facebook no pide el hilo de WhatsApp', async () => {
    vi.stubGlobal('fetch', vi.fn(servir(HILO_DE_MARIO)));
    const comentario: Conversacion = {
      ...MARIO,
      clave: 'int:9001',
      canal: 'facebook',
      tipo: 'comentario',
      persona_id: '77001',
      numero_propio: null,
    };
    vista = montar(<PanelDerecho conversacion={comentario} miVendedora="luz" />);
    await reposar();
    expect(pedidos.filter((p) => p.includes('/api/whatsapp/conversacion/'))).toHaveLength(0);
  });
});
