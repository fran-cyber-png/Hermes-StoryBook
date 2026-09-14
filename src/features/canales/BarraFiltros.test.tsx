// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montar, type Montado } from '../../pruebas/dom';
import { BarraFiltros } from './BarraFiltros';
import { opcionesDeLinea } from './alcance';
import { LINEA_MIAS } from '../../dominio/cola';

/**
 * LO QUE ESTE TEST CUIDA, Y POR QUÉ NO ALCANZABA UN TEST PURO.
 *
 * Las reglas de la barra son de CABLEADO, no de decisión:
 *
 *  1. Los dos chips del bot solo se dibujan cuando tienen algo que decir. El bot
 *     corre en una línea de cuatro; en las otras tres serían dos chips muertos
 *     comiéndose el ancho de los que se usan todos los días. Y al revés: el chip
 *     APARECIENDO es el aviso de que el bot escaló algo.
 *  2. **Los tres chips retirados el 22-ago-2026** («Preguntaron precio», «Te
 *     escribieron», «Puedo escribirle» — pedido del dueño) NUNCA se dibujan,
 *     tengan el conteo que tengan: `CHIPS_EN_BARRA` (`dominio/cola.ts`) es hoy
 *     solo los dos del bot. Los tres siguen siendo `FiltroSec` válidos (por
 *     eso el server sigue mandando sus conteos) — lo único que se probó acá
 *     es que la BARRA no les ofrece un botón.
 *  3. «Las mías» solo se ofrece a quien tiene líneas asignadas — si no, es un
 *     botón que no cambia nada (la misma regla por la que el selector entero no
 *     existe con una sola línea).
 *
 * Las tres se pueden romper sin que falle ningún test puro: son un `filter` y un
 * `&&` adentro del JSX. Es la lección del ADR 0024 aplicada a otro componente.
 */

let montado: Montado | null = null;
afterEach(() => {
  montado?.desmontar();
  montado = null;
});

const LINEAS = [
  { numero: '51986394450', etiqueta: 'Escuela', estado: 'conectado' },
  { numero: '51984429504', etiqueta: 'Bot', estado: 'conectado', mias: true },
];

/** Lo mínimo que la barra necesita para pintarse; cada test cambia lo suyo. */
function pintar(props: Partial<Parameters<typeof BarraFiltros>[0]> = {}) {
  montado = montar(
    <BarraFiltros
      filtroSec=""
      onFiltro={() => {}}
      categoriaActiva={null}
      onCategoria={() => {}}
      onListas={() => {}}
      {...props}
    />,
  );
  return montado.contenedor;
}

/**
 * LA COMPOSICIÓN QUE HACE LA PANTALLA, TAL CUAL — `ColaUnificada` resuelve las
 * opciones con `opcionesDeLinea` y le pasa a la barra el resultado.
 *
 * ⚠️ **Se compone acá y no se escriben opciones a mano** a propósito: lo que
 * estos tests cuidan es que la salida de la REGLA llegue a la pantalla. Con
 * opciones literales seguirían verdes con la regla rota, que es exactamente el
 * agujero que el ADR 0024 describe.
 */
const conLineas = (
  lineas: Parameters<typeof opcionesDeLinea>[0],
  hayMias: boolean,
  veTodo = false,
) => ({ opciones: opcionesDeLinea(lineas, hayMias, veTodo) });

const rotulos = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('[data-chip]')).map((b) => b.textContent?.trim() ?? '');

describe('los tres chips retirados el 22-ago-2026', () => {
  it('nunca se dibujan, aunque el server mande sus conteos', () => {
    const c = pintar({
      conteos: { preguntoPrecio: 65, teEscribieron: 33, puedoEscribirle: 25 },
    });
    const texto = rotulos(c).join('|');
    expect(texto).not.toContain('Preguntaron precio');
    expect(texto).not.toContain('Te escribieron');
    expect(texto).not.toContain('Puedo escribirle');
  });

  it('tampoco si el filtro activo es uno de ellos — no resucitan por estar seleccionados', () => {
    const c = pintar({
      filtroSec: 'pregunto-precio',
      conteos: { preguntoPrecio: 65, teEscribieron: 33, puedoEscribirle: 25 },
    });
    expect(rotulos(c).join('|')).not.toContain('Preguntaron precio');
  });
});

