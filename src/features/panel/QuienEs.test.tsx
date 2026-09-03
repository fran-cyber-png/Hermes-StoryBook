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
 * (`QuienEs`) y no colgando otro bloque abajo.
 *
 * ══ POR QUÉ CUENTA OCURRENCIAS Y NO MIRA UN COMPONENTE ══════════════════════
 *
 * Porque el modo de fallar es **volver a montar** algo que ya se sacó. Un test
 * que afirme «`BloqueLeadForm` no está» pasa en verde si mañana la repetición
 * vuelve por otro componente. Contar cuántas veces se lee el mismo dato en la
 * columna es la propiedad, no la implementación.
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

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: unknown) =>
      Promise.resolve(
        new Response(JSON.stringify(responder(String(url))), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  );
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
   */
  it('y el nombre y el código de cliente siguen estando, con su fuente', async () => {
    vista = montar(<PanelDerecho conversacion={CLIENTE} miVendedora="luz" onMandarCorreo={() => {}} />);
    const v = vista;
    await esperarA(() => (v.contenedor.textContent ?? '').includes('CLI-04812'), 'que llegue Cerberus');

    const texto = v.contenedor.textContent ?? '';
    expect(texto).toContain('CLI-04812');
    expect(texto).toContain('71004812');
    // La procedencia a la vista (ADR 0017): un dato de Cerberus no se puede leer
    // igual que uno que anotó una vendedora en el chat.
    expect(texto).toContain('Cerberus');
  });
});
