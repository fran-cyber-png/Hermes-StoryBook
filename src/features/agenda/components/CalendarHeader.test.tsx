// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montar, type Montado } from '../../../pruebas/dom';
import { CalendarHeader } from './CalendarHeader';

/**
 * 🔴 EL «HOY» QUE MENTÍA.
 *
 * El botón vive pegado al título —es la decisión de diseño de esta barra: los
 * dos contestan «¿dónde estoy parada?» y se leen de un tirón—, y por eso mismo
 * un rótulo fijo deja de ser un botón. Parada en otro día, la agenda mostraba
 * «Hoy · lunes, 10 de agosto» un 20 de agosto: el rótulo se leía como el nombre
 * de la fecha que tenía al lado y juraba que el 10 era hoy.
 *
 * El estilo apagado no alcanzaba y por eso esto se testea con el TEXTO, no con
 * la clase: de un vistazo se lee lo que dice, no el borde que lo rodea.
 */

let montado: Montado | null = null;

afterEach(() => {
  montado?.desmontar();
  montado = null;
});

const nada = () => {};

function barra(props: { enHoy: boolean; title?: string; onToday?: () => void }) {
  return (
    <CalendarHeader
      title={props.title ?? 'lunes, 10 de agosto'}
      modo="dia"
      enHoy={props.enHoy}
      onToday={props.onToday ?? nada}
      onPrevious={nada}
      onNext={nada}
      onModoChange={nada}
      onCreateClick={nada}
    />
  );
}

const rotulos = () => [...montado!.contenedor.querySelectorAll('button')].map((b) => b.textContent);

describe('CalendarHeader — el botón de volver', () => {
  it('🔴 parada en otro día, NINGÚN botón dice «Hoy»: dice qué hace', () => {
    montado = montar(barra({ enHoy: false }));
    expect(rotulos()).toContain('Volver a hoy');
    expect(rotulos()).not.toContain('Hoy');
    // Y el título sigue siendo el del día que se mira, no el de hoy.
    expect(montado.contenedor.textContent).toMatch(/lunes, 10 de agosto/);
  });

  it('parada en hoy sí dice «Hoy», y lo anuncia como la fecha actual', () => {
    montado = montar(barra({ enHoy: true, title: 'jueves, 20 de agosto' }));
    expect(rotulos()).toContain('Hoy');
    expect(rotulos()).not.toContain('Volver a hoy');
    expect(montado.contenedor.querySelector('[aria-current="date"]')?.textContent).toBe('Hoy');
  });

  it('«Volver a hoy» vuelve: el rótulo cambió, el cable no', () => {
    const volver = vi.fn();
    montado = montar(barra({ enHoy: false, onToday: volver }));
    const boton = [...montado.contenedor.querySelectorAll('button')].find((b) => b.textContent === 'Volver a hoy');
    boton!.click();
    expect(volver).toHaveBeenCalledTimes(1);
  });
});
