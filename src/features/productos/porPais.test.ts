import { describe, expect, it } from 'vitest';
import type { HechoDelCatalogo } from '../hechos/catalogo';
import { datosPorPais, nombreDePais, paisDeClave } from './porPais';

function hecho(clave: string, h: Partial<HechoDelCatalogo> = {}): HechoDelCatalogo {
  return { clave, rotulo: clave, texto: `texto de ${clave}`, momentos: [], orden: 100, activo: true, ...h };
}

/**
 * Las doce claves de producción (leídas el 10-sep-2026). Los TEXTOS no se copian acá:
 * los de pago traen cuentas de banco, y lo que se prueba es a qué producto le toca
 * cada dato, no qué dice.
 */
const PRODUCCION = [
  'pago-bolivia',
  'pago-ecuador',
  'pago-link-tarjeta',
  'pago-mexico',
  'pago-otros-paises',
  'pago-panama-guatemala-rd',
  'pago-peru',
  'pago-usa',
  'precio-bolivia',
  'precio-mexico',
  'precio-otros-paises',
  'precio-peru',
].map((c) => hecho(c));

/** Los que conviven con ellos en la misma tabla y NO son por país. */
const OTROS = [hecho('yape'), hecho('cuotas'), hecho('brochure'), hecho('precio-por-pais', { activo: false })];

describe('paisDeClave — la convención que ya cumplen las claves de producción', () => {
  it('las doce claves de producción dicen tipo y país', () => {
    for (const h of PRODUCCION) expect(paisDeClave(h.clave), h.clave).not.toBeNull();
  });

  it('el país puede llevar guiones', () => {
    expect(paisDeClave('pago-panama-guatemala-rd')).toEqual({ tipo: 'pago', pais: 'panama-guatemala-rd' });
    expect(paisDeClave('precio-otros-paises')).toEqual({ tipo: 'precio', pais: 'otros-paises' });
  });

  it('`precio-por-pais` es la instrucción del bot, no un país', () => {
    expect(paisDeClave('precio-por-pais')).toBeNull();
  });

  it('`yape`, `cuotas` y compañía no son por país', () => {
    for (const h of OTROS) expect(paisDeClave(h.clave), h.clave).toBeNull();
  });
});

describe('datosPorPais — a qué producto le toca cada dato (la llave es la familia)', () => {
  it('HOY, sin familia en ningún dato: la hoja ofrece dónde pagar en los 8 y ningún precio', () => {
    const datos = datosPorPais([...PRODUCCION, ...OTROS], 'DIPICOT');
    expect(datos.map((d) => d.pais)).toEqual([
      'peru',
      'mexico',
      'bolivia',
      'ecuador',
      'usa',
      'panama-guatemala-rd',
      'otros-paises',
      'link-tarjeta',
    ]);
    expect(datos.every((d) => d.pago !== null)).toBe(true);
    expect(datos.every((d) => d.precio === null)).toBe(true);
  });

  it('un precio con familia se ve SOLO en su producto: Oratoria no se cotiza con el precio de Inteligencia', () => {
    const enlazados = PRODUCCION.map((h) => (h.clave.startsWith('precio-') ? { ...h, familia: 'DIPICOT' } : h));
    expect(datosPorPais(enlazados, 'DIPICOT').find((d) => d.pais === 'peru')?.precio?.clave).toBe('precio-peru');
    expect(datosPorPais(enlazados, 'EPCOORP').every((d) => d.precio === null)).toBe(true);
  });

  it('la familia se compara sin importar mayúsculas ni espacios', () => {
    const datos = datosPorPais([hecho('precio-peru', { familia: ' dipicot ' })], 'DIPICOT');
    expect(datos[0]?.precio?.clave).toBe('precio-peru');
  });

  it('un pago de la familia le gana al general del mismo país, venga antes o después', () => {
    const general = hecho('pago-peru', { texto: 'general' });
    const suyo = hecho('pago-peru', { texto: 'de oratoria', familia: 'EPCOORP' });
    expect(datosPorPais([general, suyo], 'EPCOORP')[0]?.pago?.texto).toBe('de oratoria');
    expect(datosPorPais([suyo, general], 'EPCOORP')[0]?.pago?.texto).toBe('de oratoria');
    expect(datosPorPais([general, suyo], 'DIPICOT')[0]?.pago?.texto).toBe('general');
  });

  it('un dato apagado no aparece', () => {
    expect(datosPorPais([hecho('pago-peru', { activo: false })], 'DIPICOT')).toEqual([]);
  });

  it('sin nada por país la lista es vacía, y la hoja no dibuja la sección (regla del cero)', () => {
    expect(datosPorPais(OTROS, 'DIPICOT')).toEqual([]);
  });

  it('un país que nadie previó no se pierde: va al final, con su clave legible', () => {
    const datos = datosPorPais([hecho('pago-costa-rica'), hecho('pago-peru')], 'DIPICOT');
    expect(datos.map((d) => d.nombre)).toEqual(['Perú', 'Costa rica']);
    expect(nombreDePais('costa-rica')).toBe('Costa rica');
  });
});
