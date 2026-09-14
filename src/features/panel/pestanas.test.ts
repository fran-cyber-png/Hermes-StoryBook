import { describe, expect, it } from 'vitest';
import {
  pestanaInicial,
  pestanasDe,
  seccionesDetalle,
  seccionInicial,
  type IdPestana,
  type IdSeccionDetalle,
} from './pestanas';

describe('las pestañas del panel derecho', () => {
  it('son siempre las cuatro, en el mismo orden, en cualquier canal', () => {
    for (const canal of ['whatsapp', 'facebook', 'instagram'] as const) {
      expect(pestanasDe({ canal, conTelefono: canal === 'whatsapp' }).map((p) => p.id)).toEqual([
        'ficha',
        'plantillas',
        'notas',
        'curso',
      ]);
    }
  });

  it('en Facebook, «Enviar» se apaga con su motivo — no desaparece', () => {
    const enviar = pestanasDe({ canal: 'facebook', conTelefono: false }).find((p) => p.id === 'plantillas')!;
    expect(enviar.disponible).toBe(false);
    expect(enviar.motivo).toMatch(/WhatsApp/);
  });

  it('en WhatsApp «Enviar» está disponible y sin motivo que explicar', () => {
    const enviar = pestanasDe({ canal: 'whatsapp', conTelefono: true }).find((p) => p.id === 'plantillas')!;
    expect(enviar.disponible).toBe(true);
    expect(enviar.motivo).toBeUndefined();
  });

  it('se respeta la última pestaña elegida al cambiar de conversación', () => {
    const wa = pestanasDe({ canal: 'whatsapp', conTelefono: true });
    expect(pestanaInicial(wa, 'notas')).toBe('notas');
  });

  it('si la elegida no está disponible en este canal, cae a la primera que sí', () => {
    const fb = pestanasDe({ canal: 'facebook', conTelefono: false });
    expect(pestanaInicial(fb, 'plantillas')).toBe('ficha');
  });

  it('sin preferencia previa, abre en la Ficha', () => {
    expect(pestanaInicial(pestanasDe({ canal: 'whatsapp', conTelefono: true }), null)).toBe('ficha');
  });

  it('una preferencia basura no rompe nada', () => {
    const wa = pestanasDe({ canal: 'whatsapp', conTelefono: true });
    expect(pestanaInicial(wa, 'inventada' as IdPestana)).toBe('ficha');
  });
});

// #887 — Resumen · Actividad · Compras, dentro de «Ficha». «Datos» se fue a la cabecera el 13-sep-2026.
describe('las secciones del detalle del contacto', () => {
  it('en ventas son las tres, en ese orden', () => {
    expect(seccionesDetalle().map((s) => s.id)).toEqual(['resumen', 'actividad', 'compras']);
    expect(seccionesDetalle({ esDeCampana: false }).map((s) => s.id)).toEqual(['resumen', 'actividad', 'compras']);
  });

  /**
   * 🔴 Regla del dueño (11-sep-2026): el detalle de campaña no muestra nada de
   * ventas ni de compras. «Compras» no se apaga con un motivo —como las
   * pestañas de `pestanasDe`—: no existe, porque en campaña no hay un «todavía».
   */
  it('en campaña no existe «Compras»: son dos', () => {
    expect(seccionesDetalle({ esDeCampana: true }).map((s) => s.id)).toEqual(['resumen', 'actividad']);
  });

  it('en campaña, una preferencia por «Compras» cae en Resumen', () => {
    expect(seccionInicial('compras', { esDeCampana: true })).toBe('resumen');
  });

  // Una preferencia de antes del 13-sep-2026 puede decir «datos»: la sección ya no existe y cae en Resumen.
  it('una preferencia vieja por «Datos» cae en Resumen', () => {
    expect(seccionInicial('datos' as IdSeccionDetalle)).toBe('resumen');
    expect(seccionInicial('datos' as IdSeccionDetalle, { esDeCampana: true })).toBe('resumen');
  });

  it('sin preferencia previa, abre en Resumen', () => {
    expect(seccionInicial(null)).toBe('resumen');
  });

  it('se respeta la última sección elegida', () => {
    expect(seccionInicial('compras')).toBe('compras');
  });

  it('una preferencia que no es ninguna sección cae a Resumen', () => {
    expect(seccionInicial('inventada' as IdSeccionDetalle)).toBe('resumen');
  });
});
