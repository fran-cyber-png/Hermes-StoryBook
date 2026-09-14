import { describe, expect, test } from 'vitest';
import {
  cifrasDeColumna,
  COLUMNA_CON_FRANJA,
  COLUMNAS_CON_RECORTE,
  recortesDeColumna,
  resumirColumna,
  tarjetasVisibles,
  totalServidoDe,
  vacioDeColumna,
  type FilaDesglose,
  type ResumenColumna,
} from './tablero';

/**
 * EL RECORTE POR COLUMNA — la política, sin DOM.
 *
 * Lo que se fija acá no es cómo se ve: es **qué se ofrece**. Y el caso que
 * importa no se ve en ninguna captura — el chip activo que se queda sin conteo
 * (porque el recorte vació la columna) y desaparecería, dejando el recorte
 * encendido y a la vendedora sin el botón que lo apaga.
 */

const RESUMEN: ResumenColumna = {
  total: 3051,
  conPrecio: 3051,
  enVentana: 1,
  paraSeguir: 82,
  seCallo: 540,
  verdes: 602,
  ambar: 413,
  grises: 1144,
  rojos: 129,
};
const VACIO: ResumenColumna = {
  total: 0,
  conPrecio: 0,
  enVentana: 0,
  paraSeguir: 0,
  seCallo: 0,
  verdes: 0,
  ambar: 0,
  grises: 0,
  rojos: 0,
};

describe('recortesDeColumna — qué chips se ofrecen', () => {
  test('«Todas» está siempre, y es el primero', () => {
    const r = recortesDeColumna('cotizado', RESUMEN, 'todas');
    expect(r[0].id).toBe('todas');
    expect(r[0].n).toBeNull();
  });

  test('un recorte que daría cero no se ofrece', () => {
    const r = recortesDeColumna('cotizado', { ...RESUMEN, enVentana: 0 }, 'todas');
    expect(r.map((o) => o.id)).not.toContain('ventana');
    expect(r.map((o) => o.id)).toContain('seguir');
  });

  test('🔴 pero el ACTIVO se ofrece aunque dé cero: si no, no hay cómo apagarlo', () => {
    // El caso real: tocas «Para seguir», la columna queda vacía, y el chip que
    // te devolvería a «Todas» desaparecería junto con las tarjetas.
    const r = recortesDeColumna('cotizado', VACIO, 'seguir');
    expect(r.map((o) => o.id)).toContain('seguir');
    expect(r.find((o) => o.id === 'seguir')?.n).toBe(0);
  });

  test('cada chip lleva SU número: sin él, tocarlo es un salto al vacío', () => {
    const r = recortesDeColumna('cotizado', RESUMEN, 'todas');
    expect(r.find((o) => o.id === 'seguir')?.n).toBe(82);
  });

  test('🔴 un recorte que da EL TOTAL tampoco se ofrece: no recorta nada', () => {
    // El defecto que encontró la primera captura: en Cotizados «Con precio 3.051»
    // sobre una columna de 3.051 — toda esa columna tiene precio, es lo que la
    // derivó. Un botón que no cambia lo que se ve es igual de inútil que uno que
    // vacía la columna, y encima partía los chips en dos renglones.
    expect(recortesDeColumna('cotizado', RESUMEN, 'todas').map((o) => o.id)).not.toContain('precio');
    // Y en Contactados, donde SÍ recorta, sigue apareciendo.
    const parcial = {
      total: 1389,
      conPrecio: 611,
      enVentana: 47,
      paraSeguir: 20,
      seCallo: 0,
      verdes: 0,
      ambar: 0,
      grises: 0,
      rojos: 0,
    };
    expect(recortesDeColumna('contactado', parcial, 'todas').map((o) => o.id)).toContain('precio');
  });

  test('pero el activo se ofrece aunque dé el total: es cómo se vuelve a «Todas»', () => {
    expect(recortesDeColumna('cotizado', RESUMEN, 'precio').map((o) => o.id)).toContain('precio');
  });

  test('Cierre y Perdidos no llevan recorte: uno es archivo, el otro es otro frente', () => {
    expect(recortesDeColumna('cierre', RESUMEN, 'todas')).toEqual([]);
    expect(COLUMNAS_CON_RECORTE).toEqual(['interesado', 'sin_respuesta', 'contactado', 'cotizado']);
  });

  /**
   * «Te esperan» heredó el lugar de «Nunca contestaron» cuando esa dejó de ser
   * columna (decisión del dueño del 10-ago): es la única donde la pelota es
   * nuestra, así que es donde más vale poder recortar.
   */
  test('«Te esperan» lleva recorte: es donde la pelota es nuestra', () => {
    const r = recortesDeColumna('interesado', { ...RESUMEN, total: 377, paraSeguir: 88, seCallo: 0 }, 'todas');
    expect(r.map((o) => o.id)).toContain('seguir');
    expect(r.find((o) => o.id === 'seguir')?.n).toBe(88);
  });

  test('todos los chips ofrecidos, salvo «Todas», explican qué recortan', () => {
    for (const o of recortesDeColumna('contactado', RESUMEN, 'todas')) {
      if (o.id === 'todas') continue;
      expect(o.ayuda, `«${o.label}» sin ayuda`).toBeTruthy();
    }
  });
});

