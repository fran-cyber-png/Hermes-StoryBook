// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import { COLUMNAS_TRABAJO, columnasDe } from './tablero';
import { SIN_ASIGNAR } from './lista';
import { VistaEmbudo } from './VistaEmbudo';

/**
 * EL PIPELINE, CABLEADO — lo que los tests puros de `resumen.ts` y `tablero.ts`
 * no pueden ver.
 *
 * Que la leyenda cuente bien y qué chips se ofrecen está probado en puro. Lo que
 * se fija acá es que TOCAR haga algo en las cinco columnas, y que lo que se sacó
 * de las columnas no se haya llevado la explicación con él: un recorte de la
 * mesa que la fila dibuja activo y ninguna columna aplica es exactamente la
 * clase de defecto que sólo aparece montando (ADR 0024, candado 11).
 */

const ETAPAS = ['interesado', 'sin_respuesta', 'contactado', 'cotizado', 'cierre'];
/** Todas las etapas que algún tablero pide: cada tarjeta necesita un teléfono (y una clave) propio. */
const TODAS_LAS_ETAPAS = [...ETAPAS, 'simpatiza', 'comprometido', 'voluntario'];

/** Una tarjeta con la forma que sirve la cola. */
function tarjeta(etapa: string, luz: 'verde' | 'gris', i: number) {
  const telefono = `519876${String(TODAS_LAS_ETAPAS.indexOf(etapa))}${String(i).padStart(4, '0')}`;
  return {
    clave: `conv:whatsapp:${telefono}:51984429504`,
    canal: 'whatsapp',
    tipo: 'mensaje',
    persona_id: telefono,
    persona_nombre: `Persona ${etapa} ${i}`,
    numero_propio: '51984429504',
    texto: null,
    contexto_texto: null,
    respondida: true,
    ventana_abierta: false,
    pregunto: false,
    n: 3,
    referencia: '2026-09-09T12:00:00.000Z',
    ultimo_at: '2026-09-09T12:00:00.000Z',
    dias: 1,
    nivel: 4,
    etapa_efectiva: etapa,
    luz,
    porque: luz === 'verde' ? 'preguntó precio' : 'llegó, todavía no contestó',
  };
}

/**
 * La mesa de las etapas pedidas: dos tarjetas por columna, una verde que nació
 * hoy y una gris «para seguir». Diez en total y cinco verdes, así la leyenda
 * recorta algo (la regla del cero la ofrece). En «Te esperan» la gris TAMBIÉN
 * nació hoy: esa columna dice «2 hoy», y «1 hoy» con «Verdes» puesto — que es lo
 * que prueba que el «N hoy» sigue a la luz.
 */
function desgloseDe(etapas: readonly string[]) {
  return etapas.flatMap((etapa) => [
    { etapa, yaLeHablamos: true, precio: false, viva: false, ventana: false, paraSeguir: false, luz: 'verde', nacioHoy: true, n: 1 },
    // La gris de «Te esperan» está SIN ABRIR (nadie le contestó nunca): es lo que la
    // card de ventas cuenta como «1 sin abrir».
    { etapa, yaLeHablamos: etapa !== 'interesado', precio: false, viva: false, ventana: false, paraSeguir: true, luz: 'gris', nacioHoy: etapa === 'interesado', n: 1 },
  ]);
}

/**
 * EL DESGLOSE DE `mesaPorCanal=1`: todos los canales, cada fila con el suyo. Las de
 * WhatsApp son las de siempre, y por cada etapa se suman TRES comentarios de
 * Facebook verdes que no nacieron hoy: si la mesa no filtra por el canal elegido,
 * «Verdes» da 20 en vez de 5 y cada columna 5 en vez de 2. Con el rango, el
 * desglose es del rango: sólo lo que la fake sirve ahí (las verdes).
 */
function desglosePorCanal(etapas: readonly string[], conRango: boolean) {
  const filas = [
    ...desgloseDe(etapas).map((f) => ({ ...f, canal: 'whatsapp', tipo: 'mensaje' })),
    ...etapas.map((etapa) => ({
      etapa,
      yaLeHablamos: false,
      precio: false,
      viva: false,
      ventana: false,
      paraSeguir: false,
      luz: 'verde',
      nacioHoy: false,
      canal: 'facebook',
      tipo: 'comentario',
      n: 3,
    })),
  ];
  return conRango ? filas.filter((f) => f.luz === 'verde') : filas;
}

let pedidos: string[] = [];
/** Lo que `GET /api/whatsapp/lineas` dice del rol: `true` = supervisor o admin. */
let veTodo = false;
/** ¿El server publica `recortesDisponibles` (#946)? `false` = uno que sólo sabe los cuatro de siempre. */
let servidorConRecortes = false;
/** ¿Las columnas dicen que hay más páginas? Para probar «Ver más». */
let conMas = false;
/** Si hay una promesa acá, el tablero no contesta hasta que se resuelva: para mirar la pantalla con el pedido EN VUELO. */
let retenerTablero: Promise<void> | null = null;
/** ¿El server sabe `mesaPorCanal=1` (13-sep-2026)? `false` = uno viejo: desglose de 30 d sin `canal`. */
let servidorConMesaPorCanal = true;
/** El server manda la gris ANTES que la verde (es más reciente): para ver quién reordena. */
let grisPrimero = false;
const RECORTES_DEL_SERVER = ['precio', 'ventana', 'seguir', 'seCallo', 'nacioHoy', 'escribioHoy', 'sinRespuesta24h'];
let vista: Montado | null = null;

function responder(cuerpo: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } }),
  );
}

beforeEach(() => {
  pedidos = [];
  veTodo = false;
  servidorConRecortes = false;
  conMas = false;
  retenerTablero = null;
  servidorConMesaPorCanal = true;
  grisPrimero = false;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
      pedidos.push(url);
      if (url.includes('/api/conversaciones/tablero')) {
        const q = new URL(url, 'http://hermes.test').searchParams;
        const conRango = q.get('franjaEn') === '*';
        // Un server viejo lee `*` como una columna que no existe: 400, como el real.
        if (conRango && !servidorConRecortes) {
          return Promise.resolve(new Response(JSON.stringify({ message: 'columna desconocida' }), { status: 400 }));
        }
        const columnas: Record<string, unknown> = {};
        for (const pedida of (q.get('columnas') ?? '').split(',')) {
          const [etapa, recorte] = pedida.split(':');
          // El server recorta de verdad: con «seguir» o «sin respuesta > 24 h» sólo
          // viaja la gris; con «escribió hoy» o el rango (`franjaEn=*`), la verde.
          // Cruzados, la intersección — como el server.
          const conversaciones = [tarjeta(etapa, 'verde', 0), tarjeta(etapa, 'gris', 1)].filter(
            (t) =>
              (t.luz === 'gris' || (recorte !== 'seguir' && recorte !== 'sinRespuesta24h')) &&
              (t.luz === 'verde' || (recorte !== 'escribioHoy' && !conRango)),
          );
          if (grisPrimero) conversaciones.reverse();
          columnas[etapa] = { conversaciones, total: conversaciones.length, hayMas: conMas };
        }
        const etapas = Object.keys(columnas);
        // El desglose NO se recorta por el rango: es la foto de los 30 días (#946).
        // Salvo con `mesaPorCanal=1`, donde cuenta el rango y TODOS los canales.
        const porCanal = q.get('mesaPorCanal') === '1' && servidorConMesaPorCanal;
        const cuerpo = {
          columnas,
          conteos: Object.fromEntries(etapas.map((e) => [e, 2])),
          desglose: porCanal ? desglosePorCanal(etapas, conRango) : desgloseDe(etapas),
          ...(servidorConRecortes ? { recortesDisponibles: RECORTES_DEL_SERVER } : {}),
          ...(porCanal ? { mesaPorCanal: true } : {}),
        };
        return retenerTablero ? retenerTablero.then(() => responder(cuerpo)) : responder(cuerpo);
      }
      // «Ver más» va por la cola paginada, no por el tablero.
      if (url.includes('/api/conversaciones?')) return responder({ conversaciones: [], hayMas: false });
      if (url.includes('/api/whatsapp/lineas')) return responder({ lineas: [], veTodo });
      return Promise.resolve(new Response(null, { status: 404 }));
    }) as unknown as typeof fetch,
  );
});

