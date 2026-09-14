import { describe, expect, test } from 'vitest';
import type { FilaDesglose } from '../../dominio/desglose';
import {
  alcanceDeCanal,
  ayudaDeCanal,
  CANAL_INICIAL,
  canalesDeLaMesa,
  conteoPorCanal,
  filasDelCanal,
  TODOS_LOS_CANALES,
} from './canalDeMesa';

/**
 * EL CANAL DE LA MESA DE CAMPAÑA — qué íconos ofrece el Pipeline de campaña y qué le
 * pide al server cada uno (pedido del dueño, 13-sep-2026: «que se entienda que no
 * faltan leads por contestar, son comentarios»; «mensajes wspp ig y messenger y F
 * comment y Ig comment, Form no lo pongamos aún»; «exclusivamente para campaña»).
 */
describe('canalesDeLaMesa — qué íconos se ofrecen', () => {
  test('🔴 primero los MENSAJES (WhatsApp, Instagram, Messenger), después los COMENTARIOS (Facebook, Instagram)', () => {
    const canales = canalesDeLaMesa();
    expect(canales.map((c) => c.id)).toEqual(['whatsapp', 'instagram-mensaje', 'messenger', 'facebook', 'instagram-comentario']);
    expect(canales.filter((c) => c.grupo === 'mensajes').map((c) => c.id)).toEqual(['whatsapp', 'instagram-mensaje', 'messenger']);
    expect(canales.filter((c) => c.grupo === 'comentarios').map((c) => c.id)).toEqual(['facebook', 'instagram-comentario']);
  });

  test('🔴 Formulario todavía no («no lo pongamos aún»), y Grupos nunca', () => {
    const ids = canalesDeLaMesa().map((c) => c.id);
    expect(ids).not.toContain('formulario');
    expect(ids).not.toContain('grupos');
  });

  test('cada ícono dice QUÉ trae, y ninguno dice lo mismo que otro', () => {
    const ayudas = canalesDeLaMesa().map(ayudaDeCanal);
    expect(ayudas.every((a) => a.length > 10)).toBe(true);
    expect(new Set(ayudas).size).toBe(ayudas.length);
  });
});

describe('alcanceDeCanal — qué viaja al server', () => {
  test('🔴 la mesa arranca en WhatsApp', () => {
    expect(CANAL_INICIAL).toBe('whatsapp');
    expect(alcanceDeCanal(CANAL_INICIAL, null)).toEqual({ canal: 'whatsapp', tipo: null });
  });

  test('🔴 Instagram se parte en dos: los DMs y los comentarios comparten `canal=instagram` y los separa `tipo`', () => {
    expect(alcanceDeCanal('instagram-mensaje', null)).toEqual({ canal: 'instagram', tipo: 'mensaje' });
    expect(alcanceDeCanal('instagram-comentario', null)).toEqual({ canal: 'instagram', tipo: 'comentario' });
  });

  test('🔴 Facebook son los COMENTARIOS y Messenger los DMs', () => {
    expect(alcanceDeCanal('facebook', null)).toEqual({ canal: 'facebook', tipo: 'comentario' });
    expect(alcanceDeCanal('messenger', null)).toEqual({ canal: 'facebook', tipo: 'mensaje' });
  });

  test('«Todos» no recorta nada', () => {
    expect(alcanceDeCanal(TODOS_LOS_CANALES, null)).toBeNull();
  });

  test('un id que la mesa no ofrece no recorta (Formulario, un valor viejo): nunca un canal inventado', () => {
    expect(alcanceDeCanal('formulario', null)).toBeNull();
    expect(alcanceDeCanal('instagram', null)).toBeNull();
  });

  /**
   * El puente del Dashboard trae los DMs que no entraron por ninguna línea, y su
   * cifra cuenta DMs: por eso va con `tipo=mensaje` (`useTablero`, ADR 0104).
   */
  test('🔴 el canal del puente le gana al ícono, y va como DMs de ese canal', () => {
    expect(alcanceDeCanal('whatsapp', 'instagram')).toEqual({ canal: 'instagram', tipo: 'mensaje' });
  });
});

/**
 * EL DESGLOSE POR CANAL (`mesaPorCanal=1`, 13-sep-2026). Con esa marca el server
 * cuenta TODOS los canales en el desglose y le pone a cada fila su `canal` y su
 * `tipo`: la card de cada columna dice cuántos hay de cada uno, y la leyenda y las
 * cifras se quedan con las del canal que se está mirando.
 */