describe('cifrasDeColumna — el recorte manda, el total acompaña', () => {
  test('sin recorte hay UNA cifra: el total', () => {
    expect(cifrasDeColumna(RESUMEN, 'todas', 3051, 30)).toEqual({ principal: 3051, de: null });
  });

  test('con recorte, la principal es la recortada y el total viaja al lado', () => {
    expect(cifrasDeColumna(RESUMEN, 'seguir', 82, 30)).toEqual({ principal: 82, de: 3051 });
  });

  test('🔴 si el recorte no achica nada, no se dice «82 de 82»', () => {
    // Repetir el mismo número dos veces no informa: agrega una pregunta.
    expect(cifrasDeColumna({ ...RESUMEN, total: 82 }, 'seguir', 82, 30)).toEqual({
      principal: 82,
      de: null,
    });
  });

  test('sin total del server cuenta lo que hay pintado, nunca un cero inventado', () => {
    expect(cifrasDeColumna(VACIO, 'todas', undefined, 12)).toEqual({ principal: 12, de: null });
  });

  test('un recorte que vació la columna dice 0, y el total sigue diciendo la verdad', () => {
    expect(cifrasDeColumna(RESUMEN, 'ventana', 0, 0)).toEqual({ principal: 0, de: 3051 });
  });
});

describe('vacioDeColumna — el vacío tiene que decir de QUÉ', () => {
  test('sin recorte, el vacío de la etapa', () => {
    expect(vacioDeColumna('todas', 'Cuando le respondas a alguien, aparece acá.')).toBe(
      'Cuando le respondas a alguien, aparece acá.',
    );
  });

  test('🔴 con recorte, el vacío de la ETAPA sería falso: hay tarjetas, no pasan el filtro', () => {
    for (const r of ['precio', 'ventana', 'seguir'] as const) {
      const texto = vacioDeColumna(r, 'Cuando le respondas a alguien, aparece acá.');
      expect(texto).not.toBe('Cuando le respondas a alguien, aparece acá.');
      // Y siempre dice cuál es la salida.
      expect(texto).toContain('Todas');
    }
  });
});

/**
 * LO QUE SE DIBUJA DE LO CARGADO — una sola regla para el Tablero y la Lista.
 * El server todavía no filtra la página por luz (sólo la cuenta), así que la luz
 * se recorta acá; los recortes del server ya vinieron filtrados.
 */
describe('tarjetasVisibles / totalServidoDe', () => {
  const cargadas = [{ clave: 'v', luz: 'verde' as const }, { clave: 'g', luz: 'gris' as const }, { clave: 's' }];

  test('sin recorte de luz se dibuja todo lo cargado', () => {
    expect(tarjetasVisibles(cargadas, 'todas').map((c) => c.clave)).toEqual(['v', 'g', 's']);
    expect(tarjetasVisibles(cargadas, 'seguir').map((c) => c.clave)).toEqual(['v', 'g', 's']);
  });

  test('🔴 con una luz, sólo esa — y una tarjeta sin `luz` cuenta como gris, nunca como verde', () => {
    expect(tarjetasVisibles(cargadas, 'verde').map((c) => c.clave)).toEqual(['v']);
    expect(tarjetasVisibles(cargadas, 'gris').map((c) => c.clave)).toEqual(['g', 's']);
  });

  test('con una luz, el total sale del desglose: el server no recortó nada', () => {
    expect(totalServidoDe(RESUMEN, 'verde', 3051)).toBe(602);
  });

  test('con un recorte del server, el total de la columna ya es el recortado', () => {
    expect(totalServidoDe(RESUMEN, 'seguir', 82)).toBe(82);
    expect(totalServidoDe(RESUMEN, 'todas', 3051)).toBe(3051);
  });
});

