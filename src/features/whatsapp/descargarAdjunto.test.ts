import { describe, expect, it } from 'vitest';
import { esPdf, nombreDeDescarga } from './descargarAdjunto';
import type { MediaHilo } from './conversacionWa';

const CUANDO = '2026-09-11T15:30:00-05:00';
const media = (m: Partial<MediaHilo>): MediaHilo => ({ clase: 'imagen', archivo: 'wa-3EB0.jpg', mime: 'image/jpeg', ...m });

describe('nombreDeDescarga', () => {
  it('el nombre original gana: `temario.pdf` se guarda como `temario.pdf`', () => {
    expect(nombreDeDescarga(media({ clase: 'documento', nombre: 'temario.pdf', mime: 'application/pdf' }), CUANDO)).toBe(
      'temario.pdf',
    );
  });

  it('sin nombre, uno legible con la clase y el día del mensaje, no el `wa-3EB0…` interno', () => {
    expect(nombreDeDescarga(media({}), CUANDO)).toBe('imagen-2026-09-11.jpg');
  });

  it('la nota de voz se llama así, y el audio común no', () => {
    const audio = { clase: 'audio' as const, archivo: 'wa-1.ogg', mime: 'audio/ogg; codecs=opus' };
    expect(nombreDeDescarga(media({ ...audio, voz: { segundos: 4 } }), CUANDO)).toBe('nota-de-voz-2026-09-11.ogg');
    expect(nombreDeDescarga(media(audio), CUANDO)).toBe('audio-2026-09-11.ogg');
  });

  it('un nombre sin extensión la recibe: si no, Windows no sabe con qué abrirlo', () => {
    expect(nombreDeDescarga(media({ clase: 'documento', nombre: 'Temario', mime: 'application/pdf', archivo: 'wa-2.pdf' }), CUANDO)).toBe(
      'Temario.pdf',
    );
  });

  it('si el archivo interno quedó como `.bin`, la extensión sale del mime', () => {
    expect(nombreDeDescarga(media({ clase: 'video', archivo: 'wa-cloud-99.bin', mime: 'video/mp4' }), CUANDO)).toBe(
      'video-2026-09-11.mp4',
    );
  });

  it('el día es el de Lima, no el UTC: un mensaje de las 22:00 no se guarda con fecha de mañana', () => {
    expect(nombreDeDescarga(media({}), '2026-09-12T03:00:00Z')).toBe('imagen-2026-09-11.jpg');
  });

  it('sin nada que sirva, no inventa una extensión', () => {
    expect(nombreDeDescarga(media({ clase: 'documento', archivo: 'wa-7', mime: null }), CUANDO)).toBe('documento-2026-09-11');
  });
});

describe('esPdf', () => {
  it('se mira el mime y, si falta, el nombre', () => {
    expect(esPdf(media({ clase: 'documento', mime: 'application/pdf' }))).toBe(true);
    expect(esPdf(media({ clase: 'documento', mime: null, nombre: 'Temario.PDF' }))).toBe(true);
    expect(esPdf(media({ clase: 'documento', mime: 'application/vnd.ms-excel', nombre: 'notas.xls' }))).toBe(false);
  });
});
