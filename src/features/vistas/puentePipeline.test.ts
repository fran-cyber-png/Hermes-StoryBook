import { describe, expect, it } from 'vitest';
import { planDelPuente, resolverRecorteDelPuente } from './puentePipeline';
import { SIN_ASIGNAR } from './lista';

/**
 * EL PUENTE DESDE EL DASHBOARD — qué hace el Pipeline con lo que le mandan.
 *
 * La pestaña «Hoy» del Dashboard mide y el Pipeline trabaja (ADR 0104): cada
 * cifra de «Hoy» abre el Pipeline ya recortado. Lo que se fija acá es la
 * traducción, y sobre todo lo que NO se puede hacer todavía: un recorte que el
 * server no publica se AVISA, nunca se ignora en silencio ni se manda a romper.
 */
describe('planDelPuente', () => {
  it('una luz se vuelve el recorte de la mesa, sin aviso', () => {
    expect(planDelPuente({ tipo: 'pipeline', recorte: { luz: 'verde' } })).toEqual({
      luz: 'verde',
      recorteDelDia: null,
      linea: null,
      canal: null,
      filtroAsignada: null,
    });
  });

  it('un recorte del día queda PEDIDO, no aplicado: si se aplica lo decide el server que conteste', () => {
    expect(planDelPuente({ tipo: 'pipeline', recorte: { escribioHoy: true } })).toMatchObject({
      luz: null,
      recorteDelDia: 'escribioHoy',
    });
    expect(planDelPuente({ tipo: 'pipeline', recorte: { sinRespuesta24h: true } })).toMatchObject({
      luz: null,
      recorteDelDia: 'sinRespuesta24h',
    });
  });

  it('la línea pasa tal cual, y sin línea no se toca', () => {
    expect(planDelPuente({ tipo: 'pipeline', linea: '51984429504' }).linea).toBe('51984429504');
    expect(planDelPuente({ tipo: 'pipeline' }).linea).toBeNull();
  });

  it('el canal pasa tal cual — lo que no entró por ninguna línea (un DM de Messenger o Instagram) — y sin canal no se toca', () => {
    expect(planDelPuente({ tipo: 'pipeline', canal: 'instagram' }).canal).toBe('instagram');
    expect(planDelPuente({ tipo: 'pipeline' }).canal).toBeNull();
  });

  it('🔴 `asignadaA: null` es «Sin asignar» y AUSENTE es no filtrar — no son lo mismo', () => {
    expect(planDelPuente({ tipo: 'pipeline', asignadaA: null }).filtroAsignada).toBe(SIN_ASIGNAR);
    expect(planDelPuente({ tipo: 'pipeline' }).filtroAsignada).toBeNull();
  });

  it('una dueña con otra grafía se normaliza (candado 4: «Luz» y «luz» son la misma)', () => {
    expect(planDelPuente({ tipo: 'pipeline', asignadaA: ' Luz ' }).filtroAsignada).toBe('luz');
  });
});

/**
 * EL SERVER DICE SI YA SABE RECORTAR POR EL DÍA (`recortesDisponibles` en la raíz
 * de GET /tablero). Mandar `etapa:escribioHoy` a un server que no lo conoce es un
 * 400 del tablero ENTERO, así que el puente espera la primera respuesta antes de
 * decidir: aplicar, o avisar.
 */
describe('resolverRecorteDelPuente', () => {
  it('mientras el tablero todavía no contestó, espera', () => {
    expect(resolverRecorteDelPuente('escribioHoy', undefined, true)).toEqual({ tipo: 'esperar' });
  });

  it('si el server lo publica, se aplica', () => {
    expect(resolverRecorteDelPuente('escribioHoy', ['precio', 'escribioHoy'], false)).toEqual({
      tipo: 'aplicar',
      recorte: 'escribioHoy',
    });
  });

  it('🔴 un server que publica recortes pero no ESE: aviso, nunca un pedido que da 400', () => {
    const r = resolverRecorteDelPuente('escribioHoy', ['precio', 'ventana', 'seguir', 'seCallo'], false);
    expect(r.tipo).toBe('avisar');
    expect(r.tipo === 'avisar' && r.aviso).toMatch(/escribieron por primera vez hoy/);
  });

  it('🔴 un server viejo (sin `recortesDisponibles`) que ya contestó: también aviso', () => {
    const r = resolverRecorteDelPuente('sinRespuesta24h', undefined, false);
    expect(r.tipo).toBe('avisar');
    expect(r.tipo === 'avisar' && r.aviso).toMatch(/24 h/);
  });

  it('🔴 si el tablero FALLÓ, el aviso dice que falló: no que el server todavía no sabe recortar', () => {
    const r = resolverRecorteDelPuente('escribioHoy', undefined, false, true);
    expect(r.tipo).toBe('avisar');
    expect(r.tipo === 'avisar' && r.aviso).toMatch(/no respondió/);
    expect(r.tipo === 'avisar' && r.aviso).not.toMatch(/todavía no puede/);
    expect(r.tipo === 'avisar' && r.aviso).toMatch(/escribieron por primera vez hoy/);
  });
});
