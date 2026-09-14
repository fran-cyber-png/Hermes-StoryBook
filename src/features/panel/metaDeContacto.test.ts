import { describe, expect, test } from 'vitest';
import { deDondeVino, type OrigenCrudo } from '../../dominio/origen';
import { metaDelContacto } from './metaDeContacto';
import type { LeadForm } from '../cerberus/leadForm';

/**
 * ══ LA CABECERA DE LA FICHA: UN RÓTULO NO PUEDE AFIRMAR DE MÁS ═════════════
 *
 * 🔴 **EL DEFECTO QUE ESTO FIJA APARECIÓ EN LA GALERÍA, NO EN LA CABEZA.** El
 * segundo par decía «CAMPAÑA» pasara lo que pasara, y con el anuncio sin
 * resolver contra Meta lo que caía debajo era el titular del creativo. La ficha
 * de Rafael afirmaba **CAMPAÑA: «La política no se improvisa. Se planifica.»**,
 * que no es el nombre de ninguna campaña — y le pasaba al **60 %** de los leads
 * de pauta, o sea a la mayoría.
 *
 * Es la regla dura #10 cobrando exactamente lo que promete: con un caso ideal
 * («flyer principal · [SEP][DIPICOT027]…», que sí es una campaña) la pantalla
 * se veía impecable y el rótulo mentiroso no existía.
 */

const RESUELTO: OrigenCrudo = {
  fuente: 'anuncio',
  adId: '120249753997080789',
  titulo: '🎓 Diploma Internacional de Inteligencia y Contrainteligencia',
  anuncio: 'flyer principal',
  campana: '[SEP][DIPICOT027] Diplomado en Inteligencia 27 - Perú',
};

const SIN_RESOLVER: OrigenCrudo = {
  fuente: 'anuncio',
  adId: '120253750387870341',
  titulo: 'La política no se improvisa. Se planifica.',
};

const FORMULARIO: LeadForm = {
  campana: 'CAM_WSP_PROVINCIAS',
  anuncio: 'Flyer casma',
  fecha: '2026-08-30T10:00:00.000Z',
  fuente: 'web',
} as LeadForm;

const deMensaje = (resuelto: unknown) =>
  deDondeVino({ tipo: 'mensaje', resuelto: resuelto as Parameters<typeof deDondeVino>[0]['resuelto'] });

describe('metaDelContacto — el rótulo describe lo que hay debajo', () => {
  test('con campaña resuelta el par se llama «Campaña» y lleva la campaña', () => {
    const meta = metaDelContacto(deMensaje(RESUELTO), null);
    expect(meta?.origen).toBe('Anuncio');
    expect(meta?.rotuloCampana).toBe('Campaña');
    expect(meta?.campana).toBe('[SEP][DIPICOT027] Diplomado en Inteligencia 27 - Perú');
  });

  /** 🔴 El candado del defecto: el titular NO puede salir rotulado «Campaña». */
  test('sin resolver el par se llama «Anuncio» — el titular no se hace pasar por campaña', () => {
    const meta = metaDelContacto(deMensaje(SIN_RESOLVER), null);
    expect(meta?.campana).toBe('La política no se improvisa. Se planifica.');
    expect(meta?.rotuloCampana).toBe('Anuncio');
    expect(meta?.rotuloCampana).not.toBe('Campaña');
  });

  test('una landing con código se rotula «Enlace», que es lo que es', () => {
    const origen = deDondeVino({ tipo: 'mensaje', ultima_origen: { fuente: 'landing', ref: 'clandestinas' } });
    const meta = metaDelContacto(origen, null);
    expect(meta?.origen).toBe('Landing');
    expect(meta?.rotuloCampana).toBe('Enlace');
    expect(meta?.campana).toBe('clandestinas');
  });
});

describe('metaDelContacto — la precedencia', () => {
  /**
   * El anuncio gana porque es lo más específico: sabemos el creativo. El
   * formulario dice de dónde vino en grueso («Landing», «Meta Ads»).
   */
  test('el anuncio le gana al formulario', () => {
    const meta = metaDelContacto(deMensaje(RESUELTO), FORMULARIO);
    expect(meta?.origen).toBe('Anuncio');
    expect(meta?.campana).toContain('[SEP][DIPICOT027]');
  });

  /**
   * 🔴 **«Sin origen» NO le gana al formulario**, y ésa es la mitad que se
   * podría romper sin síntoma: quien llenó un formulario SÍ dijo de dónde
   * viene. Lo que no se sabe de esa persona es si además vio un anuncio.
   */
  test('sin anuncio, la palabra del formulario manda sobre «Sin origen»', () => {
    const meta = metaDelContacto(deDondeVino({ tipo: 'mensaje' }), FORMULARIO);
    expect(meta?.origen).toBe('Landing'); // `origenDeLead('web')`, la misma palabra que el radar
    expect(meta?.origen).not.toBe('Sin origen');
    expect(meta?.campana).toBe('CAM_WSP_PROVINCIAS');
  });

  /**
   * 🔴 **LA AYUDA TIENE QUE HABLAR DEL VALOR QUE ESTÁ AL LADO.** Éste es el caso
   * que se rompió sin síntoma: cuando ganaba el formulario, la celda decía
   * «Landing» y el `title` seguía siendo el de «Sin origen» — «No sabemos de
   * dónde vino» colgado de un rótulo que sí lo sabía. Es alcanzable de verdad:
   * WhatsApp sin referral + la persona registrada en Cerberus.
   */
  test('cuando gana el formulario, la ayuda deja de decir que no se sabe nada', () => {
    const meta = metaDelContacto(deDondeVino({ tipo: 'mensaje' }), FORMULARIO);
    expect(meta?.ayudaOrigen).toContain('Llenó el formulario web (Landing)');
    expect(meta?.ayudaOrigen).not.toContain('No sabemos por dónde llegó');
    // Y sin embargo no oculta la otra mitad, que también es cierta.
    expect(meta?.ayudaOrigen).toContain('no tenemos el referral');
  });

  /**
   * ⚠️ **«Primer contacto» sólo existe si hay formulario.** La conversación no
   * manda ninguna fecha de primer contacto, así que sin lead el par se omite en
   * vez de dibujar un «—» que nunca va a llenarse (ver `armarCampos`).
   */
  test('sin formulario no hay fecha de primer contacto que prometer', () => {
    expect(metaDelContacto(deMensaje(RESUELTO), null)?.primerContacto).toBe('');
    expect(metaDelContacto(deMensaje(RESUELTO), FORMULARIO)?.primerContacto).toBe(FORMULARIO.fecha);
  });

  test('sin nada de nada, «Sin origen» se dice igual y el porqué viaja con él', () => {
    const meta = metaDelContacto(deDondeVino({ tipo: 'mensaje' }), null);
    expect(meta?.origen).toBe('Sin origen');
    expect(meta?.ayudaOrigen).toContain('No sabemos por dónde llegó esta conversación');
  });

  /**
   * Un comentario sin formulario: no hay nada que decir y el bloque no se
   * dibuja. Tres celdas con «—» se leen como un dato que no cargó, que es peor
   * que no dibujar nada.
   */
  test('sin origen posible y sin formulario, no hay bloque', () => {
    expect(metaDelContacto(deDondeVino({ tipo: 'comentario' }), null)).toBeNull();
  });
});