/**
 * Vuelve a «Tablero» para el test siguiente. ⚠️ `localStorage.removeItem` solo NO
 * alcanza: `useLocalStorage` cachea el valor en la memoria del módulo, y sin el
 * evento `storage` la Lista de un test quedaba puesta en todos los que venían
 * después — que pasaban igual, porque las filas de la Lista también son «Ver la
 * ficha». Lo destapó el primer test que mira algo que sólo tiene el Tablero.
 */
function olvidarVista() {
  try {
    window.localStorage.removeItem('hermes.embudo.vista');
  } catch {
    /* sin storage: nada que limpiar */
  }
  window.dispatchEvent(new StorageEvent('storage', { key: 'hermes.embudo.vista', newValue: null }));
}

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  olvidarVista();
});

/**
 * La `queryKey` del tablero de VENTAS sin recortes, franja ni alcance: la que
 * restaura el caché. Sin canal: la fila de canales es sólo de campaña.
 */
const claveDelTablero = (rango: string | null = null) => [
  'conversaciones',
  'tablero',
  COLUMNAS_TRABAJO.map((c) => c.id).join(','),
  '',
  rango,
  '',
];
const tableroGuardadoConRecortes = {
  columnas: {},
  conteos: {},
  desglose: [],
  recortesDisponibles: RECORTES_DEL_SERVER,
};

const tarjetas = () => [...document.querySelectorAll<HTMLElement>('[role="button"][aria-label^="Ver la ficha"]')];
const resumen = () => document.querySelector<HTMLElement>('section[aria-label="Resumen del tablero"]');
const botonDelResumen = (empieza: string) =>
  [...(resumen()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) =>
    b.textContent?.trim().startsWith(empieza),
  );
const columna = (titulo: string) => document.querySelector<HTMLElement>(`section[aria-label="${titulo}"]`);
/** Los «Todas» de las columnas: si hay alguno, las columnas están ofreciendo su recorte. */
const chipsTodas = () =>
  [...document.querySelectorAll('section[aria-label] button[aria-pressed]')].filter(
    (b) => b.textContent?.trim() === 'Todas',
  );
const leyenda = () => resumen()?.querySelector<HTMLElement>('[role="group"][aria-label^="Semáforo"]');
const habilitado = (rotulo: string) => {
  const b = botonDelResumen(rotulo);
  return b != null && b.getAttribute('aria-disabled') == null;
};
/** Los pedidos al tablero, ya leídos. */
const delTablero = () =>
  pedidos.filter((u) => u.includes('/api/conversaciones/tablero')).map((u) => new URL(u, 'http://hermes.test').searchParams);

/** Monta el Pipeline y espera a que se dibujen `cuantas` conversaciones (en tarjetas o en filas). */
async function montarTablero(props: Partial<Parameters<typeof VistaEmbudo>[0]> = {}, cuantas = 10) {
  vista = montar(<VistaEmbudo onAbrir={vi.fn()} {...props} />);
  await esperarA(
    () => tarjetas().length === cuantas || document.querySelectorAll('table tbody tr').length === cuantas,
    `las ${cuantas} conversaciones del tablero`,
  );
}

/**
 * EL CANAL DE LA MESA (13-sep-2026) — una fila de íconos que recorta las cinco
 * columnas. Nació SÓLO para campaña («estamos haciendo exclusivamente para campaña»,
 * Betto y Américo); desde el 14-sep está en las dos mesas (el `describe` de ventas,
 * abajo). Lo puro (`canalDeMesa.ts`) dice qué viaja; acá se fija que TOCAR lo mande y
 * que la mesa de campaña arranque en WhatsApp, sin Formulario.
 */
describe('VistaEmbudo — el canal (campaña)', () => {
  const iconos = () => resumen()?.querySelector<HTMLElement>('[role="group"][aria-label="Canal"]');
  const icono = (rotulo: string) =>
    [...(iconos()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) => b.getAttribute('aria-label') === rotulo);

  it('🔴 arranca en WhatsApp: el tablero se pide con `canal=whatsapp` sin tocar nada', async () => {
    await montarTablero({ esDeCampana: true });
    expect(delTablero().length).toBeGreaterThan(0);
    expect(delTablero().every((q) => q.get('canal') === 'whatsapp' && q.get('tipo') == null)).toBe(true);
    expect(icono('WhatsApp')?.getAttribute('aria-pressed')).toBe('true');
    expect(delTablero().every((q) => q.get('mesaPorCanal') === '1'), 'campaña pide el desglose por canal').toBe(true);
  });

  it('🔴 primero los mensajes, después los comentarios, y sin «Formulario»', async () => {
    await montarTablero({ esDeCampana: true });
    const rotulos = [...(iconos()?.querySelectorAll('button') ?? [])].map((b) => b.getAttribute('aria-label'));
    expect(rotulos).toEqual([
      'Todos',
      'WhatsApp',
      'Mensajes de Instagram',
      'Messenger',
      'Comentarios de Facebook',
      'Comentarios de Instagram',
    ]);
  });

  it('🔴 cada ícono pide su par canal · tipo, y «Todos» no recorta', async () => {
    await montarTablero({ esDeCampana: true });
    const casos: [string, string | null, string | null][] = [
      ['Comentarios de Instagram', 'instagram', 'comentario'],
      ['Mensajes de Instagram', 'instagram', 'mensaje'],
      ['Comentarios de Facebook', 'facebook', 'comentario'],
      ['Messenger', 'facebook', 'mensaje'],
      ['Todos', null, null],
    ];
    for (const [rotulo, canal, tipo] of casos) {
      // Se cuenta sobre `delTablero()`, no sobre `pedidos`: ése también guarda el de
      // las líneas, y cortar una lista con el índice de la otra se saltaba el pedido.
      const antes = delTablero().length;
      tocar(icono(rotulo)!);
      await esperarA(
        () => delTablero().slice(antes).some((q) => q.get('canal') === canal && q.get('tipo') === tipo),
        `el tablero pedido con «${rotulo}»`,
      );
      expect(icono(rotulo)?.getAttribute('aria-pressed'), rotulo).toBe('true');
    }
  });

  /** La maqueta del dueño: la píldora activa dice el canal con su nombre; las demás, sólo el logo. */
  it('🔴 el ícono elegido dice el nombre del canal, y los demás sólo muestran el logo', async () => {
    await montarTablero({ esDeCampana: true });
    expect(icono('WhatsApp')?.textContent).toMatch(/WhatsApp/);
    expect(icono('Messenger')?.textContent).toBe('');
    tocar(icono('Comentarios de Facebook')!);
    expect(icono('Comentarios de Facebook')?.textContent).toMatch(/Comentarios FB/);
    expect(icono('WhatsApp')?.textContent).toBe('');
  });

  /**
   * 🔴 **ENMENDADO DOS VECES.** Hasta el 13-sep-2026 ventas no tenía fila de canales;
   * ese día entró con «Todos» de arranque (#1073, que vivió un día en `desarrollo`),
   * y el 14-sep el dueño pidió «los filtros y el nuevo diseño a escuela ventas»
   * arrancando en WhatsApp, como campaña. Lo que se fija: la fila está, arranca en
   * WhatsApp y el tablero se pide con el canal Y el desglose por canal — la mecánica
   * es una sola en las dos mesas.
   */
  it('🔴 en ventas TAMBIÉN hay fila de canales, arranca en WhatsApp y pide el desglose por canal', async () => {
    await montarTablero();
    expect(iconos()).not.toBeNull();
    expect(icono('WhatsApp')?.getAttribute('aria-pressed')).toBe('true');
    expect(delTablero().every((q) => q.get('canal') === 'whatsapp' && q.get('tipo') == null)).toBe(true);
    expect(delTablero().every((q) => q.get('mesaPorCanal') === '1'), 'ventas pide el desglose por canal').toBe(true);
  });

  /** Regla del dueño, 13-sep-2026: «no debería decir preguntó precio en ningún caso para campaña». */
  it('🔴 en campaña ninguna tarjeta dice «preguntó precio», aunque el server lo mande de porqué', async () => {
    await montarTablero({ esDeCampana: true });
    expect(document.body.textContent).not.toMatch(/preguntó precio/i);
  });
});

