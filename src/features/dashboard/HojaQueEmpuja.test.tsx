// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, teclear, tocar, type Montado } from '../../pruebas/dom';
import { VistaDashboard } from './VistaDashboard';

/**
 * LA HOJA DEL DASHBOARD EMPUJA — el candado del CABLEADO, no de la regla.
 *
 * ══ QUÉ DEFECTO VIGILA ═══════════════════════════════════════════════════════
 *
 * La hoja del contacto es `absolute`: se dibuja **encima** salvo que el tablero
 * le ceda el lugar. Acá se le cede con el `padding-right` de la raíz, y eso es
 * un cable — dos valores que tienen que moverse juntos y que nada obliga a que
 * lo hagan. Los tres modos de romperlo no dan error, ni log, ni test rojo:
 *
 *  · reservar el hueco pero con OTRO número que el ancho de la hoja → se
 *    superpone unos píxeles, o queda un pasillo vacío;
 *  · abrir la hoja sin reservar nada → vuelve a tapar el radar, que es el
 *    defecto que este frente vino a cerrar;
 *  · cerrar y no devolver el ancho → el tablero se queda angosto para siempre,
 *    con una franja muerta a la derecha.
 *
 * ⚠️ **Un test puro no puede ver ninguno de los tres**: `ESPACIO_HOJA` es una
 * constante correcta en los tres casos. Lo que está mal es QUIÉN la usa y
 * CUÁNDO — que sólo se ve montando de verdad y tocando una fila (ADR 0024).
 *
 * ⚠️ **jsdom no hace layout**, así que acá NO se mide un ancho en píxeles: se
 * mira el estilo que la vista pone, que es la decisión. Que 382 px alcancen es
 * aritmética y vive escrita en `HojaContacto.tsx`; lo que este archivo fija es
 * que el hueco exista, valga lo mismo que la ventana de la hoja, y se devuelva.
 */

const CHAT = {
  clave: 'conv:whatsapp:51987654321:51986394450',
  fuente: 'chat',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51987654321',
  persona_nombre: 'Javier Peralta',
  numero_propio: '51986394450',
  texto: 'me interesa el diplomado',
  texto_clase: null,
  texto_origen: null,
  contexto_texto: null,
  telefono: '51987654321',
  pais_dato: 'Perú',
  pregunto: true,
  ventana_dias: null,
  ventana_abierta: false,
  respondida: false,
  referencia: '2026-08-24T12:00:00.000Z',
  cayo_at: '2026-08-24T12:00:00.000Z',
  seguimiento_en: null,
  seguimiento_nota: null,
  nivel: 4,
  orden: 0,
};

/** Todo endpoint contesta de mentira: este test no toca la red ni una vez. */
function fetchDePrueba(): typeof fetch {
  return vi.fn(async (entrada: RequestInfo | URL) => {
    const url = String(entrada instanceof Request ? entrada.url : entrada);
    const json = (cuerpo: unknown) =>
      new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } });

    if (url.includes('/api/whatsapp/foto/')) return new Response(null, { status: 404 });
    if (url.includes('/api/contactos/ficha')) return json({ estado: 'no_encontrado' });
    if (url.includes('/api/senales')) return json({ senales: {}, umbralDias: 3 });
    if (url.includes('/api/gestiones/intereses')) return json({ lista: [], derivados: [] });
    if (url.includes('/api/eventos')) return json({ eventos: [] });
    if (url.includes('/api/agenda')) return json({ recordatorios: [] });
    if (url.includes('/api/reparto/rueda')) return json({ linea: '51986394450', rueda: [], destinos: [], nombres: {} });
    if (url.includes('/api/whatsapp/lineas')) return json({ lineas: [] });
    if (url.includes('/api/dashboard')) {
      return json({
        chats: [CHAT],
        formularios: [],
        etapas: {},
        etiquetas: {},
        porVendedora: [],
        automaticos: null,
        embudo: {},
        cursos: [],
        series: { leads_dia: [], envios_dia: [], ventas_dia: [] },
        supervisor: false,
        soloMisAsignadas: true,
      });
    }
    return json({});
  }) as unknown as typeof fetch;
}

/**
 * UN ESCAPE ESPIADO — la única forma de ver quién se queda con la tecla.
 *
 * `useEscape` no hace `preventDefault()`: hace `stopPropagation()` en CAPTURA
 * sobre `window`. O sea que lo que distingue «la hoja se lo comió» de «siguió de
 * largo hasta el shell» no queda escrito en el evento, hay que mirar la llamada.
 */
function escapeEspiado(): { detenido: boolean } {
  const evento = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  let detenido = false;
  const original = evento.stopPropagation.bind(evento);
  evento.stopPropagation = () => {
    detenido = true;
    original();
  };
  act(() => {
    document.body.dispatchEvent(evento);
  });
  return { detenido };
}

let vista: Montado | null = null;
let fetchOriginal: typeof fetch;

beforeEach(() => {
  fetchOriginal = globalThis.fetch;
  globalThis.fetch = fetchDePrueba();
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  globalThis.fetch = fetchOriginal;
  vi.restoreAllMocks();
});

