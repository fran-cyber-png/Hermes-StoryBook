// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { montar, reposar, type Montado } from '../../pruebas/dom';
import { HiloWhatsapp } from './HiloWhatsapp';
import type { Conversacion } from '../../dominio/conversaciones';

/**
 * LA CABECERA DEL HILO, CON LO QUE HAY EN LA FICHA (ampliación del 25-ago-2026).
 *
 * Un contacto de campaña recién reclamado (`server/src/contactos/reclamar.ts`,
 * botón «Mensaje» de `PanelContacto`) abre el hilo con una `Conversacion`
 * armada en el cliente (`conversacionDeTelefono`), sin `persona_nombre` —así
 * que la cabecera seguía mostrando el teléfono pelado aunque el nombre YA
 * estuviera guardado en `contacto_ficha`, y el panel derecho, al lado, ya lo
 * dijera bien. Esto fija el CABLEADO: que la cabecera pregunte por la ficha,
 * no solo la regla de precedencia (que ya tiene su test puro en
 * `panel/identidad.test.ts`).
 */

const TELEFONO = '51988112233';
const LINEA = '51993217014';
const AHORA = new Date().toISOString();

const CONVERSACION = {
  clave: `conv:whatsapp:${TELEFONO}:${LINEA}`,
  canal: 'whatsapp',
  tipo: 'mensaje',
  persona_id: TELEFONO,
  persona_nombre: null, // sin pushname: recién reclamada, nunca escribió antes.
  numero_propio: LINEA,
  texto: null,
  contexto_texto: null,
  respondida: false,
  ventana_abierta: true,
  pregunto: false,
  n: 0,
  referencia: AHORA,
  ultimo_at: AHORA,
  dias: 0,
  nivel: 3,
} as Conversacion;

let montado: Montado | null = null;
const fetchOriginal = globalThis.fetch;

function servir(url: string): Response {
  const json = (c: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(c), { ...init, headers: { 'content-type': 'application/json' } });
  if (url.includes('/api/whatsapp/sesion')) return json({ estado: 'conectado', telefono: LINEA });
  if (url.includes('/api/whatsapp/conversacion/')) return json({ telefono: TELEFONO, mensajes: [], origen: null });
  if (url.includes('/api/contactos/registro')) {
    return json({
      ficha: { clave: CONVERSACION.clave, telefono: TELEFONO, nombre: 'Angel', apellido: 'Eduardo', vendedoraId: 'centurion:usuario12' },
    });
  }
  return json({}, { status: 404 });
}

afterEach(() => {
  montado?.desmontar();
  montado = null;
  globalThis.fetch = fetchOriginal;
});

describe('la cabecera de un hilo sin pushname, recién reclamado', () => {
  test('muestra el nombre de la ficha, no el teléfono pelado', async () => {
    globalThis.fetch = vi.fn(async (entrada: RequestInfo | URL) => servir(String(entrada))) as typeof fetch;
    montado = montar(<HiloWhatsapp conversacion={CONVERSACION} />);
    for (let i = 0; i < 5; i++) await reposar();

    const cabecera = montado.contenedor.querySelector('header');
    // El nombre grande de la cabecera dice «Angel Eduardo» — el teléfono
    // sigue abajo, chico, como el alias que siempre acompaña al nombre
    // (`panel/identidad.ts`), no reemplazado por él.
    const nombreGrande = cabecera?.querySelector('.font-heading.text-sm.font-bold');
    expect(nombreGrande?.textContent).toBe('Angel Eduardo');
  });
});
