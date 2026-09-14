import { describe, expect, it } from 'vitest';
import {
  ESTADOS_QUE_PIDEN_VINCULAR,
  type MiLinea,
  motivoParaVincular,
  nuncaSePareo,
  rotuloDeVincular,
} from './miLinea';

describe('por qué se ofrece vincular', () => {
  it('sin línea propia: el caso de siempre', () => {
    expect(motivoParaVincular(false, undefined)).toBe('sin_linea');
    expect(motivoParaVincular(false, 'conectado')).toBe('sin_linea');
  });

  /**
   * 🔴 EL CASO QUE FALTABA: la línea está registrada y muda. El server lo
   * permite (`numeroPedido`) y el front no lo ofrecía, así que la única salida
   * era `wa:vincular` por SSH.
   */
  it.each([...ESTADOS_QUE_PIDEN_VINCULAR])('con línea propia en «%s» se ofrece re-vincular', (estado) => {
    expect(motivoParaVincular(true, estado)).toBe('linea_muda');
  });

  it('una línea que anda no se toca', () => {
    expect(motivoParaVincular(true, 'conectado')).toBe(null);
  });

  /**
   * 🔴 Un `temporary_ban` se MUESTRA y no se reintenta. Ofrecer «vuelve a
   * vincular» ahí es empujar a re-parear durante un ban — el anti-ban que este
   * repo prohíbe por escrito.
   */
  it('baneado NO ofrece vincular', () => {
    expect(motivoParaVincular(true, 'baneado')).toBe(null);
  });

  it('los transitorios tampoco: la línea vuelve sola', () => {
    expect(motivoParaVincular(true, 'conectando')).toBe(null);
    // Sin la fecha, `desconectado` se lee como transitorio. Es el default y es
    // correcto: un server que no manda `vinculado_at` no está diciendo «nunca».
    expect(motivoParaVincular(true, 'desconectado')).toBe(null);
  });

  /**
   * 🔴 EL CASO QUE DEJÓ A UNA VENDEDORA NUEVE DÍAS SIN BOTÓN (2-sep-2026).
   *
   * `5215610584485` estaba registrada desde el 24-ago con el `.db` de un pareo
   * que nadie completó, así que el server decía `desconectado` — el mismo estado
   * que una línea sana que se cayó. La fecha es lo único que los separa.
   */
  describe('desconectado significa dos cosas opuestas', () => {
    it('con vinculado_at en null NUNCA se pareó: sí se ofrece', () => {
      expect(motivoParaVincular(true, 'desconectado', null)).toBe('linea_muda');
    });

    it('con una fecha hubo un pareo que anduvo: no se toca', () => {
      expect(motivoParaVincular(true, 'desconectado', '2026-08-24T16:48:04Z')).toBe(null);
    });

    it('undefined NO es null — un server viejo no dice «nunca», dice «no sé»', () => {
      expect(motivoParaVincular(true, 'desconectado', undefined)).toBe(null);
    });

    it('la fecha no resucita a los estados que no piden vincular', () => {
      // Que nunca se haya pareado no vuelve ofrecible un ban ni una línea viva.
      expect(motivoParaVincular(true, 'baneado', null)).toBe(null);
      expect(motivoParaVincular(true, 'conectado', null)).toBe(null);
      expect(motivoParaVincular(true, 'vinculando', null)).toBe(null);
    });

    it('sin línea propia manda `sin_linea`, mire lo que mire la fecha', () => {
      expect(motivoParaVincular(false, 'desconectado', null)).toBe('sin_linea');
    });
  });

  describe('nuncaSePareo, la regla sola', () => {
    it('es exactamente desconectado + null', () => {
      expect(nuncaSePareo('desconectado', null)).toBe(true);
      // 🔴 `no_montada` es el estado con el que el server publica desde el
      // 7-sep-2026 el caso EXACTO que este arreglo cubre (archivo de un pareo
      // abandonado, sin fecha). Sin esta línea vuelven los nueve días de Nicole.
      expect(nuncaSePareo('no_montada', null)).toBe(true);
      expect(nuncaSePareo('no_montada', '2026-08-24T16:48:04Z')).toBe(false);
      expect(nuncaSePareo('desconectado', undefined)).toBe(false);
      expect(nuncaSePareo('desconectado', '2026-08-24T16:48:04Z')).toBe(false);
      expect(nuncaSePareo('sin_vincular', null)).toBe(false);
      expect(nuncaSePareo('conectado', null)).toBe(false);
    });
  });

  it('sin estado no se ofrece — ante la duda el botón no parpadea', () => {
    expect(motivoParaVincular(true, undefined)).toBe(null);
    expect(motivoParaVincular(true, '')).toBe(null);
  });

  it('un estado que no conocemos no ofrece nada', () => {
    expect(motivoParaVincular(true, 'algo-nuevo')).toBe(null);
  });

  it('las dos acciones se llaman distinto', () => {
    expect(rotuloDeVincular('sin_linea')).toBe('Vincular tu WhatsApp');
    expect(rotuloDeVincular('linea_muda')).toBe('Volver a vincular tu WhatsApp');
  });
});

/**
 * 🔴 EL CONTRATO, QUE ES POR DONDE SE ESCAPÓ EL DEFECTO.
 *
 * La regla de arriba estaba bien y no alcanzaba: `GET /api/whatsapp/mi-linea`
 * **no mandaba la fecha**, así que se la llamaba siempre con `undefined`. Un test
 * de regla no ve eso (ADR 0024, y otra vez acá).
 *
 * Esto fija el NOMBRE del campo tal como viaja en el JSON — `vinculado_at`, snake
 * case, igual que `admin.ts`. Un `vinculadoAt` en camel daría `undefined` en
 * silencio, que es exactamente el bug con otra ropa: sin error, sin log, sin
 * botón.
 */
describe('el payload real del server llega hasta la regla', () => {
  it('una línea registrada y nunca pareada ofrece volver a vincular', () => {
    const delServer: MiLinea = {
      numero: '5215610584485',
      sesion: { estado: 'desconectado', vinculado_at: null },
    };
    expect(
      motivoParaVincular(true, delServer.sesion?.estado, delServer.sesion?.vinculado_at),
    ).toBe('linea_muda');
  });

  it('una línea que sí se pareó alguna vez no se toca', () => {
    const delServer: MiLinea = {
      numero: '51970356062',
      sesion: { estado: 'desconectado', vinculado_at: '2026-09-02T14:32:12.461Z' },
    };
    expect(
      motivoParaVincular(true, delServer.sesion?.estado, delServer.sesion?.vinculado_at),
    ).toBe(null);
  });
});
