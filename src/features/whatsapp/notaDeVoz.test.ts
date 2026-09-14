import { describe, expect, it } from 'vitest';
import { DURACION_MAXIMA_S, MUESTRAS_DE_ONDA, ondaEnBase64, relojDeVoz } from './notaDeVoz';
import { elegirFormatoDeGrabacion, motivoDelMicrofono, ondaDeMuestras } from './grabacionDeVoz';

describe('elegirFormatoDeGrabacion', () => {
  it('prefiere ogg/opus si el navegador lo graba (Firefox), después webm/opus (Chrome, WebView2)', () => {
    expect(elegirFormatoDeGrabacion(() => true)).toBe('audio/ogg;codecs=opus');
    expect(elegirFormatoDeGrabacion((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
  });

  it('en WKWebView (macOS) cae a mp4: se convierte igual antes de mandar', () => {
    expect(elegirFormatoDeGrabacion((t) => t === 'audio/mp4')).toBe('audio/mp4');
  });

  it('si no reconoce ninguno, deja que el navegador elija en vez de no grabar', () => {
    expect(elegirFormatoDeGrabacion(() => false)).toBeUndefined();
  });
});

describe('ondaDeMuestras', () => {
  it('devuelve 64 valores enteros de 0 a 100', () => {
    const muestras = Float32Array.from({ length: 48000 }, (_, i) => Math.sin(i / 10) * 0.3);
    const onda = ondaDeMuestras(muestras);
    expect(onda).toHaveLength(MUESTRAS_DE_ONDA);
    expect(onda.every((v) => Number.isInteger(v) && v >= 0 && v <= 100)).toBe(true);
  });

  it('se normaliza al pico: una nota bajita dibuja la misma forma que una fuerte', () => {
    const forma = (volumen: number) =>
      Float32Array.from({ length: 6400 }, (_, i) => (i < 3200 ? volumen : volumen / 4));
    expect(ondaDeMuestras(forma(0.05))).toEqual(ondaDeMuestras(forma(0.8)));
    expect(ondaDeMuestras(forma(0.8))[0]).toBe(100);
  });

  it('el silencio es una onda plana en cero, no una división por cero', () => {
    expect(ondaDeMuestras(new Float32Array(1000))).toEqual(Array(MUESTRAS_DE_ONDA).fill(0));
  });

  it('con menos muestras que barras no revienta', () => {
    expect(ondaDeMuestras(Float32Array.from([0.5, -0.5]))).toHaveLength(MUESTRAS_DE_ONDA);
  });
});

describe('ondaEnBase64', () => {
  it('son los bytes tal cual: el server los vuelve a leer con Buffer', () => {
    const onda = Array.from({ length: MUESTRAS_DE_ONDA }, (_, i) => i);
    const bytes = Uint8Array.from(atob(ondaEnBase64(onda)), (c) => c.charCodeAt(0));
    expect([...bytes]).toEqual(onda);
  });
});

describe('relojDeVoz', () => {
  it('minutos y segundos, como el contador de WhatsApp', () => {
    expect(relojDeVoz(0)).toBe('0:00');
    expect(relojDeVoz(7.9)).toBe('0:07');
    expect(relojDeVoz(DURACION_MAXIMA_S)).toBe('10:00');
  });
});

describe('motivoDelMicrofono', () => {
  const error = (name: string) => Object.assign(new Error('x'), { name });

  it('un permiso negado dice qué revisar, no «error»', () => {
    expect(motivoDelMicrofono(error('NotAllowedError'))).toMatch(/permiso/);
  });

  it('sin micrófono, u ocupado por otra aplicación, se dice distinto', () => {
    expect(motivoDelMicrofono(error('NotFoundError'))).toMatch(/ningún micrófono/);
    expect(motivoDelMicrofono(error('NotReadableError'))).toMatch(/otra aplicación/);
  });

  it('lo desconocido no se inventa una causa', () => {
    expect(motivoDelMicrofono('raro')).toBe('No se pudo usar el micrófono.');
  });
});
