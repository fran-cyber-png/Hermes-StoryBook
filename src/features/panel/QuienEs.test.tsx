// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { PanelDerecho } from './PanelDerecho';

/**
 * UN HECHO, UN CAMPO — el candado de la unificación de las dos fichas.
 *
 * ══ QUÉ ESTABA MAL ═══════════════════════════════════════════════════════════
 *
 * El panel dibujaba **un bloque por FUENTE** —la ficha rápida de Hermes, la
 * ficha de Cerberus y «Del formulario web»— en vez de un campo por HECHO. Con un
 * cliente real (reportado el 24-ago-2026 con captura) eso significaba el mismo
 * correo **dos veces, cada una con su propio botón «Escribirle»**, a 40 px de
 * distancia.
 *
 * 🔴 **Y no era un descuido puntual: se venía tapando de a un campo.**
 * `BloqueLeadForm` ya recibía `sinNombre={embebida}`, un parche por-campo contra
 * exactamente esta repetición en el nombre. Este test existe para que el
 * siguiente que agregue una fuente tenga que resolverla en la precedencia
 * (`correoDelContacto`, `nombreDelContacto`) y no colgando otro bloque abajo.
 *
 * ⚠️ 13-sep-2026 — el bloque «Quién es» y su pestaña «Datos» se fueron: la
 * identidad es la tarjeta de la cabecera (`EncabezadoTimeline`). El archivo
 * conserva el nombre por su historia; lo que fija es la misma propiedad.
 *
 * ══ POR QUÉ CUENTA OCURRENCIAS Y NO MIRA UN COMPONENTE ══════════════════════
 *
 * Porque el modo de fallar es **volver a montar** algo que ya se sacó. Un test
 * que afirme «`BloqueLeadForm` no está» pasa en verde si mañana la repetición
 * vuelve por otro componente. Contar cuántas veces se lee el mismo dato en la
 * columna es la propiedad, no la implementación.
 *
 * ⚠️ #1033 — desde que el panel lee UNA consulta de perfil, los servers de
 * mentira de abajo contestan `/api/contactos/perfil` armándolo con las mismas
 * piezas que antes servían por separado (ficha, formulario, padrón).
 */

const CORREO = 'r.chuquival.m@gmail.com';

const CLIENTE: Conversacion = {
  clave: 'conv:whatsapp:51900111222:51984429504',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51900111222',
  persona_nombre: 'Renzo Chuquival',
  numero_propio: '51984429504',
  texto: null,
  contexto_texto: null,
  respondida: false,
  ventana_abierta: false,
  pregunto: false,
  n: 14,
  referencia: '2026-04-28T23:24:00.000Z',
  ultimo_at: '2026-04-28T23:24:00.000Z',
  dias: 0,
  nivel: 5,
};

