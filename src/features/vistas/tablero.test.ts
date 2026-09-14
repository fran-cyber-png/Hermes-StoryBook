import { describe, expect, test } from 'vitest';
import { ETAPA_ROTULO } from '../../lib/etapas';
import {
  ANCHO_COLUMNA_COLAPSADA,
  ANCHO_MIN_COLUMNA,
  COLUMNAS_TRABAJO,
  columnasDe,
  contarHoy,
  etapaDeTarjeta,
  plantillaColumnas,
  quedanPorTraer,
  repartirColumnas,
  resumirBandeja,
  resumirColumna,
  type EtapaTrabajo,
  type FilaDesglose,
} from './tablero';

/**
 * EL TABLERO HONESTO (#90) — la lógica pura, sin DOM.
 *
 * Qué columna pide qué `?etapa=`, dónde cae cada tarjeta con los movimientos
 * optimistas en el medio, y cuántas faltan por traer. VistaEmbudo solo ejecuta;
 * la política se fija acá (mismo patrón que `compuertas.ts`).
 */

const tarjeta = (clave: string, etapa?: string) => ({ clave, etapa_efectiva: etapa });

describe('las columnas de trabajo', () => {
  test('cada columna pide SU etapa efectiva, y son las seis que se trabajan', () => {
    expect(COLUMNAS_TRABAJO.map((c) => c.id)).toEqual([
      // «Te esperan» va PRIMERA desde el 10-ago-2026 (decisión del dueño, que
      // revierte #87): es la única columna donde la pelota es NUESTRA.
      'interesado',
      // 🔴 «Nunca contestaron» se sacó el 10-ago y VOLVIÓ el 11 (ADR 0052).
      'sin_respuesta',
      'contactado',
      'cotizado',
      'cierre',
      ]);
  });

  /**
   * 🔴 EL TEST QUE CAMBIÓ DE SIGNO EN UN DÍA, y por eso lleva el porqué escrito.
   *
   * El 10-ago se sacó «Nunca contestaron» del tablero: eran 2.575 tarjetas —el
   * 65 % de la mesa— que nadie trabajaba en conjunto. El argumento era cierto y
   * la consecuencia no se vio: **cada una de esas tarjetas fue, en su momento,
   * alguien a quien una vendedora le acababa de escribir.** Sacarla hizo que el
   * trabajo del día se esfumara — mandas la info, el lead todavía no contesta, y
   * la tarjeta desaparece. Lo reportó Luz al día siguiente.
   *
   * La lección: **una columna grande y fría no es una columna inútil.** El
   * tamaño medía el pasado acumulado; lo que se rompió fue el presente.
   */
  test('🔴 «nunca contestaron» SÍ es columna: sin ella se esfuma el trabajo del día', () => {
    expect(COLUMNAS_TRABAJO.map((c) => c.id)).toContain('sin_respuesta');
  });

  test('una tarjeta «sin respuesta» se pinta en su columna', () => {
    const repartidas = repartirColumnas([['sin_respuesta', [tarjeta('a', 'sin_respuesta')]]], {});
    expect(repartidas.get('sin_respuesta')?.map((c) => c.clave)).toEqual(['a']);
  });

  test('🔴 «sin respuesta» NO está en la lista de etapas declarables', async () => {
    // Se deriva de un hecho y deja de ser cierta sola. Si entrara a ETAPAS,
    // el embudo del Dashboard y el recibo de venta la enumerarían como un
    // peldaño más — y ahí sería un segmento clavado en cero.
    const { ETAPAS } = await import('../../lib/etapas');
    expect(ETAPAS).not.toContain('sin_respuesta');
  });
});

