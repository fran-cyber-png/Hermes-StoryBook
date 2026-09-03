import { describe, expect, test } from 'vitest';
import { comoQuery, type FiltrosPadron } from './padron';
import { TOTAL_PADRON } from './galeriaDatos';
import { COBERTURA_DE_FILTROS, totalIlustrativo } from './galeriaFiltrado';

/**
 * EL CANDADO CONTRA LA GALERÍA DESINCRONIZADA — regla dura #9, la clase
 * entera y no el caso puntual (hermes-4c, 24-ago-2026, después de encontrar
 * el mismo defecto de fondo varias veces el mismo día).
 *
 * `VALOR_DE_PRUEBA` está tipado `Required<FiltrosPadron>` a propósito: si
 * `FiltrosPadron` gana un campo nuevo y nadie lo agrega acá, esto no
 * compila — tsc lo atrapa antes de que el test corra. Y si alguien lo agrega
 * a `COBERTURA_DE_FILTROS` como `'simulado'` sin implementarlo de verdad en
 * `totalIlustrativo`, ESTE test se pone rojo: pedir con el filtro puesto
 * tiene que dar MENOS que sin él.
 *
 * `entroPorLinea` es el caso que se anticipó (#605): agregado acá ANTES de
 * verificar que `totalIlustrativo` lo soportara, para comprobar que el
 * candado de verdad lo atrapa solo — lo vio en rojo, ver el commit.
 */
const VALOR_DE_PRUEBA: Required<FiltrosPadron> = {
  pais: ['Perú'],
  curso: ['Diploma Internacional de Inteligencia'],
  etapa: ['interested'],
  nivel: ['vip'],
  fuente: ['landing'],
  asignadoA: ['ventas12@grupogoberna.com'],
  entroPorLinea: ['51984429504'],
  sinHabilitar: true,
  // Los de abajo están en `'no_aplica'` (ver el docblock de
  // `COBERTURA_DE_FILTROS`) — necesitan un valor acá solo porque el tipo es
  // `Required`, no porque este test los vaya a ejercitar.
  q: 'ana',
  entroDesde: '2026-01-01',
  entroHasta: '2026-12-31',
  conVenta: true,
  conTelefono: true,
  orden: 'recientes',
  pagina: 1,
  porPagina: 50,
};

const SIN_REPARTIDOS = new Set<number>();

describe('totalIlustrativo respeta cada filtro marcado `simulado`', () => {
  const totalSinFiltros = totalIlustrativo(new URLSearchParams(), SIN_REPARTIDOS);

  for (const [campo, cobertura] of Object.entries(COBERTURA_DE_FILTROS) as [keyof FiltrosPadron, string][]) {
    if (cobertura !== 'simulado') continue;

    test(`${campo}: pedir con el filtro puesto da MENOS que sin él`, () => {
      const params = new URLSearchParams(comoQuery({ [campo]: VALOR_DE_PRUEBA[campo] } as FiltrosPadron));
      const totalConFiltro = totalIlustrativo(params, SIN_REPARTIDOS);
      expect(totalConFiltro).toBeLessThan(totalSinFiltros);
      // Y no un cero disimulado: un mock que devuelve 0 para cualquier cosa
      // pasaría el `toBeLessThan` de arriba sin simular nada de verdad.
      expect(totalConFiltro).toBeGreaterThan(0);
    });
  }

  test('sin ningún filtro, el total es el padrón entero', () => {
    expect(totalSinFiltros).toBe(TOTAL_PADRON);
  });
});

describe('COBERTURA_DE_FILTROS documenta los que no aplican, no los olvida', () => {
  test('cada campo no-simulado tiene una razón (el docblock de la constante)', () => {
    const noAplica = Object.entries(COBERTURA_DE_FILTROS)
      .filter(([, v]) => v === 'no_aplica')
      .map(([k]) => k);
    // No es un assert sobre CUÁLES son — eso lo decide una persona leyendo el
    // docblock — es la red de que la lista no está vacía por accidente (un
    // `Record` mal armado que marcó todo `'simulado'` sin querer).
    expect(noAplica.length).toBeGreaterThan(0);
  });
});
