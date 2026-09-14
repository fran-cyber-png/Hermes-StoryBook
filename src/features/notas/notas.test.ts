import { describe, expect, it } from 'vitest';
import { ETIQUETA_DE_CLASE, claseDeArchivo, esAtajoLibreta, ordenarNotas, type Nota } from './notas';

/**
 * Puro, sin DOM (issue #47): el orden de la lista (espejo del `ORDER BY` del
 * server) y el atajo de teclado de la libreta.
 */

function nota(p: Partial<Nota>): Nota {
  return {
    id: 1,
    clave: 'general',
    vendedoraId: 'ana',
    texto: 'x',
    doc: null,
    anotaciones: null,
    fijada: false,
    creadoAt: '2026-07-01T00:00:00Z',
    editadoAt: null,
    archivadoAt: null,
    origen: 'nota',
    ...p,
  };
}

describe('ordenarNotas', () => {
  it('las fijadas van primero, aunque sean más viejas', () => {
    const vieja = nota({ id: 1, fijada: true, creadoAt: '2026-01-01T00:00:00Z' });
    const nueva = nota({ id: 2, fijada: false, creadoAt: '2026-07-01T00:00:00Z' });
    expect(ordenarNotas([nueva, vieja]).map((n) => n.id)).toEqual([1, 2]);
  });

  it('entre notas del mismo estado de fijada, la más nueva va primero', () => {
    const a = nota({ id: 1, creadoAt: '2026-07-01T00:00:00Z' });
    const b = nota({ id: 2, creadoAt: '2026-07-10T00:00:00Z' });
    const c = nota({ id: 3, creadoAt: '2026-07-05T00:00:00Z' });
    expect(ordenarNotas([a, b, c]).map((n) => n.id)).toEqual([2, 3, 1]);
  });

  it('no muta el array original', () => {
    const lista = [nota({ id: 1 }), nota({ id: 2, fijada: true })];
    const copia = [...lista];
    ordenarNotas(lista);
    expect(lista).toEqual(copia);
  });

  it('lista vacía no revienta', () => {
    expect(ordenarNotas([])).toEqual([]);
  });

  it('mezcla notas nuevas e históricas (origen "gestion") por la misma regla — ninguna se pierde', () => {
    // ADR 0012: retirar el textarea viejo de RegistrarGestion no puede volver
    // invisibles las notas que ya estaban en gestiones.notas.
    const nueva = nota({ id: 1, origen: 'nota', creadoAt: '2026-07-10T00:00:00Z' });
    const historica = nota({ id: 2, origen: 'gestion', creadoAt: '2026-01-01T00:00:00Z' });
    const resultado = ordenarNotas([historica, nueva]);
    expect(resultado.map((n) => n.origen)).toEqual(['nota', 'gestion']);
  });
});

describe('esAtajoLibreta', () => {
  it('«n» sola SÍ es el atajo', () => {
    expect(esAtajoLibreta({ key: 'n' })).toBe(true);
    expect(esAtajoLibreta({ key: 'N' })).toBe(true);
  });

  it('⌘N / Ctrl+N NO son el atajo (son del sistema/navegador)', () => {
    expect(esAtajoLibreta({ key: 'n', metaKey: true })).toBe(false);
    expect(esAtajoLibreta({ key: 'n', ctrlKey: true })).toBe(false);
    expect(esAtajoLibreta({ key: 'n', altKey: true })).toBe(false);
  });

  it('otra tecla no dispara el atajo', () => {
    expect(esAtajoLibreta({ key: 'm' })).toBe(false);
    expect(esAtajoLibreta({ key: 'Enter' })).toBe(false);
  });
});

/**
 * `claseDeArchivo`/`ETIQUETA_DE_CLASE` (04-sep-2026, a pedido explícito) —
 * lo que cada fila de la lista muestra en vez de «· editada»: qué ES la
 * página, no si se tocó.
 */
describe('claseDeArchivo', () => {
  it('una página de texto de siempre es «texto» → «Página»', () => {
    const n = nota({ tipo: 'texto' });
    expect(claseDeArchivo(n)).toBe('texto');
    expect(ETIQUETA_DE_CLASE[claseDeArchivo(n)]).toBe('Página');
  });

  it('sin `tipo` (una fila vieja, server de antes de ADR 0046) también es «texto»', () => {
    const n = nota({});
    expect(claseDeArchivo(n)).toBe('texto');
  });

  it('un PDF adjuntado es «pdf» → «PDF»', () => {
    const n = nota({
      tipo: 'archivo',
      archivo: { archivo: 'x.pdf', nombreOriginal: 'Contrato.pdf', mime: 'application/pdf', bytes: 10 },
    });
    expect(claseDeArchivo(n)).toBe('pdf');
    expect(ETIQUETA_DE_CLASE[claseDeArchivo(n)]).toBe('PDF');
  });

  it('un Word adjuntado es «word» → «Word»', () => {
    const n = nota({
      tipo: 'archivo',
      archivo: {
        archivo: 'x.docx',
        nombreOriginal: 'Propuesta.docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        bytes: 10,
      },
    });
    expect(claseDeArchivo(n)).toBe('word');
    expect(ETIQUETA_DE_CLASE[claseDeArchivo(n)]).toBe('Word');
  });

  it('cualquier otro adjunto (texto plano) es «txt» → «Bloc»', () => {
    const n = nota({
      tipo: 'archivo',
      archivo: { archivo: 'x.txt', nombreOriginal: 'apuntes.txt', mime: 'text/plain', bytes: 10 },
    });
    expect(claseDeArchivo(n)).toBe('txt');
    expect(ETIQUETA_DE_CLASE[claseDeArchivo(n)]).toBe('Bloc');
  });

  it('las cuatro etiquetas son DISTINTAS entre sí', () => {
    const etiquetas = Object.values(ETIQUETA_DE_CLASE);
    expect(new Set(etiquetas).size).toBe(etiquetas.length);
  });
});
