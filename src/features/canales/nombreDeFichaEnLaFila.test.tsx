// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { montar, reposar, type Montado } from '../../pruebas/dom';
import { ColaUnificada } from './ColaUnificada';

/**
 * EL NOMBRE DE LA FICHA EN LA FILA DE LA COLA (ampliación del 25-ago-2026).
 *
 * En campaña, un contacto creado con «Nuevo contacto» y reclamado al mandarle
 * «Mensaje» (`server/src/contactos/reclamar.ts`) no tiene Cerberus ni
 * formulario — lo único que existe es lo que el equipo anotó a mano en
 * «Registrar contacto» (`contacto_ficha`). Sin `ficha_nombre` viajando en la
 * fila (`cola/consultarCola.ts`), la lista mostraba el teléfono pelado aunque
 * el nombre ya estuviera guardado.
 */

let montado: Montado | null = null;
const fetchOriginal = globalThis.fetch;

const CONVERSACION = {
  clave: 'conv:whatsapp:51988112233:51993217014',
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: '51988112233',
  persona_nombre: null, // sin pushname: nunca escribió por WhatsApp de verdad.
  numero_propio: '51993217014',
  texto: 'Anotado a mano por el equipo',
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 0,
  dias: 0,
  nivel: 3,
  ultimo_at: new Date().toISOString(),
  referencia: new Date().toISOString(),
  ficha_nombre: 'Angel',
  ficha_apellido: 'Eduardo',
};

function servir(url: string): Response {
  if (url.includes('/api/conversaciones?')) {
    return new Response(
      JSON.stringify({ conversaciones: [CONVERSACION], total: 1, hayMas: false }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  return new Response(JSON.stringify({ message: 'no' }), { status: 404 });
}

beforeEach(() => {
  vi.stubGlobal('fetch', (entrada: RequestInfo | URL) => Promise.resolve(servir(String(entrada))));
});

async function pintada(): Promise<string> {
  for (let i = 0; i < 6; i++) await reposar();
  return montado?.contenedor.textContent ?? '';
}

afterEach(() => {
  montado?.desmontar();
  montado = null;
  vi.stubGlobal('fetch', fetchOriginal);
});

describe('el nombre de la ficha en una fila sin pushname ni formulario', () => {
  it('muestra "Angel Eduardo", no el teléfono pelado', async () => {
    montado = montar(<ColaUnificada seleccionada={null} onSeleccionar={() => {}} miVendedora="luz" />);
    const texto = await pintada();

    expect(texto).toContain('Angel Eduardo');
    expect(texto).not.toContain('51988112233');
  });
});
