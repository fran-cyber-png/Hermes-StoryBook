// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { montar, escribir, tocar } from '../../pruebas/dom';
import { FiltroFaceta } from './FiltroFaceta';

/**
 * EL AVISO DEL TOPE DE 80 — Curso tiene 104 valores vivos contra un tope de
 * 80 en `consultarFacetas` (server): buscar uno de los ~24 que quedaron
 * afuera no encuentra nada, y sin este aviso se lee como «no existe» en vez
 * de «no está en este recorte». Antes, con tres chips fijos, esto no se
 * notaba (Estephano, 25-ago-2026, pidió el buscador en su lugar).
 *
 * `opciones.length >= 80` es la señal de que ESTA faceta llegó topeada —
 * `FiltroFaceta` es genérico (lo usan País, Curso y Fuente), así que el
 * aviso aparece solo cuando aplica, sin tocar los otros dos.
 */
function opciones(n: number) {
  return Array.from({ length: n }, (_, i) => ({ valor: `Curso ${i}`, contactos: n - i }));
}

describe('FiltroFaceta — el aviso del tope', () => {
  test('con menos de 80 opciones, una búsqueda sin resultados NO avisa del tope', () => {
    const m = montar(
      <FiltroFaceta rotulo="Curso" opciones={opciones(10)} elegidos={[]} cargando={false} onAlternar={() => {}} onLimpiar={() => {}} />,
    );
    tocar(m.contenedor.querySelector('button')!);
    escribir(m.contenedor.querySelector('input')!, 'zzz-no-existe');

    expect(m.contenedor.textContent).toContain('Nada con ese nombre.');
    expect(m.contenedor.textContent).not.toContain('con más gente');
    m.desmontar();
  });

  test('con 80 opciones (el tope), una búsqueda sin resultados SÍ avisa', () => {
    const m = montar(
      <FiltroFaceta rotulo="Curso" opciones={opciones(80)} elegidos={[]} cargando={false} onAlternar={() => {}} onLimpiar={() => {}} />,
    );
    tocar(m.contenedor.querySelector('button')!);
    escribir(m.contenedor.querySelector('input')!, 'zzz-no-existe');

    expect(m.contenedor.textContent).toContain('Nada con ese nombre.');
    expect(m.contenedor.textContent).toContain('80 con más gente');
    m.desmontar();
  });

  test('sin buscar nada, la lista vacía no menciona el tope (no es el caso que preocupa)', () => {
    const m = montar(
      <FiltroFaceta rotulo="Curso" opciones={[]} elegidos={[]} cargando={false} onAlternar={() => {}} onLimpiar={() => {}} />,
    );
    tocar(m.contenedor.querySelector('button')!);

    expect(m.contenedor.textContent).toContain('No queda ninguna opción con estos filtros.');
    expect(m.contenedor.textContent).not.toContain('con más gente');
    m.desmontar();
  });
});