describe('los chips del bot', () => {
  it('NO se dibujan cuando el bot no dijo nada (las otras tres líneas)', () => {
    const c = pintar({ conteos: { botEscalada: 0, botCaliente: 0 } });
    const texto = rotulos(c).join('|');
    expect(texto).not.toContain('Pidió ayuda');
    expect(texto).not.toContain('calientes');
  });

  it('tampoco cuando el server es viejo y ni manda los conteos', () => {
    // Un server sin este cambio no manda `botEscalada`. `undefined` no puede
    // dibujar un chip vacío: se comporta como cero.
    const c = pintar({});
    expect(rotulos(c).join('|')).not.toContain('Pidió ayuda');
  });

  it('APARECEN con su número cuando el bot escaló algo — el chip nuevo ES el aviso', () => {
    const c = pintar({ conteos: { botEscalada: 3, botCaliente: 14 } });
    const texto = rotulos(c).join('|');
    expect(texto).toContain('Pidió ayuda');
    expect(texto).toContain('3');
    expect(texto).toContain('14');
  });

  it('el chip ACTIVO sigue a la vista aunque su recorte lo deje en cero', () => {
    // Si desapareciera al filtrar, la vendedora se quedaría mirando una cola
    // vacía sin el chip que la apaga. Mismo criterio que la categoría activa,
    // que entra a la barra aunque el tope la dejara afuera.
    const c = pintar({ filtroSec: 'bot-escalada', conteos: { botEscalada: 0 } });
    expect(rotulos(c).join('|')).toContain('Pidió ayuda');
  });

  it('filtrar por el chip del bot llama a `onFiltro` con su valor', () => {
    const onFiltro = vi.fn();
    const c = pintar({ onFiltro, conteos: { botEscalada: 3 } });
    const chip = Array.from(c.querySelectorAll<HTMLButtonElement>('[data-chip]')).find((b) =>
      b.textContent?.includes('Pidió ayuda'),
    );
    chip?.click();
    expect(onFiltro).toHaveBeenCalledWith('bot-escalada');
  });
});

describe('las etiquetas ganan el lugar de los tres chips retirados', () => {
  it('con categorías en el catálogo, se dibujan en la pista de los filtros aunque no haya chips del bot', () => {
    const c = pintar({
      catalogo: [{ nombre: 'interesada', color: 'azul', orden: 0, esFavorito: false, conteo: 12 }],
    });
    const texto = rotulos(c).join('|');
    expect(texto).toContain('interesada');
    expect(texto).not.toContain('Pidió ayuda');
  });
});

/**
 * ⚠️ ESTE BLOQUE CAMBIÓ DE REGLA EL 4-AGO-2026, y los tres tests de abajo
 * afirmaban la anterior.
 *
 * Antes el selector ofrecía **todas las líneas vivas** más «Todas», y «Las mías»
 * era una opción más. Eso era razonable con una línea y una vendedora; con cinco
 * vendedoras nuevas que atienden UNA sola, les ponía adelante tres colas ajenas
 * —y dos de esos rótulos se distinguen por una `s` y una tilde, «Ventas Perú» y
 * «Venta Peru»—. Ahora el selector ofrece **lo tuyo** cuando el mapa te asigna
 * algo, y con una sola línea propia directamente no se dibuja: una opción no es
 * una elección. La decisión vive pura en `alcance.ts`; acá se fija el CABLEADO.
 */
