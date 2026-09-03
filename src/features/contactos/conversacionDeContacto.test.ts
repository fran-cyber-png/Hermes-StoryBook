import { describe, expect, it } from 'vitest';
import { claveRealDeContacto, esClaveDeContactoManual } from './conversacionDeContacto';

describe('esClaveDeContactoManual', () => {
  it('reconoce una clave sintética de "Nuevo contacto"', () => {
    expect(esClaveDeContactoManual('conv:whatsapp:manual-abc-123:51993217014')).toBe(true);
  });

  it('una clave real de chat (persona = teléfono) no es manual', () => {
    expect(esClaveDeContactoManual('conv:whatsapp:51987000001:51993217014')).toBe(false);
  });
});

describe('claveRealDeContacto', () => {
  it('arma la misma forma que conversacionDeTelefono: conv:whatsapp:<dígitos>:<línea>', () => {
    expect(claveRealDeContacto({ telefono: '51987000001', linea: '51993217014' })).toBe(
      'conv:whatsapp:51987000001:51993217014',
    );
  });

  it('sin teléfono no hay clave real que armar', () => {
    expect(claveRealDeContacto({ telefono: null, linea: '51993217014' })).toBe(null);
  });
});
