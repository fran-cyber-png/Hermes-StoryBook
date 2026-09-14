import { describe, expect, test } from 'vitest';
import { aplicarVista, chipsDelRecorte, vistasDelPadron, vistaVigente } from './vistasDelPadron';
import type { FiltrosPadron } from './padron';

/** Las cifras de la captura del dueño del 10-sep-2026, con la forma real de las facetas. */
const SIN_ASIGNAR = {
  etapa: [
    { valor: 'interested', contactos: 667 },
    { valor: 'follow_up', contactos: 137 },
    { valor: 'recontact', contactos: 46 },
    { valor: 'delivered', contactos: 5_792 },
  ],
  sinRepartir: 73_200,
  lineas: [
    { valor: '51987654321', etiqueta: 'Betto', contactos: 612 },
    { valor: '51984429504', etiqueta: 'Ventas Meta', contactos: 7_025 },
  ],
};
const CARGA = [
  { vendedoraId: 'luz', contactos: 877 },
  { vendedoraId: 'ventas11@grupogoberna.com', contactos: 3_383 },
];

describe('vistasDelPadron', () => {
  const vistas = vistasDelPadron({ sinAsignar: SIN_ASIGNAR, carga: CARGA });

  test('«para repartir hoy» son las cuatro de la franja vieja, con sus cifras y la línea más grande', () => {
    expect(vistas.filter((v) => v.grupo === 'para_repartir').map((v) => [v.rotulo, v.contactos])).toEqual([
      ['Sin asignar', 73_200],
      ['Ventas Meta', 7_025],
      ['Contactado', 850],
      ['En negociación', 5_792],
    ]);
  });

  /**
   * 🔴 EL BUG QUE ESTO ARREGLA: el atajo «Asignados a ▾» de la franja vieja NO
   * PODÍA LISTAR A NADIE. Leía `asignadoA.opciones` de las facetas pedidas con
   * `sinHabilitar: true`, y `facetaAsignadoA` (server) cuenta DENTRO de ese
   * recorte — que por definición no tiene ningún asignado. Resultado: siempre
   * «Todavía nadie tiene nada asignado», con miles repartidos. Las vistas «Asignado
   * a» salen de la CARGA del reparto (`/api/padron/reparto`), que cuenta el
   * reparto entero.
   */
  test('🔴 «Asignado a» sale de la carga del reparto, de la más cargada a la menos', () => {
    expect(vistas.filter((v) => v.grupo === 'asignado').map((v) => [v.rotulo, v.contactos])).toEqual([
      ['Ventas11', 3_383],
      ['Luz', 877],
    ]);
  });

  test('sin cifras todavía, las vistas existen igual y no inventan un cero', () => {
    const sinDatos = vistasDelPadron({});
    expect(sinDatos.map((v) => v.id)).toEqual(['todos', 'sin_asignar', 'etapa:conversacion', 'etapa:sin_cerrar']);
    expect(sinDatos.every((v) => v.contactos === undefined)).toBe(true);
  });
});

describe('vistaVigente', () => {
  const vistas = vistasDelPadron({ sinAsignar: SIN_ASIGNAR, carga: CARGA });

  test('el default del supervisor se lee «Sin asignar»', () => {
    expect(vistaVigente({ sinHabilitar: true, pagina: 1, porPagina: 50 }, vistas)?.id).toBe('sin_asignar');
  });

  test('gana la vista más específica contenida en el filtro', () => {
    const f: FiltrosPadron = { sinHabilitar: true, etapa: ['interested', 'follow_up', 'recontact'] };
    expect(vistaVigente(f, vistas)?.id).toBe('etapa:conversacion');
  });

  test('refinar no cambia la vista: «Sin asignar» + Perú sigue siendo «Sin asignar»', () => {
    expect(vistaVigente({ sinHabilitar: true, pais: ['Perú'] }, vistas)?.id).toBe('sin_asignar');
  });

  test('la dueña se compara normalizando los dos lados (Luz / luz)', () => {
    expect(vistaVigente({ asignadoA: [' Luz '] }, vistas)?.id).toBe('asignado:luz');
  });

  test('sin nada puesto, «Todos»', () => {
    expect(vistaVigente({}, vistas)?.id).toBe('todos');
  });
});

describe('aplicarVista', () => {
  test('REEMPLAZA el recorte y vuelve a la página 1, pero el orden se queda', () => {
    const enNegociacion = vistasDelPadron({}).find((v) => v.id === 'etapa:sin_cerrar')!;
    const antes: FiltrosPadron = { pais: ['Perú'], asignadoA: ['luz'], pagina: 7, porPagina: 50, orden: 'nombre' };
    expect(aplicarVista(antes, enNegociacion)).toEqual({
      pagina: 1,
      porPagina: 50,
      orden: 'nombre',
      sinHabilitar: true,
      etapa: ['delivered'],
    });
  });
});

describe('chipsDelRecorte', () => {
  const vistas = vistasDelPadron({ sinAsignar: SIN_ASIGNAR, carga: CARGA });
  const chips = (f: FiltrosPadron) => chipsDelRecorte(f, vistaVigente(f, vistas), SIN_ASIGNAR.lineas);

  test('con sólo la vista puesta no hay ningún chip — la vista ya lo dice', () => {
    expect(chips({ sinHabilitar: true, pagina: 1 })).toEqual([]);
    expect(chips({ sinHabilitar: true, etapa: ['delivered'] })).toEqual([]);
  });

  test('lo que refina sí, y quitarlo no toca la vista', () => {
    const r = chips({ sinHabilitar: true, etapa: ['delivered'], pais: ['Perú'] });
    expect(r.map((c) => c.rotulo)).toEqual(['Perú']);
    expect(r[0].quitar).toEqual({ pais: [] });
  });

  test('una etapa suelta, fuera de la vista, sale con el nombre de su grupo', () => {
    expect(chips({ sinHabilitar: true, etapa: ['lost'] }).map((c) => c.rotulo)).toEqual(['Venta perdida']);
  });

  test('la línea se rotula con su etiqueta, nunca con el número', () => {
    expect(chips({ entroPorLinea: ['51987654321'] }).map((c) => c.rotulo)).toEqual(['Betto']);
  });

  test('el texto buscado NO es un chip: ya está escrito en el buscador', () => {
    expect(chips({ q: 'ana' })).toEqual([]);
  });
});
