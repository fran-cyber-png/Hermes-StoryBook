// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { montar } from '../pruebas/dom';
import { MINIMO_FONDO, MINIMO_TEXTO, contraste } from '../pruebas/contraste';
import { BadgeCanal, PildoraCanal, canalConInsignia, insigniaDe, nombreCanal, nombreDeCanal } from './BadgeCanal';

/**
 * EL CANDADO DE «UN COMENTARIO NO ES UN MENSAJE».
 *
 * Lo que este archivo impide volver a romper es una sola relación: que dos
 * conversaciones con el MISMO canal y DISTINTO tipo se dibujen distinto. Se
 * rompió durante meses sin un solo error — `canal` alcanzaba para elegir el
 * color, y nadie miraba que el color fuera lo único que se elegía.
 */
describe('nombreDeCanal', () => {
  it('nombra el comentario público distinto del mensaje directo, en los dos canales de Meta', () => {
    expect(nombreDeCanal('instagram', 'mensaje')).toBe('Instagram');
    expect(nombreDeCanal('instagram', 'comentario')).toBe('Comentario de Instagram');
    expect(nombreDeCanal('facebook', 'mensaje')).toBe('Messenger');
    expect(nombreDeCanal('facebook', 'comentario')).toBe('Comentario de Facebook');
  });

  /**
   * 🔴 EL CAMBIO DE CONTRATO, Y SUS TRES LÍMITES.
   *
   * Un directo de Facebook se llama Messenger — es el par `(facebook, mensaje)`,
   * no un canal nuevo. Los tres asertos de abajo son el candado del ALCANCE: si
   * el frente se pasa de rosca y colapsa el par con la red, se caen solos.
   */
  it('🔴 un directo de Facebook es Messenger, pero sólo el PAR — no la red ni el resto', () => {
    expect(nombreDeCanal('facebook', 'mensaje')).toBe('Messenger');
    // Sin tipo, «como siempre»: cinco pantallas arman la Conversacion sin él.
    expect(nombreDeCanal('facebook')).toBe('Facebook');
    // Un DM de Instagram NO entra por Messenger.
    expect(nombreDeCanal('instagram', 'mensaje')).toBe('Instagram');
    // La RED sigue llamándose Facebook.
    expect(nombreCanal('facebook')).toBe('Facebook');
  });

  it('🔴 Messenger tiene su propio color: si comparte el de Facebook, no se distingue', () => {
    const messenger = insigniaDe('facebook', 'mensaje');
    const facebook = insigniaDe('facebook', 'comentario');
    expect(messenger?.color).not.toBe(facebook?.color);
    // Y el logo también: reusar el de Facebook dejaría el cambio a medias.
    expect(messenger?.logo).toBe('messenger');
    expect(facebook?.logo).toBe('facebook');
  });

  it('nombra el formulario, que no es una red y no tiene disco', () => {
    expect(nombreDeCanal('landing', 'lead')).toBe('Formulario');
    // Sin tipo tampoco se confunde: `landing` no puede ser otra cosa.
    expect(nombreDeCanal('landing')).toBe('Formulario');
  });

  it('sin tipo se comporta como antes del frente — el nombre pelado del canal', () => {
    expect(nombreDeCanal('whatsapp')).toBe('WhatsApp');
    expect(nombreDeCanal('facebook')).toBe('Facebook');
    expect(nombreDeCanal('instagram')).toBe('Instagram');
  });

  it('un canal desconocido se devuelve tal cual, nunca se inventa un nombre parecido', () => {
    expect(nombreDeCanal('telegram', 'mensaje')).toBe('telegram');
  });

  /**
   * ⚠️ `nombreCanal` es el nombre del CANAL y `nombreDeCanal` el de lo que
   * ENTRÓ por él. Son dos preguntas, como las tres de `dominio/canal.ts`:
   * colapsarlas haría que el selector de canal de una pantalla de
   * configuración empiece a ofrecer «Comentario IG» como si fuera una red.
   */
  it('no colapsa con `nombreCanal`, que sigue nombrando la RED y no la fila', () => {
    expect(nombreCanal('instagram')).toBe('Instagram');
    expect(nombreCanal('landing')).toBe('landing');
  });
});