const filaDe = (etapa: string, canal: string, tipo: string, n: number): FilaDesglose => ({
  etapa,
  yaLeHablamos: false,
  precio: false,
  viva: false,
  canal,
  tipo,
  n,
});

const DESGLOSE_POR_CANAL: FilaDesglose[] = [
  filaDe('interesado', 'whatsapp', 'mensaje', 12),
  filaDe('interesado', 'facebook', 'comentario', 900),
  filaDe('interesado', 'facebook', 'mensaje', 4),
  filaDe('interesado', 'instagram', 'comentario', 300),
  filaDe('interesado', 'instagram', 'mensaje', 7),
  filaDe('interesado', 'landing', 'lead', 2),
  filaDe('contactado', 'whatsapp', 'mensaje', 40),
];

describe('filasDelCanal — el desglose del canal que se está mirando', () => {
  test('🔴 WhatsApp se queda con WhatsApp: los 900 comentarios de Facebook no entran a sus cifras', () => {
    expect(filasDelCanal(DESGLOSE_POR_CANAL, alcanceDeCanal('whatsapp', null))!.map((f) => f.n)).toEqual([12, 40]);
  });

  test('🔴 Instagram partido: los mensajes y los comentarios no se mezclan', () => {
    expect(filasDelCanal(DESGLOSE_POR_CANAL, alcanceDeCanal('instagram-mensaje', null))!.map((f) => f.n)).toEqual([7]);
    expect(filasDelCanal(DESGLOSE_POR_CANAL, alcanceDeCanal('instagram-comentario', null))!.map((f) => f.n)).toEqual([300]);
  });

  test('«Todos» no filtra nada', () => {
    expect(filasDelCanal(DESGLOSE_POR_CANAL, null)).toHaveLength(DESGLOSE_POR_CANAL.length);
  });

  test('sin desglose, nada', () => {
    expect(filasDelCanal(undefined, alcanceDeCanal('whatsapp', null))).toBeUndefined();
  });
});

describe('conteoPorCanal — «cuántos de wspp, cuántos de fb o ig hay en cada columna»', () => {
  test('🔴 cuenta los cinco pares de la fila de íconos, en su orden, y sólo de esa etapa', () => {
    expect(conteoPorCanal(DESGLOSE_POR_CANAL, 'interesado')).toEqual([
      { id: 'whatsapp', n: 12 },
      { id: 'instagram-mensaje', n: 7 },
      { id: 'messenger', n: 4 },
      { id: 'facebook', n: 900 },
      { id: 'instagram-comentario', n: 300 },
    ]);
    expect(conteoPorCanal(DESGLOSE_POR_CANAL, 'contactado')!.map((c) => c.n)).toEqual([40, 0, 0, 0, 0]);
  });

  /**
   * 🔴 LA REGLA DEL `tipo` ES LA DEL SERVER (#37): con ella el server recorta cada
   * columna, y si la suma por canal usara otra, la card diría una cifra y la columna
   * de abajo otra. `comentario` es todo lo que no es `mensaje`; `mensaje`, todo lo que
   * no es `comentario`; cualquier otro valor, sólo los `lead`. En campaña no hay leads
   * y equivale a comparar igual, pero se escribe la general.
   */
  test('🔴 `comentario` suma lo que no es `mensaje`, `mensaje` lo que no es `comentario`, y otro tipo sólo los `lead`', () => {
    const conLead: FilaDesglose[] = [
      filaDe('interesado', 'facebook', 'comentario', 10),
      filaDe('interesado', 'facebook', 'mensaje', 4),
      filaDe('interesado', 'facebook', 'lead', 2),
    ];
    expect(filasDelCanal(conLead, { canal: 'facebook', tipo: 'comentario' })!.map((f) => f.n)).toEqual([10, 2]);
    expect(filasDelCanal(conLead, { canal: 'facebook', tipo: 'mensaje' })!.map((f) => f.n)).toEqual([4, 2]);
    expect(filasDelCanal(conLead, { canal: 'facebook', tipo: 'lead' })!.map((f) => f.n)).toEqual([2]);
  });

  test('🔴 con un server viejo (filas sin `canal`) es null: no se dibuja una fila de ceros que no son ciertos', () => {
    const viejo: FilaDesglose[] = [{ etapa: 'interesado', yaLeHablamos: false, precio: false, viva: false, n: 12 }];
    expect(conteoPorCanal(viejo, 'interesado')).toBeNull();
    expect(conteoPorCanal(undefined, 'interesado')).toBeNull();
  });
});
