import { describe, expect, it } from 'vitest';
import { llamablePor } from './useLlamable';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * `llamablePor` es la fórmula de ADR 0123 sin React Query — ver el docblock de `useLlamable.ts`.
 * Antes del 14-sep-2026 la regla vivía inline en `PanelLlamada.tsx` sin motivo: acá se fija cada
 * rama por separado, incluido el caso medido en producción.
 */

const LINEA = '51984429504';

function conv(sobre: Partial<Conversacion> = {}): Conversacion {
  return {
    clave: 'conv:whatsapp:51999888777:51984429504',
    canal: 'whatsapp',
    tipo: 'mensaje',
    persona_id: '51999888777',
    persona_nombre: null,
    numero_propio: LINEA,
    texto: null,
    contexto_texto: null,
    respondida: false,
    ventana_abierta: true,
    pregunto: false,
    n: 1,
    referencia: 'wamid.1',
    ultimo_at: '2026-09-14T10:00:00.000Z',
    dias: 0,
    nivel: 0,
    ...sobre,
  };
}

describe('llamablePor', () => {
  it('sin conversación no aplica: ni llamable ni motivo (los otros usos de BotonLlamar, sin cambiar su comportamiento)', () => {
    expect(llamablePor(null, { estado: 'listo', activa: true, linea: LINEA })).toEqual({
      llamable: false,
      motivo: null,
      telefono: '',
      linea: LINEA,
    });
  });

  it('mientras `/activas` no contestó: "consultando"', () => {
    const r = llamablePor(conv(), { estado: 'pendiente', activa: false, linea: null });
    expect(r.llamable).toBe(false);
    expect(r.motivo).toBe('consultando');
  });

  it('si `/activas` falló: "error"', () => {
    const r = llamablePor(conv(), { estado: 'error', activa: false, linea: null });
    expect(r.motivo).toBe('error');
  });

  it('🔴 EL CASO MEDIDO EL 14-SEP-2026: Ventas Meta, canal y línea correctos, pero esta cuenta no tiene las llamadas activas', () => {
    // El botón de la cabecera abrió el marcador sin decir por qué. Con el hook, el motivo es
    // explícito y distinto de "otra_linea": el problema es LA PERSONA, no la conversación.
    const r = llamablePor(conv({ canal: 'whatsapp', numero_propio: LINEA }), {
      estado: 'listo',
      activa: false,
      linea: LINEA,
    });
    expect(r.llamable).toBe(false);
    expect(r.motivo).toBe('sin_llamadas_para_ti');
  });

  it('otro canal (no whatsapp): "otra_linea"', () => {
    const r = llamablePor(conv({ canal: 'facebook' }), { estado: 'listo', activa: true, linea: LINEA });
    expect(r.motivo).toBe('otra_linea');
  });

  it('whatsapp, pero por una línea que no es Ventas Meta: "otra_linea"', () => {
    const r = llamablePor(conv({ numero_propio: '51900000000' }), { estado: 'listo', activa: true, linea: LINEA });
    expect(r.motivo).toBe('otra_linea');
  });

  it('el server no tiene una línea Cloud API configurada: "otra_linea"', () => {
    const r = llamablePor(conv(), { estado: 'listo', activa: true, linea: null });
    expect(r.motivo).toBe('otra_linea');
  });

  it('un lead de formulario sin chat todavía: "es_lead"', () => {
    const r = llamablePor(conv({ tipo: 'lead' }), { estado: 'listo', activa: true, linea: LINEA });
    expect(r.motivo).toBe('es_lead');
  });

  it('sin teléfono: "sin_telefono"', () => {
    const r = llamablePor(conv({ persona_id: null }), { estado: 'listo', activa: true, linea: LINEA });
    expect(r.motivo).toBe('sin_telefono');
  });

  it('con todo en orden: llamable, sin motivo', () => {
    const r = llamablePor(conv(), { estado: 'listo', activa: true, linea: LINEA });
    expect(r).toEqual({ llamable: true, motivo: null, telefono: '51999888777', linea: LINEA });
  });
});
