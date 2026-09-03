import type { Conversacion } from '../../dominio/conversaciones';
import type { ContactoRegistrado } from './contactosRegistrados';

/**
 * `Conversacion` SINTÉTICAS para reusar `FichaRapida` (el drawer «Registrar
 * contacto» de Mensajes) desde Contactos de campaña — «Nuevo contacto» y
 * «Editar» comparten este mismo molde en vez de un formulario cada uno.
 *
 * Los campos que no lee `FichaRapida` (`n`, `referencia`, `dias`, `nivel`…)
 * llevan el valor de «esto nunca estuvo en la cola»: no hay urgencia, ventana
 * ni historial que afirmar sobre algo que no es una conversación real.
 */
function base(clave: string, numeroPropio: string | null): Conversacion {
  return {
    clave,
    canal: 'whatsapp',
    tipo: 'mensaje',
    persona_id: null,
    persona_nombre: null,
    numero_propio: numeroPropio,
    texto: null,
    contexto_texto: null,
    respondida: false,
    ventana_abierta: false,
    pregunto: false,
    n: 0,
    referencia: '',
    ultimo_at: new Date().toISOString(),
    dias: 0,
    nivel: 5,
  };
}

/** Para "Nuevo contacto": clave sintética, sin persona — el candidato la tipea a mano. */
export function conversacionNueva(linea: string): Conversacion {
  return base(`conv:whatsapp:manual-${crypto.randomUUID()}:${linea}`, linea);
}

/** Para "Editar": la clave REAL del contacto, con lo que ya se sabe de él prellenado. */
export function conversacionDeFicha(c: ContactoRegistrado): Conversacion {
  return {
    ...base(c.clave, c.linea),
    persona_id: c.telefono,
    persona_nombre: [c.nombre, c.apellido].filter(Boolean).join(' ').trim() || null,
  };
}

/**
 * ¿ES UNA CLAVE SINTÉTICA DE «NUEVO CONTACTO» (sin chat)?
 *
 * ⚠️ **Copia del mismo criterio que `esClaveDeContactoManual` del server**
 * (`server/src/contactos/fichaLocal.ts`) — no se puede importar entre los dos
 * paquetes, así que si el patrón de la clave cambia allá, esto se desincroniza
 * en silencio. Cubierto por `conversacionDeContacto.test.ts`.
 */
export function esClaveDeContactoManual(clave: string): boolean {
  return clave.split(':')[2]?.startsWith('manual-') ?? false;
}

/**
 * LA CLAVE REAL que tendría esta persona si el candidato le escribe (o ella
 * escribe primero) por su línea de campaña — la misma que arma
 * `dominio/conversacionNueva.ts` → `conversacionDeTelefono`. Sirve para
 * "reclamar" una ficha manual antes de abrir el chat (`PanelContacto`, botón
 * «Mensaje»): sin eso, Mensajes nace con una clave distinta y no encuentra
 * nombre, distrito, etiquetas ni timeline (ver `server/src/contactos/reclamar.ts`).
 */
export function claveRealDeContacto(c: Pick<ContactoRegistrado, 'telefono' | 'linea'>): string | null {
  if (!c.telefono) return null;
  return `conv:whatsapp:${c.telefono.replace(/\D/g, '')}:${c.linea}`;
}