/** Las TRES fuentes con el MISMO correo — que es el caso que se reportó. */
function responder(url: string): unknown {
  if (url.includes('/api/contactos/perfil')) {
    return {
      ficha: responder('/api/contactos/ficha'),
      lead: (responder('/api/contactos/lead') as { lead: unknown }).lead,
      padron: null,
      errores: [],
    };
  }
  if (url.includes('/api/contactos/ficha')) {
    return {
      estado: 'cliente',
      id: 5936,
      nombre: 'Renzo Chuquival Medina',
      codigo: 'CLI-04812',
      dni: '71004812',
      pais: 'Perú',
      correo: CORREO,
      ventasCount: 1,
      ventas: [
        { folio: 'GOB-10488', estado: 'Pagado', fecha: '2026-04-28T23:24:00.000Z', monto: '300.00', moneda: 'PEN', productos: [] },
      ],
    };
  }
  if (url.includes('/api/contactos/lead')) {
    return {
      lead: {
        nombre: 'Renzo Chuquival',
        email: CORREO,
        campana: 'Diploma Élite del Gestor Parlamentario',
        anuncio: null,
        formulario: 'icarus:landing',
        fecha: '2026-04-22T17:41:00.000Z',
        fuente: 'web',
      },
    };
  }
  if (url.includes('/api/contactos/registro')) {
    return { ficha: { clave: CLIENTE.clave, telefono: '51900111222', nombre: 'Edson', apellido: 'Tapia', empresa: null, email: CORREO, prioridad: null, vendedoraId: 'luz', creadoAt: '2026-04-22T18:00:00.000Z', actualizadoAt: '2026-04-22T18:00:00.000Z' } };
  }
  if (url.includes('/api/eventos')) return { eventos: [], correos: [] };
  if (url.includes('/api/senales')) return { senales: {} };
  if (url.includes('/api/agenda')) return { recordatorios: [] };
  if (url.includes('/api/gestiones/intereses')) return { lista: [], derivados: [] };
  if (url.includes('/api/gestiones/etiquetas')) return { etiquetas: {} };
  if (url.includes('/api/categorias')) return { categorias: [], supervisor: false };
  if (url.includes('/api/enlaces')) return { origenes: [] };
  // El carrito sólo se monta con un cliente de Cerberus, o sea justo en este
  // caso. Se contesta con la FORMA real y no con `{}`: un stub que devuelve
  // cualquier cosa hace fallar el test por algo que no es lo que afirma.
  if (url.includes('/api/venta/formulario')) {
    return { monedas: [{ id: 'PEN', nombre: 'PEN' }], paises: [], asesores: [], medios: [] };
  }
  return {};
}

let vista: Montado | null = null;

function servir(responde: (url: string) => unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(responde(String(url))), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  );
}