/**
 * EL MISMO CANAL DE LA MESA, TAMBIÉN EN VENTAS (13-sep-2026 con «Todos», #1073; desde
 * el 14-sep como campaña, ADR 0103 §9). Pedido del dueño: «falta los filtros y el nuevo
 * diseño a escuela ventas, ajustémoslo bien» — WhatsApp de arranque y orden por tiempo.
 * Lo que NO cambia en ventas: las columnas de siempre, «preguntó precio», el reloj de
 * arena de la ventana y los chips de la Escuela. Lo que suma frente a campaña:
 * «Formulario», el par `landing`.
 */
describe('VistaEmbudo — el canal (ventas)', () => {
  const iconos = () => resumen()?.querySelector<HTMLElement>('[role="group"][aria-label="Canal"]');
  const icono = (rotulo: string) =>
    [...(iconos()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) => b.getAttribute('aria-label') === rotulo);

  it('🔴 ventas ofrece los mismos cinco de campaña, en el mismo orden, más Formulario al final', async () => {
    await montarTablero();
    const rotulos = [...(iconos()?.querySelectorAll('button') ?? [])].map((b) => b.getAttribute('aria-label'));
    expect(rotulos).toEqual([
      'Todos',
      'WhatsApp',
      'Mensajes de Instagram',
      'Messenger',
      'Comentarios de Facebook',
      'Comentarios de Instagram',
      'Formulario',
    ]);
  });

  it('🔴 cada ícono pide su par canal · tipo con `mesaPorCanal=1`, y «Todos» no recorta', async () => {
    await montarTablero();
    // WhatsApp va al final: es con el que arranca, y tocarlo de entrada no pide nada nuevo.
    const casos: [string, string | null, string | null][] = [
      ['Mensajes de Instagram', 'instagram', 'mensaje'],
      ['Messenger', 'facebook', 'mensaje'],
      ['Comentarios de Facebook', 'facebook', 'comentario'],
      ['Comentarios de Instagram', 'instagram', 'comentario'],
      ['Formulario', 'landing', null],
      ['Todos', null, null],
      ['WhatsApp', 'whatsapp', null],
    ];
    for (const [rotulo, canal, tipo] of casos) {
      const antes = delTablero().length;
      tocar(icono(rotulo)!);
      await esperarA(
        () => delTablero().slice(antes).some((q) => q.get('canal') === canal && q.get('tipo') === tipo),
        `el tablero de ventas pedido con «${rotulo}»`,
      );
      expect(icono(rotulo)?.getAttribute('aria-pressed'), rotulo).toBe('true');
    }
    expect(delTablero().every((q) => q.get('mesaPorCanal') === '1'), 'ventas pide siempre el desglose por canal').toBe(true);
  });

  /**
   * 🔴 **EL TEST QUE SOSTIENE LA DECISIÓN**: elegir un ícono en ventas tiene que
   * sacar de encima las tarjetas de otro canal, no sólo cambiar la URL — a
   * diferencia de la fake de `beforeEach` (que no separa conversaciones por
   * canal, porque eso lo prueban el desglose y sus cards), ésta sí reparte las
   * tarjetas por canal: es lo más parecido a lo que hace `recorteDeCanalSql` en
   * el server con `?canal=&tipo=`. Al entrar, sólo las de WhatsApp.
   */
  it('🔴 arranca con las tarjetas de WhatsApp; «Todos» trae las demás y elegir «Instagram» las vuelve a sacar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
        pedidos.push(url);
        if (url.includes('/api/conversaciones/tablero')) {
          const q = new URL(url, 'http://hermes.test').searchParams;
          const canalPedido = q.get('canal');
          const tipoPedido = q.get('tipo');
          const columnas: Record<string, unknown> = {};
          const etapas = (q.get('columnas') ?? '').split(',').map((pedida) => pedida.split(':')[0]!);
          for (const etapa of etapas) {
            // El server real recorta el `todo` ENTERO por canal (`conTodo`, sin
            // `mesaPorCanal`): acá se simula lo mismo, una de WhatsApp y otra
            // de Instagram por etapa.
            const todas = [
              { ...tarjeta(etapa, 'verde', 0), canal: 'whatsapp', tipo: 'mensaje' },
              { ...tarjeta(etapa, 'gris', 1), canal: 'instagram', tipo: 'mensaje' },
            ];
            const conversaciones = todas.filter(
              (t) => (!canalPedido || t.canal === canalPedido) && (!tipoPedido || t.tipo === tipoPedido),
            );
            columnas[etapa] = { conversaciones, total: conversaciones.length, hayMas: false };
          }
          // Un desglose NO VACÍO (aunque ventas no lo filtre por canal): con
          // `desglose: []` el tablero se lee «vacío» (`VistaEmbudo#tableroVacio`)
          // y ni siquiera dibuja las columnas — lo mostró este mismo test en rojo.
          return responder({
            columnas,
            conteos: Object.fromEntries(etapas.map((e) => [e, 2])),
            desglose: desgloseDe(etapas),
          });
        }
        if (url.includes('/api/whatsapp/lineas')) return responder({ lineas: [], veTodo: false });
        return Promise.resolve(new Response(null, { status: 404 }));
      }) as unknown as typeof fetch,
    );
    vista = montar(<VistaEmbudo onAbrir={vi.fn()} />);
    const verFicha = (nombre: string) => document.querySelector(`[aria-label="Ver la ficha de ${nombre}"]`);
    await esperarA(() => tarjetas().length === 5, 'las cinco tarjetas de WhatsApp, con las que arranca');
    expect(verFicha('Persona interesado 0'), 'la de WhatsApp, al entrar').not.toBeNull();
    expect(verFicha('Persona interesado 1'), 'la de Instagram no entra con WhatsApp puesto').toBeNull();

    tocar(icono('Todos')!);
    await esperarA(() => tarjetas().length === 10, 'las diez tarjetas de ventas (whatsapp + instagram)');
    expect(verFicha('Persona interesado 0'), 'la de WhatsApp, con «Todos»').not.toBeNull();
    expect(verFicha('Persona interesado 1'), 'la de Instagram, con «Todos»').not.toBeNull();

    tocar(icono('Mensajes de Instagram')!);
    await esperarA(
      () => delTablero().some((q) => q.get('canal') === 'instagram' && q.get('tipo') === 'mensaje'),
      'el tablero de ventas pedido con Instagram',
    );
    await esperarA(() => tarjetas().length === 5, 'sólo las cinco tarjetas de Instagram');
    expect(verFicha('Persona interesado 0'), 'la de WhatsApp desapareció').toBeNull();
    expect(verFicha('Persona interesado 1'), 'la de Instagram sigue').not.toBeNull();
  });
});