describe('BadgeCanal', () => {
  it('el comentario va HUECO y el mensaje LLENO — a 14 px el relleno es lo único que se distingue', () => {
    const directo = montar(<BadgeCanal canal="instagram" tipo="mensaje" />);
    const insignia = directo.contenedor.querySelector('span');
    expect(insignia?.style.backgroundColor).toBeTruthy();
    expect(insignia?.style.border).toBe('');

    const publico = montar(<BadgeCanal canal="instagram" tipo="comentario" />);
    const hueco = publico.contenedor.querySelector('span');
    expect(hueco?.style.border).toContain('solid');
    expect(hueco?.style.backgroundColor).toBe('');
  });

  it('sin tipo se dibuja lleno, como antes del frente', () => {
    const { contenedor } = montar(<BadgeCanal canal="whatsapp" />);
    expect(contenedor.querySelector('span')?.style.backgroundColor).toBeTruthy();
  });

  it('el formulario no tiene disco: no entró por ninguna red', () => {
    const { contenedor } = montar(<BadgeCanal canal="landing" tipo="lead" />);
    expect(contenedor.querySelector('span')).toBeNull();
  });
});

describe('PildoraCanal', () => {
  /**
   * 🔴 EL CANDADO DE LA ASIMETRÍA, ahora con logos. El directo es SÓLO el logo;
   * el comentario conserva la palabra. No es una inconsistencia que alguien deba
   * «emparejar»: el logo dice POR DÓNDE entró, y «Coment.» dice que la respuesta
   * va al MURO. Son dos preguntas, y la segunda es la que sale cara.
   */
  it('el directo es sólo el logo; el comentario suma la palabra', () => {
    const directo = montar(<PildoraCanal canal="facebook" tipo="mensaje" />);
    const publico = montar(<PildoraCanal canal="facebook" tipo="comentario" />);

    expect(directo.contenedor.textContent).toBe('');
    expect(publico.contenedor.textContent).toContain('Coment.');

    // Los dos llevan logo: lo que cambia es lo que se AGREGA, no lo que se saca.
    expect(directo.contenedor.querySelector('svg')).not.toBeNull();
    expect(publico.contenedor.querySelector('svg')).not.toBeNull();
  });

  /**
   * 🔴 SIN TEXTO VISIBLE, EL `aria-label` ES LO ÚNICO QUE QUEDA. Un lector de
   * pantalla no puede leer un `<path>`: sin esto, la fila no dice de qué canal
   * es. Y el `<svg>` va `aria-hidden` para que no se lea dos veces.
   */
  it('dice de qué canal es a un lector de pantalla, aunque no haya texto', () => {
    const { contenedor } = montar(<PildoraCanal canal="instagram" tipo="comentario" />);
    const pildora = contenedor.querySelector('span');
    expect(pildora?.getAttribute('aria-label')).toBe('Comentario de Instagram');
    expect(pildora?.title).toBe('Comentario de Instagram');
    expect(contenedor.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  /**
   * 🔴 La píldora se queda SÓLIDA en los dos casos. Un hueco pondría `#1877F2`
   * o `#C13584` como TINTA sobre `--card`, y ninguno llega a 4.5:1 en oscuro.
   * Con el logo en blanco encima, el fondo de marca ES lo que da el contraste.
   */
  it('nunca se dibuja hueca: el color de marca no sirve de tinta en oscuro', () => {
    for (const tipo of ['mensaje', 'comentario']) {
      const { contenedor } = montar(<PildoraCanal canal="instagram" tipo={tipo} />);
      expect(contenedor.querySelector('span')?.style.backgroundColor).toBeTruthy();
    }
  });

  it('el formulario tiene insignia propia — no es una marca, es un trazo de la casa', () => {
    const { contenedor } = montar(<PildoraCanal canal="landing" tipo="lead" />);
    expect(contenedor.querySelector('svg')).not.toBeNull();
    expect(contenedor.querySelector('span')?.getAttribute('aria-label')).toBe('Formulario');
  });

  it('un canal desconocido no se dibuja: no se le inventa un color ni un símbolo', () => {
    const { contenedor } = montar(<PildoraCanal canal="telegram" tipo="mensaje" />);
    expect(contenedor.querySelector('span')).toBeNull();
    expect(canalConInsignia('telegram')).toBe(false);
    expect(canalConInsignia('landing')).toBe(true);
  });
});

/**
 * ══ LA TINTA DE CADA COLOR DE MARCA ═════════════════════════════════════════
 *
 * 🔴 EL DEFECTO QUE ESTO VIGILA NO SE VE EN NINGÚN DOM. `text-white` sobre el
 * verde de WhatsApp da **1,98:1**: el número está ahí, ocupa su lugar, tiene su
 * texto en el DOM y no se lee. Es la misma clase de defecto que
 * `temaOscuroLegible.test.ts` persigue en los tokens, sólo que acá el color es
 * de marca externa y no vive en `index.css`, así que aquel test no lo mira.
 *
 * Lo que se fija es la RELACIÓN, no la ortografía de un hex: el día que Meta le
 * cambie el celeste a Messenger, o que alguien agregue un canal, esto obliga a
 * que la tinta declarada siga siendo **la más legible de las dos**.
 */
describe('la tinta de la insignia', () => {
  const NAVY = '#0E2A52';
  const BLANCO = '#FFFFFF';
  const CASOS = [
    { canal: 'whatsapp', tipo: 'mensaje' },
    { canal: 'facebook', tipo: 'mensaje' }, // Messenger
    { canal: 'facebook', tipo: 'comentario' },
    { canal: 'instagram', tipo: 'mensaje' },
    { canal: 'instagram', tipo: 'comentario' },
  ] as const;

  it('🔴 cada insignia declara la MÁS LEGIBLE de las dos tintas sobre su propio color', () => {
    for (const { canal, tipo } of CASOS) {
      const insignia = insigniaDe(canal, tipo);
      expect(insignia, `${canal}/${tipo} debería tener insignia`).not.toBeNull();
      const mejor = contraste(insignia!.color, NAVY) >= contraste(insignia!.color, BLANCO) ? NAVY : BLANCO;
      expect(insignia!.tinta.toUpperCase(), `${nombreDeCanal(canal, tipo)} sobre ${insignia!.color}`).toBe(mejor);
    }
  });

  /**
   * El piso que SÍ se puede exigir hoy. Messenger (3,90) y Facebook (4,23) no
   * llegan a `MINIMO_TEXTO`, y eso queda escrito con su cifra en el docblock de
   * `CANAL` en vez de arreglado a escondidas: subirlos es oscurecer un color de
   * MARCA, que es decisión del dueño. Lo que este test impide es que alguno caiga
   * por debajo del piso de un elemento de interfaz.
   */
  it('ninguna tinta baja del piso de un elemento de interfaz', () => {
    for (const { canal, tipo } of CASOS) {
      const insignia = insigniaDe(canal, tipo)!;
      expect(contraste(insignia.color, insignia.tinta)).toBeGreaterThanOrEqual(MINIMO_FONDO);
    }
  });

  /**
   * ⚠️ El verde de WhatsApp es el caso que originó esto, y va aparte para que el
   * mensaje de la falla nombre al culpable en vez de a un `for`.
   */
  it('🔴 WhatsApp NO lleva blanco: es el 1,98:1 que empezó este frente', () => {
    const wa = insigniaDe('whatsapp', 'mensaje')!;
    expect(wa.tinta.toUpperCase()).not.toBe(BLANCO);
    expect(contraste(wa.color, wa.tinta)).toBeGreaterThan(MINIMO_TEXTO);
  });
});
