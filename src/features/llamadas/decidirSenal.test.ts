import { describe, expect, it } from 'vitest';
import { senalDeLlamadaDe, type FaseDeLlamada } from '../../lib/datos/senalDeLlamada';
import { queHacerConLaSenal, type EstadoLlamada } from './decidirSenal';

const senal = (fase: FaseDeLlamada, callId = 'wacid.1') => ({ tipo: 'llamada' as const, callId, fase });
const base = { telefono: '51999888777', clave: 'conv:whatsapp:51999888777:51984429504' };
const nada = new Set<string>();

describe('qué hace una pestaña con cada señal', () => {
  it('libre: una llamada que suena es una entrante nueva, salvo que ya la haya ignorado', () => {
    expect(queHacerConLaSenal({ fase: 'libre' }, senal('sonando'), nada)).toBe('consultar-entrante');
    expect(queHacerConLaSenal({ fase: 'libre' }, senal('sonando'), new Set(['wacid.1']))).toBe('nada');
  });

  it('en una llamada, otra que suena no timbra', () => {
    const enCurso: EstadoLlamada = { fase: 'en-curso', callId: 'wacid.2', direccion: 'entrante', desde: 0, silenciado: false, ...base };
    expect(queHacerConLaSenal(enCurso, senal('sonando'), nada)).toBe('nada');
  });

  it('tomada le apaga el timbre a las demás y no le hace nada a quien la está contestando', () => {
    expect(queHacerConLaSenal({ fase: 'entrante', callId: 'wacid.1', ...base }, senal('tomada'), nada)).toBe('apagar-timbre');
    expect(
      queHacerConLaSenal({ fase: 'conectando', callId: 'wacid.1', direccion: 'entrante', ...base }, senal('tomada'), nada),
    ).toBe('nada');
  });

  it('la respuesta de Meta se aplica solo en la saliente de esa pestaña', () => {
    const llamando: EstadoLlamada = { fase: 'llamando', callId: 'wacid.1', ...base };
    expect(queHacerConLaSenal(llamando, senal('respuesta'), nada)).toBe('aplicar-respuesta');
    expect(queHacerConLaSenal(llamando, senal('respuesta', 'otra'), nada)).toBe('nada');
    expect(queHacerConLaSenal({ fase: 'libre' }, senal('respuesta'), nada)).toBe('nada');
  });

  it('aceptada pone en curso la saliente que estaba esperando', () => {
    expect(queHacerConLaSenal({ fase: 'llamando', callId: 'wacid.1', ...base }, senal('aceptada'), nada)).toBe('marcar-en-curso');
  });

  it('rechazada o terminada cortan la llamada propia, y a una que solo timbraba le apagan el timbre', () => {
    const enCurso: EstadoLlamada = { fase: 'en-curso', callId: 'wacid.1', direccion: 'saliente', desde: 0, silenciado: false, ...base };
    expect(queHacerConLaSenal(enCurso, senal('terminada'), nada)).toBe('cortar');
    expect(queHacerConLaSenal({ fase: 'llamando', callId: 'wacid.1', ...base }, senal('rechazada'), nada)).toBe('cortar');
    expect(queHacerConLaSenal({ fase: 'entrante', callId: 'wacid.1', ...base }, senal('terminada'), nada)).toBe('apagar-timbre');
    expect(queHacerConLaSenal(enCurso, senal('terminada', 'otra'), nada)).toBe('nada');
  });
});

describe('la señal que llega por el cable', () => {
  it('solo cuenta completa, con una fase conocida', () => {
    expect(senalDeLlamadaDe({ tipo: 'llamada', callId: 'wacid.1', fase: 'sonando' })).toEqual(senal('sonando'));
    expect(senalDeLlamadaDe({ tipo: 'llamada' })).toBeNull();
    expect(senalDeLlamadaDe({ tipo: 'llamada', callId: 'wacid.1', fase: 'inventada' })).toBeNull();
    expect(senalDeLlamadaDe({ tipo: 'mensaje', callId: 'wacid.1', fase: 'sonando' })).toBeNull();
  });
});