/**
 * LAS CARDS DE LAS COLUMNAS (pedido del dueño, 13-sep-2026): «en cada tarjeta superior
 * debería decir cuántos de wspp cuántos de fb o ig hay en cada columna». La cifra
 * grande es la del canal elegido; la fila de abajo, la composición de TODOS los
 * canales de esa etapa, con el elegido resaltado. Y en «Te esperan», lo del día:
 * «N nuevas hoy · N respondidos» en campaña, «N nuevas hoy · N sin abrir» en ventas
 * (desde el 14-sep-2026, «el nuevo diseño a escuela ventas»).
 */
describe('VistaEmbudo — las cards de las columnas (campaña)', () => {
  const card = (titulo: string) => columna(titulo)?.querySelector<HTMLElement>('[data-card-columna]');
  const conteo = (titulo: string, canal: string) =>
    card(titulo)?.querySelector<HTMLElement>(`[data-conteo-canal="${canal}"]`);

  it('🔴 cada columna de campaña es una card, y su cifra es la del canal elegido', async () => {
    await montarTablero({ esDeCampana: true });
    expect(document.querySelectorAll('[data-card-columna]')).toHaveLength(5);
    // WhatsApp: 2. Con los tres comentarios de Facebook de la misma etapa serían 5.
    expect(card('Respondidos')?.querySelector('[data-cifra-columna]')?.textContent).toBe('2');
  });

  it('🔴 la fila de cada card cuenta TODOS los canales de su etapa y resalta el elegido', async () => {
    await montarTablero({ esDeCampana: true });
    expect(conteo('Respondidos', 'whatsapp')?.textContent).toMatch(/(^|\D)2(\D|$)/);
    expect(conteo('Respondidos', 'facebook')?.textContent).toMatch(/(^|\D)3(\D|$)/);
    expect(conteo('Respondidos', 'messenger')?.textContent).toMatch(/(^|\D)0(\D|$)/);
    expect(conteo('Respondidos', 'whatsapp')?.getAttribute('data-elegido')).toBe('true');
    expect(conteo('Respondidos', 'facebook')?.hasAttribute('data-elegido')).toBe(false);
  });

  it('🔴 «Te esperan» dice «N nuevas hoy · N respondidos» del canal elegido, y ya no «sin abrir», «volvieron» ni «ahora»', async () => {
    await montarTablero({ esDeCampana: true });
    const cardTeEsperan = columna('Te esperan')?.querySelector<HTMLElement>('[data-card-te-esperan]');
    expect(cardTeEsperan, 'la card de «Te esperan» perdió su marca').not.toBeNull();
    const texto = cardTeEsperan?.textContent ?? '';
    expect(texto).toMatch(/(^|\D)2\s*nuevas hoy/);
    // Los dos de WhatsApp en «Respondidos», no los cinco con los de Facebook.
    expect(texto).toMatch(/(^|\D)2\s*respondidos · 30 d/);
    expect(texto).not.toMatch(/sin abrir|volvieron|ahora/);
  });

  /**
   * «¿De qué 27, si solo veo 3?» (Estephano, 13-sep-2026). Con `mesaPorCanal` el
   * desglose YA es del rango: la cifra grande es ésa, y un «de N» sólo puede venir de
   * un recorte, nunca del rango. La fake lo pone a prueba: con «Todos», el desglose
   * del rango de «Te esperan» suma 4 (1 de WhatsApp y 3 comentarios) y la columna
   * servida trae 1.
   */
  it('🔴 con «Hoy» y `mesaPorCanal`, la cifra de la columna es la del rango y no dice «de N»', async () => {
    servidorConRecortes = true;
    await montarTablero({ esDeCampana: true }, 5); // arranca en «Hoy»: la fake sirve sólo las verdes
    tocar(resumen()!.querySelector<HTMLButtonElement>('[role="group"][aria-label="Canal"] button[aria-label="Todos"]')!);
    await esperarA(
      () => delTablero().some((q) => q.get('franjaEn') === '*' && q.get('canal') == null),
      'la mesa de hoy con todos los canales',
    );
    await esperarA(() => card('Te esperan')?.querySelector('[data-cifra-columna]')?.textContent === '4', 'la cifra del rango');
    expect(card('Te esperan')?.querySelector('[data-cifra-columna]')?.parentElement?.textContent).not.toMatch(/de\s*\d/);
  });

  it('🔴 con un server viejo (sin `mesaPorCanal`) la card dice cifra y título, sin fila de canales, y los respondidos son de 30 d', async () => {
    servidorConMesaPorCanal = false;
    await montarTablero({ esDeCampana: true });
    expect(document.querySelectorAll('[data-card-columna]')).toHaveLength(5);
    expect(document.querySelectorAll('[data-conteo-canal]')).toHaveLength(0);
    expect(card('Te esperan')?.textContent).toMatch(/respondidos · 30 d/);
  });

  it('con un server que sabe de rangos y no de `mesaPorCanal`, «Hoy» sigue diciendo que el desglose es de 30 d', async () => {
    servidorConRecortes = true;
    servidorConMesaPorCanal = false;
    await montarTablero({ esDeCampana: true }, 5); // arranca en «Hoy»: la fake sirve sólo las verdes
    await esperarA(() => leyenda() != null, 'la leyenda');
    expect(leyenda()?.textContent).toMatch(/30 d/);
    expect(card('Te esperan')?.textContent).toMatch(/respondidos · 30 d/);
  });

  /**
   * 🔴 VENTAS TAMBIÉN (14-sep-2026): las cinco columnas de la Escuela son cards, con
   * Formulario en la composición, y «Te esperan» dice «N nuevas hoy · N sin abrir» —
   * lo suyo, no «respondidos» (que en ventas sería «Contestaron», la columna de al
   * lado) ni «volvieron» ni «ahora».
   */
  it('🔴 en ventas cada columna es una card, la composición suma Formulario y «Te esperan» dice «nuevas hoy · sin abrir»', async () => {
    await montarTablero();
    expect(document.querySelectorAll('[data-card-columna]')).toHaveLength(5);
    expect(card('Contestaron')?.querySelector('[data-cifra-columna]')?.textContent).toBe('2');
    expect(conteo('Contestaron', 'whatsapp')?.getAttribute('data-elegido')).toBe('true');
    expect(conteo('Contestaron', 'facebook')?.textContent).toMatch(/(^|\D)3(\D|$)/);
    expect(conteo('Contestaron', 'formulario')?.textContent).toMatch(/(^|\D)0(\D|$)/);
    const texto = columna('Te esperan')?.querySelector('[data-card-te-esperan]')?.textContent ?? '';
    expect(texto).toMatch(/(^|\D)2\s*nuevas hoy/);
    expect(texto).toMatch(/(^|\D)1\s*sin abrir/);
    expect(texto).not.toMatch(/respondid|volvieron|ahora/);
  });
});

