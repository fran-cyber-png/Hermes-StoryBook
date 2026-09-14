import { describe, expect, it } from 'vitest';
import {
  avisosDe,
  campanasDe,
  filtrarContactos,
  nombreVisible,
  productividad,
  puntoDePrioridad,
  quienRegistro,
  type ContactoRegistrado,
} from './contactosRegistrados';

const BASE: ContactoRegistrado = {
  clave: 'conv:whatsapp:51943348051:51963139984',
  telefono: '51943348051',
  nombre: 'Andrea',
  apellido: 'Quispe',
  empresa: null,
  email: null,
  prioridad: 'alta',
  vendedoraId: 'centurion:job.meneses',
  distrito: 'Huari · Áncash',
  direccion: 'Jr. Comercio 123, Huari',
  ubicacion: 'Huari, Áncash',
  lat: -9.34,
  lon: -76.85,
  linea: '51963139984',
  favorito: false,
  registrado: true,
  campanaNombre: 'Campaña Áncash 2026',
  aviso: 'Propuesta de Salud Integral',
  creadoAt: '2026-08-22T22:04:00.000Z',
  actualizadoAt: '2026-08-22T22:04:00.000Z',
};

const con = (p: Partial<ContactoRegistrado>): ContactoRegistrado => ({ ...BASE, ...p });

describe('nombreVisible', () => {
  it('junta nombre y apellido', () => {
    expect(nombreVisible(BASE)).toBe('Andrea Quispe');
  });

  /**
   * 🔴 Una ficha se puede registrar con el teléfono solo (`faltaLoMinimo` deja
   * pasar con uno de los dos). «Sin nombre» sobre un número que está ahí al lado
   * esconde el único dato que hay.
   */
  it('sin nombre cae al TELÉFONO, nunca a «Sin nombre»', () => {
    expect(nombreVisible(con({ nombre: null, apellido: null }))).toBe('51943348051');
  });

  it('sin nombre ni teléfono no inventa nada', () => {
    expect(nombreVisible(con({ nombre: null, apellido: null, telefono: null }))).toBe('—');
  });
});

describe('quienRegistro', () => {
  it('le saca el prefijo de Centurión', () => {
    expect(quienRegistro('centurion:job.meneses')).toBe('Job.meneses');
  });

  it('corta el correo de las identidades de Cerberus', () => {
    expect(quienRegistro('ventas10@grupogoberna.com')).toBe('Ventas10');
  });

  it('un id corto se muestra tal cual, capitalizado', () => {
    expect(quienRegistro('luz')).toBe('Luz');
  });

  /**
   * 🔴 **LAS DOS CUENTAS DE LA MISMA PERSONA COLAPSAN AL MISMO RÓTULO, y eso es
   * lo que obliga a `productividad()`.** `Usuario2` (Cerberus) y
   * `centurion:usuario2` (Centurión) son el mismo humano con dos cuentas; el
   * server las cuenta separadas —para él son dos identidades— así que sin
   * agrupar en el front el bloque dibujaba DOS filas que dicen «Usuario2» con
   * números distintos, que se lee como un bug.
   *
   * ⚠️ Este test nació afirmando lo contrario y se puso rojo: el defecto no
   * estaba en el código sino en lo que yo creía del código.
   */
  it('🔴 «Usuario2» y «centurion:usuario2» dan el MISMO rótulo', () => {
    expect(quienRegistro('Usuario2')).toBe(quienRegistro('centurion:usuario2'));
  });

  /**
   * 🔴 **La misma grafía-suelta que la regla dura #4 del repo, acá en el
   * RÓTULO.** `Luz`, `LUZ` y `luz` son la misma persona con tres capitalizaciones
   * distintas de un `vendedora_id` que viene de dos sistemas (Cerberus,
   * Centurión); si esta función no las colapsa, `productividad()` las suma en
   * filas separadas y «Cuántos registró cada uno» se ve mal para esa persona.
   */
  it('🔴 la MISMA persona con distinta capitalización da el MISMO rótulo', () => {
    expect(quienRegistro('LUZ')).toBe(quienRegistro('luz'));
    expect(quienRegistro('LUZ')).toBe('Luz');
  });
});

