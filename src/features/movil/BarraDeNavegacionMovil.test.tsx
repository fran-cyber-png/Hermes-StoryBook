// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montar, tocar, type Montado } from '../../pruebas/dom';
import { BarraDeNavegacionMovil } from './BarraDeNavegacionMovil';

/**
 * LA PÍLDORA FLOTANTE: lo que la distingue de un piso de dos mitades (ADR 0113,
 * enmienda del 12-sep-2026). Lo que se fija es la FORMA que pidió el diseño,
 * porque es lo que un test del cableado no mira:
 *
 *   · la activa se marca con `aria-current` y con el color — no con un fondo ni
 *     con un punto: el dueño lo sacó al verlo;
 *   · la píldora no ocupa el ancho: es `w-fit`, centrada, y flota sobre la lista
 *     (`absolute`), con el envoltorio sin eventos para que la lista de atrás
 *     se siga pudiendo tocar a los costados;
 *   · sin globos ni números;
 *   · tocar un destino avisa cuál.
 */

let m: Montado | null = null;
afterEach(() => {
  m?.desmontar();
  m = null;
});

const nav = () => document.querySelector<HTMLElement>('nav[aria-label="Secciones"]')!;
const botones = () => [...nav().querySelectorAll('button')];
const activo = () => nav().querySelector<HTMLElement>('[aria-current="page"]');

describe('BarraDeNavegacionMovil', () => {
  it('dos destinos, Mensajes y Pipeline; la activa se distingue por el color, sin punto ni número', () => {
    m = montar(<BarraDeNavegacionMovil activa="bandeja" onElegir={() => {}} />);
    expect(botones().map((b) => b.textContent)).toEqual(['Mensajes', 'Pipeline']);
    expect(activo()?.textContent).toBe('Mensajes');
    expect(activo()?.className).toMatch(/\btext-primary\b/);
    expect(botones()[1].className).not.toMatch(/\btext-primary\b/);
    expect(nav().querySelector('[data-punto]'), 'el punto de debajo del rótulo ya no existe').toBeNull();
    expect(nav().textContent).not.toMatch(/\d/);
  });

  it('con Pipeline activa, el color se muda', () => {
    m = montar(<BarraDeNavegacionMovil activa="embudo" onElegir={() => {}} />);
    expect(activo()?.textContent).toBe('Pipeline');
    expect(activo()?.className).toMatch(/\btext-primary\b/);
    expect(botones()[0].className).not.toMatch(/\btext-primary\b/);
  });

  it('flota centrada y al ancho de su contenido, y el envoltorio deja pasar los toques a la lista de atrás', () => {
    m = montar(<BarraDeNavegacionMovil activa="bandeja" onElegir={() => {}} />);
    const envoltorio = nav();
    const pildora = envoltorio.querySelector<HTMLElement>('[data-pildora]')!;
    expect(envoltorio.className).toMatch(/\babsolute\b/);
    expect(envoltorio.className).toMatch(/\bpointer-events-none\b/);
    expect(envoltorio.className).toMatch(/\bjustify-center\b/);
    expect(pildora.className).toMatch(/\bpointer-events-auto\b/);
    expect(pildora.className).toMatch(/\bw-fit\b/);
    expect(pildora.className).toMatch(/\brounded-full\b/);
  });

  it('tocar un destino avisa cuál', () => {
    const onElegir = vi.fn();
    m = montar(<BarraDeNavegacionMovil activa="bandeja" onElegir={onElegir} />);
    tocar(botones()[1]);
    expect(onElegir).toHaveBeenCalledWith('embudo');
  });
});
