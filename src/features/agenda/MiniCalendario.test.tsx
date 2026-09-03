// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { montar, type Montado } from '../../pruebas/dom';
import { MiniCalendario } from './MiniCalendario';
import type { Recordatorio } from './agenda';

/**
 * 🔴 EL MINICALENDARIO SEÑALABA SIEMPRE HOY.
 *
 * Se tocaba el 10, el título de la barra cambiaba a «lunes, 10 de agosto» y la
 * grilla seguía marcando el 20 —hoy— como única casilla pintada: el clic no
 * dejaba rastro donde se había dado. Son dos preguntas distintas, «¿qué día es?»
 * y «¿qué día estoy mirando?», y hacían falta dos marcas para contestarlas.
 *
 * Se mide por `aria-current` y no por clases de Tailwind: es lo que también
 * escucha un lector de pantalla, y no se rompe cuando cambia una paleta.
 */

let montado: Montado | null = null;

afterEach(() => {
  montado?.desmontar();
  montado = null;
});

/** Jueves 20 de agosto de 2026 — el mismo día en que la barra decía «Hoy» mirando el 10. */
const HOY = new Date(2026, 7, 20, 10, 30);
/** Lunes 10 de agosto: el día que se está mirando. */
const FOCO = new Date(2026, 7, 10, 9, 0);

const SIN_NADA = new Map<string, Recordatorio[]>();

function mini(foco: Date) {
  return <MiniCalendario foco={foco} hoy={HOY} porDia={SIN_NADA} onClickDia={() => {}} onCambiarMes={() => {}} />;
}

const marcadas = (valor: string) =>
  [...montado!.contenedor.querySelectorAll(`[aria-current="${valor}"]`)].map((c) => c.textContent);

describe('MiniCalendario — las dos marcas', () => {
  it('🔴 el día que se mira queda marcado, y hoy sigue siendo hoy', () => {
    montado = montar(mini(FOCO));
    expect(marcadas('date')).toEqual(['20']);
    expect(marcadas('true')).toEqual(['10']);
  });

  it('mirando hoy hay UNA sola marca: hoy gana y no se dibuja dos veces', () => {
    montado = montar(mini(HOY));
    expect(marcadas('date')).toEqual(['20']);
    expect(marcadas('true')).toEqual([]);
  });
});