describe('repartirColumnas — dónde cae cada tarjeta', () => {
  const cargadas: [EtapaTrabajo, ReturnType<typeof tarjeta>[]][] = [
    ['contactado', [tarjeta('a', 'contactado'), tarjeta('b', 'contactado')]],
    ['cotizado', [tarjeta('c', 'cotizado')]],
    ['cierre', []],
    ['cierre', [tarjeta('d', 'cierre')]],
  ];

  test('sin movimientos, cada tarjeta queda en la columna que la trajo', () => {
    const mapa = repartirColumnas(cargadas, {});
    expect(mapa.get('contactado')!.map((t) => t.clave)).toEqual(['a', 'b']);
    expect(mapa.get('cotizado')!.map((t) => t.clave)).toEqual(['c']);
    expect(mapa.get('cierre')!.map((t) => t.clave)).toEqual(['d']);
  });

  test('un movimiento optimista muda la tarjeta: sale de la columna vieja y entra ARRIBA de la nueva', () => {
    const mapa = repartirColumnas(cargadas, { b: 'cotizado' });
    expect(mapa.get('contactado')!.map((t) => t.clave)).toEqual(['a']);
    expect(mapa.get('cotizado')!.map((t) => t.clave)).toEqual(['b', 'c']);
  });

  test('mientras las columnas se refrescan, una tarjeta duplicada se pinta UNA vez', () => {
    // Tras mover y refetchear, el destino ya la trae pero el origen todavía no
    // la soltó: manda la etapa efectiva de la propia tarjeta, no la columna vieja.
    const enTransicion: [EtapaTrabajo, ReturnType<typeof tarjeta>[]][] = [
      ['contactado', [tarjeta('x', 'cotizado')]],
      ['cotizado', [tarjeta('x', 'cotizado')]],
      ['cierre', []],
      ['cierre', []],
    ];
    const mapa = repartirColumnas(enTransicion, {});
    expect(mapa.get('cotizado')!.map((t) => t.clave)).toEqual(['x']);
    expect(mapa.get('contactado')).toEqual([]);
  });

  test('una tarjeta cuya etapa quedó fuera del tablero (interesado) no se pinta en ninguna columna', () => {
    const conVieja: [EtapaTrabajo, ReturnType<typeof tarjeta>[]][] = [
      ['contactado', [tarjeta('y', 'interesado')]],
      ['cotizado', []],
      ['cierre', []],
      ['cierre', []],
    ];
    const mapa = repartirColumnas(conVieja, {});
    expect(mapa.get('contactado')).toEqual([]);
  });
});

/**
 * ══ EL TABLERO QUE REPARTE ES EL QUE PIDIÓ LAS COLUMNAS ═════════════════════
 *
 * 🔴 **Lo encontró la galería el día que se sembró «Simpatizan 181» (#785).**
 * `repartirColumnas` armaba sus mapas con `COLUMNAS_TRABAJO` —las de VENTAS— en
 * los tres lugares, así que en el tablero de campaña toda tarjeta con etapa
 * `simpatiza`, `comprometido` o `voluntario` se caía al piso: la columna salía
 * vacía **con su total en la cabecera y un «Ver más · faltan 177» debajo**.
 *
 * Nunca se vio porque esas tres columnas están en cero desde que existen. Estaba
 * esperando al primer dato — y el primer dato lo trae la escucha (ADR 0095).
 */
describe('repartirColumnas en el tablero de CAMPAÑA', () => {
  const campana = (cargadas: Array<readonly [EtapaTrabajo, ReturnType<typeof tarjeta>[]]>) =>
    repartirColumnas(cargadas, {});

  test('🔴 una tarjeta de «Simpatizan» cae en «Simpatizan», no al piso', () => {
    const mapa = campana([
      ['interesado', [tarjeta('a', 'interesado')]],
      ['contactado', []],
      ['simpatiza', [tarjeta('b', 'simpatiza')]],
      ['comprometido', []],
      ['voluntario', []],
    ]);
    expect(mapa.get('simpatiza')?.map((c) => c.clave)).toEqual(['b']);
  });

  test('🔴 y los otros dos peldaños también, que se caían por lo mismo', () => {
    const mapa = campana([
      ['interesado', []],
      ['contactado', []],
      ['simpatiza', []],
      ['comprometido', [tarjeta('c', 'comprometido')]],
      ['voluntario', [tarjeta('v', 'voluntario')]],
    ]);
    expect(mapa.get('comprometido')?.map((x) => x.clave)).toEqual(['c']);
    expect(mapa.get('voluntario')?.map((x) => x.clave)).toEqual(['v']);
  });

  /**
   * El mapa tiene UNA entrada por columna pedida y ninguna de más: si trajera
   * las de ventas, la vista pediría `repartidas.get('cotizado')` en un tablero
   * que no dibuja Cotizados y el bug volvería por la puerta de al lado.
   */
  test('el mapa tiene exactamente las columnas que se pidieron', () => {
    const mapa = campana([
      ['interesado', []],
      ['contactado', []],
      ['simpatiza', []],
      ['comprometido', []],
      ['voluntario', []],
    ]);
    expect([...mapa.keys()]).toEqual([
      'interesado',
      'contactado',
      'simpatiza',
      'comprometido',
      'voluntario',
    ]);
    expect(mapa.has('cotizado' as EtapaTrabajo)).toBe(false);
  });

  /**
   * Y una etapa que ESTE tablero no dibuja sigue cayéndose, que es lo correcto:
   * `cotizado` deriva de un precio y en campaña no existe. Antes se caía por el
   * motivo equivocado —no estaba en la lista de ventas— y ahora por el bueno.
   */
  test('una etapa que este tablero no dibuja se sigue descartando', () => {
    const mapa = campana([
      ['interesado', [tarjeta('x', 'cotizado')]],
      ['contactado', []],
      ['simpatiza', []],
      ['comprometido', []],
      ['voluntario', []],
    ]);
    expect([...mapa.values()].flat()).toEqual([]);
  });
});

