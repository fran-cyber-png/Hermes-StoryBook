import { describe, expect, it } from 'vitest';
import { resumenDelContacto, type DatosDelResumen } from './resumenDelContacto';
import type { CompraUnificada } from './comprasUnificadas';

/**
 * #1033 — EL TEXTO DEL PERFIL, armado SÓLO con lo verificado.
 *
 * Los textos esperados están escritos a mano a propósito: el que lee la ficha es
 * una vendedora, y lo que se fija es la frase que va a leer, no la aritmética
 * que la arma. Un test que recalculara la frase como la calcula el código
 * pasaría siempre.
 */

const VACIO: DatosDelResumen = {
  esCliente: false,
  pais: null,
  ocupacion: null,
  compras: [],
  intereses: [],
  etapa: null,
  ultimaActividad: null,
};

function compra(c: Partial<CompraUnificada>): CompraUnificada {
  return {
    folio: 'GOB-1',
    monto: '100',
    moneda: 'PEN',
    fecha: '2026-04-01T15:00:00.000Z',
    canalOEstado: 'Pagado',
    fuente: 'cerberus',
    productos: [],
    esCompra: true,
    negocios: [],
    ...c,
  };
}

describe('resumenDelContacto — el perfil en una frase que se lee de corrido', () => {
  it('el cliente de la captura: de dónde es, qué compró, en qué etapa está y qué fue lo último', () => {
    expect(
      resumenDelContacto({
        ...VACIO,
        esCliente: true,
        pais: 'Perú',
        compras: [
          compra({
            folio: 'GOB-14376',
            monto: '330',
            moneda: 'PEN',
            fecha: '2026-08-20T15:00:00.000Z',
            productos: ['Diploma en Gestión Pública'],
            negocios: ['Escuela'],
          }),
        ],
        etapa: 'interesado',
        ultimaActividad: { rotulo: 'Correo enviado', timestamp: '2026-09-03T15:00:00.000Z', esSenal: false },
      }),
    ).toBe(
      'Cliente de Perú. Compró 1 vez en Escuela: Diploma en Gestión Pública por PEN 330, el 20 ago 2026. Está en «Te espera»; lo último, correo enviado el 3 sep 2026.',
    );
  });

  // Goberna es todos sus negocios (dueño, 13-sep-2026): el texto dice en cuáles compró, sin esconder ninguno.
  it('varias compras: cuántas y en qué negocios, y de la última qué se llevó; la ocupación va junto al país', () => {
    expect(
      resumenDelContacto({
        ...VACIO,
        esCliente: true,
        pais: 'México',
        ocupacion: 'Abogada',
        compras: [
          compra({ monto: '4760.00', moneda: 'MXN', fecha: '2026-06-02T15:00:00.000Z', productos: ['Diplomado A', 'Curso B'], negocios: ['Escuela'] }),
          compra({ folio: 'GOB-2', fecha: '2026-03-01T15:00:00.000Z', negocios: ['Consultoria'] }),
          compra({ folio: 'GOB-3', fecha: '2025-11-01T15:00:00.000Z' }),
        ],
        etapa: 'cierre',
      }),
    ).toBe(
      'Cliente de México, abogada. Compró 3 veces en Escuela y Consultoria; la última, Diplomado A + Curso B por MXN 4760, el 2 jun 2026. Está en «Compró».',
    );
  });

  // 🔴 Qué es compra lo decide el server (`dominio/estadosVenta.ts`: 1, 2 y 9), no el rótulo.
  it('lo que no es compra no cuenta: ni la anulada ni la cotización', () => {
    expect(
      resumenDelContacto({
        ...VACIO,
        esCliente: true,
        compras: [
          compra({ folio: 'GOB-9', canalOEstado: 'Anulado', esCompra: false, fecha: '2026-05-01T15:00:00.000Z', productos: ['Curso X'] }),
          compra({ folio: 'GOB-7', canalOEstado: 'Cotización', esCompra: false, fecha: '2026-04-01T15:00:00.000Z', productos: ['Curso Z'] }),
          compra({ folio: 'GOB-8', fecha: '2026-02-01T15:00:00.000Z', productos: ['Curso Y'] }),
        ],
      }),
    ).toBe('Cliente. Compró 1 vez: Curso Y por PEN 100, el 1 feb 2026.');
  });

  it('sin el nombre del producto, la compra se nombra por su folio: nunca se inventa qué fue', () => {
    expect(
      resumenDelContacto({
        ...VACIO,
        esCliente: true,
        compras: [compra({ folio: 'GOB-10291', monto: '2505', moneda: 'DOP', fecha: '2025-10-31T15:00:00.000Z' })],
      }),
    ).toBe('Cliente. Compró 1 vez: GOB-10291 por DOP 2505, el 31 oct 2025.');
  });

  it('un lead sin compras: lo dice como registro, no como sentencia, y cuenta qué le interesa', () => {
    expect(
      resumenDelContacto({
        ...VACIO,
        intereses: ['Diplomado en Gestión Pública'],
        etapa: 'cotizado',
        ultimaActividad: { rotulo: 'Cotización', timestamp: '2026-09-10T15:00:00.000Z', esSenal: true },
      }),
    ).toBe(
      'No tiene compras registradas. Le interesa Diplomado en Gestión Pública. Está en «Sabe el precio»; lo último, cotización el 10 sep 2026.',
    );
  });

  it('varios intereses se enumeran como se habla', () => {
    expect(resumenDelContacto({ ...VACIO, intereses: ['Curso A', 'Curso B', 'Curso C'] })).toBe(
      'No tiene compras registradas. Le interesan Curso A, Curso B y Curso C.',
    );
  });

  it('sin nada que decir no hay texto: un bloque vacío enseña a no mirarlo', () => {
    expect(resumenDelContacto(VACIO)).toBeNull();
  });
});
