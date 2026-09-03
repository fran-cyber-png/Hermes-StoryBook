import { describe, expect, it, vi } from 'vitest';
import { agruparPorSeccion, armarItemsMenu, HERRAMIENTAS, herramientasDe } from './itemsHerramientas';

describe('armarItemsMenu', () => {
  /**
   * Las cinco de `FLUJO.md` **en su orden**, más una sexta que no estaba ahí.
   *
   * «Datos recomendados» se agregó el 4-ago-2026 y no reusa el slot `catalogo`
   * a propósito: aquél es el catálogo de CURSOS con contexto (#51), que se
   * consulta; éste es el catálogo `hechos`, que se EDITA y es del equipo.
   *
   * Va última para no reordenar lo decidido: el orden de las cinco primeras es
   * el de `FLUJO.md` y este test lo fija.
   */
  it('arma las herramientas en el orden de FLUJO.md, con «datos» al final', () => {
    const items = armarItemsMenu('conv:whatsapp:521:519');
    expect(items.map((i) => i.id)).toEqual([
      'correo',
      'mensajes',
      'etiquetas',
      'notas',
      'catalogo',
      'datos',
    ]);
    expect(items).toHaveLength(HERRAMIENTAS.length);
  });

  /**
   * La puerta al catálogo de datos tiene que EXISTIR y estar habilitada: su
   * versión anterior vivía en `hechos/BloqueHechos.tsx`, que **nadie monta**
   * desde que el panel derecho se reescribió como timeline (`0b3d17b`). Una
   * pantalla a la que no se llega es código muerto con tests.
   */
  it('«datos» se habilita cuando se le pasa su handler', () => {
    const abrir = vi.fn();
    const items = armarItemsMenu('conv:whatsapp:521:519', { datos: abrir });
    const datos = items.find((i) => i.id === 'datos')!;

    expect(datos.onSeleccionar, 'sin handler la pantalla es inalcanzable').not.toBeNull();
    datos.onSeleccionar!();
    expect(abrir).toHaveBeenCalledWith('conv:whatsapp:521:519');
  });

  it('sin handlers, todas quedan deshabilitadas (onSeleccionar null)', () => {
    const items = armarItemsMenu('conv:whatsapp:521:519');
    expect(items.every((i) => i.onSeleccionar === null)).toBe(true);
  });

  it('con handler, el item se habilita e invoca el callback con la clave correcta', () => {
    const onCorreo = vi.fn();
    const items = armarItemsMenu('conv:whatsapp:521:519', { correo: onCorreo });

    const correo = items.find((i) => i.id === 'correo')!;
    expect(correo.onSeleccionar).not.toBeNull();
    correo.onSeleccionar!();
    expect(onCorreo).toHaveBeenCalledTimes(1);
    expect(onCorreo).toHaveBeenCalledWith('conv:whatsapp:521:519');

    // Las otras siguen sin handler propio.
    const resto = items.filter((i) => i.id !== 'correo');
    expect(resto.every((i) => i.onSeleccionar === null)).toBe(true);
  });

  /**
   * 🔴 EL MENÚ DE UN OPERADOR DE CAMPAÑA NO TRAE «DATOS RECOMENDADOS»
   * (24-ago-2026, pedido del dueño). Son los argumentos de venta de la Escuela
   * —el precio, el material, «dejó de contestar»— y una candidatura no vende un
   * curso.
   *
   * ⚠️ Lo que hacía que esto NO se notara es lo que lo vuelve un candado y no un
   * gusto: `/api/hechos` ya es `ventas` (`modulos/modulo.ts`), así que el ítem
   * abría una pantalla que come 403 y la dibuja como «Todavía no hay datos
   * cargados» / «Tienes 0 datos prendidos». Un 403 leído como catálogo vacío es
   * una invitación a llenarlo.
   */
  it('el operador de campaña no ve «Datos recomendados»', () => {
    const items = armarItemsMenu('conv:whatsapp:521:519', { datos: vi.fn() }, 'campana');

    expect(items.map((i) => i.id)).not.toContain('datos');
  });

  /**
   * La sección «Inteligencia» tiene UN solo ítem, así que sacarlo tiene que
   * sacar también su encabezado: `agruparPorSeccion` sólo junta lo que hay, y
   * un rótulo sobre una lista vacía es peor que el ítem que se quiso esconder.
   */
  it('sin «datos», la sección Inteligencia no queda como rótulo huérfano', () => {
    const items = armarItemsMenu('conv:x', {}, 'campana');

    expect(agruparPorSeccion(items).map((g) => g.seccion)).toEqual(['frecuentes', 'herramientas']);
  });

  /**
   * El otro lado del mismo candado: a la vendedora de la Escuela no se le sacó
   * nada. Sin este test, «no ve datos» se cumpliría igual si el filtro se los
   * sacara a todo el mundo.
   */
  it('la vendedora de la Escuela sigue viendo las seis', () => {
    expect(armarItemsMenu('conv:x', {}, 'ventas')).toHaveLength(HERRAMIENTAS.length);
    expect(armarItemsMenu('conv:x')).toHaveLength(HERRAMIENTAS.length);
  });

  /**
   * ⚠️ AUSENTE SE LEE COMO `ventas`. Es la misma elección que `noEsDeCampana`
   * hace en el riel: mientras el server no afirme el módulo, el menú es el de
   * siempre. Lo que niega de verdad es `modulos/deEsteModulo.ts`, no esto.
   */
  it('sin saber de quién se trata, el menú es el completo', () => {
    expect(herramientasDe().map((h) => h.id)).toContain('datos');
    expect(herramientasDe(undefined).map((h) => h.id)).toContain('datos');
  });

  it('no muta el handler entre llamadas con distinta clave', () => {
    const onNotas = vi.fn();
    const paraA = armarItemsMenu('conv:a', { notas: onNotas }).find((i) => i.id === 'notas')!;
    const paraB = armarItemsMenu('conv:b', { notas: onNotas }).find((i) => i.id === 'notas')!;

    paraA.onSeleccionar!();
    paraB.onSeleccionar!();

    expect(onNotas).toHaveBeenNthCalledWith(1, 'conv:a');
    expect(onNotas).toHaveBeenNthCalledWith(2, 'conv:b');
  });
});

/**
 * El tercer eslabón del cable, y el único que ningún test de componente ve:
 * `MenuHerramientas` puede filtrar perfecto y `BarraGestion` montarlo sin
 * pasarle `esDeCampana` — el menú vuelve a ofrecerlo, en silencio.
 *
 * ⚠️ `import.meta.glob` y **no `node:fs`**: el segundo pasa en vitest y falla
 * en `tsc -p tsconfig.app.json`, que no lleva los tipos de node (la cicatriz de
 * `lib/etapas.test.ts`, misma nota que en `vistas/acceso.test.ts`).
 */
const BARRA: string = Object.values(
  import.meta.glob('./BarraGestion.tsx', { eager: true, query: '?raw', import: 'default' }) as Record<
    string,
    string
  >,
)[0];

describe('el cable desde BarraGestion', () => {
  it('le pasa `esDeCampana` a MenuHerramientas', () => {
    const renglon = BARRA.split('\n').find((l) => l.includes('<MenuHerramientas'));
    expect(renglon, 'no encontré el montaje de MenuHerramientas en BarraGestion.tsx').toBeDefined();
    expect(renglon).toContain('esDeCampana={esDeCampana}');
  });
});
