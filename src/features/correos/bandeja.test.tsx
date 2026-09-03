// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { escribir, montar, reposar, tocar, type Montado } from '../../pruebas/dom';
import { VistaCorreos } from './VistaCorreos';
import type { Riel } from '../../dominio/correo';
import type { EstadoDeCorreos, HiloDeBandeja } from './tipos';

/**
 * LA BANDEJA, MONTADA DE VERDAD — que los botones hagan lo que dicen.
 *
 * ══ 🔴 POR QUÉ ESTE ARCHIVO EXISTE ══════════════════════════════════════════
 *
 * Porque la galería de evidencia **no prueba nada de esto**. Ahí el server es un
 * stub que contesta `{}` a cualquier POST, así que archivar, destacar y tirar a
 * la papelera «funcionan» en la foto sin que nadie haya comprobado que mandan el
 * pedido correcto — ni que lo mandan. Es exactamente el molde del defecto que ya
 * se pagó dos veces en este repo: `onCorreo` dibujaba «Escribirle» y **nadie se
 * la pasaba nunca** (`puenteCorreo.test.ts`), y el Escape global se perdió con
 * `escapeDePopover` testeada hasta el hueso, porque el defecto estaba en el
 * CABLEADO y no en la regla (ADR 0024).
 *
 * Así que acá **no se mira la pantalla: se espía lo que SALE**. Un botón que se
 * dibuja perfecto y no manda nada es indistinguible de uno que anda, y es el modo
 * de falla más caro que tiene una lista de acciones.
 *
 * ⚠️ Lo que este archivo **no** puede cubrir es que el server haga lo correcto
 * con ese pedido: eso vive en `server/src/correos/bandeja.test.db.ts`, que
 * necesita Postgres. Los dos hacen falta y ninguno reemplaza al otro.
 */

let montado: Montado | null = null;

/** Lo que la vista le pidió al server, en orden. */
const pedidos: { url: string; metodo: string; cuerpo: Record<string, unknown> }[] = [];

const ESTADO: EstadoDeCorreos = {
  conectado: true,
  desde: 'escuela@goberna.us',
  remitentes: [
    { id: 1, direccion: 'escuela@goberna.us', nombre: 'Escuela Goberna', responderA: null, firma: null },
  ],
  sinRemitentes: false,
  supervisor: false,
  dominiosVerificados: ['goberna.us'],
  ritmo: { techoHora: 20, techoDia: 60, usadoHora: 3, usadoDia: 11 },
};

function hilo(extra: Partial<HiloDeBandeja> = {}): HiloDeBandeja {
  return {
    hilo: 'correo:1',
    id: 1,
    vendedoraId: 'luz',
    para: 'ana@correo.com',
    desde: 'Escuela Goberna <escuela@goberna.us>',
    asunto: 'El temario',
    clave: null,
    estado: 'enviado',
    motivo: null,
    creadoAt: '2026-08-22T15:40:00.000Z',
    mensajes: 1,
    sinLeer: false,
    destacado: false,
    importante: false,
    avance: 'Te paso el temario.',
    etiquetas: [],
    ...extra,
  };
}

