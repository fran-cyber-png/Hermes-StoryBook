// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montar, type Montado } from '../../pruebas/dom';
import { PanelHoy } from './PanelHoy';
import type { DatosHoy, PuenteAlPipeline } from './hoy';

/**
 * «HOY» — EL CABLEADO: cada cifra, al tocarla, le pasa al Pipeline SU recorte.
 *
 * Qué recorte le corresponde a cada cifra está fijado en `hoy.test.ts` (`puenteDe`).
 * Acá se prueba lo que ese test no ve: que el número que se DIBUJA dispare ese
 * puente y no otro (ADR 0024: el defecto suele estar en quién llama a la regla).
 * Se busca cada enlace por su `aria-label`, que es además lo que lee un lector de
 * pantalla.
 */

const LUZ = '51970356062';
const VENTAS_META = '51984429504';
const LIBROS_MX = '5215610584485';

const DATOS: DatosHoy = {
  inicioDeHoy: '2026-09-10T05:00:00.000Z',
  generadoEn: '2026-09-10T20:00:00.000Z',
  supervisor: true,
  modulo: 'ventas',
  lineas: [
    { numero: LUZ, etiqueta: 'luz', clase: 'propia', personas: ['luz'] },
    { numero: VENTAS_META, etiqueta: 'Ventas Meta', clase: 'equipo', personas: ['luz', 'nicole'] },
    { numero: LIBROS_MX, etiqueta: 'Libros Mx', clase: 'compartida', personas: ['darian', 'nicole'] },
  ],
  escribieron: {
    total: 290,
    porLinea: [
      { linea: LUZ, n: 226 },
      { linea: LIBROS_MX, n: 56 },
      { linea: null, canal: 'facebook', n: 6 },
      { linea: null, canal: 'instagram', n: 2 },
    ],
  },
  sinRespuesta: {
    total: 400,
    porDuena: [
      { duena: null, n: 320 },
      { duena: 'luz', n: 74 },
      { duena: 'nicole', n: 6 },
    ],
    porLinea: [
      { linea: LUZ, n: 269 },
      { linea: null, canal: 'facebook', n: 100 },
      { linea: null, canal: 'instagram', n: 31 },
    ],
  },
  calientesSinDuena: { total: 31, porLinea: [{ linea: VENTAS_META, n: 31 }] },
  personas: [
    { vendedora: 'luz', nombre: 'Luz', lineas: [LUZ, VENTAS_META], asignadas: 812, contestadas: 347, primeraRespuesta: { medianaMin: 9, sobre: 180, de: 226 }, ventas: 4 },
    { vendedora: 'nicole', nombre: 'Nicole', lineas: [LIBROS_MX, VENTAS_META], asignadas: 140, contestadas: 52, primeraRespuesta: null, ventas: 1 },
  ],
  sinAtribuir: [{ linea: LIBROS_MX, contestadas: 18 }],
};

let vista: Montado | null = null;
afterEach(() => {
  vista?.desmontar();
  vista = null;
});

function montarPanel(datos: DatosHoy = DATOS) {
  const abrir = vi.fn<(p: PuenteAlPipeline) => void>();
  vista = montar(<PanelHoy datos={datos} cargando={false} actualizando={false} onAbrirPipeline={abrir} />);
  return abrir;
}

function tocar(etiqueta: string): void {
  const el = vista!.contenedor.querySelector<HTMLElement>(`[aria-label="${etiqueta}"]`);
  expect(el, `no hay un enlace con aria-label «${etiqueta}»`).toBeTruthy();
  el!.click();
}