/**
 * EL RECORTE DE LA MESA (la cabecera del Pipeline). Con él puesto, las columnas
 * no ofrecen su chip «Todas» —un eje por vez—, así que el vacío que manda a
 * tocarlo mandaría a un botón que no está en la pantalla.
 */
describe('vacioDeColumna — con el recorte puesto desde la cabecera', () => {
  test('🔴 no manda a un «Todas» que la columna no muestra: manda arriba', () => {
    for (const r of ['verde', 'ambar', 'gris', 'rojo'] as const) {
      const texto = vacioDeColumna(r, 'Cuando alguien te conteste, aparece acá.', 'mesa');
      expect(texto, `«${r}»`).not.toContain('Todas');
      expect(texto, `«${r}»`).toMatch(/arriba/);
    }
  });

  test('sin el recorte de la mesa, el vacío de siempre sigue diciendo «Todas»', () => {
    expect(vacioDeColumna('verde', 'otro texto', 'columna')).toContain('Todas');
  });
});

/**
 * EL RANGO GLOBAL Y LOS RECORTES DEL DÍA. Con un rango puesto los chips de columna
 * no se ofrecen, así que el vacío tiene que mandar al rango; y un recorte del día
 * dice de QUÉ está vacía la columna, como todos los demás.
 */
describe('vacioDeColumna — el rango global y los recortes del día', () => {
  test('🔴 con un rango puesto (Hoy · 7 d), el vacío manda al rango, no a un «Todas» escondido', () => {
    const texto = vacioDeColumna('todas', 'Cuando alguien te conteste, aparece acá.', 'rango');
    expect(texto).not.toContain('Todas');
    expect(texto).not.toBe('Cuando alguien te conteste, aparece acá.');
    expect(texto).toMatch(/30 d/);
  });

  test('los recortes del día dicen de qué está vacía la columna, y mandan arriba', () => {
    expect(vacioDeColumna('escribioHoy', 'x', 'mesa')).toMatch(/primera vez hoy/);
    expect(vacioDeColumna('sinRespuesta24h', 'x', 'mesa')).toMatch(/24 h/);
    for (const r of ['escribioHoy', 'sinRespuesta24h'] as const) {
      expect(vacioDeColumna(r, 'x', 'mesa'), r).toMatch(/arriba/);
    }
  });

  /**
   * «Nunca contestaron» es «le escribimos y nunca escribió» (`etapaEfectivaSql`), y
   * los dos recortes del día piden a alguien que SÍ escribió: ahí dan 0 por
   * definición. «Ninguna lleva más de 24 h sin respuesta» se leía como un dato del
   * día (revisión cruzada de #956).
   */
  test('🔴 en «Nunca contestaron» un recorte del día da 0 por definición, y el vacío lo dice en vez de sonar a dato', () => {
    for (const r of ['escribioHoy', 'sinRespuesta24h'] as const) {
      const texto = vacioDeColumna(r, 'x', 'mesa', 'sin_respuesta');
      expect(texto, r).toMatch(/nadie escribió/);
      expect(texto, r).toMatch(/arriba/);
    }
    expect(vacioDeColumna('sinRespuesta24h', 'x', 'mesa', 'cotizado')).toMatch(/Ninguna lleva más de 24 h/);
  });
});

