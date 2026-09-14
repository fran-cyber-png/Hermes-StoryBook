// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, reposar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { PanelDerecho } from './PanelDerecho';

/**
 * EL PANEL EN EL MÓDULO DE CAMPAÑAS — y lo que se fija es el CABLEADO.
 *
 * 🔴 **Lo que este test ve y ninguno puro puede ver**: que las consultas no se
 * DISPAREN. La decisión («campaña no tiene Cerberus») vive en un booleano y es
 * trivial de testear sola; el defecto que muerde es el de ADR 0024 — el hook
 * queda cableado igual y el panel de un operador de campaña se llena de 403 al
 * pedir la ficha, los intereses y el lead. Se mira el `fetch`, no la pantalla.
 *
 * 🔴 **Y tiene DOS MITADES a propósito.** Un test que sólo comprueba que en
 * campaña no se pide nada pasa en verde si alguien rompe el panel entero y
 * nunca pide nada para nadie. Por eso la segunda mitad exige que en ventas SÍ
 * se pida: lo que se fija es la diferencia, no la ausencia.
 */

const CONTACTO: Conversacion = {
  clave: 'conv:whatsapp:51987654321:51963139984',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51987654321',
  persona_nombre: 'Javier Peralta',
  numero_propio: '51963139984',
  texto: null,
  contexto_texto: null,
  respondida: false,
  ventana_abierta: false,
  pregunto: false,
  n: 0,
  referencia: '2026-08-05T14:00:00.000Z',
  ultimo_at: '2026-08-05T14:00:00.000Z',
  dias: 0,
  nivel: 5,
};

let vista: Montado | null = null;
let pedidos: string[] = [];

