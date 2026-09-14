// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { montar, type Montado } from '../../pruebas/dom';
import { PorQueSePierden } from './PorQueSePierden';

/**
 * «POR QUÉ SE PIERDEN» EN «EL NEGOCIO» (ADR 0107).
 *
 * El conteo lo hace el server sobre la cohorte de la tabla (`server/src/dashboard/
 * negocio.perdidas.test.db.ts`). Acá se fija lo que dice la pantalla: de cuántas, por qué
 * —con el rótulo, nunca el id—, y qué dice cuando no hay ninguna, que en este negocio es
 * lo más probable (0 perdidos declarados en ventas en toda la historia).
 */

let vista: Montado | null = null;

afterEach(() => {
  vista?.desmontar();
  vista = null;
});

const filas = () =>
  [...vista!.contenedor.querySelectorAll('[data-motivo]')].map((f) => [
    f.querySelector('[data-rotulo]')?.textContent,
    f.querySelector('[data-n]')?.textContent,
  ]);

describe('PorQueSePierden — el bloque de «El negocio»', () => {
  it('🔴 dice cuántas de las que llegaron hoy están perdidas, y por qué, con sus rótulos', () => {
    vista = montar(
      <PorQueSePierden
        llegaron={890}
        perdidas={{
          total: 4,
          porMotivo: [
            { motivo: 'precio', n: 2 },
            { motivo: 'no_contesta', n: 1 },
            { motivo: null, n: 1 },
          ],
        }}
      />,
    );

    expect(vista.contenedor.textContent).toContain('4 de las 890');
    expect(filas()).toEqual([
      ['Precio', '2'],
      ['No contesta', '1'],
      ['Sin motivo', '1'],
    ]);
  });

  it('sin pérdidas lo dice, y dice que el motivo lo declara una persona', () => {
    vista = montar(<PorQueSePierden llegaron={890} perdidas={{ total: 0, porMotivo: [] }} />);

    expect(filas()).toEqual([]);
    expect(vista.contenedor.textContent).toContain('Nadie declaró');
    expect(vista.contenedor.textContent).toContain('lo declara una persona');
  });

  it('un server que todavía no manda el bloque no dibuja nada (ADR 0007)', () => {
    vista = montar(<PorQueSePierden llegaron={890} perdidas={undefined} />);

    expect(vista.contenedor.textContent).toBe('');
  });
});