function tokenVivo(id: string): string {
  const cuerpo = btoa(`${id}|${Date.now() + 60 * 60 * 1000}`)
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${cuerpo}.firma-que-nadie-mira-acá`;
}

const json = (cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } });

function servidor(hilos: HiloDeBandeja[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const metodo = (init?.method ?? 'GET').toUpperCase();

    if (metodo !== 'GET') {
      pedidos.push({ url: u, metodo, cuerpo: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
      // El guardado de borrador contesta con el id de la fila, que es lo que el
      // composer recuerda para que el próximo guardado PISE en vez de duplicar.
      if (u.includes('/api/correos/borrador')) return json({ ok: true, guardado: true, id: 77 });
      return json({ ok: true, tocadas: 1 });
    }
    pedidos.push({ url: u, metodo, cuerpo: {} });

    if (u.includes('/api/correos/estado')) return json(ESTADO);
    if (u.includes('/api/correos/etiquetas')) {
      return json({ etiquetas: [{ id: 7, nombre: 'Cotizaciones', color: 'azul', creadoPor: 'luz' }] });
    }
    if (u.includes('/api/correos/bandeja')) {
      // Enviados y Archivados traen filas; las demás, no. Enviados es el estado
      // real de producción —no hay ni un entrante, Hermes todavía no recibe— y
      // Archivados hace falta para poder probar la vuelta: un correo archivado
      // que no se puede sembrar es un botón que no se puede apretar.
      const riel = /riel=([a-z]+)/.exec(u)?.[1] ?? 'recibidos';
      const suyos = riel === 'enviados' || riel === 'archivados' || riel === 'borradores' ? hilos : [];
      return json({ riel, total: suyos.length, pagina: 1, hilos: suyos });
    }
    // `GET /api/correos/<id>` — la fila entera, cuerpo incluido. Es lo que la
    // lista NO trae (sirve `avance`, las primeras líneas) y lo que hace falta
    // para retomar un borrador donde se dejó.
    const porId = /\/api\/correos\/(\d+)/.exec(u);
    if (porId) {
      return json({
        correo: {
          id: Number(porId[1]),
          vendedoraId: 'luz',
          para: 'ana@correo.com',
          asunto: 'El temario',
          cuerpo: 'Ana, te paso el temario completo del diploma.',
          clave: null,
          remitenteId: 1,
          estado: 'borrador',
          motivo: null,
          creadoAt: '2026-08-25T10:00:00.000Z',
        },
      });
    }
    return json({});
  });
}

async function abrir(hilos: HiloDeBandeja[] = [hilo()], riel?: Riel): Promise<Montado> {
  localStorage.setItem('hermes.token', tokenVivo('luz'));
  vi.stubGlobal('fetch', servidor(hilos));
  montado = montar(<VistaCorreos rielInicial={riel} />);
  // La bandeja espera dos consultas y TanStack mete varios turnos del event loop
  // entre el fetch y el repintado: se espera LA CONDICIÓN, nunca una cantidad de
  // ticks (si no, el test pasa o falla según en qué orden lo corran).
  for (let i = 0; i < 30; i++) {
    if (!(montado.contenedor.textContent ?? '').includes('Cargando la bandeja')) break;
    await reposar();
  }
  return montado;
}

function botonPorTexto(m: Montado, texto: string): HTMLButtonElement | undefined {
  return [...m.contenedor.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(texto));
}

function botonPorEtiqueta(m: Montado, etiqueta: string): HTMLButtonElement | undefined {
  return [...m.contenedor.querySelectorAll('button')].find(
    (b) => b.getAttribute('aria-label') === etiqueta,
  );
}

/** Los POST a `/acciones`, que es la única puerta de las acciones. */
function acciones() {
  return pedidos.filter((p) => p.url.includes('/api/correos/acciones'));
}

beforeEach(() => {
  localStorage.clear();
  pedidos.length = 0;
});

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
  localStorage.clear();
  pedidos.length = 0;
});

describe('Redactar', () => {
  /**
   * 🔴 El composer dejó de ser la pantalla: ahora se abre. Si esto se rompe, la
   * vendedora entra a Correos y **no tiene por dónde escribir** — y la bandeja se
   * ve perfecta, así que no parece roto.
   */
  it('arranca cerrado y el botón lo abre', async () => {
    const m = await abrir();
    expect(m.contenedor.querySelector('textarea')).toBeNull();

    tocar(botonPorTexto(m, 'Redactar')!);
    await reposar();

    expect(m.contenedor.querySelector('textarea')).not.toBeNull();
    expect(m.contenedor.querySelector('input[type="email"]')).not.toBeNull();
  });

  /**
   * 🔴 HABÍA UN SEGUNDO BOTÓN QUE ABRÍA EL COMPOSER, ROTULADO «Configuración de
   * correo» (24-ago-2026). Mismo `onClick` que «Redactar», ícono de engranaje y
   * un `aria-label` que prometía una pantalla que no existe: quien lo tocaba
   * buscando la configuración se encontraba escribiendo un correo, y para un
   * lector de pantalla era la única «configuración» de la vista.
   *
   * Se borró. Este test es el candado de que no vuelva por copiar-pegar.
   */
  it('la cabecera tiene UNA sola puerta al composer', async () => {
    const m = await abrir();
    expect(botonPorEtiqueta(m, 'Configuración de correo')).toBeUndefined();

    const abrenElComposer = [...m.contenedor.querySelectorAll('button')].filter(
      (b) => (b.textContent ?? '').includes('Redactar') || b.getAttribute('title') === 'Configuración de correo',
    );
    expect(abrenElComposer).toHaveLength(1);
  });

  it('y la X lo cierra sin llevarse la bandeja puesta', async () => {
    const m = await abrir();
    tocar(botonPorTexto(m, 'Redactar')!);
    await reposar();

    tocar(botonPorEtiqueta(m, 'Cerrar el composer')!);
    await reposar();

    expect(m.contenedor.querySelector('textarea')).toBeNull();
    // La lista sigue ahí: cerrar el composer no desmonta lo de atrás.
    expect(m.contenedor.textContent).toContain('El temario');
  });

  /**
   * 🔴 **El puente desde la ficha abre el composer solo.** Sin esto, «Escribirle»
   * lleva a Correos, deja el «Para» cargado en un panel cerrado y la vendedora ve
   * una bandeja: la acción que pidió llegó, pero no hay forma de saberlo.
   */
  it('el puente desde la ficha lo abre con el destinatario puesto', async () => {
    localStorage.setItem('hermes.token', tokenVivo('luz'));
    vi.stubGlobal('fetch', servidor([hilo()]));
    montado = montar(<VistaCorreos correoInicial="ana@correo.com" claveInicial="conv:whatsapp:519" />);
    await reposar();
    await reposar();

    const para = montado.contenedor.querySelector('input[type="email"]') as HTMLInputElement | null;
    expect(para, 'el composer tendría que estar abierto por el puente').not.toBeNull();
    expect(para!.value).toBe('ana@correo.com');
  });
});

describe('el riel de carpetas', () => {
  it('pide la carpeta que se toca, y vuelve a la página 1', async () => {
    const m = await abrir();
    pedidos.length = 0;

    tocar(botonPorTexto(m, 'Archivados')!);
    await reposar();
    await reposar();

    const pedido = pedidos.find((p) => p.url.includes('riel=archivados'));
    expect(pedido, 'no pidió la carpeta que se tocó').toBeDefined();
    expect(pedido!.url).toContain('pagina=1');
  });

  /**
   * 🔴 **Recibidos está vacía y la pantalla tiene que DECIR por qué.** Una lista
   * vacía se lee «no te escribió nadie», y eso sería falso: lo que pasa es que
   * Hermes no puede recibir correo todavía. Es el mismo defecto que este módulo ya
   * tuvo con la firma que prometía y nadie pegaba.
   */
  it('Recibidos explica que Hermes todavía no recibe, en vez de mostrarse vacía', async () => {
    const m = await abrir();
    tocar(botonPorTexto(m, 'Recibidos')!);
    await reposar();
    await reposar();

    const texto = m.contenedor.textContent ?? '';
    expect(texto).toContain('Hermes todavía no recibe correo');
    expect(texto).toContain('Enviados');
  });

  it('la bandeja abre en Enviados, que es la única carpeta con algo adentro', async () => {
    const m = await abrir();
    expect(pedidos.some((p) => p.url.includes('riel=enviados'))).toBe(true);
    expect(m.contenedor.textContent).toContain('El temario');
  });
});

describe('las acciones de una fila', () => {
  it('la estrella manda `destacar` sobre ESE correo', async () => {
    const m = await abrir([hilo({ id: 42, destacado: false })]);
    tocar(botonPorEtiqueta(m, 'Destacar')!);
    await reposar();

    expect(acciones()).toHaveLength(1);
    expect(acciones()[0]!.cuerpo).toMatchObject({ ids: [42], accion: 'destacar' });
  });

  /** Ya destacado, el mismo botón tiene que QUITAR. Con una sola dirección, la estrella no se puede sacar. */
  it('y `no-destacar` cuando ya está puesta', async () => {
    const m = await abrir([hilo({ id: 42, destacado: true })]);
    tocar(botonPorEtiqueta(m, 'Quitar de destacados')!);
    await reposar();

    expect(acciones()[0]!.cuerpo).toMatchObject({ ids: [42], accion: 'no-destacar' });
  });

  it('archivar, eliminar y posponer mandan su propia acción', async () => {
    const m = await abrir([hilo({ id: 7 })]);

    tocar(botonPorEtiqueta(m, 'Archivar')!);
    await reposar();
    tocar(botonPorEtiqueta(m, 'Eliminar')!);
    await reposar();
    tocar(botonPorEtiqueta(m, 'Posponer')!);
    await reposar();

    expect(acciones().map((a) => a.cuerpo.accion)).toEqual(['archivar', 'papelera', 'posponer']);
    expect(acciones().every((a) => JSON.stringify(a.cuerpo.ids) === '[7]')).toBe(true);
  });

  /**
   * 🔴 **Posponer sin fecha se evapora.** El server rechaza una fecha pasada
   * porque un correo pospuesto al pasado desaparece de Recibidos Y de Pospuestos
   * a la vez, sin pantalla donde encontrarlo. Acá se fija que el front mande
   * SIEMPRE una fecha futura, para no comerse ese 400 en la cara de la vendedora.
   */
  it('posponer viaja con una fecha, y es futura', async () => {
    const m = await abrir([hilo({ id: 7 })]);
    tocar(botonPorEtiqueta(m, 'Posponer')!);
    await reposar();

    const hasta = acciones()[0]!.cuerpo.hasta;
    expect(typeof hasta).toBe('string');
    expect(new Date(String(hasta)).getTime()).toBeGreaterThan(Date.now());
  });

  it('marcar como leído y no leído son las dos direcciones del mismo botón', async () => {
    const m = await abrir([hilo({ id: 3, sinLeer: true })]);
    tocar(botonPorEtiqueta(m, 'Marcar como leído')!);
    await reposar();
    expect(acciones()[0]!.cuerpo).toMatchObject({ ids: [3], accion: 'leer' });
  });
});

describe('la selección múltiple', () => {
  const TRES = [hilo({ id: 1, hilo: 'a' }), hilo({ id: 2, hilo: 'b' }), hilo({ id: 3, hilo: 'c' })];

  function tildes(m: Montado): HTMLInputElement[] {
    return [...m.contenedor.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
  }

  /**
   * 🔴 **Las acciones masivas NO se dibujan sin selección.** Dibujarlas apagadas
   * llena la barra de botones que no hacen nada, y quien mira aprende a ignorar
   * esa zona — que es donde después va a estar lo que sí importa.
   */
  it('la barra no ofrece acciones hasta que hay algo tildado', async () => {
    const m = await abrir(TRES);
    /**
     * ⚠️ Se busca «Archivar los seleccionados» y NO «Archivar»: cada renglón monta
     * su propio botón de archivar —invisible hasta el hover, pero SIEMPRE en el
     * DOM—, así que el rótulo corto encuentra el de la fila y este test pasaría en
     * verde sin haber mirado la barra. Fue lo primero que falló al escribirlo, y
     * el arreglo no fue el test: fue desambiguar los rótulos.
     */
    expect(botonPorEtiqueta(m, 'Archivar los seleccionados')).toBeUndefined();

    tocar(tildes(m)[1]!);
    await reposar();

    expect(m.contenedor.textContent).toContain('1 seleccionado');
    expect(botonPorEtiqueta(m, 'Archivar los seleccionados')).toBeDefined();
  });

  /**
   * 🔴 EL RÓTULO DE AL LADO DEL TILDE ES UN CONTROL, NO UN CARTEL (24-ago-2026).
   *
   * Decía «Enviados» —el nombre de la carpeta, ya dicho en el riel y en el
   * buscador— y ahora dice lo que el cuadradito HACE. Un `<span>` con ese texto
   * se vería idéntico y no seleccionaría nada, que es el modo de falla más caro
   * de esta pantalla: un rótulo que nombra una acción y no la ejecuta enseña a no
   * tocar los de al lado. Por eso el test toca EL TEXTO, no el input.
   */
  it('el rótulo «Seleccionar todo» tilda las tres al tocarlo, y no nombra la carpeta', async () => {
    const m = await abrir(TRES);
    const texto = m.contenedor.textContent ?? '';
    expect(texto).toContain('Seleccionar todo');

    const rotulo = [...m.contenedor.querySelectorAll('label')].find((l) =>
      (l.textContent ?? '').includes('Seleccionar todo'),
    );
    expect(rotulo, 'tiene que ser un <label>, o tocarlo no hace nada').toBeDefined();

    tocar(rotulo!);
    await reposar();
    expect(m.contenedor.textContent).toContain('3 seleccionados');
  });

  it('«seleccionar todos» tilda las tres y la acción se las lleva en UN pedido', async () => {
    const m = await abrir(TRES);

    tocar(tildes(m)[0]!); // el de la barra: es el primero del DOM
    await reposar();
    expect(m.contenedor.textContent).toContain('3 seleccionados');

    tocar(botonPorEtiqueta(m, 'Archivar los seleccionados')!);
    await reposar();

    /**
     * ⚠️ **UN pedido con tres ids, no tres pedidos.** Con uno por correo, marcar
     * veinte son veinte llamadas que llegan desordenadas y pueden fallar de a
     * una: la lista queda a medio archivar y nada lo dice.
     */
    expect(acciones()).toHaveLength(1);
    expect(acciones()[0]!.cuerpo.ids).toEqual([1, 2, 3]);
    expect(acciones()[0]!.cuerpo.accion).toBe('archivar');
  });

  it('después de aplicar, la selección se limpia', async () => {
    const m = await abrir(TRES);
    tocar(tildes(m)[0]!);
    await reposar();

    tocar(botonPorEtiqueta(m, 'Eliminar los seleccionados')!);
    for (let i = 0; i < 10; i++) await reposar();

    expect(m.contenedor.textContent).not.toContain('seleccionados');
  });
});

describe('los rótulos de la fila y los de la barra', () => {
  /**
   * 🔴 **NO PUEDEN VOLVER A SER EL MISMO TEXTO, y esto lo destapó un test.**
   *
   * La barra masiva decía «Archivar» y cada uno de los cuarenta renglones también
   * —su botón está siempre en el DOM, sólo invisible hasta el hover—. O sea que
   * en la misma pantalla había cuarenta y un controles que se anuncian idéntico y
   * hacen cosas distintas: uno archiva ESE correo, el otro los veinte tildados.
   * Con el mouse se distinguen por dónde están; con un lector de pantalla, no se
   * distinguen de ninguna manera.
   *
   * ⚠️ El candado mira que NINGÚN rótulo de la barra sea exactamente uno de la
   * fila, en vez de fijar los textos: así se puede reescribir la redacción sin
   * tocar el test, y lo único que no se puede es volver a colapsarlos.
   */
  it('nunca se anuncian con el mismo texto', async () => {
    const m = await abrir([hilo({ id: 1, hilo: 'a' }), hilo({ id: 2, hilo: 'b' })]);

    tocar(m.contenedor.querySelector('input[type="checkbox"]')!);
    await reposar();

    const barra = m.contenedor.querySelector('[role="toolbar"]');
    expect(barra, 'la barra de acciones masivas no se dibujó').not.toBeNull();

    const deLaBarra = [...barra!.querySelectorAll('button[aria-label]')].map(
      (b) => b.getAttribute('aria-label')!,
    );
    const deLasFilas = [...m.contenedor.querySelectorAll('button[aria-label]')]
      .filter((b) => !barra!.contains(b))
      .map((b) => b.getAttribute('aria-label')!);

    expect(deLaBarra.length).toBeGreaterThan(0);
    for (const r of deLaBarra) {
      expect(
        deLasFilas.includes(r),
        `«${r}» se anuncia igual en la barra masiva y en un renglón: con un lector de pantalla ` +
          `no hay forma de saber si archiva ESE correo o los veinte tildados`,
      ).toBe(false);
    }
  });
});

describe('lo que la lista NO hace', () => {
  /**
   * 🔴 **El front no decide a qué carpeta va un correo después de una acción.**
   * Ese predicado vive una sola vez, en el server (`correos/carpetas.ts`). Si la
   * vista empezara a moverse sola la fila, existirían dos definiciones de
   * «archivado» en una frontera — #37, y divergiendo hacia ABIERTO.
   *
   * Lo que sí hace es invalidar y volver a preguntar, y eso es lo que se fija.
   */
  it('después de archivar vuelve a pedirle la carpeta al server', async () => {
    const m = await abrir([hilo({ id: 9 })]);
    pedidos.length = 0;

    tocar(botonPorEtiqueta(m, 'Archivar')!);
    for (let i = 0; i < 15; i++) await reposar();

    const volvioAPedir = pedidos.filter((p) => p.metodo === 'GET' && p.url.includes('/bandeja'));
    expect(volvioAPedir.length, 'no volvió a consultar: la lista quedaría mintiendo').toBeGreaterThan(0);
  });
});

describe('desarchivar — la vuelta que faltaba', () => {
  /**
   * ══ 🔴 QUÉ DEFECTO VIGILA ═══════════════════════════════════════════════════
   *
   * Archivar era un viaje de ida. La acción del server (`a-bandeja`) estaba
   * escrita, testeada y viva desde el primer día —es la misma que «Recuperar» de
   * la papelera— y **ninguna pantalla la ofrecía**: quien archivaba por error se
   * quedaba mirando una carpeta sin salida.
   *
   * Ése es el modo de falla que este archivo entero persigue: una capacidad
   * pagada a la que no se puede llegar **no se ve rota**. Archivados con un
   * correo adentro y sin botón para sacarlo se lee igual que Archivados
   * funcionando; nadie reporta un botón que nunca existió.
   *
   * ⚠️ Lo que se espía es el PEDIDO, no la pantalla. Un botón que se dibuja
   * perfecto y manda la acción equivocada —o no manda nada— es indistinguible de
   * uno que anda, y `a-bandeja` se parece lo suficiente a `archivar` como para
   * que un copiar-pegar deje el botón «Desarchivar» archivando otra vez.
   */
  it('🔴 la barra de Archivados ofrece la vuelta, y manda `a-bandeja`', async () => {
    const m = await abrir([hilo({ id: 4 })], 'archivados');

    tocar(m.contenedor.querySelector('input[type="checkbox"]')!);
    await reposar();

    const boton = botonPorEtiqueta(m, 'Desarchivar los seleccionados');
    expect(boton, 'sin este botón, Archivados es una carpeta sin salida').toBeDefined();

    pedidos.length = 0;
    tocar(boton!);
    for (let i = 0; i < 15; i++) await reposar();

    expect(acciones().map((p) => p.cuerpo.accion)).toEqual(['a-bandeja']);
    expect(acciones()[0]!.cuerpo.ids).toEqual([4]);
  });

  it('y de a uno desde el renglón, sin tildar nada', async () => {
    const m = await abrir([hilo({ id: 4 })], 'archivados');
    pedidos.length = 0;

    tocar(botonPorEtiqueta(m, 'Desarchivar')!);
    for (let i = 0; i < 15; i++) await reposar();

    expect(acciones().map((p) => p.cuerpo.accion)).toEqual(['a-bandeja']);
  });

  /**
   * 🔴 **LA OTRA MITAD, y sin ella el test de arriba no vale.** Un candado que
   * sólo exige que el botón EXISTA pasa en verde si alguien lo dibuja en las
   * nueve carpetas — y entonces Enviados ofrece «Desarchivar» sobre correos que
   * nunca se archivaron, que es la acción `a-bandeja` corriendo sobre filas que
   * ya están en `bandeja`: no falla, no avisa, y no hace nada. Un botón que no
   * hace nada enseña a desconfiar de la barra entera.
   */
  it('🔴 y NO aparece en Enviados, donde no hay nada que desarchivar', async () => {
    const m = await abrir([hilo({ id: 4 })]);

    tocar(m.contenedor.querySelector('input[type="checkbox"]')!);
    await reposar();

    expect(botonPorEtiqueta(m, 'Desarchivar los seleccionados')).toBeUndefined();
    expect(botonPorEtiqueta(m, 'Desarchivar')).toBeUndefined();
    // Y la de ida sigue estando: si esto se cayera, el test de arriba pasaría
    // por el motivo equivocado —la barra entera rota— sin decirlo.
    expect(botonPorEtiqueta(m, 'Archivar los seleccionados')).toBeDefined();
  });
});

describe('borradores — lo escrito deja de perderse', () => {
  /**
   * ══ 🔴 QUÉ DEFECTO VIGILA ═══════════════════════════════════════════════════
   *
   * Hasta el 25-ago-2026 cerrar el composer **tiraba lo escrito a la basura, sin
   * preguntar y sin avisar**. La carpeta Borradores estaba en el riel, con su
   * predicado en el server y su vacío dibujado, y decía «No hay borradores
   * guardados» **siempre** — porque no existía una sola línea que guardara uno.
   * Media cotización escrita se perdía con el clic más barato de la pantalla.
   *
   * ⚠️ Se espía el PEDIDO y no la pantalla, por lo mismo que el resto del
   * archivo: un composer que se cierra prolijo y no manda nada se ve exactamente
   * igual que uno que guardó bien. La diferencia sólo existe en la red.
   */
  /**
   * ⚠️ Los campos se buscan por `aria-label` y no por `type`: el de asunto **no
   * declara `type`**, así que un `input[type="text"]` no lo encuentra y el test
   * pasa a afirmar sobre un formulario a medio llenar. Costó un rojo confuso —el
   * pedido salía igual, con el asunto vacío— y por eso queda escrito.
   */
  async function llenar(m: Montado, texto: { para?: string; asunto?: string; cuerpo?: string }) {
    const campo = <T extends HTMLElement>(sel: string) => m.contenedor.querySelector<T>(sel);
    const para = campo<HTMLInputElement>('input[aria-label="Para"]');
    const asunto = campo<HTMLInputElement>('input[aria-label="Asunto"]');
    const cuerpo = campo<HTMLTextAreaElement>('textarea[aria-label="Cuerpo del correo"]');
    if (texto.para !== undefined && para) escribir(para, texto.para);
    if (texto.asunto !== undefined && asunto) escribir(asunto, texto.asunto);
    if (texto.cuerpo !== undefined && cuerpo) escribir(cuerpo, texto.cuerpo);
    await reposar();
  }

  /** Los POST a `/borrador`, que es la única puerta del guardado. */
  function guardados() {
    return pedidos.filter((p) => p.url.includes('/api/correos/borrador'));
  }

  it('🔴 cerrar con la X guarda lo escrito como borrador', async () => {
    const m = await abrir();
    tocar(botonPorTexto(m, 'Redactar')!);
    await reposar();
    await llenar(m, { para: 'ana@correo.com', asunto: 'El temario', cuerpo: 'Ana, te paso' });

    pedidos.length = 0;
    tocar(botonPorEtiqueta(m, 'Cerrar el composer')!);
    for (let i = 0; i < 20; i++) await reposar();

    expect(guardados().length, 'sin esto, cerrar tira lo escrito y nadie se entera').toBe(1);
    expect(guardados()[0]!.cuerpo).toMatchObject({
      para: 'ana@correo.com',
      asunto: 'El temario',
      cuerpo: 'Ana, te paso',
    });
  });

  it('y recién entonces se cierra el panel', async () => {
    // 🔴 El orden importa: cerrar primero y guardar después deja el guardado
    // corriendo sobre un componente desmontado. Lo que se fija es que el panel se
    // haya ido DESPUÉS de que el pedido salió, no que se haya ido.
    const m = await abrir();
    tocar(botonPorTexto(m, 'Redactar')!);
    await reposar();
    await llenar(m, { cuerpo: 'algo a medio escribir' });

    tocar(botonPorEtiqueta(m, 'Cerrar el composer')!);
    for (let i = 0; i < 20; i++) await reposar();

    expect(guardados().length).toBe(1);
    expect(m.contenedor.querySelector('textarea'), 'el panel tiene que cerrarse igual').toBeNull();
  });

  /**
   * 🔴 **LA OTRA MITAD, y sin ella el candado de arriba miente.** Un composer que
   * guarda SIEMPRE al cerrarse deja una fila vacía en Borradores por cada vez que
   * alguien lo abre y se arrepiente — que es lo más común que se hace con él. La
   * carpeta se llenaría de correos en blanco y dejaría de servir para lo único
   * que sirve.
   */
  it('🔴 pero cerrarlo sin escribir nada NO guarda nada', async () => {
    const m = await abrir();
    tocar(botonPorTexto(m, 'Redactar')!);
    await reposar();

    pedidos.length = 0;
    tocar(botonPorEtiqueta(m, 'Cerrar el composer')!);
    for (let i = 0; i < 20; i++) await reposar();

    expect(guardados(), 'una fila vacía en Borradores por cada arrepentimiento').toEqual([]);
    expect(m.contenedor.querySelector('textarea'), 'y se cierra igual').toBeNull();
  });

  /**
   * 🔴 **RETOMAR UN BORRADOR Y CERRARLO PISA ESA FILA, NO CREA OTRA.**
   *
   * El server crea cuando le llega sin `id` y actualiza cuando le llega con uno;
   * el composer manda el de la fila que retomó. Sin eso, abrir el mismo borrador
   * tres veces deja tres copias del mismo texto en la carpeta y la vendedora
   * tiene que adivinar cuál es la buena — que es peor que no tener la carpeta.
   *
   * ⚠️ **«Redactar» SÍ tiene que empezar de cero, y por eso el caso de arriba
   * afirma lo contrario para ese camino.** Son los dos lados de la misma
   * decisión: el id viaja cuando se retoma algo, nunca cuando se escribe nuevo.
   */
  it('🔴 retomar un borrador y cerrarlo manda SU id, no crea otro', async () => {
    const m = await abrir([hilo({ id: 12, estado: 'borrador' })], 'borradores');
    tocar(botonPorTexto(m, 'El temario')!);
    for (let i = 0; i < 20; i++) await reposar();

    await llenar(m, { cuerpo: 'ahora sí, la versión larga' });

    pedidos.length = 0;
    tocar(botonPorEtiqueta(m, 'Cerrar el composer')!);
    for (let i = 0; i < 20; i++) await reposar();

    expect(guardados().length).toBe(1);
    expect(guardados()[0]!.cuerpo.id, 'sin el id, Borradores junta una copia por apertura').toBe(12);
    expect(guardados()[0]!.cuerpo.cuerpo).toBe('ahora sí, la versión larga');
  });

  /**
   * ⚠️ **Y «Redactar» arranca en blanco, sin el id del anterior.** Es la otra
   * mitad: con el id pegado, escribir un correo nuevo después de haber retomado
   * uno lo guardaría COMO una versión del viejo — el nuevo se pierde y el viejo
   * se pisa con un texto que no es suyo. Dos correos rotos de un solo gesto.
   */
  it('🔴 y «Redactar» después arranca limpio, sin el id del que se retomó', async () => {
    const m = await abrir([hilo({ id: 12, estado: 'borrador' })], 'borradores');
    tocar(botonPorTexto(m, 'El temario')!);
    for (let i = 0; i < 20; i++) await reposar();
    tocar(botonPorEtiqueta(m, 'Cerrar el composer')!);
    for (let i = 0; i < 20; i++) await reposar();

    tocar(botonPorTexto(m, 'Redactar')!);
    await reposar();
    await llenar(m, { cuerpo: 'otro correo, a otra persona' });

    pedidos.length = 0;
    tocar(botonPorEtiqueta(m, 'Cerrar el composer')!);
    for (let i = 0; i < 20; i++) await reposar();

    expect(guardados().length).toBe(1);
    expect(guardados()[0]!.cuerpo.id, 'se guardaría encima del borrador anterior').toBeUndefined();
    expect(guardados()[0]!.cuerpo.cuerpo).toBe('otro correo, a otra persona');
  });

  /**
   * 🔴 **UN BORRADOR SE ABRE PARA SEGUIR ESCRIBIÉNDOLO, no para leerlo.** Es la
   * única fila de la bandeja que no es un hecho consumado: llevarla a la hoja de
   * lectura —con su cabecera de «de/para» y sin una caja donde escribir— deja a la
   * vendedora mirando su propio texto a medias sin forma de continuarlo, y la
   * carpeta sirve para acordarse de que existe y para nada más.
   */
  it('🔴 tocar un borrador lo reabre en el composer, con su texto', async () => {
    const m = await abrir([hilo({ id: 12, estado: 'borrador' })], 'borradores');

    tocar(botonPorTexto(m, 'El temario')!);
    for (let i = 0; i < 20; i++) await reposar();

    const cuerpo = m.contenedor.querySelector<HTMLTextAreaElement>('textarea');
    expect(cuerpo, 'se abrió la lectura en vez del composer: no hay dónde seguir escribiendo').not.toBeNull();
    expect(cuerpo!.value).toBe('Ana, te paso el temario completo del diploma.');
  });

  /**
   * 🔴 **Y AL MANDARLO VIAJA SU `id`, que es lo que lo saca de Borradores.** Sin
   * él, el server inserta una fila nueva y el borrador se queda donde estaba: el
   * mismo correo aparece en Borradores **y** en Enviados, y no hay nada en la
   * pantalla que explique por qué. Es la mitad de lo que se pidió — «cuando se
   * envía el correo ya pasa a enviados» — y la que no se ve rota.
   */
  it('🔴 enviar un borrador manda su `borradorId`', async () => {
    const m = await abrir([hilo({ id: 12, estado: 'borrador' })], 'borradores');
    tocar(botonPorTexto(m, 'El temario')!);
    for (let i = 0; i < 20; i++) await reposar();

    pedidos.length = 0;
    tocar(botonPorTexto(m, 'Enviar')!);
    for (let i = 0; i < 20; i++) await reposar();

    const envios = pedidos.filter((p) => p.url.includes('/api/correos/enviar'));
    expect(envios.length, 'no se mandó: el botón quedó apagado con el borrador cargado').toBe(1);
    expect(envios[0]!.cuerpo.borradorId, 'sin esto el correo queda en Borradores Y en Enviados').toBe(12);
  });
});

describe('cerrar el composer haciendo clic afuera', () => {
  /**
   * ══ 🔴 POR QUÉ ESTO NO ES «UN CLIC MÁS» ═════════════════════════════════════
   *
   * Porque es una **segunda salida** del composer, y la primera (la X) es la que
   * guarda el borrador. Dos salidas que no hacen lo mismo son la forma más
   * natural de que vuelva el defecto que los borradores vinieron a cerrar: el
   * gesto más fácil de hacer sin querer —tocar fuera del panel— sería el único
   * que tira lo escrito. Acá se fija que las dos pasen por la misma puerta.
   */
  const overlay = (m: Montado): HTMLElement =>
    m.contenedor.querySelector<HTMLElement>('[role="dialog"]')!.parentElement!;

  /** Un clic COMPLETO: `mousedown` y después `click`, como lo hace un mouse. */
  function clicEn(elemento: Element) {
    act(() => {
      elemento.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      elemento.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }

  it('🔴 cierra, y guarda lo escrito igual que la X', async () => {
    const m = await abrir();
    tocar(botonPorTexto(m, 'Redactar')!);
    await reposar();

    const cuerpo = m.contenedor.querySelector<HTMLTextAreaElement>('textarea[aria-label="Cuerpo del correo"]')!;
    escribir(cuerpo, 'a medio escribir');
    await reposar();

    pedidos.length = 0;
    clicEn(overlay(m));
    for (let i = 0; i < 20; i++) await reposar();

    expect(
      pedidos.filter((p) => p.url.includes('/api/correos/borrador')).length,
      'el clic afuera cerró sin guardar: es la salida fácil tirando lo escrito',
    ).toBe(1);
    expect(m.contenedor.querySelector('textarea')).toBeNull();
  });

  it('🔴 pero un clic ADENTRO del panel no lo cierra', async () => {
    // Sin el `stopPropagation` del panel, cualquier clic adentro burbujea hasta el
    // overlay: tocar el campo de asunto cerraría el composer. Se ve como «se cierra
    // solo apenas escribo», que nadie sabe reportar.
    const m = await abrir();
    tocar(botonPorTexto(m, 'Redactar')!);
    await reposar();

    clicEn(m.contenedor.querySelector('[role="dialog"]')!);
    for (let i = 0; i < 10; i++) await reposar();

    expect(m.contenedor.querySelector('textarea'), 'se cerró tocando adentro').not.toBeNull();
  });

  /**
   * 🔴 **EL ARRASTRE QUE EMPIEZA ADENTRO Y TERMINA AFUERA NO CIERRA.**
   *
   * Un `click` se dispara sobre el ancestro común del `mousedown` y el `mouseup`,
   * así que seleccionar texto en el textarea y pasarse del borde produce un clic
   * **sobre el overlay**. Con la versión simple del clic-afuera —la de
   * `AdminRemitentes`, que basta allá porque no hay nada que subrayar— subrayar un
   * párrafo hasta el final cierra el composer. No se pierde el texto (guarda), pero
   * te saca de lo que estabas haciendo, que en una caja de escribir es lo peor que
   * puede hacer un modal.
   */
  it('🔴 y arrastrar desde adentro hasta afuera tampoco', async () => {
    const m = await abrir();
    tocar(botonPorTexto(m, 'Redactar')!);
    await reposar();

    const cuerpo = m.contenedor.querySelector<HTMLTextAreaElement>('textarea[aria-label="Cuerpo del correo"]')!;
    act(() => {
      // Empieza adentro…
      cuerpo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      // …y el `click` cae sobre el overlay, que es el ancestro común.
      overlay(m).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    for (let i = 0; i < 10; i++) await reposar();

    expect(
      m.contenedor.querySelector('textarea'),
      'subrayar hasta pasarse del borde cerró el composer',
    ).not.toBeNull();
  });
});