describe('etapaDeTarjeta — de dónde sale la etapa actual para las compuertas', () => {
  test('sin movimiento en vuelo, la manda el server (etapa_efectiva)', () => {
    expect(etapaDeTarjeta(tarjeta('a', 'cotizado'), {})).toBe('cotizado');
  });

  test('con movimiento optimista en vuelo, manda el movimiento', () => {
    expect(etapaDeTarjeta(tarjeta('a', 'contactado'), { a: 'cotizado' })).toBe('cotizado');
  });

  test('sin dato del server no se inventa nada: null, jamás el fallback interesado', () => {
    expect(etapaDeTarjeta({ clave: 'a' }, {})).toBeNull();
  });
});

describe('resumirBandeja — la bandeja deja de ser un número gris', () => {
  // La foto real de producción (2026-07-25), a escala: la bandeja son 476 y NO
  // son todas «gente que levantó la mano y nadie contestó».
  const desglose: FilaDesglose[] = [
    { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: true, n: 40 },
    { etapa: 'interesado', yaLeHablamos: false, precio: false, viva: false, n: 218 },
    { etapa: 'interesado', yaLeHablamos: true, precio: false, viva: true, n: 41 },
    { etapa: 'interesado', yaLeHablamos: true, precio: true, viva: false, n: 177 },
    { etapa: 'contactado', yaLeHablamos: true, precio: true, viva: false, n: 611 },
  ];

  test('el total de la bandeja son los interesados, y nada más', () => {
    expect(resumirBandeja(desglose).total).toBe(476);
  });

  test('separa a quien nunca contestamos de quien nos volvió a escribir', () => {
    const r = resumirBandeja(desglose);
    expect(r.nuevas).toBe(258);
    expect(r.retomadas).toBe(218);
  });

  test('las que están escribiendo AHORA: el número que decide el día', () => {
    expect(resumirBandeja(desglose).vivas).toBe(81);
  });

  test('sin desglose todavía, ceros — nunca un número inventado', () => {
    expect(resumirBandeja(undefined)).toEqual({
      total: 0,
      nuevas: 0,
      retomadas: 0,
      vivas: 0,
      hayDetalle: false,
    });
  });

  test('el front va adelante del server (N4 antes que N5): cuenta con los conteos y CALLA el detalle', () => {
    const r = resumirBandeja(undefined, { interesado: 476, contactado: 1389 });
    expect(r.total).toBe(476);
    expect(r.hayDetalle).toBe(false);
  });
});