beforeEach(() => {
  servir(responder);
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

function veces(texto: string, aguja: string): number {
  return texto.split(aguja).length - 1;
}

describe('las dos fichas son una sola', () => {
  it('🔴 el correo se lee UNA vez, aunque lo tengan las tres fuentes', async () => {
    vista = montar(<PanelDerecho conversacion={CLIENTE} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    await esperarA(() => (v.contenedor.textContent ?? '').includes(CORREO), 'que la ficha cargue');

    expect(
      veces(v.contenedor.textContent ?? '', CORREO),
      'el correo aparecía dos veces: una en la ficha de Cerberus y otra en «Del formulario web»',
    ).toBe(1);
  });

  it('🔴 y hay UN solo control para escribirle', async () => {
    vista = montar(<PanelDerecho conversacion={CLIENTE} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    await esperarA(() => (v.contenedor.textContent ?? '').includes(CORREO), 'que la ficha cargue');

    const escribir = [...v.contenedor.querySelectorAll('button')].filter((b) =>
      /escribirle/i.test((b.getAttribute('aria-label') ?? '') + ' ' + (b.textContent ?? '')),
    );
    expect(escribir, 'dos botones que hacen lo mismo, a 40 px uno del otro').toHaveLength(1);
  });

  /**
   * ⚠️ La otra mitad: sin esto, los dos tests de arriba pasarían también si
   * alguien borrara el bloque entero y no se leyera el correo en ningún lado.
   *
   * 🔴 13-sep-2026 — la pestaña «Datos» se fue y la identidad subió a la cabecera
   * (dueño: «1 número, 1 correo, 1 nombre, 1 país»). El código de cliente y el DNI
   * no desaparecen: pasan al `title` del chip «Cliente», con la procedencia.
   */
  it('y el código de cliente y el DNI siguen estando, en el chip «Cliente», con su fuente', async () => {
    vista = montar(<PanelDerecho conversacion={CLIENTE} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    const chip = () => [...v.contenedor.querySelectorAll('span[title]')].find((e) => e.textContent?.trim() === 'Cliente');
    await esperarA(() => Boolean(chip()?.getAttribute('title')?.includes('CLI-04812')), 'que llegue Cerberus');

    const titulo = chip()?.getAttribute('title') ?? '';
    expect(titulo).toContain('CLI-04812');
    expect(titulo).toContain('DNI 71004812');
    // La procedencia (ADR 0017): un dato de Cerberus no se lee igual que uno anotado en el chat.
    expect(titulo).toContain('Cerberus');
  });
});

/**
 * 🔴 LA TARJETA DE IDENTIDAD (dueño, 13-sep-2026): «apartado Datos ya no existirá,
 * lo pondremos de forma elegante arriba: 1 número, 1 correo, 1 nombre, 1 país».
 */
describe('la identidad está arriba, una de cada cosa', () => {
  it('no hay pestaña «Datos», y el número, el correo y el nombre se leen una vez en la cabecera', async () => {
    vista = montar(<PanelDerecho conversacion={CLIENTE} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    await esperarA(() => (v.contenedor.textContent ?? '').includes(CORREO), 'que la ficha cargue');

    const pestanas = [...v.contenedor.querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim());
    expect(pestanas).toEqual(['Resumen', 'Actividad', 'Compras']);
    const texto = v.contenedor.textContent ?? '';
    expect(veces(texto, '+51 900 111 222'), 'el número').toBe(1);
    expect(veces(texto, CORREO), 'el correo').toBe(1);
    expect(v.contenedor.querySelector('h2')?.textContent).toBe('Renzo Chuquival Medina');
  });

  it('el país declarado sale como bandera, y dice de dónde se sacó', async () => {
    vista = montar(<PanelDerecho conversacion={CLIENTE} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    // Se espera el `title` y no la bandera: la del código del número (+51) ya está antes de
    // que llegue el perfil, y afirmar ahí mediría el número, no lo declarado.
    await esperarA(
      () => (v.contenedor.querySelector('[data-pais="PE"]')?.getAttribute('title') ?? '').includes('declarado'),
      'que llegue el país de Cerberus',
    );

    expect(v.contenedor.querySelector('[data-bandera="PE"]')?.getAttribute('aria-label')).toBe('Perú');
    expect(v.contenedor.querySelector('[data-pais="PE"]')?.getAttribute('title')).toBe('Perú, declarado de Cerberus');
  });

  // 🔴 El ícono de llamar de la tarjeta usaba el `BotonLlamar` que las llamadas retiraron como
  // predecesor (pedía permiso sin techo, #1049 y #1050). La llamada es `PanelLlamada` (ADR 0123):
  // la tarjeta no puede traer una segunda puerta que se salte la consulta del cupo a Meta.
  it('la tarjeta «Contacto» no trae un llamar propio: la llamada es de PanelLlamada', async () => {
    vista = montar(<PanelDerecho conversacion={CLIENTE} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    await esperarA(() => (v.contenedor.textContent ?? '').includes(CORREO), 'que la ficha cargue');

    expect(v.contenedor.querySelector('dl button[aria-label="Llamar por WhatsApp"]'), 'sin ícono de llamar en la tarjeta').toBeNull();
  });

  // Dueño, 13-sep-2026: «Interés: —» no le gustaba, y la referencia compacta no dibuja huecos.
  it('el origen es un renglón de su tarjeta, y un interés vacío no se dibuja', async () => {
    vista = montar(<PanelDerecho conversacion={CLIENTE} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    await esperarA(() => (v.contenedor.textContent ?? '').includes(CORREO), 'que la ficha cargue');

    const rotulos = [...v.contenedor.querySelectorAll('[data-rotulo]')].map((e) => e.textContent);
    expect(rotulos).toContain('Origen');
    expect(rotulos, 'sin interés registrado no hay renglón «Interés»').not.toContain('Interés');
    expect(v.contenedor.textContent ?? '').not.toContain('Interés: —');
  });

  it('Editar y Unir están en la cabecera, como íconos con nombre', async () => {
    vista = montar(<PanelDerecho conversacion={CLIENTE} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    await esperarA(() => (v.contenedor.textContent ?? '').includes(CORREO), 'que la ficha cargue');

    expect(v.contenedor.querySelector('button[aria-label="Editar la ficha"]')).not.toBeNull();
    expect(v.contenedor.querySelector('button[aria-label="Unir con otra ficha de esta persona"]')).not.toBeNull();
  });
});

/**
 * 🔴 F.1/F.2/F.5 — EL CASO DE PEDRO LÓPEZ (diagnóstico del 8-sep): un alumno
 * de RD con venta GOB-10291, en icarus y en `conversiones_wa`, cuyo detalle
 * de Cerberus está vedado (302 al login). Antes de este cambio la ficha
 * mostraba «Pedro López» (el alias de WhatsApp) arriba y «Nombre —» en
 * «Quién es», sin ninguna de sus compras.
 */
const PEDRO: Conversacion = {
  clave: 'conv:whatsapp:18097961936:51984429504',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '18097961936',
  persona_nombre: 'Pedro López',
  numero_propio: '51984429504',
  texto: null,
  contexto_texto: null,
  respondida: false,
  ventana_abierta: false,
  pregunto: false,
  n: 2,
  referencia: '2026-09-03T00:00:00.000Z',
  ultimo_at: '2026-09-03T00:00:00.000Z',
  dias: 0,
  nivel: 5,
};

const PADRON_DE_PEDRO = {
  nombre: 'José Francisco Lopez Fermin',
  correo: 'jose@x.com',
  pais: 'República Dominicana',
  ocupacion: 'Maestro',
  fuente: 'icarus',
  compras: [
    { folio: 'GOB-10291', fecha: '2025-10-31T00:00:00.000Z', monto: '2505', moneda: 'DOP', canal: 'whatsapp', fuente: 'puente-icarus' },
  ],
};

function responderPedro(url: string): unknown {
  if (url.includes('/api/contactos/perfil')) {
    return { ficha: responderPedro('/api/contactos/ficha'), lead: null, padron: PADRON_DE_PEDRO, errores: [] };
  }
  // El detalle de Cerberus está vedado: `ficha()` lo modela como
  // `verificado: false` y `ventasCount: null` (F.5) cuando el candidato se
  // acepta sin poder comprobar el teléfono.
  if (url.includes('/api/contactos/ficha')) {
    return {
      estado: 'cliente',
      id: 4333,
      nombre: 'José Francisco Lopez Fermin',
      codigo: 'CLI-02491',
      dni: '',
      pais: 'República Dominicana',
      correo: '',
      ventasCount: null,
      ventas: [],
      verificado: false,
    };
  }
  if (url.includes('/api/contactos/padron')) return { padron: PADRON_DE_PEDRO };
  if (url.includes('/api/contactos/lead')) return { lead: null };
  if (url.includes('/api/contactos/registro')) return { ficha: null };
  if (url.includes('/api/eventos')) return { eventos: [], correos: [] };
  if (url.includes('/api/senales')) return { senales: {} };
  if (url.includes('/api/agenda')) return { recordatorios: [] };
  if (url.includes('/api/gestiones/intereses')) return { lista: [], derivados: [] };
  if (url.includes('/api/gestiones/etiquetas')) return { etiquetas: {} };
  if (url.includes('/api/categorias')) return { categorias: [], supervisor: false };
  if (url.includes('/api/enlaces')) return { origenes: [] };
  return {};
}

describe('la ficha unificada — F.1/F.2/F.5', () => {
  beforeEach(() => {
    servir(responderPedro);
  });

  it('el nombre real reemplaza al alias de WhatsApp en la cabecera, con su procedencia', async () => {
    vista = montar(<PanelDerecho conversacion={PEDRO} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    await esperarA(
      () => (v.contenedor.textContent ?? '').includes('José Francisco Lopez Fermin'),
      'que llegue el padrón de icarus',
    );

    // Antes: la cabecera decía «Pedro López». Ahora dice UN nombre (el de la escalera de
    // `nombreDelContacto`) y de dónde sale, al pasar el mouse.
    const nombre = v.contenedor.querySelector('h2');
    expect(nombre?.textContent).toBe('José Francisco Lopez Fermin');
    expect(nombre?.getAttribute('title')).toContain('de Cerberus');
  });

  it('el alias de WhatsApp queda como alias, no se pierde', async () => {
    vista = montar(<PanelDerecho conversacion={PEDRO} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    await esperarA(
      () => (v.contenedor.textContent ?? '').includes('José Francisco Lopez Fermin'),
      'que llegue el padrón de icarus',
    );
    expect(v.contenedor.querySelector('h2')?.getAttribute('title')).toContain('En WhatsApp: Pedro López');
  });

  it('una dominicana: la bandera sale de lo declarado, no del número', async () => {
    vista = montar(<PanelDerecho conversacion={PEDRO} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    // El +1 809 ya dice DO por el número: se espera a que el país diga «declarado».
    await esperarA(
      () => (v.contenedor.querySelector('[data-pais="DO"]')?.getAttribute('title') ?? '').includes('declarado'),
      'que llegue el país declarado',
    );
    expect(v.contenedor.querySelector('[data-bandera]')?.getAttribute('data-bandera')).toBe('DO');
    expect(v.contenedor.querySelector('[data-pais="DO"]')?.getAttribute('title')).not.toContain('código del número');
  });

  /**
   * 🔴 #1033 — ESTE CASO CAMBIÓ DE INTENCIÓN, y el cambio es el arreglo.
   *
   * Decía «Cerberus sin verificar lo dice, y la venta de icarus llena el hueco»:
   * con la ficha en vivo, el detalle vedado dejaba a TODO cliente sin verificar
   * y sin ventas, y lo mejor que el panel podía hacer era avisarlo. El dueño
   * pidió que deje de aparecer y que se identifique de verdad: la ficha sale
   * ahora de la copia local de Cerberus, verificada por teléfono y con sus
   * ventas y productos. Lo que se fija es eso — la venta de Cerberus con lo que
   * se llevó, y ni una mención a «sin verificar».
   */
  it('#1033 — la ficha local está verificada: no dice «sin verificar» y la venta trae lo que se llevó', async () => {
    servir((url) =>
      url.includes('/api/contactos/perfil')
        ? {
            ficha: {
              estado: 'cliente',
              id: 4333,
              nombre: 'José Francisco Lopez Fermin',
              codigo: 'CLI-02491',
              dni: '',
              pais: 'República Dominicana',
              correo: '',
              ocupacion: 'Maestro',
              ventasCount: 1,
              ventas: [
                {
                  folio: 'GOB-10291',
                  estado: 'Pagado',
                  monto: '2505',
                  moneda: 'DOP',
                  fecha: '2025-10-31T15:00:00.000Z',
                  productos: ['Diplomado en Gestión Pública'],
                },
              ],
              verificado: true,
            },
            lead: null,
            padron: PADRON_DE_PEDRO,
            errores: [],
          }
        : responderPedro(url),
    );
    vista = montar(<PanelDerecho conversacion={PEDRO} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    await esperarA(() => (v.contenedor.textContent ?? '').includes('GOB-10291'), 'que llegue la venta de Cerberus');

    const texto = v.contenedor.textContent ?? '';
    expect(texto.toLowerCase()).not.toContain('sin verificar');
    expect(texto).toContain('Diplomado en Gestión Pública');
  });

  it('F.1 — el correo de icarus también entra a la cabecera, con su procedencia', async () => {
    vista = montar(<PanelDerecho conversacion={PEDRO} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    await esperarA(() => (v.contenedor.textContent ?? '').includes('jose@x.com'), 'que llegue el correo del padrón');
    const renglon = [...v.contenedor.querySelectorAll('dd[title]')].find((e) => e.textContent === 'jose@x.com');
    expect(renglon?.getAttribute('title')).toContain('de icarus');
  });
});
