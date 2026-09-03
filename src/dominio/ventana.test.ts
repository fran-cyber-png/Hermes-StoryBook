import { describe, it, expect } from 'vitest';
import { avisoDeComposer, cuantoFalta, lecturaDeVentana, UMBRAL_AMARILLO_MS, UMBRAL_ORO_MS, UMBRAL_VERDE_MS, ayudaDeAntiguedad, plazoDuro } from './ventana';

const AHORA = new Date('2026-08-07T15:00:00Z');
const en = (ms: number) => new Date(AHORA.getTime() + ms).toISOString();
const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

describe('cuantoFalta', () => {
  it('elige la unidad que se lee de un vistazo', () => {
    expect(cuantoFalta(3 * DIA)).toBe('3 d');
    expect(cuantoFalta(6 * HORA)).toBe('6 h');
    expect(cuantoFalta(45 * MINUTO)).toBe('45 min');
  });

  it('REDONDEA PARA ABAJO: prometer tiempo que no hay es el error que llega tarde', () => {
    expect(cuantoFalta(6 * HORA + 50 * MINUTO)).toBe('6 h');
    expect(cuantoFalta(2 * DIA + 23 * HORA)).toBe('2 d');
  });

  it('nunca dice «0 min»: el último minuto sigue siendo un minuto', () => {
    expect(cuantoFalta(30 * 1000)).toBe('1 min');
    expect(cuantoFalta(1)).toBe('1 min');
  });
});

describe('lecturaDeVentana', () => {
  it('con la ventana abierta dice cuánto falta', () => {
    expect(lecturaDeVentana(en(6 * HORA), AHORA)?.texto).toBe('6 h');
    expect(lecturaDeVentana(en(3 * DIA), AHORA)?.texto).toBe('3 d');
  });

  /**
   * LA DECISIÓN QUE NO SE NEGOCIA. El plazo es duro solo en la línea de la Cloud
   * API; en las tres whatsmeow Meta no rechaza nada. Una píldora que dijera
   * «cerrada» sería falsa en tres de cuatro líneas.
   */
  it('una ventana CERRADA no dibuja nada: se dice a quién sí, nunca a quién no', () => {
    expect(lecturaDeVentana(en(-HORA), AHORA)).toBe(null);
    expect(lecturaDeVentana(en(-30 * DIA), AHORA)).toBe(null);
    expect(lecturaDeVentana(en(0), AHORA)).toBe(null);
  });

  it('sin ventana no dibuja nada, y un server viejo tampoco', () => {
    expect(lecturaDeVentana(null, AHORA)).toBe(null);
    expect(lecturaDeVentana(undefined, AHORA)).toBe(null);
  });

  it('una fecha ilegible no inventa una cuenta regresiva', () => {
    expect(lecturaDeVentana('mañana a la tarde', AHORA)).toBe(null);
    expect(lecturaDeVentana('', AHORA)).toBe(null);
  });

  it('la escala de tres colores: verde 24h→12h · amarillo 11h→6h · rojo 5h→1min', () => {
    // Verde: 24 h hasta 12 h inclusive.
    expect(lecturaDeVentana(en(24 * HORA - MINUTO), AHORA)?.color).toBe('verde');
    expect(lecturaDeVentana(en(UMBRAL_VERDE_MS), AHORA)?.color).toBe('verde');
    expect(lecturaDeVentana(en(2 * DIA), AHORA)?.color).toBe('verde');

    // Amarillo: justo debajo de 12 h hasta 6 h inclusive.
    expect(lecturaDeVentana(en(UMBRAL_VERDE_MS - MINUTO), AHORA)?.color).toBe('amarillo');
    expect(lecturaDeVentana(en(UMBRAL_AMARILLO_MS), AHORA)?.color).toBe('amarillo');
    expect(lecturaDeVentana(en(11 * HORA), AHORA)?.color).toBe('amarillo');

    // Rojo: debajo de 6 h y hasta el último minuto.
    expect(lecturaDeVentana(en(UMBRAL_AMARILLO_MS - MINUTO), AHORA)?.color).toBe('rojo');
    expect(lecturaDeVentana(en(5 * HORA), AHORA)?.color).toBe('rojo');
    expect(lecturaDeVentana(en(10 * MINUTO), AHORA)?.color).toBe('rojo');
  });

  it('la ayuda explica el plazo, no repite la píldora', () => {
    expect(lecturaDeVentana(en(6 * HORA), AHORA)?.ayuda).toBe(
      'Se le puede escribir: la ventana cierra en 6 h',
    );
  });
});

/**
 * EL AVISO DEL COMPOSER (ADR 0058).
 *
 * Lo que estos tests protegen no es que el aviso aparezca: es **dónde NO
 * aparece**. Decir «cerrada» sobre una línea whatsmeow sería falso, y el costo de
 * esa mentira es una venta que nadie intenta — que es exactamente el argumento
 * con el que ADR 0041 dejó la señal solo en positivo.
 */
