// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { montar, reposar, type Montado } from '../../pruebas/dom';
import type { Conversacion } from '../../dominio/conversaciones';
import { PanelDerecho } from './PanelDerecho';

/**
 * 🔴 LO QUE EL BOT DIJO, EN LA FICHA — el tercio del dato que no se veía nunca.
 *
 * La cola dibuja las calientes y las escaladas, y calla `tibio` y `frio` a
 * propósito: son tres de cada cuatro filas y no ayudan a ELEGIR a quién atender.
 * El efecto lateral es que las tibias no aparecían en ninguna pantalla de Hermes,
 * ni abriendo la conversación — la vendedora no tenía forma de saber que el bot
 * ya se había formado una opinión. (Cuántas son, medido, vive en `dominio/bot.ts`.)
 *
 * La ficha es el lugar donde sí entra: acá ya elegiste a quién mirar, así que la
 * pregunta dejó de ser «¿a quién toco?» y pasó a ser «¿qué sé de ésta?».
 *
 * Lo que este archivo fija es el CABLEADO —que el panel LLAME a `lecturaDelBot`—
 * y no el QUÉ se dice, que está probado puro en `dominio/bot.test.ts`. Es la
 * lección de ADR 0024: el defecto casi nunca es la regla, es que nadie la llama.
 */

const BASE: Conversacion = {
  clave: 'conv:whatsapp:51987654321:51963139984',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51987654321',
  persona_nombre: 'Javier Peralta',
  numero_propio: '51963139984',
  texto: null,
  contexto_texto: null,
  respondida: false,
  ventana_abierta: false,
  pregunto: false,
  n: 0,
  referencia: '2026-08-05T14:00:00.000Z',
  ultimo_at: '2026-08-05T14:00:00.000Z',
  dias: 0,
  nivel: 5,
};

let vista: Montado | null = null;

beforeEach(() => {
  // Todo falla, como en `PanelDerecho.campana.test.tsx`: lo que se mide acá es
  // lo que el panel dibuja con el dato que YA trae la conversación, y ese dato
  // no viene de ningún fetch.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('sin server en el test'))),
  );
});

afterEach(() => {
  vista?.desmontar();
  vista = null;
  vi.unstubAllGlobals();
});

async function abrir(c: Conversacion): Promise<Montado> {
  const m = montar(<PanelDerecho conversacion={c} />);
  vista = m;
  await reposar();
  return m;
}

describe('la ficha muestra lo que el bot calificó', () => {
  it('🔴 dice la TIBIA, que es la que no se veía en ninguna parte de la app', async () => {
    const m = await abrir({ ...BASE, bot_temperatura: 'tibio', bot_motivo: 'preguntó por el temario' });
    expect(m.contenedor.textContent).toMatch(/tibio/i);
  });

  it('y el porqué al lado: una temperatura sin motivo no se puede juzgar ni corregir', async () => {
    const m = await abrir({ ...BASE, bot_temperatura: 'tibio', bot_motivo: 'preguntó por el temario' });
    expect(m.contenedor.textContent).toMatch(/preguntó por el temario/i);
  });

  it('la caliente también, con su motivo', async () => {
    const m = await abrir({ ...BASE, bot_temperatura: 'caliente', bot_motivo: 'pidió el precio' });
    expect(m.contenedor.textContent).toMatch(/caliente/i);
    expect(m.contenedor.textContent).toMatch(/pidió el precio/i);
  });

  it('la escalada se dice en criollo, nunca con el enum crudo del server', async () => {
    const m = await abrir({ ...BASE, bot_escalada: true, bot_motivo: 'por_cerrar', bot_temperatura: 'caliente' });
    expect(m.contenedor.textContent).toMatch(/listo para cerrar/i);
    expect(m.contenedor.textContent).not.toMatch(/por_cerrar/);
  });

  it('🔴 sin calificación no dibuja nada: la ausencia de dato NO es «el bot la vio fría»', async () => {
    const m = await abrir(BASE);
    expect(m.contenedor.textContent).not.toMatch(/tibio|caliente|el bot/i);
  });

});
