import { describe, it, expect } from 'vitest';
import { lineaEfectiva, opcionesDeLinea, seDibujaElSelector, tagDeTransporte } from './alcance';
import { LINEA_MIAS } from '../../dominio/cola';
import type { LineaWhatsapp } from '../../dominio/lineas';

/**
 * QUÉ LÍNEAS OFRECE EL SELECTOR.
 *
 * El caso que motiva todo: cinco vendedoras nuevas atienden UNA línea y el
 * selector les ponía adelante las otras tres, dos de las cuales se distinguen por
 * una `s` y una tilde («Ventas Perú» / «Venta Peru»).
 */

const L = (numero: string, etiqueta: string, mias?: boolean): LineaWhatsapp => ({
  numero,
  etiqueta,
  estado: 'conectado',
  ...(mias === undefined ? {} : { mias }),
});

const LAS_CUATRO = [
  L('51986394450', 'Ventas Perú'),
  L('51941654039', 'Walter Ventas'),
  L('51944531711', 'Venta Peru'),
  L('51984429504', 'Ventas Meta'),
];

describe('opcionesDeLinea', () => {
  it('sin líneas propias ofrece TODAS: fail-open, como siempre', () => {
    const o = opcionesDeLinea(LAS_CUATRO, false);
    expect(o.map((x) => x.etiqueta)).toEqual([
      'Todas',
      'Ventas Perú',
      'Walter Ventas',
      'Venta Peru',
      'Ventas Meta',
    ]);
  });

  /**
   * EL CASO DE LAS CINCO NUEVAS. Con una sola línea propia queda UNA opción, y
   * por `seDibujaElSelector` el control desaparece: no hay elección que tomar.
   */
  it('con UNA línea propia queda una sola opción, y el selector no se dibuja', () => {
    const propias = LAS_CUATRO.map((l) => (l.numero === '51984429504' ? { ...l, mias: true } : l));
    const o = opcionesDeLinea(propias, true);
    expect(o.map((x) => x.etiqueta)).toEqual(['Ventas Meta']);
    expect(seDibujaElSelector(o)).toBe(false);
  });

  /**
   * Luz atiende dos. Ahí sí hay elección — pero **sin «Todas»**: agregarla
   * volvería a poner adelante las colas de Walter y Sindy, que es justo lo que
   * este módulo saca.
   */
  it('con VARIAS propias ofrece «Las mías» + las suyas, y nunca «Todas»', () => {
    const propias = LAS_CUATRO.map((l) =>
      l.numero === '51986394450' || l.numero === '51984429504' ? { ...l, mias: true } : l,
    );
    const o = opcionesDeLinea(propias, true);
    expect(o.map((x) => x.etiqueta)).toEqual(['Las mías', 'Ventas Perú', 'Ventas Meta']);
    expect(o.some((x) => x.numero === '')).toBe(false);
    expect(seDibujaElSelector(o)).toBe(true);
  });

  /**
   * 🔴 EL CASO DE ALEX (7-sep-2026). Supervisor con UNA línea en el mapa: con la
   * regla vieja quedaba con una sola opción, el selector desaparecía y
   * `lineaEfectiva` le clavaba Ventas Meta — 2.346 conversaciones de las 7.178
   * que el server sí le servía.
   *
   * «Todas» tiene que ir **primera**: `lineaEfectiva` cae a `opciones[0]` cuando
   * lo guardado ya no es una opción, y ahí es donde se decide qué ve al entrar.
   */
  it('quien VE TODO no queda confinado a su línea: «Todas» primera, «Las mías» y todas las vivas', () => {
    const propias = LAS_CUATRO.map((l) => (l.numero === '51984429504' ? { ...l, mias: true } : l));
    const o = opcionesDeLinea(propias, true, true);
    expect(o.map((x) => x.etiqueta)).toEqual([
      'Todas',
      'Las mías',
      'Ventas Perú',
      'Walter Ventas',
      'Venta Peru',
      'Ventas Meta',
    ]);
    expect(seDibujaElSelector(o)).toBe(true);
    expect(lineaEfectiva('51984429504', o)).toBe('51984429504');
    // Y lo que importa de verdad: al entrar sin nada guardado, ve la mesa entera.
    expect(lineaEfectiva('', o)).toBe('');
  });

  /**
   * Quien ve todo y NO tiene línea en el mapa —`alan` (admin) y
   * `ventas10@grupogoberna.com` (supervisor), los dos casos vivos en
   * producción— no gana un «Las mías» que no lleva a ningún lado.
   */
  it('quien ve todo SIN líneas en el mapa no recibe «Las mías»', () => {
    const o = opcionesDeLinea(LAS_CUATRO, false, true);
    expect(o.map((x) => x.etiqueta)).toEqual([
      'Todas',
      'Ventas Perú',
      'Walter Ventas',
      'Venta Peru',
      'Ventas Meta',
    ]);
  });

  it('sin `veTodo` la regla es EXACTAMENTE la de antes: el default no abre nada', () => {
    const propias = LAS_CUATRO.map((l) => (l.numero === '51984429504' ? { ...l, mias: true } : l));
    expect(opcionesDeLinea(propias, true)).toEqual(opcionesDeLinea(propias, true, false));
    expect(opcionesDeLinea(propias, true).map((x) => x.etiqueta)).toEqual(['Ventas Meta']);
  });

  it('una sola línea viva y sin mapa sigue sin dibujar selector (regla vieja, intacta)', () => {
    expect(seDibujaElSelector(opcionesDeLinea([L('51986394450', 'Ventas Perú')], false))).toBe(true);
    // ↑ «Todas» + la línea son dos opciones. Que el shell lo esconda con una sola
    // línea VIVA es otra decisión y vive en `useLineas().hayVarias`.
  });
});

