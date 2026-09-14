import { describe, expect, it } from 'vitest';
import {
  canalEfectivo,
  porcentajeEnPalabras,
  resumenDeProvincias,
  resumenDeTemas,
  sinProvincias,
  sinTemas,
  type BloqueDeCanal,
  type Escucha,
} from './campana';

/**
 * LO QUE EL PANEL DE ESCUCHA DERIVA PARA PODER EXPLICARSE SOLO.
 *
 * Cada caso de acá salió de mirar el panel con el corpus REAL de Betto (27.313
 * mensajes) en los cuatro períodos por los cuatro canales — no de imaginar
 * entradas. Los números que aparecen son los que estaban en pantalla.
 *
 * ⚠️ Estos son tests de REGLA. El de CABLEADO —que el panel llame a estas
 * funciones y no vuelva a escribir el texto a mano— vive en
 * `PanelEscucha.test.tsx`, porque el defecto que ya se pagó dos veces en este
 * repo (ADR 0024, ADR 0068) es que nadie llame a la regla, no que esté mal
 * escrita.
 */

function bloque(total: number): BloqueDeCanal {
  return { total, sustancia: 0, temas: [], lugares: [], marcas: {} };
}

function escucha(totales: Partial<Record<string, number>>): Escucha {
  return {
    estado: 'ok',
    cliente: 'betto',
    version: 1,
    pendientes: 0,
    canales: {
      todas: bloque(totales.todas ?? 0),
      muro: bloque(totales.muro ?? 0),
      whatsapp: bloque(totales.whatsapp ?? 0),
      messenger: bloque(totales.messenger ?? 0),
      instagram: bloque(totales.instagram ?? 0),
    },
  };
}

describe('el vacío nombra el canal que se está mirando', () => {
  it('🔴 mirando WhatsApp NO explica lo que pasa en el muro', () => {
    // El caso real: «Hoy · WhatsApp» tiene 3 mensajes y ningún tema, y el panel
    // se justificaba con «En el muro pasa: la mayoría de los comentarios son
    // aliento» — la causa de otra superficie.
    const texto = sinTemas('whatsapp');
    expect(texto).toContain('WhatsApp');
    expect(texto.toLowerCase()).not.toContain('muro');
  });

  it('mirando el muro sí puede explicar el muro', () => {
    expect(sinTemas('muro')).toContain('muro');
  });

  it('sin filtro no le echa la culpa a ningún canal en particular', () => {
    expect(sinTemas('todas')).toContain('ningún canal');
  });

  it('las provincias siguen la misma regla', () => {
    expect(sinProvincias('messenger')).toContain('Messenger');
    // Fijado por igualdad y no con un `not.toContain('Messenger')`: esa rama
    // devuelve un literal que NUNCA nombró un canal, así que el aserto negativo
    // no se podía poner rojo con ninguna regresión — era decorado (candado #11).
    expect(sinProvincias('todas')).toBe('Todavía nadie nombró una provincia.');
  });
});

describe('una lista dice de qué subconjunto sale', () => {
  it('🔴 con más temas que filas, dice cuántos quedaron afuera', () => {
    // 30 días · Todos: se dibujan 6 de 13.
    expect(resumenDeTemas(13, 6)).toBe('Los 6 más nombrados, de 13 temas.');
  });

  it('🔴 nombra PROVINCIAS, que es lo que la lista filtra y el título no dice', () => {
    // 30 días · Todos: 20 provincias sobre 40 lugares — la mitad son distritos
    // y no se dibujan.
    expect(resumenDeProvincias(20, 6)).toBe('Las 6 más nombradas, de 20 provincias.');
  });

  it('cuando entran todas, no inventa un recorte que no hubo', () => {
    expect(resumenDeTemas(3, 6)).toBe('Los 3 temas nombrados en el período.');
    expect(resumenDeProvincias(4, 6)).toBe('Las 4 provincias nombradas en el período.');
  });

  it('una sola concuerda en género y número', () => {
    expect(resumenDeTemas(1, 6)).toBe('Un solo tema nombrado en el período.');
    expect(resumenDeProvincias(1, 6)).toBe('Una sola provincia nombrada en el período.');
  });

  it('lista vacía no lleva resumen: lo explica el texto de vacío', () => {
    expect(resumenDeTemas(0, 6)).toBe('');
    expect(resumenDeProvincias(0, 6)).toBe('');
  });
});

describe('el porcentaje no cambia de forma según el canal', () => {
  it('🔴 un entero lleva su decimal igual', () => {
    // Medido: 7 días · Facebook y 7 días · Messenger daban 12 exacto, y se
    // imprimía «12 %» al lado de un «13,9 %». Se lee como si midiera otra cosa.
    expect(porcentajeEnPalabras(12)).toBe('12,0 %');
    expect(porcentajeEnPalabras(13.8)).toBe('13,8 %');
  });

  it('sin mensajes no hay proporción que dar', () => {
    expect(porcentajeEnPalabras(null)).toBe('—');
  });
});

describe('el canal elegido puede dejar de existir al cambiar de período', () => {
  it('🔴 se cae a «Todos» cuando el canal ya no tiene nada', () => {
    // Elegir Messenger en «90 días» (635 mensajes) y volver a un período donde
    // no tiene ninguno: sin esto quedaban tres tarjetas en cero y ningún chip
    // prendido.
    expect(canalEfectivo(escucha({ todas: 116, muro: 92, messenger: 0 }), 'messenger')).toBe('todas');
  });

  it('respeta la elección mientras el canal tenga mensajes', () => {
    expect(canalEfectivo(escucha({ todas: 116, muro: 92, messenger: 21 }), 'messenger')).toBe(
      'messenger',
    );
  });

  it('no toca nada cuando el panel no está en «ok»: ahí manda el aviso de estado', () => {
    const sinCliente: Escucha = { ...escucha({}), estado: 'sin_cliente' };
    expect(canalEfectivo(sinCliente, 'messenger')).toBe('messenger');
    expect(canalEfectivo(undefined, 'messenger')).toBe('messenger');
  });
});