describe('avisoDeComposer', () => {
  const aviso = (cierra: string | null | undefined, transporte?: 'whatsmeow' | 'cloud-api' | 'falso') =>
    avisoDeComposer(cierra, transporte, AHORA);

  it('🔴 la ventana vencida se DICE: es el caso que costó dos mensajes', () => {
    // Medido el 16-ago-2026: 28,3 h y 24,5 h desde el último entrante. Los dos
    // salieron y los dos rebotaron, sin que nada lo anticipara.
    const a = aviso(en(-4 * HORA), 'cloud-api');
    expect(a?.clase).toBe('cerrada');
    expect(a?.texto).toContain('24 h');
    // Dice qué hacer, no solo qué pasa.
    expect(a?.texto).toContain('plantilla aprobada');
  });

  it('🔴 en whatsmeow NO dice nada, aunque la ventana esté vencida', () => {
    // Ahí Meta no rechaza por ventana. Un «va a rebotar» sería falso, y la
    // vendedora dejaría de escribirle a alguien a quien sí podía escribirle.
    expect(aviso(en(-4 * HORA), 'whatsmeow')).toBe(null);
    expect(aviso(en(-4 * HORA), 'falso')).toBe(null);
  });

  it('🔴 un server viejo (sin `transporte`) se comporta como antes del frente', () => {
    // N4 va solo y N5 es un botón: esa ventana de deploy existe siempre. Ante la
    // duda no se inventa una prohibición.
    expect(aviso(en(-4 * HORA), undefined)).toBe(null);
  });

  it('avisa ANTES, mientras todavía se puede aprovechar', () => {
    const a = aviso(en(UMBRAL_ORO_MS - MINUTO), 'cloud-api');
    expect(a?.clase).toBe('por-cerrar');
    expect(a?.texto).toContain('2 h');
  });

  it('con la ventana holgada no molesta', () => {
    expect(aviso(en(UMBRAL_ORO_MS + MINUTO), 'cloud-api')).toBe(null);
    expect(aviso(en(20 * HORA), 'cloud-api')).toBe(null);
  });

  it('sin ventana no hay nada que avisar, y eso no es «cerrada»', () => {
    // Una conversación donde la persona nunca escribió no tiene puerta que mirar.
    // Tratarla como cerrada pondría el cartel rojo en toda la mesa.
    expect(aviso(null, 'cloud-api')).toBe(null);
    expect(aviso(undefined, 'cloud-api')).toBe(null);
    expect(aviso('no soy una fecha', 'cloud-api')).toBe(null);
  });
});

/**
 * ══ LOS DOS RELOJES DE LA FILA ══════════════════════════════════════════════
 *
 * 🔴 Reportado por el dueño el 22-ago-2026 como «los datos no están
 * sincronizados»: la píldora decía «34 min» y abajo «hace 23 horas». No era un
 * bug de datos —suman ~24 h por construcción— pero que haga falta explicarlo ES
 * el defecto. Y la trampa de segundo orden es que la referencia del «hace»
 * CAMBIA según si le contestamos (`cola/urgenciaSql.ts:referenciaSql`), así que
 * los dos números dejan de sumar 24 sin que nada lo diga.
 */
describe('ayudaDeAntiguedad', () => {
  it('dice de qué mensaje se está midiendo, y son dos mensajes distintos', () => {
    expect(ayudaDeAntiguedad(false)).toContain('te escribieron');
    expect(ayudaDeAntiguedad(true)).toContain('le contestaste');
  });

  /**
   * Sin responder, el «hace» arranca en el último ENTRANTE — la misma base que
   * la ventana— así que los dos relojes suman 24 h y se ven prolijos. Respondida
   * arranca en NUESTRO mensaje y suman menos. Quien colapse los dos textos a uno
   * vuelve a dejar la fila afirmando algo falso la mitad de las veces.
   */
  it('las dos lecturas son DISTINTAS: colapsarlas es la mitad de las filas mintiendo', () => {
    expect(ayudaDeAntiguedad(true)).not.toBe(ayudaDeAntiguedad(false));
  });

  /** `undefined` es una fila de un server viejo: se lee como «no contestada». */
  it('sin el campo se lee como no contestada, que es lo que la fila ya dibuja', () => {
    expect(ayudaDeAntiguedad(undefined)).toBe(ayudaDeAntiguedad(false));
  });
});


/**
 * ══ LA CUENTA REGRESIVA SÓLO DONDE EL PLAZO SE CUMPLE ═══════════════════════
 *
 * Reportado por el dueño el 22-ago-2026: «en wspp de whatsmeow no importa lo de
 * las 24 horas, no les debería salir». En la Cloud API Meta rechaza con 131047;
 * en whatsmeow no rechaza nada, así que «quedan 4 h» promete un vencimiento que
 * no ocurre.
 */