describe('VistaEmbudo — la fila de arriba', () => {
  /**
   * «NUEVAS», no «llegaron»: «nació hoy» incluye la difusión del día (medido por
   * el frente del Dashboard: 1.800 ayer, 1.240 de Ventas Meta que nunca
   * escribieron), y el Dashboard dice «escribieron por primera vez hoy» con otro
   * predicado. Dos hechos distintos, dos palabras distintas (#37).
   */
  it('dice cuántas conversaciones son nuevas hoy y de qué tamaño es la mesa', async () => {
    await montarTablero();
    const texto = resumen()?.textContent ?? '';
    expect(texto).toMatch(/6\s*nuevas hoy/);
    expect(texto).toMatch(/10\s*en 30 días/);
  });

  it('🔴 tocar «Verdes» deja sólo verdes en LAS CINCO columnas, y tocarla otra vez las devuelve', async () => {
    await montarTablero();

    const verdes = botonDelResumen('Verdes');
    expect(verdes, 'la leyenda no ofrece «Verdes»').toBeDefined();
    tocar(verdes!);

    expect(verdes!.getAttribute('aria-pressed')).toBe('true');
    expect(tarjetas()).toHaveLength(5);
    expect(tarjetas().every((t) => t.getAttribute('data-luz') === 'verde')).toBe(true);

    tocar(verdes!);
    expect(tarjetas()).toHaveLength(10);
  });

  it('🔴 con un recorte de la mesa puesto, ninguna columna ofrece el suyo', async () => {
    await montarTablero();
    expect(chipsTodas().length, 'sin recorte de la mesa, las columnas ofrecen el suyo').toBeGreaterThan(0);

    tocar(botonDelResumen('Verdes')!);

    expect(chipsTodas()).toHaveLength(0);
  });

  /**
   * «N hoy» vivía en las cinco cabeceras (10-sep-2026). Con la card (14-sep) lo dice
   * sólo «Te esperan», como en campaña: en las demás la cifra grande YA es la del rango
   * puesto, y la mesa arranca en «Hoy».
   */
  it('🔴 «Te esperan» dice cuántas de las suyas son nuevas hoy; las demás cards no lo repiten', async () => {
    await montarTablero();
    for (const col of COLUMNAS_TRABAJO) {
      const texto = columna(col.titulo)?.querySelector('header')?.textContent ?? '';
      if (col.id === 'interesado') expect(texto, `«${col.titulo}»`).toMatch(/(^|\D)2\s*nuevas hoy/);
      else expect(texto, `«${col.titulo}»`).not.toMatch(/hoy/);
    }
  });

  it('🔴 con «Verdes» puesto, la card de «Te esperan» calla lo del día: describe otra lista', async () => {
    await montarTablero();
    tocar(botonDelResumen('Verdes')!);
    const texto = columna('Te esperan')?.querySelector('header')?.textContent ?? '';
    expect(texto).not.toMatch(/nuevas hoy|sin abrir/);
    expect(columna('Te esperan')?.querySelector('[data-cifra-columna]')?.textContent).toBe('1');
  });

  it('🔴 le dice al server desde cuándo es «hoy» para quien mira: sin eso, `nacioHoy` no llega', async () => {
    await montarTablero();
    const delTablero = pedidos.filter((u) => u.includes('/api/conversaciones/tablero'));
    expect(delTablero.length).toBeGreaterThan(0);
    expect(delTablero.every((u) => u.includes('inicioDeHoy='))).toBe(true);
  });

  /**
   * CON UN SERVER QUE NO SABE `franjaEN=*` EL RANGO NO SE TOCA — y se nota. Un
   * «Hoy» que se deja tocar ahí manda `*` como si fuera una columna: 400 del
   * tablero entero. La señal es `recortesDisponibles` (#946), no una bandera.
   */
  it('el rango: con un server sin `recortesDisponibles`, «Hoy» y «7 d» no se tocan y dicen por qué', async () => {
    await montarTablero();
    expect(botonDelResumen('30 d')?.getAttribute('aria-pressed')).toBe('true');
    for (const rotulo of ['Hoy', '7 d']) {
      const boton = botonDelResumen(rotulo);
      expect(boton?.getAttribute('aria-disabled'), `«${rotulo}»`).toBe('true');
      expect(boton?.title.length ?? 0, `«${rotulo}» sin explicación`).toBeGreaterThan(20);
    }

    const antes = pedidos.length;
    tocar(botonDelResumen('Hoy')!);
    expect(botonDelResumen('30 d')?.getAttribute('aria-pressed')).toBe('true');
    expect(pedidos.length).toBe(antes);
  });

  it('🔴 con el server nuevo, la mesa ARRANCA en «Hoy»: pide el rango de LAS CINCO columnas sin tocar nada', async () => {
    servidorConRecortes = true;
    await montarTablero({}, 5); // arranca en «Hoy»: la fake sirve sólo las verdes

    await esperarA(() => tarjetas().length === 5, 'la mesa de hoy');
    expect(botonDelResumen('Hoy')?.getAttribute('aria-pressed')).toBe('true');
    const conRango = delTablero().filter((q) => q.get('franjaEn') === '*');
    expect(conRango.length, 'ningún pedido con `franjaEn=*`').toBeGreaterThan(0);
    // Un instante con zona: una fecha pelada el server la lee como medianoche UTC.
    expect(conRango[0]!.get('desde')).toMatch(/T.*Z$/);
    expect(resumen()?.textContent).toMatch(/5\s*con mensajes hoy/);
  });

  it('🔴 detrás de «Hoy» se precargan «7 d» y «30 d», sin tocar nada, y cambiar a «30 d» ya los tiene', async () => {
    servidorConRecortes = true;
    await montarTablero({}, 5); // arranca en «Hoy»: la fake sirve sólo las verdes

    // «Hoy» y «7 d» viajan con `franjaEn=*` (distinto `desde`); «30 d», sin franja.
    const conRango = () => new Set(delTablero().filter((q) => q.get('franjaEn') === '*').map((q) => q.get('desde')));
    await esperarA(
      () => conRango().size >= 2 && delTablero().some((q) => q.get('franjaEn') == null),
      'las dos precargas: 7 d y 30 d',
    );
    expect(botonDelResumen('Hoy')?.getAttribute('aria-pressed'), 'precargar no cambia lo que se ve').toBe('true');

    const pedidosAntes = delTablero().length;
    tocar(botonDelResumen('30 d')!);
    await reposar();
    expect(tarjetas(), 'los 30 días salen de lo precargado, sin esperar el pedido').toHaveLength(10);
    expect(delTablero().length).toBeGreaterThanOrEqual(pedidosAntes);
  });

  it('con un server viejo no se precarga ningún rango: «Hoy» y «7 d» le darían 400', async () => {
    await montarTablero();
    await reposar();
    expect(delTablero().filter((q) => q.get('franjaEn') === '*').length, 'sólo el «Hoy» de arranque, que cae').toBe(1);
  });

  it('🔴 con un server viejo la mesa no queda en blanco: el «Hoy» de arranque cae a 30 días', async () => {
    await montarTablero();
    await esperarA(() => tarjetas().length === 10, 'la mesa de 30 días');
    expect(botonDelResumen('30 d')?.getAttribute('aria-pressed')).toBe('true');
  });

  /**
   * «Leído solo de la respuesta de /tablero» (el contrato con el server). El caché
   * de consultas se guarda en IndexedDB y se restaura ANTES del primer render (ADR
   * 0007): una respuesta vieja de un server que sí publicaba el campo no dice qué
   * sabe hacer el server de HOY, y encender «Hoy» con ella es mandar `franjaEn=*`
   * a uno que responde 400 al tablero entero.
   */
  it('🔴 un tablero restaurado del caché no enciende «Hoy»: sólo lo enciende una respuesta de esta visita', async () => {
    let soltar!: () => void;
    retenerTablero = new Promise<void>((r) => (soltar = r));
    vista = montar(<VistaEmbudo onAbrir={vi.fn()} />, (cliente) => {
      cliente.setQueryData(claveDelTablero(), tableroGuardadoConRecortes);
    });

    // 🔴 Con el pedido de esta visita TODAVÍA EN VUELO, que es cuando la foto del caché
    // es lo único que hay. Mirar después de la respuesta no probaba nada: la respuesta
    // fresca sin el campo ya lo había borrado (lo marcó la revisión cruzada de #956).
    await esperarA(() => delTablero().length > 0 && botonDelResumen('Hoy') != null, 'el pedido de esta visita, en vuelo');
    await reposar();
    expect(botonDelResumen('Hoy')?.getAttribute('aria-disabled')).toBe('true');

    soltar();
    await esperarA(() => tarjetas().length === 10, 'la respuesta de esta visita, de un server sin el campo');
    expect(botonDelResumen('Hoy')?.getAttribute('aria-disabled')).toBe('true');
  });

  /**
   * 🔴 LA CLAVE DEL TABLERO ES EL RANGO, NO EL INSTANTE (revisión cruzada de #956).
   * Con los instantes adentro, «7 d» movía la `queryKey` una vez por minuto: la
   * consulta más cara del repo en frío, el tablero en esqueleto y lo traído con
   * «Ver más» tirado. Los instantes se resuelven cuando SALE el pedido, como
   * `inicioDeHoy`.
   */
  it('🔴 con «7 d» puesto, que pasen dos minutos y la pantalla se repinte NO vuelve a pedir el tablero', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 10, 15, 0, 30));
    servidorConRecortes = true;
    await montarTablero({}, 5); // arranca en «Hoy»: la fake sirve sólo las verdes
    await esperarA(() => habilitado('7 d'), '«7 d» habilitado');
    tocar(botonDelResumen('7 d')!);
    await esperarA(() => tarjetas().length === 5, 'la mesa de 7 d');
    // Sólo los de «7 d»: la mesa arranca en «Hoy» y precarga los otros rangos
    // detrás, y esos pedidos pueden llegar en cualquier momento de este test.
    const HACE_SIETE_DIAS = new Date(2026, 8, 3, 15, 0, 0).getTime();
    const conRango = () =>
      delTablero().filter((q) => q.get('franjaEn') === '*' && new Date(q.get('desde')!).getTime() === HACE_SIETE_DIAS);
    await esperarA(() => conRango().length > 0, 'el pedido de 7 d');
    const antes = conRango().length;

    vi.setSystemTime(new Date(2026, 8, 10, 15, 2, 30));
    vista!.repintar(<VistaEmbudo onAbrir={vi.fn()} />);
    await reposar();

    expect(conRango().length).toBe(antes);
    expect(tarjetas()).toHaveLength(5);
  });

  /**
   * «Sin abrir» salía del desglose de 30 días, y con un rango puesto se leía como
   * parte de la lista de hoy («48 de 1.109 · 877 sin abrir»: lo mostró la captura con
   * los totales medidos). Con `mesaPorCanal` (14-sep-2026 en ventas) el desglose ES
   * del rango, así que la card lo dice en cualquier rango y es cierto; con un server
   * viejo sigue callando bajo un rango, como antes.
   */
  it('🔴 con «Hoy» puesto y el desglose del rango, «Te esperan» dice los «sin abrir» DE HOY', async () => {
    servidorConRecortes = true;
    await montarTablero({}, 5); // arranca en «Hoy»: la fake sirve sólo las verdes
    const card = () => columna('Te esperan')?.querySelector('[data-card-te-esperan]')?.textContent ?? '';
    await esperarA(() => tarjetas().length === 5, 'la mesa de hoy, con la que arranca');
    // La verde de hoy ya tiene respuesta: cero sin abrir, y se dice — es la foto del rango.
    expect(card()).toMatch(/(^|\D)0\s*sin abrir/);

    tocar(botonDelResumen('30 d')!);
    await esperarA(() => tarjetas().length === 10, 'la mesa de 30 días');
    expect(card()).toMatch(/(^|\D)1\s*sin abrir/);
    expect(card()).not.toMatch(/volvieron|ahora/);
  });

  it('con un server viejo (desglose de 30 d) «sin abrir» calla bajo un rango y vuelve en «30 d»', async () => {
    servidorConRecortes = true;
    servidorConMesaPorCanal = false;
    await montarTablero({}, 5); // arranca en «Hoy»: la fake sirve sólo las verdes
    const card = () => columna('Te esperan')?.querySelector('[data-card-te-esperan]')?.textContent ?? '';
    await esperarA(() => tarjetas().length === 5, 'la mesa de hoy, con la que arranca');
    expect(card()).not.toMatch(/sin abrir/);

    tocar(botonDelResumen('30 d')!);
    await esperarA(() => tarjetas().length === 10, 'la mesa de 30 días');
    expect(card(), 'sin rango, la card dice su desglose').toMatch(/(^|\D)1\s*sin abrir/);
  });

  /**
   * EN CAMPAÑA, con `mesaPorCanal`, el desglose ES del rango (13-sep-2026): la card
   * de «Te esperan» cuenta los respondidos DE HOY y lo dice, y la leyenda deja de
   * avisar «En 30 d», porque ya no es cierto.
   */
  it('🔴 en campaña, con un rango puesto, la card cuenta EN el rango y lo dice, y la leyenda ya no dice «En 30 d»', async () => {
    servidorConRecortes = true;
    await montarTablero({ esDeCampana: true }, 5); // arranca en «Hoy»: la fake sirve sólo las verdes
    const card = () => columna('Te esperan')?.querySelector('[data-card-te-esperan]')?.textContent ?? '';
    await esperarA(() => tarjetas().length === 5 && leyenda() != null, 'la mesa de hoy con su leyenda');
    expect(card()).toMatch(/(^|\D)1\s*respondido hoy/);
    expect(leyenda()?.textContent, 'con el desglose del rango, la leyenda no es de 30 días').not.toMatch(/30 d/);

    tocar(botonDelResumen('30 d')!);
    await esperarA(() => tarjetas().length === 10, 'la mesa de 30 días');
    expect(card()).toMatch(/(^|\D)2\s*respondidos · 30 d/);
  });

  it('🔴 con un rango puesto, tocar una luz NO cambia el rango (ni cambiar el rango la luz); y con el desglose del rango la leyenda ya no dice «30 d»', async () => {
    servidorConRecortes = true;
    await montarTablero({}, 5); // arranca en «Hoy»: la fake sirve sólo las verdes
    await esperarA(() => tarjetas().length === 5 && leyenda() != null, 'la mesa de hoy con su leyenda');

    // Con `mesaPorCanal` el desglose es del rango también en ventas (14-sep-2026): la
    // leyenda cuenta lo que se ve y dejó de avisar «En 30 d». Con un server viejo lo
    // sigue diciendo (lo fija el test de campaña de arriba, con la misma fake).
    expect(leyenda()?.textContent).not.toMatch(/30 d/);
    expect(chipsTodas()).toHaveLength(0);

    // En «Hoy» la fake sirve sólo verdes, y la regla del cero no ofrece un recorte que
    // no recorta nada: la luz se toca en «30 d» (5 de 10) y después se cambia el rango
    // con ella puesta. «Marco una luz y cambio el rango»: antes esto la apagaba.
    tocar(botonDelResumen('30 d')!);
    await esperarA(() => tarjetas().length === 10, 'la mesa de 30 días');
    tocar(botonDelResumen('Verdes')!);
    await reposar();
    expect(botonDelResumen('30 d')?.getAttribute('aria-pressed')).toBe('true');
    expect(botonDelResumen('Verdes')?.getAttribute('aria-pressed')).toBe('true');

    // Con Verdes puesto, volver a «Hoy» la conserva…
    tocar(botonDelResumen('Hoy')!);
    await esperarA(() => botonDelResumen('Verdes')?.getAttribute('aria-pressed') === 'true', '«Verdes» sigue puesto en Hoy');
    expect(botonDelResumen('Hoy')?.getAttribute('aria-pressed')).toBe('true');

    // …y pasar a 7 d también.
    tocar(botonDelResumen('7 d')!);
    // Se espera la leyenda del rango nuevo: mientras carga no se dibuja. Si el
    // rango hubiera apagado la luz, «Verdes» volvería sin marcar y esto no pasa.
    await esperarA(() => botonDelResumen('Verdes')?.getAttribute('aria-pressed') === 'true', '«Verdes» sigue puesto en 7 d');
    expect(botonDelResumen('7 d')?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('VistaEmbudo — las columnas', () => {
  /**
   * La pista de cada columna («Te contestaron y todavía no les pasaste el
   * precio») era un renglón fijo debajo del título en cuatro columnas y un (i)
   * en una sola. El dueño pidió el (i) para «Te esperan» el 27-ago-2026, y el
   * 10-sep-2026 para las cinco. Lo que se fija acá es que ninguna columna se
   * quede sin explicación cuando se saca el renglón.
   */
  it('🔴 cada columna explica qué es con su (i), y ninguna lo repite en un renglón fijo', async () => {
    await montarTablero();
    for (const col of COLUMNAS_TRABAJO) {
      const seccion = columna(col.titulo);
      const info = seccion?.querySelector('[data-pista-columna]');
      expect(info?.getAttribute('aria-label'), `«${col.titulo}» sin (i)`).toBe(col.pista);
      expect(col.pista.length, `«${col.titulo}» con la pista vacía`).toBeGreaterThan(10);
      const renglonFijo = [...(seccion?.querySelectorAll('header p') ?? [])].some(
        (p) => p.textContent?.trim() === col.pista,
      );
      expect(renglonFijo, `«${col.titulo}» repite la pista en un renglón`).toBe(false);
    }
  });

  it('🔴 ninguna columna ofrece chips de luz: el semáforo se recorta arriba, para las cinco', async () => {
    await montarTablero();
    const deColumnas = COLUMNAS_TRABAJO.flatMap((col) => [
      ...(columna(col.titulo)?.querySelectorAll('button[aria-pressed]') ?? []),
    ]);
    expect(deColumnas.length, 'las columnas no ofrecen ningún chip').toBeGreaterThan(0);
    expect(deColumnas.map((b) => b.textContent?.trim() ?? '').filter((t) => /^(Verdes|Ámbar|Grises|Rojos)/.test(t))).toEqual([]);
  });
});

/**
 * EL TABLERO DE CAMPAÑA (ADR 0063) — «los DOS tableros tienen que funcionar; nada
 * clavado a etapas de ventas». La regla pura ya lo cubre (`resumen.test.ts`); acá
 * se fija que la VISTA pida y dibuje las columnas de campaña y que la leyenda de
 * arriba las recorte igual.
 */
describe('VistaEmbudo — el tablero de campaña', () => {
  it('🔴 dibuja SUS cinco columnas, y la leyenda recorta las cinco', async () => {
    await montarTablero({ esDeCampana: true });
    const titulos = [...document.querySelectorAll('section[aria-label]')]
      .map((s) => s.getAttribute('aria-label'))
      .filter((t) => t !== 'Resumen del tablero');
    expect(titulos).toEqual(columnasDe('campana').map((c) => c.titulo));

    tocar(botonDelResumen('Verdes')!);
    expect(tarjetas()).toHaveLength(5);
  });

  it('🔴 la leyenda cuenta el canal elegido: con WhatsApp, «Verdes 5» y no los 20 que suman los comentarios de Facebook', async () => {
    await montarTablero({ esDeCampana: true });
    expect(botonDelResumen('Verdes')?.textContent).toMatch(/Verdes\s*5$/);
  });

  const primeraDe = (titulo: string) =>
    columna(titulo)?.querySelector('[role="button"][aria-label^="Ver la ficha"]')?.getAttribute('aria-label');

  it('🔴 el color no reordena: en campaña la gris más reciente queda arriba de la verde', async () => {
    grisPrimero = true;
    await montarTablero({ esDeCampana: true });
    expect(primeraDe('Te esperan')).toBe('Ver la ficha de Persona interesado 1');
  });

  it('🔴 en ventas tampoco reordena el color («por tiempo», dueño, 14-sep-2026): la gris más reciente queda arriba', async () => {
    grisPrimero = true;
    await montarTablero();
    expect(primeraDe('Te esperan')).toBe('Ver la ficha de Persona interesado 1');
  });
});

/**
 * TABLERO · LISTA — la misma mesa en dos formas. Lo que se fija es que cambiar de
 * vista no cambie la respuesta: los mismos recortes aplican en las dos.
 */
describe('VistaEmbudo — Tablero · Lista', () => {
  const botonDeVista = (rotulo: string) =>
    [...(resumen()?.querySelectorAll<HTMLButtonElement>('button[aria-pressed]') ?? [])].find(
      (b) => b.textContent?.trim() === rotulo,
    );
  const filasDeLaLista = () => [...document.querySelectorAll('table tbody tr')];

  it('🔴 «Lista» muestra lo cargado de las cinco columnas como filas, y se recuerda', async () => {
    await montarTablero();
    const lista = botonDeVista('Lista');
    expect(lista, 'sin conmutador «Lista»').toBeDefined();

    tocar(lista!);

    expect(filasDeLaLista()).toHaveLength(10);
    expect(botonDeVista('Lista')?.getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem('hermes.embudo.vista')).toBe('"lista"');
  });

  it('🔴 el recorte de la mesa aplica igual en la Lista: «Verdes» deja cinco filas', async () => {
    await montarTablero();
    tocar(botonDeVista('Lista')!);
    tocar(botonDelResumen('Verdes')!);
    expect(filasDeLaLista()).toHaveLength(5);
  });
});

/**
 * EL PUENTE DESDE EL DASHBOARD (ADR 0104) — cada cifra de «Hoy» abre el Pipeline
 * ya recortado. La traducción está probada en puro (`puentePipeline.test.ts`);
 * acá, que la pantalla la APLIQUE, una vez, y que lo que no puede aplicar lo diga.
 */
describe('VistaEmbudo — el puente desde el Dashboard', () => {
  it('🔴 {luz: verde} abre el tablero con «Verdes» puesto, y avisa que ya lo usó', async () => {
    const onConsumido = vi.fn();
    // Cinco y no diez: el puente se aplica antes del primer dibujo con datos.
    await montarTablero({ recorteInicial: { tipo: 'pipeline', recorte: { luz: 'verde' } }, onConsumido }, 5);
    await esperarA(() => botonDelResumen('Verdes')?.getAttribute('aria-pressed') === 'true', '«Verdes» puesto');
    expect(tarjetas()).toHaveLength(5);
    expect(onConsumido).toHaveBeenCalled();
  });

  it('🔴 un recorte que el server todavía no publica se AVISA en pantalla y no viaja al server', async () => {
    await montarTablero({ recorteInicial: { tipo: 'pipeline', recorte: { sinRespuesta24h: true } } });
    // El texto ENTERO del aviso, no «24 h»: el último contacto de una tarjeta
    // también lo dice, y con eso este test pasaba sin que ningún aviso se dibujara.
    await esperarA(
      () => /todavía no puede recortar por «sin respuesta hace más de 24 h»/.test(document.body.textContent ?? ''),
      'el aviso del recorte que falta',
    );
    expect(pedidos.some((u) => u.includes('sinRespuesta24h'))).toBe(false);
  });

  it('🔴 el puente con un tablero restaurado del caché y un server viejo avisa, y nunca manda `:escribioHoy`', async () => {
    vista = montar(
      <VistaEmbudo onAbrir={vi.fn()} recorteInicial={{ tipo: 'pipeline', recorte: { escribioHoy: true } }} />,
      (cliente) => cliente.setQueryData(claveDelTablero(), tableroGuardadoConRecortes),
    );
    await esperarA(
      () => /todavía no puede recortar por «escribieron por primera vez hoy»/.test(document.body.textContent ?? ''),
      'el aviso del recorte que el server de hoy no sabe hacer',
    );
    expect(pedidos.some((u) => decodeURIComponent(u).includes(':escribioHoy'))).toBe(false);
  });

  it('🔴 con el server nuevo, «sin respuesta > 24 h» del puente SE APLICA: viaja en cada columna y un chip lo quita', async () => {
    servidorConRecortes = true;
    vista = montar(
      <VistaEmbudo onAbrir={vi.fn()} recorteInicial={{ tipo: 'pipeline', recorte: { sinRespuesta24h: true } }} />,
    );
    await esperarA(
      () => delTablero().some((q) => q.get('columnas')?.split(',').every((c) => c.endsWith(':sinRespuesta24h'))),
      'el tablero pedido con el recorte en las cinco columnas',
    );
    const quitar = () =>
      [...(resumen()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) =>
        b.getAttribute('aria-label')?.includes('24 h'),
      );
    await esperarA(() => tarjetas().length === 5 && quitar() != null, 'la mesa recortada y su chip');
    expect(document.body.textContent).not.toMatch(/todavía no puede recortar/);

    tocar(quitar()!);
    await esperarA(() => tarjetas().length === 10, 'la mesa entera otra vez');
  });

  /**
   * La cifra de un recorte va en el botón que lo nombra, como «Verdes 278» en la
   * leyenda. Y con un rango puesto el server devuelve sólo la intersección: decir
   * «5 con mensajes en 7 días» hacía pasar esa cifra por el tamaño del rango (lo
   * encontró la revisión de spec en la captura).
   */
  it('🔴 con un recorte del día puesto, su chip dice cuántas deja, y la fila no hace pasar la intersección por el tamaño del rango', async () => {
    servidorConRecortes = true;
    vista = montar(
      <VistaEmbudo onAbrir={vi.fn()} recorteInicial={{ tipo: 'pipeline', recorte: { escribioHoy: true } }} />,
    );
    const chip = () =>
      [...(resumen()?.querySelectorAll('span') ?? [])].find((s) =>
        s.textContent?.startsWith('Escribieron por primera vez hoy'),
      );
    await esperarA(() => tarjetas().length === 5 && habilitado('7 d'), 'la mesa de «escribieron hoy»');
    expect(chip()?.textContent).toMatch(/·\s*5$/);

    tocar(botonDelResumen('7 d')!);
    await esperarA(
      () => delTablero().some((q) => q.get('franjaEn') === '*') && tarjetas().length === 5,
      'la mesa de 7 d con el recorte',
    );
    expect(resumen()?.textContent).not.toMatch(/con mensajes/);
    expect(chip()?.textContent).toMatch(/·\s*5$/);
  });

  it('🔴 «Ver más» trae la página siguiente de LA MISMA lista: con el rango y el recorte del día puestos', async () => {
    servidorConRecortes = true;
    conMas = true;
    vista = montar(
      <VistaEmbudo onAbrir={vi.fn()} recorteInicial={{ tipo: 'pipeline', recorte: { escribioHoy: true } }} />,
    );
    await esperarA(() => tarjetas().length === 5 && habilitado('Hoy'), 'la mesa de «escribieron hoy»');

    tocar(botonDelResumen('Hoy')!);
    await esperarA(
      () => delTablero().some((q) => q.get('franjaEn') === '*' && q.get('columnas')?.includes('interesado:escribioHoy')),
      'el rango y el recorte del día en el mismo pedido',
    );
    const verMas = () =>
      [...(columna('Te esperan')?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) =>
        b.textContent?.trim().startsWith('Ver más'),
      );
    await esperarA(() => verMas() != null, '«Ver más» en «Te esperan»');

    const antes = pedidos.length;
    tocar(verMas()!);
    await esperarA(() => pedidos.slice(antes).some((u) => u.includes('/api/conversaciones?')), 'la página siguiente');
    const q = new URL(pedidos.slice(antes).find((u) => u.includes('/api/conversaciones?'))!, 'http://hermes.test')
      .searchParams;
    expect(q.get('etapa')).toBe('interesado');
    // `GET /` pide UNA etapa: nombra ésa, nunca `*`.
    expect(q.get('franjaEn')).toBe('interesado');
    expect(q.get('desde')).toMatch(/T.*Z$/);
    expect(q.get('escribioHoy')).toBe('1');
    expect(q.get('inicioDeHoy'), '«escribió hoy» sin `inicioDeHoy` es un 400').toMatch(/T.*Z$/);
  });

  it('🔴 la línea del puente viaja al server, y se ve un chip que la quita', async () => {
    await montarTablero({ recorteInicial: { tipo: 'pipeline', linea: '51984429504' } });
    await esperarA(
      () => pedidos.some((u) => u.includes('/tablero') && u.includes('linea=51984429504')),
      'el tablero pedido con la línea',
    );
    const chip = [...(resumen()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) =>
      b.getAttribute('aria-label')?.startsWith('Quitar la línea'),
    );
    expect(chip, 'sin chip para quitar la línea').toBeDefined();

    const antes = pedidos.length;
    tocar(chip!);
    await esperarA(
      () => pedidos.slice(antes).some((u) => u.includes('/tablero') && !u.includes('linea=')),
      'el tablero pedido otra vez sin la línea',
    );
  });

  /**
   * Lo que NO entró por ninguna línea —un DM de Messenger o Instagram— no tiene
   * número propio: `linea` no lo puede nombrar, y por eso el puente trae `canal`.
   * Va con `tipo=mensaje` porque `canal=facebook` solo también trae los
   * comentarios de FB, y la cifra del Dashboard cuenta DMs.
   */
  it('🔴 el canal del puente viaja al server como DMs de ese canal, y se ve un chip que lo quita', async () => {
    await montarTablero({ recorteInicial: { tipo: 'pipeline', canal: 'instagram' } });
    await esperarA(
      () => pedidos.some((u) => u.includes('/tablero') && u.includes('canal=instagram') && u.includes('tipo=mensaje')),
      'el tablero pedido con los DMs de Instagram',
    );
    const chip = [...(resumen()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) =>
      b.getAttribute('aria-label')?.startsWith('Quitar el canal'),
    );
    expect(chip, 'sin chip para quitar el canal').toBeDefined();

    const antes = pedidos.length;
    tocar(chip!);
    await esperarA(
      () => pedidos.slice(antes).some((u) => u.includes('/tablero') && !u.includes('canal=')),
      'el tablero pedido otra vez sin el canal',
    );
  });

  it('`asignadaA: null` abre la Lista de quien supervisa en «Sin asignar»', async () => {
    veTodo = true;
    await montarTablero({ recorteInicial: { tipo: 'pipeline', asignadaA: null } });
    await esperarA(
      () => document.querySelector<HTMLSelectElement>('select[aria-label="Asignada a"]')?.value === SIN_ASIGNAR,
      'la Lista filtrada en «Sin asignar»',
    );
  });
});

/**
 * QUIÉN VE A QUIÉN ESTÁ ASIGNADA — el rol baja con las líneas (`veTodo`, la misma
 * señal que gobierna el selector de líneas de la cola, `canales/alcance.ts`), y
 * no se deduce de nada acá: una segunda regla del rol divergiría (#37).
 */
describe('VistaEmbudo — a quién está asignada', () => {
  it('🔴 quien supervisa ve la dueña de cada tarjeta, y «Sin asignar» si no la tiene nadie', async () => {
    veTodo = true;
    await montarTablero();
    await esperarA(
      () => tarjetas().every((t) => t.textContent?.includes('Sin asignar')),
      'la marca de asignación en las diez tarjetas',
    );
  });

  it('una vendedora no la ve', async () => {
    await montarTablero();
    await esperarA(() => pedidos.some((u) => u.includes('/api/whatsapp/lineas')), 'el pedido de las líneas');
    expect(tarjetas().some((t) => t.textContent?.includes('Sin asignar'))).toBe(false);
  });
});