describe('resumirColumna — la dimensión nueva del desglose', () => {
  const fila = (p: Partial<FilaDesglose>): FilaDesglose => ({
    etapa: 'cotizado',
    yaLeHablamos: true,
    precio: true,
    viva: false,
    n: 1,
    ...p,
  });

  test('suma `paraSeguir` de las filas de SU etapa', () => {
    const d = [
      fila({ paraSeguir: true, n: 10 }),
      fila({ paraSeguir: false, n: 90 }),
      fila({ etapa: 'contactado', paraSeguir: true, n: 5 }),
    ];
    expect(resumirColumna(d, 'cotizado').paraSeguir).toBe(10);
    expect(resumirColumna(d, 'cotizado').total).toBe(100);
    expect(resumirColumna(d, 'contactado').paraSeguir).toBe(5);
  });

  test('🔴 un server viejo (sin el campo) da cero, y el chip se esconde solo', () => {
    // Es la misma decisión que `ventana`: mejor no ofrecer el recorte que
    // ofrecerlo y que el server no sepa aplicarlo. N4 va solo, N5 es un botón.
    const d = [fila({ n: 40 })];
    expect(resumirColumna(d, 'cotizado').paraSeguir).toBe(0);
    expect(recortesDeColumna('cotizado', resumirColumna(d, 'cotizado'), 'todas').map((o) => o.id))
      .not.toContain('seguir');
  });

  test('sin desglose cae a los conteos de siempre y no inventa recortes', () => {
    const r = resumirColumna(undefined, 'cotizado', { cotizado: 3051 });
    expect(r).toEqual({
      total: 3051,
      conPrecio: 0,
      enVentana: 0,
      paraSeguir: 0,
      seCallo: 0,
      verdes: 0,
      ambar: 0,
      grises: 0,
      rojos: 0,
    });
  });
});

describe('«Se callaron» — el recorte que el estándar de pipeline pedía', () => {
  test('lleva su número y se ofrece en Cotizados', () => {
    const r = recortesDeColumna('cotizado', RESUMEN, 'todas');
    expect(r.find((o) => o.id === 'seCallo')?.n).toBe(540);
  });

  test('🔴 no se ofrece donde el conteo da cero, aunque la columna sea enorme', () => {
    // El server ya lo garantiza (`seCalloConElPrecio` exige `hablo` y un precio),
    // así que el conteo da 0 y la regla del cero lo esconde. El test fija que la
    // relación entre las dos reglas se mantenga.
    const r = recortesDeColumna('interesado', { ...VACIO, total: 2580 }, 'todas');
    expect(r.map((o) => o.id)).not.toContain('seCallo');
  });

  test('el vacío nombra el recorte y señala la salida', () => {
    expect(vacioDeColumna('seCallo', 'otro texto')).toContain('Todas');
    expect(vacioDeColumna('seCallo', 'otro texto')).not.toBe('otro texto');
  });
});

/**
 * LA FRANJA DE TIEMPO — la misma política de dos cifras, por otro eje.
 *
 * Con una franja puesta el recorte es «todas» (son excluyentes: `VistaEmbudo`),
 * así que sin decírselo a `cifrasDeColumna` el número grande saldría del desglose
 * —que no sabe de franjas— y la cabecera diría 4.491 encima de una lista de doce.
 */
describe('la franja de «Nunca contestaron»', () => {
  const NUNCA: ResumenColumna = {
    total: 4491,
    conPrecio: 2497,
    enVentana: 0,
    paraSeguir: 1349,
    seCallo: 0,
    verdes: 0,
    ambar: 0,
    grises: 4491,
    rojos: 0,
  };

  test('la ofrece «Nunca contestaron», que es donde el tiempo es TODO el criterio', () => {
    expect(COLUMNA_CON_FRANJA).toBe('sin_respuesta');
  });

  test('🔴 con franja se leen las DOS cifras, aunque el recorte esté en «todas»', () => {
    // 12 tarjetas de la última hora, sobre las 4.491 de la columna entera.
    expect(cifrasDeColumna(NUNCA, 'todas', 12, 12, true)).toEqual({ principal: 12, de: 4491 });
    // Sin franja, «todas» sigue siendo una sola cifra: el universo.
    expect(cifrasDeColumna(NUNCA, 'todas', 4491, 30, false)).toEqual({ principal: 4491, de: null });
  });

  test('una franja que no achica nada no repite el número dos veces', () => {
    expect(cifrasDeColumna(NUNCA, 'todas', 4491, 30, true)).toEqual({ principal: 4491, de: null });
  });

  test('🔴 la columna vacía POR la franja no dice el vacío de la etapa', () => {
    const conFranja = vacioDeColumna('todas', 'Acá caen las que abriste tú', 'franja');
    expect(conFranja).toMatch(/franja/i);
    expect(conFranja).not.toMatch(/Acá caen/);
    // Y sin franja, el vacío de la etapa sigue intacto.
    expect(vacioDeColumna('todas', 'Acá caen las que abriste tú', 'columna')).toBe('Acá caen las que abriste tú');
  });
});