describe('«Hoy» — cada cifra abre el Pipeline con su recorte', () => {
  it('escribieron por primera vez hoy: el total y el de una línea', () => {
    const abrir = montarPanel();
    tocar('Abrir en el Pipeline: 290 escribieron por primera vez hoy');
    tocar('Abrir en el Pipeline: 56 escribieron por primera vez hoy en Libros Mx');
    expect(abrir.mock.calls.map(([p]) => p)).toStrictEqual([
      { tipo: 'pipeline', recorte: { escribioHoy: true } },
      { tipo: 'pipeline', recorte: { escribioHoy: true }, linea: LIBROS_MX },
    ]);
  });

  it('sin respuesta hace más de 24 h: por línea y por dueña, con la fila de «sin dueña» al pie', () => {
    const abrir = montarPanel();
    tocar('Abrir en el Pipeline: 269 sin respuesta hace más de 24 h en luz');
    tocar('Abrir en el Pipeline: 74 sin respuesta hace más de 24 h de Luz');
    tocar('Abrir en el Pipeline: 320 sin respuesta hace más de 24 h sin dueña');
    expect(abrir.mock.calls.map(([p]) => p)).toStrictEqual([
      { tipo: 'pipeline', recorte: { sinRespuesta24h: true }, linea: LUZ },
      { tipo: 'pipeline', recorte: { sinRespuesta24h: true }, asignadaA: 'luz' },
      { tipo: 'pipeline', recorte: { sinRespuesta24h: true }, asignadaA: null },
    ]);
  });

  it('calientes sin dueña de una línea, y las asignadas de una persona', () => {
    const abrir = montarPanel();
    tocar('Abrir en el Pipeline: 31 calientes sin dueña en Ventas Meta');
    tocar('Abrir en el Pipeline: 140 asignadas a Nicole');
    expect(abrir.mock.calls.map(([p]) => p)).toStrictEqual([
      { tipo: 'pipeline', recorte: { luz: 'verde' }, asignadaA: null, linea: VENTAS_META },
      { tipo: 'pipeline', asignadaA: 'nicole' },
    ]);
  });

  it('un DM sin línea abre el Pipeline por su canal', () => {
    const abrir = montarPanel();
    tocar('Abrir en el Pipeline: 6 escribieron por primera vez hoy en Messenger (sin línea)');
    tocar('Abrir en el Pipeline: 31 sin respuesta hace más de 24 h en Instagram (sin línea)');
    expect(abrir.mock.calls.map(([p]) => p)).toStrictEqual([
      { tipo: 'pipeline', recorte: { escribioHoy: true }, canal: 'facebook' },
      { tipo: 'pipeline', recorte: { sinRespuesta24h: true }, canal: 'instagram' },
    ]);
  });

  it('🔴 una cifra sin línea y SIN canal se lee pero NO es un enlace: abrirla mostraría todas las líneas', () => {
    montarPanel({ ...DATOS, escribieron: { total: 1, porLinea: [{ linea: null, n: 1 }] } });
    expect(vista!.contenedor.textContent ?? '').toContain('Sin línea (Messenger/IG)');
    // Exactamente «Sin línea (Messenger/IG)»: los DM que SÍ traen canal («Messenger (sin
    // línea)») son enlaces de verdad, y un selector más ancho los confundía con éste.
    expect(vista!.contenedor.querySelector('[aria-label*="Sin línea (Messenger/IG)"]')).toBeNull();
  });

  it('en campaña no hay «calientes sin dueña»: sin precio no hay semáforo que las pinte', () => {
    montarPanel({ ...DATOS, modulo: 'campana', calientesSinDuena: null });
    expect(vista!.contenedor.textContent ?? '').not.toContain('Calientes sin dueña');
    expect(vista!.contenedor.textContent ?? '').toContain('Escribieron por primera vez hoy');
  });

  it('lo contestado desde el teléfono en una línea compartida se dice por LÍNEA', () => {
    montarPanel();
    expect(vista!.contenedor.textContent ?? '').toContain(
      'Libros Mx: 18 contestadas desde el teléfono. La línea la comparten darian y Nicole, y esa parte no se puede repartir por persona.',
    );
  });
});

describe('«Hoy» — lo que la pantalla NO dibuja, según quién mira', () => {
  const encabezados = () => [...vista!.contenedor.querySelectorAll('thead th')].map((th) => th.textContent?.trim());

  it('🔴 en campaña no hay columna de ventas: una venta de la Escuela no hace a nadie persona del comando, y un 0 ahí sería una no-cifra', () => {
    montarPanel({ ...DATOS, modulo: 'campana', calientesSinDuena: null });
    expect(encabezados()).not.toContain('Ventas hoy');
  });

  it('la otra mitad: en ventas la columna está', () => {
    montarPanel();
    expect(encabezados()).toContain('Ventas hoy');
  });

  it('quien no supervisa ve una sola fila, la suya, rotulada «Tú»', () => {
    montarPanel({ ...DATOS, supervisor: false, personas: [DATOS.personas[1]!] });
    const filas = [...vista!.contenedor.querySelectorAll('tbody th[scope="row"]')].map((th) => th.textContent ?? '');
    expect(filas[0]).toContain('Tú');
    expect(vista!.contenedor.textContent ?? '').toContain('Tú, hoy');
  });
});
