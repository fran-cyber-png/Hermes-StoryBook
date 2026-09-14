// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { montar, tocar, type Montado } from '../../pruebas/dom';
import { BarraFiltros } from './BarraFiltros';
import { opcionesDeLinea } from './alcance';

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
      onAdministrarCategorias={() => {}}
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

/**
 * Abre el panel del selector de línea (botón compacto, 10-sep-2026 — ya no es
 * una fila de chips). Con `tocar` y no `.click()`: el clic dispara
 * `setAbierto(true)`, y sin envolverlo en `act()` la consulta de abajo llega
 * ANTES de que React repinte el panel — un falso «no se abrió nada».
 */
function abrirLinea(c: HTMLElement) {
  const boton = c.querySelector<HTMLButtonElement>('[aria-label="Elegir la línea de WhatsApp"]');
  if (boton) tocar(boton);
}

/** Abre el panel del selector de categorías. Mismo motivo que `abrirLinea`. */
function abrirCategorias(c: HTMLElement) {
  const boton = c.querySelector<HTMLButtonElement>('[aria-label="Elegir categoría"]');
  if (boton) tocar(boton);
}

const itemsLinea = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLButtonElement>('[data-linea-item]')).map((b) => b.textContent?.trim() ?? '');

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
    // que sigue eligible en el panel aunque su conteo caiga a cero.
    const c = pintar({ filtroSec: 'bot-escalada', conteos: { botEscalada: 0 } });
    expect(rotulos(c).join('|')).toContain('Pidió ayuda');
  });

  it('filtrar por el chip del bot llama a `onFiltro` con su valor', () => {
    const onFiltro = vi.fn();
    const c = pintar({ onFiltro, conteos: { botEscalada: 3 } });
    const chip = Array.from(c.querySelectorAll<HTMLButtonElement>('[data-chip]')).find((b) =>
      b.textContent?.includes('Pidió ayuda'),
    );
    if (chip) tocar(chip);
    expect(onFiltro).toHaveBeenCalledWith('bot-escalada');
  });
});

describe('el selector de categorías', () => {
  it('con categorías en el catálogo, aparecen en el panel al abrirlo', () => {
    const c = pintar({
      catalogo: [{ nombre: 'interesada', color: 'azul', orden: 0, esFavorito: false, conteo: 12 }],
    });
    abrirCategorias(c);
    const texto = Array.from(c.querySelectorAll<HTMLButtonElement>('[data-cat-item]'))
      .map((b) => b.textContent?.trim() ?? '')
      .join('|');
    expect(texto).toContain('interesada');
  });

  it('sin catálogo, el botón invita a crear la primera y no rompe', () => {
    const c = pintar({ catalogo: [] });
    abrirCategorias(c);
    expect(c.textContent).toContain('Todavía no tienes categorías');
  });

  it('elegir una categoría llama a `onCategoria`, y elegir la activa la apaga', () => {
    const onCategoria = vi.fn();
    const catalogo = [{ nombre: 'interesada', color: 'azul', orden: 0, esFavorito: false, conteo: 12 }];
    const c = pintar({ catalogo, onCategoria, categoriaActiva: 'interesada' });
    abrirCategorias(c);
    const item = c.querySelector<HTMLButtonElement>('[data-cat-item]');
    if (item) tocar(item);
    expect(onCategoria).toHaveBeenCalledWith(null);
  });

  it('«Administrar categorías» llama a `onAdministrarCategorias`, no a un modo aparte', () => {
    const onAdministrarCategorias = vi.fn();
    const catalogo = [{ nombre: 'interesada', color: 'azul', orden: 0, esFavorito: false, conteo: 12 }];
    const c = pintar({ catalogo, onAdministrarCategorias });
    abrirCategorias(c);
    const boton = Array.from(c.querySelectorAll('button')).find((b) => b.textContent?.includes('Administrar categorías'));
    if (boton) tocar(boton);
    expect(onAdministrarCategorias).toHaveBeenCalledTimes(1);
  });
});

/**
 * ⚠️ ESTE BLOQUE CAMBIÓ DE FORMA EL 10-SEP-2026: la línea dejó de ser una fila
 * de chips y pasó a ser un botón compacto que abre un panel (`SelectorLinea`).
 * La REGLA de qué opciones ofrecer sigue siendo la misma —vive pura en
 * `alcance.ts`, y sus tests no se tocaron—; lo que cambió es cómo se llega a
 * verlas en pantalla, y por eso estos tests abren el panel antes de mirar.
 *
 * Antes el selector ofrecía **todas las líneas vivas** más «Todas», y «Las mías»
 * era una opción más. Eso era razonable con una línea y una vendedora; con cinco
 * vendedoras nuevas que atienden UNA sola, les ponía adelante tres colas ajenas.
 * Ahora el selector ofrece **lo tuyo** cuando el mapa te asigna algo, y con una
 * sola línea propia directamente no se dibuja: una opción no es una elección.
 */
