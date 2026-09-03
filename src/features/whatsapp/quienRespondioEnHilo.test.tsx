// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { montar, reposar, type Montado } from '../../pruebas/dom';
import { HiloWhatsapp } from './HiloWhatsapp';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * QUIÉN RESPONDIÓ, EN LA BURBUJA.
 *
 * Pedido del dueño (23-ago-2026): «en los chats o en algún lado que se sepa
 * quién respondió a tal dato para tenerlo mapeado». La línea de campaña la
 * atienden **18 operadores** y el hilo no decía nada: quien abría un chat tres
 * días después no tenía forma de saber quién había contestado.
 *
 * 🔴 **Lo que este test fija no es que el nombre aparezca: es que NO aparezca
 * cuando no se sabe.** `enviado_por` falta en tres casos reales —lo que la
 * vendedora mandó desde su propio teléfono (no pasa por `envios_wa`), lo
 * anterior a este frente, y un server viejo entre N4 y N5—, y ahí un nombre
 * inventado es peor que un hueco: haría creer que alguien del equipo contestó
 * algo que nadie escribió desde Hermes.
 *
 * ⚠️ **Es un test de DOM y no una captura, a propósito.** La galería que monta
 * el hilo real (`galeria-composer.html`) no renderiza los mensajes —defecto
 * preexistente, ajeno a este frente—, así que la evidencia visual no se pudo
 * sacar. Lo que se verifica acá es el CABLEADO, que es lo que una captura
 * tampoco probaría: la lección de ADR 0024.
 */

const TELEFONO = '51987654321';
const NUMERO_PROPIO = '51963139984';
const AHORA = new Date().toISOString();

const CONVERSACION = {
  clave: `conv:whatsapp:${TELEFONO}:${NUMERO_PROPIO}`,
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: TELEFONO,
  persona_nombre: 'Javier',
  numero_propio: NUMERO_PROPIO,
  texto: 'hola',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 1,
  referencia: 'r1',
  ultimo_at: AHORA,
  dias: 0,
  nivel: 0,
} as Conversacion;

let montado: Montado | null = null;

function conMensajes(mensajes: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL) => {
      const url = String(entrada);
      const json = (c: unknown) =>
        new Response(JSON.stringify(c), { headers: { 'content-type': 'application/json' } });
      if (url.includes('/api/whatsapp/sesion')) return json({ estado: 'conectado', telefono: NUMERO_PROPIO });
      if (url.includes('/api/whatsapp/conversacion/')) return json({ telefono: TELEFONO, mensajes, origen: null });
      return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
    }),
  );
}

const saliente = (id: number, extra: Record<string, unknown>) => ({
  id,
  direccion: 'saliente',
  autor: 'luz',
  texto: `mensaje ${id}`,
  occurred_at: AHORA,
  external_id: `e${id}`,
  ...extra,
});

async function pintar(mensajes: unknown[]) {
  conMensajes(mensajes);
  montado = montar(<HiloWhatsapp conversacion={CONVERSACION} />);
  await reposar();
  return montado.contenedor.textContent ?? '';
}

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.unstubAllGlobals();
});

describe('quién respondió, en el hilo', () => {
  test('un saliente con autoría muestra el nombre corto de quien lo mandó', async () => {
    const texto = await pintar([saliente(1, { enviado_por: 'centurion:job.meneses' })]);
    expect(texto).toContain('Job.meneses');
    // El prefijo de Centurión no se muestra: la columna es angosta y no aporta.
    expect(texto).not.toContain('centurion:job.meneses');
  });

  test('una identidad de Cerberus se acorta igual que en la lista de Contactos', async () => {
    const texto = await pintar([saliente(2, { enviado_por: 'ventas10@grupogoberna.com' })]);
    expect(texto).toContain('Ventas10');
    expect(texto).not.toContain('@grupogoberna.com');
  });

  /**
   * 🔴 EL CASO QUE IMPORTA. Sin `enviado_por` no se dibuja NADA — ni un guion, ni
   * «desconocido», ni el nombre de quien mira. Pasa de verdad: los mensajes que
   * la vendedora manda desde su propio teléfono no pasan por `envios_wa`, y en
   * producción son la mayoría de lo saliente en las líneas de whatsmeow.
   */
  test('🔴 sin autoría NO se inventa un nombre', async () => {
    const texto = await pintar([saliente(3, {})]);
    expect(texto).not.toContain('Job.meneses');
    expect(texto).not.toContain('Ventas10');
    expect(texto).not.toContain('desconocid');
  });

  /**
   * ⚠️ Un automático ya lleva su propia marca (ADR 0016) y su `vendedora_id` es
   * el del despachador, no el de una persona: dos etiquetas en la misma línea
   * dirían lo mismo dos veces, y una de las dos sería falsa.
   */
  test('en un automático gana la marca del bot, no la autoría', async () => {
    const texto = await pintar([
      saliente(4, { automatico: true, aprobada_por: 'ana', enviado_por: 'centurion:usuario9' }),
    ]);
    expect(texto).toContain('Aprobado · ana');
    expect(texto).not.toContain('Usuario9');
  });

  /** ⚠️ La autoría es de lo que MANDAMOS: un entrante no puede llevarla. */
  test('un entrante no muestra autoría aunque venga el campo', async () => {
    const texto = await pintar([
      { ...saliente(5, { enviado_por: 'centurion:job.meneses' }), direccion: 'entrante' },
    ]);
    expect(texto).not.toContain('Job.meneses');
  });
});