describe('plazoDuro', () => {
  it('sólo whatsmeow no tiene plazo — todo lo demás sí', () => {
    expect(plazoDuro('whatsmeow')).toBe(false);
    expect(plazoDuro('cloud-api')).toBe(true);
    expect(plazoDuro('falso')).toBe(true);
  });

  /**
   * 🔴 EL CANDADO DEL FAIL-OPEN. Tres casos reales caen en «no sé el
   * transporte» y en los TRES el plazo existe: los DM de Messenger/IG (que son
   * `tipo='mensaje'` con `numero_propio` NULL y tienen la ventana de 24 h de
   * Meta), el primer render de cada arranque (`lineas-whatsapp` no se persiste,
   * así que `useLineas` arranca en `[]`), y una línea retirada del gestor.
   * Invertir esto les borra la píldora justo donde importa.
   */
  it('sin dato el plazo es DURO: se esconde lo que sobra, nunca lo que no se sabe', () => {
    expect(plazoDuro(undefined)).toBe(true);
    expect(plazoDuro(null)).toBe(true);
    expect(plazoDuro('')).toBe(true);
  });
});

describe('lecturaDeVentana y el plazo', () => {
  /**
   * 🔴 EL INSTANTE SE CONGELA UNA VEZ Y TODO SE DERIVA DE ÉL.
   *
   * La primera versión hacía `Date.now() + 6h` en una línea y `new Date()` en la
   * siguiente, y eso **mide la velocidad de la máquina**: en una laptop las dos
   * caen en el mismo milisegundo y `falta` da 6 h justas (amarillo); en el
   * runner de CI —5,6× más lento por núcleo— pasa un tick, `falta` da 5 h 59 y
   * el color sale ROJO. Verde local, rojo en CI, y con pinta de flake.
   *
   * Es la misma trampa que este frente documentó en la galería (`en(6 * HORA)`
   * pierde unos ms antes de dibujarse y cae en la banda de al lado) y la misma
   * familia que CLAUDE.md ya prohíbe para los tests con base: **no claves un
   * presupuesto de reloj de pared**. Restando contra el MISMO instante, la
   * diferencia es exactamente 6 h por más lenta que sea la máquina.
   */
  const AHORA = new Date();
  const EN_6H = new Date(AHORA.getTime() + 6 * 60 * 60 * 1000).toISOString();

  it('sin plazo no dibuja nada, aunque falten horas', () => {
    expect(lecturaDeVentana(EN_6H, AHORA, plazoDuro('whatsmeow'))).toBeNull();
  });

  it('con plazo duro dibuja igual que siempre', () => {
    const l = lecturaDeVentana(EN_6H, AHORA, plazoDuro('cloud-api'));
    // 6 h justas: `colorDeVentana` es inclusivo en el borde de abajo del
    // amarillo (`>= UMBRAL_AMARILLO_MS`), y `cuantoFalta` no redondea nada acá.
    expect(l?.color).toBe('amarillo');
    expect(l?.texto).toBe('6 h');
  });

  /** El default del tercer parámetro ES el fail-open: sin pasarlo, se dibuja. */
  it('el default no esconde: omitir el plazo se comporta como antes del frente', () => {
    expect(lecturaDeVentana(EN_6H, AHORA)).not.toBeNull();
    expect(lecturaDeVentana(EN_6H, AHORA, plazoDuro(undefined))).not.toBeNull();
  });

  /**
   * 🔴 LAS DOS REGLAS SON DISTINTAS A PROPÓSITO Y NO SE COLAPSAN.
   * `avisoDeComposer` AFIRMA que está cerrada y exige `=== 'cloud-api'`;
   * `plazoDuro` ESCONDE y sólo lo hace con `=== 'whatsmeow'`. Con el transporte
   * desconocido la primera calla y la segunda dibuja — las dos aciertan, en
   * direcciones opuestas. Unificarlas rompe una de las dos.
   */
  it('no es `avisoDeComposer` con otro nombre: con transporte desconocido difieren', () => {
    const VENCIDA = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    // El composer NO afirma nada sin certeza…
    expect(avisoDeComposer(VENCIDA, undefined, AHORA)).toBeNull();
    // …y la píldora SÍ dibuja sin certeza (acá con una ventana viva).
    expect(lecturaDeVentana(EN_6H, AHORA, plazoDuro(undefined))).not.toBeNull();
    // Y sobre una línea whatsmeow las dos callan, por motivos distintos.
    expect(avisoDeComposer(VENCIDA, 'whatsmeow', AHORA)).toBeNull();
    expect(lecturaDeVentana(EN_6H, AHORA, plazoDuro('whatsmeow'))).toBeNull();
  });
});