describe('el selector de línea', () => {
  it('sin líneas propias ofrece «Todas» y las dos líneas: fail-open, como siempre', () => {
    const c = pintar({ ...conLineas(LINEAS, false), onLinea: () => {} });
    abrirLinea(c);
    // «Bot» es `mias` (fixture de arriba) y se ve directo; «Escuela» no, y
    // vive colapsada detrás de «Ver las N líneas» — sigue siendo alcanzable,
    // que es lo único que este fail-open promete.
    expect(itemsLinea(c).join('|')).toContain('Todas');
    expect(itemsLinea(c).join('|')).toContain('Bot');
    const verMas = Array.from(c.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Ver las'));
    if (verMas) tocar(verMas);
    expect(itemsLinea(c).join('|')).toContain('Escuela');
  });

  /**
   * EL CASO DE LAS CINCO NUEVAS: una sola línea propia ⇒ el control desaparece.
   * Y con él tiene que desaparecer «Todas», que es la puerta a las colas ajenas.
   */
  it('con UNA línea propia el selector no se dibuja — ni «Todas» ni las ajenas', () => {
    const c = pintar({ ...conLineas(LINEAS, true), onLinea: () => {} });
    expect(c.querySelector('[aria-label="Elegir la línea de WhatsApp"]')).toBeNull();
    // La barra sigue viva: lo que se fue es el selector de línea, no la barra entera.
    expect(c.querySelector('[aria-label="Elegir categoría"]')).not.toBeNull();
  });

  /**
   * 🔴 EL DEFECTO DEL 7-SEP-2026, EN LA PANTALLA.
   *
   * `alex` es supervisor y el mapa le asigna UNA línea, así que caía justo en el
   * caso de arriba: sin selector y clavado a Ventas Meta. Con el rol puesto
   * vuelve el control **y «Todas» es la PRIMERA**, porque `lineaEfectiva` cae a
   * `opciones[0]` cuando lo guardado ya no está: si arrancara fija en tu línea,
   * el arreglo reproduciría el defecto con otro nombre.
   */
  it('quien supervisa con UNA línea propia recupera el selector, con «Todas» adelante', () => {
    const c = pintar({ ...conLineas(LINEAS, true, true), onLinea: () => {} });
    // Sin `lineaActiva`, el default ('') es «Todas»: así lo dice el botón ya cerrado.
    expect(c.querySelector('[aria-label="Elegir la línea de WhatsApp"]')?.textContent).toContain('Todas');

    abrirLinea(c);
    // Solo dos líneas en total: no llega al umbral que colapsa «Otras líneas».
    const items = itemsLinea(c);
    expect(items[0]).toBe('Todas');
    // «Bot» es la única `mias` de esta fixture: se fija como tu línea, por nombre.
    expect(items[1]).toBe('Bot');
    expect(items).toContain('Escuela');
    expect(items).not.toContain('Las mías');
  });

  it('con VARIAS propias, tu línea principal queda fija y la otra se ve bajo «Otras líneas»', () => {
    const dosPropias = LINEAS.map((l) => ({ ...l, mias: true }));
    const c = pintar({ ...conLineas(dosPropias, true), onLinea: () => {} });
    abrirLinea(c);
    const items = itemsLinea(c);
    // Sin `veTodo`, «Todas» no se ofrece — la regla de `alcance.ts` no cambió.
    expect(items).not.toContain('Todas');
    expect(items).not.toContain('Las mías');
    // La primera exclusiva/mias queda fija (acá, la primera de la lista: «Escuela»).
    expect(items[0]).toBe('Escuela');
    expect(items).toContain('Bot');
  });

  /**
   * 🔴 UN EQUIPO CHICO NO TIENE QUE PAGAR EL COSTO DEL COLAPSO. El «Ver las N
   * líneas» existe para las 20-30 de quien ve todo — con 4 en total (2 tuyas,
   * 2 ajenas), esconder 2 detrás de un clic es más fricción que la que
   * resuelve. Por debajo del umbral (`muchasLineas` en el componente) el resto
   * se ve directo, sin buscador y sin botón de expandir.
   */
  it('con pocas líneas en total, no colapsa nada: se ve todo directo, sin buscador ni «Ver más»', () => {
    const cuatro = [
      { numero: '51900000001', etiqueta: 'Tuya A', estado: 'conectado', mias: true },
      { numero: '51900000002', etiqueta: 'Tuya B', estado: 'conectado', mias: true },
      { numero: '51900000003', etiqueta: 'Ajena A', estado: 'conectado' },
      { numero: '51900000004', etiqueta: 'Ajena B', estado: 'conectado' },
    ];
    const c = pintar({ ...conLineas(cuatro, true, true), onLinea: () => {} });
    abrirLinea(c);
    const texto = itemsLinea(c).join('|');
    expect(texto).toContain('Tuya A');
    expect(texto).toContain('Ajena A');
    expect(texto).toContain('Ajena B');
    expect(Array.from(c.querySelectorAll('button')).some((b) => b.textContent?.startsWith('Ver las'))).toBe(false);
    expect(c.querySelector('[aria-label="Buscar línea o número"]')).toBeNull();
  });

  /**
   * 🔴 EL CASO REAL DE PRODUCCIÓN (pedido del dueño, 10-sep-2026): quien abre
   * el selector tiene UNA línea exclusiva (con su nombre, «Darwin») y además
   * comparte «Ventas Meta» con el resto del equipo. La exclusiva es «tu línea»
   * y queda FIJA arriba, por su nombre — tocarla filtra solo esa línea, no un
   * agregado. «Ventas Meta» ya no tiene trato especial: es una más de «Otras
   * líneas», pero ordenada ANTES que las enteramente ajenas (Nicole, Darian…)
   * porque sigue siendo tuya en el sentido de que la atendés.
   */
  it('tu línea exclusiva queda fija arriba; la compartida se ordena antes que las ajenas', () => {
    // Ocho en total (por encima del umbral de `muchasLineas`): así «Ver más»
    // entra en juego y el test también fija que las ajenas quedan detrás.
    const deDarwin = [
      { numero: '51900000201', etiqueta: 'Darwin', estado: 'conectado', mias: true, compartida: false },
      { numero: '51984429504', etiqueta: 'Ventas Meta', estado: 'conectado', mias: true, compartida: true, transporte: 'cloud-api' as const },
      { numero: '51900000202', etiqueta: 'Nicole', estado: 'conectado' },
      { numero: '51900000203', etiqueta: 'Darian', estado: 'conectado' },
      { numero: '51900000204', etiqueta: 'Ajena C', estado: 'conectado' },
      { numero: '51900000205', etiqueta: 'Ajena D', estado: 'conectado' },
      { numero: '51900000206', etiqueta: 'Ajena E', estado: 'conectado' },
      { numero: '51900000207', etiqueta: 'Ajena F', estado: 'conectado' },
    ];
    const c = pintar({ ...conLineas(deDarwin, true, true), onLinea: () => {} });
    abrirLinea(c);
    // Fija arriba, junto con «Todas»: nadie más queda ahí todavía.
    expect(itemsLinea(c)).toEqual(['Todas', 'Darwin']);

    // El resto —Ventas Meta incluida— vive detrás de «Ver más» a esta escala.
    const verMas = Array.from(c.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Ver las'));
    if (verMas) tocar(verMas);

    const items = itemsLinea(c);
    const iVentasMeta = items.findIndex((t) => t.startsWith('Ventas Meta'));
    const iNicole = items.indexOf('Nicole');
    expect(iVentasMeta).toBeGreaterThan(-1);
    expect(iNicole).toBeGreaterThan(-1);
    expect(iVentasMeta).toBeLessThan(iNicole);
  });

  /**
   * 🔴 EL SELECTOR YA NO ES UNA FILA — y por eso ya no compite por ancho con
   * los filtros. Hasta el 10-sep-2026 esto se probaba contando dos
   * `role="toolbar"` separados; ahora el selector es un botón suelto y el
   * único `toolbar` que queda es el de los filtros secundarios.
   */
  it('el selector de línea NO vive dentro de la pista de filtros', () => {
    const c = pintar({ ...conLineas(LINEAS, false), onLinea: () => {}, conteos: { botEscalada: 3 } });
    const toolbars = Array.from(c.querySelectorAll<HTMLElement>('[role="toolbar"]'));
    expect(toolbars).toHaveLength(1);
    expect(toolbars[0]!.textContent).toContain('Pidió ayuda');

    const trigger = c.querySelector('[aria-label="Elegir la línea de WhatsApp"]');
    expect(trigger).not.toBeNull();
    expect(toolbars[0]!.contains(trigger)).toBe(false);
  });

  it('sin selector de línea la pista de filtros sigue siendo la única', () => {
    // Con una línea propia el botón no se dibuja (regla de `alcance.ts`), y la
    // pista de filtros secundarios no depende de él para existir.
    const c = pintar({ ...conLineas(LINEAS, true), onLinea: () => {}, conteos: { botEscalada: 3 } });
    expect(c.querySelectorAll('[role="toolbar"]')).toHaveLength(1);
  });

  it('lo activo se ve en el botón, y se cambia de línea eligiendo del panel', () => {
    const onLinea = vi.fn();
    const dosPropias = LINEAS.map((l) => ({ ...l, mias: true }));
    const c = pintar({
      ...conLineas(dosPropias, true),
      onLinea,
      lineaActiva: '51986394450', // Escuela: tu línea principal en esta fixture.
    });
    expect(c.querySelector('[aria-label="Elegir la línea de WhatsApp"]')?.textContent).toContain('Escuela');

    abrirLinea(c);
    const botones = Array.from(c.querySelectorAll<HTMLButtonElement>('[data-linea-item]'));
    expect(botones.find((b) => b.textContent?.trim() === 'Escuela')?.getAttribute('aria-pressed')).toBe('true');
    const bot = botones.find((b) => b.textContent?.trim() === 'Bot');
    if (bot) tocar(bot);
    expect(onLinea).toHaveBeenCalledWith('51984429504');
  });
});
