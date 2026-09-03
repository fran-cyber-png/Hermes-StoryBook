import type { Conversacion } from '../../dominio/conversaciones';

/**
 * Fábrica de `Conversacion` de prueba, para Storybook — no para producción.
 * Rellena los campos obligatorios con un caso realista (WhatsApp, urgente,
 * preguntó precio) y deja pisar cualquiera por `overrides`.
 */
export function crearConversacionMock(overrides: Partial<Conversacion> = {}): Conversacion {
  return {
    clave: 'conv:whatsapp:51943348051:51963139984',
    canal: 'whatsapp',
    tipo: 'mensaje',
    persona_id: 'persona-1',
    persona_nombre: 'Andrea Quispe',
    numero_propio: '51963139984',
    texto: '¿Cuánto cuesta el diplomado y hasta cuándo hay cupo?',
    contexto_texto: null,
    respondida: false,
    ya_le_hablamos: false,
    precio_enviado: false,
    etapa_efectiva: 'nuevo',
    etapa_manual: null,
    ventana_abierta: true,
    ventana_cierra: new Date(Date.now() + 1000 * 60 * 60 * 20).toISOString(),
    pregunto: true,
    pregunto_precio: true,
    n: 3,
    // `referencia`: la fecha que cuenta para el "hace X" de la fila (`lib/formato.ts:horasDesde`),
    // no un teléfono — nombre engañoso si no se lee `FilaConversacion.tsx:245` primero.
    referencia: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    ultimo_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    etapa_desde: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    dias: 0,
    nivel: 3,
    fijada: false,
    favorita: false,
    no_leido: true,
    ...overrides,
  };
}