/** La raíz de la vista: la que cede el hueco. */
function raiz(): HTMLElement {
  const nodo = vista!.contenedor.firstElementChild;
  if (!(nodo instanceof HTMLElement)) throw new Error('la vista no pintó nada');
  return nodo;
}

/** La ventana que recorta la hoja — el `div` que envuelve a la ficha. */
function ventana(): HTMLElement {
  const hoja = vista!.contenedor.querySelector('[aria-label="Ficha del contacto"]');
  const nodo = hoja?.parentElement;
  if (!(nodo instanceof HTMLElement)) throw new Error('la hoja no está montada');
  return nodo;
}

async function abrirLaFicha() {
  vista = montar(
    <VistaDashboard
      onAbrir={() => {}}
      onBuscarPersona={() => {}}
      onIrAgenda={() => {}}
      miVendedora="luz"
      onMandarCorreo={() => {}}
    />,
  );
  await esperarA(
    () => Boolean(vista!.contenedor.querySelector('[role="button"][tabindex="0"]')),
    'que el radar pinte la fila de Javier',
  );
  const fila = [...vista!.contenedor.querySelectorAll<HTMLElement>('[role="button"][tabindex="0"]')].find((f) =>
    f.textContent?.includes('Javier Peralta'),
  );
  if (!fila) throw new Error('la fila de Javier no es clickeable');
  tocar(fila);
  await esperarA(
    () => Boolean(vista!.contenedor.querySelector('[aria-label="Ficha del contacto"]')),
    'que la ficha se abra al costado',
  );
}

describe('la hoja del Dashboard empuja en vez de superponerse', () => {
  it('cerrada, el tablero no cede nada: el `p-3` de siempre', async () => {
    vista = montar(
      <VistaDashboard
        onAbrir={() => {}}
        onBuscarPersona={() => {}}
        onIrAgenda={() => {}}
        miVendedora="luz"
        onMandarCorreo={() => {}}
      />,
    );
    await reposar();
    expect(raiz().style.paddingRight).toBe('');
    expect(vista.contenedor.querySelector('[aria-label="Ficha del contacto"]')).toBeNull();
  });

  it('abierta, la raíz reserva EXACTAMENTE lo que mide la ventana de la hoja', async () => {
    await abrirLaFicha();
    // El mismo valor en los dos lados o la hoja se superpone: es el cable.
    expect(raiz().style.paddingRight).not.toBe('');
    expect(raiz().style.paddingRight).toBe(ventana().style.width);
  });

  it('la raíz está posicionada: la hoja se ancla acá, no al viewport', async () => {
    await abrirLaFicha();
    // Sin `relative` el `inset-y-3` de la hoja se mide contra la ventana del
    // navegador y la ficha se dibuja por encima del header de la app.
    expect(raiz().className).toContain('relative');
  });

  it('al cerrar, el tablero recupera su ancho y la hoja se va del DOM', async () => {
    await abrirLaFicha();
    teclear('Escape');
    await reposar();

    // El hueco se devuelve YA —de eso vive la transición—, pero la hoja sigue
    // montada mientras dura, o el cierre se vería a medias.
    expect(raiz().style.paddingRight).toBe('');
    expect(ventana().style.width).toBe('0px');

    await esperarA(
      () => !vista!.contenedor.querySelector('[aria-label="Ficha del contacto"]'),
      'que la hoja se desmonte al terminar el vaivén',
    );
  });

  it('mientras se va, la hoja suelta el Escape: la tecla vuelve al shell', async () => {
    await abrirLaFicha();
    // Abierta, la hoja SE QUEDA con la tecla: es lo que la hace cerrable.
    expect(escapeEspiado().detenido).toBe(true);
    await reposar();

    // Cerrando, ya no. `useEscape` registra en CAPTURA sobre `window` y hace
    // `stopPropagation()`, así que una hoja que se está yendo pero sigue
    // escuchando se come la tecla de TODA la app —la que cierra la conversación
    // en Mensajes, la Cabina, la Libreta— hasta que termine la transición. Es
    // exactamente el defecto de ADR 0024, y volver a montarla de más para poder
    // animar el cierre es volver a ponerse en riesgo de tenerlo.
    expect(vista!.contenedor.querySelector('[aria-label="Ficha del contacto"]')).not.toBeNull();
    expect(escapeEspiado().detenido).toBe(false);
  });
});

