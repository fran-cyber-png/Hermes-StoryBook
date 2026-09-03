// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { montar, tocar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { MenuHerramientas } from './MenuHerramientas';

/**
 * EL MENÚ `···` DE UN OPERADOR DE CAMPAÑA — y lo que se fija es el CABLEADO.
 *
 * 🔴 **Por qué no alcanza `itemsHerramientas.test.ts`**, que ya prueba la
 * regla: el defecto de ADR 0024 no es que la regla esté mal escrita, es que
 * NADIE LA LLAMA. `armarItemsMenu` puede filtrar perfecto y este componente
 * seguir sin pasarle quién mira — o `BarraGestion` sin pasarle `esDeCampana` a
 * este componente— y el ítem sigue dibujándose. Eso sólo se ve montando.
 *
 * 🔴 **Y tiene DOS MITADES a propósito**: un test que sólo comprueba que en
 * campaña no aparece pasa en verde si alguien rompe el menú entero y no dibuja
 * nada para nadie. La segunda mitad exige que en ventas SÍ esté. Lo que se fija
 * es la diferencia, no la ausencia.
 */

const CONTACTO: Conversacion = {
  clave: 'conv:whatsapp:51987654321:51963139984',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51987654321',
  persona_nombre: 'Javier Peralta',
  numero_propio: '51963139984',
  texto: null,
  contexto_texto: null,
  respondida: false,
  ventana_abierta: false,
  pregunto: false,
  n: 0,
  referencia: '2026-08-05T14:00:00.000Z',
  ultimo_at: '2026-08-05T14:00:00.000Z',
  dias: 0,
  nivel: 5,
};

let vista: Montado | null = null;

afterEach(() => {
  vista?.desmontar();
  vista = null;
});

/** Abre el `···` y devuelve el texto del panel. */
function abrirMenu(esDeCampana: boolean): string {
  vista = montar(<MenuHerramientas conversacion={CONTACTO} esDeCampana={esDeCampana} />);
  const boton = vista.contenedor.querySelector('[aria-label="Más herramientas"]');
  expect(boton, 'el botón `···` tiene que existir para que el resto signifique algo').not.toBeNull();
  tocar(boton!);
  return vista.contenedor.textContent ?? '';
}

describe('MenuHerramientas — qué herramientas trae cada módulo', () => {
  it('en campaña el menú no ofrece «Datos recomendados» ni su sección', () => {
    const texto = abrirMenu(true);

    // El ítem, y también el rótulo de su sección: es el único de «Inteligencia»,
    // así que dejarlo sería un encabezado sobre una lista vacía.
    expect(texto).not.toContain('Datos recomendados');
    expect(texto).not.toContain('Inteligencia');
    // El menú sigue existiendo: sin esto, el test pasaría con el panel roto.
    expect(texto).toContain('Etiquetas');
  });

  it('en ventas el menú sí lo ofrece', () => {
    const texto = abrirMenu(false);

    expect(texto).toContain('Datos recomendados');
    expect(texto).toContain('Inteligencia');
  });
});