describe('filtrarContactos', () => {
  const LISTA = [
    BASE,
    con({
      clave: 'b',
      nombre: 'Roberto',
      apellido: 'Bazán',
      distrito: 'Lima',
      vendedoraId: 'centurion:usuario4',
      campanaNombre: 'Lanzamiento Lima',
      aviso: 'Plan Seguridad',
    }),
    con({
      clave: 'c',
      nombre: 'Inketo',
      apellido: null,
      telefono: '51920024566',
      distrito: null,
      vendedoraId: 'centurion:angie',
      campanaNombre: null,
      aviso: null,
    }),
  ];

  it('sin búsqueda devuelve todo', () => {
    expect(filtrarContactos(LISTA, '   ')).toHaveLength(3);
  });

  it('busca por nombre', () => {
    expect(filtrarContactos(LISTA, 'roberto').map((c) => c.clave)).toEqual(['b']);
  });

  it('busca por teléfono', () => {
    expect(filtrarContactos(LISTA, '920024').map((c) => c.clave)).toEqual(['c']);
  });

  it('busca por campaña', () => {
    expect(filtrarContactos(LISTA, 'ancash').map((c) => c.clave)).toEqual([BASE.clave]);
    expect(filtrarContactos(LISTA, 'lima').map((c) => c.clave)).toEqual(['b']);
  });

  it('busca por aviso', () => {
    expect(filtrarContactos(LISTA, 'salud').map((c) => c.clave)).toEqual([BASE.clave]);
    expect(filtrarContactos(LISTA, 'seguridad').map((c) => c.clave)).toEqual(['b']);
  });

  /**
   * 🔴 La pregunta «¿a quiénes registró Job?» es la que hace útil la atribución.
   * Sin esto haría falta un filtro aparte para contestarla.
   */
  it('busca por QUIÉN lo registró, con el nombre que la fila muestra', () => {
    expect(filtrarContactos(LISTA, 'job').map((c) => c.clave)).toEqual([BASE.clave]);
    expect(filtrarContactos(LISTA, 'usuario4').map((c) => c.clave)).toEqual(['b']);
  });

  /** ⚠️ Sin esto el buscador falla justo con los nombres peruanos. */
  it('ignora acentos de los DOS lados', () => {
    expect(filtrarContactos(LISTA, 'ancash').map((c) => c.clave)).toEqual([BASE.clave]);
    expect(filtrarContactos(LISTA, 'áncash').map((c) => c.clave)).toEqual([BASE.clave]);
    expect(filtrarContactos(LISTA, 'bazan').map((c) => c.clave)).toEqual(['b']);
  });

  it('un campo nulo no rompe ni matchea de más', () => {
    expect(filtrarContactos(LISTA, 'inketo').map((c) => c.clave)).toEqual(['c']);
  });
});

describe('helpers de campaña y aviso', () => {
  const CONTACTOS = [
    con({ clave: '1', campanaNombre: 'Campaña Norte', aviso: 'Aviso A' }),
    con({ clave: '2', campanaNombre: 'Campaña Sur', aviso: 'Aviso B' }),
    con({ clave: '3', campanaNombre: 'Campaña Norte', aviso: 'Aviso C' }),
    con({ clave: '4', campanaNombre: null, aviso: null }),
  ];

  it('campanasDe extrae campañas únicas y ordenadas', () => {
    expect(campanasDe(CONTACTOS)).toEqual(['Campaña Norte', 'Campaña Sur']);
  });

  it('avisosDe extrae avisos únicos y permite filtrar por campaña', () => {
    expect(avisosDe(CONTACTOS)).toEqual(['Aviso A', 'Aviso B', 'Aviso C']);
    expect(avisosDe(CONTACTOS, 'Campaña Norte')).toEqual(['Aviso A', 'Aviso C']);
  });
});