describe('resumirColumna — el tamaño real de la columna y el de su recorte', () => {
  const desglose: FilaDesglose[] = [
    { etapa: 'contactado', yaLeHablamos: true, precio: true, viva: false, ventana: true, n: 12 },
    { etapa: 'contactado', yaLeHablamos: true, precio: true, viva: false, ventana: false, n: 599 },
    { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, ventana: true, n: 35 },
    { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, ventana: false, n: 743 },
    { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, ventana: false, n: 3 },
  ];

  test('el total y cuántas ya tienen precio encima', () => {
    expect(resumirColumna(desglose, 'contactado')).toEqual({
      total: 1389,
      conPrecio: 611,
      enVentana: 47,
      paraSeguir: 0,
      seCallo: 0,
      verdes: 0,
      ambar: 0,
      grises: 0,
      rojos: 0,
    });
  });

  /**
   * LOS DOS RECORTES SE CRUZAN, y por eso se cuentan por separado: de las 611
   * con precio, solo 12 están en ventana. Si `enVentana` se derivara de
   * `conPrecio` —o al revés— el chip prometería una lista que no es.
   */
  test('precio y ventana son dimensiones independientes: se cuentan aparte', () => {
    const r = resumirColumna(desglose, 'contactado');
    expect(r.conPrecio).toBe(611);
    expect(r.enVentana).toBe(47); // 12 con precio + 35 sin precio
    expect(r.enVentana).not.toBe(12);
  });

  /**
   * Un server viejo no manda `ventana` en el desglose. Ahí el chip tiene que dar
   * CERO y esconderse, no ofrecer un recorte que el server no sabe aplicar —
   * tocarlo devolvería la columna entera y se leería como que el filtro no anda.
   */
  test('sin el campo `ventana` (server viejo) el recorte cuenta cero y no se ofrece', () => {
    const viejo: FilaDesglose[] = [
      { etapa: 'contactado', yaLeHablamos: true, precio: true, viva: false, n: 611 },
      { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, n: 778 },
    ];
    expect(resumirColumna(viejo, 'contactado')).toEqual({
      total: 1389,
      conPrecio: 611,
      enVentana: 0,
      paraSeguir: 0,
      seCallo: 0,
      verdes: 0,
      ambar: 0,
      grises: 0,
      rojos: 0,
    });
  });

  test('una columna sin filas cuenta cero, no undefined', () => {
    expect(resumirColumna(desglose, 'cierre')).toEqual({
      total: 0,
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

  test('sin desglose (server viejo) el total sale de los conteos y el recorte no se ofrece', () => {
    expect(resumirColumna(undefined, 'contactado', { contactado: 1389 })).toEqual({
      enVentana: 0,
      total: 1389,
      conPrecio: 0,
      paraSeguir: 0,
      seCallo: 0,
      verdes: 0,
      ambar: 0,
      grises: 0,
      rojos: 0,
    });
  });
});

/**
 * «N HOY» EN CADA COLUMNA — el HOY del dueño (10-sep-2026), columna por columna.
 * Suma la fila de arriba y cada columna con la MISMA función: si «nuevas hoy»
 * de arriba no cerrara con la suma de las columnas, sería un bug.
 */
describe('contarHoy — cuántas nacieron hoy', () => {
  const d: FilaDesglose[] = [
    { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, nacioHoy: true, n: 4 },
    { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, nacioHoy: false, n: 90 },
    { etapa: 'contactado', yaLeHablamos: true, precio: false, viva: false, nacioHoy: true, n: 2 },
  ];

  test('suma sólo las etapas que se le piden', () => {
    expect(contarHoy(d, ['cotizado'])).toBe(4);
    expect(contarHoy(d, ['cotizado', 'contactado'])).toBe(6);
    expect(contarHoy(d, ['cierre'])).toBe(0);
  });

  test('🔴 sin el campo (server viejo) es null, no cero — y sin desglose también', () => {
    const viejo: FilaDesglose[] = [{ etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, n: 5 }];
    expect(contarHoy(viejo, ['cotizado'])).toBeNull();
    expect(contarHoy(undefined, ['cotizado'])).toBeNull();
  });

  /**
   * El «N hoy» de una columna describe la lista que se VE. Con «Verdes» puesto,
   * «98 hoy» encima de «73 de 1.109» contaba gente que la columna no muestra
   * (lo encontró la revisión de spec). El desglose trae la luz y las marcas de
   * los recortes en la misma fila, así que el cruce sale de la misma foto.
   */
  test('🔴 con un recorte puesto cuenta sólo las de ese recorte', () => {
    const conMarcas: FilaDesglose[] = [
      { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, luz: 'verde', paraSeguir: false, nacioHoy: true, n: 3 },
      { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, luz: 'ambar', paraSeguir: true, nacioHoy: true, n: 5 },
      { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, luz: 'ambar', paraSeguir: true, nacioHoy: false, n: 50 },
    ];
    expect(contarHoy(conMarcas, ['cotizado'])).toBe(8);
    expect(contarHoy(conMarcas, ['cotizado'], 'todas')).toBe(8);
    expect(contarHoy(conMarcas, ['cotizado'], 'verde')).toBe(3);
    expect(contarHoy(conMarcas, ['cotizado'], 'seguir')).toBe(5);
    expect(contarHoy(conMarcas, ['cotizado'], 'rojo')).toBe(0);
  });

  test('🔴 un recorte que el desglose no sabe cruzar (escribió hoy, sin respuesta 24 h) calla: null, no un número inventado', () => {
    const conMarcas: FilaDesglose[] = [
      { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, nacioHoy: true, n: 3 },
      { etapa: 'cotizado', yaLeHablamos: true, precio: true, viva: false, nacioHoy: false, n: 9 },
    ];
    expect(contarHoy(conMarcas, ['cotizado'], 'escribioHoy')).toBeNull();
    expect(contarHoy(conMarcas, ['cotizado'], 'sinRespuesta24h')).toBeNull();
  });
});

describe('quedanPorTraer — el «Ver más» honesto por columna', () => {
  test('lo que falta = total real de la columna menos lo cargado', () => {
    expect(quedanPorTraer(1129, 30)).toBe(1099);
  });

  test('nunca negativo (el total puede quedar viejo entre refetches)', () => {
    expect(quedanPorTraer(3, 5)).toBe(0);
  });

  test('sin total todavía, no se promete nada', () => {
    expect(quedanPorTraer(undefined, 30)).toBe(0);
  });
});

/**
 * EL TABLERO DE CAMPAÑA (ADR 0063).
 *
 * 🔴 **El primer test es el que sostiene `VistaEmbudo` entero.** Esa vista llama
 * a `useConversaciones` CINCO veces con nombre fijo, porque React prohíbe que la
 * cantidad de hooks varíe entre renders. Un sexto elemento en cualquiera de los
 * dos juegos rompe la app con el error opaco de React —«rendered more hooks than
 * during the previous render»— justo al cambiar de módulo, o sea en la máquina
 * de otra persona. Acá se rompe primero, y con un mensaje que se entiende.
 */
describe('las columnas de campaña', () => {
  test('🔴 los dos tableros tienen EXACTAMENTE cinco columnas — los hooks son fijos', () => {
    expect(columnasDe('ventas')).toHaveLength(5);
    expect(columnasDe('campana')).toHaveLength(5);
  });

  test('comparten el arranque y difieren en la escalera', () => {
    expect(columnasDe('campana').map((c) => c.id)).toEqual([
      'interesado',
      'contactado',
      'simpatiza',
      'comprometido',
      'voluntario',
    ]);
  });

  /**
   * ⚠️ La etapa SIGUE EXISTIENDO: se deriva, se ve en Mensajes y se puede pedir
   * con `?etapa=sin_respuesta`. Lo que no tiene en campaña es columna, porque
   * seis no entran a 1280 y había que elegir cuál se cae. El porqué de que sea
   * ésta y no un peldaño está en `tablero.ts`.
   */
  test('«Nunca contestaron» no es columna en campaña, y sí en ventas', () => {
    expect(columnasDe('campana').map((c) => c.id)).not.toContain('sin_respuesta');
    expect(columnasDe('ventas').map((c) => c.id)).toContain('sin_respuesta');
  });

  test('🔴 ninguna columna de campaña deriva de plata', () => {
    // `cotizado` sale de un precio en el hilo y `cierre` de una venta en
    // Cerberus: los dos son hechos del módulo de ventas, y el server ni siquiera
    // los deriva para campaña (`etapaDerivada`). Una columna acá estaría siempre
    // vacía y nadie sabría por qué.
    const ids = columnasDe('campana').map((c) => c.id);
    expect(ids).not.toContain('cotizado');
    expect(ids).not.toContain('cierre');
  });

  test('cada columna dice cómo se llena cuando está vacía', () => {
    for (const col of columnasDe('campana')) {
      expect(col.vacio.length, `«${col.id}» sin texto de vacío`).toBeGreaterThan(10);
      expect(col.pista.length, `«${col.id}» sin pista`).toBeGreaterThan(10);
    }
  });
});

/**
 * EL ORDEN DE LA COLUMNA EN CAMPAÑA (pedido del dueño, 13-sep-2026): «en verde no
 * debe estar encima de los naranjas; se respeta el tiempo, el color no reordena».
 * El server ya manda cada columna ordenada por tiempo; en campaña se deja así.
 */
describe('repartirColumnas — el orden por luz es de ventas', () => {
  const delServer: [EtapaTrabajo, { clave: string; etapa_efectiva: string; luz: 'gris' | 'verde'; respondida: boolean }[]][] = [
    [
      'contactado',
      [
        { clave: 'reciente-gris', etapa_efectiva: 'contactado', luz: 'gris', respondida: false },
        { clave: 'vieja-verde', etapa_efectiva: 'contactado', luz: 'verde', respondida: false },
      ],
    ],
  ];

  test('🔴 sin orden por luz, la columna queda en el orden del server: el tiempo', () => {
    const mapa = repartirColumnas(delServer, {}, { ordenarPorLuz: false });
    expect(mapa.get('contactado')!.map((t) => t.clave)).toEqual(['reciente-gris', 'vieja-verde']);
  });

  test('ventas sigue igual: el verde sube', () => {
    expect(repartirColumnas(delServer, {}).get('contactado')!.map((t) => t.clave)).toEqual(['vieja-verde', 'reciente-gris']);
  });

  test('lo que se acaba de arrastrar sigue entrando arriba, con o sin orden por luz', () => {
    const conMovida = repartirColumnas(
      [...delServer, ['simpatiza', [{ clave: 'movida', etapa_efectiva: 'simpatiza', luz: 'gris', respondida: true }]]],
      { movida: 'contactado' },
      { ordenarPorLuz: false },
    );
    expect(conMovida.get('contactado')!.map((t) => t.clave)).toEqual(['movida', 'reciente-gris', 'vieja-verde']);
  });
});

/**
 * «RESPONDIDOS» (pedido del dueño, 13-sep-2026): en campaña la columna de
 * `contactado` se llama por lo que hizo quien atiende. El rótulo canónico de la
 * etapa no cambia —la ficha y ventas lo siguen leyendo—; lo que cambia es el título
 * de ESA columna en ESE tablero.
 */
describe('los títulos de las columnas de campaña', () => {
  test('🔴 en campaña «Contestaron» se llama «Respondidos», y en ventas no cambia', () => {
    const campana = columnasDe('campana').find((c) => c.id === 'contactado');
    expect(campana?.titulo).toBe('Respondidos');
    expect(campana?.pista).toMatch(/respondiste/);
    expect(columnasDe('ventas').find((c) => c.id === 'contactado')?.titulo).toBe(ETAPA_ROTULO.contactado.varios);
  });

  test('🔴 ningún título de campaña repite el de otra etapa: dos columnas con el mismo nombre no se distinguen', () => {
    const titulos = columnasDe('campana').map((c) => c.titulo.toLowerCase());
    expect(new Set(titulos).size).toBe(titulos.length);
    for (const col of columnasDe('campana')) {
      const ajenos = Object.entries(ETAPA_ROTULO)
        .filter(([etapa]) => etapa !== col.id)
        .map(([, r]) => r.varios.toLowerCase());
      expect(ajenos, `«${col.titulo}» es el nombre de otra etapa`).not.toContain(col.titulo.toLowerCase());
    }
  });
});

describe('la plantilla de anchos (ADR 0089)', () => {
  const columnas = COLUMNAS_TRABAJO.map((c) => ({ id: c.id }));

  test('sin nada colapsado, todas piden el mismo minmax', () => {
    const esperado = COLUMNAS_TRABAJO.map(
      () => `minmax(${ANCHO_MIN_COLUMNA}px,1fr)`,
    ).join(' ');
    expect(plantillaColumnas(columnas, new Set())).toBe(esperado);
  });

  test('una columna colapsada pasa a la franja fija, y las demás siguen a 1fr', () => {
    const plantilla = plantillaColumnas(columnas, new Set(['cotizado']));
    const tramos = plantilla.split(' ');
    const indiceCotizado = COLUMNAS_TRABAJO.findIndex((c) => c.id === 'cotizado');
    expect(tramos).toHaveLength(COLUMNAS_TRABAJO.length);
    expect(tramos[indiceCotizado]).toBe(`${ANCHO_COLUMNA_COLAPSADA}px`);
    tramos.forEach((tramo, i) => {
      if (i !== indiceCotizado) expect(tramo).toBe(`minmax(${ANCHO_MIN_COLUMNA}px,1fr)`);
    });
  });

  test('el orden de las columnas se respeta, con varias colapsadas a la vez', () => {
    const plantilla = plantillaColumnas(columnas, new Set(['interesado', 'cierre']));
    expect(plantilla.startsWith(`${ANCHO_COLUMNA_COLAPSADA}px`)).toBe(true);
    expect(plantilla.endsWith(`${ANCHO_COLUMNA_COLAPSADA}px`)).toBe(true);
  });
});
