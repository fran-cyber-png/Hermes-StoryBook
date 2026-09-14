// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { montar, type Montado } from '../../pruebas/dom';
import { PanelNegocio } from './PanelNegocio';
import { NEGOCIO_POR_CURSO } from './galeria.negocio';

/**
 * «POR QUÉ SE PIERDEN» ESTÁ EN «EL NEGOCIO» — EL CABLEADO (ADR 0107).
 *
 * `PorQueSePierden.test.tsx` fija qué dice el bloque. Esto fija que el panel lo DIBUJE con
 * lo que manda el server, y antes de la tabla, que es la cohorte que cuenta. Dos mitades:
 * con el bloque en la respuesta aparece; sin él (server viejo o caché, ADR 0007), no.
 */

let vista: Montado | null = null;

afterEach(() => {
  vista?.desmontar();
  vista = null;
});

const bloque = () => vista!.contenedor.querySelector('section[aria-label="Por qué se pierden"]');

describe('PanelNegocio — «Por qué se pierden»', () => {
  it('🔴 con el bloque en la respuesta, el panel lo dibuja antes de la tabla', () => {
    vista = montar(
      <PanelNegocio
        datos={{ ...NEGOCIO_POR_CURSO, perdidas: { total: 1, porMotivo: [{ motivo: 'precio', n: 1 }] } }}
        cargando={false}
        actualizando={false}
        dimension="curso"
      />,
    );

    expect(bloque(), 'el panel tiene que dibujar el bloque').not.toBeNull();
    const tabla = vista.contenedor.querySelector('table');
    expect(tabla, 'la tabla del negocio sigue ahí').not.toBeNull();
    expect(bloque()!.compareDocumentPosition(tabla!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sin el bloque en la respuesta (server viejo), el panel no lo inventa', () => {
    vista = montar(
      <PanelNegocio datos={{ ...NEGOCIO_POR_CURSO, perdidas: undefined }} cargando={false} actualizando={false} dimension="curso" />,
    );

    expect(bloque()).toBeNull();
  });
});
