import { describe, expect, it } from 'vitest';
import { claveDeColumnas, paramsDeFranja, type ColumnaDelTablero } from './conversaciones';

/**
 * 🔴 LA FRANJA TIENE QUE ENTRAR A LA CLAVE, Y ESO NO SE VE EN NINGUNA CAPTURA.
 *
 * El tablero se cachea por `queryKey` (TanStack). Si los instantes de la franja
 * no viajan en la clave, tocar «Hoy» y después «Última hora» son dos pedidos con
 * la MISMA clave: el segundo se sirve de la caché del primero y la vendedora lee
 * la lista de «Hoy» debajo de un chip que dice «Última hora». No hay pantalla en
 * blanco, no hay error, no hay síntoma — por eso hay test.
 *
 * Es el mismo defecto que el server persigue con sus 400 (`franjaPedida.ts`),
 * atrapado del lado de acá.
 */

const HOY: ColumnaDelTablero = {
  etapa: 'sin_respuesta',
  franja: { desde: '2026-08-20T05:00:00.000Z', hasta: null },
};
const ULTIMA_HORA: ColumnaDelTablero = {
  etapa: 'sin_respuesta',
  franja: { desde: '2026-08-20T19:00:00.000Z', hasta: null },
};

describe('paramsDeFranja — lo que se le pide al server', () => {
  it('sin franja no agrega nada a la URL', () => {
    expect(paramsDeFranja([{ etapa: 'interesado' }, { etapa: 'cotizado', recorte: 'seguir' }])).toBe('');
  });

  it('🔴 nombra la COLUMNA: sin `franjaEn` el server recortaría las cinco', () => {
    const p = paramsDeFranja([{ etapa: 'interesado' }, HOY]);
    expect(p).toContain('franjaEn=sin_respuesta');
    expect(p.startsWith('&')).toBe(true);
  });

  it('«Hoy» no manda `hasta`: la franja llega hasta ahora', () => {
    expect(paramsDeFranja([HOY])).not.toContain('hasta=');
  });

  it('«Ayer» manda los dos bordes', () => {
    const ayer: ColumnaDelTablero = {
      etapa: 'sin_respuesta',
      franja: { desde: '2026-08-19T05:00:00.000Z', hasta: '2026-08-20T05:00:00.000Z' },
    };
    const p = paramsDeFranja([ayer]);
    expect(p).toContain('desde=2026-08-19T05');
    expect(p).toContain('hasta=2026-08-20T05');
  });

  it('🔴 dos franjas distintas dan dos claves distintas', () => {
    expect(paramsDeFranja([HOY])).not.toBe(paramsDeFranja([ULTIMA_HORA]));
  });

  it('la clave de columnas NO cambia con la franja: por eso los params van aparte', () => {
    // `claveDeColumnas` es lo que el server lee como `?columnas=`; meterle los
    // instantes rompería su gramática (`etapa[:recorte]`, partida por `:`).
    expect(claveDeColumnas([HOY])).toBe('sin_respuesta');
    expect(claveDeColumnas([HOY])).toBe(claveDeColumnas([ULTIMA_HORA]));
  });
});
