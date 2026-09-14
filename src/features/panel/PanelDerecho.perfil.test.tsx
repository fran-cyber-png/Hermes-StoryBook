// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarA, montar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { PanelDerecho } from './PanelDerecho';

/**
 * #1033 — LA FICHA LEE UNA SOLA RESPUESTA ARMADA EN HERMES, y lo que se fija es
 * el CABLEADO (ADR 0024).
 *
 * Las reglas —el texto del perfil, la ficha desde la copia local de Cerberus—
 * tienen sus tests puros. Lo que ninguno de esos puede ver es que el panel las
 * USE: que deje de pedirle a Cerberus en vivo al abrirse, y que el chip «sin
 * verificar» no vuelva por la puerta de atrás.
 *
 * 🔴 **El server de mentira contesta `/api/contactos/ficha` como contesta hoy
 * producción**: un cliente con `verificado: false` y sin ventas, porque el
 * detalle de Cerberus da 302 para todos. Si el panel volviera a leer esa ruta,
 * el chip aparecería y este test se pondría rojo — con una ficha verificada en
 * esa ruta, el test pasaría aunque el cableado viejo siguiera puesto.
 */

const CONTACTO: Conversacion = {
  clave: 'conv:whatsapp:51948530188:51963139984',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51948530188',
  persona_nombre: '.',
  numero_propio: '51963139984',
  texto: null,
  contexto_texto: null,
  respondida: false,
  ventana_abierta: false,
  pregunto: false,
  n: 3,
  referencia: '2026-09-03T15:00:00.000Z',
  ultimo_at: '2026-09-03T15:00:00.000Z',
  dias: 0,
  nivel: 5,
  etapa_efectiva: 'interesado',
};

const FICHA_EN_VIVO_DE_HOY = {
  estado: 'cliente',
  id: 4333,
  nombre: 'Luis Ángel Llaguento Heredia',
  codigo: 'CLI-02491',
  dni: '',
  pais: 'Peru',
  correo: '',
  ventasCount: null,
  ventas: [],
  verificado: false,
};

const PERFIL = {
  ficha: {
    estado: 'cliente',
    id: 4333,
    nombre: 'Luis Ángel Llaguento Heredia',
    codigo: 'CLI-02491',
    dni: '',
    pais: 'Perú',
    correo: '',
    ventasCount: 1,
    ventas: [
      {
        folio: 'GOB-14376',
        estado: 'Pagado',
        monto: '330',
        moneda: 'PEN',
        fecha: '2026-08-20T15:00:00.000Z',
        productos: ['Diploma en Gestión Pública'],
      },
    ],
    verificado: true,
  },
  lead: null,
  padron: null,
  errores: [],
};

/** Lo que contestan las demás rutas del panel: vacío, pero con la forma que cada hook lee. */
const VACIO = {
  eventos: [],
  correos: [],
  senales: {},
  etiquetas: {},
  categorias: [],
  recordatorios: [],
  lista: [],
  interesesDetalle: [],
  derivados: [],
  llamadas: [],
};

let vista: Montado | null = null;
let pedidos: string[] = [];

function json(cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  pedidos = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: unknown) => {
      const u = String(url);
      pedidos.push(u);
      if (u.includes('/api/contactos/perfil')) return Promise.resolve(json(PERFIL));
      if (u.includes('/api/contactos/ficha')) return Promise.resolve(json(FICHA_EN_VIVO_DE_HOY));
      return Promise.resolve(json(VACIO));
    }),
  );
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

describe('el detalle del contacto lee el perfil armado en Hermes', () => {
  it('🔴 en ventas pide UNA consulta de perfil y ninguna de las tres viejas', async () => {
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" />);
    await esperarA(() => pedidos.some((p) => p.includes('/api/contactos/perfil')), 'que el panel pida el perfil');
    for (const vieja of ['/api/contactos/ficha', '/api/contactos/lead', '/api/contactos/padron']) {
      expect(
        pedidos.filter((p) => p.includes(vieja)),
        `pidió «${vieja}» al abrir: la ficha tiene que salir del perfil, no de una consulta aparte`,
      ).toHaveLength(0);
    }
  });

  it('🔴 no aparece «sin verificar» y el Resumen cuenta el perfil', async () => {
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" />);
    const actual = vista;
    await esperarA(
      () => (actual.contenedor.textContent ?? '').includes('Compró 1 vez: Diploma en Gestión Pública'),
      'que el Resumen diga qué compró',
    );
    const texto = actual.contenedor.textContent ?? '';
    expect(texto).not.toContain('sin verificar');
    expect(texto, 'un pushname «.» no es alias').not.toContain('alias de WhatsApp: .');
    expect(texto).toContain('Cliente de Perú.');
  });

  /**
   * 🔴 «NO SE PUDO SABER» SE FUE (dueño, 13-sep-2026: «no me gusta»), Y ESTO FIJA
   * QUE SU REEMPLAZO ESTÉ CABLEADO. El caso real que lo destapó: el front local
   * apuntando a un server que todavía no tiene la ruta — un 404 en cada contacto
   * de ventas, y el chip amarillo en todos, sin ninguna salida.
   *
   * Tres cosas a la vez: la cabecera no grita, el Resumen no afirma «Sin compras»
   * de una ficha que no cargó, y «Reintentar» vuelve a PEDIR el perfil (no sólo
   * existe: el test de la regla no ve si el botón está conectado).
   */
  it('🔴 si el perfil no carga, la cabecera no grita y el Resumen ofrece reintentar, que vuelve a pedirlo', async () => {
    let perfilDisponible = false;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: unknown) => {
        const u = String(url);
        pedidos.push(u);
        if (u.includes('/api/contactos/perfil')) {
          return Promise.resolve(
            perfilDisponible
              ? json(PERFIL)
              : new Response(JSON.stringify({ message: 'no existe' }), {
                  status: 404,
                  headers: { 'content-type': 'application/json' },
                }),
          );
        }
        return Promise.resolve(json(VACIO));
      }),
    );
    vista = montar(<PanelDerecho conversacion={CONTACTO} miVendedora="luz" />);
    const actual = vista;
    const resumen = () => actual.contenedor.querySelector('section[aria-label="Resumen del contacto"]');
    const reintentar = () =>
      [...(resumen()?.querySelectorAll('button') ?? [])].find((b) => /reintentar/i.test(b.textContent ?? ''));

    await esperarA(() => Boolean(reintentar()), 'que el Resumen ofrezca reintentar');
    expect(actual.contenedor.textContent).not.toContain('No se pudo saber');
    expect(resumen()?.textContent, 'una ficha que no cargó no es «sin compras»').not.toContain('Sin compras');

    perfilDisponible = true;
    const pedidosAntes = pedidos.filter((p) => p.includes('/api/contactos/perfil')).length;
    reintentar()!.click();
    await esperarA(() => (resumen()?.textContent ?? '').includes('1 compra'), 'que al reintentar lleguen las compras');
    expect(pedidos.filter((p) => p.includes('/api/contactos/perfil')).length).toBeGreaterThan(pedidosAntes);
  });
});