beforeEach(() => {
  pedidos = [];
  // Todo falla: es el estado más parecido a la app sin server, y react-query lo
  // absorbe (retry: false). Lo que importa acá es QUÉ se pidió, no qué volvió.
  vi.stubGlobal(
    'fetch',
    vi.fn((url: unknown) => {
      pedidos.push(String(url));
      return Promise.reject(new Error('sin server en el test'));
    }),
  );
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

/**
 * Las rutas que `modulos/modulo.ts` declara de `ventas` y este panel usa.
 *
 * 🔴 **`/api/contactos/registro` SALIÓ DE ESTA LISTA EL 23-AGO-2026, y no es que
 * se afloje el test: es que la ruta cambió de lado.** La ficha rápida escribe en
 * `contacto_ficha`, una tabla de Hermes, y no consulta Cerberus ni icarus — es
 * CRM genérico y ahora la comparten los dos módulos. Estuvo un día y medio acá:
 * entró el 21-ago porque su ausencia había escondido un 403 real, y el arreglo
 * de entonces fue apagar el hook. Eso trataba el síntoma. Medido el 23-ago en
 * producción: `contacto_ficha` tenía **1 fila en toda la base** y **cero** de los
 * 18 operadores de la campaña de Betto — nunca les funcionó.
 *
 * ⚠️ **Sacarla de acá sin más habría dejado el test más débil**, así que la
 * afirmación se INVIRTIÓ en vez de borrarse: hay un caso propio que exige que la
 * ficha rápida se pida en LOS DOS módulos. Ver «la ficha rápida es de los dos».
 */
/*
 * 🔴 #1033 (12-sep-2026): `/api/contactos/ficha` y `/api/contactos/lead` SALIERON
 * de esta lista porque el panel ya no las pide al abrirse — las reemplaza UNA
 * consulta de perfil armada en Hermes, que sigue siendo de `ventas`. La
 * afirmación no se aflojó: cambió de ruta, y `PanelDerecho.perfil.test.tsx`
 * fija además que las tres viejas no vuelvan.
 */
const DE_VENTAS = ['/api/contactos/perfil', '/api/gestiones/intereses'];

/** Lo que se pide en los dos lados: CRM genérico, sin ERP detrás. */
const DE_LOS_DOS = ['/api/contactos/registro', '/api/senales'];

describe('el panel derecho en campaña', () => {
  it('🔴 no pide NADA de Cerberus', async () => {
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="centurion:betto.romero" esDeCampana />);
    await reposar();
    for (const ruta of DE_VENTAS) {
      expect(
        pedidos.filter((p) => p.includes(ruta)),
        `pidió «${ruta}», que para campaña es 403`,
      ).toHaveLength(0);
    }
  });

  /**
   * 🔴 **LA MITAD QUE REEMPLAZA A LA QUE SE SACÓ DE `DE_VENTAS`.** Sin este caso,
   * mover `/api/contactos/registro` de lista sería sólo dejar de mirarla, y el
   * modo de fallar más probable —que alguien vuelva a apagar `useFichaLocal` en
   * campaña «para no comerse un 403»— pasaría en verde otra vez.
   *
   * Se exige en LOS DOS módulos y en el mismo test a propósito: lo que se fija es
   * que acá NO hay diferencia, que es justo lo contrario de lo que fija el resto
   * de este archivo.
   */
  it('🔴 la ficha rápida es de los dos: se pide en campaña Y en ventas', async () => {
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="centurion:betto.romero" esDeCampana />);
    await reposar();
    for (const ruta of DE_LOS_DOS) {
      expect(
        pedidos.filter((p) => p.includes(ruta)).length,
        `«${ruta}» no se pidió en campaña: es CRM genérico, no toca Cerberus`,
      ).toBeGreaterThan(0);
    }
    vista.desmontar();

    pedidos = [];
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" />);
    await reposar();
    for (const ruta of DE_LOS_DOS) {
      expect(pedidos.filter((p) => p.includes(ruta)).length, `«${ruta}» no se pidió en ventas`).toBeGreaterThan(0);
    }
  });

  it('y tampoco dibuja la ficha de Cerberus', async () => {
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="centurion:betto.romero" esDeCampana />);
    await reposar();
    expect(vista.contenedor.textContent).not.toContain('Ficha de Cerberus');
  });

  /**
   * 🔴 #1033 — EL PERFIL ES DE VENTAS DE GOBERNA, no de Betto ni de Américo
   * (pedido del dueño, 13-sep-2026).
   *
   * Aunque en campaña la consulta de perfil no sale, el bloque se armaba igual con
   * la etapa y la última actividad: «Perfil · Está en «Simpatiza».» en el panel de
   * un operador de campaña. Dos mitades: si el bloque desapareciera para todos,
   * «no está en campaña» pasaría en verde igual.
   */
  it('🔴 el bloque «Perfil» no se dibuja en campaña, y en ventas sí', async () => {
    vista = montar(
      <PanelDerecho conversacion={{ ...CONTACTO, etapa_efectiva: 'simpatiza' }} miVendedora="centurion:betto.romero" esDeCampana />,
    );
    await reposar();
    expect(vista.contenedor.querySelector('section[aria-label="Perfil"]'), 'en campaña no hay perfil de ventas').toBeNull();
    vista.desmontar();

    vista = montar(<PanelDerecho conversacion={{ ...CONTACTO, etapa_efectiva: 'interesado' }} miVendedora="luz" />);
    await reposar();
    expect(vista.contenedor.querySelector('section[aria-label="Perfil"]'), 'en ventas el perfil tiene que estar').not.toBeNull();
  });

  /**
   * ⚠️ El estado de la banda **no puede decir «no figura en Cerberus»**: sería
   * cierto por casualidad y engañoso, porque nadie preguntó. Tampoco puede
   * decir que el canal no trae teléfono, con el teléfono ahí al lado.
   */
  it('la banda no afirma nada sobre Cerberus', async () => {
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="centurion:betto.romero" esDeCampana />);
    await reposar();
    const texto = vista.contenedor.textContent ?? '';
    expect(texto).not.toContain('No se pudo saber');
    expect(texto).not.toContain('Buscando en Cerberus');
    expect(texto).not.toContain('este canal no lo trae');
  });

  /**
   * 🔴 EL SKELETON QUE NO TERMINABA NUNCA — reportado como «el detalle del
   * contacto se demora tanto en cargar».
   *
   * No se demoraba: no iba a cargar. En React Query **v5** el estado `idle` no
   * existe, así que una query con `enabled: false` se queda en
   * `status: 'pending'` **para siempre** — y el panel dibujaba las dos barras de
   * `BloqueMetaSkeleton` con `lead.isPending`, que en campaña era `true` eterno.
   *
   * Las dos mitades importan más que de costumbre acá: la de ventas usa un
   * `fetch` que **nunca resuelve**, o sea la query EN VUELO de verdad. Sin ella,
   * «no hay skeleton en campaña» pasaría también si alguien borrara el skeleton
   * del panel — y entonces en ventas nadie vería que la ficha está cargando.
   *
   * 🔴 **LA MITAD DE CAMPAÑA CAMBIÓ DE CONTACTO EL 7-SEP-2026, Y ESO LA HACE
   * MÁS FUERTE, NO MÁS FLOJA.** Decía «en campaña el lead-form no se pide, así
   * que no puede haber un skeleton suyo», y esa frase daba por sentado que el
   * bloque de meta salía SÓLO del formulario. Desde que «Origen» se dibuja
   * siempre (`dominio/origen.ts`), el bloque también espera al hilo de WhatsApp
   * —que en campaña **sí** se pide, porque no toca Cerberus—, así que ahí un
   * esqueleto es correcto: hay una consulta en vuelo de verdad y termina.
   *
   * Lo que se fija ahora es **exactamente la propiedad que causó el bug**: una
   * consulta APAGADA no puede dibujar un esqueleto. Por eso el caso de campaña
   * usa un comentario de Facebook, donde `useLeadForm` y `useOrigenWa` están
   * las DOS apagadas (sin teléfono no hay a quién preguntarle) — con la lectura
   * vieja de `isPending`, ese panel se quedaría pulsando para siempre. Antes el
   * candado cubría una consulta apagada; ahora cubre dos.
   */
  it('🔴 en campaña NO hay skeleton eterno, y en ventas el skeleton sí aparece mientras carga', async () => {
    // Un server que acepta la request y no contesta jamás: la query queda
    // `pending` + `fetching`, que es «cargando» de verdad.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    /** Sin teléfono: las dos consultas del bloque de meta quedan apagadas. */
    const SIN_TELEFONO: Conversacion = {
      ...CONTACTO,
      clave: 'int:9001',
      canal: 'facebook',
      tipo: 'comentario',
      persona_id: '77001',
      numero_propio: null,
    };
    vista = montar(<PanelDerecho conversacion={SIN_TELEFONO} miVendedora="centurion:betto.romero" esDeCampana />);
    await reposar();
    expect(
      vista.contenedor.querySelectorAll('[data-esqueleto="meta"]'),
      'las dos consultas del bloque están APAGADAS: un esqueleto acá no espera a nadie',
    ).toHaveLength(0);
    vista.desmontar();

    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" />);
    await reposar();
    expect(
      vista.contenedor.querySelectorAll('[data-esqueleto="meta"]').length,
      'en ventas, con la ficha en vuelo, el skeleton tiene que verse',
    ).toBeGreaterThan(0);
  });

  /**
   * 🔴 **LA TERCERA MITAD, y existe porque cambiar el contacto del caso de
   * arriba dejó de mirar el que sí tiene teléfono.** En campaña, con teléfono,
   * ahora SÍ hay una consulta en vuelo legítima (el hilo de WhatsApp, que no
   * toca Cerberus), así que el esqueleto es correcto — lo que no puede ser
   * correcto es que **sobreviva a que esa consulta conteste**. Con la lectura
   * vieja (`isPending`) el de campaña no terminaba nunca; con `isLoading`
   * termina, y eso es lo que se fija acá.
   */
  it('🔴 en campaña CON teléfono el esqueleto aparece y después se va', async () => {
    let contestar: ((r: Response) => void) | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: unknown) =>
        String(url).includes('/api/whatsapp/conversacion/')
          ? new Promise<Response>((listo) => {
              contestar = listo;
            })
          : Promise.reject(new Error('sin server en el test')),
      ),
    );

    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="centurion:betto.romero" esDeCampana />);
    await reposar();
    expect(
      vista.contenedor.querySelectorAll('[data-esqueleto="meta"]').length,
      'con el hilo en vuelo, el bloque de meta todavía no sabe qué decir',
    ).toBeGreaterThan(0);

    contestar!(
      new Response(JSON.stringify({ telefono: CONTACTO.persona_id, mensajes: [], origen: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await esperarA(
      () => vista!.contenedor.querySelectorAll('[data-esqueleto="meta"]').length === 0,
      'que el esqueleto del bloque de meta se vaya cuando el hilo contesta',
    );
    // Y lo que queda dicho es la respuesta, no un hueco.
    expect(vista.contenedor.textContent).toContain('Sin origen');
  });

  /**
   * 🔴 **LA REGLA GENERAL DETRÁS DE AQUEL BUG, y es la que había que escribir.**
   *
   * El candado de arriba mira UN esqueleto por su nombre. Éste mira la propiedad
   * que hacía eterno a aquél: *ningún esqueleto del panel puede sobrevivir a que
   * las consultas contesten*. La diferencia con «el server tarda» es la que
   * costó el bug: una query **apagada** (`enabled: false`) se queda `pending`
   * para siempre por construcción, así que su esqueleto no espera a nadie.
   *
   * Se corre en los DOS módulos: en campaña hay tres consultas apagadas, que es
   * donde puede volver a pasar, y en ventas ninguna — si el test sólo mirara
   * campaña, no distinguiría «se arregló» de «se borraron los esqueletos».
   */
  it('🔴 ningún esqueleto sobrevive a que el server conteste — en los dos módulos', async () => {
    // Un server que contesta vacío a todo: nada queda legítimamente en vuelo.
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ficha: null, eventos: [], correos: [], senales: {}, etiquetas: {}, categorias: [], recordatorios: [], distritos: [], conteos: {} }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    );

    for (const campana of [true, false]) {
      vista = montar(
        <PanelDerecho
          conversacion={CONTACTO}
          miVendedora={campana ? 'centurion:betto.romero' : 'luz'}
          esDeCampana={campana}
        />,
      );
      /**
       * ⚠️ `esperarA` y no un `reposar()` suelto: acá el server SÍ contesta, así
       * que hay una cadena de promesas (fetch → `.json()` → el render de React)
       * que no cabe en un turno del event loop. Con `reposar()` a secas este
       * test pasaba o fallaba según la máquina — que es el flake que
       * `esperarA` existe para no volver a escribir.
       */
      const vistaActual = vista;
      await esperarA(
        () => vistaActual.contenedor.querySelectorAll('[data-esqueleto]').length === 0,
        `que ${campana ? 'campaña' : 'ventas'} deje de mostrar esqueletos con el server contestando`,
      );
      vista.desmontar();
    }
  });

  /**
   * ⚠️ Decía «Sin ficha · La ficha de Cerberus es del módulo de ventas»: cierto
   * y ruido a la vez. Le explicaba a un operador de campaña que existe un módulo
   * de ventas cuyo ERP nunca va a ver — la frontera contada al revés.
   */
  it('🔴 en campaña no hay badge de estado, y en ventas sí', async () => {
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="centurion:betto.romero" esDeCampana />);
    await reposar();
    expect(vista.contenedor.textContent).not.toContain('Sin ficha');
    expect(vista.contenedor.textContent).not.toContain('Cerberus');
    vista.desmontar();

    pedidos = [];
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" />);
    await reposar();
    // En ventas la banda sigue diciendo algo: lo que se sacó es la afirmación
    // sobre Cerberus en campaña, no el badge del panel.
    expect(vista.contenedor.querySelectorAll('.rounded-full.border').length).toBeGreaterThan(0);
  });

  /**
   * 🔴 «POR COMPLETAR» pedía dos campos que en campaña NO SE PUEDEN COMPLETAR:
   * «Interés específico» es `/api/gestiones/intereses` y «Nombre completo» es
   * `/api/contactos/registro`, las dos 403. Y como `progreso` se calculaba sobre
   * `confirmados / (confirmados + pendientes)`, clavaban el porcentaje —33 % en
   * la captura que lo reportó— en un número que no podía subir nunca.
   *
   * ⚠️ **LA LISTA YA NO EXISTE EN NINGUNO DE LOS DOS (24-ago-2026), y por eso
   * este test cambió de SUJETO sin cambiar de intención.** Se midió que también
   * en ventas era inerte: completar los dos campos dejaba el 0 % y la lista
   * igual. Lo que la reemplazó fue «Quién es», y desde el 13-sep-2026 la
   * tarjeta de identidad de la cabecera (la pestaña «Datos» se fue).
   *
   * Lo que se sigue fijando es lo de siempre —**a campaña no se le pide lo que
   * no puede hacer**—: «Interés» es de ventas, y el lápiz de la ficha rápida no
   * va en campaña porque ahí la puerta es «Anotar quién es», en el pie. Las DOS
   * mitades importan: sin la de ventas, este test pasaría también si alguien
   * borrara la cabecera entera.
   */
  it('🔴 en campaña no se pide lo imposible, y en ventas eso sigue', async () => {
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="centurion:betto.romero" esDeCampana />);
    await reposar();
    const enCampana = vista.contenedor.textContent ?? '';
    expect(enCampana).not.toContain('Por completar');
    expect(enCampana, 'el interés es 403 en campaña: no se pide ni se dibuja').not.toContain('Interés');
    expect(enCampana, 'la empresa no se ofrece en campaña ni en el drawer').not.toContain('Empresa');
    expect(vista.contenedor.querySelector('button[aria-label="Editar la ficha"]'), 'en campaña la puerta es el pie').toBeNull();
    // Pero la identidad SÍ está: el número se lee y se copia.
    expect(vista.contenedor.querySelector('button[aria-label="Copiar el número"]'), 'en campaña la cabecera tiene el número').not.toBeNull();
    vista.desmontar();

    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" />);
    await reposar();
    expect(vista.contenedor.querySelector('button[aria-label="Editar la ficha"]'), 'en ventas el lápiz está').not.toBeNull();
  });

  /**
   * 🔴 LA CABECERA DE CAMPAÑA NO DICE NADA DE CERBERUS NI DE COMPRAS (dueño, 13-sep-2026):
   * sin país declarado —en campaña no hay perfil—, la bandera sale del código del
   * número y lo avisa. Las dos mitades: en ventas, la misma persona sin perfil
   * también tiene su bandera, así que la ausencia de Cerberus no es un panel roto.
   */
  it('🔴 en campaña la bandera sale del número y la cabecera no nombra a Cerberus', async () => {
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="centurion:betto.romero" esDeCampana />);
    await reposar();
    const bandera = vista.contenedor.querySelector('[data-bandera]');
    expect(bandera?.getAttribute('data-bandera'), 'el +51 del número').toBe('PE');
    expect(vista.contenedor.querySelector('[data-pais="PE"]')?.getAttribute('title')).toContain('código del número');
    const titulos = [...vista.contenedor.querySelectorAll('[title]')].map((e) => e.getAttribute('title') ?? '').join(' ');
    expect(`${vista.contenedor.textContent} ${titulos}`, 'la cabecera de campaña nombró a Cerberus').not.toContain('Cerberus');
    vista.desmontar();

    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" />);
    await reposar();
    expect(vista.contenedor.querySelector('[data-bandera]')?.getAttribute('data-bandera')).toBe('PE');
  });

  it('LA OTRA MITAD: en ventas sí las pide — si no, esto pasaría con el panel roto', async () => {
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" />);
    await reposar();
    for (const ruta of DE_VENTAS) {
      expect(
        pedidos.filter((p) => p.includes(ruta)).length,
        `en ventas tendría que haber pedido «${ruta}»`,
      ).toBeGreaterThan(0);
    }
  });

  /**
   * `/api/senales` NO es de ventas: «ya le mandaron el precio» y «se enfrió» se
   * derivan del hilo, sin tocar Cerberus. Apagarla de rebote le sacaría a la
   * campaña una señal que le sirve igual.
   */
  /**
   * LA SIMETRÍA, del otro lado: `/api/territorio` es superficie de **campaña**
   * (`modulos/modulo.ts`), así que pedirla desde ventas sería un 403 garantizado
   * en cada ficha que se abre — el mismo defecto que este archivo cierra, con el
   * signo cambiado.
   */
  it('🔴 el territorio se pide en campaña y NO en ventas', async () => {
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="centurion:betto.romero" esDeCampana />);
    await reposar();
    expect(pedidos.filter((p) => p.includes('/api/territorio')).length).toBeGreaterThan(0);
    vista.desmontar();

    pedidos = [];
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" />);
    await reposar();
    expect(pedidos.filter((p) => p.includes('/api/territorio'))).toHaveLength(0);
  });

  it('las señales del hilo siguen andando en los dos módulos', async () => {
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="centurion:betto.romero" esDeCampana />);
    await reposar();
    expect(pedidos.filter((p) => p.includes('/api/senales')).length).toBeGreaterThan(0);
  });

  /**
   * 🔴 **EL DETALLE DE CAMPAÑA NO HABLA DE VENTAS NI DE COMPRAS** (regla del
   * dueño, 11-sep-2026). Apagar las consultas de Cerberus no alcanzaba: la
   * pestaña «Compras» y los tiles «Última compra» / «Total de compras» se
   * dibujan con lo que haya, y sin ficha decían «Sin compras» y un 0 — o sea,
   * le afirmaban a un comando de campaña que su contacto nunca compró, sobre un
   * negocio que no es el suyo. Lo reportó el alta de Américo en producción.
   *
   * Se mira el DOM entero y no sólo lo visible: las secciones del detalle se
   * esconden con `hidden`, no se desmontan, así que una pestaña oculta con
   * compras adentro también cuenta como rastro.
   *
   * ⚠️ **Las dos mitades**: sin la de ventas, este test pasaría en verde con el
   * Resumen roto para todo el mundo.
   */
  it('🔴 en campaña no hay pestaña Compras ni tiles de compra, y en ventas sí', async () => {
    const rotulos = () =>
      [...(vista?.contenedor.querySelectorAll('[role="tab"]') ?? [])].map((t) => t.textContent?.trim());

    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="centurion:betto.romero" esDeCampana />);
    await reposar();
    expect(rotulos(), 'campaña tiene Resumen y Actividad — nada de compras').toEqual(['Resumen', 'Actividad']);
    const enCampana = vista.contenedor.textContent ?? '';
    for (const rastro of ['Compras', 'Monto total', 'Total comprado', 'Sin compras', 'Registrar venta']) {
      expect(enCampana, `«${rastro}» es de ventas y apareció en el detalle de campaña`).not.toContain(rastro);
    }
    // Lo que NO es de ventas se queda: la última actividad es del contacto, no del ERP.
    expect(enCampana, 'la última actividad sigue en el Resumen de campaña').toContain('Última actividad');
    vista.desmontar();

    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" />);
    await reposar();
    expect(rotulos()).toEqual(['Resumen', 'Actividad', 'Compras']);
    const enVentas = vista.contenedor.textContent ?? '';
    const resumen = vista.contenedor.querySelector('section[aria-label="Resumen del contacto"]');
    expect(resumen?.textContent, 'en ventas el resumen tiene su renglón de compras').toContain('Compras');
    // Acá todo `fetch` falla: la ficha NO cargó, así que decir «Sin compras» sería
    // afirmar lo que no se sabe (y así fue hasta el 13-sep-2026). Tampoco se grita.
    expect(enVentas, 'una ficha que no cargó no es «sin compras»').not.toContain('Sin compras');
    expect(enVentas, 'ni «No se pudo saber» en la cabecera').not.toContain('No se pudo saber');
  });
});