/**
 * ══ LA FILA DEL RADAR, CUANDO EL RADAR SE ANGOSTA ═══════════════════════════
 *
 * 🔴 **ESTO ES CONSECUENCIA DIRECTA DEL EMPUJE, Y SE DESCUBRIÓ MIRANDO.** A 1180
 * —la ventana con la que abre Tauri— el radar pasa de 762 px a **380** cuando la
 * ficha se abre, y ahí la fila destapó una jerarquía puesta al revés: el nombre
 * era `shrink` y el país `shrink-0`, así que el que NO cedía era el país. Medido
 * en el navegador: la fila de un lead de landing dominicano dejaba el nombre en
 * **clientWidth 0** y decía «República Dominicana · hace 3 horas · Te espera».
 * A quién atendías no aparecía por ningún lado. Sin error, sin desborde, sin
 * scroll: la fila se veía perfecta y le faltaba el único dato que existe para dar.
 *
 * ⚠️ **Y el arreglo trae su propio modo de romperse en silencio**: los campos que
 * se guardan lo hacen con consultas de CONTENEDOR —la variante `@max-` de
 * Tailwind, con su umbral entre corchetes— y una consulta de contenedor **sin un
 * ancestro `@container` no falla — no aplica**.
 * Quedaría escrita, verde en todo test que mire la clase, y muerta en la pantalla.
 * Es el patrón de ADR 0024 otra vez: el defecto no está en la regla, está en que
 * nadie la conecta. Por eso el primer caso de acá mira el cableado y no la regla.
 *
 * ⚠️ **jsdom no resuelve container queries ni hace layout**, así que acá no se
 * mide ningún ancho: se fija QUÉ cede y en QUÉ ORDEN. Que 380 px alcancen se
 * verifica en la galería con el navegador, y los números están en
 * `docs/reglas/padron-dashboard-y-panel.md`.
 */
describe('la fila del radar cede en el orden correcto', () => {
  /** El `<span>` hoja (sin hijos) cuyo texto es exactamente `texto`. */
  function spanDe(texto: string): HTMLElement {
    const todos = [...vista!.contenedor.querySelectorAll('span')];
    const el = todos.find((s) => !s.children.length && s.textContent?.trim() === texto);
    if (!el) throw new Error(`no encontré el <span> de «${texto}» en la fila`);
    return el;
  }

  /**
   * El umbral en px de la variante que esconde por ancho de contenedor, o `null`
   * si el elemento no la lleva.
   *
   * 🔴 **ESTE COMENTARIO NO PUEDE CITAR LA CLASE ENTERA, Y CUESTA UN CI ROJO
   * APRENDERLO.** Tailwind 4 escanea el árbol como TEXTO PLANO: no distingue
   * código de prosa, así que una clase citada dentro de un comentario —con un
   * valor de ejemplo inventado, del tipo `Npx` o unos puntos suspensivos— **se
   * vuelve una clase de verdad** y Tailwind le emite su CSS. Ese CSS declara un
   * `@container (width < Npx)` que no es una media query válida, y el build
   * revienta al minificar con lightningcss.
   *
   * ⚠️ **Y no lo ve nada de lo que se corre antes de pushear**: ni `tsc`, ni
   * vitest, ni `npm run dev` —que no minifica—, ni el hook de pre-push, que
   * corre `tsc -b` y no el build. `tsc -b` NO es `npm run build`. Lo único que
   * lo destapa es `npm run build`, o sea el CI, seis minutos después.
   *
   * La regla, corta: en prosa se nombra la variante (`@max-`) y el umbral se
   * describe con palabras — nunca los dos pegados entre corchetes.
   */
  function umbralQueEsconde(el: HTMLElement): number | null {
    const m = el.className.match(/@max-\[(\d+)px\]:hidden/);
    return m ? Number(m[1]) : null;
  }

  it('el radar es un contenedor de consulta, o los `@max-` no aplican nunca', async () => {
    await abrirLaFicha();
    const radar = vista!.contenedor.querySelector('[aria-label="El radar"]');
    expect(radar).not.toBeNull();
    expect((radar as HTMLElement).className).toContain('@container');
  });

  it('el nombre NO cede: es lo único que contesta «¿a quién atiendo?»', async () => {
    await abrirLaFicha();
    const nombre = spanDe('Javier Peralta');
    // `shrink-0` y no `shrink`: con `shrink` el flex lo reparte y el nombre se
    // va a cero mientras un país `shrink-0` se queda entero al lado.
    expect(nombre.className).toContain('shrink-0');
    // Y nunca se guarda: no lleva ninguna consulta que lo esconda.
    expect(umbralQueEsconde(nombre)).toBeNull();
  });

  it('el canal se guarda ANTES que el país — el badge de la izquierda ya lo dice', async () => {
    await abrirLaFicha();
    const canal = umbralQueEsconde(spanDe('WhatsApp'));
    const pais = umbralQueEsconde(spanDe('Perú'));
    expect(canal).not.toBeNull();
    expect(pais).not.toBeNull();
    // Umbral más alto = se guarda primero, porque se va apagando al angostarse.
    expect(canal!).toBeGreaterThan(pais!);
  });

  it('el país cede antes de guardarse: trunca, no empuja', async () => {
    await abrirLaFicha();
    const pais = spanDe('Perú');
    expect(pais.className).toContain('truncate');
    expect(pais.className).toMatch(/(^|\s)shrink(\s|$)/);
    // El dato entero sigue disponible mientras se dibuja recortado.
    expect(pais.getAttribute('title')).toBe('Perú');
  });
});