describe('lineaEfectiva', () => {
  const propias = LAS_CUATRO.map((l) => (l.numero === '51984429504' ? { ...l, mias: true } : l));
  const unaSola = opcionesDeLinea(propias, true);

  it('respeta lo guardado si sigue siendo una opción', () => {
    expect(lineaEfectiva('51984429504', unaSola)).toBe('51984429504');
  });

  /**
   * EL CASO QUE JUSTIFICA LA FUNCIÓN. Cuando el selector no se dibuja no hay
   * control para corregir un valor guardado malo: sin esto, quien ayer eligió
   * «Todas» vería las cuatro líneas para siempre, sin nada que lo explique.
   */
  it('un valor guardado que ya no corresponde cae a LO SUYO, no a «Todas»', () => {
    expect(lineaEfectiva('', unaSola)).toBe('51984429504');
    expect(lineaEfectiva('51941654039', unaSola)).toBe('51984429504');
    expect(lineaEfectiva(LINEA_MIAS, unaSola)).toBe('51984429504');
  });

  it('sin mapa, un valor raro cae a «Todas» — que ahí sí es lo correcto', () => {
    expect(lineaEfectiva('51999999999', opcionesDeLinea(LAS_CUATRO, false))).toBe('');
  });

  it('con varias propias, lo que no corresponde cae a «Las mías»', () => {
    const dos = opcionesDeLinea(
      LAS_CUATRO.map((l) =>
        l.numero === '51986394450' || l.numero === '51984429504' ? { ...l, mias: true } : l,
      ),
      true,
    );
    expect(lineaEfectiva('51941654039', dos)).toBe(LINEA_MIAS);
  });

  it('sin opciones no rompe', () => {
    expect(lineaEfectiva('51984429504', [])).toBe('');
  });
});

/**
 * ══ EL TRANSPORTE EN EL SELECTOR ════════════════════════════════════════════
 *
 * Por dónde sale una línea decide cosas OPUESTAS en las dos que corren hoy:
 * `cloud-api` tiene el plazo de 24 h duro y no puede editar un enviado;
 * `whatsmeow` puede editar y no tiene plazo. Con las dos en la misma barra y sin
 * rótulo, quien supervisa las dos colas no puede saber cuál está mirando.
 */
describe('el transporte de cada línea', () => {
  const conTransporte = (t: LineaWhatsapp['transporte']): LineaWhatsapp => ({
    numero: '51984429504',
    etiqueta: 'Ventas Meta',
    estado: 'conectado',
    transporte: t,
  });

  it('viaja hasta la opción, para que el selector lo pueda rotular', () => {
    const [, meta] = opcionesDeLinea([conTransporte('cloud-api')], false);
    expect(meta.transporte).toBe('cloud-api');
  });

  it('rotula API y QR, y NADA para el transporte de desarrollo', () => {
    expect(tagDeTransporte('cloud-api')).toBe('API');
    expect(tagDeTransporte('whatsmeow')).toBe('QR');
    expect(tagDeTransporte('falso')).toBeNull();
  });

  /**
   * 🔴 Un server viejo no manda el campo. Ausente tiene que degradar en «no se
   * dibuja el tag», nunca en un tag por defecto: un «API» inventado sobre una
   * línea de whatsmeow le prometería a la vendedora un plazo duro que ahí no
   * existe, y le negaría el editar que sí tiene.
   */
  it('sin el campo no inventa un tag', () => {
    expect(tagDeTransporte(undefined)).toBeNull();
    const [, sinDato] = opcionesDeLinea([conTransporte(undefined)], false);
    expect(sinDato.transporte).toBeUndefined();
  });

  /**
   * ⚠️ «Todas» y «Las mías» agrupan líneas que pueden tener transportes
   * distintos — hoy exactamente ése es el caso. Un tag ahí afirmaría de una lo
   * que le toca a la otra.
   */
  it('las opciones que AGRUPAN líneas no llevan transporte', () => {
    const [todas] = opcionesDeLinea([conTransporte('cloud-api')], false);
    expect(todas.numero).toBe('');
    expect(todas.transporte).toBeUndefined();

    const mias = opcionesDeLinea(
      [
        { ...conTransporte('cloud-api'), mias: true },
        { numero: '51963139984', etiqueta: 'Betto', estado: 'conectado', mias: true, transporte: 'whatsmeow' },
      ],
      true,
    );
    expect(mias[0].numero).toBe(LINEA_MIAS);
    expect(mias[0].transporte).toBeUndefined();
    // …y las dos de abajo SÍ lo llevan, cada una el suyo.
    expect(mias.slice(1).map((o) => o.transporte)).toEqual(['cloud-api', 'whatsmeow']);
  });

  it('el `title` explica la consecuencia, que es lo que un tag de dos letras no puede decir', () => {
    const [, meta] = opcionesDeLinea([conTransporte('cloud-api')], false);
    expect(meta.titulo).toContain('24 h');
    const [, qr] = opcionesDeLinea([conTransporte('whatsmeow')], false);
    expect(qr.titulo).toContain('editar');
  });
});
