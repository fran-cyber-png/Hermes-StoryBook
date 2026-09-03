import { describe, expect, it } from 'vitest';
import { kpisDe, panelesDe } from './kpis';

/** El embudo tal como lo manda el server para la Escuela (claves de ADR 0044). */
const VENTAS = { sin_respuesta: 2575, interesado: 618, contactado: 318, cotizado: 1298, cierre: 12 };
/** Y el de campaña (ADR 0063): sin `cotizado` ni `cierre`, con la escalera propia. */
const CAMPANA = { sin_respuesta: 9, interesado: 11, contactado: 17, simpatiza: 8, comprometido: 3, voluntario: 1 };

describe('los KPIs salen del embudo y de ningún otro universo', () => {
  it('el total es la SUMA de los segmentos que la barra dibuja, `sin_respuesta` incluida', () => {
    const total = kpisDe(VENTAS).find((k) => k.id === 'conversaciones');
    expect(total?.n).toBe(2575 + 618 + 318 + 1298 + 12);
  });

  /**
   * 🔴 El candado de #329, en la banda de arriba. `sin_respuesta` es el 65 % del
   * embudo y quedaba afuera cuando el total se calculaba iterando `ETAPAS`.
   * Si alguien vuelve a sumar con una lista fija del front, este test lo dice.
   */
  it('un total que omita `sin_respuesta` se cae', () => {
    const total = kpisDe(VENTAS).find((k) => k.id === 'conversaciones');
    expect(total?.n).not.toBe(618 + 318 + 1298 + 12);
  });

  it('cada tile dice su etapa, para poder pintarse con su color', () => {
    const porId = Object.fromEntries(kpisDe(VENTAS).map((k) => [k.id, k.etapa]));
    expect(porId.esperan).toBe('interesado');
    expect(porId.precio).toBe('cotizado');
    expect(porId.compraron).toBe('cierre');
    // El total no es una etapa: es un agregado, y no puede llevar color de etapa.
    expect(porId.conversaciones).toBeNull();
  });

  /**
   * ⚠️ Una etapa que el server no mandó vale CERO, no se esconde: en un embudo,
   * «nadie llegó hasta acá» es información. Si el tile desapareciera, la banda
   * cambiaría de forma según el día.
   */
  it('una etapa ausente se dibuja en cero, no se esconde', () => {
    const kpis = kpisDe({ interesado: 4 });
    expect(kpis).toHaveLength(4);
    expect(kpis.find((k) => k.id === 'compraron')?.n).toBe(0);
  });

  it('sin embudo no revienta: todo en cero', () => {
    expect(kpisDe(undefined).every((k) => k.n === 0)).toBe(true);
    expect(kpisDe(null).map((k) => k.id)).toEqual(['esperan', 'conversaciones', 'precio', 'compraron']);
  });

  it('la nota de «saben el precio» no se inventa cuando no hay a quién contar', () => {
    expect(kpisDe({ cotizado: 5 }).find((k) => k.id === 'precio')?.nota).toBeNull();
    expect(kpisDe(VENTAS).find((k) => k.id === 'precio')?.nota).toBe('2575 nunca contestaron');
  });
});

describe('los dos módulos', () => {
  /**
   * 🔴 Los dos primeros tiles se comparten porque derivan de quién HABLÓ, y eso
   * vale en los dos negocios. Lo que sigue no: en ventas la escalera termina en
   * plata y en campaña en compromiso, que una persona afirma (ADR 0063).
   */
  it('comparten los dos primeros y difieren en los dos últimos', () => {
    expect(kpisDe(VENTAS).map((k) => k.id)).toEqual(['esperan', 'conversaciones', 'precio', 'compraron']);
    expect(kpisDe(CAMPANA, true).map((k) => k.id)).toEqual([
      'esperan',
      'conversaciones',
      'comprometidos',
      'voluntarios',
    ]);
  });

  /**
   * 🔴 En campaña NO se dibuja plata. `cotizado` sale de un monto en el hilo y
   * `cierre` de una venta — un teléfono que además le compró un diplomado a la
   * Escuela subiría a un peldaño que en campaña no existe.
   */
  it('campaña no dibuja ningún tile de plata, aunque el embudo trajera esas claves', () => {
    const conPlataDeMas = { ...CAMPANA, cotizado: 99, cierre: 7 };
    const ids = kpisDe(conPlataDeMas, true).map((k) => k.id);
    expect(ids).not.toContain('precio');
    expect(ids).not.toContain('compraron');
  });

  it('el total de campaña sí suma TODO lo que vino, incluso lo que no tiene tile', () => {
    const conPlataDeMas = { ...CAMPANA, cotizado: 99 };
    const total = kpisDe(conPlataDeMas, true).find((k) => k.id === 'conversaciones');
    // No se filtra por módulo: el total dice cuántas conversaciones hay, y
    // esconder una la haría desaparecer del número sin que nada lo explique.
    expect(total?.n).toBe(9 + 11 + 17 + 8 + 3 + 1 + 99);
  });
});

describe('qué paneles van', () => {
  /**
   * 🔴 «Qué piden» es el ranking de CURSOS, y un curso es de la Escuela. En
   * campaña sería un cero ESTRUCTURAL —no un cero de hoy— y encima le explicaría
   * a un operador político que existe un catálogo de diplomados que nunca va a
   * ver. Mismo defecto que ADR 0063 encontró en el panel derecho.
   */
  it('«Qué piden» es de la Escuela y no se dibuja en campaña', () => {
    expect(panelesDe(false)).toContain('quePiden');
    expect(panelesDe(true)).not.toContain('quePiden');
  });

  it('los cinco comunes van en los dos módulos', () => {
    for (const id of ['miTurno', 'embudo', 'equipo', 'canales', 'dias'] as const) {
      expect(panelesDe(false)).toContain(id);
      expect(panelesDe(true)).toContain(id);
    }
  });

  /**
   * ⚠️ El candado de lo que NO existe. El diseño aprobado pedía «Últimas
   * ventas», «Territorio» y «El comando», y ninguno baja por `/api/dashboard`.
   * Si alguien los agrega acá sin agregar el dato, el panel se dibuja vacío —
   * que es exactamente lo que este módulo existe para impedir.
   */
  it('no ofrece ningún panel cuyo dato el endpoint no manda', () => {
    const todos = [...panelesDe(false), ...panelesDe(true)];
    for (const inexistente of ['ultimasVentas', 'territorio', 'elComando']) {
      expect(todos).not.toContain(inexistente);
    }
  });
});
