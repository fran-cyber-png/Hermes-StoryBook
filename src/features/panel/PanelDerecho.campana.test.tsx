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
const DE_VENTAS = ['/api/contactos/ficha', '/api/contactos/lead', '/api/gestiones/intereses'];

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
   */
  it('🔴 en campaña NO hay skeleton eterno, y en ventas el skeleton sí aparece mientras carga', async () => {
    // Un server que acepta la request y no contesta jamás: la query queda
    // `pending` + `fetching`, que es «cargando» de verdad.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="centurion:betto.romero" esDeCampana />);
    await reposar();
    expect(
      vista.contenedor.querySelectorAll('[data-esqueleto="meta"]'),
      'en campaña el lead-form no se pide, así que no puede haber un skeleton suyo',
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
   * igual. Lo que la reemplaza es «Quién es», que dibuja los mismos campos con
   * su valor o con la forma del hueco.
   *
   * Lo que se sigue fijando es lo de siempre —**a campaña no se le pide lo que
   * no puede hacer**— sobre los campos que ahora lo dicen: «Interés» y
   * «Empresa» son de ventas, y las DOS mitades importan (sin la de ventas, este
   * test pasaría también si alguien borrara el bloque entero).
   */
  it('🔴 en campaña no se pide lo imposible, y en ventas esos campos siguen', async () => {
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="centurion:betto.romero" esDeCampana />);
    await reposar();
    const enCampana = vista.contenedor.textContent ?? '';
    expect(enCampana).not.toContain('Por completar');
    expect(enCampana, 'el interés es 403 en campaña: no se pide ni se dibuja').not.toContain('Interés');
    expect(enCampana, 'la empresa no se ofrece en campaña ni en el drawer').not.toContain('Empresa');
    // Pero el bloque SÍ está: lo que se recorta son dos campos, no la sección.
    expect(enCampana, 'en campaña «Quién es» sigue existiendo').toContain('Quién es');
    vista.desmontar();

    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" />);
    await reposar();
    const enVentas = vista.contenedor.textContent ?? '';
    expect(enVentas, 'en ventas el interés sigue estando').toContain('Interés');
    expect(enVentas, 'en ventas la empresa sigue estando').toContain('Empresa');
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
});