describe('puntoDePrioridad', () => {
  it('alta y media se dibujan', () => {
    expect(puntoDePrioridad('alta')?.rotulo).toBe('Alta');
    expect(puntoDePrioridad('media')?.rotulo).toBe('Media');
  });

  /**
   * ⚠️ Un punto en TODAS las filas deja de significar algo. Se marca lo que pide
   * atención, no lo que es normal.
   */
  it('«normal» y ausente NO se dibujan', () => {
    expect(puntoDePrioridad('normal')).toBeNull();
    expect(puntoDePrioridad(null)).toBeNull();
  });

  it('un valor desconocido no inventa un color', () => {
    expect(puntoDePrioridad('urgentísimo')).toBeNull();
  });

  /** **Sin oro**: el dorado significa tiempo que se acaba, y acá no corre plazo. */
  it('ninguna prioridad usa el dorado', () => {
    for (const p of ['alta', 'media', 'normal']) {
      expect(puntoDePrioridad(p)?.clase ?? '').not.toContain('secondary');
    }
  });

  /**
   * 🔴 **EL COLOR TIENE QUE EXISTIR EN LA PALETA, y esto nació de un defecto
   * real.** «Alta» decía `bg-danger`, que NO está en `index.css`: Tailwind emite
   * la clase igual, el punto no se pinta y la fila queda con el rótulo «Alta» y
   * sin marca — mientras «Media» sí se veía. **Lo encontró la captura de
   * evidencia**, porque el test de arriba miraba que el color no fuera el dorado,
   * no que fuera un color.
   *
   * ⚠️ Se lee `index.css` con `import.meta.glob` y no con `node:fs`: pasa en
   * vitest y FALLA en `tsc -p tsconfig.app.json`, que no lleva los tipos de node
   * (la misma cicatriz que `lib/etapas.test.ts`).
   */
  it('🔴 cada color existe en la paleta de index.css', async () => {
    const modulos = import.meta.glob('../../index.css', { query: '?raw', import: 'default', eager: true });
    const css = Object.values(modulos)[0] as string;
    expect(css.length, 'index.css llegó vacío: falta `css.include` en vitest.config.ts').toBeGreaterThan(100);

    for (const p of ['alta', 'media']) {
      const clase = puntoDePrioridad(p)?.clase ?? '';
      const token = clase.replace(/^bg-/, '');
      expect(
        css.includes(`--color-${token}:`),
        `«${p}» usa «${clase}» y «--color-${token}» no está en index.css: Tailwind emite la ` +
          `clase, el punto no se pinta, y la fila queda con el rótulo y sin marca`,
      ).toBe(true);
    }
  });
});

describe('productividad', () => {
  /** El caso que la obliga: dos cuentas, una sola persona. */
  it('🔴 suma las dos cuentas de la misma persona bajo un solo rótulo', () => {
    expect(
      productividad([
        { vendedoraId: 'Usuario2', cuantos: 20 },
        { vendedoraId: 'centurion:usuario2', cuantos: 5 },
      ]),
    ).toEqual([{ nombre: 'Usuario2', cuantos: 25 }]);
  });

  it('ordena de mayor a menor', () => {
    expect(
      productividad([
        { vendedoraId: 'centurion:angie', cuantos: 3 },
        { vendedoraId: 'centurion:job.meneses', cuantos: 14 },
      ]).map((p) => p.nombre),
    ).toEqual(['Job.meneses', 'Angie']);
  });

  /** ⚠️ Empate: alfabético, para que el orden no baile entre dos cargas. */
  it('desempata por nombre', () => {
    expect(
      productividad([
        { vendedoraId: 'centurion:zoe', cuantos: 4 },
        { vendedoraId: 'centurion:ana', cuantos: 4 },
      ]).map((p) => p.nombre),
    ).toEqual(['Ana', 'Zoe']);
  });

  it('sin nadie devuelve vacío, no una fila en cero', () => {
    expect(productividad([])).toEqual([]);
  });

  /** 🔴 Misma persona, tres grafías del `vendedora_id` — tienen que sumar UNA fila. */
  it('🔴 suma las tres grafías de la misma persona bajo un solo rótulo', () => {
    expect(
      productividad([
        { vendedoraId: 'Luz', cuantos: 10 },
        { vendedoraId: 'LUZ', cuantos: 3 },
        { vendedoraId: 'luz', cuantos: 2 },
      ]),
    ).toEqual([{ nombre: 'Luz', cuantos: 15 }]);
  });
});