describe('el segmentado de línea', () => {
  it('sin líneas propias ofrece «Todas» y las cuatro: fail-open, como siempre', () => {
    const texto = rotulos(pintar({ ...conLineas(LINEAS, false), onLinea: () => {} })).join('|');
    expect(texto).toContain('Todas');
    expect(texto).toContain('Escuela');
    expect(texto).toContain('Bot');
  });

  /**
   * EL CASO DE LAS CINCO NUEVAS: una sola línea propia ⇒ el control desaparece.
   * Y con él tiene que desaparecer «Todas», que es la puerta a las colas ajenas.
   */
  it('con UNA línea propia el selector no se dibuja — ni «Todas» ni las ajenas', () => {
    const texto = rotulos(
      pintar({ ...conLineas(LINEAS, true), onLinea: () => {}, onListas: () => {} }),
    ).join('|');
    expect(texto).not.toContain('Todas');
    expect(texto).not.toContain('Escuela');
    expect(texto).not.toContain('Las mías');
    // La barra sigue viva: lo que se fue es el selector de línea, no la barra entera.
    expect(texto).toContain('listas');
  });

  /**
   * 🔴 EL DEFECTO DEL 7-SEP-2026, EN LA PANTALLA.
   *
   * `alex` es supervisor y el mapa le asigna UNA línea, así que caía justo en el
   * caso de arriba: sin selector y clavado a Ventas Meta. Su cola decía «2.346
   * en cola» —el conteo exacto de esa línea— mientras el server le servía las
   * 7.178 de la mesa entera.
   *
   * Con el rol puesto vuelve el control **y «Todas» es la PRIMERA**, porque
   * `lineaEfectiva` cae a `opciones[0]` cuando lo guardado ya no está: si
   * arrancara en «Las mías», el arreglo reproduciría el defecto con otro nombre.
   */
  it('quien supervisa con UNA línea propia recupera el selector, con «Todas» adelante', () => {
    const c = pintar({ ...conLineas(LINEAS, true, true), onLinea: () => {} });
    const chips = rotulos(c);
    expect(chips[0]).toBe('Todas');
    expect(chips.join('|')).toContain('Las mías');
    expect(chips.join('|')).toContain('Escuela');
  });

  it('con VARIAS propias sí hay elección: «Las mías» + las suyas, sin «Todas»', () => {
    const dosPropias = LINEAS.map((l) => ({ ...l, mias: true }));
    const c = pintar({ ...conLineas(dosPropias, true), onLinea: () => {} });
    const texto = rotulos(c).join('|');
    expect(texto).toContain('Las mías');
    expect(texto).toContain('Escuela');
    expect(texto).not.toContain('Todas');
  });

  it('«Las mías» manda el valor reservado del MISMO eje, no una bandera aparte', () => {
    const onLinea = vi.fn();
    const c = pintar({ ...conLineas(LINEAS.map((l) => ({ ...l, mias: true })), true), onLinea });
    const boton = Array.from(c.querySelectorAll<HTMLButtonElement>('[data-chip]')).find((b) =>
      b.textContent?.includes('Las mías'),
    );
    boton?.click();
    expect(onLinea).toHaveBeenCalledWith(LINEA_MIAS);
  });

  /**
   * 🔴 DOS PISTAS, NO UNA — y no es cosmética.
   *
   * Compartiendo una sola barra, cuatro líneas vivas se comían los 336 px y el
   * contenido de la segunda pista quedaba fuera de la vista, detrás de un
   * scroll horizontal que no se anuncia.
   *
   * Se fija la SEPARACIÓN y no el ancho: jsdom no hace layout, así que
   * `scrollWidth` es siempre 0 y «entra sin scrollear» no se puede afirmar acá.
   * Lo que sí se puede romper de un tipeo es el cableado — volver a meter el
   * segmentado adentro de la pista de los filtros—, y eso es lo que se mira.
   */
  it('la línea y los filtros viven en pistas SEPARADAS', () => {
    const c = pintar({ ...conLineas(LINEAS, false), onLinea: () => {}, conteos: { botEscalada: 3 } });
    const pistas = Array.from(c.querySelectorAll<HTMLElement>('[role="toolbar"]'));
    expect(pistas).toHaveLength(2);

    const textoDe = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('[data-chip]')).map((b) => b.textContent?.trim() ?? '').join('|');
    expect(textoDe(pistas[0]!)).toContain('Todas');
    expect(textoDe(pistas[0]!)).not.toContain('Pidió ayuda');
    expect(textoDe(pistas[1]!)).toContain('Pidió ayuda');
    expect(textoDe(pistas[1]!)).not.toContain('Todas');
  });

  it('sin selector de línea queda UNA sola pista: la de los filtros', () => {
    // Con una línea propia el segmentado no se dibuja (regla de `alcance.ts`), y
    // entonces no hay por qué gastar los 26 px de una fila vacía.
    const c = pintar({ ...conLineas(LINEAS, true), onLinea: () => {}, conteos: { botEscalada: 3 } });
    expect(c.querySelectorAll('[role="toolbar"]')).toHaveLength(1);
  });

  it('lo activo se ve activo, y se cambia de línea con un click', () => {
    const onLinea = vi.fn();
    const c = pintar({
      ...conLineas(LINEAS.map((l) => ({ ...l, mias: true })), true),
      onLinea,
      lineaActiva: LINEA_MIAS,
    });
    const botones = Array.from(c.querySelectorAll<HTMLButtonElement>('[data-chip]'));
    expect(botones.find((b) => b.textContent?.includes('Las mías'))?.getAttribute('aria-pressed')).toBe('true');
    botones.find((b) => b.textContent?.trim() === 'Escuela')?.click();
    expect(onLinea).toHaveBeenCalledWith('51986394450');
  });
});
